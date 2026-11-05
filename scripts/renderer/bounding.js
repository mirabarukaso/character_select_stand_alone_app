import { setupCheckbox } from './components/myCheckbox.js';
import { setupSlider } from './components/mySlider.js';
import { showDialog } from './components/myDialog.js';

const MAX_BOXES = 128;
const HANDLE_PX = 7;
const DRAG_PX = 4;
const OBJECT_RGB = [52, 152, 219];
const TEXT_RGB = [243, 156, 18];
const GRID_MIN = 32;
const GRID_MAX = 256;
const GRID_DEFAULT = 64;
export const PALETTE = [
    '#3498db', '#f39c12', '#e74c3c', '#27ae60', '#9b59b6', '#1abc9c', '#f4f1e6', '#222222',
    '#ffe600', '#7fff00', '#00ffff', '#4000ff', '#aa00ff', '#ff00ff', '#ff0099', '#ff99ff'
];
const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const CURSORS = {
    nw: 'nwse-resize',
    se: 'nwse-resize',
    ne: 'nesw-resize',
    sw: 'nesw-resize',
    n: 'ns-resize',
    s: 'ns-resize',
    e: 'ew-resize',
    w: 'ew-resize'
};

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function clamp01(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    return clamp(number, 0, 1);
}

export function clampGridSize(value) {
    return clamp(Math.round(Number(value)) || GRID_DEFAULT, GRID_MIN, GRID_MAX);
}

function rgba(rgb, alpha) {
    return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

function isPositive(value) {
    return Number.isFinite(value) && value > 0;
}

function trimTrailingSpace(value) {
    let end = value.length;
    while (end > 0 && (value[end - 1] === ' ' || value[end - 1] === '\t')) end -= 1;
    return end === value.length ? value : value.slice(0, end);
}

function isTypingTarget(el) {
    if (!el) return false;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
}

function normalizeColor(value) {
    const text = String(value ?? '').trim();
    const short = /^#([0-9a-fA-F]{3})$/.exec(text);
    if (short) {
        const [r, g, b] = short[1];
        return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
    }
    const full = /^#([0-9a-fA-F]{6})$/.exec(text);
    return full ? `#${full[1].toLowerCase()}` : '';
}

function hexToRgb(hex) {
    return [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset + 1, offset + 3), 16));
}

