import { customCommonOverlay, addDragFunctionality } from './customOverlay.js';

function setupScrollableContainer(container) {
    let isDragging = false, startX, scrollLeft;
    container.addEventListener('mousedown', (e) => {
        e.preventDefault();
        isDragging = true;
        container.style.cursor = 'grabbing';
        startX = e.pageX - container.offsetLeft;
        scrollLeft = container.scrollLeft;
        document.body.style.userSelect = 'none';
    });
    container.addEventListener('mouseleave', () => {
        isDragging = false;
        container.style.cursor = 'grab';
        document.body.style.userSelect = '';
    });
    container.addEventListener('mouseup', () => {
        isDragging = false;
        container.style.cursor = 'grab';
        document.body.style.userSelect = '';
    });
    container.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        e.preventDefault();
        const x = e.pageX - container.offsetLeft;
        const walk = (x - startX) * 1;
        container.scrollLeft = scrollLeft - walk;
    });
}

function createModeSwitchOverlay(container) {
    const switchText = globalThis.cachedFiles.language[globalThis.globalSettings.language].switch_gallery_mode;
    let overlay = document.getElementById('cg-mode-switch-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'cg-mode-switch-overlay';
        overlay.className = 'cg-mode-switch-overlay';
        overlay.innerHTML = `
            <div class="cg-mode-switch-spinner"></div>
            <div class="cg-mode-switch-text">${switchText}</div>
        `;
        container.appendChild(overlay);
    } else {
        const textEl = overlay.querySelector('.cg-mode-switch-text');
        if (textEl) textEl.textContent = switchText;
    }
    return overlay;
}

function ensureSwitchModeButton(container, toggleFunction, id, images_length) {
    let button = document.getElementById(id);
    if (button) {
        button.textContent = images_length > 0 ? `<${images_length}>` : '<>';        
    } else {
        button = document.createElement('button');
        button.id = id;
        button.className = 'cg-button';
        button.textContent = images_length > 0 ? `<${images_length}>` : '<>';
        button.addEventListener('click', () => handleSwitchModeClick(container, toggleFunction));
        container.appendChild(button);
    }
}

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function handleSwitchModeClick(container, toggleFunction) {
    const overlay = createModeSwitchOverlay(container);
    overlay.classList.add('visible');

    await delay(100); 
    toggleFunction();

    hideAndRemoveOverlay(overlay);
}

function hideAndRemoveOverlay(overlay) {
    requestAnimationFrame(() => {
        overlay.classList.remove('visible');
        setTimeout(() => overlay.remove(), 300);
    });
}

function adjustPreviewContainer(previewContainer) {
    const previewImages = previewContainer.querySelectorAll('.cg-preview-image');
    if (previewImages.length > 0) {
        previewImages[0].onload = () => {
            const containerWidth = previewContainer.offsetWidth;
            const firstImageWidth = previewImages[0].offsetWidth || 50;
            const totalImagesWidth = firstImageWidth * previewImages.length;
            if (totalImagesWidth < (containerWidth - firstImageWidth)) {
                previewContainer.style.justifyContent = 'center';
            } else {
                previewContainer.style.justifyContent = 'flex-start';
                if (previewImages.length > 10) {
                    const minWidth = Math.max(50, containerWidth / previewImages.length);
                    for (const img of previewImages) {
                        img.style.maxWidth = `${minWidth}px`;
                    }
                }
            }
            previewContainer.scrollLeft = 0;
        };
    }
}

