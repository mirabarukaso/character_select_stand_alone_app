/**
 * The preload script runs before `index.html` is loaded
 * in the renderer. It has access to web APIs as well as
 * Electron's renderer process modules and some polyfilled
 * Node.js functions.
 *
 * https://www.electronjs.org/docs/latest/tutorial/sandbox
 */

import { contextBridge, ipcRenderer } from 'electron';

// main to render
let okm = {
  mainGallery_appendImageData: null,
  customOverlay_updatePreview: null,
  customOverlay_progressBar: null,
  rightClickMenu_spellCheck: null
}

contextBridge.exposeInMainWorld('okm', {
  setup_mainGallery_appendImageData: (callback) => {
      if (typeof callback === 'function') {
        okm.mainGallery_appendImageData = callback;
      } 
  },
  setup_customOverlay_updatePreview: (callback) => {
    if (typeof callback === 'function') {
      okm.customOverlay_updatePreview = callback;
    } 
  },
  setup_customOverlay_progressBar: (callback) => {
    if (typeof callback === 'function') {
      okm.customOverlay_progressBar = callback;
    } 
  },
  setup_rightClickMenu_spellCheck: (callback) => {
    if (typeof callback === 'function') {
      okm.rightClickMenu_spellCheck = callback;
    } 
  }
});

const generateFunctions = {
  updatePreview(base64) {
    if(okm.customOverlay_updatePreview)
      okm.customOverlay_updatePreview(base64);
  },
  appendImage(base64, seed, tags) {
    if(okm.customOverlay_updatePreview)
      okm.mainGallery_appendImageData(base64, seed, tags);
  },
  updateProgress(progress, totalProgress) {
    if(okm.customOverlay_progressBar)
      okm.customOverlay_progressBar(progress, totalProgress);
  }, 
  rightClickMenu_spellCheck(suggestions, word) {
    if(okm.rightClickMenu_spellCheck)
      okm.rightClickMenu_spellCheck(suggestions, word);
  }
};

ipcRenderer.on('generate-backend', (event, { functionName, args }) => {
  if (generateFunctions[functionName]) {
    generateFunctions[functionName](...args);
  } else {
      console.error('[generate-backend] Unknown function:', functionName);
  }
});

