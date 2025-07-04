// Modules to control application life and create native browser window
const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('node:path')
const { setupFileHandlers } = require('./scripts/main/fileHandlers'); 
const { setupGlobalSettings } = require('./scripts/main/globalSettings'); 
const { setupDownloadFiles } = require('./scripts/main/downloadFiles'); 
const { setupModelList } = require('./scripts/main/modelList'); 
const { setupTagAutoCompleteBackend } = require('./scripts/main/tagAutoComplete_backend');
const { setupModelApi } = require('./scripts/main/remoteAI_backend');
const { setupGenerateBackendComfyUI, sendToRenderer } = require('./scripts/main/generate_backend_comfyui');
const { setupGenerateBackendWebUI } = require('./scripts/main/generate_backend_webui');
const { setupCachedFiles } = require('./scripts/main/cachedFiles'); 
const { setupWildcardsHandlers } = require('./scripts/main/wildCards');

let mainWindow;

function createWindow () {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    autoHideMenuBar: true,  // Hide menu
    width: 1300,
    height: 1200,
    webPreferences: {
      preload: path.join(__dirname, 'scripts/preload.js'),
      contextIsolation: true, // Enable context isolation
      nodeIntegration: false, // Disable Node.js integration
      nodeIntegrationInWorker: true, // Enable multithread
      spellcheck: true // Enable spellcheck
    }
  });

  // Set the spellchecker to check English US
  mainWindow.webContents.session.setSpellCheckerLanguages(['en-US']);

  // Send the spellcheck suggestions to the renderer process
  mainWindow.webContents.on('context-menu', (event, params) => {
    event.preventDefault();
    const suggestions = params.dictionarySuggestions || [];
    const word = params.misspelledWord || '';
    sendToRenderer(`rightClickMenu_spellCheck`, suggestions, word);
  });

  // and load the index.html of the app.
  mainWindow.loadFile('index.html');
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {  
  setupFileHandlers();  
  const SETTINGS = setupGlobalSettings();
  setupModelList(SETTINGS);
  const downloadSuccess = await setupDownloadFiles();
  const cacheSuccess = setupCachedFiles();

  // Ensure wildcards list are set up before tag auto-complete
  setupWildcardsHandlers();

  const tacSuccess = await setupTagAutoCompleteBackend();
  setupModelApi();
  setupGenerateBackendComfyUI();
  setupGenerateBackendWebUI();  

  if (downloadSuccess && cacheSuccess && tacSuccess) {
    createWindow();

    app.on('activate', function () {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  } else {
    console.error('Failed to download required files. Exiting...');
    app.quit();
  }

  // IPC handlers for spellcheck
  ipcMain.handle('replace-misspelling', async (event, word) => {
    mainWindow.webContents.replaceMisspelling(word);
    return true;
  });

  ipcMain.handle('add-to-dictionary', async (event, word) => {
    mainWindow.webContents.session.addWordToSpellCheckerDictionary(word);
    return true;
  });
})

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit()
})