export function setupGallery(containerId) {
    if (globalThis.mainGallery.isGallerySetup) return;
    globalThis.mainGallery.isGallerySetup = true;
    globalThis.mainGallery.isLoading = false;

    let isGridMode = false;
    let isGalleryFocus = false;
    let currentIndex = 0;
    let privacyBalls = [];
    let images = [];
    let seeds = [];
    let tags = [];
    let infos = [];
    let renderedImageCount = 0;
    let lastAspectRatio = Number.parseFloat(localStorage.getItem('gridAspectRatio') || '0');
    let imageAspects = [];
    let gridPositions = [];
    let gridTotalHeight = 0;
    let gridItemEls = new Map();
    let gridResizeTimer = null;
    let metaButtonsLayoutRaf = 0;
    let gridRelayoutRaf = 0;
    let gridScrollRaf = 0;
    let pendingAspectProbes = new Set();
    let galleryFocusOpenedAt = 0;
    const GRID_SIZE_MIN = 80;
    const GRID_SIZE_MAX = 400;
    const GRID_SIZE_STEP = 10;
    const GRID_SIZE_DEFAULT = 200;

    function isHiresImage(index) {
        const info = infos?.[index] || '';
        const plain = String(info).replace(/\[\/?color(?:=[^\]]*)?\]/gi, '');
        return /Hires\s*Fix:\s*\[\s*true\s*\]/i.test(plain);
    }

    function applyHiresClass(el, index) {
        if (!el) return;
        el.classList.toggle('cg-hires', isHiresImage(index));
    }

    function syncHiresFrame() {
        // In-frame large view (split main / grid focus): color the gallery
        // chrome instead of outlining the image. Grid browsing stays on tiles.
        const inFrameFull = !isGridMode || isGalleryFocus;
        container.classList.toggle('cg-hires-frame', Boolean(inFrameFull && isHiresImage(currentIndex)));
    }

    const container = document.querySelector(`.${containerId}`);
    if (!container) {
        console.error('Gallery container not found', containerId);
        return;
    }

    globalThis.mainGallery.clearGallery = function () {
        images = [];
        seeds = [];
        tags = [];
        infos = [];
        imageAspects = [];
        renderedImageCount = 0;
        currentIndex = 0;
        isGalleryFocus = false;
        gridItemEls.clear();
        gridPositions = [];
        gridTotalHeight = 0;
        pendingAspectProbes.clear();
        document.removeEventListener('keydown', handleGalleryFocusKeyDown);
        const overlay = container.querySelector('.cg-gallery-focus-overlay');
        if (overlay) overlay.classList.remove('visible');
        clearGalleryView();
        syncHiresFrame();
    };

    globalThis.mainGallery.removeCurrentImage = function (element = null) {
        if(isGridMode) {
            const index = images.indexOf(element);
            if (index !== -1) {
                images.splice(index, 1);
                seeds.splice(index, 1);
                tags.splice(index, 1);
                infos.splice(index, 1);
                imageAspects.splice(index, 1);
                pendingAspectProbes.delete(index);

                renderedImageCount = images.length;
                if (index < currentIndex) {
                    currentIndex -= 1;
                }
                if (currentIndex >= images.length) {
                    currentIndex = Math.max(0, images.length - 1);
                }
                if (images.length === 0) {
                    isGalleryFocus = false;
                    document.removeEventListener('keydown', handleGalleryFocusKeyDown);
                }
                gallery_renderGridMode(false);
            }
        } else {
            images.splice(currentIndex, 1);
            seeds.splice(currentIndex, 1);
            tags.splice(currentIndex, 1);
            infos.splice(currentIndex, 1);
            imageAspects.splice(currentIndex, 1);
            renderedImageCount = images.length;
            currentIndex = currentIndex - 1;
            if(currentIndex < 0)
                currentIndex = 0;
            gallery_renderSplitMode(false);
        }            
    };

    globalThis.mainGallery.appendImageData = function (base64, seed, tagsString, switchToLatest = false, info = '') {
        images.push(base64); 
        seeds.push(seed);
        tags.push(tagsString || '');
        infos.push(info || '');
        imageAspects.push(0);
        probeImageAspect(images.length - 1);

        if (seeds.length !== tags.length || images.length !== seeds.length || images.length !== infos.length) {
            console.warn('[appendImageData] Mismatch: images:', images.length, 'seeds:', seeds.length, 'tags:', tags.length, 'infos:', infos.length);
        }

        let incremental = true;
        if (switchToLatest && !isGridMode) {
            currentIndex = images.length - 1;
            incremental = false;
        }

        if (isGridMode) {
            gallery_renderGridMode(true);
            if (switchToLatest) {
                const gallery = container.querySelector('.cg-gallery-grid-container');
                if (gallery) gallery.scrollTop = 0;
                if (isGalleryFocus) enterGalleryFocus(images.length - 1);
            }
        } else {
            gallery_renderSplitMode(incremental);
        }
    };

    globalThis.mainGallery.showLoading = function (loadingMEssage, elapsedTimePrefix, elapsedTimeSuffix) {        
        const buttonOverlay = document.getElementById('cg-button-overlay');
        if (buttonOverlay?.dataset.minimized === 'true' || globalThis.globalSettings.gallery_preview) {
            globalThis.mainGallery.isLoading = true;
            return;
        }

        const loadingOverlay = customCommonOverlay().createLoadingOverlay(loadingMEssage, elapsedTimePrefix, elapsedTimeSuffix);
        const savedPosition = JSON.parse(localStorage.getItem('overlayPosition'));
        if (savedPosition?.top !== undefined && savedPosition.left !== undefined) {
            loadingOverlay.style.top = `${savedPosition.top}px`;
            loadingOverlay.style.left = `${savedPosition.left}px`;
            loadingOverlay.style.transform = 'none';
        } else if (buttonOverlay) {
            const rect = buttonOverlay.getBoundingClientRect();
            loadingOverlay.style.top = `${rect.top}px`;
            loadingOverlay.style.left = `${rect.left}px`;
            loadingOverlay.style.transform = 'none';
        } else {
            loadingOverlay.style.top = '20%';
            loadingOverlay.style.left = '50%';
            loadingOverlay.style.transform = 'translate(-50%, -20%)';
        }
        addDragFunctionality(loadingOverlay, buttonOverlay);
        globalThis.mainGallery.isLoading = true;
    };

    globalThis.mainGallery.hideLoading = function (errorMessage, copyMessage) {
        const loadingOverlay = document.getElementById('cg-loading-overlay');
        const buttonOverlay = document.getElementById('cg-button-overlay');
        if (loadingOverlay) {
            if (loadingOverlay.dataset.timerInterval) {
                clearInterval(loadingOverlay.dataset.timerInterval);
            }
            if (buttonOverlay && !buttonOverlay.classList.contains('minimized')) {
                const rect = loadingOverlay.getBoundingClientRect();
                buttonOverlay.style.left = '0';
                buttonOverlay.style.top = '0';
                buttonOverlay.style.transform = `translate(${rect.left}px, ${rect.top}px)`;
                if (buttonOverlay.updateDragPosition) {
                    buttonOverlay.updateDragPosition(rect.left, rect.top);
                }
            }
            loadingOverlay.remove();
        }
        document.querySelector('.cg-minimized-generation-preview-container')?.remove();
        if (buttonOverlay?.dataset.minimized === 'false') {
            buttonOverlay.classList.remove('minimized');
            buttonOverlay.style.width = '240px';
            buttonOverlay.style.height = 'auto';
            buttonOverlay.style.minHeight = '110px';
            buttonOverlay.style.padding = '20px 20px 5px';
            const buttonContainer = buttonOverlay.querySelector('.cg-button-container');
            if (buttonContainer) {
                buttonContainer.style.display = 'flex';
                buttonContainer.style.padding = '20px';
            }
        }
        if ('success' !== errorMessage) {
            console.warn('Got Error from backend:', copyMessage);
            customCommonOverlay().createErrorOverlay(errorMessage, copyMessage);
        }
        globalThis.mainGallery.isLoading = false;
    };

    globalThis.mainGallery.applyGridSize = function (value) {
        const next = clampGridSize(value);
        globalThis.globalSettings.gallery_grid_size = next;
        if (!isGridMode) return;
        applyMasonryAndSync(true);
    };

    function clampGridSize(value) {
        const parsed = Number.parseInt(value, 10);
        if (!Number.isFinite(parsed)) return GRID_SIZE_DEFAULT;
        return Math.min(GRID_SIZE_MAX, Math.max(GRID_SIZE_MIN, parsed));
    }

    function getGridTargetSize() {
        return clampGridSize(globalThis.globalSettings?.gallery_grid_size ?? GRID_SIZE_DEFAULT);
    }

    function getImageAspect(index) {
        const ar = imageAspects[index];
        if (ar > 0) return ar;
        if (lastAspectRatio > 0) return lastAspectRatio;
        return 0.75;
    }

    function clearGalleryView() {
        for (const child of container.querySelectorAll(':scope > *')) {
            if (child.classList.contains('cg-minimized-generation-preview-container')) continue;
            if (child.classList.contains('cg-gallery-focus-overlay')) continue;
            if (child.classList.contains('cg-mode-switch-overlay')) continue;
            if (child.classList.contains('cg-button')) continue;
            child.remove();
        }
        gridItemEls.clear();
    }

    function probeImageAspect(index) {
        if (index < 0 || index >= images.length) return;
        if (imageAspects[index] > 0 || pendingAspectProbes.has(index)) return;
        const src = images[index];
        if (!src) return;
        pendingAspectProbes.add(index);
        const img = new Image();
        img.onload = () => {
            pendingAspectProbes.delete(index);
            if (index >= images.length || images[index] !== src) return;
            const ar = img.width / img.height;
            if (!Number.isFinite(ar) || ar <= 0) return;
            const prev = imageAspects[index] || 0;
            imageAspects[index] = ar;
            lastAspectRatio = ar;
            localStorage.setItem('gridAspectRatio', ar.toString());
            if (isGridMode && Math.abs(ar - prev) > 0.01) scheduleGridRelayout();
        };
        img.onerror = () => {
            pendingAspectProbes.delete(index);
        };
        img.src = src;
    }

    function scheduleGridRelayout() {
        if (gridRelayoutRaf) return;
        gridRelayoutRaf = requestAnimationFrame(() => {
            gridRelayoutRaf = 0;
            if (!isGridMode) return;
            applyMasonryAndSync(true);
        });
    }

    function onGridScroll() {
        if (gridScrollRaf) return;
        gridScrollRaf = requestAnimationFrame(() => {
            gridScrollRaf = 0;
            syncVisibleGridItems();
        });
    }

    function ensureGridShell() {
        let gallery = container.querySelector('.cg-gallery-grid-container');
        if (!gallery) {
            gallery = document.createElement('div');
            gallery.className = 'cg-gallery-grid-container scroll-container';
            const overlay = container.querySelector('.cg-gallery-focus-overlay');
            const preview = container.querySelector('.cg-minimized-generation-preview-container');
            const before = overlay || preview;
            if (before) before.before(gallery);
            else container.appendChild(gallery);

            gallery.addEventListener('click', (e) => {
                const imgContainer = e.target.closest('.cg-gallery-item');
                if (!imgContainer) return;
                const index = Number.parseInt(imgContainer.dataset.index, 10);
                if (Number.isNaN(index)) return;
                enterGalleryFocus(index);
            });
            gallery.addEventListener('wheel', handleGridWheel, { passive: false });
            gallery.addEventListener('scroll', onGridScroll, { passive: true });
        }

        let sizer = gallery.querySelector('.cg-gallery-grid-sizer');
        if (!sizer) {
            sizer = document.createElement('div');
            sizer.className = 'cg-gallery-grid-sizer';
            gallery.appendChild(sizer);
        }
        return { gallery, sizer };
    }

    function computeMasonryLayout(innerWidth) {
        const gap = 10;
        const targetSize = getGridTargetSize();
        const colCount = Math.max(1, Math.floor((innerWidth + gap) / (targetSize + gap)));
        const colWidth = Math.max(1, (innerWidth - gap * (colCount - 1)) / colCount);
        const colHeights = new Array(colCount).fill(0);
        gridPositions = [];

        for (let i = images.length - 1; i >= 0; i--) {
            const height = colWidth / getImageAspect(i);
            let col = 0;
            for (let c = 1; c < colCount; c++) {
                if (colHeights[c] < colHeights[col] - 0.5) col = c;
            }
            gridPositions.push({
                index: i,
                x: col * (colWidth + gap),
                y: colHeights[col],
                width: colWidth,
                height
            });
            colHeights[col] += height + gap;
        }

        gridTotalHeight = gridPositions.length
            ? Math.max(0, ...colHeights) - gap
            : 0;
    }

    function createGridItem(pos) {
        const el = document.createElement('div');
        el.className = 'cg-gallery-item visible';
        el.dataset.index = pos.index;
        el.style.left = `${pos.x}px`;
        el.style.top = `${pos.y}px`;
        el.style.width = `${pos.width}px`;
        el.style.height = `${pos.height}px`;

        const img = document.createElement('img');
        img.className = 'cg-gallery-image';
        img.src = images[pos.index];
        img.onload = () => {
            const index = Number.parseInt(el.dataset.index, 10);
            if (!Number.isFinite(index) || index < 0 || index >= images.length) return;
            const ar = img.naturalWidth / img.naturalHeight;
            if (!Number.isFinite(ar) || ar <= 0) return;
            const prev = imageAspects[index] || 0;
            imageAspects[index] = ar;
            lastAspectRatio = ar;
            if (Math.abs(ar - prev) > 0.01) scheduleGridRelayout();
        };
        el.appendChild(img);
        applyHiresClass(el, pos.index);
        return el;
    }

    function syncVisibleGridItems() {
        const gallery = container.querySelector('.cg-gallery-grid-container');
        const sizer = gallery?.querySelector('.cg-gallery-grid-sizer');
        if (!gallery || !sizer) return;

        const scrollTop = gallery.scrollTop;
        const viewH = gallery.clientHeight;
        const buffer = Math.max(viewH, 400);
        const minY = scrollTop - buffer;
        const maxY = scrollTop + viewH + buffer;
        const visible = new Set();

        for (const pos of gridPositions) {
            if (pos.y + pos.height < minY || pos.y > maxY) continue;
            visible.add(pos.index);
            let el = gridItemEls.get(pos.index);
            if (!el) {
                el = createGridItem(pos);
                sizer.appendChild(el);
                gridItemEls.set(pos.index, el);
            } else {
                el.style.left = `${pos.x}px`;
                el.style.top = `${pos.y}px`;
                el.style.width = `${pos.width}px`;
                el.style.height = `${pos.height}px`;
            }
            el.classList.toggle('selected', isGalleryFocus && pos.index === currentIndex);
        }

        for (const [index, el] of gridItemEls) {
            if (!visible.has(index)) {
                el.remove();
                gridItemEls.delete(index);
            }
        }
    }

    function applyMasonryAndSync(preserveScroll = true) {
        if (!images.length) return;
        const { gallery, sizer } = ensureGridShell();
        const innerWidth = gallery.clientWidth;
        if (innerWidth <= 0) return;

        let anchorIndex = -1;
        let anchorOffset = 0;
        if (preserveScroll && gridPositions.length) {
            const scrollTop = gallery.scrollTop;
            const anchor = gridPositions.find((p) => p.y + p.height > scrollTop);
            if (anchor) {
                anchorIndex = anchor.index;
                anchorOffset = scrollTop - anchor.y;
            }
        }

        computeMasonryLayout(innerWidth);
        sizer.style.height = `${Math.max(0, gridTotalHeight)}px`;

        if (preserveScroll && anchorIndex >= 0) {
            const newAnchor = gridPositions.find((p) => p.index === anchorIndex);
            if (newAnchor) gallery.scrollTop = newAnchor.y + anchorOffset;
        }

        syncVisibleGridItems();
    }

    function setGridMetaButtonsVisible(visible) {
        for (const id of ['cg-seed-button', 'cg-tag-button', 'cg-info-button']) {
            const btn = document.getElementById(id);
            if (btn) btn.style.display = visible ? '' : 'none';
        }
    }

    function updateGridSelection() {
        for (const [index, el] of gridItemEls) {
            el.classList.toggle('selected', isGalleryFocus && index === currentIndex);
        }
    }

    function updateGalleryFocusImage() {
        const overlay = container.querySelector('.cg-gallery-focus-overlay');
        const img = overlay?.querySelector('.cg-gallery-focus-image');
        if (img && images[currentIndex]) {
            img.src = images[currentIndex];
        }
        updateGridSelection();
        updateMetaButtonsLayout();
        syncHiresFrame();
    }

    function handleGalleryFocusKeyDown(e) {
        if (document.querySelector('.cg-fullscreen-overlay')) return;
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
        if (e.key === 'Escape') {
            e.preventDefault();
            exitGalleryFocus();
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            if (images.length === 0) return;
            currentIndex = (currentIndex - 1 + images.length) % images.length;
            updateGalleryFocusImage();
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            if (images.length === 0) return;
            currentIndex = (currentIndex + 1) % images.length;
            updateGalleryFocusImage();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            enterFullscreen(currentIndex);
        }
    }

    function enterGalleryFocus(index) {
        if (!images[index]) return;
        currentIndex = index;
        isGalleryFocus = true;

        let overlay = container.querySelector('.cg-gallery-focus-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'cg-gallery-focus-overlay';
            const img = document.createElement('img');
            img.className = 'cg-gallery-focus-image';
            overlay.appendChild(img);
            const preview = container.querySelector('.cg-minimized-generation-preview-container');
            if (preview) preview.before(overlay);
            else container.appendChild(overlay);

            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) exitGalleryFocus();
            });
            overlay.addEventListener('wheel', handleGridWheel, { passive: false });
            img.addEventListener('click', (e) => {
                e.stopPropagation();
                if (Date.now() - galleryFocusOpenedAt < 280) return;
                enterFullscreen(currentIndex);
            });
        }

        overlay.querySelector('.cg-gallery-focus-image').src = images[currentIndex];
        overlay.classList.add('visible');
        galleryFocusOpenedAt = Date.now();
        document.removeEventListener('keydown', handleGalleryFocusKeyDown);
        document.addEventListener('keydown', handleGalleryFocusKeyDown);
        ensureSeedButton();
        ensureTagButton();
        ensureInfoButton();
        setGridMetaButtonsVisible(true);
        updateMetaButtonsLayout();
        updateGridSelection();
        syncHiresFrame();
    }

    function exitGalleryFocus() {
        isGalleryFocus = false;
        const overlay = container.querySelector('.cg-gallery-focus-overlay');
        if (overlay) overlay.classList.remove('visible');
        document.removeEventListener('keydown', handleGalleryFocusKeyDown);
        setGridMetaButtonsVisible(false);
        updateMetaButtonsLayout();
        updateGridSelection();
        syncHiresFrame();
    }

    function handleGridWheel(e) {
        if ((!e.ctrlKey && !e.metaKey) || !isGridMode) return;
        e.preventDefault();
        const current = getGridTargetSize();
        const next = clampGridSize(current + (e.deltaY < 0 ? GRID_SIZE_STEP : -GRID_SIZE_STEP));
        if (next === current) return;
        if (globalThis.generate?.gridSize) {
            globalThis.generate.gridSize.setValue(next);
        } else {
            globalThis.mainGallery.applyGridSize(next);
        }
    }

    function setGridSizeSliderVisible(visible) {
        document.querySelector('.gallery-main-header')?.classList.toggle('is-grid-mode', visible);
    }

    function toggleGalleryMode() {
        isGridMode = !isGridMode;
        isGalleryFocus = false;
        document.removeEventListener('keydown', handleGalleryFocusKeyDown);
        const overlay = container.querySelector('.cg-gallery-focus-overlay');
        if (overlay) overlay.classList.remove('visible');
        currentIndex = images.length - 1;
        setGridSizeSliderVisible(isGridMode);
        if (isGridMode) {
            setGridMetaButtonsVisible(false);
            gallery_renderGridMode();
        } else {
            setGridMetaButtonsVisible(true);
            gallery_renderSplitMode();
        }
    }

    function ensurePrivacyButton() {
        let privacyButton = document.getElementById('cg-privacy-button');
        if (!privacyButton) {
            privacyButton = document.createElement('button');
            privacyButton.id = 'cg-privacy-button';
            privacyButton.className = 'cg-button';
            privacyButton.textContent = '(X)';
            privacyButton.style.background = 'linear-gradient(45deg, red, orange, yellow, green, blue, indigo, violet)';
            privacyButton.addEventListener('click', () => {
                if (privacyBalls.length >= 5) {
                    console.log('Maximum 5 privacy balls reached');
                    return;
                }
                createPrivacyBall();
            });
            container.appendChild(privacyButton);
        }
    }

    function createPrivacyBall() {
        const ball = document.createElement('div');
        ball.className = 'cg-privacy-ball';
        const galleryRect = container.getBoundingClientRect();
        const left = galleryRect.left + galleryRect.width / 2 - 50;
        const top = galleryRect.top + galleryRect.height / 2 - 50;
        ball.style.left = `${left}px`;
        ball.style.top = `${top}px`;
        ball.style.width = '100px';
        ball.style.height = '100px';

        // Apply base64 PNG as background image if available
        if (globalThis.cachedFiles?.privacyBall) {
            ball.style.backgroundImage = `url(${globalThis.cachedFiles.privacyBall})`;
            ball.style.backgroundSize = 'cover';
            ball.style.backgroundPosition = 'center';
            ball.style.backgroundRepeat = 'no-repeat';
        } else {
            // Fallback to original styling with SAA text
            console.warn('Privacy ball image not found in globalThis.cachedFiles.privacyBall');
            ball.innerHTML = 'SAA';
            ball.style.background = 'linear-gradient(45deg, red, orange, yellow, green, blue, indigo, violet)';
        }

        let isDragging = false, startX, startY;
        ball.addEventListener('mousedown', (e) => {
            if (e.button === 0) { 
                e.preventDefault();
                isDragging = true;
                startX = e.clientX - Number.parseFloat(ball.style.left || 0);
                startY = e.clientY - Number.parseFloat(ball.style.top || 0);
                ball.style.cursor = 'grabbing'; 
                document.body.style.userSelect = 'none';
            } else if (e.button === 2) { 
                e.preventDefault();
                const startY = e.clientY;
                const startSize = Number.parseFloat(ball.style.width || 100);

                const onMouseMove = (moveEvent) => {
                    const deltaY = moveEvent.clientY - startY;
                    let newSize = startSize + deltaY;
                    newSize = Math.min(Math.max(newSize, 20), 300); 
                    ball.style.width = `${newSize}px`;
                    ball.style.height = `${newSize}px`;
                    if (!globalThis.cachedFiles?.privacyBall) {
                        ball.style.fontSize = `${newSize * 0.2}px`; 
                    }
                };

                const onMouseUp = () => {
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                };

                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            e.preventDefault();
            ball.style.left = `${e.clientX - startX}px`;
            ball.style.top = `${e.clientY - startY}px`;
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                ball.style.cursor = 'grab'; 
                document.body.style.userSelect = '';
            }
        });

        ball.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });

        ball.addEventListener('dblclick', () => {
            ball.remove();
            privacyBalls = privacyBalls.filter(b => b !== ball);
        });

        document.body.appendChild(ball);
        privacyBalls.push(ball);
    }

    function enterFullscreen(index) {
        const imgUrl = images[index];
        if (!imgUrl) {
            console.error('Invalid image index:', index);
            return;
        }

        document.removeEventListener('keydown', handleGalleryFocusKeyDown);

        const overlay = document.createElement('div');
        overlay.className = 'cg-fullscreen-overlay';

        const fullScreenImg = document.createElement('img');
        fullScreenImg.src = imgUrl;
        fullScreenImg.className = 'cg-fullscreen-image';

        let isDragging = false, startX = 0, startY = 0, translateX = 0, translateY = 0;

        fullScreenImg.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            fullScreenImg.style.cursor = 'grabbing';
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });

        function onMouseMove(e) {
            if (!isDragging) return;
            e.preventDefault();
            e.stopPropagation();

            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            translateX += deltaX;
            translateY += deltaY;
            fullScreenImg.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
            startX = e.clientX;
            startY = e.clientY;
        }

        function onMouseUp() {
            isDragging = false;
            fullScreenImg.style.cursor = 'grab';
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        }

        let scale = 1;
        fullScreenImg.addEventListener('wheel', (e) => {
            e.preventDefault();
            scale += e.deltaY * -0.001;
            scale = Math.min(Math.max(0.5, scale), 4);
            fullScreenImg.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
        });

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) exitFullscreen();
        });

        document.addEventListener('keydown', handleFullscreenKeyDown);
        overlay.appendChild(fullScreenImg);
        document.body.appendChild(overlay);

        function handleFullscreenKeyDown(e) {
            if (e.key === 'Escape') {
                exitFullscreen();
            } else if (e.key === 'ArrowRight' || e.key === ' ') {
                currentIndex = (currentIndex - 1 + images.length) % images.length;
                fullScreenImg.src = images[currentIndex];
            } else if (e.key === 'ArrowLeft') {
                currentIndex = (currentIndex + 1) % images.length;
                fullScreenImg.src = images[currentIndex];
            }
        }

        function exitFullscreen() {
            overlay.remove();
            document.removeEventListener('keydown', handleFullscreenKeyDown);
            
            if (!isGridMode) {
                let mainImage = document.createElement('img');
                mainImage.src = images[currentIndex];
                updatePreviewBorders();

                let mainImageContainer = container.querySelector('.cg-main-image-container');
                mainImage = mainImageContainer.querySelector('img')
                if (mainImage.src !== images[currentIndex]) {
                    mainImage.src = images[currentIndex];
                }
            } else if (isGalleryFocus) {
                updateGalleryFocusImage();
                document.addEventListener('keydown', handleGalleryFocusKeyDown);
            }
        }
    }

    function gallery_renderGridMode(incremental = false) {
        setGridSizeSliderVisible(true);
        if (!images || images.length === 0) {
            isGalleryFocus = false;
            document.removeEventListener('keydown', handleGalleryFocusKeyDown);
            const overlay = container.querySelector('.cg-gallery-focus-overlay');
            if (overlay) overlay.classList.remove('visible');
            gridItemEls.clear();
            gridPositions = [];
            gridTotalHeight = 0;
            renderedImageCount = 0;
            currentIndex = 0;
            container.querySelector('.cg-gallery-grid-container')?.remove();
            syncHiresFrame();
            return;
        }

        if (container.querySelector('.cg-main-image-container')) {
            clearGalleryView();
        }

        if (!incremental) {
            gridItemEls.clear();
            const sizer = container.querySelector('.cg-gallery-grid-sizer');
            if (sizer) sizer.innerHTML = '';
        }

        applyMasonryAndSync(true);
        renderedImageCount = images.length;

        ensureSwitchModeButton(container, toggleGalleryMode, 'cg-switch-mode-button', images.length);
        ensurePrivacyButton();
        if (!isGalleryFocus) setGridMetaButtonsVisible(false);
        updateMetaButtonsLayout();

        if (isGalleryFocus) {
            enterGalleryFocus(currentIndex);
        } else {
            updateGridSelection();
            syncHiresFrame();
        }
    }
    
    function gallery_renderSplitMode(incremental = false) {
        setGridSizeSliderVisible(false);
        if (!images || images.length === 0) {
            clearGalleryView();
            renderedImageCount = 0;
            currentIndex = 0;
            syncHiresFrame();
            return;
        }

        let mainImageContainer = container.querySelector('.cg-main-image-container');
        let previewContainer = container.querySelector('.cg-preview-container');

        if (!mainImageContainer || !previewContainer || !incremental) {
            clearGalleryView();
            mainImageContainer = document.createElement('div');
            mainImageContainer.className = 'cg-main-image-container';
            const mainImage = document.createElement('img');
            mainImage.src = images[currentIndex];
            mainImage.className = 'cg-main-image';
            mainImage.addEventListener('click', () => enterFullscreen(currentIndex));
            mainImage.onload = () => updateMetaButtonsLayout();
            mainImageContainer.appendChild(mainImage);
            container.appendChild(mainImageContainer);

            mainImageContainer.addEventListener('click', (e) => {
                e.preventDefault();
                const rect = mainImageContainer.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const isLeft = clickX < rect.width / 2;
                if (e.target !== mainImage && images.length > 1) {
                    if (isLeft) {
                        currentIndex = (currentIndex + 1) % images.length;
                    } else {
                        currentIndex = (currentIndex - 1 + images.length) % images.length;
                    }
                    mainImage.src = images[currentIndex];
                    updatePreviewBorders();
                }
            });

            previewContainer = document.createElement('div');
            previewContainer.className = 'cg-preview-container scroll-container';
            setupScrollableContainer(previewContainer);
            container.appendChild(previewContainer);
            renderedImageCount = 0;

            previewContainer.addEventListener('click', (e) => {
                const previewImage = e.target.closest('.cg-preview-image');
                if (previewImage) {
                    e.preventDefault();
                    const domIndex = Number.parseInt(previewImage.dataset.domIndex);
                    currentIndex = images.length - 1 - domIndex;
                    mainImage.src = images[currentIndex];
                    updatePreviewBorders();
                    previewImage.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                }
            });
        }

        const fragment = document.createDocumentFragment();
        const observer = new IntersectionObserver((entries, observer) => {
            for (const entry of entries) {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    img.classList.add('visible');
                    observer.unobserve(img);
                }
            }
        }, { root: previewContainer, threshold: 0.1 });

        if (incremental && renderedImageCount < images.length) {
            for (let i = renderedImageCount; i < images.length; i++) {
                const previewImage = document.createElement('img');
                previewImage.className = 'cg-preview-image';
                previewImage.dataset.src = images[i];
                previewImage.src = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
                previewImage.loading = 'lazy';
                previewImage.dataset.domIndex = images.length - 1 - i;
                fragment.appendChild(previewImage);
                observer.observe(previewImage);
            }
        } else {
            for (let i = images.length - 1; i >= 0; i--) {
                const previewImage = document.createElement('img');
                previewImage.className = 'cg-preview-image';
                previewImage.dataset.src = images[i];
                previewImage.src = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
                previewImage.loading = 'lazy';
                previewImage.dataset.domIndex = images.length - 1 - i;
                fragment.appendChild(previewImage);
                observer.observe(previewImage);
            }
        }

        previewContainer.prepend(fragment);
        renderedImageCount = images.length;

        updatePreviewBorders();
        const currentPreview = previewContainer.querySelector(`.cg-preview-image[data-domIndex="${images.length - 1 - currentIndex}"]`);
        if (currentPreview) {
            currentPreview.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }

        ensureSwitchModeButton(container, toggleGalleryMode, 'cg-switch-mode-button', images.length);
        ensureSeedButton();
        ensureTagButton();
        ensureInfoButton();
        ensurePrivacyButton();
        setGridMetaButtonsVisible(true);
        adjustPreviewContainer(previewContainer);
        updateMetaButtonsLayout();
    }
    
    function updatePreviewBorders() {
        const previewImages = container.querySelectorAll('.cg-preview-image');
        for (const [domIndex, child] of [...previewImages].entries()) {
            const index = images.length - 1 - domIndex;
            child.dataset.domIndex = domIndex;
            child.style.border = index === currentIndex ? '2px solid #3498db' : 'none';
            applyHiresClass(child, index);
        }
        syncHiresFrame();
        const domIndex = images.length - 1 - currentIndex;
        if (domIndex >= 0 && domIndex < previewImages.length) {
            previewImages[domIndex].scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }
    }


    function isGalleryHostInFullWidth() {
        const full = document.getElementById('full-width');
        return Boolean(full && full.contains(container));
    }

    function getMetaAnchorImage() {
        if (isGalleryFocus) {
            const focusImg = container.querySelector('.cg-gallery-focus-overlay.visible .cg-gallery-focus-image');
            if (focusImg) return focusImg;
        }
        if (isGalleryHostInFullWidth() && !isGridMode) {
            return container.querySelector('.cg-main-image-container .cg-main-image');
        }
        if (isGalleryHostInFullWidth() && isGridMode && isGalleryFocus) {
            return container.querySelector('.cg-gallery-focus-overlay.visible .cg-gallery-focus-image');
        }
        return null;
    }

    function clearMetaButtonSideStyles(button) {
        if (!button) return;
        button.style.left = '';
        button.style.right = '';
        button.style.top = '';
        button.style.bottom = '';
        button.style.transform = '';
    }

    function clearChromeButtonSideStyles() {
        for (const id of ['cg-switch-mode-button', 'cg-privacy-button']) {
            const button = document.getElementById(id);
            if (!button) continue;
            button.style.left = '';
            button.style.right = '';
        }
    }

    function applyChromeButtonsSideLayout(rtl) {
        const chromeIds = ['cg-switch-mode-button', 'cg-privacy-button'];
        const chromeTops = {
            'cg-switch-mode-button': '10px',
            'cg-privacy-button': '50px'
        };
        for (const id of chromeIds) {
            const button = document.getElementById(id);
            if (!button) continue;
            button.style.top = chromeTops[id];
            button.style.bottom = 'auto';
            button.style.transform = 'none';
            if (rtl) {
                button.style.left = 'auto';
                button.style.right = '10px';
            } else {
                button.style.left = '10px';
                button.style.right = 'auto';
            }
        }
    }

    function applyMetaButtonsSideLayout(rtl) {
        const metaIds = ['cg-seed-button', 'cg-tag-button', 'cg-info-button'];
        const metaTops = {
            'cg-seed-button': '10px',
            'cg-tag-button': '50px',
            'cg-info-button': '90px'
        };
        for (const id of metaIds) {
            const button = document.getElementById(id);
            if (!button) continue;
            button.style.top = metaTops[id];
            button.style.bottom = 'auto';
            button.style.transform = 'none';
            button.style.width = 'auto';
            button.style.whiteSpace = 'nowrap';
            if (rtl) {
                button.style.left = '10px';
                button.style.right = 'auto';
            } else {
                button.style.left = 'auto';
                button.style.right = '10px';
            }
        }
        applyChromeButtonsSideLayout(rtl);
        container.classList.remove('cg-meta-buttons-centered');
    }

    function updateMetaButtonsLayout() {
        const rtl = document.body.classList.contains('right-to-left');
        // Default row seed-tags-info. RTL mirrors to info-tags-seed.
        // (Previously seed-tags-info matched <> on-right; after side flip RTL mirrors the row.)
        const metaIds = rtl
            ? ['cg-info-button', 'cg-tag-button', 'cg-seed-button']
            : ['cg-seed-button', 'cg-tag-button', 'cg-info-button'];
        const buttons = metaIds.map((id) => document.getElementById(id)).filter(Boolean);
        if (!buttons.length) {
            applyChromeButtonsSideLayout(rtl);
            return;
        }

        const anchor = getMetaAnchorImage();
        // Bottom-center only in full-width; half-width grid focus stays on the side.
        const shouldCenter = Boolean(anchor) && isGalleryHostInFullWidth();
        container.classList.toggle('cg-meta-buttons-centered', shouldCenter);

        // Grid without in-frame focus: keep seed/tags/info hidden.
        if (isGridMode && !isGalleryFocus) {
            setGridMetaButtonsVisible(false);
            applyChromeButtonsSideLayout(!rtl);
            return;
        }

        // Normal / side mode: explicitly place chrome vs meta so RTL cannot be
        // overridden by leftover inline coords or weaker stylesheet order.
        if (!shouldCenter) {
            applyMetaButtonsSideLayout(!rtl);
            return;
        }

        const containerRect = container.getBoundingClientRect();
        const anchorRect = anchor.getBoundingClientRect();
        if (anchorRect.width < 8 || anchorRect.height < 8) {
            applyMetaButtonsSideLayout(!rtl);
            return;
        }

        for (const button of buttons) {
            if (button.style.display === 'none') continue;
        }

        const gap = 18;
        const visibleButtons = buttons.filter((button) => button.style.display !== 'none');
        if (!visibleButtons.length) {
            applyChromeButtonsSideLayout(!rtl);
            return;
        }
        for (const button of visibleButtons) {
            button.style.right = 'auto';
            button.style.width = 'auto';
            button.style.whiteSpace = 'nowrap';
        }

        const widths = visibleButtons.map((button) => {
            const width = button.getBoundingClientRect().width;
            return width > 1 ? Math.ceil(width) : Math.max(button.offsetWidth || 0, 56);
        });
        const heights = visibleButtons.map((button) => Math.max(button.offsetHeight || 0, 28));
        const totalWidth = widths.reduce((sum, width) => sum + width, 0) + gap * (visibleButtons.length - 1);
        const maxHeight = Math.max(...heights);
        const centerX = anchorRect.left + anchorRect.width / 2 - containerRect.left;
        const top = anchorRect.bottom - containerRect.top - maxHeight - 10;
        let left = centerX - totalWidth / 2;

        for (let i = 0; i < visibleButtons.length; i++) {
            const button = visibleButtons[i];
            button.style.left = `${Math.round(left)}px`;
            button.style.right = 'auto';
            button.style.top = `${Math.round(Math.max(8, top))}px`;
            button.style.bottom = 'auto';
            button.style.transform = 'none';
            left += widths[i] + gap;
        }
        applyChromeButtonsSideLayout(!rtl);
    }

    globalThis.mainGallery.updateMetaButtonsLayout = updateMetaButtonsLayout;

    function ensureSeedButton() {
        let seedButton = document.getElementById('cg-seed-button');
        if (!seedButton) {
            seedButton = document.createElement('button');
            seedButton.id = 'cg-seed-button';
            seedButton.className = 'cg-button';
            seedButton.textContent = 'Seed';
            seedButton.addEventListener('click', async () => {
                if (!seeds?.[currentIndex]) return;
    
                const seedToCopy = seeds[currentIndex].trim();
                try {
                    await navigator.clipboard.writeText(seedToCopy);
                    seedButton.textContent = 'Copied!';
                } catch (err) {
                    seedButton.textContent = 'Copy failed!';
                    console.warn('Failed to copy seed:', err);
                    const SETTINGS = globalThis.globalSettings;
                    const FILES = globalThis.cachedFiles;
                    const LANG = FILES.language[SETTINGS.language];
                    globalThis.overlay.custom.createCustomOverlay(
                        'none', LANG.saac_macos_clipboard.replace('{0}', seedToCopy), 
                        384, 'center', 'left', null, 'Clipboard');
                } finally {                                        
                    setTimeout(() => {
                        seedButton.textContent = 'Seed';
                    }, 2000);
                    updateSeedInputs(seedToCopy);
                }
            });
            container.appendChild(seedButton);
        }
    }
    
    function updateSeedInputs(seedToCopy) {
        const lastSeed = globalThis.generate.seed.getValue();
        const newSeed = Number.parseInt(seedToCopy);
        if(lastSeed === newSeed) {
            globalThis.generate.seed.setValue(-1);
        } else {
            globalThis.generate.seed.setValue(newSeed);
        }
    }

    function ensureTagButton() {
        let tagButton = document.getElementById('cg-tag-button');
        if (!tagButton) {
            tagButton = document.createElement('button');
            tagButton.id = 'cg-tag-button';
            tagButton.className = 'cg-button';
            tagButton.textContent = 'Tags';
            tagButton.addEventListener('click', async () => {
                if (!tags?.[currentIndex]) return;
    
                const tagToCopy = tags[currentIndex].trim();
                try {
                    await navigator.clipboard.writeText(tagToCopy);
                    tagButton.textContent = 'Copied!';                    
                } catch (err) {
                    tagButton.textContent = 'Copy failed!';
                    console.warn('Failed to copy tag:', err);
                    const SETTINGS = globalThis.globalSettings;
                    const FILES = globalThis.cachedFiles;
                    const LANG = FILES.language[SETTINGS.language];
                    globalThis.overlay.custom.createCustomOverlay(
                        'none', LANG.saac_macos_clipboard.replace('{0}', tagToCopy),
                        384, 'center', 'left', null, 'Clipboard');
                } finally {
                    setTimeout(() => {
                        tagButton.textContent = 'Tags';
                    }, 2000);
                }
            });
            container.appendChild(tagButton);
        }
    }

    function ensureInfoButton() {
        let infoButton = document.getElementById('cg-info-button');
        if (!infoButton) {
            infoButton = document.createElement('button');
            infoButton.id = 'cg-info-button';
            infoButton.className = 'cg-button';
            infoButton.textContent = 'Info';
            infoButton.addEventListener('click', () => {
                const info = infos?.[currentIndex] || '';
                const image = images?.[currentIndex] || 'none';
                globalThis.overlay.custom.createCustomOverlay(
                    image,
                    info,
                    512, 'center', 'left', null, 'Info');
            });
            container.appendChild(infoButton);
        }
    }

    const gridResizeObserver = new ResizeObserver(() => {
        // Buttons track size immediately (rAF); masonry stays debounced.
        if (metaButtonsLayoutRaf) cancelAnimationFrame(metaButtonsLayoutRaf);
        metaButtonsLayoutRaf = requestAnimationFrame(() => {
            metaButtonsLayoutRaf = 0;
            updateMetaButtonsLayout();
        });
        clearTimeout(gridResizeTimer);
        gridResizeTimer = setTimeout(() => {
            if (isGridMode) applyMasonryAndSync(true);
        }, 50);
    });
    gridResizeObserver.observe(container);
}
