/**
 * Gallery A|B compare controller.
 * Pins are either gallery indices or external (Image Info) payloads.
 * External pins are never pushed into the gallery queue; exit clears them.
 */

function langDict() {
    const settings = globalThis.globalSettings || {};
    return globalThis.cachedFiles?.language?.[settings.language] || {};
}

function cloneExternal(payload) {
    if (!payload?.image) return null;
    return {
        kind: 'external',
        image: payload.image,
        seed: payload.seed == null || payload.seed === '' ? '-1' : String(payload.seed),
        tags: payload.tags == null ? '' : String(payload.tags),
        info: payload.info == null ? '' : String(payload.info),
        label: payload.label || ''
    };
}

function galleryPin(index) {
    if (!Number.isInteger(index) || index < 0) return null;
    return { kind: 'gallery', index };
}

function adjustGalleryPinIndex(pin, removedIndex) {
    if (pin?.kind !== 'gallery') return pin;
    if (pin.index === removedIndex) return null;
    if (pin.index > removedIndex) return galleryPin(pin.index - 1);
    return pin;
}

function fitContain(ar, stageW, stageH) {
    if (!Number.isFinite(ar) || ar <= 0 || stageW <= 0 || stageH <= 0) {
        return { w: stageW, h: stageH };
    }
    let w = stageW;
    let h = stageW / ar;
    if (h > stageH) {
        h = stageH;
        w = stageH * ar;
    }
    return { w, h };
}

function createComparePane(side) {
    const pane = document.createElement('div');
    pane.className = `cg-compare-pane cg-compare-pane-${side}`;
    const world = document.createElement('div');
    world.className = 'cg-compare-world';
    const layer = document.createElement('div');
    layer.className = 'cg-compare-layer';
    const img = document.createElement('img');
    img.alt = side.toUpperCase();
    img.draggable = false;
    layer.appendChild(img);
    world.appendChild(layer);
    pane.appendChild(world);
    return pane;
}

function applySliderPanes(paneA, paneB, divider, split, axis) {
    const vertical = axis === 'y';
    if (paneA) {
        paneA.style.visibility = 'visible';
        paneA.style.clipPath = vertical
            ? `inset(0 0 ${(1 - split) * 100}% 0)`
            : `inset(0 ${(1 - split) * 100}% 0 0)`;
    }
    if (paneB) {
        paneB.style.visibility = 'visible';
        paneB.style.clipPath = vertical
            ? `inset(${split * 100}% 0 0 0)`
            : `inset(0 0 0 ${split * 100}%)`;
    }
    if (divider) {
        divider.style.display = '';
        divider.classList.toggle('is-vertical-split', vertical);
        if (vertical) {
            divider.style.left = '';
            divider.style.top = `${split * 100}%`;
        } else {
            divider.style.top = '';
            divider.style.left = `${split * 100}%`;
        }
    }
}

function applyTogglePanes(paneA, paneB, divider, showA) {
    if (paneA) {
        paneA.style.visibility = showA ? 'visible' : 'hidden';
        paneA.style.clipPath = 'none';
    }
    if (paneB) {
        paneB.style.visibility = showA ? 'hidden' : 'visible';
        paneB.style.clipPath = 'none';
    }
    if (divider) divider.style.display = 'none';
}