// render to main
contextBridge.exposeInMainWorld('api', {
  // version
  getAppVersion: async () => ipcRenderer.invoke('get-saa-version'),

  // fileHandlers
  readFile: async (relativePath, prefix, filePath) => ipcRenderer.invoke('read-file', relativePath, prefix, filePath),
  readSafetensors: async (modelPath, prefix, filePath) => ipcRenderer.invoke('read-safetensors', modelPath, prefix, filePath),
  readImage: async (buffer, fileName, fileType) => ipcRenderer.invoke('read-image-metadata', buffer, fileName, fileType ),
  readBase64Image: async (dataUrl) => ipcRenderer.invoke('read-base64-image-metadata', dataUrl),

  // globalSettings
  getGlobalSettings: async () => ipcRenderer.invoke('get-global-settings'),
  getSettingFiles: async () => ipcRenderer.invoke('get-all-settings-files'),
  updateSettingFiles: async () => ipcRenderer.invoke('update-all-setting-files'),
  loadSettingFile: async (fineName) => ipcRenderer.invoke('load-setting-file', fineName),
  saveSettingFile: async (fineName, settings) => ipcRenderer.invoke('save-setting-file', fineName, settings),
  // cachedFiles
  getCachedFiles: async () => ipcRenderer.invoke('get-cached-files'),
  // downloadFiles
  downloadURL: async () => ipcRenderer.invoke('download-url', url, filePath),
  // modelList
  updateModelList: async (args) => ipcRenderer.invoke('update-model-list', args),
  getModelList: async (args) => ipcRenderer.invoke('get-model-list', args),
  getModelListAll: async (args) => ipcRenderer.invoke('get-model-list-all', args),
  getVAEList: async (args) => ipcRenderer.invoke('get-vae-list', args),
  getDiffusionModelList: async (args) => ipcRenderer.invoke('get-diffusion-model-list', args),
  getTextEncoderList: async (args) => ipcRenderer.invoke('get-text-encoder-list', args),
  getLoRAList: async (args) => ipcRenderer.invoke('get-lora-list-all', args),
  getControlNetList: async (args) => ipcRenderer.invoke('get-controlnet-list', args),
  getUpscalerList: async (args) => ipcRenderer.invoke('get-upscaler-list', args),
  getADetailerList: async (args) => ipcRenderer.invoke('get-adetailer-list', args),
  getImageTaggerModels: async () => ipcRenderer.invoke('get-image-tagger-models'),
  getONNXList: async (args) => ipcRenderer.invoke('get-onnx-list', args),
  // Tag Auto Complete
  tagReload: async () => ipcRenderer.invoke('tag-reload'),
  tagGet: async (text) => ipcRenderer.invoke('tag-get-suggestions', text),
  // AI
  remoteAI: async (options) => ipcRenderer.invoke('request-ai-remote', options),
  localAI: async (options) => ipcRenderer.invoke('request-ai-local', options),
  
  // generate_backend ComfyUI
  runComfyUI: async (generateData) => ipcRenderer.invoke('generate-backend-comfyui-run', generateData),
  runComfyUI_Regional: async (generateData) => ipcRenderer.invoke('generate-backend-comfyui-run-regional', generateData),
  runComfyUI_ControlNet: async (generateData) => ipcRenderer.invoke('generate-backend-comfyui-run-controlnet', generateData),
  runComfyUI_MiraITU: async (generateData) => ipcRenderer.invoke('generate-backend-comfyui-run-mira-itu', generateData),
  getImageComfyUI: async () => ipcRenderer.invoke('generate-backend-comfyui-get-image'),
  openWsComfyUI: async (prompt_id, skipFirst, isIndex) => ipcRenderer.invoke('generate-backend-comfyui-open-ws', prompt_id, skipFirst, isIndex),
  closeWsComfyUI: async () => ipcRenderer.invoke('generate-backend-comfyui-close-ws'),
  cancelComfyUI: async () => ipcRenderer.invoke('generate-backend-comfyui-cancel'),

  // generate_backend WebUI
  runWebUI: async (generateData) => ipcRenderer.invoke('generate-backend-webui-run', generateData),
  runWebUI_Regional: async (generateData) => ipcRenderer.invoke('generate-backend-webui-run-regional', generateData),
  runWebUI_ControlNet: async (generateData) => ipcRenderer.invoke('generate-backend-webui-run-controlnet', generateData),
  cancelWebUI: async () => ipcRenderer.invoke('generate-backend-webui-cancel'),
  startPollingWebUI: async () => ipcRenderer.invoke('generate-backend-webui-start-polling'),
  stopPollingWebUI: async () => ipcRenderer.invoke('generate-backend-webui-stop-polling'),
  getControlNetProcessorListWebUI: async () => ipcRenderer.invoke('generate-backend-webui-get-module-list'),
  getADetailerModelListWebUI: async () => ipcRenderer.invoke('generate-backend-webui-get-ad-model'),
  getUpscalersModelListWebUI: async () => ipcRenderer.invoke('generate-backend-webui-get-upscaler-model'),
  resetModelListsWebUI: async () => ipcRenderer.invoke('generate-backend-webui-reset-model-list'),

  // spellcheck
  replaceMisspelling: async (word) => ipcRenderer.invoke('replace-misspelling', word),
  addToDictionary: async (word) => ipcRenderer.invoke('add-to-dictionary', word),

  // Wildcards
  loadWildcard: async (fileName, seed) => ipcRenderer.invoke('load-wildcards', fileName, seed),
  updateWildcards: async () => ipcRenderer.invoke('update-wildcards'),

  // function from Main
  md5Hash: async (input) => ipcRenderer.invoke('md5-hash', input),
  decompressGzip: async (base64Data) => ipcRenderer.invoke('decompress-gzip', base64Data),
  compressGzip: async (byteArray) => ipcRenderer.invoke('compress-gzip', byteArray),
  bcryptHash: async (pass) => ipcRenderer.invoke('bcrypt-hash', pass),

  // Image Tagger
  runImageTagger: async (args) => ipcRenderer.invoke('run-image-tagger', args),
});

globalThis.addEventListener('DOMContentLoaded', () => {
  const replaceText = (selector, text) => {
    const element = document.getElementById(selector)
    if (element) element.innerText = text
  }

  for (const type of ['chrome', 'node', 'electron']) {
    replaceText(`${type}-version`, process.versions[type])
  }
})

