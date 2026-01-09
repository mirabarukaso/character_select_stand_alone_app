import { createHtmlOptions } from './imageInfoTagger.js';
import { toBlob, getImageSizeFromBlob } from './imageInfoUtils.js'
import { TileHelper, CropImageHelper } from './helper.js';
import { callback_generate_start } from '../callbacks.js';
import { SAMPLER_COMFYUI, SCHEDULER_COMFYUI } from '../language.js';
import { fileToBase64 } from '../generate.js';
import { sendWebSocketMessage } from '../../../webserver/front/wsRequest.js';

let lastTaggerOptions = null;
let miraITU = null;
let cachedImage = null;

let currentCleanupFunctions = [];

function createTagger() {
    const SETTINGS = globalThis.globalSettings;
    const FILES = globalThis.cachedFiles;
    const LANG = FILES.language[SETTINGS.language];

    const taggerContainer = document.createElement('div');
    taggerContainer.style.display = 'grid';
    taggerContainer.style.gridTemplateColumns = '3fr 1.5fr 1.5fr';
    taggerContainer.style.columnGap = '10px';
    taggerContainer.innerHTML = LANG.image_info_mira_itu_taggerContainer;

    const imageTaggerModels = document.createElement('select');
    imageTaggerModels.className = 'controlnet-select';
    imageTaggerModels.innerHTML = createHtmlOptions(FILES.ONNXList);
    imageTaggerModels.value = lastTaggerOptions?.imageTaggerModels || FILES.ONNXList[0];
    imageTaggerModels.addEventListener('change', handleModelChange);
    function handleModelChange() {
        lastTaggerOptions.imageTaggerModels = imageTaggerModels.value;
        
        const imageTaggerGenThreshold = document.querySelector('#mira-itu-image-tagger-threshold');
        if (!imageTaggerGenThreshold) {
            console.error("imageTaggerGenThreshold not found!");
            return;
        }

        if(imageTaggerModels.value.toLocaleLowerCase().startsWith('cl')) {
            imageTaggerGenThreshold.value= 0.55;
        } else if(imageTaggerModels.value.toLocaleLowerCase().startsWith('wd')) {
            imageTaggerGenThreshold.value= 0.35;
        } else {
            imageTaggerGenThreshold.value= 0.5;
        }

        lastTaggerOptions.imageTaggerGenThreshold = Number(imageTaggerGenThreshold.value);
    }

    const imageTaggerGenThreshold = document.createElement('select');
    imageTaggerGenThreshold.id = 'mira-itu-image-tagger-threshold';
    imageTaggerGenThreshold.className = 'controlnet-select';
    imageTaggerGenThreshold.innerHTML = createHtmlOptions([0.25,0.3,0.35,0.4,0.45,0.5,0.55,0.6,0.65,0.7,0.75,0.8,0.85,0.9,0.95,1]);
    imageTaggerGenThreshold.value = lastTaggerOptions?.imageTaggerGenThreshold || 0.55;
    imageTaggerGenThreshold.addEventListener('change', handleThresholdChange);
    function handleThresholdChange() {
        lastTaggerOptions.imageTaggerGenThreshold = Number(imageTaggerGenThreshold.value);
    }

    const stepsText = document.createElement('textarea');
    stepsText.id = 'mira-itu-textarea';
    stepsText.className = 'myTextbox-prompt-ai-textarea';
    stepsText.rows = 1;
    stepsText.placeholder = '16';
    stepsText.style.resize = 'none';
    stepsText.style.boxSizing = 'border-box';
    stepsText.style.minHeight = '32px';
    stepsText.style.maxHeight = '32px';
    stepsText.value = lastTaggerOptions?.steps || '16';
    stepsText.addEventListener('input', handleStepsInput);
    function handleStepsInput() {
        const validCharsRegex = /^\d*$/;
        if (validCharsRegex.test(this.value)) {
            if (Number(this.value) > 50) this.value = '50';
            if (Number(this.value) < 1) this.value = '1';
            lastTaggerOptions.steps = Number(this.value);
        } else {
            this.value = this.value.replaceAll(/[^\d]/g, '');
        }
    }

    taggerContainer.appendChild(imageTaggerModels);
    taggerContainer.appendChild(imageTaggerGenThreshold);
    taggerContainer.appendChild(stepsText);

    return {
        container: taggerContainer,
        cleanup: () => {
            imageTaggerModels.removeEventListener('change', handleModelChange);
            imageTaggerGenThreshold.removeEventListener('change', handleThresholdChange);
            stepsText.removeEventListener('input', handleStepsInput);
        }
    };
}

