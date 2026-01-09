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

const CAT = '[imageTaggerMain]';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
let taggerSubprocess = null;  // Global reference to subprocess

function getOrCreateSubprocess() {
  if (!taggerSubprocess) {
    const subprocessPath = path.join(__dirname, 'imageTaggerFork.js');

    taggerSubprocess = fork(subprocessPath, [], { silent: false });  // false to see subprocess debug output

    taggerSubprocess.on('message', (msg) => {
      // Handle messages from subprocess if needed
    });

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

async function runModelInSubprocess(args) {
  return new Promise((resolve, reject) => {
    const subprocess = getOrCreateSubprocess();
    if (!subprocess) {
      reject(new Error(CAT, 'Failed to create subprocess'));
      return;
    }

    const messageId = Date.now();
    const handler = (msg) => {
      if (msg.type === 'result') {
        subprocess.removeListener('message', handler);
        resolve(msg.data);
      } else if (msg.type === 'error') {
        subprocess.removeListener('message', handler);
        reject(new Error(msg.data));
      }
    };
    subprocess.addListener('message', handler);

    // Send args to subprocess
    subprocess.send({ ...args, id: messageId });

    const timeout = setTimeout(() => {
      subprocess.removeListener('message', handler);
      subprocess.kill();
      reject(new Error(CAT, 'Subprocess timeout'));
    }, 10000);

    const originalResolve = resolve;
    resolve = (value) => {
      clearTimeout(timeout);
      originalResolve(value);
    };
  });
}

async function runModel(Args) {
  const {image_input, model_choice, gen_threshold, char_threshold, model_options} = Args;
  const modelsDir = path.join(__dirname, "..", "..", "models", "tagger");
  const modelPath = path.join(modelsDir, model_choice);
  
  if (String(model_choice).toLocaleLowerCase().startsWith('cl')) {
    const spatialSize = 448;
    const imgArray = await preprocessImageCL(image_input, spatialSize);
    const inputTensorCl = new ort.Tensor("float32", imgArray, [1, 3, spatialSize, spatialSize]);
    return runClTagger(modelPath, inputTensorCl, gen_threshold, char_threshold, [model_options]);
  } else if (String(model_choice).toLocaleLowerCase().startsWith('wd')) {
    const spatialSize = 448;
    const imgArray = await preprocessImageWD(image_input, spatialSize);
    const inputTensor = new ort.Tensor("float32", imgArray, [1, spatialSize, spatialSize, 3]);
    return runWd14Tagger(modelPath, inputTensor, gen_threshold, char_threshold, false, false, [model_options]);
  } else if (String(model_choice).toLocaleLowerCase().startsWith('camie')) {
    const spatialSize = 512;
    const imgArray = await preprocessCamieImage(image_input, spatialSize);
    const inputTensor = new ort.Tensor("float32", imgArray, [1, 3, spatialSize, spatialSize]);
    return runCamieTagger(modelPath, inputTensor, {overall:gen_threshold, categories:[model_options], min_confidence: 0.1});
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


function setupTagger() {
  ipcMain.handle("run-image-tagger", async (event, args) => {
    return await runImageTagger(args);
  });

  app.on('before-quit', () => {
    if (taggerSubprocess) {
      taggerSubprocess.kill('SIGTERM');
    }
  });
}

export {
  setupTagger,
  runImageTagger  
};
