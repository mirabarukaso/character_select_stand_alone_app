import { sendWebSocketMessage } from '../webserver/front/wsRequest.js';

const CAT = '[UiLayout]';
const DRAG_THRESHOLD = 6;
const SCROLL_EDGE = 56;
const SCROLL_STEP = 18;

const PANEL_IDS = [
    'generate-settings-static-left',
    'gallery-main',
    'system-settings',
    'highres-fix',
    'refiner',
    'regional-condition',
    'image-infobox',
    'generate-settings-static-right',
    'gallery-thumb',
    'add-lora',
    'model-settings',
    'prompt-text',
    'jsonlist',
    'controlnet',
    'adetailer',
    'queue'
];

const EMPTY_DRAG_IDS = new Set([
    'generate-settings-static-left',
    'generate-settings-static-right',
    'prompt-text'
]);

const INTERACTIVE_SELECTOR = [
    'input',
    'textarea',
    'button',
    'select',
    'a',
    'label',
    '[contenteditable="true"]',
    '[class*="myButton-"]',
    '[class*="mydropdown-"]',
    '[class*="myCheckbox-"]',
    '[class*="mySlider-"]',
    '[class*="myTextbox-"]'
].join(', ');

const MODE_ORDER = ['global', 'independent', 'factory'];

let layoutMode = 'global';
let suppressHandleClick = false;
let dragState = null;
let independentBusy = false;
let handlesBound = false;

function getSettingsName() {
    const name = globalThis.globalSettings?.lastLoadedSettings;
    return (name && String(name).trim()) ? String(name).trim() : 'settings';
}

function getLang() {
    const language = globalThis.globalSettings?.language;
    return globalThis.cachedFiles?.language?.[language] || {};
}

async function layoutApi(method, params) {
    try {
        if (globalThis.inBrowser) {
            return await sendWebSocketMessage({ type: 'API', method, params });
        }
        return await globalThis.api[method](...params);
    } catch (error) {
        console.error(CAT, `${method} failed:`, error);
        return null;
    }
}

const COLUMN_IDS = ['left', 'right', 'full-width'];

function getColumn(side) {
    return document.getElementById(side);
}

function getFullWidthColumn() {
    return document.getElementById('full-width');
}

function isOverCharacterBar(x, y) {
    for (const selector of ['.dropdown-character', '.dropdown-character-regional']) {
        const el = document.querySelector(selector);
        if (!el) {
            continue;
        }
        const style = globalThis.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') {
            continue;
        }
        const rect = el.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) {
            continue;
        }
        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
            return true;
        }
    }
    return false;
}

function setFullWidthDropHint(on) {
    document.querySelector('.dropdown-character')?.classList.toggle('layout-full-drop-target', on);
    document.querySelector('.dropdown-character-regional')?.classList.toggle('layout-full-drop-target', on);
    getFullWidthColumn()?.classList.toggle('layout-full-drop-target', on);
}

function getPanel(id) {
    return document.querySelector(`[data-layout-id="${id}"]`);
}

function getHandle(panelId) {
    return document.getElementById(`${panelId}-toggle`);
}

function isInteractiveTarget(target, panel) {
    if (!target || !panel) {
        return true;
    }
    if (target === panel) {
        return false;
    }
    if (!panel.contains(target)) {
        return true;
    }
    return Boolean(target.closest(INTERACTIVE_SELECTOR));
}

const HINT_DELAY_MS = 1000;
let hintTimer = null;
let hintPanel = null;

function applyDropHint(panel, on) {
    if (!panel) {
        return;
    }
    panel.classList.toggle('layout-drop-hint', Boolean(on) && !dragState);
}

function clearHintTimer() {
    if (hintTimer !== null) {
        clearTimeout(hintTimer);
        hintTimer = null;
    }
}

function scheduleDropHint(panel) {
    if (!panel || dragState) {
        return;
    }
    if (hintPanel === panel && (hintTimer !== null || panel.classList.contains('layout-drop-hint'))) {
        return;
    }
    clearHintTimer();
    if (hintPanel && hintPanel !== panel) {
        applyDropHint(hintPanel, false);
    }
    hintPanel = panel;
    hintTimer = setTimeout(() => {
        hintTimer = null;
        if (!dragState && hintPanel === panel) {
            applyDropHint(panel, true);
        }
    }, HINT_DELAY_MS);
}

