// main.js
// Modules to control application life and create native browser window
import { app, BrowserWindow, ipcMain, screen } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// common functions for main and wsService
import { setupIPCs, setWsServiceListenInfo, getAppVersion } from './main-common.js';
// WebSocket server
import { setupHttpServer, closeWebSocketServer, getWsServiceStatus, setWsServiceBasePath, preserveRunningWsServiceSettings, countConnectedSaacClients, notifySaacShutdownAndClose } from './scripts/webserver/back/wsService.js';
// Import custom modules
import { setupFileHandlers } from './scripts/main/fileHandlers.js';
import { setupGlobalSettings, setPreserveWsServiceSettings } from './scripts/main/globalSettings.js';
import { setupDownloadFiles } from './scripts/main/downloadFiles.js';
import { setupModelList } from './scripts/main/modelList.js';
import { setupTagAutoCompleteBackend } from './scripts/main/tagAutoComplete_backend.js';
import { setupModelApi } from './scripts/main/remoteAI_backend.js';
import { setupGenerateBackendComfyUI, sendToRenderer, cancelAllComfyUI } from './scripts/main/generate_backend_comfyui.js';
import { setupGenerateBackendWebUI, cancelAllWebUI } from './scripts/main/generate_backend_webui.js';
import { setupCachedFiles } from './scripts/main/cachedFiles.js';
import { setupWildcardsHandlers } from './scripts/main/wildCards.js';
import { setupTagger } from './scripts/main/imageTagger.js';
import { setupUiLayoutHandlers } from './scripts/main/uiLayout_backend.js';
import {
  detectAndApplyDisplayFit,
  getDisplayFit,
  applyZoomToWindow
} from './scripts/main/screenResolution.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow; // Main browser window instance
let allowQuit = false;
let quitGuardBusy = false;

async function cancelAllRunningJobs() {
  try {
    await cancelAllComfyUI();
  } catch (error) {
    console.warn('[Main] Failed to cancel ComfyUI jobs:', error);
  }
  try {
    cancelAllWebUI();
  } catch (error) {
    console.warn('[Main] Failed to cancel WebUI jobs:', error);
  }
}

async function confirmQuitIfSaacConnected() {
  const connected = countConnectedSaacClients();
  if (connected <= 0) {
    return true;
  }

  await cancelAllRunningJobs();

  if (!mainWindow || mainWindow.isDestroyed()) {
    return true;
  }

  const confirmed = await new Promise((resolve) => {
    const onResult = (_event, result) => {
      clearTimeout(timer);
      resolve(!!result);
    };
    const timer = setTimeout(() => {
      ipcMain.removeListener('quit-saac-confirm-result', onResult);
      resolve(false);
    }, 120000);
    ipcMain.once('quit-saac-confirm-result', onResult);
    mainWindow.webContents.send('quit-saac-confirm', connected);
  });

  if (confirmed) {
    await notifySaacShutdownAndClose();
    setWsServiceListenInfo(`none`);
    return true;
  }
  return false;
}

function requestQuitConfirmation(afterConfirm) {
  if (quitGuardBusy) {
    return;
  }
  quitGuardBusy = true;
  confirmQuitIfSaacConnected().then((ok) => {
    quitGuardBusy = false;
    if (ok) {
      afterConfirm();
    }
  }).catch((error) => {
    quitGuardBusy = false;
    console.error('[Main] Quit confirmation failed:', error);
  });
}

function replaceMisspelling(word) {
  mainWindow.webContents.replaceMisspelling(word);
  return true;
}

function addToDictionary(word) {
  mainWindow.webContents.session.addWordToSpellCheckerDictionary(word);
  return true;
}