function createMiraITUConfig() {
    const SETTINGS = globalThis.globalSettings;
    const FILES = globalThis.cachedFiles;
    const LANG = FILES.language[SETTINGS.language];

    const miraITUContainer = document.createElement('div');
    miraITUContainer.style.display = 'grid';
    miraITUContainer.style.gridTemplateColumns = '1.5fr 1.5fr 1.5fr 1.5fr';
    miraITUContainer.style.columnGap = '10px';
    miraITUContainer.innerHTML = LANG.image_info_mira_itu_miraITUContainer;

    const ituTileSize = document.createElement('select');
    ituTileSize.className = 'controlnet-select';
    ituTileSize.id = 'mira-itu-tilesize';
    ituTileSize.innerHTML = createHtmlOptions([512, 768, 1024, 1280, 1536, 1792, 2048, 2304, 2560, 2816, 3072]);
    ituTileSize.value = lastTaggerOptions?.ituTileSize || 2048;
    ituTileSize.addEventListener('change', handleTileSize);
    function handleTileSize() {
        lastTaggerOptions.ituTileSize = Number(ituTileSize.value);
        updateMiraITUData();
    }

    const ituOverlap = document.createElement('select');
    ituOverlap.className = 'controlnet-select';
    ituOverlap.innerHTML = createHtmlOptions([64, 96, 128, 160, 192, 224, 256]);
    ituOverlap.value = lastTaggerOptions?.ituOverlap || 64;
    ituOverlap.addEventListener('change', handleOverlap);
    function handleOverlap() {
        lastTaggerOptions.ituOverlap = Number(ituOverlap.value);
        updateMiraITUData();
    }

    const ituFeather = document.createElement('select');
    ituFeather.className = 'controlnet-select';
    ituFeather.innerHTML = createHtmlOptions([0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]);
    ituFeather.value = lastTaggerOptions?.ituFeather || 1;
    ituFeather.addEventListener('change', handleFeather);
    function handleFeather() {
        lastTaggerOptions.ituFeather = Number(ituFeather.value);
        updateMiraITUData();
    }

    const cfgText = document.createElement('textarea');
    cfgText.id = 'mira-itu-textarea';
    cfgText.className = 'myTextbox-prompt-ai-textarea';
    cfgText.rows = 1;
    cfgText.placeholder = '7';
    cfgText.style.resize = 'none';
    cfgText.style.boxSizing = 'border-box';
    cfgText.style.minHeight = '32px';
    cfgText.style.maxHeight = '32px';
    cfgText.value = lastTaggerOptions?.cfg || '7';
    cfgText.addEventListener('input', handleCFGInput);
    function handleCFGInput() {
        const validCharsRegex = /^[0-9.]*$/;
        if (validCharsRegex.test(this.value)) {
            if (Number(this.value) > 15) this.value = '15';
            if (Number(this.value) < 1) this.value = '1';
            lastTaggerOptions.cfg = Number(this.value);
        } else {
            this.value = this.value.replaceAll(/[^0-9.]/g, '');
        }
    }

    miraITUContainer.appendChild(ituTileSize);
    miraITUContainer.appendChild(ituOverlap);
    miraITUContainer.appendChild(ituFeather);
    miraITUContainer.appendChild(cfgText);

    return {
        container: miraITUContainer,
        cleanup: () => {
            ituTileSize.removeEventListener('change', handleTileSize);
            ituOverlap.removeEventListener('change', handleOverlap);
            ituFeather.removeEventListener('change', handleFeather);
            cfgText.removeEventListener('input', handleCFGInput);
        }
    };
}

