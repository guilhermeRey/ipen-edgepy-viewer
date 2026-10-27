"""Adapter for experiment B; does not replace the G1 application."""
import io
import json
import sys
import hashlib
import numpy as np
import pydicom
import pyodide
from js import window, Uint8Array
from pyodide.ffi import create_proxy, to_js
from window_level import apply_window_level
from rgba_slice_mapper import NumpyRgbaSliceMapper

datasets = []
pixels = []
mapper = NumpyRgbaSliceMapper()


def reset():
    datasets.clear()
    pixels.clear()


def decode(data):
    # Same explicit JS -> Python byte copy used by the G1 FileReader adapter.
    ds = pydicom.dcmread(io.BytesIO(bytes(data.to_py())))
    arr = ds.pixel_array
    if arr.ndim != 2:
        raise ValueError("Only single-frame grayscale supported by this pilot")
    datasets.append(ds)
    pixels.append(arr)


def render(index, center, width):
    ds, raw = datasets[index], pixels[index]
    # Controlled physical-intensity input; G1 production instead normalizes per slice.
    scaled = raw.astype(np.float32) * np.float32(ds.RescaleSlope) + np.float32(ds.RescaleIntercept)
    rgba, _, _ = mapper.to_rgba(apply_window_level(scaled, center, width))
    return to_js(np.frombuffer(rgba, dtype=np.uint8))


def hashes():
    return json.dumps([
        {"raw_i32_sha256": hashlib.sha256(arr.astype('<i4').tobytes()).hexdigest(),
         "sop_instance_uid": str(ds.SOPInstanceUID), "shape": list(arr.shape)}
        for ds, arr in zip(datasets, pixels)
    ])


def cached(index):
    return int(pixels[index].size)


window.pyDecode = create_proxy(decode)
window.pyReset = create_proxy(reset)
window.pyRender = create_proxy(render)
window.pyHashes = create_proxy(hashes)
window.pyCached = create_proxy(cached)
window.pyVersions = json.dumps({"python": sys.version, "pyodide": pyodide.__version__,
                                "pydicom": pydicom.__version__, "numpy": np.__version__})
window.pyReady = True
