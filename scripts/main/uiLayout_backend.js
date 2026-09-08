import { app, ipcMain } from 'electron';
import path from 'node:path';
import * as fs from 'node:fs';

const CAT = '[UiLayout]';
const appPath = app.isPackaged ? path.join(path.dirname(app.getPath('exe')), 'resources', 'app') : app.getAppPath();
const LAYOUT_DIR = path.join(appPath, 'settings', 'ui_layout');
const GLOBAL_FILE = '_global.json';

// Upgrade contract: add new panel ids here only.
// Load/save always merge saved files against this list.
// Missing panels are inserted in this order: after the nearest
// predecessor that already exists in that column, or at the
// column start when the new id is a default-column prefix.
export const DEFAULT_UI_LAYOUT = {
    version: 1,
    left: [
        'generate-settings-static-left',
        'gallery-main',
        'system-settings',
        'highres-fix',
        'refiner',
        'regional-condition',
        'image-infobox'
    ],
    right: [
        'generate-settings-static-right',
        'gallery-thumb',
        'add-lora',
        'model-settings',
        'prompt-text',
        'jsonlist',
        'controlnet',
        'adetailer',
        'queue'
    ],
    full: []
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

// eslint-disable-next-line sonarjs/cognitive-complexity
function insertMissingInDefaultOrder(current, defaultList, used) {
    const result = [...current];
    for (const id of defaultList) {
        if (used.has(id)) {
            continue;
        }

        let insertAt = result.length;
        let foundPrev = false;
        for (const prev of defaultList) {
            if (prev === id) {
                break;
            }
            const idx = result.indexOf(prev);
            if (idx !== -1) {
                insertAt = idx + 1;
                foundPrev = true;
            }
        }
        if (!foundPrev) {
            insertAt = defaultList.indexOf(id) > 0 ? result.length : 0;
        }

        result.splice(insertAt, 0, id);
        used.add(id);
    }
    return result;
}

function normalizeLayout(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const used = new Set();
    const leftSaved = normalizePanelList(source.left, used);
    const rightSaved = normalizePanelList(source.right, used);
    const fullSaved = normalizePanelList(source.full, used);
    const left = insertMissingInDefaultOrder(leftSaved, DEFAULT_UI_LAYOUT.left, used);
    const right = insertMissingInDefaultOrder(rightSaved, DEFAULT_UI_LAYOUT.right, used);

    const layout = {
        version: 1,
        left,
        right,
        full: fullSaved
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
    return Boolean(data && (Array.isArray(data.left) || Array.isArray(data.right) || Array.isArray(data.full)));
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
        right: [...DEFAULT_UI_LAYOUT.right],
        full: [...DEFAULT_UI_LAYOUT.full]
    };
}

function listsEqual(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
        return false;
    }
    return a.every((id, index) => id === b[index]);
}

function needsMigration(raw, normalized) {
    if (!raw || typeof raw !== 'object') {
        return true;
    }
    return !listsEqual(raw.left, normalized.left)
        || !listsEqual(raw.right, normalized.right)
        || !listsEqual(raw.full || [], normalized.full || []);
}

function persistNormalizedLayout(filePath, original, normalized, extra = {}) {
    if (!needsMigration(original, normalized)) {
        return normalized;
    }
    const stored = {
        version: 1,
        ...extra,
        left: normalized.left,
        right: normalized.right,
        full: normalized.full || []
    };
    if (typeof extra.enabled !== 'boolean' && typeof original?.enabled === 'boolean') {
        stored.enabled = original.enabled;
    }
    if (!stored.mode && original?.mode) {
        stored.mode = original.mode;
    }
    writeLayoutFile(filePath, stored);
    console.log(CAT, `Migrated UI layout file: ${filePath}`);
    return normalized;
}

function loadGlobalLayout() {
    const filePath = layoutFilePath(GLOBAL_FILE);
    const stored = readLayoutFile(filePath);
    const normalized = normalizeLayout(stored || DEFAULT_UI_LAYOUT);
    if (stored) {
        persistNormalizedLayout(filePath, stored, normalized);
    } else {
        writeLayoutFile(filePath, {
            version: 1,
            left: normalized.left,
            right: normalized.right
        });
    }
    return normalized;
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
        const sidecarPath = layoutFilePath(`${name}.json`);
        const sidecar = readLayoutFile(sidecarPath);
        const mode = resolveMode(sidecar);
        if (mode === 'factory') {
            if (hasPanelLayout(sidecar)) {
                persistNormalizedLayout(sidecarPath, sidecar, normalizeLayout(sidecar), {
                    mode: 'factory',
                    enabled: false
                });
            }
            return packResult('factory', factoryLayout());
        }
        if (mode === 'independent') {
            const normalized = persistNormalizedLayout(
                sidecarPath,
                sidecar,
                normalizeLayout(sidecar),
                { mode: 'independent', enabled: true }
            );
            return packResult('independent', normalized);
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
            stored.full = kept.full || [];
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
            stored.full = kept.full || [];
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