function createUpscaleModelConfig() {
    const SETTINGS = globalThis.globalSettings;
    const FILES = globalThis.cachedFiles;
    const LANG = FILES.language[SETTINGS.language];

    const upscaleContainer = document.createElement('div');
    upscaleContainer.style.display = 'grid';
    upscaleContainer.style.gridTemplateColumns = '3fr 1.5fr 1.5fr';
    upscaleContainer.style.columnGap = '10px';
    upscaleContainer.innerHTML = LANG.image_info_mira_itu_upscaleContainer;

    const upscaleModels = document.createElement('select');
    upscaleModels.className = 'controlnet-select';
    upscaleModels.innerHTML = createHtmlOptions(FILES.upscalerList);
    upscaleModels.value = lastTaggerOptions?.upscaleModels || FILES.upscalerList[0];
    upscaleModels.addEventListener('change', handleUpscaleModel);
    function handleUpscaleModel() {
        lastTaggerOptions.upscaleModels = upscaleModels.value;
        if (upscaleModels.value.startsWith("Latent")) {
            globalThis.overlay.custom.createErrorOverlay(LANG.message_mira_itu_do_not_use_latent_upscale, LANG.message_mira_itu_do_not_use_latent_upscale);
        }
    }

    const upscaleRatio = document.createElement('select');
    upscaleRatio.className = 'controlnet-select';
    upscaleRatio.innerHTML = createHtmlOptions([1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 8]);
    upscaleRatio.value = lastTaggerOptions?.upscaleRatio || 2;
    upscaleRatio.addEventListener('change', handleRatio);
    function handleRatio() {
        lastTaggerOptions.upscaleRatio = Number(upscaleRatio.value);
        updateMiraITUData();
    }

    const upscaleVAEmethod = document.createElement('select');
    upscaleVAEmethod.className = 'controlnet-select';
    upscaleVAEmethod.innerHTML = createHtmlOptions(['Full', 'Tiled']);
    upscaleVAEmethod.value = lastTaggerOptions?.upscaleVAEmethod || 'Full';
    upscaleVAEmethod.addEventListener('change', handleVAE);
    function handleVAE() {
        lastTaggerOptions.upscaleVAEmethod = upscaleVAEmethod.value;
    }

    upscaleContainer.appendChild(upscaleModels);
    upscaleContainer.appendChild(upscaleRatio);
    upscaleContainer.appendChild(upscaleVAEmethod);

    return {
        container: upscaleContainer,
        cleanup: () => {
            upscaleModels.removeEventListener('change', handleUpscaleModel);
            upscaleRatio.removeEventListener('change', handleRatio);
            upscaleVAEmethod.removeEventListener('change', handleVAE);
        }
    };
}

function createImageConfig() {
    const SETTINGS = globalThis.globalSettings;
    const FILES = globalThis.cachedFiles;
    const LANG = FILES.language[SETTINGS.language];

    const imageContainer = document.createElement('div');
    imageContainer.style.display = 'grid';
    imageContainer.style.gridTemplateColumns = '3fr 1.5fr 1.5fr';
    imageContainer.style.columnGap = '10px';
    imageContainer.innerHTML = LANG.image_info_mira_itu_imageContainer;

    const positiveText = document.createElement('textarea');
    positiveText.id = 'mira-itu-textarea';
    positiveText.className = 'myTextbox-prompt-positive-textarea';
    positiveText.rows = 5;
    positiveText.placeholder = 'masterpiece, best quality, amazing quality';
    positiveText.style.resize = 'vertical';
    positiveText.style.boxSizing = 'border-box';
    positiveText.style.minHeight = '32px';
    positiveText.style.maxHeight = '80px';
    positiveText.value = lastTaggerOptions?.positiveText || 'masterpiece, best quality, amazing quality';
    positiveText.addEventListener('input', handlePositiveInput);    
    function handlePositiveInput() {
        lastTaggerOptions.positiveText = positiveText.value;
    }

    const mergeMethod = document.createElement('select');
    mergeMethod.className = 'controlnet-select';
    mergeMethod.innerHTML = createHtmlOptions(['Image', 'Latent']);
    mergeMethod.value = lastTaggerOptions?.mergeMethod || 'Image';
    mergeMethod.addEventListener('change', handleMergeChange);
    function handleMergeChange() {
        lastTaggerOptions.mergeMethod = mergeMethod.value;
    }

    const denoiseText = document.createElement('textarea');
    denoiseText.id = 'mira-itu-textarea';
    denoiseText.className = 'myTextbox-prompt-common-textarea';
    denoiseText.rows = 1;
    denoiseText.placeholder = '0.4';
    denoiseText.style.resize = 'none';
    denoiseText.style.boxSizing = 'border-box';
    denoiseText.style.minHeight = '32px';
    denoiseText.style.maxHeight = '32px';
    denoiseText.value = lastTaggerOptions?.denoise || '0.4';
    denoiseText.addEventListener('input', handleDenoiseInput);
    function handleDenoiseInput() {
        const validCharsRegex = /^[0-9.]*$/;
        if (validCharsRegex.test(this.value)) {
            if (Number(this.value) > 1) this.value = '1';
            if (Number(this.value) < 0.01) this.value = '0.01';
            lastTaggerOptions.denoise = Number(this.value);
        } else {
            this.value = this.value.replaceAll(/[^0-9.]/g, '');
        }
    }

    imageContainer.appendChild(positiveText);
    imageContainer.appendChild(mergeMethod);    
    imageContainer.appendChild(denoiseText);

    return {
        container: imageContainer,
        cleanup: () => {
            positiveText.removeEventListener('input', handlePositiveInput);
            mergeMethod.removeEventListener('change', handleMergeChange);
            denoiseText.removeEventListener('input', handleDenoiseInput);
        }
    };
}

