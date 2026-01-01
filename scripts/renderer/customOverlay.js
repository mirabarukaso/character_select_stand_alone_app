import { parseTaggedContent } from './components/myTextbox.js';

let customOverlayCounter = 0;

export function setupButtonOverlay() {
    globalThis.addEventListener('resize', () => {
        const overlays = ['cg-button-overlay', 'cg-loading-overlay'];
        for (const id of overlays) {
            const overlay = document.getElementById(id);
            if (overlay && !overlay.classList.contains('minimized')) {
                restrictOverlayPosition(overlay, {
                    translateX: id === 'cg-loading-overlay' 
                        ? (globalThis.innerWidth - overlay.offsetWidth) / 2 
                        : globalThis.innerWidth * 0.5 - 120,
                    translateY: id === 'cg-loading-overlay' 
                        ? globalThis.innerHeight * 0.2 - overlay.offsetHeight * 0.2 
                        : globalThis.innerHeight * 0.8
                });
            }
        }
    });

    console.log("Setting up button overlay");

    const buttonOverlay = document.createElement('div');
    buttonOverlay.id = 'cg-button-overlay';
    buttonOverlay.className = 'cg-overlay cg-button-overlay';

    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'cg-button-container';
    buttonContainer.style.padding = '20px';
    buttonContainer.style.width = '240px';
    buttonContainer.style.boxSizing = 'border-box';
    buttonContainer.style.display = 'flex';
    buttonContainer.style.flexDirection = 'column';
    buttonContainer.style.gap = '12px';

    const minimizeButton = document.createElement('button');
    minimizeButton.className = 'cg-minimize-button';
    minimizeButton.style.backgroundColor = '#3498db';
    minimizeButton.style.width = '14px';
    minimizeButton.style.height = '14px';
    minimizeButton.style.minWidth = '14px';
    minimizeButton.style.minHeight = '14px';
    minimizeButton.style.borderRadius = '50%';
    minimizeButton.style.border = 'none';
    minimizeButton.style.padding = '4px';
    minimizeButton.style.margin = '0';
    minimizeButton.style.cursor = 'pointer';
    minimizeButton.style.position = 'absolute';
    minimizeButton.style.top = '8px';
    minimizeButton.style.left = '8px';
    minimizeButton.style.boxSizing = 'border-box';

    function preventClickIfDragged(clonedButton, type) {
        let hasMoved = false;
        const MOVE_THRESHOLD = 5;

        clonedButton.addEventListener('mousedown', (e) => {
            hasMoved = false;
            const startX = e.clientX;
            const startY = e.clientY;

            const onMove = (moveEvent) => {
                const deltaX = moveEvent.clientX - startX;
                const deltaY = moveEvent.clientY - startY;
                if (Math.abs(deltaX) > MOVE_THRESHOLD || Math.abs(deltaY) > MOVE_THRESHOLD) {
                    hasMoved = true;
                }
            };

            const onUp = () => {
                if (!hasMoved) {
                    if(type === 'single')
                        globalThis.generate.generate_single.click();
                    else
                        globalThis.generate.generate_batch.click();
                }

                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
            };

            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });
    }
    
    function createClonedButtons() {
        const runButton = document.querySelector('.myButton-generate-button-single');
        const runRandomButton = document.querySelector('.myButton-generate-button-batch');

        if (!runButton || !runRandomButton) {
            console.warn('Source buttons not found');
            return null;
        }

        const clonedRunButton = runButton.cloneNode(true);
        const clonedRandomButton = runRandomButton.cloneNode(true);

        for (const button of [clonedRunButton, clonedRandomButton]) {
            button.classList.add('cg-overlay-button');
            button.style.width = '200px';
            button.style.height = '36px';
            button.style.boxSizing = 'border-box';
            button.style.padding = '10px 15px';
            button.style.display = 'inline-block';
            button.style.transition = 'background-color 0.3s ease';
        }

        const singleDefaultColor = globalThis.generate.generate_single.getDefaultColor();
        const singleHoverColor = globalThis.generate.generate_single.getHoverColor();
        const batchDefaultColor = globalThis.generate.generate_batch.getDefaultColor();
        const batchHoverColor = globalThis.generate.generate_batch.getHoverColor();

        clonedRunButton.style.backgroundColor = singleDefaultColor;
        clonedRandomButton.style.backgroundColor = batchDefaultColor;

        clonedRunButton.addEventListener('mouseover', () => {
            clonedRunButton.style.backgroundColor = singleHoverColor;
        });
        clonedRunButton.addEventListener('mouseout', () => {
            clonedRunButton.style.backgroundColor = singleDefaultColor;
        });

        clonedRandomButton.addEventListener('mouseover', () => {
            clonedRandomButton.style.backgroundColor = batchHoverColor;
        });
        clonedRandomButton.addEventListener('mouseout', () => {
            clonedRandomButton.style.backgroundColor = batchDefaultColor;
        });        

        preventClickIfDragged(clonedRandomButton, 'batch');
        preventClickIfDragged(clonedRunButton, 'single');

        return { clonedRunButton, clonedRandomButton };
    }

    const initialButtons = createClonedButtons();
    if (initialButtons) {
        buttonContainer.appendChild(initialButtons.clonedRandomButton);
        buttonContainer.appendChild(initialButtons.clonedRunButton);
    }

    buttonOverlay.appendChild(buttonContainer);
    buttonOverlay.appendChild(minimizeButton);
    document.body.appendChild(buttonOverlay);

    buttonOverlay.style.width = '240px';
    buttonOverlay.style.padding = '20px 20px 5px';
    buttonOverlay.style.boxSizing = 'border-box';

    const defaultPosition = {
        translateX: globalThis.innerWidth * 0.5 - 120,
        translateY: globalThis.innerHeight * 0.8
    };
    const savedPosition = JSON.parse(localStorage.getItem('overlayPosition'));
    let translateX, translateY;

    if (savedPosition?.top !== undefined && savedPosition.left !== undefined) {
        translateX = savedPosition.left;
        translateY = savedPosition.top;
    } else {
        translateX = defaultPosition.translateX;
        translateY = defaultPosition.translateY;
    }

    buttonOverlay.style.top = '0';
    buttonOverlay.style.left = '0';
    buttonOverlay.style.transform = `translate(${translateX}px, ${translateY}px)`;

    if (buttonOverlay.updateDragPosition) {
        buttonOverlay.updateDragPosition(translateX, translateY);
    }

    restrictOverlayPosition(buttonOverlay, defaultPosition);

    let isMinimized = false;
    let dragHandler;

    function enableDrag() {
        if (!dragHandler) {
            dragHandler = addDragFunctionality(buttonOverlay, () => {
                const loadingOverlay = document.getElementById('cg-loading-overlay');
                return loadingOverlay && !isMinimized ? loadingOverlay : null;
            });
        }
    }

    function disableDrag() {
        buttonOverlay.style.cursor = 'default';
        if (dragHandler) {
            dragHandler();
            dragHandler = null;
        }
        minimizeButton.style.pointerEvents = 'auto';
    }

    enableDrag();

    function setMinimizedState(overlay, container, button, isMin) {
        if (isMin) {
            overlay.classList.add('minimized');
            overlay.style.top = '0px';
            overlay.style.left = '0px';
            overlay.style.transform = 'none';
            overlay.style.width = '22px';
            overlay.style.height = '22px';
            overlay.style.minWidth = '22px';
            overlay.style.minHeight = '22px';
            overlay.style.padding = '0';
            container.style.display = 'none';
            button.style.top = '2px';
            button.style.left = '2px';
            disableDrag();
        } else {
            overlay.classList.remove('minimized');
            overlay.style.width = '240px';
            overlay.style.height = 'auto';
            overlay.style.minHeight = '110px';
            overlay.style.padding = '20px 20px 5px';
            container.style.display = 'flex';
            container.style.padding = '20px';

            const savedPosition = JSON.parse(localStorage.getItem('overlayPosition'));
            if (savedPosition?.top !== undefined && savedPosition.left !== undefined) {
                translateX = savedPosition.left;
                translateY = savedPosition.top;
            } else {
                translateX = defaultPosition.translateX;
                translateY = defaultPosition.translateY;
            }

            overlay.style.top = '0';
            overlay.style.left = '0';
            overlay.style.transform = `translate(${translateX}px, ${translateY}px)`;

            if (overlay.updateDragPosition) {
                overlay.updateDragPosition(translateX, translateY);
            }

            overlay.style.pointerEvents = 'auto';
            enableDrag();
            restrictOverlayPosition(overlay, defaultPosition);
        }
    }

    minimizeButton.addEventListener('click', (e) => {
        e.stopPropagation();
        isMinimized = !isMinimized;
        setMinimizedState(buttonOverlay, buttonContainer, minimizeButton, isMinimized);
    });

    function toggleButtonOverlayVisibility() {
        const loadingOverlay = document.getElementById('cg-loading-overlay');
        const errorOverlay = document.getElementById('cg-error-overlay');
        buttonOverlay.style.display = (loadingOverlay || errorOverlay) ? 'none' : 'flex';
        if (!isMinimized && buttonOverlay.style.display !== 'none') {
            const savedPosition = JSON.parse(localStorage.getItem('overlayPosition'));
            if (savedPosition?.top !== undefined && savedPosition.left !== undefined) {
                translateX = savedPosition.left;
                translateY = savedPosition.top;
            } else {
                translateX = defaultPosition.translateX;
                translateY = defaultPosition.translateY;
            }

            buttonOverlay.style.top = '0';
            buttonOverlay.style.left = '0';
            buttonOverlay.style.transform = `translate(${translateX}px, ${translateY}px)`;

            if (buttonOverlay.updateDragPosition) {
                buttonOverlay.updateDragPosition(translateX, translateY);
            }

            restrictOverlayPosition(buttonOverlay, defaultPosition);
        }
    }

    toggleButtonOverlayVisibility();

    const observer = new MutationObserver(toggleButtonOverlayVisibility);
    observer.observe(document.body, { childList: true, subtree: false });

    return { 
        reload: () => {            
            buttonContainer.innerHTML = '';

            const newButtons = createClonedButtons();            
            if (newButtons) {
                buttonContainer.appendChild(newButtons.clonedRandomButton);
                buttonContainer.appendChild(newButtons.clonedRunButton);
            } else {
                console.error('Failed to reload buttons - source buttons not found');
            }
        }
    };
}

