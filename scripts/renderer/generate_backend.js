import { customCommonOverlay } from './customOverlay.js';

let galleryPreviewProgress = 0;

function updateGalleryPreviewProgress() {
    const progressBar = document.querySelector('.cg-minimized-generation-preview-progress');
    if (progressBar) {
        progressBar.style.width = `${galleryPreviewProgress * 100}%`;
    }
}

export function from_main_updateGallery(base64, seed, tagsString, info){
    globalThis.mainGallery.appendImageData(base64, seed, tagsString, globalThis.globalSettings.scroll_to_last, info);
}

export function from_main_updatePreview(base64){
    const buttonOverlay = document.getElementById('cg-button-overlay');
    if (buttonOverlay?.dataset.minimized === 'true' || globalThis.globalSettings.gallery_preview) {
        const galleryContainer = document.querySelector('.gallery-main-main');
        if (!galleryContainer) return;

        let previewContainer = galleryContainer.querySelector('.cg-minimized-generation-preview-container');
        if (!previewContainer) {
            galleryPreviewProgress = 0;
            previewContainer = document.createElement('div');
            previewContainer.className = 'cg-minimized-generation-preview-container';
            previewContainer.innerHTML = `
                <div class="cg-minimized-generation-preview-track">
                    <div class="cg-minimized-generation-preview-progress"></div>
                </div>
                <img class="cg-minimized-generation-preview" alt="Generation preview">
            `;
        }
        galleryContainer.appendChild(previewContainer);

        const preview = previewContainer.querySelector('.cg-minimized-generation-preview');
        if (preview) {
            preview.src = base64;
            preview.onerror = () => {
                preview.src = globalThis.cachedFiles.loadingWait;
                preview.onerror = null;
            };
        }
        updateGalleryPreviewProgress();
        return;
    }

    let overlay = document.getElementById('cg-loading-overlay');
    if (!overlay) {
        overlay = customCommonOverlay().createLoadingOverlay();
    }
    const imgElement = overlay.querySelector('img');
    if (imgElement) {
        imgElement.src = base64;
        imgElement.style.maxWidth = '256px';
        imgElement.style.maxHeight = '384px';
        imgElement.style.objectFit = 'contain';
        imgElement.onerror = () => {
            imgElement.src = globalThis.cachedFiles.loadingWait;
            imgElement.style.maxWidth = '192px';
            imgElement.style.maxHeight = '192px';
            imgElement.onerror = null;
        };
    } 
}

export function from_main_customOverlayProgress(progress, totalProgress){
    const progressValue = Number.parseFloat(progress);
    const totalValue = Number.parseFloat(totalProgress);
    if (Number.isFinite(progressValue) && Number.isFinite(totalValue) && totalValue > 0) {
        galleryPreviewProgress = Math.min(1, Math.max(0, progressValue / totalValue));
        updateGalleryPreviewProgress();
    }

    try {
        const loadingMessage = globalThis.generate.loadingMessage.split('<')[0];
        globalThis.generate.loadingMessage = `${loadingMessage} <${progress}/${totalProgress}>`;
    } catch {
        // by pass
    }
}

export function from_renderer_generate_updatePreview(base64) {
    from_main_updatePreview(base64);
}
