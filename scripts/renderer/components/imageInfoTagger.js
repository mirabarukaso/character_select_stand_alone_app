import { sendWebSocketMessage } from '../../webserver/front/wsRequest.js';
import { fileToBase64, taggerPreferGpu } from '../generate.js';

let lastTaggerOptions = null;

export function createHtmlOptions(itemList) {
    let options = [];
    if (globalThis.globalSettings.api_interface === 'ComfyUI') {
        for (const item of itemList) {
            if (String(item).startsWith('CV->')) continue;
            options.push(`<option value="${item}">${item}</option>`);
        }
    } else {
        // 'WebUI'
        for (const item of itemList) {
            options.push(`<option value="${item}">${item}</option>`);
        }
    }
    return options.join();
}

function modelOptionsOptions(modelChoice) {
    if(modelChoice.startsWith('wd-')) {
        return ['Rating/General/Character', 'General/Character', 'General', 'Rating',  'Character'];
    } else if(modelChoice.startsWith('cl_')) {
        return ['All', 'General/Character/Artist/CopyRight', 'General', 'Character', 'Artist', 'Copyright', 'Meta', 'Model', 'Rating', 'Quality'];
    } else if(modelChoice.startsWith('camie-')) {
        return ['without Year', 'All', 'without Year/Rating', 'General/Character/Artist/CopyRight', 'general', 'rating', 'meta', 'character', 'artist', 'copyright', 'year'];
    } else {
        return ['N/A']
    }
}