function restrictOverlayPosition(element, defaultPosition) {
    if (!element) return;

    const rect = element.getBoundingClientRect();
    const isOutOfBounds = rect.top < 0 || rect.left < 0 ||
                         rect.bottom > globalThis.innerHeight || rect.right > globalThis.innerWidth;

    if (isOutOfBounds) {
        let translateX = defaultPosition.translateX;
        let translateY = defaultPosition.translateY;

        element.style.transform = `translate(${translateX}px, ${translateY}px)`;
        element.style.top = '0';
        element.style.left = '0';

        if (element.updateDragPosition) {
            element.updateDragPosition(translateX, translateY);
        }
    }
}

const dragStates = new WeakMap();
export function addDragFunctionality(element, getSyncElement) {
    if (dragStates.has(element)) {
        const cleanup = dragStates.get(element).cleanup;
        if (cleanup) cleanup();
    }
        
    let isDragging = false;
    let startX, startY;
    let state = { translateX: 0, translateY: 0, cleanup: null };
    dragStates.set(element, state);

    let rafId = null;

    element.style.position = 'fixed';
    element.style.willChange = 'transform';
    element.style.cursor = 'grab';

    let syncElement = typeof getSyncElement === 'function' ? getSyncElement() : null;

    const updateTransform = () => {
        element.style.transform = `translate(${state.translateX}px, ${state.translateY}px)`;
        element.style.top = '0';
        element.style.left = '0';
    
        syncElement = typeof getSyncElement === 'function' ? getSyncElement() : null;
        if (syncElement?.isConnected && !syncElement.classList.contains('minimized')) {
            syncElement.style.transform = `translate(${state.translateX}px, ${state.translateY}px)`;
            syncElement.style.top = '0';
            syncElement.style.left = '0';
        }

        localStorage.setItem('overlayPosition', JSON.stringify({
            top: state.translateY,
            left: state.translateX
        }));
    };

    const throttledUpdate = (callback) => {
        if (rafId) return;
        rafId = requestAnimationFrame(() => {
            callback();
            rafId = null;
        });
    };

    state.cleanup = () => {
        if (rafId) cancelAnimationFrame(rafId);
        element.removeEventListener('mousedown', onMouseDown);
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        dragStates.delete(element);
    };

    const onMouseDown = (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();

        isDragging = true;
        startX = e.clientX - state.translateX;
        startY = e.clientY - state.translateY;

        element.style.cursor = 'grabbing';
        document.body.style.userSelect = 'none';
        syncElement = typeof getSyncElement === 'function' ? getSyncElement() : null;
    };

    const onMouseMove = (e) => {
        if (!isDragging) return;
        e.preventDefault();
        e.stopPropagation();

        state.translateX = e.clientX - startX;
        state.translateY = e.clientY - startY;

        throttledUpdate(updateTransform);
    };

    const onMouseUp = (e) => {
        if (!isDragging) return;
        isDragging = false;
        element.style.cursor = 'grab';
        document.body.style.userSelect = '';

        const rect = element.getBoundingClientRect();
        const isOutOfBounds = rect.top < 0 || rect.left < 0 ||
                                rect.bottom > globalThis.innerHeight || rect.right > globalThis.innerWidth;

        if (isOutOfBounds) {
            if (element.id === 'cg-loading-overlay') {
                state.translateX = (globalThis.innerWidth - element.offsetWidth) / 2;
                state.translateY = globalThis.innerHeight * 0.2 - element.offsetHeight * 0.2;
            } else {
                state.translateX = globalThis.innerWidth * 0.5 - 120;
                state.translateY = globalThis.innerHeight * 0.8;
            }
        }

        updateTransform();
    };

    const savedPosition = localStorage.getItem('overlayPosition');
    if (savedPosition) {
        try {
            const { top, left } = JSON.parse(savedPosition);
            state.translateX = left || 0;
            state.translateY = top || 0;
            updateTransform();
        } catch (err) {
            console.error('Failed to parse saved position:', err);
            localStorage.removeItem('overlayPosition');
        }
    }

    element.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    element.updateDragPosition = (x, y) => {
        state.translateX = x;
        state.translateY = y;
        updateTransform();
    };

    return state.cleanup;
}

