import { createControlNetButtons } from './components/imageInfoControlNet.js';
import { createImageTagger } from './components/imageInfoTagger.js';
import { handlePastedJsonOrCsvFile, handlePastedPlainTextItem } from './components/imageInfoDataFiles.js';
import { extractImageMetadata, parseGenerationParameters } from './components/imageInfoMetadata.js';
import { createMiraITUWindow } from './components/imageInfoMiraITU.js';
import { fileToBase64 } from './generate.js';

let cachedImage = '';

export function setupImageUploadOverlay() {
    const fullBody = document.querySelector('#full-body');
    
    const SETTINGS = globalThis.globalSettings;
    const FILES = globalThis.cachedFiles;
    const LANG = FILES.language[SETTINGS.language];
    
    function defaultUploadOverlaySize(){
        const width = globalThis.innerWidth;
        const height = globalThis.innerHeight;
        uploadOverlay.style.width = `${width*0.6}px`;
        uploadOverlay.style.height = `${height*0.6}px`;
        uploadOverlay.style.minWidth = `768px`;
        uploadOverlay.style.minHeight = `768px`;
        uploadOverlay.style.maxWidth = `${width*0.6}px`;
        uploadOverlay.style.maxHeight = `${height*0.6}px`;
        uploadOverlay.style.top = `${(width - width*0.6) / 2}px`;
        uploadOverlay.style.left = `${(height - height*0.6) / 2}px`;

        closeButton.style.display = 'none';
    }

    function showImageUploadOverlaySize(imageWidth, imageHeight){
        uploadOverlay.style.width = `${imageWidth}px`;
        uploadOverlay.style.height = `${imageHeight}px`;

        const width = uploadOverlay.getBoundingClientRect().width;
        const height = uploadOverlay.getBoundingClientRect().height;

        uploadOverlay.style.top = `${Math.floor((globalThis.innerHeight - height) / 2)}px`;
        uploadOverlay.style.left = `${Math.floor((globalThis.innerWidth - width) / 2)}px`;

        closeButton.style.display = 'flex';
    }

    const uploadOverlay = document.createElement('div');
    uploadOverlay.className = 'im-image-upload-overlay';
    uploadOverlay.style.display = 'none'; 
    fullBody.appendChild(uploadOverlay);

    const hintContainer = document.createElement('div');
    hintContainer.className = 'drag-hint-container';
    const topHint = document.createElement('div');
    topHint.className = 'drag-hint-top';
    const bottomHint = document.createElement('div');
    bottomHint.className = 'drag-hint-bottom';
    hintContainer.appendChild(topHint);
    hintContainer.appendChild(bottomHint);
    uploadOverlay.appendChild(hintContainer);
    updateHintText(LANG.image_info_drag_hint_top, LANG.image_info_drag_hint_bottom);

    const closeButton = document.createElement('button');
    closeButton.className = 'cg-close-button';
    closeButton.style.display = 'none'; 
    closeButton.addEventListener('click', (e) => {
        e.stopPropagation();
        hideOverlay();
    });
    uploadOverlay.appendChild(closeButton);

    defaultUploadOverlaySize();

    const svgIcon = document.createElement('div');
    svgIcon.id = 'upload-svg-icon';
    svgIcon.innerHTML = `
        <img class="filter-controlnet-icon" id="global-image-upload-icon" src="scripts/svg/image-upload.svg" alt="Upload" fill="currentColor">
        <img class="filter-controlnet-icon" id="global-file-upload-icon" src="scripts/svg/file-upload.svg" alt="Upload" fill="currentColor">
        <img class="filter-controlnet-icon" id="global-clipboard-paste-icon" src="scripts/svg/paste.svg" alt="Upload" fill="currentColor">
    `;
    uploadOverlay.appendChild(svgIcon);

    const imagePreview = document.createElement('div');
    imagePreview.id = 'image-preview-container';
    imagePreview.style.display = 'none';
    const previewImg = document.createElement('img');
    previewImg.id = 'preview-image';
    previewImg.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        hideOverlay();
    });

    let isDragging = false;
    let isShowing = false;
    let dragStartX, dragStartY, initialLeft, initialTop;
    previewImg.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        isDragging = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        initialLeft = Number.parseFloat(getComputedStyle(uploadOverlay).left) || 0;
        initialTop = Number.parseFloat(getComputedStyle(uploadOverlay).top) || 0;
        previewImg.style.cursor = 'grabbing';
    });
    document.addEventListener('mousemove', (e) => {
        if (isDragging) {
            const deltaX = e.clientX - dragStartX;
            const deltaY = e.clientY - dragStartY;
            uploadOverlay.style.left = `${initialLeft + deltaX}px`;
            uploadOverlay.style.top = `${initialTop + deltaY}px`;
        }
    });
    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            previewImg.style.cursor = 'grab';
        } else if (isShowing && !globalThis.currentImageMetadata) {
            hideOverlay();
        } 
    });
    imagePreview.appendChild(previewImg);
    uploadOverlay.appendChild(imagePreview);

    const metadataContainer = document.createElement('div');
    metadataContainer.id = 'metadata-container';
    metadataContainer.style.maxHeight = '150px';
    metadataContainer.style.display = 'none'; 
    uploadOverlay.appendChild(metadataContainer);

    const updateDynamicHeights = () => {
        const isImageDisplayed = imagePreview.style.display !== 'none';
        if (isImageDisplayed) {
            const imageWidth = previewImg.getBoundingClientRect().width;
            const imageHeight = previewImg.getBoundingClientRect().height;                       
            metadataContainer.style.display = 'center';
            showImageUploadOverlaySize(imageWidth, imageHeight);
        } else {
            metadataContainer.style.display = 'none';
            defaultUploadOverlaySize();
        }
    };
    requestAnimationFrame(updateDynamicHeights);

    globalThis.currentImageMetadata = null;

    // helper for pasted image items
    async function handlePastedImageItem(item) {
        const file = item.getAsFile();
        if (!file) return false;
        cachedImage = file;
        const fallbackMetadata = {
            fileName: file.name || 'pasted_image.png',
            fileSize: file.size,
            fileType: file.type,
            lastModified: file.lastModified || Date.now(),
            error: 'Metadata extraction failed'
        };
        try {
            const metadata = await extractImageMetadata(file);
            showImagePreview(file);
            displayFormattedMetadata(metadata, fallbackMetadata);
        } catch (err) {
            console.error('Failed to process pasted image metadata:', err);            
            showImagePreview(file);
            displayFormattedMetadata(fallbackMetadata);
        }
        return true;
    }

    const handlePaste = async (e) => {
        e.preventDefault();
        e.stopPropagation();

        const items = e.clipboardData.items;

        for (const item of items) {
            try {
                if (item.type.startsWith('image/')) {
                    if (await handlePastedImageItem(item)) break;
                } else if (item.type === 'application/json' || item.type === 'text/csv') {
                    if (await handlePastedJsonOrCsvFile(item, hideOverlay)) break;
                } else if (item.type === 'text/plain') {
                    await handlePastedPlainTextItem(item, hideOverlay);
                    break;
                } else {
                    console.log("Unknown type:", item.type);
                }
            } catch (err) {
                console.error('Error handling pasted item:', err);
            }
        }
    };

    function updateHintText(top, bottom) {
        const topHint = document.querySelector('.drag-hint-top');
        topHint.textContent = top; 

        const bottomHint = document.querySelector('.drag-hint-bottom');
        bottomHint.textContent = bottom; 
    }

    function showOverlay() {
        uploadOverlay.style.display = 'flex';
        requestAnimationFrame(updateDynamicHeights);
        isShowing = true;
        document.addEventListener('paste', handlePaste);
    }

    function hideOverlay() {
        uploadOverlay.style.display = 'none';
        clearImageAndMetadata();
        isShowing = false;
        document.removeEventListener('paste', handlePaste);
    }

    function clearImageAndMetadata() {
        imagePreview.style.display = 'none';
        metadataContainer.style.display = 'none';
        svgIcon.style.display = 'flex';
        globalThis.currentImageMetadata = null;
        metadataContainer.innerHTML = '';
        previewImg.src = '';
        defaultUploadOverlaySize();
        requestAnimationFrame(updateDynamicHeights);
    }

    document.addEventListener('dragenter', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (globalThis.currentImageMetadata) {
            clearImageAndMetadata();
        }
        if (e.dataTransfer.types.includes('Files')) {
            showOverlay();
        }
    });

    document.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.clientX <= 0 || e.clientY <= 0 || 
            e.clientX >= globalThis.innerWidth || e.clientY >= globalThis.innerHeight) {
            if (!globalThis.currentImageMetadata) {
                hideOverlay();
            }
        } 
    });

    uploadOverlay.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();

        hintContainer.style.display = 'flex';
        svgIcon.style.opacity = '0.1';

        const rect = uploadOverlay.getBoundingClientRect();
        const offsetY = e.clientY - rect.top;
        const threshold = rect.height / 2;

        if (offsetY < threshold) {
            topHint.classList.add('active');
            bottomHint.classList.remove('active');
        } else {
            topHint.classList.remove('active');
            bottomHint.classList.add('active');
        }
    });

    uploadOverlay.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();

        hintContainer.style.display = 'none';
        svgIcon.style.opacity = '1';
        topHint.classList.remove('active');
        bottomHint.classList.remove('active');
    });

    // eslint-disable-next-line sonarjs/cognitive-complexity
    uploadOverlay.addEventListener('drop', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        hintContainer.style.display = 'none';
        svgIcon.style.opacity = '1';
        topHint.classList.remove('active');
        bottomHint.classList.remove('active');

        const files = e.dataTransfer.files;
        if (files.length === 0) return;

        const rect = uploadOverlay.getBoundingClientRect();
        const offsetY = e.clientY - rect.top;
        const threshold = rect.height / 2;
        const isTopHalf = offsetY < threshold;
        const file = files[0];

        if (isTopHalf) {            
            if(file.type.startsWith('image/')) {                
                cachedImage = file;
                const fallbackMetadata = {
                    fileName: file.name,
                    fileSize: file.size,
                    fileType: file.type,
                    lastModified: file.lastModified,
                    error: 'Metadata extraction failed'
                };
                try {
                    const metadata = await extractImageMetadata(file);                    
                    showImagePreview(file);
                    displayFormattedMetadata(metadata, fallbackMetadata);
                } catch (err) {
                    console.error('Failed to process image metadata:', err);                    
                    showImagePreview(file);                    
                    displayFormattedMetadata(fallbackMetadata);
                }
            } else if (file.type === `application/json` 
                    || file.type === `text/csv`) {
                console.log('Dropped JSON file:', file.name);
                await globalThis.jsonlist.addJsonSlotFromFile(file, file.type);
                globalThis.collapsedTabs.jsonlist.setCollapsed(false);
                hideOverlay();
            } else {
                console.warn('Dropped file ', files[0].name, ' is not support. File type: ', file.type);
                hideOverlay();
            }
        } else {
            const apiInterface = globalThis.generate.api_interface.getValue();
            if(file.type.startsWith('image/')) {                
                cachedImage = file;            
                if(apiInterface === 'ComfyUI') {
                    const imageBase64 = await fileToBase64(cachedImage);
                    await createMiraITUWindow(imageBase64, cachedImage);
                } else {
                    globalThis.overlay.custom.createErrorOverlay(LANG.message_mira_itu_only_comfyui, 'https://github.com/mirabarukaso/ComfyUI_MiraSubPack');
                }                
            } else {
                console.warn('Dropped file ', file.name, ' is not support. File type: ', file.type);
            }
            hideOverlay();
        }
    });

    function showImagePreview(file) {
        svgIcon.style.display = 'none';
        imagePreview.style.display = 'flex';
        metadataContainer.style.display = 'block';

        const reader = new FileReader();
        reader.onload = (e) => {
            previewImg.src = e.target.result;
            previewImg.onload = () => {
                requestAnimationFrame(updateDynamicHeights);
            };
        };
        reader.readAsDataURL(file);
    }

    function createButtonMireITU() {
        const SETTINGS = globalThis.globalSettings;
        const FILES = globalThis.cachedFiles;
        const LANG = FILES.language[SETTINGS.language];

        let miraITUButton;
        const apiInterface = globalThis.generate.api_interface.getValue();
        if(apiInterface === 'ComfyUI') {
            miraITUButton= document.createElement('button');
            miraITUButton.className = 'mira-itu';
            miraITUButton.textContent = LANG.image_info_mira_itu_button;
            
            miraITUButton.addEventListener('click', async () => {
                const apiInterface = globalThis.generate.api_interface.getValue();
                if(apiInterface !== 'ComfyUI') {
                    globalThis.overlay.custom.createErrorOverlay(LANG.message_mira_itu_only_comfyui, 'https://github.com/mirabarukaso/ComfyUI_MiraSubPack');
                    return;
                }
                const imageBase64 = await fileToBase64(cachedImage);
                await createMiraITUWindow(imageBase64, cachedImage);
                hideOverlay();
            });
        } else {
            miraITUButton = document.createElement('div');
        }

        return miraITUButton;
    }

    function createButtonMetaData() {
        const SETTINGS = globalThis.globalSettings;
        const FILES = globalThis.cachedFiles;
        const LANG = FILES.language[SETTINGS.language];

        let workflowButton;
        if(globalThis.currentImageMetadata.nodes) {
            workflowButton = document.createElement('button');
            workflowButton.className = 'copy-all-metadata';
            workflowButton.textContent = LANG.image_info_show_metadata_buttons;

            workflowButton.addEventListener('click', async () => {
                const parsedMetadata = JSON.stringify(globalThis.currentImageMetadata.nodes, null, 2);
                const imageBase64 = await fileToBase64(cachedImage);
                globalThis.overlay.custom.createCustomOverlay(
                        imageBase64 || 'none', 
                        `${parsedMetadata || ''}`,
                        384, 'center', 'left', null, 'Info');
            });
        } else {
            workflowButton = document.createElement('div');
        }

        return workflowButton;
    }

    function createTagTransferButtons() {
        const SETTINGS = globalThis.globalSettings;
        const FILES = globalThis.cachedFiles;
        const LANG = FILES.language[SETTINGS.language];

        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'metadata-buttons';
        
        const copyButton = document.createElement('button');
        copyButton.className = 'copy-all-metadata';
        copyButton.textContent = LANG.image_info_copy_metadata;

        copyButton.addEventListener('click', async () => {
            let fullText = '';
            const parsedMetadata = globalThis.currentImageMetadata;

            if (parsedMetadata.positivePrompt) {
                fullText += `Positive prompt: ${parsedMetadata.positivePrompt}\n`;
            }
            if (parsedMetadata.negativePrompt) {
                fullText += `Negative prompt: ${parsedMetadata.negativePrompt}\n\n`;
            }
            if (parsedMetadata.otherParams) {
                fullText += parsedMetadata.otherParams;
            }
            
            try {
                await navigator.clipboard.writeText(fullText);
            } catch (err){
                console.warn('Failed to copy:', err);
                const SETTINGS = globalThis.globalSettings;
                const FILES = globalThis.cachedFiles;
                const LANG = FILES.language[SETTINGS.language];
                globalThis.overlay.custom.createCustomOverlay(
                    'none', LANG.saac_macos_clipboard.replace('{0}', fullText),
                    384, 'center', 'left', null, 'Clipboard');
            }
            copyButton.textContent = LANG.image_info_copy_metadata_copied;
            setTimeout(() => {
                copyButton.textContent = LANG.image_info_copy_metadata;
            }, 2000);
        });
        
        const sendButton = document.createElement('button');
        sendButton.className = 'send-metadata';
        sendButton.textContent = LANG.image_info_send_tags;
        
        sendButton.addEventListener('click', () => {
            const parsedMetadata = globalThis.currentImageMetadata;
            
            sendPrompt(parsedMetadata);
            globalThis.generate.landscape.setValue(false);
            globalThis.ai.ai_select.setValue(0);
            
            sendButton.textContent = LANG.image_info_send_tags_sent;
            setTimeout(() => {
                sendButton.textContent = LANG.image_info_send_tags;
            }, 2000);
        });
        
        buttonContainer.appendChild(createButtonMireITU());
        buttonContainer.appendChild(createButtonMetaData());
        buttonContainer.appendChild(sendButton);
        buttonContainer.appendChild(copyButton);        
        
        return buttonContainer;
    }

    function createWorkflowButtons() {
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'metadata-buttons';

        const dummyButton1 = document.createElement('div');
        const dummyButton2 = document.createElement('div');   

        buttonContainer.appendChild(dummyButton1);
        buttonContainer.appendChild(dummyButton2);
        buttonContainer.appendChild(createButtonMireITU());
        buttonContainer.appendChild(createButtonMetaData());
        
        return buttonContainer;
    }

    function sendPrompt(parsedMetadata) {
        const defaultPositivePrompt = "masterpiece, best quality, amazing quality";
        const defaultNegativePrompt = "bad quality, worst quality, worst detail, sketch";
        
        const extractedData = {
            positivePrompt: parsedMetadata.positivePrompt || defaultPositivePrompt,
            negativePrompt: parsedMetadata.negativePrompt || defaultNegativePrompt,
            steps: '30',
            cfgScale: "7.0",
            width: parsedMetadata.width || `1024`,
            height: parsedMetadata.height || `1360`,
            seed: '-1'
        };
        
        if (parsedMetadata.otherParams) {
            const otherParamsLines = parsedMetadata.otherParams.split('\n');

            extractedData.steps = findInt('Steps:', otherParamsLines);
            extractedData.seed = findInt('Seed:', otherParamsLines);
        
            const cfgLine = otherParamsLines.find(line => line.trim().startsWith('CFG scale:'));
            if (cfgLine) {
                const cfgMatch = cfgLine.match(/CFG scale:\s*(\d+\.?\d*)/);
                if (cfgMatch?.[1]) {
                    extractedData.cfgScale = cfgMatch[1];
                }
            }           
        
            const sizeLine = otherParamsLines.find(line => line.trim().startsWith('Size:'));
            if (sizeLine) {
                const sizeMatch = sizeLine.match(/Size:\s*(\d+)x(\d+)/);
                if (sizeMatch?.[1] && sizeMatch?.[2]) {
                    extractedData.width = sizeMatch[1];
                    extractedData.height = sizeMatch[2];
                }
            }
        }

        // Extract <lora:...> strings from positivePrompt
        const loraRegex = /<lora:[^>]+>/g;
        const loraMatches = extractedData.positivePrompt.match(loraRegex) || [];
        const allLora = loraMatches.join('\n');
        const allPrompt = extractedData.positivePrompt.replaceAll(loraRegex, '').replaceAll(/,\s*,/g, ',').replaceAll(/(^,\s*)|(\s*,$)/g, '').trim();

        globalThis.prompt.common.setValue(allPrompt || defaultPositivePrompt);
        globalThis.prompt.positive.setValue(allLora);
        globalThis.prompt.negative.setValue(extractedData.negativePrompt);    
        globalThis.generate.seed.setValue(extractedData.seed);
        globalThis.generate.cfg.setValue(extractedData.cfgScale);
        globalThis.generate.step.setValue(extractedData.steps);
        globalThis.generate.width.setValue(extractedData.width);
        globalThis.generate.height.setValue(extractedData.height);    
    }    

    // eslint-disable-next-line sonarjs/cognitive-complexity
    function displayFormattedMetadata(metadata, fallbackMetadata=null) {
        const apiInterface = globalThis.generate.api_interface.getValue();
        const modelType = globalThis.dropdownList.model_type.getValue();
        const parsedMetadata = parseGenerationParameters(metadata);
        parsedMetadata.nodes = metadata.generationParameters || null;
        globalThis.currentImageMetadata = parsedMetadata;
        metadataContainer.innerHTML = '';
        
        const hasMetadata = parsedMetadata.positivePrompt || 
                           parsedMetadata.negativePrompt || 
                           parsedMetadata.otherParams;        
        
        createImageTagger(metadataContainer, cachedImage);

        if(apiInterface !== 'None' && modelType === 'Checkpoint' ) {
            metadataContainer.appendChild(createControlNetButtons(apiInterface, cachedImage, previewImg));        
        }

        const metadataDisplay = document.createElement('div');
        metadataDisplay.className = `metadata-custom-textbox-data`;
        metadataDisplay.style.whiteSpace = 'pre-wrap';
        metadataDisplay.style.overflow = 'auto';
        
        let metadataText = '';
        metadataText += `File name: ${parsedMetadata.fileName}\n`;
        if (parsedMetadata.width && parsedMetadata.height) {
            metadataText += `Size: ${parsedMetadata.width}x${parsedMetadata.height}\n`;
        } else if (fallbackMetadata) {
            metadataText += `Size: ${Math.round(fallbackMetadata.fileSize/1024, 2)} kb\n`;
            metadataText += `Type: ${fallbackMetadata.fileType}\n`;
        }
        
        if (hasMetadata) {
            const buttonContainer = createTagTransferButtons();
            metadataContainer.appendChild(buttonContainer);

            if (parsedMetadata.positivePrompt) {
                metadataText += `\nPositive prompt: ${parsedMetadata.positivePrompt}\n`;
            } else if (!parsedMetadata.error) {
                metadataText += '\nNo prompt metadata found\n';         
            }
            
            if (parsedMetadata.negativePrompt) {
                metadataText += `Negative prompt: ${parsedMetadata.negativePrompt}\n`;
            }
            
            if (parsedMetadata.otherParams) {
                metadataText += `\n${parsedMetadata.otherParams}`;
            }
            
            if (parsedMetadata.error) {
                metadataText += `\nError: ${parsedMetadata.error}\n`;
            }
        } else if(metadata.generationParameters) {
            const buttonContainer = createWorkflowButtons();
            metadataContainer.appendChild(buttonContainer);                        
        }
        
        metadataDisplay.textContent = metadataText;
        metadataContainer.appendChild(metadataDisplay);
    }

    globalThis.addEventListener('resize', () => {
        if (uploadOverlay.style.display !== 'none') {            
            requestAnimationFrame(updateDynamicHeights);
        }
    });

    uploadOverlay.showOverlay = showOverlay;
    uploadOverlay.hideOverlay = hideOverlay;
    uploadOverlay.updateHintText = updateHintText;

    uploadOverlay._cleanup = () => {
        document.removeEventListener('dragenter', showOverlay);
        uploadOverlay.remove();
    };

    globalThis.imageUploadOverlay = uploadOverlay;
    return uploadOverlay;
}

function findInt(keyWord, otherParamsLines) {
    const line = otherParamsLines.find(line => line.trim().startsWith(keyWord));  
    if (line) {
        const escapedKeyWord = keyWord.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
        const regex = new RegExp(String.raw`${escapedKeyWord}\s*(\d+)`);
        const match = line.match(regex);
        if (match?.[1]) {
            return match[1];
        }
    }
    return null;
}