export function createImageTagger(metadataContainer, cachedImage) {    
    const SETTINGS = globalThis.globalSettings;
    const FILES = globalThis.cachedFiles;
    const LANG = FILES.language[SETTINGS.language];

    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'image-tagger-buttons';

    const modelOptions = document.createElement('select');
    const genThreshold = document.createElement('select');
    const charThreshold = document.createElement('select');

    const imageTaggerModels = document.createElement('select');
    imageTaggerModels.className = 'controlnet-select';
    imageTaggerModels.innerHTML = createHtmlOptions(FILES.imageTaggerModels);
    imageTaggerModels.value = lastTaggerOptions?.model_choice || FILES.imageTaggerModels[0];
    imageTaggerModels.addEventListener('change', () => {
        modelOptions.innerHTML = createHtmlOptions(modelOptionsOptions(imageTaggerModels.value));
    });
    buttonContainer.appendChild(imageTaggerModels);
    
    genThreshold.className = 'controlnet-select';
    genThreshold.innerHTML = createHtmlOptions([0.25,0.3,0.35,0.4,0.45,0.5,0.55,0.6,0.65,0.7,0.75,0.8,0.85,0.9,0.95,1]);
    genThreshold.value = lastTaggerOptions?.gen_threshold || 0.55;
    buttonContainer.appendChild(genThreshold);
    
    charThreshold.className = 'controlnet-select';
    charThreshold.innerHTML = createHtmlOptions([0.25,0.3,0.35,0.4,0.45,0.5,0.55,0.6,0.65,0.7,0.75,0.8,0.85,0.9,0.95,1]);
    charThreshold.value = lastTaggerOptions?.char_threshold || 0.6;
    buttonContainer.appendChild(charThreshold);

    modelOptions.className = 'controlnet-select';
    modelOptions.innerHTML = createHtmlOptions(modelOptionsOptions(lastTaggerOptions?.model_choice || FILES.imageTaggerModels[0]));
    buttonContainer.appendChild(modelOptions);

    const imageTaggerButton = document.createElement('button');
    imageTaggerButton.className = 'image-tagger-process';
    imageTaggerButton.textContent = LANG.image_tagger_run;
    imageTaggerButton.addEventListener('click', async () => {            
        if(!imageTaggerButton.disabled) {
            if(imageTaggerModels.value === 'none') {
                imageTaggerButton.textContent = 'Select Model';
                imageTaggerButton.style.cursor = 'not-allowed';
                imageTaggerButton.disabled = true;
                
                setTimeout(() => {
                    imageTaggerButton.textContent = LANG.image_tagger_run;
                    imageTaggerButton.style.cursor = 'pointer';
                    imageTaggerButton.disabled = false;
                }, 500);
                return;
            }

            imageTaggerButton.textContent = LANG.image_tagger_run_processing;
            imageTaggerButton.style.cursor = 'not-allowed';
            imageTaggerButton.disabled = true;
            try {                    
                let imageBase64 = await fileToBase64(cachedImage);
                if (typeof imageBase64 === 'string' && imageBase64.startsWith('data:')) {
                    imageBase64 = imageBase64.split(',')[1];
                }

                const preferGpu = taggerPreferGpu();
                let result = '';
                if (globalThis.inBrowser) {
                    result = await sendWebSocketMessage({ 
                        type: 'API', 
                        method: 'runImageTagger', 
                        params: [
                            imageBase64,
                            imageTaggerModels.value,
                            genThreshold.value,
                            charThreshold.value,
                            modelOptions.value,
                            false,
                            preferGpu,
                        ]});
                } else {
                    result = await globalThis.api.runImageTagger({
                        image_input: imageBase64,
                        model_choice: imageTaggerModels.value,
                        gen_threshold: genThreshold.value,
                        char_threshold: charThreshold.value,
                        model_options: modelOptions.value,
                        preferGpu,
                    });
                }

                lastTaggerOptions = {
                    model_choice: imageTaggerModels.value,
                    gen_threshold: genThreshold.value,
                    char_threshold: charThreshold.value
                };

                if(result) {
                    imageTaggerButton.textContent = LANG.image_tagger_run_tagged;
                    console.log(result.join(', '));
                    globalThis.overlay.custom.closeCustomOverlaysByGroup('Info'); // close exist
                    globalThis.overlay.custom.createCustomOverlay('none', "\n\n" + result.join(', '),
                                                                384, 'center', 'left', null, 'Info');
                } else {
                    imageTaggerButton.textContent = LANG.image_tagger_run_no_tag;
                }   
            } catch (err) {
                console.error('Image Tagger error:', err);
                imageTaggerButton.textContent = LANG.image_tagger_run_error;
            }
            setTimeout(() => {
                imageTaggerButton.textContent = LANG.image_tagger_run;
                imageTaggerButton.style.cursor = 'pointer';
                imageTaggerButton.disabled = false;
            }, 2000);
        }
    });
    buttonContainer.appendChild(imageTaggerButton);
    metadataContainer.appendChild(buttonContainer);

    const plateRow = document.createElement('div');
    plateRow.className = 'image-tagger-plate';
    const plateButton = document.createElement('button');
    plateButton.type = 'button';
    plateButton.className = 'image-tagger-plate-send';
    plateButton.textContent = LANG.image_tagger_send_plate || 'To Bounding';
    plateButton.addEventListener('click', async () => {
        if (plateButton.disabled) return;
        plateButton.disabled = true;
        plateButton.style.cursor = 'not-allowed';
        try {
            const src = await fileToBase64(cachedImage);
            const sent = globalThis.bounding?.setPlate?.(src) === true;
            plateButton.textContent = sent
                ? (LANG.image_tagger_send_plate_sent || 'Sent')
                : (LANG.image_tagger_send_plate_error || 'Error');
        } catch (err) {
            console.error('Send plate failed:', err);
            plateButton.textContent = LANG.image_tagger_send_plate_error || 'Error';
        }
        setTimeout(() => {
            plateButton.textContent = LANG.image_tagger_send_plate || 'To Bounding';
            plateButton.style.cursor = 'pointer';
            plateButton.disabled = false;
        }, 2000);
    });

    const compareButton = document.createElement('button');
    compareButton.type = 'button';
    compareButton.className = 'image-tagger-compare-send';

    function nextCompareSlot(lockSlot = null) {
        if (lockSlot === 'A' || lockSlot === 'B') return lockSlot;
        const state = globalThis.mainGallery?.getCompareStagingState?.() || 'empty';
        return (state === 'hasA' || state === 'ready') ? 'B' : 'A';
    }

    function compareIdleLabel(slot) {
        if (slot === 'B') return LANG.image_tagger_compare_add_b || 'Add B';
        return LANG.image_tagger_compare_add_a || 'Add A';
    }

    function syncCompareSlotStyle(lockSlot = null) {
        compareButton.classList.remove('is-slot-a', 'is-slot-b', 'is-disabled-compare');
        if (globalThis.mainGallery?.isCompareMode) {
            compareButton.classList.add('is-disabled-compare');
            compareButton.textContent = LANG.image_tagger_compare_full || 'Exit compare first';
            compareButton.disabled = true;
            compareButton.style.cursor = 'not-allowed';
            return;
        }
        compareButton.disabled = false;
        compareButton.style.cursor = 'pointer';
        const slot = nextCompareSlot(lockSlot);
        compareButton.classList.toggle('is-slot-a', slot === 'A');
        compareButton.classList.toggle('is-slot-b', slot === 'B');
        if (!lockSlot) {
            compareButton.textContent = compareIdleLabel(slot);
        }
    }
    syncCompareSlotStyle();

    compareButton.addEventListener('click', async () => {
        if (compareButton.disabled || globalThis.mainGallery?.isCompareMode) return;
        compareButton.disabled = true;
        compareButton.style.cursor = 'not-allowed';
        try {
            const payload = await buildComparePayloadFromImageInfo(cachedImage);
            const result = globalThis.mainGallery?.fillNextCompareExternal?.(payload);
            if (result?.ok && result.slot === 'A') {
                compareButton.textContent = LANG.image_tagger_compare_added_a || 'Set as A';
                syncCompareSlotStyle('A');
            } else if (result?.ok && result.slot === 'B') {
                compareButton.textContent = LANG.image_tagger_compare_added_b || 'Set as B';
                syncCompareSlotStyle('B');
                globalThis.imageUploadOverlay?.hideOverlay?.();
                return;
            } else if (result?.reason === 'full') {
                compareButton.textContent = LANG.image_tagger_compare_full || 'Exit compare first';
                compareButton.classList.remove('is-slot-a', 'is-slot-b');
                compareButton.classList.add('is-disabled-compare');
            } else {
                compareButton.textContent = LANG.image_tagger_compare_error || 'Error';
            }
        } catch (err) {
            console.error('Add A|B compare failed:', err);
            compareButton.textContent = LANG.image_tagger_compare_error || 'Error';
        }
        setTimeout(() => {
            compareButton.style.cursor = 'pointer';
            compareButton.disabled = false;
            syncCompareSlotStyle();
        }, 2000);
    });

    plateRow.appendChild(plateButton);
    plateRow.appendChild(compareButton);
    metadataContainer.appendChild(plateRow);
}

