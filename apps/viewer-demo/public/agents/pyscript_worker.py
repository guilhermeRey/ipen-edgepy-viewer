import asyncio
import builtins
import importlib
import json
import os
import sys
import traceback

import polyscript
from js import Object
from pyodide.ffi import create_proxy, to_js


AGENT_ROOT = "/home/pyodide/edgepy_agents"
agents_by_name = {}
xworker = polyscript.xworker


def _field(value, name, default=None):
    try:
        return getattr(value, name)
    except (AttributeError, TypeError):
        return default


def _response(request_id, response_type, **values):
    response = Object.new()
    response.edgepyResponse = True
    response.id = request_id
    response.type = response_type
    for name, value in values.items():
        setattr(response, name, _to_js(value))
    xworker.postMessage(response)


def _to_js(value):
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if hasattr(value, "to_dict"):
        value = value.to_dict()
    return to_js(value, dict_converter=Object.fromEntries)


def _input_context(request):
    context = json.loads(_field(request, "snapshotJson", "{}"))
    agent_input = json.loads(_field(request, "inputJson", "null"))
    image_values = _field(request, "imageValues")
    dose_values = _field(request, "doseValues")
    return context, agent_input, image_values, dose_values


def _install_agents(request):
    global agents_by_name
    files = json.loads(_field(request, "filesJson", "[]"))
    manifest = json.loads(_field(request, "manifestJson", "{}"))
    os.makedirs(AGENT_ROOT, exist_ok=True)
    for file in files:
        relative_path = file["path"].replace("\\", "/").lstrip("./")
        if not relative_path or ".." in relative_path.split("/"):
            raise ValueError(f"Invalid PyScript agent path: {file['path']}")
        target_path = os.path.join(AGENT_ROOT, relative_path)
        os.makedirs(os.path.dirname(target_path), exist_ok=True)
        with open(target_path, "w", encoding="utf-8") as target:
            target.write(file["content"])
    if AGENT_ROOT not in sys.path:
        sys.path.insert(0, AGENT_ROOT)
    agents = manifest.get("agents", [])
    agents_by_name = {agent["name"]: agent for agent in agents}
    return agents


def _run_agent(request):
    agent_name = _field(request, "agentName", "")
    descriptor = agents_by_name.get(agent_name)
    if descriptor is None:
        raise ValueError(f"PyScript agent '{agent_name}' is not installed.")
    context, agent_input, _, dose_values = _input_context(request)
    builtins.edgepy_dose_values = dose_values
    importlib.invalidate_caches()
    sys.modules.pop(descriptor["module"], None)
    module = importlib.import_module(descriptor["module"])
    target = module.agent if hasattr(module, "agent") else module
    process = getattr(target, descriptor.get("entrypoint", "process"))
    result = process(context, agent_input)
    return descriptor, result


def _run_editor(request):
    context, editor_input, image_values, dose_values = _input_context(request)
    namespace = {
        "edgepy_context": context,
        "edgepy_input": editor_input,
        "edgepy_image_values": image_values,
        "edgepy_dose_values": dose_values,
    }
    code = _field(request, "code", "")
    exec(compile(code, "<edgepy-pyscript-editor>", "exec"), namespace)
    return namespace.get("result")


async def _handle_request(request):
    request_id = int(_field(request, "id", 0))
    request_type = _field(request, "type", "")
    try:
        if request_type == "ping":
            _response(request_id, "pong")
        elif request_type == "installAgents":
            _response(request_id, "agentsInstalled", agents=_install_agents(request))
        elif request_type == "runAgent":
            descriptor, result = _run_agent(request)
            _response(request_id, "agentResult", agent=descriptor, result=result)
        elif request_type == "runEditor":
            _response(request_id, "editorResult", result=_run_editor(request))
        else:
            raise ValueError(f"Unknown EdgePy PyScript request: {request_type}")
    except Exception as error:
        _response(request_id, "error", error={
            "name": type(error).__name__,
            "message": str(error),
            "stack": traceback.format_exc(),
        })


def _on_message(event):
    request = event.data
    if _field(request, "edgepyRequest", False):
        asyncio.ensure_future(_handle_request(request))


_on_message_proxy = create_proxy(_on_message)
xworker.onmessage = _on_message_proxy
