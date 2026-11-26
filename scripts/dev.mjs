import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const isWindows = process.platform === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';

const backend = spawn(npmCmd, ['run', 'dev', '--prefix', 'backend'], {
  cwd: rootDir,
  stdio: 'inherit',
  shell: isWindows
});

const frontend = spawn(npmCmd, ['run', 'dev', '--prefix', 'frontend'], {
  cwd: rootDir,
  stdio: 'inherit',
  shell: isWindows
});

function shutdown() {
  backend.kill();
  frontend.kill();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
