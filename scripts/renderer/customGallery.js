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
    let overlay = document.getElementById('cg-mode-switch-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'cg-mode-switch-overlay';
        overlay.className = 'cg-mode-switch-overlay';
        overlay.innerHTML = `
            <div class="cg-mode-switch-spinner"></div>
            <div class="cg-mode-switch-text">Switching Gallery Mode...</div>
        `;
        container.appendChild(overlay);
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
        setTimeout(() => {
            overlay.classList.remove('visible');
            setTimeout(() => overlay.remove(), 300);
        }, 10000); // 10 seconds
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

function process_oberserver(entries, observer) {
    for (const entry of entries) {
        if (entry.isIntersecting) {
            const imgContainer = entry.target;
            const img = imgContainer.querySelector('img');
            img.src = img.dataset.src; 
            imgContainer.classList.add('visible');
            observer.unobserve(imgContainer);
        }
    }
}

export function setupGallery(containerId) {
    if (globalThis.mainGallery.isGallerySetup) return;
    globalThis.mainGallery.isGallerySetup = true;
    globalThis.mainGallery.isLoading = false;

    let isGridMode = false;
    let currentIndex = 0;
    let privacyBalls = [];
    let images = [];
    let seeds = [];
    let tags = [];
    let renderedImageCount = 0;

    const container = document.querySelector(`.${containerId}`);
    if (!container) {
        console.error('Gallery container not found', containerId);
        return;
    }

    globalThis.mainGallery.clearGallery = function () {
        images = [];
        seeds = [];
        tags = [];
        renderedImageCount = 0;
        currentIndex = 0;
        container.innerHTML = '';
    };

    globalThis.mainGallery.appendImageData = function (base64, seed, tagsString, keep_gallery, switchToLatest = false) {
        if ('False' === keep_gallery) {
            globalThis.mainGallery.clearGallery();
        }

        images.push(base64); 
        seeds.push(seed);
        tags.push(tagsString || '');

        if (seeds.length !== tags.length || images.length !== seeds.length) {
            console.warn('[appendImageData] Mismatch: images:', images.length, 'seeds:', seeds.length, 'tags:', tags.length);
        }

        let incremental = true;
        if (switchToLatest && !isGridMode) {
            currentIndex = images.length - 1;
            incremental = false;
        }

        if (isGridMode) {
            gallery_renderGridMode(true);
        } else {
            gallery_renderSplitMode(incremental);
        }
    };

    globalThis.mainGallery.showLoading = function (loadingMEssage, elapsedTimePrefix, elapsedTimeSuffix) {        
        const loadingOverlay = customCommonOverlay().createLoadingOverlay(loadingMEssage, elapsedTimePrefix, elapsedTimeSuffix);
        const buttonOverlay = document.getElementById('cg-button-overlay');
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
        if ('success' !== errorMessage) {
            console.error('Got Error from backend:', copyMessage);
            customCommonOverlay().createErrorOverlay(errorMessage, copyMessage);
        }
        globalThis.mainGallery.isLoading = false;
    };

    function ensurePrivacyButton() {
        let privacyButton = document.getElementById('cg-privacy-button');
        if (!privacyButton) {
            privacyButton = document.createElement('button');
            privacyButton.id = 'cg-privacy-button';
            privacyButton.className = 'cg-button';
            privacyButton.textContent = '(X)';
            privacyButton.style.top = '50px';
            privacyButton.style.left = '10px';
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
            }
        }
    }

    function gallery_renderGridMode(incremental = false) {        
        if (!images || images.length === 0) {
            container.innerHTML = '';
            renderedImageCount = 0;
            currentIndex = 0;
            return;
        }
            
        let gallery = container.querySelector('.cg-gallery-grid-container');
        let lastAspectRatio = Number.parseFloat(localStorage.getItem('gridAspectRatio') || '0');
    
        const containerWidth = container.offsetWidth;
        const firstImage = new Image();
        firstImage.src = images.at(-1);
        firstImage.onload = () => {
            const aspectRatio = firstImage.width / firstImage.height;
            const needsRedraw = !incremental || Math.abs(aspectRatio - lastAspectRatio) > 0.001;
    
            if (!gallery || needsRedraw) {
                container.innerHTML = '';
                gallery = document.createElement('div');
                gallery.className = 'cg-gallery-grid-container scroll-container';
                container.appendChild(gallery);
                renderedImageCount = 0;
                gallery.addEventListener('click', (e) => {
                    const imgContainer = e.target.closest('.cg-gallery-item');
                    if (imgContainer) {
                        const index = Number.parseInt(imgContainer.dataset.index);
                        currentIndex = index; 
                        enterFullscreen(index);
                    }
                });
            }
    
            const targetHeight = 200;
            const targetWidth = targetHeight * aspectRatio;
            const itemsPerRow = Math.floor(containerWidth / (targetWidth + 10));
            gallery.style.gridTemplateColumns = `repeat(${itemsPerRow}, ${targetWidth}px)`;
    
            const fragment = document.createDocumentFragment();
            const observer = new IntersectionObserver((entries, observer) => {
                process_oberserver(entries, observer);
            }, { root: gallery, threshold: 0.1 });
    
            for (let i = images.length - 1; i >= renderedImageCount; i--) {
                const imgContainer = document.createElement('div');
                imgContainer.className = 'cg-gallery-item';
                imgContainer.style.width = `${targetWidth}px`;
                imgContainer.style.height = `${targetHeight}px`;
                imgContainer.dataset.index = i;
                const img = document.createElement('img');
                img.className = 'cg-gallery-image';
                img.dataset.src = images[i]; 
                img.src = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='; 
                img.loading = 'lazy';
                imgContainer.appendChild(img);
                fragment.appendChild(imgContainer);
                observer.observe(imgContainer); 
            }
            gallery.prepend(fragment);
            renderedImageCount = images.length;
    
            localStorage.setItem('gridAspectRatio', aspectRatio.toString());
    
            ensureSwitchModeButton(container, () => {
                isGridMode = !isGridMode;
                currentIndex = images.length - 1;
                isGridMode ? gallery_renderGridMode() : gallery_renderSplitMode();
            }, 'cg-switch-mode-button', images.length);
            ensurePrivacyButton();
        };
        firstImage.onerror = () => {
            console.error('Failed to load latest image for grid mode');
            container.innerHTML = '';
            renderedImageCount = 0;
            currentIndex = 0;
        };
    }
    
    function gallery_renderSplitMode(incremental = false) {
        if (!images || images.length === 0) {
            container.innerHTML = '';
            renderedImageCount = 0;
            currentIndex = 0;
            return;
        }

        let mainImageContainer = container.querySelector('.cg-main-image-container');
        let previewContainer = container.querySelector('.cg-preview-container');

        if (!mainImageContainer || !previewContainer || !incremental) {
            container.innerHTML = '';
            mainImageContainer = document.createElement('div');
            mainImageContainer.className = 'cg-main-image-container';
            const mainImage = document.createElement('img');
            mainImage.src = images[currentIndex];
            mainImage.className = 'cg-main-image';
            mainImage.addEventListener('click', () => enterFullscreen(currentIndex));
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

        ensureSwitchModeButton(container, () => {
            isGridMode = !isGridMode;
            currentIndex = images.length - 1;
            isGridMode ? gallery_renderGridMode() : gallery_renderSplitMode();
        }, 'cg-switch-mode-button', images.length);
        ensureSeedButton();
        ensureTagButton();
        ensurePrivacyButton();
        adjustPreviewContainer(previewContainer);
    }
    
    function updatePreviewBorders() {
        const previewImages = container.querySelectorAll('.cg-preview-image');
        for (const [domIndex, child] of [...previewImages].entries()) {
            const index = images.length - 1 - domIndex;
            child.dataset.domIndex = domIndex;
            child.style.border = index === currentIndex ? '2px solid #3498db' : 'none';
        }
        const domIndex = images.length - 1 - currentIndex;
        if (domIndex >= 0 && domIndex < previewImages.length) {
            previewImages[domIndex].scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }
    }

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
}