function createWindow () {
  const fit = getDisplayFit();
  // Create the browser window.
  mainWindow = new BrowserWindow({
    autoHideMenuBar: true,  // Hide menu
    useContentSize: true,
    width: fit.width,
    height: fit.height,
    icon: path.join(__dirname, './html/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, './scripts/preload.js'),
      contextIsolation: true, // Enable context isolation
      nodeIntegration: false, // Disable Node.js integration
      nodeIntegrationInWorker: true, // Enable multithread
      spellcheck: true, // Enable spellcheck
      sandbox: false, // Disable sandbox for ES modules
      webSecurity: true, //Enable web security
      zoomFactor: fit.zoomFactor,
    }
  });

  // Keep zoom + content size tight after load (webPreferences.zoomFactor is initial)
  const applyFit = () => {
    applyZoomToWindow(mainWindow);
  };
  mainWindow.webContents.on('did-finish-load', applyFit);
  mainWindow.once('ready-to-show', applyFit);

  // Set the spellchecker to check English US
  mainWindow.webContents.session.setSpellCheckerLanguages(['en-US']);

  // Send the spellcheck suggestions to the renderer process
  mainWindow.webContents.on('context-menu', (event, params) => {
    event.preventDefault();
    const suggestions = params.dictionarySuggestions || [];
    const word = params.misspelledWord || '';
    sendToRenderer(`none`, `rightClickMenu_spellCheck`, suggestions, word);
  });

  // and load the index_electron.html of the app.
  mainWindow.loadFile('index_electron.html');

  mainWindow.on('close', (event) => {
    if (allowQuit || countConnectedSaacClients() <= 0) {
      return;
    }
    event.preventDefault();
    requestQuitConfirmation(() => {
      allowQuit = true;
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.close();
      }
    });
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
async function initializeApp() {
  const version = getAppVersion();
  console.log("Character Select SAA Version:", version);

  detectAndApplyDisplayFit(screen);

  setupFileHandlers();  
  const SETTINGS = setupGlobalSettings();
  setPreserveWsServiceSettings(preserveRunningWsServiceSettings);
  setupUiLayoutHandlers();
  SETTINGS.version = version;
  setWsServiceBasePath(path.join(__dirname));
  registerWsServiceIpc();
  setupIPCs();
  
  setupModelList(SETTINGS);
  const downloadSuccess = await setupDownloadFiles();
  const cacheSuccess = setupCachedFiles(SETTINGS.thumb_select);

  // Ensure wildcards list are set up before tag auto-complete
  setupWildcardsHandlers();

  const tacSuccess = await setupTagAutoCompleteBackend();
  setupModelApi();
  setupGenerateBackendComfyUI();
  setupGenerateBackendWebUI();  
  setupTagger();

  if (downloadSuccess && cacheSuccess && tacSuccess) {
    if (SETTINGS.ws_service) {
      const started = await setupHttpServer(path.join(__dirname), SETTINGS.ws_addr, SETTINGS.ws_port);
      const status = getWsServiceStatus();
      setWsServiceListenInfo(started && status.running ? `${status.addr}:${status.port}` : `none`);
    }
    createWindow();    

    app.on('activate', function () {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  } else {
    console.error('[Main] Failed to load required files. Exiting...');
    app.quit();
  }
  
  // IPC handlers for spellcheck
  ipcMain.handle('replace-misspelling', async (event, word) => {    
    return replaceMisspelling(word);
  });
  ipcMain.handle('add-to-dictionary', async (event, word) => {    
    return addToDictionary(word);
  });
}

function registerWsServiceIpc() {
  ipcMain.handle('ws-service-status', async () => {
    return getWsServiceStatus();
  });

  ipcMain.handle('ws-service-start', async (event, addr, port) => {
    const success = await setupHttpServer(path.join(__dirname), addr, port);
    const status = getWsServiceStatus();
    setWsServiceListenInfo(status.running ? `${status.addr}:${status.port}` : `none`);
    return { success, ...status };
  });

  ipcMain.handle('ws-service-stop', () => {
    return Promise.resolve(closeWebSocketServer()).then(() => {
      const status = getWsServiceStatus();
      setWsServiceListenInfo(`none`);
      return { success: !status.running, ...status };
    });
  });
}

// Initialize the app
// eslint-disable-next-line unicorn/prefer-top-level-await
(async () => { 
  await app.whenReady();  
  await initializeApp();
  
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  });
})();

app.on('before-quit', (event) => {
  if (allowQuit || countConnectedSaacClients() <= 0) {
    return;
  }
  event.preventDefault();
  requestQuitConfirmation(() => {
    allowQuit = true;
    app.quit();
  });
});

// Quit when all windows are closed
app.on('window-all-closed', function () {
  Promise.resolve(closeWebSocketServer()).finally(() => {
    allowQuit = true;
    app.quit();
  });
})