function createKSamplerData() {
    const SETTINGS = globalThis.globalSettings;
    const FILES = globalThis.cachedFiles;
    const LANG = FILES.language[SETTINGS.language];

    const ksamplerContainer = document.createElement('div');
    ksamplerContainer.style.display = 'grid';
    ksamplerContainer.style.gridTemplateColumns = '3fr 1.5fr 1.5fr';
    ksamplerContainer.style.columnGap = '10px';
    ksamplerContainer.innerHTML = LANG.image_info_mira_itu_samplerData;

    const negativeText = document.createElement('textarea');
    negativeText.id = 'mira-itu-textarea';
    negativeText.className = 'myTextbox-prompt-negative-textarea';
    negativeText.rows = 5;
    negativeText.placeholder = 'bad quality,worst quality,worst detail,sketch';
    negativeText.style.resize = 'vertical';
    negativeText.style.boxSizing = 'border-box';
    negativeText.style.minHeight = '32px';
    negativeText.style.maxHeight = '80px';
    negativeText.value = lastTaggerOptions?.negativeText || 'bad quality,worst quality,worst detail,sketch';
    negativeText.addEventListener('input', handleNegativeInput);    
    function handleNegativeInput() {
        lastTaggerOptions.negativeText = negativeText.value;
    }

    const samplerSelect = document.createElement('select');
    samplerSelect.className = 'controlnet-select';
    samplerSelect.innerHTML = createHtmlOptions(SAMPLER_COMFYUI);
    samplerSelect.value = lastTaggerOptions?.samplerSelect || 'euler_ancestral';
    samplerSelect.addEventListener('change', handleSampler);
    function handleSampler() {
        lastTaggerOptions.samplerSelect = samplerSelect.value;
        updateMiraITUData();
    }

    const scheduleSelect = document.createElement('select');
    scheduleSelect.className = 'controlnet-select';
    scheduleSelect.innerHTML = createHtmlOptions(SCHEDULER_COMFYUI);
    scheduleSelect.value = lastTaggerOptions?.scheduleSelect || 'beta';
    scheduleSelect.addEventListener('change', handleSchedule);
    function handleSchedule() {
        lastTaggerOptions.scheduleSelect = scheduleSelect.value;
        updateMiraITUData();
    }

    ksamplerContainer.appendChild(negativeText);
    ksamplerContainer.appendChild(samplerSelect);    
    ksamplerContainer.appendChild(scheduleSelect);
    
    return {
        container: ksamplerContainer,
        cleanup: () => {
            negativeText.removeEventListener('input', handleNegativeInput);
            samplerSelect.removeEventListener('change', handleSampler);
            scheduleSelect.removeEventListener('change', handleSchedule);
        }
    };
}

