#!/usr/bin/env python3
"""Install, acquire, verify, build, collect and summarize the public benchmark."""

import argparse
from datetime import datetime, timezone
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import os
from pathlib import Path
import shutil
import subprocess
import sys
from threading import Thread
import venv

ROOT = Path(__file__).resolve().parent


class LocalFiles(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


def run(*command, **kwargs):
    print("+", " ".join(map(str, command)), flush=True)
    subprocess.run(list(map(str, command)), cwd=ROOT, check=True, **kwargs)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--smoke", action="store_true", help="Fixtures and one rehearsal pair; no measured results")
    parser.add_argument("--chrome", help="Chrome/Chromium executable; also accepts CHROME_PATH")
    parser.add_argument("--skip-install", action="store_true", help="Reuse this benchmark's installed dependencies")
    args = parser.parse_args()
    if sys.version_info[:2] != (3, 11):
        parser.error("Use Python 3.11, as pinned for the offline reference and analysis.")
    node, npm = shutil.which("node"), shutil.which("npm")
    if not node or not npm:
        parser.error("Install Node.js >= 22.12 and npm before running this command.")
    node_version = tuple(map(int, subprocess.check_output([node, "--version"], text=True).strip()[1:].split(".")))
    if node_version < (22, 12, 0):
        parser.error("Node.js >= 22.12 is required (Vite 7 and native WebSocket).")
    python = ROOT / ".venv" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
    if not args.skip_install:
        if not python.exists():
            venv.create(ROOT / ".venv", with_pip=True)
        run(python, "-m", "pip", "install", "-r", "requirements.txt")
        run(npm, "ci")
    if not python.exists():
        parser.error("No local Python environment; run once without --skip-install.")
    run(python, "scripts/acquire_dataset.py")
    run(python, "scripts/reference.py")
    run(npm, "run", "build")
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S.%fZ")
    output = ROOT / "results" / f"{stamp}-{'smoke' if args.smoke else 'collection'}"
    server = ThreadingHTTPServer(("127.0.0.1", 0), partial(LocalFiles, directory=str(ROOT)))
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    env = dict(os.environ, BENCHMARK_URL=f"http://127.0.0.1:{server.server_port}/dist/", BENCHMARK_OUTPUT=str(output))
    if args.chrome:
        env["CHROME_PATH"] = str(Path(args.chrome).expanduser().resolve())
    try:
        options = ["--smoke"] if args.smoke else []
        run(node, "scripts/run.mjs", *options, env=env)
        if not args.smoke:
            run(python, "scripts/analyze.py", output)
        print(f"Completed: {output}")
    finally:
        server.shutdown()
        server.server_close()
        thread.join()
        print(f"Records and diagnostics: {output}")


if __name__ == "__main__":
    try:
        main()
    except (subprocess.CalledProcessError, OSError, KeyboardInterrupt) as error:
        print(f"Benchmark interrupted: {error}", file=sys.stderr)
        sys.exit(1)
