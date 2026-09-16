import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const docsRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const localPython = resolve(docsRoot, ".venv/bin/python");
const python = process.env.MKDOCS_PYTHON ?? (existsSync(localPython) ? localPython : "python3");
const args = ["-m", "mkdocs", ...process.argv.slice(2)];
const child = spawn(python, args, { cwd: docsRoot, stdio: "inherit" });

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