function createLocalTagger() {
    const SETTINGS = globalThis.globalSettings;
    const FILES = globalThis.cachedFiles;
    const LANG = FILES.language[SETTINGS.language];

    const bodyContainer = document.createElement('div');    
    bodyContainer.style.display = 'grid';
    bodyContainer.style.gridTemplateColumns = '6fr';
    bodyContainer.innerHTML = `<p></p>${LANG.image_info_mira_itu_manualTags}`;

    const taggerContainer = document.createElement('div');
    taggerContainer.style.display = 'grid';
    taggerContainer.style.gridTemplateColumns = '3fr 1fr 1fr 1fr';
    taggerContainer.style.columnGap = '10px';
    taggerContainer.innerHTML = LANG.image_info_mira_itu_localTagger;

    const localTaggerModels = document.createElement('select');
    localTaggerModels.className = 'controlnet-select';
    localTaggerModels.innerHTML = createHtmlOptions(FILES.imageTaggerModels);
    localTaggerModels.value = lastTaggerOptions?.localTaggerModels || FILES.imageTaggerModels[0];
    localTaggerModels.addEventListener('change', handleSAATaggerModelChange);
    function handleSAATaggerModelChange() {
        lastTaggerOptions.localTaggerModels = localTaggerModels.value;

        const localTaggerGenThreshold = document.querySelector('#mira-itu-local-tagger-threshold');
        if (!localTaggerGenThreshold) {
            console.error("localTaggerGenThreshold not found!");
            return;
        }

        if(localTaggerModels.value.toLocaleLowerCase().startsWith('cl')) {
            localTaggerGenThreshold.value= 0.55;
        } else if(localTaggerModels.value.toLocaleLowerCase().startsWith('wd')) {
            localTaggerGenThreshold.value= 0.35;
        } else {
            localTaggerGenThreshold.value= 0.5;
        }

        lastTaggerOptions.localTaggerGenThreshold = Number(localTaggerGenThreshold.value);
    }

    const localTaggerGenThreshold = document.createElement('select');
    localTaggerGenThreshold.id = 'mira-itu-local-tagger-threshold';
    localTaggerGenThreshold.className = 'controlnet-select';
    localTaggerGenThreshold.innerHTML = createHtmlOptions([0.25,0.3,0.35,0.4,0.45,0.5,0.55,0.6,0.65,0.7,0.75,0.8,0.85,0.9,0.95,1]);
    localTaggerGenThreshold.value = lastTaggerOptions?.localTaggerGenThreshold || 0.55;
    localTaggerGenThreshold.addEventListener('change', handleLocalThresholdChange);
    function handleLocalThresholdChange() {
        lastTaggerOptions.localTaggerGenThreshold = Number(localTaggerGenThreshold.value);
    }

    const localTaggerMethod = document.createElement('select');
    localTaggerMethod.className = 'controlnet-select';
    localTaggerMethod.innerHTML = createHtmlOptions(['ComfyUI', 'SAA']);
    localTaggerMethod.value = lastTaggerOptions?.localTaggerMethod || 'ComfyUI';
    localTaggerMethod.addEventListener('change', handleTaggerMethodChange);
    function handleTaggerMethodChange() {
        lastTaggerOptions.localTaggerMethod = localTaggerMethod.value;
    }

    const miraITUTaggerButton = document.createElement('button');
    miraITUTaggerButton.className = 'mira-itu-tagger';
    miraITUTaggerButton.textContent = LANG.image_info_mira_itu_local_tagger_button;
    miraITUTaggerButton.style.alignSelf = 'end';
    miraITUTaggerButton.style.minHeight = '32px';
    miraITUTaggerButton.style.maxHeight = '32px';
    miraITUTaggerButton.style.width = '100%';
    miraITUTaggerButton.addEventListener('click', handleMiraTaggerClick);


    const manualTagsContainer = document.createElement('div');
    manualTagsContainer.style.display = 'grid';
    manualTagsContainer.style.gridTemplateColumns = '1fr';
    manualTagsContainer.style.columnGap = '10px';
    manualTagsContainer.innerHTML = '';

    const localTagsText = document.createElement('textarea');
    localTagsText.id = 'mira-itu-tagger-textarea';
    localTagsText.className = 'myTextbox-prompt-positive-textarea';
    localTagsText.rows = 10;
    localTagsText.placeholder = LANG.image_info_mira_itu_manualTags_placeholder;
    localTagsText.style.resize = 'vertical';
    localTagsText.style.boxSizing = 'border-box';
    localTagsText.style.minHeight = '32px';
    localTagsText.style.maxHeight = '320px';
    localTagsText.style.maxWidth = "100%";
    localTagsText.value = lastTaggerOptions?.localTagsText || '';
    localTagsText.addEventListener('input', handleTagsInput);    
    function handleTagsInput() {
        lastTaggerOptions.localTagsText = localTagsText.value;
    }


    taggerContainer.appendChild(localTaggerModels);
    taggerContainer.appendChild(localTaggerGenThreshold);
    taggerContainer.appendChild(localTaggerMethod);
    taggerContainer.appendChild(miraITUTaggerButton);
    manualTagsContainer.appendChild(localTagsText);
    bodyContainer.appendChild(taggerContainer);
    bodyContainer.appendChild(manualTagsContainer);
    return {
        container: bodyContainer,
        cleanup: () => {
            localTaggerModels.removeEventListener('change', handleSAATaggerModelChange);
            localTaggerGenThreshold.removeEventListener('change', handleLocalThresholdChange);
            localTaggerMethod.removeEventListener('change', handleTaggerMethodChange);
            miraITUTaggerButton.removeEventListener('click', handleMiraTaggerClick);
            localTagsText.removeEventListener('input', handleTagsInput);
        }
    };
}

let isProcessing = false;
async function handleMiraITUClick() {
    if (isProcessing) return;

    await runMiraITU();
}