export function addCustomOverlayDragFunctionality(element, dragHandle, getSyncElement, storageKey = 'overlayPosition') {
    let isDragging = false;
    let startX, startY;

    element.style.position = 'fixed';
    dragHandle.style.cursor = 'grab';
    dragHandle.style.pointerEvents = 'auto'; 

    const onMouseDown = (e) => {
        if (!e.target.closest('.cg-drag-handle') || e.target.closest('.cg-close-button')) {
            return;
        }

        e.preventDefault();
        e.stopPropagation();

        isDragging = true;

        const computedStyle = globalThis.getComputedStyle(element);
        if (computedStyle.transform !== 'none' && !element.dataset.transformReset) {
            const rect = element.getBoundingClientRect();
            element.style.left = `${rect.left}px`;
            element.style.top = `${rect.top}px`;
            element.style.transform = 'none';
            element.dataset.transformReset = 'true';
        }

        const rect = element.getBoundingClientRect();
        startX = e.clientX - rect.left;
        startY = e.clientY - rect.top;

        element.classList.add('dragging');
        dragHandle.style.cursor = 'grabbing';
        dragHandle.style.userSelect = 'none';

        element._onMouseMove = onMouseMove;
        element._onMouseUp = onMouseUp;
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    const onMouseMove = (e) => {
        if (!isDragging) return;
        e.preventDefault();
        e.stopPropagation();

        const newLeft = e.clientX - startX;
        const newTop = e.clientY - startY;

        element.style.left = `${newLeft}px`;
        element.style.top = `${newTop}px`;
        element.style.transform = 'none';

        const syncElement = typeof getSyncElement === 'function' ? getSyncElement() : null;
        if (syncElement && syncElement.style.display !== 'none') {
            syncElement.style.left = `${newLeft}px`;
            syncElement.style.top = `${newTop}px`;
            syncElement.style.transform = 'none';
        }
    };

    const onMouseUp = (e) => {
        if (!isDragging) return;
        isDragging = false;
        element.classList.remove('dragging');
        dragHandle.style.cursor = 'grab';
        dragHandle.style.userSelect = '';

        const rect = element.getBoundingClientRect();
        const newLeft = rect.left;
        const newTop = rect.top;

        localStorage.setItem(storageKey, JSON.stringify({ top: newTop, left: newLeft }));

        if (rect.top < 0 || rect.left < 0 || rect.bottom > globalThis.innerHeight || rect.right > globalThis.innerWidth) {
            const defaultTop = globalThis.innerHeight * 0.1;
            const defaultLeft = globalThis.innerWidth * 0.5 - (element.offsetWidth / 2);
            element.style.top = `${defaultTop}px`;
            element.style.left = `${defaultLeft}px`;
            element.style.transform = 'none';

            const syncElement = typeof getSyncElement === 'function' ? getSyncElement() : null;
            if (syncElement) {
                syncElement.style.top = `${defaultTop}px`;
                syncElement.style.left = `${defaultLeft}px`;
                syncElement.style.transform = 'none';
            }
            localStorage.setItem(storageKey, JSON.stringify({ top: defaultTop, left: defaultLeft }));
        }

        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        element._onMouseMove = null;
        element._onMouseUp = null;
    };

    dragHandle.addEventListener('mousedown', onMouseDown);

    return () => {
        dragHandle.removeEventListener('mousedown', onMouseDown);
        if (element._onMouseMove) document.removeEventListener('mousemove', element._onMouseMove);
        if (element._onMouseUp) document.removeEventListener('mouseup', element._onMouseUp);
        element._onMouseMove = null;
        element._onMouseUp = null;
    };
}

export function addResizeFunctionality(element, handle, storageKey = 'customOverlaySize') {
    let isResizing = false;
    let startX, startY, startWidth, startHeight;

    const onMouseDown = (e) => {
        e.preventDefault();
        e.stopPropagation();

        isResizing = true;
        startX = e.clientX;
        startY = e.clientY;
        startWidth = Number.parseFloat(getComputedStyle(element).width);
        startHeight = Number.parseFloat(getComputedStyle(element).height);

        element.classList.add('resizing');
        document.body.style.userSelect = 'none';
        element._onResizeMove = onMouseMove;
        element._onResizeUp = onMouseUp;
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    const onMouseMove = (e) => {
        if (!isResizing) return;
        e.preventDefault();
        e.stopPropagation();

        const newWidth = Math.max(200, Math.min(1600, startWidth + (e.clientX - startX)));
        const newHeight = Math.max(150, Math.min(1600, startHeight + (e.clientY - startY)));

        element.style.width = `${newWidth}px`;
        element.style.height = `${newHeight}px`;
    };

    const onMouseUp = (e) => {
        if (!isResizing) return;
        isResizing = false;
        element.classList.remove('resizing');
        document.body.style.userSelect = '';

        const finalWidth = Number.parseFloat(getComputedStyle(element).width);
        const finalHeight = Number.parseFloat(getComputedStyle(element).height);
        localStorage.setItem(storageKey, JSON.stringify({
            width: finalWidth,
            height: finalHeight
        }));

        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        element._onResizeMove = null;
        element._onResizeUp = null;
    };

    handle.addEventListener('mousedown', onMouseDown, { capture: true });

    return () => {
        handle.removeEventListener('mousedown', onMouseDown, { capture: true });
        if (element._onResizeMove) document.removeEventListener('mousemove', element._onResizeMove);
        if (element._onResizeUp) document.removeEventListener('mouseup', element._onResizeUp);
        element._onResizeMove = null;
        element._onResizeUp = null;
    };
}

function createInfoOverlay({ id, content, className = '', onClick = null }) {
    let overlay = document.getElementById(id);
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = id;
        overlay.className = `cg-overlay ${className}`;
        document.body.appendChild(overlay);
    }        
    overlay.innerHTML = content;
    if (onClick) overlay.onclick = onClick;
    return overlay;
}

function createErrorOverlay(errorMessage, copyMessage) {
    const displayMessage = parseTaggedContent(errorMessage);

    const overlay = createInfoOverlay({
        id: 'cg-error-overlay',
        className: 'cg-overlay-error',
        content: `
            <div class="cg-error-content">
                <img src="${globalThis.cachedFiles.loadingFailed}" alt="Error">
                <pre>${displayMessage}</pre>
            </div>
        `,
        onClick: async (e) => {
            if (e.target.tagName === 'A') {
                e.stopPropagation();
                return;
            }
            try {
                await navigator.clipboard.writeText(copyMessage);
            } catch (err){
                console.warn('Failed to copy:', err);
                const SETTINGS = globalThis.globalSettings;
                const FILES = globalThis.cachedFiles;
                const LANG = FILES.language[SETTINGS.language];
                createCustomOverlay('none', LANG.saac_macos_clipboard.replace('{0}', copyMessage),
                                    384, 'center', 'left', null, 'Clipboard');
            }
            document.getElementById('cg-error-overlay').remove();
        }
    });
    overlay.style.width = 'fit-content';
    overlay.style.minWidth = '200px';
    overlay.style.maxWidth = 'min(1000px, 90vw)';
    overlay.style.boxSizing = 'border-box';
    overlay.style.padding = '20px';

    const contentPre = overlay.querySelector('.cg-error-content pre');
    if (contentPre) {
        contentPre.style.boxSizing = 'border-box';
        contentPre.style.wordWrap = 'break-word';
        contentPre.style.whiteSpace = 'pre-wrap'; 
    }

    return overlay;
}

function createLoadingOverlay(loadingMessage, elapsedTimePrefix, elapsedTimeSuffix) {
    let currentImage = globalThis.cachedFiles.loadingWait;
    let lastBase64 = currentImage;
    let pendingImage = null;
    let loadingTitle = loadingMessage;

    const overlay = createInfoOverlay({
        id: 'cg-loading-overlay',
        className: '',
        content: `
            <img id="cg-loading-overlay-image" src="${currentImage}" alt="Loading">
            <span class="cg-overlay-title">${loadingMessage || 'Now generating...'}</span>
            <span class="cg-overlay-timer">${elapsedTimePrefix || 'Elapsed time:'} 0 ${elapsedTimeSuffix || 'seconds'}</span>
        `
    });
    overlay.style.zIndex = '10001';
    overlay.style.pointerEvents = 'auto';

    const savedPosition = JSON.parse(localStorage.getItem('overlayPosition') || '{}');
    const buttonOverlay = document.getElementById('cg-button-overlay');
    let translateX, translateY;

    if (savedPosition.top !== undefined && savedPosition.left !== undefined) {
        translateX = savedPosition.left;
        translateY = savedPosition.top;
    } else if (buttonOverlay && !buttonOverlay.classList.contains('minimized')) {
        const rect = buttonOverlay.getBoundingClientRect();
        translateX = rect.left;
        translateY = rect.top;
    } else {
        translateX = (globalThis.innerWidth - overlay.offsetWidth) / 2;
        translateY = globalThis.innerHeight * 0.2 - overlay.offsetHeight * 0.2;
    }

    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.transform = `translate(${translateX}px, ${translateY}px)`;

    if (overlay.updateDragPosition) {
        overlay.updateDragPosition(translateX, translateY);
    }

    restrictOverlayPosition(overlay, {
        translateX: (globalThis.innerWidth - overlay.offsetWidth) / 2,
        translateY: globalThis.innerHeight * 0.2 - overlay.offsetHeight * 0.2
    });
        
    const startTime = Date.now();
    if (overlay.dataset.timerInterval) clearInterval(overlay.dataset.timerInterval);
    const intervalId = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const timerElement = overlay.querySelector('.cg-overlay-timer');
        if (timerElement) {
            timerElement.textContent = `${elapsedTimePrefix || 'Elapsed time:'} ${elapsed} ${elapsedTimeSuffix || 'seconds'}`;
        }
        const titleElement = overlay.querySelector('.cg-overlay-title');
        if (titleElement) {                
            titleElement.textContent = `${globalThis.generate.loadingMessage || loadingTitle}`;
        }
        if (pendingImage && pendingImage !== lastBase64) {
            lastBase64 = pendingImage;
            currentImage = pendingImage;
            const imgElement = overlay.querySelector('img');
            if (imgElement) {
                imgElement.src = currentImage;
                imgElement.style.maxWidth = '256px';
                imgElement.style.maxHeight = '384px';
                imgElement.style.objectFit = 'contain';
                imgElement.onerror = () => {
                    currentImage = globalThis.cachedFiles.loadingWait;
                    lastBase64 = currentImage;
                    imgElement.src = currentImage;
                    imgElement.style.maxWidth = '128px';
                    imgElement.style.maxHeight = '128px';
                    imgElement.onerror = null;
                };
            }
        }
    }, 100);

    overlay.dataset.timerInterval = intervalId;

    overlay._cleanup = () => {
        if (overlay.dataset.timerInterval) {
            clearInterval(overlay.dataset.timerInterval);
            delete overlay.dataset.timerInterval;
        }
    };

    return overlay;
}