function parseSeedFromOtherParams(otherParams) {
    if (!otherParams) return '-1';
    const lines = String(otherParams).split('\n');
    const seedLine = lines.find((line) => line.trim().startsWith('Seed:'));
    if (!seedLine) return '-1';
    const match = seedLine.match(/Seed:\s*(-?\d+)/);
    return match?.[1] ?? '-1';
}

function buildInfoFromMetadata(meta) {
    if (!meta) return '';
    const parts = [];
    if (meta.positivePrompt) parts.push(`Positive:\n${meta.positivePrompt}`);
    if (meta.negativePrompt) parts.push(`Negative:\n${meta.negativePrompt}`);
    if (meta.otherParams) parts.push(meta.otherParams);
    if (!parts.length && meta.nodes) {
        try {
            return JSON.stringify(meta.nodes, null, 2);
        } catch {
            return String(meta.nodes);
        }
    }
    if (!parts.length && meta.fileName) {
        parts.push(`File: ${meta.fileName}`);
        if (meta.fileType) parts.push(`Type: ${meta.fileType}`);
        if (meta.fileSize) parts.push(`Size: ${meta.fileSize}`);
    }
    return parts.join('\n\n');
}

async function buildComparePayloadFromImageInfo(cachedImage) {
    const src = await fileToBase64(cachedImage);
    const meta = globalThis.currentImageMetadata || {};
    return {
        image: src,
        seed: parseSeedFromOtherParams(meta.otherParams),
        tags: meta.positivePrompt || '',
        info: buildInfoFromMetadata(meta),
        label: meta.fileName || cachedImage?.name || '',
        source: 'imageInfo'
    };
}

