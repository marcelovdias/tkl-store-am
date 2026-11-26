import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const port = Number(process.env.PORT) || 3001;

function isPortOpen(targetPort) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port: targetPort, host: '127.0.0.1' });
    socket.once('connect', () => {
      socket.end();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
  });
}

let serverProc = null;
const alreadyRunning = await isPortOpen(port);

if (!alreadyRunning) {
  console.log(`Iniciando servidor TKL Store AM na porta ${port}...`);
  serverProc = spawn(process.execPath, ['--no-warnings', 'backend/src/server.js'], {
    cwd: rootDir,
    stdio: 'inherit'
  });
  await new Promise((r) => setTimeout(r, 1500));
} else {
  console.log(`Servidor já está ativo na porta ${port}.`);
}

console.log('\nAbrindo túnel HTTPS temporário para compartilhamento com o cliente...\n');

const isWin = process.platform === 'win32';
const npxCmd = isWin ? 'npx.cmd' : 'npx';
const tunnel = spawn(npxCmd, ['--yes', 'localtunnel', '--port', String(port)], {
  cwd: rootDir,
  shell: isWin,
  stdio: ['ignore', 'pipe', 'pipe']
});

tunnel.stdout.on('data', (chunk) => {
  const text = chunk.toString();
  process.stdout.write(text);
  const match = text.match(/https:\/\/[^\s]+/);
  if (match) {
    const publicUrl = match[0].trim();
    console.log('\n==============================================================');
    console.log('LINKS DINÂMICOS PARA ENVIAR AO CLIENTE:');
    console.log(`- Portfólio de Apresentação: ${publicUrl}/portfolio/`);
    console.log(`- Vitrine Pública (PC/Mobile): ${publicUrl}/vitrine/`);
    console.log(`- Painel de Gestão (ERP):      ${publicUrl}/`);
    console.log('==============================================================\n');
    console.log('Obs.: Caso o localtunnel solicite senha de acesso (Tunnel Password),');
    console.log('informe o seu IP público exibido em https://loca.lt/mytunnelpassword');
    console.log('Pressione Ctrl+C para encerrar o compartilhamento.\n');
  }
});

tunnel.stderr.on('data', (chunk) => {
  process.stderr.write(chunk.toString());
});

function cleanup() {
  tunnel.kill();
  if (serverProc) serverProc.kill();
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
