import { app, ipcMain } from 'electron';
import { Mutex } from 'async-mutex';
import { createHash } from 'node:crypto';
import zlib from 'node:zlib';
import bcrypt from 'bcrypt';

const version = app.getVersion();

let backendBusy = false;
let ws_service = `none`;

const mutex = new Mutex();
async function getMutexBackendBusy() {
  const release = await mutex.acquire();
  try {
    return backendBusy; 
  } finally {
    release(); 
  }
}

async function setMutexBackendBusy(newValue) {
  const release = await mutex.acquire();
  try {
    backendBusy = newValue;
    return { success: true, value: backendBusy };
  } finally {
    release(); 
  }
}

function getAppVersion() {
  return version;
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

function setupIPCs(ws_service_result) {
  ws_service = ws_service_result;
  
  // Version
  ipcMain.handle('get-saa-version', async (event) => {    
    if(ws_service !== `none`) {
      return `${version} with SAAC listening at ${ws_service}`;
    }

    return version;
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
}

export {
  setupIPCs,
  getMutexBackendBusy,
  setMutexBackendBusy,
  getAppVersion,
  compressGzipThenBase64,
  bcryptHadh,
};

