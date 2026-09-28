import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { Mutex } from 'async-mutex';
import { createHash } from 'node:crypto';
import { inspect } from 'node:util';
import zlib from 'node:zlib';
import bcrypt from 'bcrypt';
import { getDisplayFit } from './scripts/main/screenResolution.js';

const version = app.getVersion();
const BACKEND_LOG_LIMIT = 800;
const backendLogLines = [];
let consoleCaptureInstalled = false;

function formatLogArg(arg) {
  if (typeof arg === 'string') {
    return arg;
  }
  try {
    return inspect(arg, { depth: 3, breakLength: 120, maxArrayLength: 40, maxStringLength: 2000 });
  } catch {
    return String(arg);
  }
}

function pushBackendLog(level, args) {
  const stamp = new Date().toISOString().replace('T', ' ').replace('Z', '');
  const line = `[${stamp}] [${level}] ${args.map(formatLogArg).join(' ')}`;
  backendLogLines.push(line.length > 4000 ? `${line.slice(0, 4000)}…` : line);
  if (backendLogLines.length > BACKEND_LOG_LIMIT) {
    backendLogLines.splice(0, backendLogLines.length - BACKEND_LOG_LIMIT);
  }
}

function installConsoleCapture() {
  if (consoleCaptureInstalled) {
    return;
  }
  consoleCaptureInstalled = true;
  for (const level of ['log', 'info', 'warn', 'error']) {
    const original = console[level].bind(console);
    console[level] = (...args) => {
      original(...args);
      pushBackendLog(level, args);
    };
  }
}

function getBackendLogText() {
  if (backendLogLines.length === 0) {
    return '';
  }
  return backendLogLines.join('\n');
}

installConsoleCapture();

let ws_service = `none`;
let saacClientCount = 0;

const mutex = new Mutex();
const busySlots = new Map();

function makeBackendLockKey(kind, addr) {
  const kindKey = String(kind || 'unknown').toLowerCase();
  const raw = String(addr || '').trim();
  const withoutProtocol = raw.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, '');
  const hostPort = withoutProtocol.split('/')[0] || '';
  const ipv4 = hostPort.match(/^(\d{1,3}(?:\.\d{1,3}){3})(?::(\d+))?$/);
  let host = hostPort;
  let port = '';
  if (ipv4) {
    host = ipv4[1];
    port = ipv4[2] || '';
  } else {
    const idx = hostPort.lastIndexOf(':');
    if (idx > 0) {
      host = hostPort.slice(0, idx);
      port = hostPort.slice(idx + 1);
    }
  }
  return `${kindKey}:${host}:${port}`;
}

async function tryAcquireBackendBusy(kind, addr, ownerUuid = 'none') {
  const key = makeBackendLockKey(kind, addr);
  const owner = ownerUuid || 'none';
  const release = await mutex.acquire();
  try {
    const current = busySlots.get(key);
    if (current) {
      return { acquired: false, key, owner: current.owner };
    }
    busySlots.set(key, { owner, kind, addr, acquiredAt: Date.now() });
    return { acquired: true, key, owner };
  } finally {
    release();
  }
}

async function releaseBackendBusy(kind, addr, ownerUuid = 'none') {
  const key = makeBackendLockKey(kind, addr);
  const owner = ownerUuid || 'none';
  const release = await mutex.acquire();
  try {
    const current = busySlots.get(key);
    if (current && current.owner === owner) {
      busySlots.delete(key);
    }
    return { success: true, key };
  } finally {
    release();
  }
}

async function forceReleaseBackendBusy(kind, addr) {
  const key = makeBackendLockKey(kind, addr);
  const release = await mutex.acquire();
  try {
    busySlots.delete(key);
    return { success: true, key };
  } finally {
    release();
  }
}

async function forceReleaseAllBackendBusy() {
  const release = await mutex.acquire();
  try {
    busySlots.clear();
    return { success: true };
  } finally {
    release();
  }
}

async function setMutexBackendBusy(newValue) {
  if (newValue === false) {
    return forceReleaseAllBackendBusy();
  }
  return { success: false, value: newValue };
}

function getAppVersion() {
  return version;
}

function formatSaaVersion() {
  let result = version;
  if (ws_service !== `none`) {
    const clientLabel = saacClientCount === 1 ? '1 client' : `${saacClientCount} clients`;
    result = `${version} with SAAC listening at ${ws_service} (${clientLabel})`;
  }
  const fit = getDisplayFit();
  if (fit && fit.zoomFactor < 0.999) {
    result = `${result} [zoom=${fit.zoomFactor.toFixed(3)}]`;
  }
  return result;
}

function refreshMainWindowTitle() {
  const title = `Character Select SAA ${formatSaaVersion()}`;
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.setTitle(title);
    }
  }
}

function setSaacClientCount(count) {
  const next = Number.isInteger(count) && count > 0 ? count : 0;
  if (next === saacClientCount) {
    return;
  }
  saacClientCount = next;
  refreshMainWindowTitle();
}

async function compressGzipThenBase64(byteArray){
  try {
    const buffer = Buffer.from(byteArray);
    const gzipped = zlib.gzipSync(buffer,);
    return gzipped.toString('base64');
  } catch (error) {
    console.error('[compressGzip]: Error on compressing', error);
    return null;
  }
}

async function bcryptHadh(pass) {
  try {
    return await bcrypt.hash(pass, 12);
  } catch (error) {
    console.error('[bcryptHash]: Error generating hash', error);
    return null;
  }
}

function setWsServiceListenInfo(info) {
  ws_service = info || `none`;
  if (ws_service === `none`) {
    saacClientCount = 0;
  }
  refreshMainWindowTitle();
}

function setupIPCs(ws_service_result) {
  if (ws_service_result !== undefined) {
    ws_service = ws_service_result;
  }
  
  // Version
  ipcMain.handle('get-saa-version', async (event) => {    
    return formatSaaVersion();
  });

  ipcMain.handle('system-beep', async () => {
    shell.beep();
    return true;
  });

  ipcMain.handle('md5-hash', async (event, input) => {
    if (typeof input !== 'string') {
    console.error('[get_md5_hash]: Input must be a string');
    return null;
    }
    try {
    const hash = createHash('md5'); //NOSONAR S4790
    hash.update(input);
    return hash.digest('hex');
    } catch (error) {
    console.error('[get_md5_hash]: Error generating hash', error);
    return null;
    }
  });

  ipcMain.handle('decompress-gzip', async (event, base64Data) => {
    try {
    const compressedData = Buffer.from(base64Data, 'base64');
    const decompressedData = zlib.gunzipSync(compressedData);
    return decompressedData;
    } catch (error) {
    console.error('[decompressGzip]: Error decompressing data', error);
    return null;
    }
  });

  ipcMain.handle('compress-gzip', async (event, byteArray) => {
    return await compressGzipThenBase64(byteArray);
  });
  
  ipcMain.handle('bcrypt-hash', async (event, pass) => {
    return await bcryptHadh(pass);
  });

  ipcMain.handle('get-backend-logs', async () => {
    return getBackendLogText();
  });
}

export {
  setupIPCs,
  setWsServiceListenInfo,
  setSaacClientCount,
  makeBackendLockKey,
  tryAcquireBackendBusy,
  releaseBackendBusy,
  forceReleaseBackendBusy,
  forceReleaseAllBackendBusy,
  setMutexBackendBusy,
  getAppVersion,
  getBackendLogText,
  compressGzipThenBase64,
  bcryptHadh,
};
