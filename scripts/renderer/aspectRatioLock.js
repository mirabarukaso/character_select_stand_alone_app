import { setupCheckbox } from './components/myCheckbox.js';
import { hiresCalculate } from './tools/hiresCalculation.js';

const LAYER_ID = 'aspect-ratio-lock-layer';
const GAP = 8;
const SIZE_MIN = 512;
const SIZE_MAX = 4096;
const SIZE_STEP = 8;

export const ASPECT_RATIO_PRESETS = [
    { id: '1:1', w: 1, h: 1 },
    { id: '2:3', w: 2, h: 3 },
    { id: '3:4', w: 3, h: 4 },
    { id: '4:5', w: 4, h: 5 },
    { id: '5:7', w: 5, h: 7 },
    { id: '1:2', w: 1, h: 2 },
    { id: '9:16', w: 9, h: 16 },
    { id: '10:16', w: 10, h: 16 },
    { id: '9:20', w: 9, h: 20 },
    { id: '9:21', w: 9, h: 21 },
    { id: '9:24', w: 9, h: 24 }
];

export const ASPECT_PIXEL_PRESETS = [
    { w: 1024, h: 1024 },
    { w: 768, h: 1024 },
    { w: 832, h: 1216 },
    { w: 896, h: 1152 },
    { w: 768, h: 1344 },
    { w: 1024, h: 1280 },
    { w: 1024, h: 1360 },
    { w: 1024, h: 1536 },
    { w: 1280, h: 1280 },
    { w: 1280, h: 1600 },
    { w: 1280, h: 1920 },
    { w: 1536, h: 2048 },
    // Wallpaper bases: ×1.5 / ×2 hires toward 1K / 2K / 4K
    { w: 1280, h: 720 },
    { w: 1712, h: 960 },
    { w: 1920, h: 1080 }
];

function roundToStep(value, step = SIZE_STEP) {
    return Math.round(value / step) * step;
}

function clampSize(value) {
    return Math.min(SIZE_MAX, Math.max(SIZE_MIN, value));
}

function snapSize(value) {
    return clampSize(roundToStep(value));
}

function parseRatioId(ratioId) {
    if (!ratioId || typeof ratioId !== 'string') return null;
    const preset = ASPECT_RATIO_PRESETS.find((item) => item.id === ratioId);
    if (preset) return preset;
    const parts = ratioId.split(':').map(Number);
    if (parts.length === 2 && parts.every((n) => Number.isFinite(n) && n > 0)) {
        return { id: ratioId, w: parts[0], h: parts[1] };
    }
    return null;
}

function ratioValue(preset) {
    return preset.h / preset.w;
}

function fitPairToRatio(baseWidth, preset) {
    let width = snapSize(baseWidth);
    let height = snapSize(width * ratioValue(preset));
    if (height > SIZE_MAX || height < SIZE_MIN) {
        height = clampSize(height);
        width = snapSize(height / ratioValue(preset));
    }
    width = clampSize(width);
    height = snapSize(width * ratioValue(preset));
    height = clampSize(height);
    return { width, height };
}

function fitPairFromHeight(baseHeight, preset) {
    let height = snapSize(baseHeight);
    let width = snapSize(height / ratioValue(preset));
    if (width > SIZE_MAX || width < SIZE_MIN) {
        width = clampSize(width);
        height = snapSize(width * ratioValue(preset));
    }
    height = clampSize(height);
    width = snapSize(height / ratioValue(preset));
    width = clampSize(width);
    return { width, height };
}

function readLang() {
    const langName = globalThis.globalSettings?.language;
    return globalThis.cachedFiles?.language?.[langName] || {};
}

function ensureLayer() {
    let layer = document.getElementById(LAYER_ID);
    if (layer) return layer;

    layer = document.createElement('div');
    layer.id = LAYER_ID;
    layer.className = 'aspect-ratio-lock-layer';
    layer.hidden = true;
    layer.setAttribute('aria-hidden', 'true');
    document.body.append(layer);
    return layer;
}

