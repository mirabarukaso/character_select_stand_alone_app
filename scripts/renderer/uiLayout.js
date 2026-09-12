import { sendWebSocketMessage } from '../webserver/front/wsRequest.js';
import {
    CHARACTER_ID,
    collectColumnLayout,
    ensureHostForPanel,
    extractPanelFromHost,
    getHostPageIds,
    getHostPages,
    getTabHost,
    hostZoneAllowed,
    isLastHostPage,
    isTabHost,
    mergePanelIntoHost,
    mountHostFromEntry,
    movePageInHost,
    panelZoneAllowed,
    refreshHostChrome,
    setHostActive,
    unwrapHost,
    pruneTabHosts,
    zoneOfColumn
} from './uiLayoutTabs.js';

const CAT = '[UiLayout]';
const DRAG_THRESHOLD = 6;
const SCROLL_EDGE = 56;
const SCROLL_STEP = 18;
const GALLERY_MAIN_HEIGHT = 872;
const GALLERY_COMPRESS_MIN = 384;
const FULL_WIDTH_CSS_MAX = GALLERY_MAIN_HEIGHT + 84;
const SPLIT_MIN_HEIGHT = 196;

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
let fullRegionHeight = null;
let splitDrag = null;

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
let hintBlocked = false;
let hintUsed = false;

function isHintOn(panel) {
    if (!panel) {
        return false;
    }
    if (isTabHost(panel)) {
        return panel.classList.contains('layout-tab-hint');
    }
    const host = getTabHost(panel);
    if (host) {
        return host.classList.contains('layout-tab-hint');
    }
    return panel.classList.contains('layout-drop-hint');
}

