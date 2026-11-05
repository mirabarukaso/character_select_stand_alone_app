import { parseTaggedContent } from './components/myTextbox.js';
import { setupCheckbox } from './components/myCheckbox.js';
import { composeFullPromptPreview } from './generate.js';

const LAYER_ID = 'prompt-full-preview-layer';
const GAP = 8;

function ensureLayer() {
    let layer = document.getElementById(LAYER_ID);
    if (layer) return layer;

    layer = document.createElement('div');
    layer.id = LAYER_ID;
    layer.className = 'prompt-full-preview-layer';
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

    const layerWidth = layer.offsetWidth || 480;
    const layerHeight = layer.offsetHeight || 240;
    const maxLeft = Math.max(GAP, globalThis.innerWidth - layerWidth - GAP);
    const maxTop = Math.max(GAP, globalThis.innerHeight - layerHeight - GAP);

    let left = rect.left;
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

function hideLayer() {
    const layer = document.getElementById(LAYER_ID);
    if (!layer) return;
    layer.classList.remove('is-pinned');
    layer.hidden = true;
    layer.style.visibility = '';
    layer.innerHTML = '';
    layer.setAttribute('aria-hidden', 'true');
}

function readPromptFontSize() {
    const fromControl = Number(globalThis.prompt?.fontSize?.getValue?.());
    if (Number.isFinite(fromControl) && fromControl > 0) return fromControl;
    const fromSettings = Number(globalThis.globalSettings?.ptompt_textbox_fontsize);
    if (Number.isFinite(fromSettings) && fromSettings > 0) return fromSettings;
    return 14;
}

function showLayer(anchor, pinned) {
    const layer = ensureLayer();
    const content = composeFullPromptPreview();
    layer.innerHTML = `<pre class="prompt-full-preview-pre">${parseTaggedContent(content || '')}</pre>`;
    const pre = layer.querySelector('.prompt-full-preview-pre');
    if (pre) {
        pre.style.fontSize = `${readPromptFontSize()}px`;
        pre.style.lineHeight = '1.4';
    }
    layer.classList.toggle('is-pinned', Boolean(pinned));
    layer.setAttribute('aria-hidden', 'false');
    placeLayer(layer, anchor);
}

export function setupFullPromptPreview(containerId, spanText = 'full prompt preview') {
    let pinned = false;

    const checkbox = setupCheckbox(containerId, spanText, false, true, (checked) => {
        pinned = Boolean(checked);
        const container = document.querySelector(`.${containerId}`);
        if (!container) return;
        if (pinned) {
            showLayer(container, true);
        } else {
            hideLayer();
        }
    });

    const container = document.querySelector(`.${containerId}`);
    if (!container) {
        return checkbox || {
            setTitle: () => {},
            setValue: () => {},
            getValue: () => false
        };
    }

    container.classList.add('prompt-textbox-full-preview-host');

    const label = container.querySelector(`.myCheckbox-${containerId}-span`);
    const hoverTarget = label || container;

    hoverTarget.addEventListener('pointerenter', () => {
        showLayer(container, pinned);
    });
    hoverTarget.addEventListener('pointerleave', () => {
        if (!pinned) hideLayer();
    });

    return {
        setTitle: (text) => checkbox?.setTitle?.(text),
        getValue: () => Boolean(checkbox?.getValue?.()),
        setValue: (value) => {
            const next = Boolean(value);
            checkbox?.setValue?.(next);
            pinned = next;
            if (next) {
                showLayer(container, true);
            } else {
                hideLayer();
            }
        }
    };
}