async function handleMiraTaggerClick() {
    if (isProcessing) return;

    console.log("Crop Image and Run Local Tagger");
    await runLocalTagger();
}

function createHeader(imageData, imageWidth){
    const SETTINGS = globalThis.globalSettings;
    const FILES = globalThis.cachedFiles;
    const LANG = FILES.language[SETTINGS.language];

    const headerContainer = document.createElement('div');    
    headerContainer.style.display = 'grid';
    headerContainer.style.gridTemplateColumns = '2fr 3fr 1fr';
    headerContainer.style.columnGap = '10px';
    headerContainer.style.marginTop = '10px';
    headerContainer.style.marginBottom = '10px';
    headerContainer.innerHTML = '';
    headerContainer.style.fontSize = '16px';

    const img = document.createElement('img');
    img.src = imageData.startsWith('data:') ? imageData : `data:image/webp;base64,${imageData}`;
    img.alt = `Mira ITU Target Image`;
    img.style.minWidth = '64px';
    img.style.maxHeight = '64px';
    img.style.maxWidth = `${imageWidth}px`;
    img.style.maxHeight = `${imageWidth}px`;
    img.style.objectFit = 'contain';
    img.style.display = 'block';
    img.style.borderRadius = '4px';
    img.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
    img.style.imageAlign = 'center';

    const text = document.createElement('div');
    text.className='mira-itu-header-text';
    text.innerHTML = ``;

    const buttonGridContainer = document.createElement('div');
    buttonGridContainer.style.display = "grid";
    buttonGridContainer.style.gridTemplateColumns = '1fr';
    buttonGridContainer.innerHTML = '';

    const miraITUButton = document.createElement('button');
    miraITUButton.className = 'mira-itu';
    miraITUButton.textContent = LANG.image_info_mira_itu_button;
    miraITUButton.style.alignSelf = 'end';
    miraITUButton.style.minHeight = '100px';
    miraITUButton.style.maxHeight = '120px';
    miraITUButton.addEventListener('click', handleMiraITUClick);    

    headerContainer.appendChild(text);
    headerContainer.appendChild(img);        
    buttonGridContainer.appendChild(miraITUButton);
    headerContainer.appendChild(buttonGridContainer);
    
    miraITU.setText(LANG.message_mira_itu_requirements);
    miraITU.headerText = text;

    return {
        container: headerContainer,
        cleanup: () => {
            miraITUButton.removeEventListener('click', handleMiraITUClick);            
        }
    };
}

function updateMiraITUData() {   
    const SETTINGS = globalThis.globalSettings;
    const FILES = globalThis.cachedFiles;
    const LANG = FILES.language[SETTINGS.language];

    let comboMessage = `\n\n${LANG.image_info_mira_itu_image_resolution} ${lastTaggerOptions.imageWidth}x${lastTaggerOptions.imageHeight}\n`;

    const targetW = lastTaggerOptions.imageWidth * lastTaggerOptions.upscaleRatio;
    const targetH = lastTaggerOptions.imageHeight * lastTaggerOptions.upscaleRatio;
    comboMessage += `${LANG.image_info_mira_itu_upscale_ratio} ${lastTaggerOptions.upscaleRatio}\n`;
    comboMessage += `${LANG.image_info_mira_itu_target_resolution} ${targetW}x${targetH}\n`;

    const maxDeviation = Math.floor(lastTaggerOptions.ituTileSize * 0.25 / 8) * 8;
    comboMessage += `${LANG.image_info_mira_itu_auto_max_deviation} ${maxDeviation}\n`;

    const {tile_width, tile_height, tile_count_w, tile_count_h} = TileHelper._findOptimalTileSize(
        targetW, targetH, lastTaggerOptions.ituTileSize, lastTaggerOptions.ituOverlap, maxDeviation);
    comboMessage += `${LANG.image_info_mira_itu_auto_tile_target} ${tile_width}x${tile_height} -> ${tile_count_w}x${tile_count_h}\n`;

    miraITU.headerText.innerHTML = `<span>${comboMessage.replaceAll('\n', '<br>')}</span>`;
}

