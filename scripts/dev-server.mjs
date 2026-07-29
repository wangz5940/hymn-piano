#!/usr/bin/env node
import { execFileSync, spawn } from 'node:child_process';
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  writeSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, '..');
const pidFile = join(projectRoot, '.dev-server.pid');
const logDir = join(projectRoot, 'logs');
const logFile = join(logDir, 'dev-server.log');

const action = process.argv[2];
const host = process.env.HOST || '127.0.0.1';
const port = process.env.PORT || '5173';
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const viteMarkers = [
  join(projectRoot, 'node_modules', '.bin', 'vite'),
  join(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js'),
].map(normalizePath);

function normalizePath(value) {
  return value.replaceAll('\\', '/');
}

function sleep(ms) {
  return new Promise((resolveSleep) => {
    setTimeout(resolveSleep, ms);
  });
}

function usage() {
  console.log('用法：node scripts/dev-server.mjs <start|stop|restart|status>');
  console.log('可选环境变量：HOST=127.0.0.1 PORT=5173');
}

function readPidInfo() {
  if (!existsSync(pidFile)) {
    return null;
  }

  const content = readFileSync(pidFile, 'utf8').trim();
  if (!content) {
    return null;
  }

  try {
    const parsed = JSON.parse(content);
    return Number.isInteger(parsed.pid) ? parsed : null;
  } catch {
    const pid = Number(content);
    return Number.isInteger(pid) ? { pid } : null;
  }
}

function writePidInfo(pid) {
  writeFileSync(
    pidFile,
    `${JSON.stringify(
      {
        pid,
        host,
        port,
        root: projectRoot,
        logFile,
        command: `${npmCommand} run dev -- --host ${host} --port ${port} --strictPort`,
        startedAt: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
  );
}

function removePidFile() {
  rmSync(pidFile, { force: true });
}

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function psEntries() {
  try {
    const output = execFileSync('ps', ['-axo', 'pid=,ppid=,stat=,command='], {
      encoding: 'utf8',
    });

    return output
      .split('\n')
      .map((line) => {
        const match = line.match(/^\s*(\d+)\s+(\d+)\s+(\S+)\s+(.*)$/);
        if (!match) {
          return null;
        }

        return {
          pid: Number(match[1]),
          ppid: Number(match[2]),
          stat: match[3],
          command: match[4],
        };
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function getProcessCwd(pid) {
  if (process.platform === 'win32') {
    return null;
  }

  try {
    const output = execFileSync('lsof', ['-a', '-p', String(pid), '-d', 'cwd', '-Fn'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const pathLine = output.split('\n').find((line) => line.startsWith('n'));
    return pathLine ? resolve(pathLine.slice(1)) : null;
  } catch {
    return null;
  }
}

function isNpmDevCommand(command) {
  return /\bnpm\b/.test(command) && /(?:^|\s)run\s+dev(?:\s|$)/.test(command);
}

function isShellViteCommand(command) {
  return /\b(?:sh|bash|zsh)\b/.test(command) && /\bvite\b/.test(command);
}

function hasProjectViteMarker(command) {
  const normalizedCommand = normalizePath(command);
  return viteMarkers.some((marker) => normalizedCommand.includes(marker));
}

function belongsToProject(pid, entry) {
  const cwd = getProcessCwd(pid);
  if (cwd === projectRoot) {
    return true;
  }

  return entry ? hasProjectViteMarker(entry.command) : false;
}

function hasProjectViteDescendant(pid, entries) {
  const childrenByParent = new Map();
  for (const entry of entries) {
    const children = childrenByParent.get(entry.ppid) || [];
    children.push(entry);
    childrenByParent.set(entry.ppid, children);
  }

  const stack = [...(childrenByParent.get(pid) || [])];
  while (stack.length > 0) {
    const entry = stack.pop();
    if (hasProjectViteMarker(entry.command)) {
      return true;
    }

    stack.push(...(childrenByParent.get(entry.pid) || []));
  }

  return false;
}

function isExpectedDevProcess(pid, entries) {
  const entry = entries.find((current) => current.pid === pid);
  if (!entry || !belongsToProject(pid, entry)) {
    return false;
  }

  return (
    isNpmDevCommand(entry.command) ||
    isShellViteCommand(entry.command) ||
    hasProjectViteMarker(entry.command) ||
    hasProjectViteDescendant(pid, entries)
  );
}

function discoverProjectDevProcesses() {
  const entries = psEntries();
  const byPid = new Map(entries.map((entry) => [entry.pid, entry]));
  const found = new Set();

  for (const entry of entries) {
    if (!hasProjectViteMarker(entry.command)) {
      continue;
    }

    found.add(entry.pid);

    const parent = byPid.get(entry.ppid);
    if (parent && (isNpmDevCommand(parent.command) || isShellViteCommand(parent.command))) {
      found.add(parent.pid);

      const grandparent = byPid.get(parent.ppid);
      if (grandparent && isNpmDevCommand(grandparent.command)) {
        found.add(grandparent.pid);
      }
    }
  }

  return [...found]
    .filter((pid) => pid !== process.pid)
    .filter((pid) => belongsToProject(pid, byPid.get(pid)))
    .sort((left, right) => right - left);
}

function signalPid(pid, signal) {
  try {
    process.kill(pid, signal);
    return true;
  } catch {
    return false;
  }
}

function signalProcessGroup(pid, signal) {
  if (process.platform === 'win32') {
    return false;
  }

  try {
    process.kill(-pid, signal);
    return true;
  } catch {
    return false;
  }
}

async function stopPids(pids) {
  for (const pid of pids) {
    signalPid(pid, 'SIGCONT');
  }

  for (const pid of pids) {
    signalPid(pid, 'SIGTERM');
  }

  await sleep(1200);

  const remaining = pids.filter(isAlive);
  for (const pid of remaining) {
    signalPid(pid, 'SIGKILL');
  }

  await sleep(300);
}

async function stopTrackedGroup(pid) {
  signalProcessGroup(pid, 'SIGCONT');
  signalPid(pid, 'SIGCONT');
  signalProcessGroup(pid, 'SIGTERM');
  signalPid(pid, 'SIGTERM');

  await sleep(1200);

  if (isAlive(pid)) {
    signalProcessGroup(pid, 'SIGKILL');
    signalPid(pid, 'SIGKILL');
  }

  await sleep(300);
}

async function stop({ silent = false } = {}) {
  const pidInfo = readPidInfo();
  const discovered = discoverProjectDevProcesses();
  const trackedPid = pidInfo?.pid;
  const entries = psEntries();
  const shouldStopTracked =
    Number.isInteger(trackedPid) && isAlive(trackedPid) && isExpectedDevProcess(trackedPid, entries);

  if (!shouldStopTracked && trackedPid) {
    removePidFile();
  }

  const pids = new Set(discovered);
  if (shouldStopTracked) {
    await stopTrackedGroup(trackedPid);
    pids.delete(trackedPid);
  }

  if (pids.size > 0) {
    await stopPids([...pids]);
  }

  removePidFile();

  const stillRunning = discoverProjectDevProcesses().filter(isAlive);
  if (stillRunning.length > 0) {
    console.error(`停止失败，仍有当前项目 dev 进程：${stillRunning.join(', ')}`);
    process.exitCode = 1;
    return false;
  }

  if (!silent) {
    if (shouldStopTracked || discovered.length > 0) {
      console.log('已停止当前项目的 dev 服务。');
    } else {
      console.log('没有发现当前项目正在运行的 dev 服务。');
    }
  }

  return true;
}

async function start() {
  const pidInfo = readPidInfo();
  if (pidInfo?.pid && isAlive(pidInfo.pid)) {
    console.log(`dev 服务已在运行，PID：${pidInfo.pid}`);
    console.log(`地址：http://${pidInfo.host || host}:${pidInfo.port || port}/`);
    console.log(`日志：${pidInfo.logFile || logFile}`);
    return;
  }

  removePidFile();
  mkdirSync(logDir, { recursive: true });

  const output = openSync(logFile, 'a');
  writeSync(output, `\n[${new Date().toISOString()}] npm run dev\n`);

  const child = spawn(
    npmCommand,
    ['run', 'dev', '--', '--host', host, '--port', port, '--strictPort'],
    {
      cwd: projectRoot,
      detached: process.platform !== 'win32',
      env: process.env,
      stdio: ['ignore', output, output],
    },
  );
  closeSync(output);

  child.unref();
  writePidInfo(child.pid);

  await sleep(1500);

  if (!isAlive(child.pid)) {
    removePidFile();
    console.error(`启动失败，请查看日志：${logFile}`);
    process.exitCode = 1;
    return;
  }

  console.log(`已启动 dev 服务：http://${host}:${port}/`);
  console.log(`PID：${child.pid}`);
  console.log(`日志：${logFile}`);
}

async function status() {
  const pidInfo = readPidInfo();
  const discovered = discoverProjectDevProcesses();

  if (pidInfo?.pid && isAlive(pidInfo.pid)) {
    console.log(`PID 文件记录的 dev 服务正在运行：${pidInfo.pid}`);
    console.log(`地址：http://${pidInfo.host || host}:${pidInfo.port || port}/`);
    console.log(`日志：${pidInfo.logFile || logFile}`);
    return;
  }

  if (discovered.length > 0) {
    console.log(`发现当前项目 dev 进程：${discovered.join(', ')}`);
    return;
  }

  console.log('当前项目 dev 服务未运行。');
}

switch (action) {
  case 'start':
    await start();
    break;
  case 'stop':
    await stop();
    break;
  case 'restart':
    if (await stop({ silent: true })) {
      await start();
    }
    break;
  case 'status':
    await status();
    break;
  default:
    usage();
    process.exitCode = 1;
}
