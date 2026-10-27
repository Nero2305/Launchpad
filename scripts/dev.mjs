/** Run both services together so a single command gives a working fullstack app. */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
const venv = resolve(
  process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python',
);
const python = process.env.PYTHON || (existsSync(venv) ? venv : 'python');
const backend = spawn(
  python,
  ['-m', 'uvicorn', 'api.index:app', '--host', '127.0.0.1', '--port', '8000', '--reload'],
  { stdio: 'inherit' },
);
const frontend = spawn(
  process.execPath,
  ['node_modules/vite/bin/vite.js', '--host', '0.0.0.0', ...process.argv.slice(2)],
  { stdio: 'inherit' },
);
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  backend.kill();
  frontend.kill();
  process.exitCode = code;
}
for (const child of [backend, frontend]) {
  child.on('error', (error) => {
    console.error(error.message);
    stop(1);
  });
  child.on('exit', (code) => stop(code ?? 0));
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