function placeLayer(layer, anchor) {
    const rect = anchor.getBoundingClientRect();
    layer.hidden = false;
    layer.style.visibility = 'hidden';
    layer.style.left = '0px';
    layer.style.top = '0px';

    const layerWidth = layer.offsetWidth || 220;
    const layerHeight = layer.offsetHeight || 280;
    const maxLeft = Math.max(GAP, globalThis.innerWidth - layerWidth - GAP);
    const maxTop = Math.max(GAP, globalThis.innerHeight - layerHeight - GAP);

    let left = rect.left + (rect.width / 2) - (layerWidth / 2);
    let top = rect.bottom + GAP;
    if (top + layerHeight > globalThis.innerHeight - GAP) {
        top = rect.top - layerHeight - GAP;
    }
    left = Math.min(Math.max(GAP, left), maxLeft);
    top = Math.min(Math.max(GAP, top), maxTop);

    layer.style.left = `${left}px`;
    layer.style.top = `${top}px`;
    layer.style.visibility = 'visible';
}

function refreshSizeSideEffects() {
    hiresCalculate();
    globalThis.bounding?.syncCanvas();
    globalThis.bounding?.invalidatePreview?.();
}

function isLandscapeEnabled() {
    return Boolean(
        globalThis.generate?.landscape?.getValue?.()
        ?? globalThis.globalSettings?.api_image_landscape
    );
}