export async function createMiraITUWindow(imageBase64, imageRawData){       
    const FILES = globalThis.cachedFiles;

    // init
    if(lastTaggerOptions === null) {
        lastTaggerOptions = {
            imageWidth: 0,
            imageHeight:0,

            imageTaggerModels: FILES.ONNXList[0],
            imageTaggerGenThreshold: 0.55,

            localTaggerModels: FILES.imageTaggerModels[0],
            localTaggerGenThreshold: 0.55,
            localTaggerMethod: "ComfyUI",
            localTagsText:"",

            ituTileSize: 2048,
            ituOverlap: 64,
            ituFeather: 1,

            upscaleModels: FILES.upscalerList[0],
            upscaleRatio: 2,
            upscaleVAEmethod: 'Full',

            positiveText:'masterpiece, best quality, amazing quality',
            negativeText:'bad quality,worst quality,worst detail,sketch',
            samplerSelect:'euler_ancestral',
            schedulerSelect:'beta',
            steps: 16,
            cfg: 7,
            denoise: 0.4,

            mergeMethod: 'Image'
        };
    }

    // Clean up last time exist ---> Close window with RED DOT
    if (currentCleanupFunctions.length > 0) {
        currentCleanupFunctions.forEach(fn => fn());
        currentCleanupFunctions = [];
    }

    cachedImage = imageRawData;

    miraITU = globalThis.overlay.custom.createCustomOverlay(
        null,
        '',
        256,
        'left',
        'left',
        'mira-itu-container',
        'miraITU'
    );
    miraITU.container.style.display = 'grid';
    miraITU.container.style.gridTemplateColumns = '1fr';
    miraITU.container.style.marginBottom = '15px';
    miraITU.container.style.boxSizing = 'border-box';
    miraITU.container.style.rowGap = '0px';
    miraITU.container.style.fontSize = '14px';

    const header = createHeader(imageBase64, 256);
    const upscale = createUpscaleModelConfig();
    const tagger = createTagger();
    const miraConfig = createMiraITUConfig();
    const imageConfig = createImageConfig();
    const ksampler = createKSamplerData();
    const localTagger = createLocalTagger();

    miraITU.container.appendChild(header.container);
    miraITU.container.appendChild(upscale.container);
    miraITU.container.appendChild(tagger.container);
    miraITU.container.appendChild(miraConfig.container);
    miraITU.container.appendChild(imageConfig.container);
    miraITU.container.appendChild(ksampler.container);
    miraITU.container.appendChild(localTagger.container);

    // Collect all clean up
    currentCleanupFunctions = [
        header.cleanup,
        upscale.cleanup,
        tagger.cleanup,
        miraConfig.cleanup,
        imageConfig.cleanup,
        ksampler.cleanup
    ];
    
    const buffer = await cachedImage.arrayBuffer();
    const blob = toBlob(buffer);
    const size = await getImageSizeFromBlob(blob);
    lastTaggerOptions.imageWidth = size.width;
    lastTaggerOptions.imageHeight = size.height;

    updateMiraITUData();
}

async function runMiraITU() {
    const SETTINGS = globalThis.globalSettings;
    const FILES = globalThis.cachedFiles;
    const LANG = FILES.language[SETTINGS.language];

    let errorMessage = '';
    if(lastTaggerOptions.imageTaggerModels === 'None')
        errorMessage += `${LANG.message_mira_itu_need_tagger}\n`;

    if (lastTaggerOptions.upscaleModels.startsWith("Latent")) 
        errorMessage +=`${LANG.message_mira_itu_do_not_use_latent_upscale}\n`;

    if (errorMessage !== '') {
        globalThis.overlay.custom.createErrorOverlay(errorMessage, errorMessage);
        return;
    }

    if (lastTaggerOptions.localTaggerMethod !== 'ComfyUI' && lastTaggerOptions.localTagsText.trim() === "") {
        console.warn("Empty lastTaggerOptions.localTagsText: ", lastTaggerOptions.localTagsText);
        console.log("Start runLocalTagger");
        await runLocalTagger();
    }
    
    isProcessing = true;
    const buttonMiraITU = document.querySelector('.mira-itu');
    const buttonTagger = document.querySelector('.mira-itu-tagger');    
    
    if (buttonMiraITU) {
        buttonMiraITU.disabled = true;
        buttonMiraITU.style.opacity = '0.6';
        buttonMiraITU.style.cursor = 'not-allowed';
        buttonMiraITU.textContent = LANG.image_info_mira_itu_button_processing;

        buttonTagger.disabled = true;
        buttonTagger.style.opacity = '0.6';
        buttonTagger.style.cursor = 'not-allowed';
        
        // lock 1000ms            
        setTimeout(() => {
            buttonMiraITU.disabled = false;
            buttonMiraITU.style.opacity = '1';
            buttonMiraITU.style.cursor = 'pointer';
            buttonMiraITU.textContent = LANG.image_info_mira_itu_button;

            buttonTagger.disabled = false;
            buttonTagger.style.opacity = '1';
            buttonTagger.style.cursor = 'pointer';
            isProcessing = false;
        }, 1000);
    } else {        
        setTimeout(() => {
            isProcessing = false;
        }, 1000);
    }

    await callback_generate_start('MiraITU', {imageData:cachedImage, taggerOptions:lastTaggerOptions});
}