function rgbToHex(rgb) {
    return `#${rgb.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

function boxColor(box) {
    if (box?.color) {
        const rgb = hexToRgb(box.color);
        if (rgb.every((channel) => Number.isFinite(channel))) return rgb;
    }
    return box?.mode === 'text' ? TEXT_RGB : OBJECT_RGB;
}

function verticalMargin(el) {
    if (!el) return 0;
    const style = getComputedStyle(el);
    return (Number.parseFloat(style.marginTop) || 0) + (Number.parseFloat(style.marginBottom) || 0);
}

function verticalSpace(el) {
    if (!el) return 0;
    const style = getComputedStyle(el);
    if (style.display === 'none') return 0;
    return el.offsetHeight + verticalMargin(el);
}

function sumChildSpace(parent, skip) {
    if (!parent) return 0;
    let total = 0;
    for (const child of parent.children) {
        if (child !== skip) total += verticalSpace(child);
    }
    return total;
}

function tabChrome(panel, column) {
    const tabHost = panel.closest('.layout-tab-host');
    if (!tabHost || !column.contains(tabHost)) return 0;
    const style = getComputedStyle(tabHost);
    return (Number.parseFloat(style.paddingTop) || 0)
        + (Number.parseFloat(style.paddingBottom) || 0)
        + (Number.parseFloat(style.borderTopWidth) || 0)
        + (Number.parseFloat(style.borderBottomWidth) || 0)
        + verticalMargin(tabHost)
        + verticalSpace(tabHost.querySelector(':scope > .layout-tab-bar'))
        + verticalSpace(tabHost.querySelector(':scope > .layout-tab-view-dock'));
}

function columnChrome(panel, column) {
    if (!column || !panel) return 0;
    let reserved = tabChrome(panel, column);
    const sticky = column.querySelector(':scope > .layout-character-host');
    if (sticky && sticky !== panel && !panel.contains(sticky)) reserved += verticalSpace(sticky);
    const columnStyle = getComputedStyle(column);
    reserved += (Number.parseFloat(columnStyle.paddingTop) || 0) + (Number.parseFloat(columnStyle.paddingBottom) || 0);
    return reserved;
}

export function snapNormalized(value, canvasSize, gridPx, enabled) {
    const number = Number(value);
    const clamped = clamp(Number.isFinite(number) ? number : 0, 0, 1);
    if (!enabled) return clamped;
    const size = Math.max(1, Math.round(Number(canvasSize) || 0));
    const grid = Math.max(1, Math.round(Number(gridPx) || 0));
    const step = grid / size;
    if (step <= 0) return clamped;
    return clamp(Math.round(clamped / step) * step, 0, 1);
}

export function snapEdges(left, top, right, bottom, snap) {
    const { width, height, gridPx, enabled } = snap;
    let nx = snapNormalized(left, width, gridPx, enabled);
    let ny = snapNormalized(top, height, gridPx, enabled);
    let farX = snapNormalized(right, width, gridPx, enabled);
    let farY = snapNormalized(bottom, height, gridPx, enabled);
    if (farX < nx) [nx, farX] = [farX, nx];
    if (farY < ny) [ny, farY] = [farY, ny];
    return { nx, ny, nw: farX - nx, nh: farY - ny };
}

export function snapMove(nx, ny, nw, nh, snap) {
    const { width, height, gridPx, enabled } = snap;
    return {
        nx: clamp(snapNormalized(nx, width, gridPx, enabled), 0, 1 - nw),
        ny: clamp(snapNormalized(ny, height, gridPx, enabled), 0, 1 - nh),
        nw,
        nh
    };
}

// Fit the generation canvas into the slot. Scale stays at or below 1.
export function fitStageSize(width, height, availW, availH) {
    const genW = Math.max(1, Math.round(Number(width) || 0));
    const genH = Math.max(1, Math.round(Number(height) || 0));
    const slotW = Number(availW);
    const slotH = Number(availH);
    if (slotW <= 0 || slotH <= 0 || Number.isNaN(slotW) || Number.isNaN(slotH)) {
        return { width: genW, height: genH };
    }
    const scale = Math.min(1, slotW / genW, slotH / genH);
    let dispW = Math.round(genW * scale);
    let dispH = Math.round(genH * scale);
    if (dispW > slotW) dispW = Math.max(1, Math.floor(slotW));
    if (dispH > slotH) dispH = Math.max(1, Math.floor(slotH));
    return {
        width: Math.max(1, dispW),
        height: Math.max(1, dispH)
    };
}

function boundingMode(item) {
    return item.mode === 'text' ? 'text' : 'object';
}

function boundingText(item) {
    return typeof item.text === 'string' ? item.text : '';
}

function normalizeBoundingBox(item, used) {
    const id = Number(item?.id);
    if (!Number.isInteger(id) || id < 1 || id > MAX_BOXES || used.has(id)) return null;
    const nx = clamp01(item.nx);
    const ny = clamp01(item.ny);
    let nw = clamp01(item.nw);
    let nh = clamp01(item.nh);
    if (nx + nw > 1) nw = 1 - nx;
    if (ny + nh > 1) nh = 1 - ny;
    if (nw <= 0 || nh <= 0) return null;
    used.add(id);
    const box = {
        id,
        nx,
        ny,
        nw,
        nh,
        mode: boundingMode(item),
        text: boundingText(item)
    };
    const color = normalizeColor(item.color);
    if (color) box.color = color;
    if (item.locked === true) box.locked = true;
    return box;
}

export function clampPlateOpacity(value) {
    if (value === undefined || value === null || value === '') return 50;
    const number = Number(value);
    if (!Number.isFinite(number)) return 50;
    return clamp(Math.round(number), 0, 100);
}

// Without a plate, selected boxes stay solid. As the plate opacity rises, fills open
// on an ease-out curve so the image, the region edge, and the description stay visible.
export function boxPlatePaint(plateOpacity, selected, hasPlate) {
    const on = Boolean(selected);
    const fillBase = on ? 0.92 : 0.32;
    const strokeBase = on ? 1 : 0.95;
    if (!hasPlate) return { fill: fillBase, stroke: strokeBase, lightText: !on };
    const strength = clampPlateOpacity(plateOpacity) / 100;
    const open = 1 - (1 - strength) * (1 - strength);
    const fill = fillBase + ((on ? 0.24 : 0.1) - fillBase) * open;
    const stroke = on ? 1 : strokeBase + (0.78 - strokeBase) * open;
    return {
        fill: Math.round(fill * 1000) / 1000,
        stroke: Math.round(stroke * 1000) / 1000,
        lightText: !on || fill < 0.62
    };
}

// Same aspect scales to the stage. A different aspect fills the short side and stays centered.
export function coverPlateRect(imageW, imageH, viewW, viewH) {
    const srcW = Number(imageW);
    const srcH = Number(imageH);
    const dstW = Number(viewW);
    const dstH = Number(viewH);
    if (!isPositive(srcW) || !isPositive(srcH) || !isPositive(dstW) || !isPositive(dstH)) {
        return { x: 0, y: 0, w: 0, h: 0 };
    }
    const scale = Math.max(dstW / srcW, dstH / srcH);
    const w = srcW * scale;
    const h = srcH * scale;
    return { x: (dstW - w) / 2, y: (dstH - h) / 2, w, h };
}

// Locked boxes stay until a clear happens while every remaining box is locked.
export function boxesAfterClear(boxes) {
    if (!Array.isArray(boxes) || boxes.length === 0) return [];
    if (boxes.some((box) => !box?.locked)) return boxes.filter((box) => box?.locked);
    return [];
}

export function normalizeBoundingBoxes(raw) {
    if (!Array.isArray(raw)) return [];
    const used = new Set();
    const boxes = [];
    for (const item of raw) {
        const box = normalizeBoundingBox(item, used);
        if (box) boxes.push(box);
    }
    return renumberBoxes(boxes);
}

export function renumberBoxes(boxes) {
    if (!Array.isArray(boxes)) return [];
    return boxes.map((box, index) => ({ ...box, id: index + 1 }));
}

export function nextBoxId(boxes) {
    const count = Array.isArray(boxes) ? boxes.length : 0;
    if (count >= MAX_BOXES) return null;
    return count + 1;
}

function sameRect(a, b) {
    return a.nx === b.nx && a.ny === b.ny && a.nw === b.nw && a.nh === b.nh;
}

// Pixel edges are top-left origin. The model wants [y_min, x_min, y_max, x_max]
// with the canvas center as origin, x right and y down.
export function toCentralYxyx(box, width, height) {
    const canvasW = Math.max(1, Math.round(Number(width) || 0));
    const canvasH = Math.max(1, Math.round(Number(height) || 0));
    let left = clamp(Math.round(box.nx * canvasW), 0, canvasW);
    let right = clamp(Math.round((box.nx + box.nw) * canvasW), 0, canvasW);
    let top = clamp(Math.round(box.ny * canvasH), 0, canvasH);
    let bottom = clamp(Math.round((box.ny + box.nh) * canvasH), 0, canvasH);
    if (right < left) [left, right] = [right, left];
    if (bottom < top) [top, bottom] = [bottom, top];
    if (right === left) right = Math.min(canvasW, left + 1);
    if (bottom === top) bottom = Math.min(canvasH, top + 1);
    const cx = canvasW / 2;
    const cy = canvasH / 2;
    return [
        Math.round(top - cy),
        Math.round(left - cx),
        Math.round(bottom - cy),
        Math.round(right - cx)
    ];
}

function buildItem(box, width, height) {
    const number = String(box.id).padStart(2, '0');
    const bbox = toCentralYxyx(box, width, height);
    if (box.mode === 'text') {
        return { label: 'text', caption: number, text: box.text ?? '', bbox };
    }
    const description = String(box.text ?? '').trim();
    return { label: 'object', caption: description || number, bbox };
}

export function packBoundingPrompt(caption, width, height, boxes) {
    const items = normalizeBoundingBoxes(boxes).map((box) => buildItem(box, width, height));
    return JSON.stringify({
        summary: { caption: String(caption ?? '') },
        items,
        bbox_coord_space: 'abs_centralized',
        bbox_format: 'yxyx'
    });
}

export function applyBoundingPrompt(prompt, width, height) {
    const settings = globalThis.globalSettings;
    if (!settings?.bounding_enable || settings.regional_condition) {
        return String(prompt ?? '');
    }
    const boxes = globalThis.bounding?.getBoxes?.() ?? settings.bounding_boxes ?? [];
    return packBoundingPrompt(prompt, width, height, boxes);
}

function formatBoundingItemLine(box, width, height) {
    const item = buildItem(box, width, height);
    const hex = rgbToHex(boxColor(box));
    const number = String(box.id).padStart(2, '0');
    const bbox = `[${item.bbox.join(',')}]`;
    let body;
    if (item.label === 'text') {
        const text = String(item.text ?? '').replaceAll('\n', ' ');
        body = `[${number}][text] "${text}"  bbox=${bbox}`;
    } else {
        body = `[${number}][object] ${item.caption}  bbox=${bbox}`;
    }
    return `[color=${hex}]${body}[/color]`;
}

// Preview-only: colored per-box lines from draw content/colors.
export function formatBoundingPreview(_caption, width, height) {
    const settings = globalThis.globalSettings;
    if (!settings?.bounding_enable || settings.regional_condition) {
        return '';
    }
    const rawBoxes = globalThis.bounding?.getBoxes?.() ?? settings.bounding_boxes ?? [];
    const boxes = normalizeBoundingBoxes(rawBoxes);
    if (boxes.length === 0) {
        return '';
    }
    const lines = boxes.map((box) => formatBoundingItemLine(box, width, height));
    return `Bounding:\n${lines.join('\n')}\n`;
}

// The queue item is sent again on a busy retry, so packing happens once.
export function finalizePositivePrompt(generateData) {
    if (!generateData || generateData.boundingApplied) {
        return String(generateData?.positive ?? '');
    }
    generateData.positive = applyBoundingPrompt(generateData.positive, generateData.width, generateData.height);
    generateData.boundingApplied = true;
    return generateData.positive;
}

function logicalSize() {
    const settings = globalThis.globalSettings || {};
    const generate = globalThis.generate;
    const widthValue = Number(generate?.width?.getValue?.() ?? settings.width ?? 1024);
    const heightValue = Number(generate?.height?.getValue?.() ?? settings.height ?? 1024);
    const landscape = Boolean(generate?.landscape?.getValue?.() ?? settings.api_image_landscape);
    return {
        width: Math.max(1, Math.round(landscape ? heightValue : widthValue)),
        height: Math.max(1, Math.round(landscape ? widthValue : heightValue))
    };
}

function minNorm() {
    const { width, height } = logicalSize();
    return {
        minX: Math.max(8 / width, 0.004),
        minY: Math.max(8 / height, 0.004)
    };
}

function boxRect(box, viewW, viewH) {
    return {
        x: box.nx * viewW,
        y: box.ny * viewH,
        w: box.nw * viewW,
        h: box.nh * viewH
    };
}

function boxContainsPoint(box, x, y, viewW, viewH) {
    const rect = boxRect(box, viewW, viewH);
    return x >= rect.x && y >= rect.y && x <= rect.x + rect.w && y <= rect.y + rect.h;
}

// Smallest box under the point wins. Equal areas keep the later box on top.
export function boxesAtPoint(boxes, x, y, viewW, viewH) {
    const hits = [];
    for (let index = 0; index < boxes.length; index += 1) {
        if (boxContainsPoint(boxes[index], x, y, viewW, viewH)) hits.push({ box: boxes[index], index });
    }
    hits.sort((a, b) => (a.box.nw * a.box.nh) - (b.box.nw * b.box.nh) || b.index - a.index);
    return hits.map((hit) => hit.box);
}

export function cycleBoxId(ids, selectedId, direction) {
    if (!ids.length) return null;
    const step = direction < 0 ? -1 : 1;
    const index = ids.indexOf(selectedId);
    if (index < 0) return step < 0 ? ids[ids.length - 1] : ids[0];
    return ids[(index + step + ids.length) % ids.length];
}

// Canvas fillText does not wrap. Break on the caller's measured width.
export function wrapCanvasText(text, maxWidth, measure) {
    const width = Number(maxWidth);
    if (!isPositive(width) || typeof measure !== 'function') return [];
    const source = String(text ?? '');
    if (!source) return [];
    const lines = [];
    for (const part of source.split('\n')) {
        if (part === '') {
            lines.push('');
            continue;
        }
        lines.push(...wrapMeasuredLine(part, width, measure));
    }
    return lines;
}

// eslint-disable-next-line sonarjs/cognitive-complexity
function wrapMeasuredLine(line, maxWidth, measure) {
    const chars = Array.from(line);
    const lines = [];
    let start = 0;
    while (start < chars.length) {
        if (lines.length > 0) {
            while (start < chars.length && chars[start] === ' ') start += 1;
            if (start >= chars.length) break;
        }
        if (measure(chars[start]) > maxWidth) break;
        let lo = start + 1;
        let hi = chars.length;
        let best = start + 1;
        while (lo <= hi) {
            const mid = (lo + hi) >> 1;
            if (measure(chars.slice(start, mid).join('')) <= maxWidth) {
                best = mid;
                lo = mid + 1;
            } else {
                hi = mid - 1;
            }
        }
        if (best <= start) break;
        let breakAt = best;
        if (best < chars.length) {
            let spaceAt = -1;
            for (let index = best - 1; index > start; index -= 1) {
                if (chars[index] === ' ') {
                    spaceAt = index;
                    break;
                }
            }
            if (spaceAt > start) breakAt = spaceAt;
        }
        const piece = trimTrailingSpace(chars.slice(start, breakAt).join(''));
        if (piece) lines.push(piece);
        if (breakAt <= start) break;
        start = breakAt;
    }
    return lines;
}

// Height follows the measured text, stays at least one short field, and remains inside the stage.
export function fitEditorBox(rect, viewW, viewH, neededHeight) {
    const width = Math.max(1, Number(viewW) || 0);
    const height = Math.max(1, Number(viewH) || 0);
    const editW = Math.max(120, Math.min(Math.max(Number(rect?.w) || 0, 160), width - 8));
    const left = clamp(Number(rect?.x) || 0, 0, Math.max(0, width - editW));
    const minH = 52;
    const maxH = Math.max(minH, height - 8);
    const content = Number(neededHeight);
    const editH = Math.min(maxH, Math.max(minH, Number.isFinite(content) ? content : minH));
    const top = clamp(Number(rect?.y) || 0, 0, Math.max(0, height - editH));
    return { left, top, width: editW, height: editH };
}

function handlePoint(rect, name) {
    const midX = rect.x + rect.w / 2;
    const midY = rect.y + rect.h / 2;
    const points = {
        nw: [rect.x, rect.y],
        n: [midX, rect.y],
        ne: [rect.x + rect.w, rect.y],
        e: [rect.x + rect.w, midY],
        se: [rect.x + rect.w, rect.y + rect.h],
        s: [midX, rect.y + rect.h],
        sw: [rect.x, rect.y + rect.h],
        w: [rect.x, midY]
    };
    return points[name];
}

function resizeNorm(start, handle, dx, dy, minX, minY) {
    let nx = start.nx;
    let ny = start.ny;
    let nw = start.nw;
    let nh = start.nh;
    const right = start.nx + start.nw;
    const bottom = start.ny + start.nh;
    if (handle.includes('w')) {
        nx = clamp(start.nx + dx, 0, right - minX);
        nw = right - nx;
    } else if (handle.includes('e')) {
        nw = clamp(start.nw + dx, minX, 1 - start.nx);
    }
    if (handle.includes('n')) {
        ny = clamp(start.ny + dy, 0, bottom - minY);
        nh = bottom - ny;
    } else if (handle.includes('s')) {
        nh = clamp(start.nh + dy, minY, 1 - start.ny);
    }
    return { nx, ny, nw, nh };
}

export function setupBounding() {
    const stage = document.querySelector('.bounding-stage');
    const canvas = document.getElementById('bounding-canvas');
    const editor = document.getElementById('bounding-editor');
    const countEl = document.getElementById('bounding-count');
    const sizeEl = document.getElementById('bounding-size');
    const hintEl = document.getElementById('bounding-hint');
    const previewEl = document.getElementById('bounding-preview');
    const previewLabelEl = document.getElementById('bounding-preview-label');
    const objectButton = document.getElementById('bounding-mode-object');
    const textButton = document.getElementById('bounding-mode-text');
    if (!stage || !canvas || !editor) {
        console.error('[bounding] Canvas markup is missing');
        return null;
    }

    const ctx = canvas.getContext('2d');
    let boxes = normalizeBoundingBoxes(globalThis.globalSettings?.bounding_boxes);
    canvas.tabIndex = 0;
    let selectedId = null;
    let editingId = null;
    let drag = null;
    let nestPoint = null;
    let syncing = false;
    let fullTimer = 0;

    function selectedBox() {
        return boxes.find((box) => box.id === selectedId) || null;
    }

    function persist() {
        if (globalThis.globalSettings) {
            globalThis.globalSettings.bounding_boxes = boxes.map((box) => ({ ...box }));
        }
        invalidatePreview();
    }

    function updateCount() {
        if (!countEl) return;
        const lang = currentLang();
        const template = lang.bounding_count || '{0}/128';
        countEl.textContent = template.replace('{0}', String(boxes.length));
    }

    function currentLang() {
        const settings = globalThis.globalSettings;
        return globalThis.cachedFiles?.language?.[settings?.language] || {};
    }

    function setLanguage() {
        const lang = currentLang();
        const span = document.getElementById('bounding-span');
        if (span && lang.bounding_span) span.textContent = lang.bounding_span;
        if (hintEl) hintEl.textContent = lang.bounding_hint || 'Drag to draw a box. Click to select. Double-click to edit. Delete removes the selection.';
        if (objectButton) objectButton.textContent = lang.bounding_mode_object || 'object';
        if (textButton) textButton.textContent = lang.bounding_mode_text || 'text';
        if (addButton) addButton.textContent = lang.bounding_add || 'Add';
        if (clearButton) clearButton.textContent = lang.bounding_clear || 'Clear';
        if (lockButton) lockButton.textContent = lang.bounding_lock || 'Lock';
        snapBox?.setTitle(lang.bounding_grid_snap || 'Snap');
        gridSlider?.setTitle(lang.bounding_grid_size || 'Grid');
        plateSlider?.setTitle(lang.bounding_plate_opacity || 'Opacity');
        if (colorInput) colorInput.title = lang.bounding_color || 'Color';
        syncPlateControls();
        updateCount();
        refreshPreview();
    }

    function syncModeButtons() {
        const box = selectedBox();
        if (objectButton) {
            objectButton.disabled = !box;
            objectButton.classList.toggle('is-on', box?.mode === 'object');
        }
        if (textButton) {
            textButton.disabled = !box;
            textButton.classList.toggle('is-on', box?.mode === 'text');
        }
        if (lockButton) {
            lockButton.disabled = !box;
            lockButton.classList.toggle('is-on', Boolean(box?.locked));
        }
        syncColorControl();
    }

    function flashFull() {
        countEl?.classList.add('is-full');
        clearTimeout(fullTimer);
        fullTimer = setTimeout(() => countEl?.classList.remove('is-full'), 900);
    }

    let snapBox = null;
    let gridSlider = null;
    let plateSlider = null;
    let plateImage = null;
    let plateToken = 0;
    let platePending = false;

    function gridSnapOn() {
        return Boolean(snapBox?.getValue?.() ?? globalThis.globalSettings?.bounding_grid_snap);
    }

    function gridSizePx() {
        const raw = gridSlider?.getValue?.() ?? globalThis.globalSettings?.bounding_grid_size ?? GRID_DEFAULT;
        return clampGridSize(raw);
    }

    function snappedPoint(point) {
        if (!point) return point;
        const { width, height } = logicalSize();
        const grid = gridSizePx();
        const enabled = gridSnapOn();
        return {
            x: snapNormalized(point.x, width, grid, enabled),
            y: snapNormalized(point.y, height, grid, enabled)
        };
    }

    function drawGrid(viewW, viewH, width, height, scheme) {
        const grid = gridSizePx();
        const stepX = grid / width * viewW;
        const stepY = grid / height * viewH;
        if (stepX < 3 && stepY < 3) return;
        ctx.save();
        ctx.strokeStyle = scheme === 'light' ? 'rgba(0,0,0,0.14)' : 'rgba(255,255,255,0.14)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = stepX; x < viewW - 0.5; x += stepX) {
            const line = Math.round(x) + 0.5;
            ctx.moveTo(line, 0);
            ctx.lineTo(line, viewH);
        }
        for (let y = stepY; y < viewH - 0.5; y += stepY) {
            const line = Math.round(y) + 0.5;
            ctx.moveTo(0, line);
            ctx.lineTo(viewW, line);
        }
        ctx.stroke();
        ctx.restore();
    }

    function viewSize() {
        return {
            viewW: canvas.clientWidth || stage.clientWidth || 1,
            viewH: canvas.clientHeight || stage.clientHeight || 1
        };
    }

    function hitHandle(x, y) {
        const box = selectedBox();
        if (!box || box.locked) return null;
        const { viewW, viewH } = viewSize();
        const rect = boxRect(box, viewW, viewH);
        for (const name of HANDLES) {
            const [hx, hy] = handlePoint(rect, name);
            if (Math.abs(x - hx) <= HANDLE_PX && Math.abs(y - hy) <= HANDLE_PX) return name;
        }
        return null;
    }

    function hitBox(x, y) {
        const { viewW, viewH } = viewSize();
        return boxesAtPoint(boxes, x, y, viewW, viewH)[0] || null;
    }

    function nestIdsAt(point) {
        if (!point) return [];
        const { viewW, viewH } = viewSize();
        return boxesAtPoint(boxes, point.x, point.y, viewW, viewH).map((box) => box.id);
    }

    function cycleNested(direction) {
        let ids = nestIdsAt(nestPoint);
        const selected = selectedBox();
        if (ids.length < 2 && selected) {
            const { viewW, viewH } = viewSize();
            const rect = boxRect(selected, viewW, viewH);
            ids = nestIdsAt({ x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 });
        }
        if (ids.length < 2) ids = boxes.map((box) => box.id);
        const nextId = cycleBoxId(ids, selectedId, direction);
        if (nextId == null) return;
        selectedId = nextId;
        syncModeButtons();
        draw();
    }

    function localPoint(event) {
        const rect = canvas.getBoundingClientRect();
        return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    }

    function normPoint(point) {
        const { viewW, viewH } = viewSize();
        return {
            x: clamp(point.x / viewW, 0, 1),
            y: clamp(point.y / viewH, 0, 1)
        };
    }

    function fieldColor(scheme) {
        const field = getComputedStyle(stage).getPropertyValue('--field').trim();
        if (field) return field;
        return scheme === 'light' ? '#f4f1e6' : '#222';
    }

    function paintField(viewW, viewH, scheme) {
        ctx.fillStyle = fieldColor(scheme);
        ctx.fillRect(0, 0, viewW, viewH);
        paintPlate(viewW, viewH);
        ctx.strokeStyle = scheme === 'light' ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(viewW / 2, 0);
        ctx.lineTo(viewW / 2, viewH);
        ctx.moveTo(0, viewH / 2);
        ctx.lineTo(viewW, viewH / 2);
        ctx.stroke();
    }

    function currentBoxPaint(selected) {
        const hasPlate = Boolean(plateImage && plateImage.naturalWidth > 0 && plateImage.naturalHeight > 0);
        const opacity = clampPlateOpacity(plateSlider?.getValue?.() ?? globalThis.globalSettings?.bounding_plate_opacity);
        return boxPlatePaint(opacity, selected, hasPlate);
    }

    function paintBoxBody(box, rect, selected, paint) {
        const rgb = boxColor(box);
        ctx.fillStyle = rgba(rgb, paint.fill);
        ctx.strokeStyle = selected ? `rgba(255,255,255,${paint.stroke})` : rgba(rgb, paint.stroke);
        ctx.lineWidth = selected ? 2 : 1.5;
        ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
        ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, Math.max(0, rect.w - 1), Math.max(0, rect.h - 1));
    }

    function paintBoxIndex(rect, id) {
        const label = String(id).padStart(2, '0');
        ctx.font = '700 11px "Segoe UI", "Microsoft YaHei", sans-serif';
        const chipW = ctx.measureText(label).width + 8;
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(rect.x + 2, rect.y + 2, chipW, 16);
        ctx.fillStyle = '#fff';
        ctx.fillText(label, rect.x + 6, rect.y + 14);
    }

    function paintBoxText(box, rect, paint) {
        const maxWidth = rect.w - 12;
        if (maxWidth < 4) return;
        ctx.save();
        ctx.beginPath();
        ctx.rect(rect.x + 4, rect.y + 20, Math.max(0, rect.w - 8), Math.max(0, rect.h - 24));
        ctx.clip();
        ctx.font = '12px "Segoe UI", "Microsoft YaHei", sans-serif';
        ctx.fillStyle = paint.lightText ? '#fff' : '#111';
        ctx.shadowColor = paint.lightText ? 'rgba(0,0,0,0.85)' : 'transparent';
        ctx.shadowBlur = paint.lightText ? 3 : 0;
        const lines = wrapCanvasText(box.text, maxWidth, (value) => ctx.measureText(value).width);
        let lineY = rect.y + 34;
        for (const line of lines) {
            if (lineY > rect.y + rect.h) break;
            if (line) ctx.fillText(line, rect.x + 6, lineY);
            lineY += 15;
        }
        ctx.restore();
    }

    function paintHandles(rect) {
        ctx.shadowBlur = 0;
        for (const name of HANDLES) {
            const [hx, hy] = handlePoint(rect, name);
            ctx.fillStyle = '#fff';
            ctx.strokeStyle = '#222';
            ctx.lineWidth = 1;
            ctx.fillRect(hx - 4, hy - 4, 8, 8);
            ctx.strokeRect(hx - 4, hy - 4, 8, 8);
        }
    }

    function paintBox(box, viewW, viewH) {
        const rect = boxRect(box, viewW, viewH);
        const selected = box.id === selectedId;
        const paint = currentBoxPaint(selected);
        paintBoxBody(box, rect, selected, paint);
        paintBoxIndex(rect, box.id);
        if (box.text && rect.w > 24 && rect.h > 28) paintBoxText(box, rect, paint);
        if (box.locked) paintLock(rect);
        if (selected && !box.locked) paintHandles(rect);
    }

    function paintLock(rect) {
        if (rect.w < 22 || rect.h < 18) return;
        const x = rect.x + rect.w - 15;
        const y = rect.y + 3;
        ctx.save();
        ctx.strokeStyle = '#fff';
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.lineWidth = 1.25;
        ctx.beginPath();
        ctx.arc(x + 5, y + 4.5, 3, Math.PI, 0);
        ctx.stroke();
        ctx.fillRect(x + 1.5, y + 5, 7, 6);
        ctx.restore();
    }

    function paintPlate(viewW, viewH) {
        if (!plateImage || plateImage.naturalWidth < 1 || plateImage.naturalHeight < 1) return;
        const rect = coverPlateRect(plateImage.naturalWidth, plateImage.naturalHeight, viewW, viewH);
        const opacity = clampPlateOpacity(plateSlider?.getValue?.() ?? globalThis.globalSettings?.bounding_plate_opacity);
        ctx.save();
        ctx.globalAlpha = opacity / 100;
        ctx.drawImage(plateImage, rect.x, rect.y, rect.w, rect.h);
        ctx.restore();
    }

    function paintDraft(viewW, viewH) {
        if (drag?.kind !== 'create' || !drag.current) return;
        const start = snappedPoint(drag.startNorm);
        const current = snappedPoint(drag.current);
        const x = Math.min(start.x, current.x) * viewW;
        const y = Math.min(start.y, current.y) * viewH;
        const w = Math.abs(current.x - start.x) * viewW;
        const h = Math.abs(current.y - start.y) * viewH;
        const paint = currentBoxPaint(false);
        ctx.save();
        ctx.fillStyle = rgba(OBJECT_RGB, paint.fill);
        ctx.strokeStyle = '#fff';
        ctx.setLineDash([4, 3]);
        ctx.lineWidth = 1.5;
        ctx.fillRect(x, y, w, h);
        ctx.strokeRect(x, y, w, h);
        ctx.restore();
    }

    function draw() {
        const { width, height } = logicalSize();
        const dpr = window.devicePixelRatio || 1;
        const { viewW, viewH } = viewSize();
        if (!ctx || viewW < 2 || viewH < 2) return;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, viewW, viewH);
        const scheme = getComputedStyle(document.documentElement).getPropertyValue('--scheme').trim();
        paintField(viewW, viewH, scheme);
        drawGrid(viewW, viewH, width, height, scheme);
        const ordered = [
            ...boxes.filter((box) => box.id !== selectedId),
            ...boxes.filter((box) => box.id === selectedId)
        ];
        for (const box of ordered) paintBox(box, viewW, viewH);
        paintDraft(viewW, viewH);
        if (sizeEl) sizeEl.textContent = `${width} × ${height}`;
    }

    function resizeBitmap() {
        const dpr = window.devicePixelRatio || 1;
        const width = Math.max(1, Math.round((canvas.clientWidth || stage.clientWidth || 1) * dpr));
        const height = Math.max(1, Math.round((canvas.clientHeight || stage.clientHeight || 1) * dpr));
        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
        }
    }

    function measureSlot(genW, genH) {
        const main = stage.parentElement;
        if (!main) return null;
        const mainStyle = getComputedStyle(main);
        const padX = (Number.parseFloat(mainStyle.paddingLeft) || 0) + (Number.parseFloat(mainStyle.paddingRight) || 0);
        const availW = main.clientWidth - padX;
        if (availW < 80) return null;

        const panel = stage.closest('[data-layout-id="bounding"]');
        const column = panel?.closest('#left, #right, #full-width');
        let reserved = verticalMargin(panel) + verticalMargin(main);
        reserved += (Number.parseFloat(mainStyle.paddingTop) || 0) + (Number.parseFloat(mainStyle.paddingBottom) || 0);
        reserved += sumChildSpace(panel, main);
        reserved += sumChildSpace(main, stage);
        reserved += columnChrome(panel, column);

        const visible = column?.clientHeight || window.innerHeight || genH;
        let availH = visible - reserved - 8;
        if (availH < 80 || Number.isNaN(availH)) availH = Math.min(genH, Math.max(availH, 80));
        return fitStageSize(genW, genH, availW, availH);
    }

    function layoutStage(width, height) {
        const size = measureSlot(width, height);
        if (!size) return;
        if (stage.dataset.w === String(size.width) && stage.dataset.h === String(size.height)) return;
        stage.dataset.w = String(size.width);
        stage.dataset.h = String(size.height);
        stage.style.width = `${size.width}px`;
        stage.style.height = `${size.height}px`;
    }

    let previewPinned = false;
    let previewTimer = 0;

    function previewCaption() {
        if (typeof globalThis.composePositivePreview === 'function') {
            return globalThis.composePositivePreview();
        }
        return globalThis.generate?.lastPos || '';
    }

    function refreshPreview() {
        const lang = currentLang();
        if (previewLabelEl) previewLabelEl.textContent = lang.bounding_preview || 'Final positive';
        if (!previewEl) return;
        if (globalThis.globalSettings?.regional_condition) {
            previewPinned = false;
            previewEl.value = lang.bounding_preview_regional || '';
            return;
        }
        if (previewPinned) return;
        const { width, height } = logicalSize();
        previewEl.value = applyBoundingPrompt(previewCaption(), width, height);
    }

    function invalidatePreview() {
        previewPinned = false;
        refreshPreview();
    }

    function setPreview(text) {
        if (!previewEl || globalThis.globalSettings?.regional_condition) {
            refreshPreview();
            return;
        }
        previewPinned = true;
        if (previewLabelEl) previewLabelEl.textContent = currentLang().bounding_preview || 'Final positive';
        previewEl.value = String(text ?? '');
    }

    function schedulePreview() {
        clearTimeout(previewTimer);
        previewTimer = setTimeout(() => invalidatePreview(), 120);
    }

    function syncCanvas() {
        if (syncing) return;
        syncing = true;
        try {
            const { width, height } = logicalSize();
            layoutStage(width, height);
            resizeBitmap();
            draw();
            refreshPreview();
            if (editingId != null) layoutEditor();
        } finally {
            syncing = false;
        }
    }

    function closeEditor(save) {
        if (editingId == null) {
            editor.hidden = true;
            return;
        }
        if (save) {
            const box = boxes.find((item) => item.id === editingId);
            if (box) box.text = editor.value;
            persist();
        }
        editingId = null;
        editor.hidden = true;
        draw();
    }

    function layoutEditor() {
        if (editingId == null || editor.hidden) return;
        const box = boxes.find((item) => item.id === editingId);
        if (!box) return;
        const { viewW, viewH } = viewSize();
        const rect = boxRect(box, viewW, viewH);
        const widthBox = fitEditorBox(rect, viewW, viewH, 52);
        editor.style.left = `${widthBox.left}px`;
        editor.style.width = `${widthBox.width}px`;
        // A leftover tall height keeps scrollHeight from shrinking with the text.
        editor.style.overflowY = 'hidden';
        editor.style.height = '52px';
        const border = Math.max(0, editor.offsetHeight - editor.clientHeight);
        let needed = editor.scrollHeight + border;
        if (needed > 52) needed += 2;
        const place = fitEditorBox(rect, viewW, viewH, needed);
        editor.style.top = `${place.top}px`;
        editor.style.height = `${place.height}px`;
        editor.style.overflowY = editor.scrollHeight > editor.clientHeight + 1 ? 'auto' : 'hidden';
    }

    function openEditor(box) {
        editingId = box.id;
        selectedId = box.id;
        syncModeButtons();
        editor.hidden = false;
        editor.value = box.text || '';
        layoutEditor();
        editor.focus();
        editor.select();
    }

    function setMode(mode) {
        const box = selectedBox();
        if (!box) return;
        box.mode = mode === 'text' ? 'text' : 'object';
        persist();
        syncModeButtons();
        draw();
    }

    function deleteSelected() {
        if (selectedId == null) return;
        closeEditor(false);
        boxes = renumberBoxes(boxes.filter((box) => box.id !== selectedId));
        selectedId = null;
        persist();
        syncModeButtons();
        updateCount();
        draw();
    }

    canvas.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) return;
        if (editingId != null && event.target !== editor) closeEditor(true);
        canvas.focus({ preventScroll: true });
        const point = localPoint(event);
        nestPoint = point;
        const norm = normPoint(point);
        const handle = hitHandle(point.x, point.y);
        if (handle && selectedBox() && !selectedBox().locked) {
            drag = {
                kind: 'resize',
                pointerId: event.pointerId,
                handle,
                startNorm: norm,
                startBox: { ...selectedBox() },
                moved: false,
                origin: point
            };
        } else {
            const box = hitBox(point.x, point.y);
            if (box) {
                selectedId = box.id;
                drag = box.locked ? null : {
                    kind: 'move',
                    pointerId: event.pointerId,
                    startNorm: norm,
                    startBox: { ...box },
                    moved: false,
                    origin: point
                };
            } else {
                drag = {
                    kind: 'create',
                    pointerId: event.pointerId,
                    startNorm: norm,
                    moved: false,
                    origin: point
                };
            }
        }
        syncModeButtons();
        draw();
        canvas.setPointerCapture(event.pointerId);
    });

    function hoverCursor(point) {
        const handle = hitHandle(point.x, point.y);
        if (handle) {
            canvas.style.cursor = CURSORS[handle];
            return;
        }
        const box = hitBox(point.x, point.y);
        if (!box) canvas.style.cursor = 'crosshair';
        else if (box.locked) canvas.style.cursor = 'default';
        else canvas.style.cursor = 'move';
    }

    function gridSnap() {
        const { width, height } = logicalSize();
        return { width, height, gridPx: gridSizePx(), enabled: gridSnapOn() };
    }

    function moveDraggedBox(dx, dy) {
        const box = selectedBox();
        if (!box) return;
        const moved = snapMove(
            drag.startBox.nx + dx,
            drag.startBox.ny + dy,
            drag.startBox.nw,
            drag.startBox.nh,
            gridSnap()
        );
        box.nx = moved.nx;
        box.ny = moved.ny;
        canvas.style.cursor = 'move';
        draw();
    }

    function resizeDraggedBox(dx, dy) {
        const box = selectedBox();
        if (!box) return;
        const { minX, minY } = minNorm();
        const resized = resizeNorm(drag.startBox, drag.handle, dx, dy, minX, minY);
        const snapped = snapEdges(
            resized.nx,
            resized.ny,
            resized.nx + resized.nw,
            resized.ny + resized.nh,
            gridSnap()
        );
        if (snapped.nw < minX) snapped.nw = minX;
        if (snapped.nh < minY) snapped.nh = minY;
        if (snapped.nx + snapped.nw > 1) snapped.nx = Math.max(0, 1 - snapped.nw);
        if (snapped.ny + snapped.nh > 1) snapped.ny = Math.max(0, 1 - snapped.nh);
        Object.assign(box, snapped);
        canvas.style.cursor = CURSORS[drag.handle] || 'crosshair';
        draw();
    }

    canvas.addEventListener('pointermove', (event) => {
        const point = localPoint(event);
        nestPoint = point;
        if (drag?.pointerId !== event.pointerId) {
            hoverCursor(point);
            return;
        }
        if (Math.hypot(point.x - drag.origin.x, point.y - drag.origin.y) >= DRAG_PX) drag.moved = true;
        const norm = normPoint(point);
        drag.current = norm;
        const dx = norm.x - drag.startNorm.x;
        const dy = norm.y - drag.startNorm.y;
        if (drag.kind === 'move' && drag.moved) {
            moveDraggedBox(dx, dy);
        } else if (drag.kind === 'resize' && drag.moved) {
            resizeDraggedBox(dx, dy);
        } else if (drag.kind === 'create') {
            canvas.style.cursor = 'crosshair';
            draw();
        }
    });

    function finishCreate(norm) {
        if (!drag.moved) {
            selectedId = null;
            return;
        }
        const { minX, minY } = minNorm();
        const start = snappedPoint(drag.startNorm);
        const end = snappedPoint(norm);
        const nx = Math.min(start.x, end.x);
        const ny = Math.min(start.y, end.y);
        const nw = Math.abs(end.x - start.x);
        const nh = Math.abs(end.y - start.y);
        if (nw < minX || nh < minY) {
            selectedId = null;
            return;
        }
        const id = nextBoxId(boxes);
        if (id == null) {
            flashFull();
            return;
        }
        boxes.push({ id, nx, ny, nw, nh, mode: 'object', text: '' });
        selectedId = id;
        persist();
        updateCount();
    }

    function finishDrag(event) {
        if (drag?.pointerId !== event.pointerId) return;
        if (drag.kind === 'create') {
            finishCreate(normPoint(localPoint(event)));
        } else if (drag.moved) {
            persist();
        }
        drag = null;
        syncModeButtons();
        draw();
    }

    canvas.addEventListener('pointerup', finishDrag);
    canvas.addEventListener('pointercancel', finishDrag);
    canvas.addEventListener('dblclick', (event) => {
        const point = localPoint(event);
        const box = hitBox(point.x, point.y);
        if (!box) return;
        drag = null;
        openEditor(box);
    });

    editor.addEventListener('input', () => {
        layoutEditor();
    });
    editor.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            closeEditor(false);
        } else if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            event.stopPropagation();
            closeEditor(true);
        }
    });
    editor.addEventListener('blur', () => {
        if (editingId != null) closeEditor(true);
    });

    objectButton?.addEventListener('click', () => {
        closeEditor(true);
        setMode('object');
    });
    textButton?.addEventListener('click', () => {
        closeEditor(true);
        setMode('text');
    });

    window.addEventListener('keydown', (event) => {
        if (isTypingTarget(event.target) || isTypingTarget(document.activeElement)) return;
        if (event.key === 'Delete') {
            if (selectedId == null) return;
            event.preventDefault();
            deleteSelected();
            return;
        }
        if (document.activeElement !== canvas) return;
        if (event.key === 'Tab') {
            event.preventDefault();
            cycleNested(event.shiftKey ? -1 : 1);
            return;
        }
        if (event.key === 'Enter' && selectedBox()) {
            event.preventDefault();
            openEditor(selectedBox());
        }
    });

    const previewSource = '.prompt-common, .prompt-positive, .prompt-exclude, .jsonlist-container, .add-lora-container, .dropdown-character, .dropdown-view, .generate-tag-assist';
    const onPreviewSource = (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        if (!target.closest(previewSource)) return;
        schedulePreview();
    };
    document.addEventListener('input', onPreviewSource, true);
    document.addEventListener('change', onPreviewSource, true);
    document.addEventListener('click', onPreviewSource, true);

    const host = stage.parentElement;
    if (host && typeof ResizeObserver !== 'undefined') {
        const observer = new ResizeObserver(() => syncCanvas());
        observer.observe(host);
        for (const id of ['left', 'right', 'full-width']) {
            const column = document.getElementById(id);
            if (column) observer.observe(column);
        }
    }
    window.addEventListener('resize', () => syncCanvas());
    new MutationObserver(() => draw()).observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme']
    });

    const addButton = document.getElementById('bounding-add');
    const clearButton = document.getElementById('bounding-clear');
    const plateButton = document.getElementById('bounding-plate');
    const lockButton = document.getElementById('bounding-lock');
    const colorInput = document.getElementById('bounding-color');
    const swatchHost = document.getElementById('bounding-swatches');

    function defaultAddRect() {
        const size = 0.25;
        let nx = 0.375;
        let ny = 0.375;
        const start = snappedPoint({ x: nx, y: ny });
        const end = snappedPoint({ x: nx + size, y: ny + size });
        let left = clamp01(Math.min(start.x, end.x));
        let top = clamp01(Math.min(start.y, end.y));
        let right = clamp01(Math.max(start.x, end.x));
        let bottom = clamp01(Math.max(start.y, end.y));
        let nw = Math.max(right - left, minNorm().minX);
        let nh = Math.max(bottom - top, minNorm().minY);
        if (left + nw > 1) left = Math.max(0, 1 - nw);
        if (top + nh > 1) top = Math.max(0, 1 - nh);
        const nudge = 0.04;
        for (let step = 0; step < 16; step += 1) {
            const candidate = { nx: left, ny: top, nw, nh };
            if (!boxes.some((box) => sameRect(box, candidate))) return candidate;
            left = clamp01(left + nudge);
            top = clamp01(top + nudge);
            if (left + nw > 1) left = 0;
            if (top + nh > 1) top = 0;
        }
        return { nx: left, ny: top, nw, nh };
    }

    addButton?.addEventListener('click', () => {
        const id = nextBoxId(boxes);
        if (id == null) {
            flashFull();
            return;
        }
        const rect = defaultAddRect();
        boxes.push({ id, ...rect, mode: 'object', text: '' });
        selectedId = id;
        persist();
        syncModeButtons();
        updateCount();
        draw();
    });

    function syncColorControl() {
        const box = selectedBox();
        const hex = rgbToHex(boxColor(box || { mode: 'object' }));
        if (colorInput) {
            colorInput.disabled = !box;
            if (document.activeElement !== colorInput) colorInput.value = hex;
        }
        swatchHost?.querySelectorAll('.bounding-swatch').forEach((button) => {
            button.disabled = !box;
            button.classList.toggle('is-on', Boolean(box) && button.dataset.color === hex);
        });
    }

    function paintColor(hex) {
        const box = selectedBox();
        const color = normalizeColor(hex);
        if (!box || !color) return;
        box.color = color;
        persist();
        syncColorControl();
        draw();
    }

    if (swatchHost) {
        swatchHost.replaceChildren();
        for (const color of PALETTE) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'bounding-swatch';
            button.dataset.color = color;
            button.style.background = color;
            button.addEventListener('click', () => paintColor(color));
            swatchHost.appendChild(button);
        }
    }

    colorInput?.addEventListener('input', () => {
        const box = selectedBox();
        const color = normalizeColor(colorInput.value);
        if (!box || !color) return;
        box.color = color;
        syncColorControl();
        draw();
    });
    colorInput?.addEventListener('change', () => {
        if (selectedBox()?.color) persist();
    });

    function syncPlateControls() {
        const lang = currentLang();
        const active = Boolean(plateImage) || platePending;
        if (plateButton) {
            plateButton.textContent = active
                ? (lang.bounding_plate_clear || 'Clear plate')
                : (lang.bounding_plate || 'Plate');
            plateButton.classList.toggle('is-on', active);
        }
        const root = document.querySelector('.bounding-plate-opacity');
        if (!root) return;
        root.classList.toggle('is-disabled', !plateImage);
        root.querySelectorAll('input').forEach((input) => {
            input.disabled = !plateImage;
        });
    }

    function clearPlate() {
        plateToken += 1;
        platePending = false;
        plateImage = null;
        syncPlateControls();
        draw();
    }

    function loadPlate(src) {
        const token = plateToken + 1;
        plateToken = token;
        platePending = true;
        plateImage = null;
        syncPlateControls();
        const image = new Image();
        image.onload = () => {
            if (token !== plateToken) return;
            platePending = false;
            plateImage = image;
            syncPlateControls();
            draw();
        };
        image.onerror = () => {
            if (token !== plateToken) return;
            platePending = false;
            plateImage = null;
            syncPlateControls();
            draw();
        };
        image.src = src;
    }

    plateButton?.addEventListener('click', async () => {
        if (plateImage || platePending) {
            clearPlate();
            return;
        }
        const src = String(globalThis.mainGallery?.getDisplayedImage?.() || '').trim();
        if (!src) {
            const lang = currentLang();
            await showDialog('info', {
                message: lang.bounding_plate_empty || 'The gallery has no image to load.',
                buttonText: lang.setup_ok || 'OK'
            });
            return;
        }
        loadPlate(src);
    });

    lockButton?.addEventListener('click', () => {
        const box = selectedBox();
        if (!box) return;
        if (box.locked) delete box.locked;
        else box.locked = true;
        persist();
        syncModeButtons();
        draw();
    });

    clearButton?.addEventListener('click', async () => {
        if (boxes.length === 0) return;
        const lang = currentLang();
        const hasUnlocked = boxes.some((box) => !box.locked);
        const hasLocked = boxes.some((box) => box.locked);
        let message = lang.bounding_clear_confirm || 'Clear all boxes?';
        if (hasUnlocked && hasLocked) message = lang.bounding_clear_unlocked || message;
        else if (!hasUnlocked) message = lang.bounding_clear_locked || message;
        const confirmed = await showDialog('confirm', {
            message,
            yesText: lang.setup_yes || 'Yes',
            noText: lang.setup_no || 'No'
        });
        if (!confirmed) return;
        const selected = selectedBox();
        const kept = boxesAfterClear(boxes);
        const keepIndex = selected && kept.includes(selected) ? kept.indexOf(selected) : -1;
        closeEditor(false);
        boxes = renumberBoxes(kept);
        selectedId = keepIndex >= 0 ? keepIndex + 1 : null;
        persist();
        syncModeButtons();
        updateCount();
        draw();
    });

    const stored = globalThis.globalSettings || {};
    const initialGrid = clampGridSize(stored.bounding_grid_size);
    snapBox = setupCheckbox(
        'bounding-grid-snap',
        currentLang().bounding_grid_snap || 'Snap',
        Boolean(stored.bounding_grid_snap),
        true,
        (value) => {
            if (globalThis.globalSettings) globalThis.globalSettings.bounding_grid_snap = value;
            draw();
        }
    );
    gridSlider = setupSlider(
        'bounding-grid-size',
        currentLang().bounding_grid_size || 'Grid',
        { min: GRID_MIN, max: GRID_MAX, step: 8, defaultValue: initialGrid, inline: true },
        (value) => {
            if (globalThis.globalSettings) globalThis.globalSettings.bounding_grid_size = value;
            draw();
        }
    );
    const initialOpacity = clampPlateOpacity(stored.bounding_plate_opacity);
    plateSlider = setupSlider(
        'bounding-plate-opacity',
        currentLang().bounding_plate_opacity || 'Opacity',
        { min: 0, max: 100, step: 1, defaultValue: initialOpacity, inline: true },
        (value) => {
            if (globalThis.globalSettings) globalThis.globalSettings.bounding_plate_opacity = clampPlateOpacity(value);
            draw();
        }
    );

    function applyToolSettings() {
        const next = globalThis.globalSettings || {};
        snapBox?.setValue(Boolean(next.bounding_grid_snap));
        const size = clampGridSize(next.bounding_grid_size);
        if (gridSlider && gridSlider.getValue() !== size) gridSlider.setValue(size);
        const opacity = clampPlateOpacity(next.bounding_plate_opacity);
        if (plateSlider && plateSlider.getValue() !== opacity) plateSlider.setValue(opacity);
        syncPlateControls();
        syncColorControl();
        draw();
    }

    setLanguage();
    syncModeButtons();
    syncCanvas();

    return {
        syncCanvas,
        setLanguage,
        applyToolSettings,
        getBoxes: () => boxes.map((box) => ({ ...box })),
        refreshPreview,
        invalidatePreview,
        setPreview,
        setBoxes: (raw) => {
            closeEditor(false);
            boxes = normalizeBoundingBoxes(raw);
            if (!boxes.some((box) => box.id === selectedId)) selectedId = null;
            persist();
            syncModeButtons();
            updateCount();
            draw();
        },
        setPlate: (src) => {
            const next = String(src || '').trim();
            if (!next) return false;
            loadPlate(next);
            return true;
        }
    };
}