function applyDropHint(panel, on) {
    if (!panel) {
        return;
    }
    const host = isTabHost(panel) ? panel : getTabHost(panel);
    if (host) {
        host.classList.toggle('layout-tab-hint', Boolean(on) && !dragState);
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

function resetHintSession() {
    clearHintTimer();
    if (hintPanel) {
        applyDropHint(hintPanel, false);
    }
    hintPanel = null;
    hintBlocked = false;
    hintUsed = false;
}

function scheduleDropHint(panel) {
    if (!panel || dragState) {
        return;
    }
    if (hintPanel === panel && (hintBlocked || hintUsed || hintTimer !== null || isHintOn(panel))) {
        return;
    }
    clearHintTimer();
    if (hintPanel && hintPanel !== panel) {
        applyDropHint(hintPanel, false);
    }
    hintPanel = panel;
    hintBlocked = false;
    hintUsed = false;
    hintTimer = setTimeout(() => {
        hintTimer = null;
        if (!dragState && hintPanel === panel && !hintBlocked) {
            applyDropHint(panel, true);
            hintUsed = true;
        }
    }, HINT_DELAY_MS);
}

function noteHintGesture(panel) {
    const target = panel && hintPanel === panel ? panel : (panel || hintPanel);
    if (!target || (panel && hintPanel && hintPanel !== panel)) {
        if (panel && hintPanel === panel) {
            hintBlocked = true;
            clearHintTimer();
            applyDropHint(panel, false);
        }
        return;
    }
    if (hintPanel !== target) {
        return;
    }
    hintBlocked = true;
    clearHintTimer();
    applyDropHint(target, false);
}

function cancelDropHint(panel) {
    if (!panel || hintPanel === panel) {
        resetHintSession();
        return;
    }
    applyDropHint(panel, false);
}

export function readCurrentLayout() {
    const layout = {
        version: 2,
        left: collectColumnLayout(getColumn('left')),
        right: collectColumnLayout(getColumn('right')),
        full: collectColumnLayout(getFullWidthColumn())
    };
    if (typeof fullRegionHeight === 'number') {
        layout.fullMaxHeight = fullRegionHeight;
    }
    const galleryHeight = readGalleryHeight();
    if (isGalleryInFullWidth() && hasItemsBelowGallery() && galleryHeight < GALLERY_MAIN_HEIGHT) {
        layout.galleryHeight = galleryHeight;
    }
    return layout;
}

function placeLayoutEntry(column, entry, panelMap, placed) {
    if (!column || !entry) {
        return;
    }
    if (typeof entry === 'string') {
        if (entry === CHARACTER_ID) {
            return;
        }
        const el = panelMap[entry];
        if (!el) {
            return;
        }
        column.appendChild(el);
        placed.add(entry);
        return;
    }
    if (entry.type !== 'tab-host') {
        return;
    }
    if (layoutMode === 'factory' || column.id === 'full-width') {
        for (const id of entry.pages || []) {
            placeLayoutEntry(column, id, panelMap, placed);
        }
        return;
    }
    const host = mountHostFromEntry(entry, panelMap);
    if (!host) {
        return;
    }
    if (getHostPageIds(host).length <= 1) {
        const only = getHostPages(host)[0];
        column.appendChild(only || host);
        unwrapHost(host);
        if (only?.dataset.layoutId) {
            placed.add(only.dataset.layoutId);
        }
        return;
    }
    column.appendChild(host);
    bindHostDrag(host);
    for (const id of getHostPageIds(host)) {
        placed.add(id);
    }
}

export function applyLayout(layout) {
    const leftCol = getColumn('left');
    const rightCol = getColumn('right');
    const fullCol = getFullWidthColumn();
    if (!leftCol || !rightCol || !layout) {
        return;
    }

    for (const host of document.querySelectorAll('.layout-tab-host')) {
        unwrapHost(host);
    }

    const panels = {};
    for (const el of document.querySelectorAll('[data-layout-id]')) {
        panels[el.dataset.layoutId] = el;
    }

    const placed = new Set();
    for (const entry of layout.left || []) {
        placeLayoutEntry(leftCol, entry, panels, placed);
    }
    for (const entry of layout.right || []) {
        placeLayoutEntry(rightCol, entry, panels, placed);
    }
    for (const entry of layout.full || []) {
        if (entry === CHARACTER_ID) {
            continue;
        }
        placeLayoutEntry(fullCol, entry, panels, placed);
    }
    pinCharacterToTop();
    placed.add(CHARACTER_ID);

    for (const [id, el] of Object.entries(panels)) {
        if (placed.has(id)) {
            continue;
        }
        const host = getTabHost(el);
        if (host && (leftCol.contains(host) || rightCol.contains(host) || fullCol?.contains(host))) {
            continue;
        }
        const parent = el.parentElement;
        if (parent === leftCol || parent === rightCol || parent === fullCol) {
            parent.appendChild(el);
        }
    }
    pinCharacterToTop();

    if (layoutMode === 'factory') {
        for (const host of document.querySelectorAll('.layout-tab-host')) {
            unwrapHost(host);
        }
        applyFactoryCollapsed();
        setFullRegionHeight(null);
        resetGalleryHeight();
        syncFullWidthBehavior();
        return;
    }
    ensureSeedHosts();
    for (const host of document.querySelectorAll('.layout-tab-host')) {
        refreshHostChrome(host);
    }
    if (typeof layout.fullMaxHeight === 'number' && hasFullWidthStack()) {
        setFullRegionHeight(layout.fullMaxHeight);
    } else if (isGalleryInFullWidth() && !hasItemsBelowGallery()) {
        setFullRegionHeight(getFullWidthMaxCap());
    } else {
        setFullRegionHeight(null);
    }
    if (typeof layout.galleryHeight === 'number' && isGalleryInFullWidth() && hasItemsBelowGallery()) {
        setGalleryHeight(layout.galleryHeight);
    } else if (!isGalleryInFullWidth()) {
        resetGalleryHeight();
    }
    syncFullWidthBehavior();

    if (typeof globalThis.mainGallery?.updateMetaButtonsLayout === 'function') {
        requestAnimationFrame(() => globalThis.mainGallery.updateMetaButtonsLayout());
    }
}

const FACTORY_EXPANDED_KEYS = new Set(['gallery', 'queueManager', 'infoBox']);

function applyFactoryCollapsed() {
    const tabs = globalThis.collapsedTabs;
    if (!tabs) {
        return;
    }
    for (const [key, control] of Object.entries(tabs)) {
        if (typeof control?.setCollapsed !== 'function') {
            continue;
        }
        control.setCollapsed(!FACTORY_EXPANDED_KEYS.has(key));
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
    for (const host of document.querySelectorAll('.layout-tab-host')) {
        refreshHostChrome(host);
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

/** Persist current on-screen layout as the independent sidecar for a settings name. */
export async function persistIndependentLayoutFor(settingsName) {
    if (layoutMode !== 'independent') {
        return false;
    }
    const name = (settingsName && String(settingsName).trim())
        ? String(settingsName).trim()
        : getSettingsName();
    return await layoutApi('saveUiLayout', [name, readCurrentLayout(), 'independent']);
}

/** Remove the independent layout sidecar for a settings name (orphan cleanup on config delete). */
export async function deleteIndependentLayoutFor(settingsName) {
    const name = String(settingsName || '').replace(/\.json$/i, '').trim();
    if (!name || name === '_global') {
        return false;
    }
    return await layoutApi('deleteUiLayout', [name]);
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

function centerDrop(rect, y) {
    if (!rect || rect.height <= 0) {
        return false;
    }
    const rel = (y - rect.top) / rect.height;
    return rel >= 0.25 && rel <= 0.75;
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

function pinCharacterToTop() {
    const full = getFullWidthColumn();
    const character = getPanel(CHARACTER_ID);
    if (!full || !character) {
        return;
    }
    if (character.parentElement !== full) {
        full.prepend(character);
        return;
    }
    if (full.firstElementChild !== character) {
        full.prepend(character);
    }
}

function firstDroppableChild(column) {
    if (column?.id === 'full-width') {
        const character = getPanel(CHARACTER_ID);
        if (character && character.parentElement === column) {
            return character.nextElementSibling;
        }
    }
    return column?.firstElementChild || null;
}

function clampFullWidthBefore(column, beforeEl) {
    if (column?.id !== 'full-width') {
        return beforeEl;
    }
    const character = getPanel(CHARACTER_ID);
    if (!character || character.parentElement !== column) {
        return beforeEl;
    }
    if (!beforeEl || beforeEl === character) {
        return character.nextElementSibling;
    }
    if (character.compareDocumentPosition(beforeEl) & Node.DOCUMENT_POSITION_PRECEDING) {
        return character.nextElementSibling;
    }
    return beforeEl;
}

function placePlaceholder(column, beforeEl, placeholder, draggingEl) {
    if (!column || !placeholder) {
        return;
    }

    let target = beforeEl;
    if (target === draggingEl) {
        target = draggingEl.nextElementSibling;
    }
    target = clampFullWidthBefore(column, target);
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

function columnOf(el) {
    return el?.closest?.('#left, #right, #full-width') || null;
}

function findMergeHost(x, y, dragging) {
    if (isTabHost(dragging)) {
        return null;
    }
    const hits = document.elementsFromPoint(x, y) || [];
    for (const hit of hits) {
        if (!hit?.closest) {
            continue;
        }
        if (hit === dragging || dragging.contains(hit)) {
            continue;
        }
        const host = hit.closest('.layout-tab-host');
        if (host && host !== dragging && !host.contains(dragging)) {
            const onBar = Boolean(hit.closest('.layout-tab-bar'));
            if (onBar || centerDrop(host.getBoundingClientRect(), y)) {
                const column = columnOf(host);
                if (column && column.id !== 'full-width') {
                    return host;
                }
            }
        }
        const panel = hit.closest('[data-layout-id]');
        if (panel && panel !== dragging && !getTabHost(panel)
            && centerDrop(panel.getBoundingClientRect(), y)) {
            const column = columnOf(panel);
            if (column && column.id !== 'full-width'
                && panelZoneAllowed(dragging.dataset.layoutId, zoneOfColumn(column))
                && panelZoneAllowed(panel.dataset.layoutId, zoneOfColumn(column))) {
                return panel;
            }
        }
    }
    return null;
}

function clearLabelDropMarks() {
    for (const label of document.querySelectorAll('.layout-tab-drop-before, .layout-tab-drop-after')) {
        label.classList.remove('layout-tab-drop-before', 'layout-tab-drop-after');
    }
}

function markLabelDrop(host, beforePanel) {
    clearLabelDropMarks();
    if (!host) {
        return;
    }
    const labels = [...host.querySelectorAll(':scope > .layout-tab-bar .layout-tab-label')];
    if (labels.length === 0) {
        return;
    }
    if (!beforePanel) {
        labels.at(-1)?.classList.add('layout-tab-drop-after');
        return;
    }
    const label = labels.find((item) => item.dataset.tabPage === beforePanel.dataset.layoutId);
    label?.classList.add('layout-tab-drop-before');
}

function getReorderBeforePanel(host, x, y) {
    const bar = host?.querySelector(':scope > .layout-tab-bar');
    if (!bar) {
        return undefined;
    }
    const rect = bar.getBoundingClientRect();
    if (x < rect.left || x > rect.right || y < rect.top - 10 || y > rect.bottom + 10) {
        return undefined;
    }
    const pages = getHostPages(host);
    const labels = [...bar.querySelectorAll('.layout-tab-label')];
    for (const label of labels) {
        const box = label.getBoundingClientRect();
        if (x < box.left + box.width / 2) {
            return pages.find((item) => item.dataset.layoutId === label.dataset.tabPage) || null;
        }
    }
    return null;
}

function layoutItemAt(el) {
    if (!el?.closest) {
        return null;
    }
    const host = el.closest('.layout-tab-host');
    if (host) {
        return host;
    }
    return el.closest('[data-layout-id]');
}

// eslint-disable-next-line sonarjs/cognitive-complexity
function updatePlaceholderFromPoint(x, y) {
    if (!dragState) {
        return;
    }
    const { panel, placeholder, labelDrag, sourceHost } = dragState;
    if (labelDrag && sourceHost?.isConnected) {
        const beforePanel = getReorderBeforePanel(sourceHost, x, y);
        if (beforePanel !== undefined) {
            if (dragState.mergeHost) {
                dragState.mergeHost.classList.remove('layout-tab-hint');
            }
            dragState.mergeHost = null;
            dragState.reordering = true;
            dragState.reorderBefore = beforePanel;
            placeholder.style.visibility = 'hidden';
            markLabelDrop(sourceHost, beforePanel);
            return;
        }
    }
    dragState.reordering = false;
    dragState.reorderBefore = undefined;
    clearLabelDropMarks();

    const mergeHost = findMergeHost(x, y, panel);
    const mergeColumn = columnOf(mergeHost);
    const canMerge = mergeHost && mergeHost !== panel && mergeHost !== getTabHost(panel)
        && mergeColumn && mergeColumn.id !== 'full-width'
        && (isTabHost(panel)
            ? hostZoneAllowed(panel, zoneOfColumn(mergeColumn))
            : panelZoneAllowed(panel.dataset.layoutId, zoneOfColumn(mergeColumn)));
    if (dragState.mergeHost && dragState.mergeHost !== mergeHost) {
        dragState.mergeHost.classList.remove('layout-tab-hint');
    }
    dragState.mergeHost = canMerge ? mergeHost : null;
    placeholder.classList.toggle('layout-drop-merge', Boolean(dragState.mergeHost));
    if (dragState.mergeHost) {
        dragState.mergeHost.classList.add('layout-tab-hint');
        placeholder.style.visibility = 'hidden';
        return;
    }
    placeholder.style.visibility = '';

    const skip = new Set([panel, placeholder]);
    const hits = document.elementsFromPoint(x, y) || [];

    for (const hit of hits) {
        if (skip.has(hit) || placeholder.contains(hit) || panel.contains(hit)) {
            continue;
        }
        const overItem = layoutItemAt(hit);
        if (overItem && overItem !== panel) {
            const rect = overItem.getBoundingClientRect();
            const before = y < rect.top + rect.height / 2;
            const column = overItem.parentElement;
            placePlaceholder(column, before ? overItem : overItem.nextElementSibling, placeholder, panel);
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

function resolveDragTarget(panel, forceExtract = false) {
    if (isTabHost(panel)) {
        return panel;
    }
    if (!forceExtract && isLastHostPage(panel)) {
        return getTabHost(panel) || panel;
    }
    return panel;
}

function startDrag(panel, event, options = {}) {
    const forceExtract = Boolean(options.forceExtract);
    const labelDrag = Boolean(options.labelDrag);
    panel = resolveDragTarget(panel, forceExtract || labelDrag);
    const sourceHost = getTabHost(panel);
    if (!labelDrag && !isTabHost(panel) && sourceHost) {
        extractPanelFromHost(panel, null, forceExtract);
    }
    if (!panel.parentElement) {
        return;
    }
    const rect = panel.getBoundingClientRect();
    const placeholder = createPlaceholder(rect.height);
    if (labelDrag && sourceHost) {
        sourceHost.after(placeholder);
        placeholder.style.visibility = 'hidden';
    } else {
        panel.before(placeholder);
    }

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
        mergeHost: null,
        forceExtract,
        labelDrag,
        sourceHost,
        reordering: false,
        reorderBefore: undefined,
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top,
        originWidth: rect.width,
        originParent: sourceHost?.parentElement || placeholder.parentElement,
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

function dropAllowed(panel, column) {
    const zone = zoneOfColumn(column);
    if (!zone) {
        return false;
    }
    if (panel?.dataset?.layoutId === CHARACTER_ID) {
        return false;
    }
    if (isTabHost(panel)) {
        return hostZoneAllowed(panel, zone);
    }
    return panelZoneAllowed(panel.dataset.layoutId, zone);
}

function mergeDraggedIntoHost(panel, host) {
    if (isTabHost(panel)) {
        return;
    }
    mergePanelIntoHost(host, panel, true);
    bindHostDrag(host);
}

async function endDrag() {
    if (!dragState) {
        return;
    }
    const {
        panel, placeholder, scrollRaf, mergeHost, originParent,
        forceExtract, labelDrag, sourceHost, reordering, reorderBefore
    } = dragState;
    if (scrollRaf) {
        cancelAnimationFrame(scrollRaf);
    }

    if (mergeHost?.isConnected) {
        mergeHost.classList.remove('layout-tab-hint');
    }
    clearLabelDropMarks();

    if (reordering && sourceHost?.isConnected) {
        placeholder.remove();
        clearFloatStyles(panel);
        movePageInHost(sourceHost, panel, reorderBefore);
    } else {
        let mergeTarget = mergeHost && mergeHost.isConnected ? mergeHost : null;
        if (mergeTarget && !isTabHost(mergeTarget) && columnOf(mergeTarget)?.id !== 'full-width') {
            mergeTarget = ensureHostForPanel(mergeTarget);
        }
        if (mergeTarget && isTabHost(mergeTarget)
            && mergeTarget !== panel && mergeTarget !== getTabHost(panel)
            && columnOf(mergeTarget)?.id !== 'full-width') {
            placeholder.remove();
            mergeDraggedIntoHost(panel, mergeTarget);
            clearFloatStyles(panel);
        } else if (placeholder.parentElement) {
            const column = placeholder.parentElement;
            if (!dropAllowed(panel, column)) {
                originParent?.appendChild(placeholder);
            }
            if (!isTabHost(panel) && getTabHost(panel)
                && (labelDrag || forceExtract || !isLastHostPage(panel))
                && placeholder.parentElement !== getTabHost(panel)
                && !getTabHost(panel)?.contains(placeholder)) {
                extractPanelFromHost(panel, placeholder, labelDrag || forceExtract);
            }
            placeholder.parentElement.insertBefore(panel, placeholder);
            placeholder.remove();
            if (isTabHost(panel) && panel.parentElement?.id === 'full-width') {
                unwrapHost(panel);
            }
            const host = getTabHost(panel);
            if (host) {
                bindHostDrag(host);
            }
            clearFloatStyles(panel);
        } else {
            clearFloatStyles(panel);
        }
    }
    if (isTabHost(panel)) {
        panel.classList.remove('layout-tab-hint');
    }
    document.body.classList.remove('layout-is-dragging');
    setFullWidthDropHint(false);
    dragState = null;
    pruneTabHosts();
    syncFullWidthBehavior();
    await persistLayout();
}

function isDragArmed(panel) {
    if (panel?.classList.contains('layout-drop-hint')) {
        return true;
    }
    const host = isTabHost(panel) ? panel : getTabHost(panel);
    return Boolean(host?.classList.contains('layout-tab-hint'));
}

function beginPotentialDrag(panel, event, suppressClick, options = {}) {
    if (event.button !== 0 || dragState) {
        return;
    }
    if (panel?.dataset?.layoutId === CHARACTER_ID) {
        return;
    }
    if (!options.armed && !isDragArmed(panel)) {
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
            startDrag(panel, moveEvent, options);
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
        // Tabbed: only the tab label may drag. Restore empty-area arming
        // when this panel is extracted as a standalone element.
        if (getTabHost(panel)) {
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
        if (getTabHost(panel)) {
            return;
        }
        const interactive = isInteractiveTarget(event.target, panel);
        const armed = isDragArmed(panel);
        noteHintGesture(panel);
        if (interactive) {
            return;
        }
        if (!armed) {
            return;
        }
        beginPotentialDrag(panel, event, false, { armed: true });
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

const boundHosts = new WeakSet();

function bindHostDrag(host) {
    if (!host || boundHosts.has(host)) {
        return;
    }
    boundHosts.add(host);
    const bar = host.querySelector(':scope > .layout-tab-bar');
    if (!bar) {
        return;
    }
    bar.addEventListener('pointerenter', () => scheduleDropHint(host));
    bar.addEventListener('pointerleave', () => cancelDropHint(host));
    bar.addEventListener('click', (event) => {
        if (!suppressHandleClick || !event.target.closest('.layout-tab-collapse')) {
            return;
        }
        event.preventDefault();
        event.stopImmediatePropagation();
        suppressHandleClick = false;
    }, true);
    bar.addEventListener('pointerdown', (event) => {
        const armed = isDragArmed(host);
        const onCollapse = event.target.closest('.layout-tab-collapse');
        const onEnable = event.target.closest('.layout-tab-enable');
        if (onEnable) {
            noteHintGesture(host);
            return;
        }
        // Fold button keeps handle-style hover-to-drag. Do not consume the
        // arm on pointerdown or a click-to-fold also kills the drag.
        if (onCollapse) {
            if (armed) {
                beginPotentialDrag(host, event, true, { armed: true });
            }
            return;
        }
        noteHintGesture(host);
        const label = event.target.closest('.layout-tab-label');
        if (label) {
            if (label.isContentEditable) {
                return;
            }
            const pagePanel = getHostPages(host).find((item) => item.dataset.layoutId === label.dataset.tabPage);
            if (pagePanel) {
                setHostActive(host, label.dataset.tabPage);
                if (armed) {
                    beginPotentialDrag(pagePanel, event, true, {
                        forceExtract: true,
                        labelDrag: true,
                        armed: true
                    });
                }
            }
            return;
        }
        if (armed) {
            beginPotentialDrag(host, event, false, { armed: true });
        }
    }, true);
    host.addEventListener('layout-tab-renamed', () => {
        persistLayout();
    });
    host.addEventListener('layout-tab-folded', () => {
        persistLayout();
    });
}

function ensureSeedHosts() {
    const full = getFullWidthColumn();
    for (const host of document.querySelectorAll('.layout-tab-host')) {
        if (full?.contains(host) || getHostPages(host).length <= 1) {
            unwrapHost(host);
            continue;
        }
        bindHostDrag(host);
    }
}

function getGalleryMain() {
    return document.querySelector('.gallery-main-main');
}

function isGalleryInFullWidth() {
    const full = getFullWidthColumn();
    const gallery = getPanel('gallery-main');
    return Boolean(full && gallery && gallery.parentElement === full);
}

function isGalleryMainCollapsed() {
    const gallery = getPanel('gallery-main');
    const main = getGalleryMain();
    return Boolean(gallery?.classList.contains('collapsed') || main?.classList.contains('collapsed'));
}

function getFullWidthItems(full) {
    return [...(full?.children || [])].filter((el) => el.dataset?.layoutId || isTabHost(el));
}

function hasItemsBelowGallery() {
    const full = getFullWidthColumn();
    const gallery = getPanel('gallery-main');
    if (!full || !gallery || gallery.parentElement !== full) {
        return false;
    }
    const items = getFullWidthItems(full);
    const galleryIndex = items.indexOf(gallery);
    return galleryIndex >= 0 && galleryIndex < items.length - 1;
}

function isGalleryCompressMode() {
    if (!isGalleryInFullWidth() || isGalleryMainCollapsed()) {
        return false;
    }
    return hasItemsBelowGallery();
}

function isBelowGalleryFullyVisible() {
    const full = getFullWidthColumn();
    const gallery = getPanel('gallery-main');
    if (!full || !gallery || gallery.parentElement !== full) {
        return true;
    }
    const items = getFullWidthItems(full);
    const galleryIndex = items.indexOf(gallery);
    if (galleryIndex < 0 || galleryIndex >= items.length - 1) {
        return true;
    }
    const last = items.at(-1);
    const fullRect = full.getBoundingClientRect();
    const lastRect = last.getBoundingClientRect();
    const padBottom = Number.parseFloat(globalThis.getComputedStyle(full).paddingBottom) || 0;
    return lastRect.bottom <= fullRect.bottom - padBottom + 2;
}

function hasFullWidthStack() {
    const full = getFullWidthColumn();
    if (!full) {
        return false;
    }
    return [...full.children].some((el) => (
        (el.dataset?.layoutId && el.dataset.layoutId !== CHARACTER_ID) || isTabHost(el)
    ));
}

function galleryChromeHeight() {
    const gallery = getPanel('gallery-main');
    const main = getGalleryMain();
    if (!gallery || !main) {
        return 42;
    }
    const marginTop = Number.parseFloat(globalThis.getComputedStyle(gallery).marginTop) || 0;
    const chrome = gallery.getBoundingClientRect().height - main.getBoundingClientRect().height;
    return Math.max(0, chrome) + marginTop;
}

function getFullWidthMinCap() {
    const full = getFullWidthColumn();
    const character = getPanel(CHARACTER_ID);
    const charHeight = character && full?.contains(character)
        ? Math.ceil(character.getBoundingClientRect().height)
        : 40;
    const pad = full ? Number.parseFloat(globalThis.getComputedStyle(full).paddingBottom) || 0 : 10;
    if (isGalleryInFullWidth() && !isGalleryMainCollapsed()) {
        return Math.ceil(charHeight + GALLERY_COMPRESS_MIN + galleryChromeHeight() + pad);
    }
    return Math.ceil(charHeight + pad + 8);
}

function getFullWidthMaxCap() {
    const body = document.getElementById('full-body');
    const header = document.getElementById('top-header');
    const handle = document.getElementById('full-split-handle');
    const available = body
        ? body.clientHeight - (header?.offsetHeight || 0) - SPLIT_MIN_HEIGHT - (handle?.offsetHeight || 10)
        : FULL_WIDTH_CSS_MAX;
    return Math.max(getFullWidthMinCap(), Math.min(FULL_WIDTH_CSS_MAX, available));
}

function setFullRegionHeight(px) {
    const full = getFullWidthColumn();
    if (!full) {
        return;
    }
    if (px == null) {
        fullRegionHeight = null;
        full.style.maxHeight = '';
        full.style.height = '';
        return;
    }
    const next = Math.round(Math.max(getFullWidthMinCap(), Math.min(getFullWidthMaxCap(), px)));
    fullRegionHeight = next;
    full.style.maxHeight = `${next}px`;
    full.style.height = `${next}px`;
}

function resetGalleryHeight() {
    const main = getGalleryMain();
    if (!main) {
        return;
    }
    main.classList.remove('layout-gallery-compress');
    main.style.height = '';
    main.style.maxHeight = '';
}

function readGalleryHeight() {
    const main = getGalleryMain();
    if (!main) {
        return GALLERY_MAIN_HEIGHT;
    }
    const raw = Number.parseFloat(main.style.height);
    return Number.isFinite(raw) ? raw : GALLERY_MAIN_HEIGHT;
}

function fullWidthContentBottom(full) {
    const style = globalThis.getComputedStyle(full);
    const padBottom = Number.parseFloat(style.paddingBottom) || 0;
    const borderBottom = Number.parseFloat(style.borderBottomWidth) || 0;
    return full.getBoundingClientRect().bottom - padBottom - borderBottom;
}

function gallerySeamGap() {
    const full = getFullWidthColumn();
    const gallery = getPanel('gallery-main');
    if (!full || !gallery) {
        return 0;
    }
    return Math.floor(fullWidthContentBottom(full) - gallery.getBoundingClientRect().bottom);
}

function galleryMainFitForRegion(inset = 2) {
    const full = getFullWidthColumn();
    const gallery = getPanel('gallery-main');
    const main = getGalleryMain();
    if (!full || !gallery || !main) {
        return GALLERY_MAIN_HEIGHT;
    }
    const fullStyle = globalThis.getComputedStyle(full);
    const padBottom = Number.parseFloat(fullStyle.paddingBottom) || 0;
    const borderBottom = Number.parseFloat(fullStyle.borderBottomWidth) || 0;
    const rowGap = Number.parseFloat(fullStyle.rowGap) || Number.parseFloat(fullStyle.gap) || 0;
    const fullRect = full.getBoundingClientRect();
    const mainRect = main.getBoundingClientRect();
    const galleryRect = gallery.getBoundingClientRect();
    // Container padding/border below .gallery-main-main, plus any flex gap.
    // Using main.top alone overshoots and clips the gallery bottom edge.
    const belowMain = Math.max(0, galleryRect.bottom - mainRect.bottom);
    const regionMax = Math.floor(
        fullRect.bottom - padBottom - borderBottom - mainRect.top - belowMain - rowGap - inset
    );
    if (!Number.isFinite(regionMax)) {
        return GALLERY_MAIN_HEIGHT;
    }
    return regionMax;
}

function getGalleryHeightCap() {
    const full = getFullWidthColumn();
    const main = getGalleryMain();
    if (!full || !main || !isGalleryInFullWidth()) {
        return GALLERY_MAIN_HEIGHT;
    }
    const current = readGalleryHeight();
    // Content-fit using last child's margin box. scrollHeight misses
    // flex item margin-top / margin-bottom and under-reports overflow.
    const items = getFullWidthItems(full);
    const last = items.at(-1);
    if (!last) {
        return GALLERY_MAIN_HEIGHT;
    }
    const fullStyle = globalThis.getComputedStyle(full);
    const padBottom = Number.parseFloat(fullStyle.paddingBottom) || 0;
    const lastMarginBottom = Number.parseFloat(globalThis.getComputedStyle(last).marginBottom) || 0;
    const overflow = Math.ceil(
        last.getBoundingClientRect().bottom + lastMarginBottom + padBottom
        - full.getBoundingClientRect().bottom
    );
    const fit = Math.floor(current - overflow);
    if (!Number.isFinite(fit)) {
        return GALLERY_MAIN_HEIGHT;
    }
    return Math.min(GALLERY_MAIN_HEIGHT, Math.max(GALLERY_COMPRESS_MIN, fit));
}

function getGalleryExpandMax(fillSeam = false) {
    if (!isGalleryInFullWidth()) {
        return GALLERY_MAIN_HEIGHT;
    }
    // Region-aware expand ceiling: fit the gallery *container* (not just
    // .gallery-main-main) inset from #full-width's bottom so the border
    // stays visible. Siblings may still be pushed below the fold.
    const regionMax = galleryMainFitForRegion(2);
    const hardMax = fillSeam ? FULL_WIDTH_CSS_MAX : GALLERY_MAIN_HEIGHT;
    return Math.min(hardMax, Math.max(GALLERY_COMPRESS_MIN, regionMax));
}

function fillGalleryToFullWidthSeam() {
    if (!isGalleryInFullWidth() || isGalleryMainCollapsed() || hasItemsBelowGallery() || splitDrag) {
        return;
    }
    // Auto height collapses to current content, so expandMax cannot grow.
    // Lock the region to the designed max first, then fill the leftover band.
    if (fullRegionHeight == null) {
        setFullRegionHeight(getFullWidthMaxCap());
    }
    const gap = gallerySeamGap();
    // 0..2px leftover is flush enough (includes drag-to-max). Grow a real
    // under-fill; shrink when the default 872 + chrome already past the split.
    if (gap >= 0 && gap <= 2) {
        return;
    }
    setGalleryHeight(galleryMainFitForRegion(2), { fillSeam: true });
}

function clampGalleryIfOverflowing() {
    if (!isGalleryInFullWidth() || isGalleryMainCollapsed() || splitDrag) {
        return;
    }
    if (gallerySeamGap() >= 0) {
        return;
    }
    setGalleryHeight(galleryMainFitForRegion(2), { fillSeam: !hasItemsBelowGallery() });
}

function setGalleryHeight(px, { fillSeam = false } = {}) {
    const main = getGalleryMain();
    if (!main || main.classList.contains('collapsed')) {
        return;
    }
    // Absolute clamp only - wheel/split decide fit-based limits separately so
    // compress can step by delta without snapping to the content-fit value.
    // fillSeam may grow past GALLERY_MAIN_HEIGHT so a lone gallery meets the split.
    const hardMax = fillSeam ? FULL_WIDTH_CSS_MAX : GALLERY_MAIN_HEIGHT;
    const next = Math.min(hardMax, Math.max(GALLERY_COMPRESS_MIN, Math.round(px)));
    if (!fillSeam && next >= GALLERY_MAIN_HEIGHT) {
        resetGalleryHeight();
        return;
    }
    main.classList.add('layout-gallery-compress');
    main.style.height = `${next}px`;
    main.style.maxHeight = `${next}px`;
}

function wheelDeltaY(event) {
    if (event.deltaMode === 1) {
        return event.deltaY * 16;
    }
    if (event.deltaMode === 2) {
        return event.deltaY * GALLERY_MAIN_HEIGHT;
    }
    return event.deltaY;
}

function canScrollY(el, deltaY) {
    if (!(el instanceof Element)) {
        return false;
    }
    const style = globalThis.getComputedStyle(el);
    const overflowY = style.overflowY;
    if (overflowY !== 'auto' && overflowY !== 'scroll' && overflowY !== 'overlay') {
        return false;
    }
    if (el.scrollHeight <= el.clientHeight + 1) {
        return false;
    }
    if (deltaY > 0) {
        return el.scrollTop + el.clientHeight < el.scrollHeight - 1;
    }
    if (deltaY < 0) {
        return el.scrollTop > 0;
    }
    return false;
}

function findScrollableAncestor(start, boundary, deltaY) {
    let el = start instanceof Element ? start : null;
    while (el && el !== boundary) {
        if (boundary && !boundary.contains(el)) {
            break;
        }
        if (canScrollY(el, deltaY)) {
            return el;
        }
        el = el.parentElement;
    }
    return null;
}

function onFullWidthWheel(event) {
    if (!isGalleryCompressMode()) {
        return;
    }
    // Ctrl/Meta+wheel is owned by gallery grid resize (customGallery handleGridWheel).
    if (event.ctrlKey || event.metaKey) {
        return;
    }
    const full = getFullWidthColumn();
    const main = getGalleryMain();
    if (!full || !main) {
        return;
    }
    const delta = wheelDeltaY(event);
    if (!delta) {
        return;
    }
    // Nested scroll: consume wheel on gallery inner scroller until its edge,
    // then allow compress / #full-width scroll / expand below.
    const target = event.target instanceof Element ? event.target : null;
    if (target && main.contains(target)) {
        const inner = findScrollableAncestor(target, main, delta);
        if (inner) {
            event.preventDefault();
            inner.scrollTop += delta;
            return;
        }
    }
    const current = readGalleryHeight();
    // fitCap: compress floor (content-fit). expandMax: visible-region ceiling
    // (may push siblings below the fold). Do not use fitCap as expand limit.
    const fitCap = getGalleryHeightCap();
    const expandMax = getGalleryExpandMax();
    if (delta > 0) {
        // Shrink gradually while overflowing / below not fully visible; never
        // jump past fitCap (that created the huge empty-gap over-shrink).
        if (current > GALLERY_COMPRESS_MIN && current > fitCap && !isBelowGalleryFullyVisible()) {
            event.preventDefault();
            setGalleryHeight(Math.max(fitCap, current - delta));
            return;
        }
        if (full.scrollHeight > full.clientHeight + 1) {
            event.preventDefault();
            full.scrollTop += delta;
        }
        return;
    }
    if (full.scrollTop > 0) {
        event.preventDefault();
        full.scrollTop += delta;
        return;
    }
    if (current < expandMax) {
        event.preventDefault();
        setGalleryHeight(Math.min(expandMax, current - delta));
    }
}

function applyFullSplitDelta(deltaUp) {
    if (!splitDrag) {
        return;
    }
    const desired = Math.max(
        getFullWidthMinCap(),
        Math.min(getFullWidthMaxCap(), splitDrag.startFull - deltaUp)
    );
    const regionDelta = splitDrag.startFull - desired;
    // Update region before gallery so layout metrics match the new clientHeight.
    setFullRegionHeight(desired);
    if (splitDrag.galleryInFull && !isGalleryMainCollapsed()) {
        const next = splitDrag.startGallery - regionDelta;
        // After the region changes, clamp to the container-aware expand max
        // so a non-max split does not leave the gallery a few px too tall.
        if (hasItemsBelowGallery()) {
            setGalleryHeight(Math.min(getGalleryExpandMax(), next));
        } else {
            setGalleryHeight(Math.min(getGalleryExpandMax(true), next), { fillSeam: true });
        }
    }
}

function syncFullSplitHandle() {
    const handle = document.getElementById('full-split-handle');
    if (!handle) {
        return;
    }
    const show = hasFullWidthStack();
    handle.hidden = !show;
    if (!show && splitDrag == null) {
        setFullRegionHeight(null);
    }
}

function syncFullWidthBehavior() {
    pinCharacterToTop();
    if (!isGalleryInFullWidth()) {
        resetGalleryHeight();
    } else if (hasItemsBelowGallery()) {
        if (readGalleryHeight() > GALLERY_MAIN_HEIGHT) {
            resetGalleryHeight();
        }
        clampGalleryIfOverflowing();
    } else {
        fillGalleryToFullWidthSeam();
    }
    syncFullSplitHandle();
}

function onFullSplitPointerDown(event) {
    if (event.button !== 0 || splitDrag || dragState) {
        return;
    }
    const full = getFullWidthColumn();
    const handle = document.getElementById('full-split-handle');
    if (!full || !handle || handle.hidden) {
        return;
    }
    event.preventDefault();
    splitDrag = {
        startY: event.clientY,
        startFull: full.getBoundingClientRect().height,
        startGallery: readGalleryHeight(),
        galleryInFull: isGalleryInFullWidth()
    };
    handle.classList.add('layout-full-split-active');
    document.body.classList.add('layout-is-resizing-full');
    window.addEventListener('pointermove', onFullSplitPointerMove);
    window.addEventListener('pointerup', onFullSplitPointerUp);
    window.addEventListener('pointercancel', onFullSplitPointerUp);
}

function onFullSplitPointerMove(event) {
    if (!splitDrag) {
        return;
    }
    applyFullSplitDelta(splitDrag.startY - event.clientY);
}

async function onFullSplitPointerUp() {
    window.removeEventListener('pointermove', onFullSplitPointerMove);
    window.removeEventListener('pointerup', onFullSplitPointerUp);
    window.removeEventListener('pointercancel', onFullSplitPointerUp);
    document.getElementById('full-split-handle')?.classList.remove('layout-full-split-active');
    document.body.classList.remove('layout-is-resizing-full');
    splitDrag = null;
    pinCharacterToTop();
    syncFullSplitHandle();
    await persistLayout();
}

function setupFullWidthScroll() {
    const full = getFullWidthColumn();
    if (!full || full.dataset.layoutScrollBound === '1') {
        return;
    }
    full.dataset.layoutScrollBound = '1';
    full.addEventListener('wheel', onFullWidthWheel, { passive: false, capture: true });
    document.getElementById('gallery-main-toggle')?.addEventListener('click', () => {
        resetGalleryHeight();
        syncFullWidthBehavior();
    });
    const handle = document.getElementById('full-split-handle');
    handle?.addEventListener('pointerdown', onFullSplitPointerDown);
    window.addEventListener('resize', () => {
        if (fullRegionHeight != null) {
            setFullRegionHeight(fullRegionHeight);
        }
        syncFullWidthBehavior();
    });
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
        setupFullWidthScroll();
        handlesBound = true;
    }
    await applySavedLayout();
    updateUiLayoutLanguage();
    syncFullWidthBehavior();
}