// eslint-disable-next-line sonarjs/cognitive-complexity
function createCustomOverlay(
    image, 
    message, 
    imageWidth=384, 
    imageAlign='center', 
    textAlign='left', 
    className = null,
    group = 'default'
) {
    const displayMessage = (typeof message === 'string' && message.trim()) ? message : '\nNo content provided';
    
    let images = [];
    if (image && image !== 'none') {
        if (typeof image === 'string') {
            images = [image];
        } else if (Array.isArray(image)) {
            images = image.filter(img => img && typeof img === 'string');
        }
    }
    
    const hasImages = images.length > 0;

    const processedMessage = parseTaggedContent(displayMessage)
        .replaceAll('\n', '<br>')
        .replaceAll(
            /\[COPY_URL\](https?:\/\/[^\s]+)\[\/COPY_URL\]/g,
            '<a href="$1" target="_blank" style="color: #1e90ff; text-decoration: underline;">$1</a>'
        )
        .replaceAll(
            /\[COPY_CUSTOM(?:=(#[0-9A-Fa-f]{6}|[a-zA-Z]+))?\](.+?)\[\/COPY_CUSTOM\]/g,
            (match, color, text) => {
                const colorStyle = color || '#ffffff';
                return `<span style="color: ${colorStyle}">${text}</span>`;
            }
        );

    const uniqueId = `cg-custom-overlay-${++customOverlayCounter}`;
    const sizeStorageKey = `customOverlaySize-${group}`;
    const positionStorageKey = `customOverlayPosition-${group}`;
    
    const overlay = document.createElement('div');
    overlay.id = uniqueId;
    overlay.className = 'cg-overlay cg-custom-overlay';
    overlay.dataset.group = group;
    overlay.innerHTML = `
        <div class="cg-custom-content">
            <div class="cg-drag-handle"></div>
            <div class="cg-custom-textbox scroll-container"></div>
        </div>
    `;
    document.body.appendChild(overlay);

    const textbox = overlay.querySelector('.cg-custom-textbox');
    textbox.style.display = 'block'; 
    textbox.style.overflowY = 'auto';
    textbox.style.padding = '10px';
    textbox.style.maxHeight = '100%';

    const fragment = document.createDocumentFragment();

    if (hasImages) {
        const imageContainer = document.createElement('div');
        imageContainer.className = 'cg-image-container';
        imageContainer.style.display = 'flex';
        imageContainer.style.gap = '10px';
        imageContainer.style.marginTop = '25px';
        imageContainer.style.marginBottom = '15px';
        imageContainer.style.width = `${imageWidth}px`;
        imageContainer.style.flexDirection = 'row';
        if (images.length > 1) {
            imageContainer.style.width = `${imageWidth*0.75}px`;
        }

        for (const [index, imageData] of images.entries()) {
            const imgWrapper = document.createElement('div');
            imgWrapper.className = 'cg-image-wrapper';
            imgWrapper.style.display = 'inline-flex';
            imgWrapper.style.marginBottom = '5px';
            imgWrapper.style.flex = '0 0 auto';

            const img = document.createElement('img');
            img.src = imageData.startsWith('data:') ? imageData : `data:image/webp;base64,${imageData}`;
            img.alt = `Overlay Image ${index + 1}`;
            img.style.minWidth = '64px';
            img.style.maxHeight = '64px';
            img.style.maxWidth = `${imageWidth}px`;
            img.style.maxHeight = `${imageWidth}px`;
            img.style.objectFit = 'contain';
            img.style.display = 'block';
            img.style.borderRadius = '4px';
            img.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';

            if (images.length > 1) {
                img.style.maxWidth = `${imageWidth * 0.75}px`;
                img.style.maxHeight = `${imageWidth * 0.75}px`;
            }

            img.onerror = () => {
                console.warn(`Failed to load image ${index + 1}, removing from overlay`);
                imgWrapper.remove();
            };

            imgWrapper.appendChild(img);
            imageContainer.appendChild(imgWrapper);
        }

        fragment.appendChild(imageContainer);
    }

    const textDiv = document.createElement('div');
    textDiv.className = `cg-custom-textbox-data`;
    textDiv.innerHTML = processedMessage;
    textDiv.style.whiteSpace = 'pre-wrap'; 
    textDiv.style.wordBreak = 'break-word';
    textDiv.style.width = '100%';
    textDiv.style.imageAlign = imageAlign;
    textDiv.style.textAlign = textAlign;
    fragment.appendChild(textDiv);

    textbox.appendChild(fragment);

    const closeButton = document.createElement('button');
    closeButton.className = 'cg-close-button';

    closeButton.addEventListener('click', (e) => {
        e.stopPropagation();
        overlay.remove();
        document.removeEventListener('mousemove', overlay._onMouseMove);
        document.removeEventListener('mouseup', overlay._onMouseUp);
        document.removeEventListener('mousemove', overlay._onResizeMove);
        document.removeEventListener('mouseup', overlay._onResizeUp);
        if (overlay._cleanup) overlay._cleanup();
    });
    overlay.appendChild(closeButton);

    const dragHandle = overlay.querySelector('.cg-drag-handle');    
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'cg-resize-handle'; 
            
    overlay.appendChild(resizeHandle);
    overlay.style.pointerEvents = 'auto';
    overlay.style.position = 'relative'; 

    let defaultWidth = 600;
    let defaultHeight = 800;
    
    if (hasImages) {
        if (images.length > 1) {
            defaultWidth = Math.min(1200, Math.max(800, images.length * 320));
        }
        defaultHeight = Math.max(600, defaultHeight);
    }

    const defaultSize = { width: defaultWidth, height: defaultHeight };

    // Get size from group
    let savedSize;
    try {
        savedSize = localStorage.getItem(sizeStorageKey) ? JSON.parse(localStorage.getItem(sizeStorageKey)) : null;
    } catch (err) {
        console.error('Failed to parse customOverlaySize:', err);
        localStorage.removeItem(sizeStorageKey);
    }
    let initialWidth = defaultSize.width;
    let initialHeight = defaultSize.height;

    if (savedSize && savedSize.width >= 200 && savedSize.width <= 1600 && savedSize.height >= 150 && savedSize.height <= 1600) {
        initialWidth = savedSize.width;
        initialHeight = savedSize.height;
    }

    overlay.style.width = `${initialWidth}px`;
    overlay.style.height = `${initialHeight}px`;

    // Get position from group
    let savedPosition;
    try {
        savedPosition = localStorage.getItem(positionStorageKey) ? JSON.parse(localStorage.getItem(positionStorageKey)) : null;
    } catch (err) {
        console.error('Failed to parse customOverlayPosition:', err);
        localStorage.removeItem(positionStorageKey);
    }
    if (savedPosition?.top !== undefined && savedPosition.left !== undefined) {
        overlay.style.position = 'fixed';
        overlay.style.top = `${savedPosition.top}px`;
        overlay.style.left = `${savedPosition.left}px`;
        overlay.style.transform = 'none';
    } else {
        overlay.style.position = 'fixed';
        overlay.style.top = '10%';
        overlay.style.left = '50%';
        overlay.style.transform = 'translate(-50%, -10%)';
    }

    const adjustOverlaySize = () => {
        const rect = overlay.getBoundingClientRect();
        const resizeHandleOffset = 4;
        const rightEdge = rect.left + rect.width - resizeHandleOffset;
        const bottomEdge = rect.top + rect.height - resizeHandleOffset;
        const viewportWidth = globalThis.innerWidth;
        const viewportHeight = globalThis.innerHeight;
        const padding = 10;

        let newWidth = rect.width;
        let newHeight = rect.height;

        if (rightEdge > viewportWidth - padding) {
            newWidth = viewportWidth - rect.left - padding;
            newWidth = Math.max(newWidth, 200);
        }
        if (bottomEdge > viewportHeight - padding) {
            newHeight = viewportHeight - rect.top - padding;
            newHeight = Math.max(newHeight, 150);
        }

        if (newWidth !== rect.width || newHeight !== rect.height) {
            overlay.style.width = `${newWidth}px`;
            overlay.style.height = `${newHeight}px`;
            localStorage.setItem(sizeStorageKey, JSON.stringify({
                width: newWidth,
                height: newHeight
            }));
        }
    };

    requestAnimationFrame(adjustOverlaySize);

    // passing data
    const resizeCleanup = addResizeFunctionality(overlay, resizeHandle, sizeStorageKey);
    const dragCleanup = addCustomOverlayDragFunctionality(overlay, dragHandle, () => null, positionStorageKey);

    overlay._cleanup = () => {
        dragCleanup();
        resizeCleanup();
        if (overlay.dataset.timerInterval) {
            clearInterval(overlay.dataset.timerInterval);
            delete overlay.dataset.timerInterval;
        }
        overlay.remove();
    };

    if (className) {
        const customContainer = document.createElement('div');
        customContainer.className = className;        
        textbox.appendChild(customContainer);

        return {
            overlay: overlay,
            container: customContainer,
            group: group,
            close: () => {
                if (overlay._cleanup) overlay._cleanup();
                else overlay.remove();
            },
            setText: (message) => {
                textDiv.innerHTML = parseTaggedContent(message).replaceAll('\n', '<br>')
                .replaceAll(
                    /\[COPY_URL\](https?:\/\/[^\s]+)\[\/COPY_URL\]/g,
                    '<a href="$1" target="_blank" style="color: #1e90ff; text-decoration: underline;">$1</a>'
                )
                .replaceAll(
                    /\[COPY_CUSTOM(?:=(#[0-9A-Fa-f]{6}|[a-zA-Z]+))?\](.+?)\[\/COPY_CUSTOM\]/g,
                    (match, color, text) => {
                        const colorStyle = color || '#ffffff';
                        return `<span style="color: ${colorStyle}">${text}</span>`;
                    }
                );
            }
        };
    }

    return overlay;
}

export function customCommonOverlay() {
    return { createErrorOverlay, createLoadingOverlay, createCustomOverlay };
}