export function setupAspectRatioLock(containerId, spanText = 'Aspect Lock') {
    let locked = false;
    let lockedRatioId = '';
    let syncing = false;

    // Switch is an indicator only: lock on via ratio in the picker, off via Unlock.
    // Container clicks from setupCheckbox are reverted to the real locked state.
    const checkbox = setupCheckbox(containerId, spanText, false, true, () => {
        setCheckboxSilent(locked);
    });

    const container = document.querySelector(`.${containerId}`);
    if (!container) {
        return checkbox || {
            setTitle: () => {},
            setValue: () => {},
            getValue: () => false,
            onWidthChange: () => {},
            onHeightChange: () => {},
            unlock: () => {},
            restoreFromSettings: () => {}
        };
    }

    container.classList.add('generate-aspect-lock-host');
    container.title = spanText;

    const layer = ensureLayer();

    function setCheckboxSilent(value) {
        checkbox?.setValue?.(Boolean(value));
    }

    function persist() {
        if (!globalThis.globalSettings) return;
        globalThis.globalSettings.api_image_aspect_lock = locked;
        globalThis.globalSettings.api_image_aspect_ratio = locked ? lockedRatioId : '';
    }

    function applyPair(width, height, { keepLock = false, ratioId = '' } = {}) {
        syncing = true;
        try {
            globalThis.generate?.width?.setValue?.(width);
            globalThis.generate?.height?.setValue?.(height);
            if (globalThis.globalSettings) {
                globalThis.globalSettings.width = width;
                globalThis.globalSettings.height = height;
            }
        } finally {
            syncing = false;
        }

        if (keepLock) {
            locked = true;
            lockedRatioId = ratioId || lockedRatioId;
            setCheckboxSilent(true);
        } else {
            locked = false;
            lockedRatioId = '';
            setCheckboxSilent(false);
        }
        persist();
        refreshSizeSideEffects();
    }

    function unlock({ persistState = true, refreshLayer = true } = {}) {
        locked = false;
        lockedRatioId = '';
        setCheckboxSilent(false);
        if (persistState) persist();
        if (refreshLayer && !layer.hidden) renderLayerContent();
    }

    function lockToCurrentPair() {
        const width = Number(globalThis.generate?.width?.getValue?.() ?? globalThis.globalSettings?.width ?? 1024);
        const height = Number(globalThis.generate?.height?.getValue?.() ?? globalThis.globalSettings?.height ?? 1360);
        if (!(width > 0) || !(height > 0)) {
            unlock();
            return;
        }
        locked = true;
        lockedRatioId = `${width}:${height}`;
        setCheckboxSilent(true);
        persist();
        renderLayerContent();
    }

    function lockToRatio(ratioId) {
        const preset = parseRatioId(ratioId);
        if (!preset) return;
        const width = Number(globalThis.generate?.width?.getValue?.() ?? globalThis.globalSettings?.width ?? 1024);
        const pair = fitPairToRatio(width, preset);
        applyPair(pair.width, pair.height, { keepLock: true, ratioId: preset.id });
        renderLayerContent();
    }

    function applyPixelSize(width, height) {
        applyPair(snapSize(width), snapSize(height), { keepLock: false });
        renderLayerContent();
    }

    function getActiveRatio() {
        if (!locked) return null;
        const preset = parseRatioId(lockedRatioId);
        if (preset) return preset;
        const width = Number(globalThis.generate?.width?.getValue?.() ?? 0);
        const height = Number(globalThis.generate?.height?.getValue?.() ?? 0);
        if (width > 0 && height > 0) return { id: lockedRatioId || `${width}:${height}`, w: width, h: height };
        return null;
    }

    function onWidthChange(value) {
        if (syncing || !locked) {
            if (!syncing && globalThis.globalSettings) globalThis.globalSettings.width = value;
            if (!syncing) refreshSizeSideEffects();
            return;
        }
        const preset = getActiveRatio();
        if (!preset) {
            if (globalThis.globalSettings) globalThis.globalSettings.width = value;
            refreshSizeSideEffects();
            return;
        }
        const pair = fitPairToRatio(value, preset);
        syncing = true;
        try {
            if (globalThis.globalSettings) {
                globalThis.globalSettings.width = pair.width;
                globalThis.globalSettings.height = pair.height;
            }
            if (pair.width !== value) {
                globalThis.generate?.width?.setValue?.(pair.width);
            }
            globalThis.generate?.height?.setValue?.(pair.height);
        } finally {
            syncing = false;
        }
        refreshSizeSideEffects();
    }

    function onHeightChange(value) {
        if (syncing || !locked) {
            if (!syncing && globalThis.globalSettings) globalThis.globalSettings.height = value;
            if (!syncing) refreshSizeSideEffects();
            return;
        }
        const preset = getActiveRatio();
        if (!preset) {
            if (globalThis.globalSettings) globalThis.globalSettings.height = value;
            refreshSizeSideEffects();
            return;
        }
        const pair = fitPairFromHeight(value, preset);
        syncing = true;
        try {
            if (globalThis.globalSettings) {
                globalThis.globalSettings.width = pair.width;
                globalThis.globalSettings.height = pair.height;
            }
            if (pair.height !== value) {
                globalThis.generate?.height?.setValue?.(pair.height);
            }
            globalThis.generate?.width?.setValue?.(pair.width);
        } finally {
            syncing = false;
        }
        refreshSizeSideEffects();
    }

    function previewMarkup(w, h, box = 36) {
        const landscape = isLandscapeEnabled();
        const viewW = landscape ? Number(h) : Number(w);
        const viewH = landscape ? Number(w) : Number(h);
        const ratio = viewW / viewH;
        if (!(ratio > 0) || !Number.isFinite(ratio)) {
            return '';
        }
        let width;
        let height;
        if (ratio >= 1) {
            width = box;
            height = Math.max(10, Math.round(box / ratio));
        } else {
            height = box;
            width = Math.max(10, Math.round(box * ratio));
        }
        const x = ((box - width) / 2).toFixed(1);
        const y = ((box - height) / 2).toFixed(1);
        return `<svg class="aspect-ratio-lock-preview" width="${box}" height="${box}" viewBox="0 0 ${box} ${box}" aria-hidden="true" focusable="false"><rect class="aspect-ratio-lock-preview-rect" x="${x}" y="${y}" width="${width}" height="${height}" rx="2" ry="2"></rect></svg>`;
    }

    function ratioLabel(preset) {
        if (isLandscapeEnabled()) {
            return `${preset.h}:${preset.w}`;
        }
        return preset.id;
    }

    function sizeLabel(size) {
        if (isLandscapeEnabled()) {
            return `${size.h}×${size.w}`;
        }
        return `${size.w}×${size.h}`;
    }

    function renderLayerContent() {
        const LANG = readLang();
        const unlockLabel = LANG.api_image_aspect_unlock || 'Unlock';
        const ratiosTitle = LANG.api_image_aspect_ratios || 'Ratios';
        const sizesTitle = LANG.api_image_aspect_sizes || 'Sizes';
        const landscape = isLandscapeEnabled();
        layer.classList.toggle('is-landscape', landscape);

        const ratioButtons = ASPECT_RATIO_PRESETS.map((preset) => {
            const active = locked && lockedRatioId === preset.id ? ' is-active' : '';
            return `<button type="button" class="aspect-ratio-lock-item${active}" data-action="ratio" data-ratio="${preset.id}">${previewMarkup(preset.w, preset.h)}<span class="aspect-ratio-lock-label">${ratioLabel(preset)}</span></button>`;
        }).join('');

        const sizeButtons = ASPECT_PIXEL_PRESETS.map((size) => {
            return `<button type="button" class="aspect-ratio-lock-item" data-action="size" data-width="${size.w}" data-height="${size.h}">${previewMarkup(size.w, size.h)}<span class="aspect-ratio-lock-label">${sizeLabel(size)}</span></button>`;
        }).join('');

        layer.innerHTML = `
            <div class="aspect-ratio-lock-section">
                <button type="button" class="aspect-ratio-lock-item${!locked ? ' is-active' : ''}" data-action="unlock"><span class="aspect-ratio-lock-label">${unlockLabel}</span></button>
            </div>
            <div class="aspect-ratio-lock-section">
                <div class="aspect-ratio-lock-section-title">${ratiosTitle}</div>
                ${ratioButtons}
            </div>
            <div class="aspect-ratio-lock-section">
                <div class="aspect-ratio-lock-section-title">${sizesTitle}</div>
                ${sizeButtons}
            </div>
        `;
    }

    function onLandscapeChange() {
        if (!layer.hidden) {
            renderLayerContent();
            placeLayer(layer, container);
        }
    }

    function showLayer() {
        renderLayerContent();
        layer.setAttribute('aria-hidden', 'false');
        placeLayer(layer, container);
    }

    function hideLayer() {
        layer.hidden = true;
        layer.style.visibility = '';
        layer.setAttribute('aria-hidden', 'true');
    }

    function toggleLayer() {
        if (layer.hidden) showLayer();
        else hideLayer();
    }

    layer.addEventListener('click', (event) => {
        const button = event.target.closest('[data-action]');
        if (!button) return;
        const action = button.dataset.action;
        if (action === 'unlock') {
            unlock({ refreshLayer: false });
        } else if (action === 'ratio') {
            lockToRatio(button.dataset.ratio);
        } else if (action === 'size') {
            applyPixelSize(Number(button.dataset.width), Number(button.dataset.height));
        }
        hideLayer();
    });

    // Click host to open/close the picker (after checkbox click handling).
    container.addEventListener('click', () => {
        toggleLayer();
    });

    document.addEventListener('pointerdown', (event) => {
        if (layer.hidden) return;
        const target = event.target;
        if (container.contains(target) || layer.contains(target)) return;
        hideLayer();
    });

    function restoreFromSettings(settings = globalThis.globalSettings) {
        const nextLocked = Boolean(settings?.api_image_aspect_lock);
        const nextRatio = typeof settings?.api_image_aspect_ratio === 'string'
            ? settings.api_image_aspect_ratio
            : '';
        locked = Boolean(nextLocked);
        lockedRatioId = locked ? (nextRatio || '') : '';
        if (locked && !lockedRatioId) {
            const width = Number(settings?.width ?? 1024);
            const height = Number(settings?.height ?? 1360);
            lockedRatioId = `${width}:${height}`;
        }
        setCheckboxSilent(locked);
        persist();
    }

    return {
        setTitle: (text) => {
            checkbox?.setTitle?.(text);
            container.title = text;
        },
        getValue: () => locked,
        setValue: (value) => {
            if (value) lockToCurrentPair();
            else unlock();
        },
        onWidthChange,
        onHeightChange,
        onLandscapeChange,
        unlock,
        restoreFromSettings
    };
}

