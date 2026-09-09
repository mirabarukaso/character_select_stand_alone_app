// screenResolution.js
// Detect primary display work area and apply UI zoom / content size fit.

export const RECOMMENDED_WINDOW = {
  width: 1304,
  height: 1304
};

/** @type {{ width: number, height: number, scaleFactor: number, zoomFactor: number, workArea: { width: number, height: number }, recommended: { width: number, height: number } }} */
let lastFit = {
  width: RECOMMENDED_WINDOW.width,
  height: RECOMMENDED_WINDOW.height,
  scaleFactor: 1,
  zoomFactor: 1,
  workArea: {
    width: RECOMMENDED_WINDOW.width,
    height: RECOMMENDED_WINDOW.height
  },
  recommended: { ...RECOMMENDED_WINDOW }
};

/**
 * Read primary display workAreaSize + scaleFactor, compute zoomFactor, store and return fit.
 * Content size = round(recommended * zoomFactor) clamped to workArea.
 * @param {Electron.Screen} screen
 */
export function detectAndApplyDisplayFit(screen) {
  const display = screen.getPrimaryDisplay();
  const workArea = display.workAreaSize;
  const zoomFactor = Math.min(
    workArea.width / RECOMMENDED_WINDOW.width,
    workArea.height / RECOMMENDED_WINDOW.height,
    1
  );
  const width = Math.min(Math.round(RECOMMENDED_WINDOW.width * zoomFactor), workArea.width);
  const height = Math.min(Math.round(RECOMMENDED_WINDOW.height * zoomFactor), workArea.height);

  lastFit = {
    width,
    height,
    scaleFactor: display.scaleFactor,
    zoomFactor,
    workArea: { width: workArea.width, height: workArea.height },
    recommended: { ...RECOMMENDED_WINDOW }
  };

  console.log(
    `[ScreenResolution] Screen workArea: ${workArea.width}x${workArea.height}, OS scale: ${display.scaleFactor}, ` +
    `window: ${width}x${height}, zoomFactor: ${zoomFactor}`
  );
  if (zoomFactor < 1) {
    console.warn(
      `[ScreenResolution] Warning: workArea is smaller than the recommended ${RECOMMENDED_WINDOW.width}x${RECOMMENDED_WINDOW.height}. ` +
      `Scaling UI with zoomFactor=${zoomFactor.toFixed(3)} so the layout still fits.`
    );
  }

  return lastFit;
}

/** @returns {typeof lastFit} */
export function getDisplayFit() {
  return lastFit;
}

/**
 * Apply stored zoomFactor and tightly set content size to scaled layout; center if possible.
 * @param {Electron.BrowserWindow} browserWindow
 */
export function applyZoomToWindow(browserWindow) {
  if (!browserWindow || browserWindow.isDestroyed()) return;
  const fit = lastFit;
  browserWindow.webContents.setZoomFactor(fit.zoomFactor);
  browserWindow.setContentSize(fit.width, fit.height);
  if (typeof browserWindow.center === 'function') {
    browserWindow.center();
  }
}
