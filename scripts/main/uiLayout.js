import { app, ipcMain } from 'electron';
import path from 'node:path';
import * as fs from 'node:fs';

const CAT = '[UiLayout]';
const appPath = app.isPackaged ? path.join(path.dirname(app.getPath('exe')), 'resources', 'app') : app.getAppPath();
const LAYOUT_DIR = path.join(appPath, 'settings', 'ui_layout');
const GLOBAL_FILE = '_global.json';

export const DEFAULT_UI_LAYOUT = {
    version: 1,
    left: [
        'gallery-main',
        'system-settings',
        'highres-fix',
        'refiner',
        'regional-condition',
        'image-infobox'
    ],
    right: [
        'gallery-thumb',
        'add-lora',
        'model-settings',
        'prompt-text',
        'jsonlist',
        'controlnet',
        'adetailer',
        'queue'
    ]
};

const KNOWN_PANELS = new Set([...DEFAULT_UI_LAYOUT.left, ...DEFAULT_UI_LAYOUT.right]);

function sanitizeLayoutName(name) {
    const raw = String(name || 'settings').replace(/\.json$/i, '');
    const cleaned = raw.replaceAll(/[/|\\:*?"<>]/g, ' ').trim();
    return cleaned || 'settings';
}

function layoutFilePath(fileName) {
    return path.join(LAYOUT_DIR, fileName);
}

function ensureLayoutDir() {
    if (!fs.existsSync(LAYOUT_DIR)) {
        fs.mkdirSync(LAYOUT_DIR, { recursive: true });
        console.log(CAT, `Created UI layout directory: ${LAYOUT_DIR}`);
    }
}

function readLayoutFile(filePath) {
    if (!fs.existsSync(filePath)) {
        return null;
    }
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
        console.error(CAT, `Failed to read ${filePath}:`, error.message);
        return null;
    }
}

function writeLayoutFile(filePath, data) {
    try {
        ensureLayoutDir();
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error(CAT, `Failed to write ${filePath}:`, error.message);
        return false;
    }
}

function normalizePanelList(list, used) {
    const result = [];
    if (!Array.isArray(list)) {
        return result;
    }
    for (const id of list) {
        if (typeof id !== 'string' || !KNOWN_PANELS.has(id) || used.has(id)) {
            continue;
        }
        result.push(id);
        used.add(id);
    }
    return result;
}

function normalizeLayout(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const used = new Set();
    const left = normalizePanelList(source.left, used);
    const right = normalizePanelList(source.right, used);

    for (const id of DEFAULT_UI_LAYOUT.left) {
        if (!used.has(id)) {
            left.push(id);
            used.add(id);
        }
    }
    for (const id of DEFAULT_UI_LAYOUT.right) {
        if (!used.has(id)) {
            right.push(id);
            used.add(id);
        }
    }

    const layout = {
        version: 1,
        left,
        right
    };
    if (typeof source.enabled === 'boolean') {
        layout.enabled = source.enabled;
    }
    const mode = resolveMode(source);
    if (mode) {
        layout.mode = mode;
    }
    return layout;
}

function hasPanelLayout(data) {
    return Boolean(data && (Array.isArray(data.left) || Array.isArray(data.right)));
}

function resolveMode(data) {
    if (!data || typeof data !== 'object') {
        return 'global';
    }
    if (data.mode === 'factory' || data.mode === 'independent' || data.mode === 'global') {
        return data.mode;
    }
    if (data.enabled) {
        return 'independent';
    }
    return 'global';
}

function factoryLayout() {
    return {
        version: 1,
        left: [...DEFAULT_UI_LAYOUT.left],
        right: [...DEFAULT_UI_LAYOUT.right]
    };
}

function loadGlobalLayout() {
    const stored = readLayoutFile(layoutFilePath(GLOBAL_FILE));
    return normalizeLayout(stored || DEFAULT_UI_LAYOUT);
}

function packResult(mode, layout) {
    return {
        mode,
        independent: mode === 'independent',
        layout
    };
}

function writeSidecar(sidecarPath, data) {
    const stored = { ...data };
    if (stored.mode === 'independent') {
        stored.enabled = true;
    } else if (stored.enabled === undefined) {
        stored.enabled = false;
    }
    return writeLayoutFile(sidecarPath, stored);
}

export function loadUiLayout(settingsName) {
    ensureLayoutDir();
    const name = sanitizeLayoutName(settingsName);
    if (name && name !== '_global') {
        const sidecar = readLayoutFile(layoutFilePath(`${name}.json`));
        const mode = resolveMode(sidecar);
        if (mode === 'factory') {
            return packResult('factory', factoryLayout());
        }
        if (mode === 'independent') {
            return packResult('independent', normalizeLayout(sidecar));
        }
    }
    return packResult('global', loadGlobalLayout());
}

export function saveUiLayout(settingsName, layout, mode) {
    const resolvedMode = resolveMode({ mode, enabled: mode === true });
    const normalized = normalizeLayout(layout);
    delete normalized.enabled;
    delete normalized.mode;

    if (resolvedMode === 'independent') {
        const name = sanitizeLayoutName(settingsName);
        return writeSidecar(layoutFilePath(`${name}.json`), {
            ...normalized,
            mode: 'independent',
            enabled: true
        });
    }

    if (resolvedMode === 'factory') {
        const name = sanitizeLayoutName(settingsName);
        const sidecarPath = layoutFilePath(`${name}.json`);
        const existing = readLayoutFile(sidecarPath);
        const stored = {
            version: 1,
            mode: 'factory',
            enabled: false
        };
        if (hasPanelLayout(existing)) {
            const kept = normalizeLayout(existing);
            stored.left = kept.left;
            stored.right = kept.right;
        }
        return writeSidecar(sidecarPath, stored);
    }

    const name = sanitizeLayoutName(settingsName);
    const sidecarPath = layoutFilePath(`${name}.json`);
    const existing = readLayoutFile(sidecarPath);
    if (existing) {
        const kept = hasPanelLayout(existing) ? normalizeLayout(existing) : { version: 1 };
        writeSidecar(sidecarPath, {
            ...kept,
            mode: 'global',
            enabled: false
        });
    }
    return writeLayoutFile(layoutFilePath(GLOBAL_FILE), normalized);
}

export function setUiLayoutMode(settingsName, mode, currentLayout) {
    ensureLayoutDir();
    const resolvedMode = resolveMode({ mode, enabled: mode === true });
    const name = sanitizeLayoutName(settingsName);
    const sidecarPath = layoutFilePath(`${name}.json`);
    const existing = readLayoutFile(sidecarPath);

    if (resolvedMode === 'independent') {
        if (hasPanelLayout(existing)) {
            const restored = normalizeLayout(existing);
            restored.mode = 'independent';
            restored.enabled = true;
            writeSidecar(sidecarPath, restored);
            return packResult('independent', restored);
        }
        const snapshot = normalizeLayout(currentLayout || loadGlobalLayout());
        snapshot.mode = 'independent';
        snapshot.enabled = true;
        writeSidecar(sidecarPath, snapshot);
        return packResult('independent', snapshot);
    }

    if (resolvedMode === 'factory') {
        const stored = {
            version: 1,
            mode: 'factory',
            enabled: false
        };
        if (hasPanelLayout(existing)) {
            const kept = normalizeLayout(existing);
            stored.left = kept.left;
            stored.right = kept.right;
        }
        writeSidecar(sidecarPath, stored);
        return packResult('factory', factoryLayout());
    }

    if (existing) {
        const kept = hasPanelLayout(existing) ? normalizeLayout(existing) : { version: 1 };
        writeSidecar(sidecarPath, {
            ...kept,
            mode: 'global',
            enabled: false
        });
    }
    return packResult('global', loadGlobalLayout());
}

export function setUiLayoutIndependent(settingsName, independent, currentLayout) {
    return setUiLayoutMode(settingsName, independent ? 'independent' : 'global', currentLayout);
}

export function setupUiLayoutHandlers() {
    ipcMain.handle('load-ui-layout', async (event, settingsName) => {
        return loadUiLayout(settingsName);
    });
    ipcMain.handle('save-ui-layout', async (event, settingsName, layout, mode) => {
        return saveUiLayout(settingsName, layout, mode);
    });
    ipcMain.handle('set-ui-layout-mode', async (event, settingsName, mode, currentLayout) => {
        return setUiLayoutMode(settingsName, mode, currentLayout);
    });
    ipcMain.handle('set-ui-layout-independent', async (event, settingsName, independent, currentLayout) => {
        return setUiLayoutIndependent(settingsName, independent, currentLayout);
    });
}