export function createGalleryCompare(host) {
    let pinA = null;
    let pinB = null;
    let isCompareMode = false;
    let isCompareFullscreen = false;
    let compareInteraction = 'slider'; // 'slider' | 'toggle'
    let compareSplitAxis = 'x'; // 'x' left-right | 'y' top-bottom
    let compareToggleShowA = true;
    let compareTransform = { x: 0, y: 0, scale: 1 };
    let compareSplit = 0.5;
    let overlayEl = null;
    let keyHandler = null;
    let dragState = null;
    let wheelGuard = null;

    function getImages() { return host.getImages(); }
    function getSeeds() { return host.getSeeds(); }
    function getTags() { return host.getTags(); }
    function getInfos() { return host.getInfos(); }

    function pinValid(pin) {
        if (!pin) return false;
        if (pin.kind === 'external') return Boolean(pin.image);
        if (pin.kind === 'gallery') {
            const images = getImages();
            return pin.index >= 0 && pin.index < images.length && Boolean(images[pin.index]);
        }
        return false;
    }

    function resolveImage(pin) {
        if (!pinValid(pin)) return '';
        if (pin.kind === 'external') return pin.image;
        return getImages()[pin.index] || '';
    }

    function resolveMeta(pin) {
        if (!pinValid(pin)) return { seed: '', tags: '', info: '', image: '' };
        if (pin.kind === 'external') {
            return { seed: pin.seed, tags: pin.tags, info: pin.info, image: pin.image };
        }
        const i = pin.index;
        return {
            seed: getSeeds()[i] || '',
            tags: getTags()[i] || '',
            info: getInfos()[i] || '',
            image: getImages()[i] || ''
        };
    }

    function bothPinsReady() {
        return pinValid(pinA) && pinValid(pinB);
    }

    function clearAllPins() {
        pinA = null;
        pinB = null;
    }

    function getStagingState() {
        const aOk = pinValid(pinA);
        const bOk = pinValid(pinB);
        if (isCompareMode && aOk && bOk) return 'compare';
        if (aOk && !bOk) return 'hasA';
        if (!aOk && bOk) return 'hasB';
        if (aOk && bOk) return 'ready';
        return 'empty';
    }

    function syncChromeButton() {
        host.updateCompareChromeButton?.(getStagingState(), isCompareMode, compareInteraction);
        host.updateSwitchModeButtonLabel?.();
    }

    function syncMetaVisibility() {
        host.setCompareMetaVisible?.(isCompareMode);
        host.updateMetaButtonsLayout?.();
    }

    function applyLayerTransforms() {
        if (!overlayEl) return;
        const { x, y, scale } = compareTransform;
        const transform = `translate(${x}px, ${y}px) scale(${scale})`;
        for (const world of overlayEl.querySelectorAll('.cg-compare-world')) {
            world.style.transform = transform;
        }
    }

    function layoutCompareImages() {
        if (!overlayEl) return;
        const stage = overlayEl.querySelector('.cg-compare-stage');
        const imgA = overlayEl.querySelector('.cg-compare-pane-a img');
        const imgB = overlayEl.querySelector('.cg-compare-pane-b img');
        if (!stage || !imgA || !imgB) return;
        if (!imgA.naturalWidth || !imgB.naturalWidth) return;

        const stageW = stage.clientWidth;
        const stageH = stage.clientHeight;
        if (stageW <= 0 || stageH <= 0) return;

        // Worlds must match stage size so screen-space pane clips stay aligned after pan/zoom.
        for (const world of overlayEl.querySelectorAll('.cg-compare-world')) {
            world.style.width = `${stageW}px`;
            world.style.height = `${stageH}px`;
        }

        const arA = imgA.naturalWidth / imgA.naturalHeight;
        const arB = imgB.naturalWidth / imgB.naturalHeight;
        const sameAR = Math.abs(arA - arB) / Math.max(arA, arB) < 0.02;

        let sizeA = fitContain(arA, stageW, stageH);
        let sizeB = fitContain(arB, stageW, stageH);
        if (sameAR) {
            const shared = fitContain(arA, stageW, stageH);
            sizeA = shared;
            sizeB = shared;
        }

        for (const [img, size] of [[imgA, sizeA], [imgB, sizeB]]) {
            img.style.width = `${size.w}px`;
            img.style.height = `${size.h}px`;
            img.style.maxWidth = 'none';
            img.style.maxHeight = 'none';
            img.style.objectFit = 'fill';
        }
    }

    function updateSwapToggleButton() {
        const btn = overlayEl?.querySelector('.cg-compare-swap');
        if (!btn) return;
        const LANG = langDict();
        btn.classList.remove('is-side-indicator', 'is-side-a', 'is-side-b');
        if (compareInteraction === 'toggle') {
            btn.textContent = compareToggleShowA ? 'A' : 'B';
            btn.title = LANG.gallery_compare_tool_show_side || 'Toggle A/B';
            btn.classList.add('is-side-indicator', compareToggleShowA ? 'is-side-a' : 'is-side-b');
        } else {
            btn.textContent = LANG.gallery_compare_tool_swap || 'Swap';
            btn.title = LANG.right_menu_compare_swap || 'Swap A/B';
        }
    }

    function applyInteractionMode() {
        if (!overlayEl) return;
        overlayEl.dataset.interaction = compareInteraction;
        overlayEl.classList.toggle('is-slider', compareInteraction === 'slider');
        overlayEl.classList.toggle('is-toggle', compareInteraction === 'toggle');

        const paneA = overlayEl.querySelector('.cg-compare-pane-a');
        const paneB = overlayEl.querySelector('.cg-compare-pane-b');
        const divider = overlayEl.querySelector('.cg-compare-divider');

        if (compareInteraction === 'slider') {
            applySliderPanes(paneA, paneB, divider, compareSplit, compareSplitAxis);
        } else {
            applyTogglePanes(paneA, paneB, divider, compareToggleShowA);
        }
        updateSwapToggleButton();
        updateAxisButton();
        syncChromeButton();
    }

    function updateAxisButton() {
        const btn = overlayEl?.querySelector('.cg-compare-axis');
        if (!btn) return;
        const LANG = langDict();
        const isSlider = compareInteraction === 'slider';
        btn.style.display = isSlider ? '' : 'none';
        if (!isSlider) return;
        const vertical = compareSplitAxis === 'y';
        btn.textContent = vertical
            ? (LANG.gallery_compare_tool_axis_v || '↕')
            : (LANG.gallery_compare_tool_axis_h || '↔');
        btn.title = vertical
            ? (LANG.gallery_compare_tool_axis_v_tip || 'Top / bottom split')
            : (LANG.gallery_compare_tool_axis_h_tip || 'Left / right split');
        btn.classList.toggle('is-axis-y', vertical);
        btn.classList.toggle('is-axis-x', !vertical);
    }

    function refreshOverlayImages() {
        if (!overlayEl) return;
        const imgA = overlayEl.querySelector('.cg-compare-pane-a img');
        const imgB = overlayEl.querySelector('.cg-compare-pane-b img');
        const srcA = resolveImage(pinA);
        const srcB = resolveImage(pinB);

        const afterLoad = () => {
            layoutCompareImages();
            applyLayerTransforms();
            applyInteractionMode();
        };

        let pending = 0;
        const watch = (img, src) => {
            if (!img) return;
            if (img.src === src && img.naturalWidth) return;
            pending += 1;
            img.onload = () => {
                pending -= 1;
                if (pending <= 0) afterLoad();
            };
            img.src = src;
        };

        watch(imgA, srcA);
        watch(imgB, srcB);
        if (pending <= 0) afterLoad();
        host.refreshCompareMetaButtons?.();
    }

    function resetTransform() {
        compareTransform = { x: 0, y: 0, scale: 1 };
        applyLayerTransforms();
    }

    function swapPins() {
        const tmp = pinA;
        pinA = pinB;
        pinB = tmp;
        refreshOverlayImages();
    }

    function setSplitDragging(active) {
        overlayEl?.classList.toggle('is-dragging-split', active);
    }

    function bindPanZoom(stage, overlay) {
        const onWheel = (e) => {
            e.preventDefault();
            e.stopPropagation();
            compareTransform.scale += e.deltaY * -0.001;
            compareTransform.scale = Math.min(Math.max(0.5, compareTransform.scale), 4);
            applyLayerTransforms();
        };
        // Capture on overlay so page/layout under gallery cannot scroll/resize.
        overlay.addEventListener('wheel', onWheel, { passive: false, capture: true });

        stage.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            if (e.target.closest('.cg-compare-divider') || e.target.closest('.cg-compare-toolbar')) return;
            e.preventDefault();
            dragState = {
                type: 'pan',
                startX: e.clientX,
                startY: e.clientY,
                originX: compareTransform.x,
                originY: compareTransform.y,
                moved: false
            };
            stage.style.cursor = 'grabbing';
        });

        wheelGuard = onWheel;
    }

    function bindDivider(divider, stage) {
        divider.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            e.stopPropagation();
            dragState = { type: 'split' };
            setSplitDragging(true);
        });

        const onMove = (e) => {
            if (!dragState) return;
            if (dragState.type === 'pan') {
                const dx = e.clientX - dragState.startX;
                const dy = e.clientY - dragState.startY;
                if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragState.moved = true;
                compareTransform.x = dragState.originX + dx;
                compareTransform.y = dragState.originY + dy;
                applyLayerTransforms();
                return;
            }
            if (dragState.type === 'split' && stage) {
                const rect = stage.getBoundingClientRect();
                if (compareSplitAxis === 'y') {
                    if (rect.height <= 0) return;
                    compareSplit = Math.min(0.95, Math.max(0.05, (e.clientY - rect.top) / rect.height));
                } else {
                    if (rect.width <= 0) return;
                    compareSplit = Math.min(0.95, Math.max(0.05, (e.clientX - rect.left) / rect.width));
                }
                applyInteractionMode();
            }
        };
        const onUp = () => {
            if (!dragState) return;
            const wasPanClick = dragState.type === 'pan' && !dragState.moved;
            const wasSplit = dragState.type === 'split';
            dragState = null;
            if (wasSplit) setSplitDragging(false);
            if (overlayEl) {
                const st = overlayEl.querySelector('.cg-compare-stage');
                if (st) st.style.cursor = 'grab';
            }
            if (wasPanClick && compareInteraction === 'toggle') {
                compareToggleShowA = !compareToggleShowA;
                applyInteractionMode();
            }
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        overlayEl._compareCleanupDrag = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            if (wheelGuard && overlayEl) {
                overlayEl.removeEventListener('wheel', wheelGuard, { capture: true });
            }
            wheelGuard = null;
        };
    }

    function buildToolbar(overlay) {
        const toolbar = document.createElement('div');
        toolbar.className = 'cg-compare-toolbar';
        const LANG = langDict();

        const fullscreenBtn = document.createElement('button');
        fullscreenBtn.type = 'button';
        fullscreenBtn.className = 'cg-compare-tool-btn cg-compare-fullscreen-btn';
        // Label = action to take next: window mode offers Full, fullscreen offers Window.
        fullscreenBtn.textContent = isCompareFullscreen
            ? (LANG.gallery_compare_tool_window || 'Window')
            : (LANG.gallery_compare_tool_full || 'Full');
        fullscreenBtn.title = isCompareFullscreen ? 'Exit fullscreen' : 'Fullscreen';
        fullscreenBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (isCompareFullscreen) demoteToGallery();
            else promoteFullscreen();
        });

        const axisBtn = document.createElement('button');
        axisBtn.type = 'button';
        axisBtn.className = 'cg-compare-tool-btn cg-compare-axis';
        axisBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (compareInteraction !== 'slider') return;
            compareSplitAxis = compareSplitAxis === 'x' ? 'y' : 'x';
            applyInteractionMode();
        });

        const swapBtn = document.createElement('button');
        swapBtn.type = 'button';
        swapBtn.className = 'cg-compare-tool-btn cg-compare-swap';
        swapBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (compareInteraction === 'toggle') {
                compareToggleShowA = !compareToggleShowA;
                applyInteractionMode();
            } else {
                swapPins();
            }
        });

        const resetBtn = document.createElement('button');
        resetBtn.type = 'button';
        resetBtn.className = 'cg-compare-tool-btn cg-compare-reset';
        resetBtn.textContent = LANG.gallery_compare_tool_reset || '1:1';
        resetBtn.title = 'Reset zoom';
        resetBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            resetTransform();
        });

        toolbar.append(fullscreenBtn, axisBtn, swapBtn, resetBtn);
        overlay.append(toolbar);
        updateSwapToggleButton();
        updateAxisButton();
    }

    // eslint-disable-next-line sonarjs/cognitive-complexity
    function handleCompareKeyDown(e) {
        if (!isCompareMode) return;
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

        if (e.key === 'Escape') {
            e.preventDefault();
            if (isCompareFullscreen) demoteToGallery();
            else exitCompareMode();
            return;
        }

        if ((e.key === ' ' || e.key === 't' || e.key === 'T') && compareInteraction === 'toggle') {
            e.preventDefault();
            compareToggleShowA = !compareToggleShowA;
            applyInteractionMode();
            return;
        }

        const isArrow = e.key === 'ArrowLeft' || e.key === 'ArrowRight'
            || e.key === 'ArrowUp' || e.key === 'ArrowDown';
        if (!isArrow) return;
        e.preventDefault();
        if (compareInteraction === 'toggle') {
            compareToggleShowA = e.key === 'ArrowLeft' || e.key === 'ArrowUp';
        } else if (compareSplitAxis === 'y') {
            if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
            const delta = e.key === 'ArrowUp' ? -0.02 : 0.02;
            compareSplit = Math.min(0.95, Math.max(0.05, compareSplit + delta));
        } else {
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
            const delta = e.key === 'ArrowLeft' ? -0.02 : 0.02;
            compareSplit = Math.min(0.95, Math.max(0.05, compareSplit + delta));
        }
        applyInteractionMode();
    }

    function mountOverlay(fullscreen) {
        destroyOverlayDom(false);
        isCompareFullscreen = fullscreen;

        const overlay = document.createElement('div');
        overlay.className = `cg-compare-overlay ${fullscreen ? 'is-fullscreen' : 'is-embedded'}`;
        overlay.dataset.interaction = compareInteraction;

        const stage = document.createElement('div');
        stage.className = 'cg-compare-stage';
        stage.style.cursor = 'grab';

        const paneA = createComparePane('a');
        const paneB = createComparePane('b');

        const divider = document.createElement('div');
        divider.className = 'cg-compare-divider';
        divider.innerHTML = '<span class="cg-compare-divider-line"></span><span class="cg-compare-divider-handle"></span>';

        stage.append(paneA, paneB, divider);
        overlay.appendChild(stage);
        buildToolbar(overlay);

        if (fullscreen) {
            document.body.appendChild(overlay);
        } else {
            const preview = host.container.querySelector('.cg-minimized-generation-preview-container');
            if (preview) preview.before(overlay);
            else host.container.appendChild(overlay);
        }

        overlayEl = overlay;
        host.container?.classList.toggle('cg-compare-active', true);
        bindPanZoom(stage, overlay);
        bindDivider(divider, stage);

        const ro = new ResizeObserver(() => layoutCompareImages());
        ro.observe(stage);
        overlayEl._compareResizeObserver = ro;

        refreshOverlayImages();

        if (keyHandler) document.removeEventListener('keydown', keyHandler);
        keyHandler = handleCompareKeyDown;
        document.addEventListener('keydown', keyHandler);
    }

    function destroyOverlayDom(keepState) {
        if (overlayEl?._compareCleanupDrag) overlayEl._compareCleanupDrag();
        if (overlayEl?._compareResizeObserver) overlayEl._compareResizeObserver.disconnect();
        if (overlayEl) overlayEl.remove();
        overlayEl = null;
        if (!isCompareMode) host.container?.classList.remove('cg-compare-active');
        if (!keepState && keyHandler) {
            document.removeEventListener('keydown', keyHandler);
            keyHandler = null;
        }
    }

    function enterCompareMode() {
        if (!bothPinsReady()) return false;
        document.querySelector('.cg-fullscreen-overlay')?.remove();

        isCompareMode = true;
        compareInteraction = 'slider';
        compareSplitAxis = 'x';
        compareTransform = { x: 0, y: 0, scale: 1 };
        compareSplit = 0.5;
        compareToggleShowA = true;
        mountOverlay(false);
        syncMetaVisibility();
        syncChromeButton();
        host.onCompareModeChanged?.(true);
        host.notifyHiresButton?.();
        return true;
    }

    function exitCompareMode() {
        const was = isCompareMode;
        isCompareMode = false;
        isCompareFullscreen = false;
        destroyOverlayDom(false);
        host.container?.classList.remove('cg-compare-active');
        clearAllPins();
        syncMetaVisibility();
        syncChromeButton();
        if (was) host.onCompareModeChanged?.(false);
        host.notifyHiresButton?.();
    }

    function promoteFullscreen() {
        if (!isCompareMode || !bothPinsReady()) return;
        mountOverlay(true);
        syncChromeButton();
        syncMetaVisibility();
        host.onCompareFullscreenChanged?.(true);
    }

    function demoteToGallery() {
        if (!isCompareMode || !bothPinsReady()) return;
        mountOverlay(false);
        syncChromeButton();
        syncMetaVisibility();
        host.onCompareFullscreenChanged?.(false);
    }

    function toggleCompareInteraction() {
        if (!isCompareMode) return;
        compareInteraction = compareInteraction === 'slider' ? 'toggle' : 'slider';
        if (compareInteraction === 'slider') compareSplitAxis = 'x';
        applyInteractionMode();
        host.updateSwitchModeButtonLabel?.();
    }

    function tryEnterIfReady() {
        if (bothPinsReady() && !isCompareMode) enterCompareMode();
        else {
            syncChromeButton();
            if (isCompareMode) refreshOverlayImages();
        }
    }

    function setCompareImage(slot, index) {
        const pin = galleryPin(Number(index));
        if (!pin || !pinValid(pin)) return false;
        if (slot === 'A' || slot === 'a') pinA = pin;
        else pinB = pin;
        tryEnterIfReady();
        syncChromeButton();
        return true;
    }

    function setCompareExternal(slot, payload) {
        const pin = cloneExternal(payload);
        if (!pin) return { ok: false, reason: 'empty' };
        const target = slot === 'A' || slot === 'a' ? 'A' : 'B';
        if (target === 'A') pinA = pin;
        else pinB = pin;
        tryEnterIfReady();
        syncChromeButton();
        return { ok: true, slot: target };
    }

    function fillNextExternal(payload) {
        if (!pinValid(pinA)) return setCompareExternal('A', payload);
        if (!pinValid(pinB)) return setCompareExternal('B', payload);
        return { ok: false, reason: 'full' };
    }

    function setCompareFromDisplayed(slot) {
        const index = host.getDisplayedIndex();
        if (index < 0 || index >= getImages().length) return false;
        return setCompareImage(slot, index);
    }

    function cycleCompareChromeButton() {
        if (isCompareMode) {
            exitCompareMode();
            return 'exited';
        }
        const state = getStagingState();
        if (state === 'empty' || state === 'hasB') {
            if (!setCompareFromDisplayed('A')) return 'noop';
            return 'setA';
        }
        if (state === 'hasA' || state === 'ready') {
            if (!setCompareFromDisplayed('B')) return 'noop';
            if (bothPinsReady()) enterCompareMode();
            return 'setB';
        }
        return 'noop';
    }

    function onImageRemoved(removedIndex) {
        const prevA = pinA;
        const prevB = pinB;
        pinA = adjustGalleryPinIndex(pinA, removedIndex);
        pinB = adjustGalleryPinIndex(pinB, removedIndex);

        const lostPin = (prevA && !pinValid(pinA)) || (prevB && !pinValid(pinB));
        if (isCompareMode && (!bothPinsReady() || lostPin)) {
            exitCompareMode();
            return;
        }
        if (!pinValid(pinA) && prevA) pinA = null;
        if (!pinValid(pinB) && prevB) pinB = null;
        syncChromeButton();
        if (isCompareMode) refreshOverlayImages();
    }

    function onGalleryCleared() {
        exitCompareMode();
        clearAllPins();
        syncChromeButton();
    }

    function getEmphasizedImage() {
        if (!isCompareMode) return '';
        if (compareInteraction === 'toggle') {
            return resolveImage(compareToggleShowA ? pinA : pinB);
        }
        return resolveImage(pinA) || resolveImage(pinB);
    }

    function updateLanguage() {
        if (!overlayEl) {
            syncChromeButton();
            return;
        }
        const LANG = langDict();
        const fullscreenBtn = overlayEl.querySelector('.cg-compare-fullscreen-btn');
        if (fullscreenBtn) {
            fullscreenBtn.textContent = isCompareFullscreen
                ? (LANG.gallery_compare_tool_window || 'Window')
                : (LANG.gallery_compare_tool_full || 'Full');
            fullscreenBtn.title = isCompareFullscreen ? 'Exit fullscreen' : 'Fullscreen';
        }
        const resetBtn = overlayEl.querySelector('.cg-compare-reset');
        if (resetBtn) {
            resetBtn.textContent = LANG.gallery_compare_tool_reset || '1:1';
            resetBtn.title = 'Reset zoom';
        }
        updateSwapToggleButton();
        updateAxisButton();
        syncChromeButton();
    }

    return {
        get isCompareMode() { return isCompareMode; },
        get isCompareFullscreen() { return isCompareFullscreen; },
        get compareInteraction() { return compareInteraction; },
        getStagingState,
        bothPinsReady,
        pinValid,
        resolveImage,
        resolveMeta,
        getPinA: () => pinA,
        getPinB: () => pinB,
        setCompareImage,
        setCompareExternal,
        fillNextExternal,
        setCompareFromDisplayed,
        cycleCompareChromeButton,
        enterCompareMode,
        exitCompareMode,
        toggleCompareInteraction,
        promoteFullscreen,
        demoteToGallery,
        swapPins,
        resetTransform,
        onImageRemoved,
        onGalleryCleared,
        getEmphasizedImage,
        refreshOverlayImages,
        syncChromeButton,
        updateLanguage
    };
}