// eslint-disable-next-line sonarjs/cognitive-complexity
async function runLocalTagger() {
    const SETTINGS = globalThis.globalSettings;
    const FILES = globalThis.cachedFiles;
    const LANG = FILES.language[SETTINGS.language];

    let errorMessage = '';
    if(lastTaggerOptions.localTaggerModels === 'None' && lastTaggerOptions.localTaggerMethod !== 'ComfyUI')
        errorMessage += `${LANG.message_mira_itu_need_tagger}\n`;
 
    if (errorMessage !== '') {
        globalThis.overlay.custom.createErrorOverlay(errorMessage, errorMessage);
        return;
    }

    isProcessing = true;
    const buttonTagger = document.querySelector('.mira-itu-tagger');
    const buttonMiraITU = document.querySelector('.mira-itu');

    if (buttonTagger && buttonMiraITU) {
        buttonTagger.disabled = true;
        buttonTagger.style.opacity = '0.6';
        buttonTagger.style.cursor = 'not-allowed';
        buttonTagger.textContent = LANG.image_info_mira_itu_button_processing;
        
        buttonMiraITU.disabled = true;
        buttonMiraITU.style.opacity = '0.6';
        buttonMiraITU.style.cursor = 'not-allowed';
    } 

    const targetW = lastTaggerOptions.imageWidth * lastTaggerOptions.upscaleRatio;
    const targetH = lastTaggerOptions.imageHeight * lastTaggerOptions.upscaleRatio;
    const maxDeviation = Math.floor(lastTaggerOptions.ituTileSize * 0.25 / 8) * 8;
    const {tile_width, tile_height, tile_count_w, tile_count_h} = TileHelper._findOptimalTileSize(
        targetW, targetH, lastTaggerOptions.ituTileSize, lastTaggerOptions.ituOverlap, maxDeviation);        
    console.log(`Tagging ${tile_width}x${tile_height} -> ${tile_count_w}x${tile_count_h}`);

    const buffer = await cachedImage.arrayBuffer();
    const cropper = await CropImageHelper.create(buffer, targetW, targetH);
    const tileImages = await cropper.cropWithCalculation(tile_width, tile_height, lastTaggerOptions.ituOverlap);    

    let tagsList = null;
    for(const tile of tileImages.images){
        let imageBase64 = await fileToBase64(toBlob(tile));
        if (typeof imageBase64 === 'string' && imageBase64.startsWith('data:')) {
            imageBase64 = imageBase64.split(',')[1];
        }

        let result = '';
        if (globalThis.inBrowser) {
            result = await sendWebSocketMessage({ 
                type: 'API', 
                method: 'runImageTagger', 
                params: [
                    imageBase64,
                    lastTaggerOptions.localTaggerModels,
                    Number(lastTaggerOptions.localTaggerGenThreshold),
                    1,
                    "General",
                    true
                ]});
        } else {
            result = await globalThis.api.runImageTagger({
                image_input: imageBase64,
                model_choice: lastTaggerOptions.localTaggerModels,
                gen_threshold: Number(lastTaggerOptions.localTaggerGenThreshold),
                char_threshold: 1,
                model_options:"General",
                wait:true
            });
        }
        result = result.join(', ');
        tagsList = tagsList?`${tagsList}\n${result}`:`${result}`;
    }
    console.log("Tags:", tagsList);

    isProcessing = false;
    if(buttonMiraITU && buttonTagger) {
        buttonMiraITU.disabled = false;
        buttonMiraITU.style.opacity = '1';
        buttonMiraITU.style.cursor = 'pointer';
        buttonMiraITU.textContent = LANG.image_info_mira_itu_button;

        buttonTagger.disabled = false;
        buttonTagger.style.opacity = '1';
        buttonTagger.style.cursor = 'pointer';
        buttonTagger.textContent = LANG.image_info_mira_itu_local_tagger_button;        
    }
    const localTaggerText = document.querySelector('#mira-itu-tagger-textarea');

    if(localTaggerText)
    {
        localTaggerText.value= tagsList;
        lastTaggerOptions.localTagsText = tagsList;
    }
}