function cancelDropHint(panel) {
    clearHintTimer();
    if (!panel || hintPanel === panel) {
        if (hintPanel) {
            applyDropHint(hintPanel, false);
        }
        hintPanel = null;
        return;
    }
    applyDropHint(panel, false);
}

export function readCurrentLayout() {
    const collect = (side) => [...(getColumn(side)?.children || [])]
        .map((el) => el.dataset?.layoutId)
        .filter(Boolean);

    return {
        version: 1,
        left: collect('left'),
        right: collect('right'),
        full: collect('full-width')
    };
}

export function applyLayout(layout) {
    const leftCol = getColumn('left');
    const rightCol = getColumn('right');
    const fullCol = getFullWidthColumn();
    if (!leftCol || !rightCol || !layout) {
        return;
    }

    const panels = {};
    for (const el of document.querySelectorAll('[data-layout-id]')) {
        panels[el.dataset.layoutId] = el;
    }

    const placed = new Set();
    const fill = (column, ids) => {
        if (!column) {
            return;
        }
        for (const id of ids || []) {
            const el = panels[id];
            if (!el) {
                continue;
            }
            column.appendChild(el);
            placed.add(id);
        }
    };

    fill(leftCol, layout.left);
    fill(rightCol, layout.right);
    fill(fullCol, layout.full);

    for (const [id, el] of Object.entries(panels)) {
        if (placed.has(id)) {
            continue;
        }
        const parent = el.parentElement;
        if (parent === leftCol || parent === rightCol || parent === fullCol) {
            parent.appendChild(el);
        }
    }
}

function nextLayoutMode(mode) {
    const index = MODE_ORDER.indexOf(mode);
    return MODE_ORDER[(index < 0 ? 0 : index + 1) % MODE_ORDER.length];
}

function refreshLayoutModeToggle() {
    const button = document.getElementById('ui-layout-independent-toggle');
    if (!button) {
        return;
    }
    button.classList.toggle('active', layoutMode === 'independent');
    button.classList.toggle('factory', layoutMode === 'factory');
    button.dataset.mode = layoutMode;

    const LANG = getLang();
    if (layoutMode === 'independent') {
        button.title = LANG.title_ui_layout_mode_independent || 'Independent UI layout';
    } else if (layoutMode === 'factory') {
        button.title = LANG.title_ui_layout_mode_factory || 'Original default layout';
    } else {
        button.title = LANG.title_ui_layout_mode_global || 'Shared UI layout';
    }
}

export function updateUiLayoutLanguage() {
    const LANG = getLang();
    for (const id of PANEL_IDS) {
        if (EMPTY_DRAG_IDS.has(id)) {
            continue;
        }
        const handle = getHandle(id);
        if (!handle) {
            continue;
        }
        handle.title = LANG.title_ui_layout_drag || 'Click to collapse, drag to rearrange';
    }
    refreshLayoutModeToggle();
}

export async function applySavedLayout() {
    const result = await layoutApi('loadUiLayout', [getSettingsName()]);
    layoutMode = result?.mode || (result?.independent ? 'independent' : 'global');
    if (result?.layout) {
        applyLayout(result.layout);
    }
    refreshLayoutModeToggle();
    return result;
}

async function persistLayout() {
    if (layoutMode === 'factory') {
        layoutMode = 'independent';
        refreshLayoutModeToggle();
    }
    await layoutApi('saveUiLayout', [getSettingsName(), readCurrentLayout(), layoutMode]);
}

function createPlaceholder(height) {
    const placeholder = document.createElement('div');
    placeholder.className = 'layout-drop-placeholder';
    placeholder.style.height = `${Math.max(height, 28)}px`;
    return placeholder;
}

function clearFloatStyles(panel) {
    panel.classList.remove('layout-dragging');
    panel.style.position = '';
    panel.style.left = '';
    panel.style.top = '';
    panel.style.width = '';
    panel.style.zIndex = '';
    panel.style.pointerEvents = '';
    panel.style.margin = '';
    panel.style.opacity = '';
}

function findColumnAt(x, y) {
    if (isOverCharacterBar(x, y)) {
        return getFullWidthColumn();
    }
    for (const side of COLUMN_IDS) {
        const column = getColumn(side);
        if (!column) {
            continue;
        }
        const rect = column.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) {
            continue;
        }
        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
            return column;
        }
    }
    return null;
}

function firstDroppableChild(column) {
    return column?.firstElementChild || null;
}

