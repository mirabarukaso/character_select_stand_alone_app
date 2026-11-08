/*
  Supports both WD14 tagger and CL tagger models in ONNX format.
  https://huggingface.co/cella110n/cl_tagger 
  https://huggingface.co/SmilingWolf

  Download models and place in "models/tagger" folder:
  - cl_tagger_v2.onnx + cl_tagger_v2_tag_mapping.json
  - wd-eva02-large-tagger-v3.onnx + wd-eva02-large-tagger-v3_selected_tags.csv
  - wd-v1-4-convnext-tagger.onnx + wd-v1-4-convnext-tagger_selected_tags.csv
*/

import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { app, ipcMain } from 'electron';
import * as ort from 'onnxruntime-node';
import { preprocessImageWD, runWd14Tagger } from './tagger/wdTagger.js';
import { preprocessImageCL, runClTagger } from './tagger/clTagger.js';
import { preprocessCamieImage, runCamieTagger } from './tagger/camieTagger.js';
import { offloadTaggerSessions, releaseTaggerSessions } from './tagger/taggerSession.js';

const CAT = '[imageTaggerMain]';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
let taggerSubprocess = null;  // Global reference to subprocess

function getOrCreateSubprocess() {
  if (!taggerSubprocess) {
    const subprocessPath = path.join(__dirname, 'imageTaggerFork.js');

    taggerSubprocess = fork(subprocessPath, [], { silent: false });  // false to see subprocess debug output

    taggerSubprocess.on('error', (err) => {
      console.error(CAT, 'Subprocess error:', err);
      taggerSubprocess = null; 
    });

    taggerSubprocess.on('close', (code) => {
      console.log(`${CAT} Subprocess closed with code ${code}`);
      taggerSubprocess = null;
    });
  }
  return taggerSubprocess;
}

function sendToSubprocess(payload, { acceptTypes, timeoutMs = 120000 } = {}) {
  return new Promise((resolve, reject) => {
    const subprocess = getOrCreateSubprocess();
    if (!subprocess) {
      reject(new Error(`${CAT} Failed to create subprocess`));
      return;
    }

    const messageId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    let settled = false;

    const cleanup = () => {
      subprocess.removeListener('message', handler);
      clearTimeout(timeout);
    };

    const handler = (msg) => {
      if (msg.id !== messageId) {
        return;
      }
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      if (msg.type === 'error') {
        reject(new Error(msg.data));
        return;
      }
      if (acceptTypes.includes(msg.type)) {
        resolve(msg.data);
        return;
      }
      reject(new Error(`${CAT} Unexpected subprocess message type: ${msg.type}`));
    };
    subprocess.addListener('message', handler);

    const timeout = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(new Error(`${CAT} Subprocess timeout`));
    }, timeoutMs);

    subprocess.send({ ...payload, id: messageId });
  });
}

async function runModelInSubprocess(args) {
  return sendToSubprocess(args, { acceptTypes: ['result'] });
}

async function offloadInSubprocess() {
  if (!taggerSubprocess) {
    return { released: 0, keptCpu: 0, skipped: true };
  }
  return sendToSubprocess({ type: 'offload' }, { acceptTypes: ['offload_done'], timeoutMs: 180000 });
}

async function runModel(Args) {
  const {image_input, model_choice, gen_threshold, char_threshold, model_options, preferGpu} = Args;
  const modelsDir = path.join(__dirname, "..", "..", "models", "tagger");
  const modelPath = path.join(modelsDir, model_choice);
  const useGpu = preferGpu !== false;
  
  if (String(model_choice).toLocaleLowerCase().startsWith('cl')) {
    const spatialSize = 448;
    const imgArray = await preprocessImageCL(image_input, spatialSize);
    const inputTensorCl = new ort.Tensor("float32", imgArray, [1, 3, spatialSize, spatialSize]);
    return runClTagger(modelPath, inputTensorCl, gen_threshold, char_threshold, [model_options], useGpu);
  } else if (String(model_choice).toLocaleLowerCase().startsWith('wd')) {
    const spatialSize = 448;
    const imgArray = await preprocessImageWD(image_input, spatialSize);
    const inputTensor = new ort.Tensor("float32", imgArray, [1, spatialSize, spatialSize, 3]);
    return runWd14Tagger(modelPath, inputTensor, gen_threshold, char_threshold, false, false, [model_options], useGpu);
  } else if (String(model_choice).toLocaleLowerCase().startsWith('camie')) {
    const spatialSize = 512;
    const imgArray = await preprocessCamieImage(image_input, spatialSize);
    const inputTensor = new ort.Tensor("float32", imgArray, [1, 3, spatialSize, spatialSize]);
    return runCamieTagger(modelPath, inputTensor, {overall:gen_threshold, categories:[model_options], min_confidence: 0.1}, useGpu);
  }

  return 'Unsupported model choice: ${model_choice}';
}

async function runImageTagger(args) {
  if(!args.wait || args?.wait === false) {
    await new Promise(resolve => setImmediate(resolve));

    try {
      return await runModelInSubprocess(args);
    } catch (err) {
      console.error(CAT, 'IPC runModelInSubprocess error:', err);
      throw err;
    }
  } else {
    try {
      return await runModel(args);
    } catch (err) {
      console.error(CAT, 'IPC runModel error:', err);
      throw err;
    }
  }
}

/**
 * Release GPU-resident tagger sessions (fork + in-process wait:true cache).
 * Rebuilds CPU cache when free RAM allows.
 */
async function offloadImageTaggerCache() {
  const mainResult = await offloadTaggerSessions();
  let forkResult = { released: 0, keptCpu: 0, skipped: true };
  try {
    forkResult = await offloadInSubprocess();
  } catch (err) {
    console.warn(CAT, 'Fork offload failed:', err?.message || err);
  }
  return { main: mainResult, fork: forkResult };
}

function setupTagger() {
  ipcMain.handle("run-image-tagger", async (event, args) => {
    return await runImageTagger(args);
  });

  ipcMain.handle("tagger-offload", async () => {
    return await offloadImageTaggerCache();
  });

  app.on('before-quit', () => {
    releaseTaggerSessions().catch(() => {});
    if (taggerSubprocess) {
      taggerSubprocess.kill('SIGTERM');
    }
  });
}

export {
  setupTagger,
  runImageTagger,
  offloadImageTaggerCache,
};