function placePlaceholder(column, beforeEl, placeholder, draggingEl) {
    if (!column || !placeholder) {
        return;
    }

    let target = beforeEl;
    if (target === draggingEl) {
        target = draggingEl.nextElementSibling;
    }
    if (target !== placeholder) {
        if (target) {
            target.before(placeholder);
        } else {
            column.appendChild(placeholder);
        }
    }
    syncDragGhostWidth();
    setFullWidthDropHint(column.id === 'full-width');
}

// eslint-disable-next-line sonarjs/cognitive-complexity
function updatePlaceholderFromPoint(x, y) {
    if (!dragState) {
        return;
    }
    const { panel, placeholder } = dragState;
    const skip = new Set([panel, placeholder]);
    const hits = document.elementsFromPoint(x, y) || [];

    for (const hit of hits) {
        if (skip.has(hit) || placeholder.contains(hit) || panel.contains(hit)) {
            continue;
        }
        if (hit.closest?.('.dropdown-character, .dropdown-character-regional')) {
            const full = getFullWidthColumn();
            placePlaceholder(full, firstDroppableChild(full), placeholder, panel);
            return;
        }
        const overPanel = hit.closest?.('[data-layout-id]');
        if (overPanel && overPanel !== panel) {
            const rect = overPanel.getBoundingClientRect();
            const before = y < rect.top + rect.height / 2;
            placePlaceholder(overPanel.parentElement, before ? overPanel : overPanel.nextElementSibling, placeholder, panel);
            return;
        }
    }

    const column = findColumnAt(x, y);
    if (!column) {
        return;
    }

    const children = [...column.children].filter((el) => el !== panel && el !== placeholder);
    if (children.length === 0) {
        placePlaceholder(column, firstDroppableChild(column), placeholder, panel);
        return;
    }

    const last = children.at(-1);
    const lastRect = last.getBoundingClientRect();
    if (y >= lastRect.bottom) {
        placePlaceholder(column, null, placeholder, panel);
        return;
    }

    const first = firstDroppableChild(column) || children[0];
    const firstRect = first.getBoundingClientRect();
    if (y <= firstRect.top) {
        placePlaceholder(column, first, placeholder, panel);
    }
}

function syncDragGhostWidth() {
    if (!dragState) {
        return;
    }
    const { panel, placeholder, originWidth } = dragState;
    const parent = placeholder?.parentElement;
    const width = parent?.getBoundingClientRect().width || 0;
    panel.style.width = `${width > 0 ? width : originWidth}px`;
}

function autoScrollColumns(x, y) {
    const column = findColumnAt(x, y);
    if (!column) {
        return;
    }
    const rect = column.getBoundingClientRect();
    if (y < rect.top + SCROLL_EDGE) {
        column.scrollBy(0, -SCROLL_STEP);
    } else if (y > rect.bottom - SCROLL_EDGE) {
        column.scrollBy(0, SCROLL_STEP);
    }
}

function startDrag(panel, event) {
    const rect = panel.getBoundingClientRect();
    const placeholder = createPlaceholder(rect.height);
    panel.parentElement.insertBefore(placeholder, panel);

    panel.classList.add('layout-dragging');
    panel.style.position = 'fixed';
    panel.style.left = `${rect.left}px`;
    panel.style.top = `${rect.top}px`;
    panel.style.width = `${rect.width}px`;
    panel.style.zIndex = '10050';
    panel.style.pointerEvents = 'none';
    panel.style.margin = '0';
    panel.style.opacity = '0.88';

    document.body.classList.add('layout-is-dragging');
    cancelDropHint(panel);

    dragState = {
        panel,
        placeholder,
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top,
        originWidth: rect.width,
        originParent: placeholder.parentElement,
        lastX: event.clientX,
        lastY: event.clientY,
        scrollRaf: requestAnimationFrame(tickDragScroll)
    };
}

function moveDrag(event) {
    if (!dragState) {
        return;
    }
    const { panel, offsetX, offsetY } = dragState;
    dragState.lastX = event.clientX;
    dragState.lastY = event.clientY;
    panel.style.left = `${event.clientX - offsetX}px`;
    panel.style.top = `${event.clientY - offsetY}px`;
    updatePlaceholderFromPoint(event.clientX, event.clientY);
}

function tickDragScroll() {
    if (!dragState) {
        return;
    }
    autoScrollColumns(dragState.lastX, dragState.lastY);
    updatePlaceholderFromPoint(dragState.lastX, dragState.lastY);
    dragState.scrollRaf = requestAnimationFrame(tickDragScroll);
}

async function endDrag() {
    if (!dragState) {
        return;
    }
    const { panel, placeholder, scrollRaf } = dragState;
    if (scrollRaf) {
        cancelAnimationFrame(scrollRaf);
    }

    if (placeholder.parentElement) {
        placeholder.parentElement.insertBefore(panel, placeholder);
        placeholder.remove();
    }
    clearFloatStyles(panel);
    document.body.classList.remove('layout-is-dragging');
    setFullWidthDropHint(false);
    dragState = null;
    await persistLayout();
}

function isDragArmed(panel) {
    return Boolean(panel?.classList.contains('layout-drop-hint'));
}

function beginPotentialDrag(panel, event, suppressClick) {
    if (event.button !== 0 || dragState || !isDragArmed(panel)) {
        return;
    }

    const startX = event.clientX;
    const startY = event.clientY;
    let dragging = false;

    const onMove = (moveEvent) => {
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;
        if (!dragging && (dx * dx + dy * dy) >= DRAG_THRESHOLD * DRAG_THRESHOLD) {
            dragging = true;
            if (suppressClick) {
                suppressHandleClick = true;
            }
            startDrag(panel, moveEvent);
        }
        if (dragging) {
            moveDrag(moveEvent);
        }
    };

    const onUp = async () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        if (dragging) {
            if (suppressClick) {
                suppressHandleClick = true;
            }
            await endDrag();
            if (suppressClick) {
                setTimeout(() => {
                    suppressHandleClick = false;
                }, 50);
            }
        }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
}

function bindHandle(panelId) {
    const panel = getPanel(panelId);
    const handle = getHandle(panelId);
    if (!panel || !handle) {
        console.warn(CAT, 'Missing panel or handle', panelId);
        return;
    }

    handle.classList.add('layout-drag-handle');
    handle.draggable = false;
    handle.addEventListener('dragstart', (event) => event.preventDefault());

    handle.addEventListener('pointerenter', () => scheduleDropHint(panel));
    handle.addEventListener('pointerleave', () => cancelDropHint(panel));

    handle.addEventListener('click', (event) => {
        if (!suppressHandleClick) {
            return;
        }
        event.preventDefault();
        event.stopImmediatePropagation();
        suppressHandleClick = false;
    }, true);

    handle.addEventListener('pointerdown', (event) => {
        beginPotentialDrag(panel, event, true);
    });
}

function bindEmptyDrag(panelId) {
    const panel = getPanel(panelId);
    if (!panel) {
        console.warn(CAT, 'Missing empty-drag panel', panelId);
        return;
    }

    panel.addEventListener('pointermove', (event) => {
        if (event.buttons) {
            return;
        }
        if (isInteractiveTarget(event.target, panel)) {
            cancelDropHint(panel);
            return;
        }
        scheduleDropHint(panel);
    });
    panel.addEventListener('pointerleave', () => cancelDropHint(panel));
    panel.addEventListener('pointerdown', (event) => {
        if (isInteractiveTarget(event.target, panel)) {
            return;
        }
        beginPotentialDrag(panel, event, false);
    });
}

async function cycleLayoutMode() {
    if (independentBusy) {
        return;
    }
    independentBusy = true;
    try {
        const result = await layoutApi('setUiLayoutMode', [
            getSettingsName(),
            nextLayoutMode(layoutMode),
            readCurrentLayout()
        ]);
        if (!result) {
            return;
        }
        layoutMode = result.mode || (result.independent ? 'independent' : 'global');
        if (result.layout) {
            applyLayout(result.layout);
        }
        refreshLayoutModeToggle();
    } finally {
        independentBusy = false;
    }
}

function bindIndependentToggle() {
    const button = document.getElementById('ui-layout-independent-toggle');
    if (!button) {
        console.error(CAT, 'Independent layout toggle not found');
        return;
    }
    button.addEventListener('click', () => {
        cycleLayoutMode();
    });
}

export async function setupUiLayout() {
    if (!handlesBound) {
        for (const id of PANEL_IDS) {
            if (EMPTY_DRAG_IDS.has(id)) {
                bindEmptyDrag(id);
            } else {
                bindHandle(id);
            }
        }
        bindIndependentToggle();
        handlesBound = true;
    }
    await applySavedLayout();
    updateUiLayoutLanguage();
}

