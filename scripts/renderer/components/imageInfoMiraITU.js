import { createHtmlOptions } from './imageInfoTagger.js';
import { toBlob, getImageSizeFromBlob } from './imageInfoUtils.js'
import { TileHelper, CropImageHelper } from './helper.js';
import { callback_generate_start } from '../callbacks.js';
import { SAMPLER_COMFYUI, SCHEDULER_COMFYUI } from '../language.js';
import { fileToBase64 } from '../generate.js';
import { sendWebSocketMessage } from '../../../webserver/front/wsRequest.js';
import { setBlur, setNormal, showDialog } from './myDialog.js';

let settingsFileName = 'settings.json';
let lastTaggerOptions = null;
let miraITU = null;
let cachedImageB64 = null;
let cachedImage = null;

let currentCleanupFunctions = [];

export function exportMiraITUData() {
    return lastTaggerOptions;
}

export function importMiraITUData(data) {
    const FILES = globalThis.cachedFiles;
    
    lastTaggerOptions = {
        imageWidth: data?.imageWidth ?? 0,
        imageHeight: data?.imageHeight ?? 0,

        imageTaggerModels: data?.imageTaggerModels ?? FILES.ONNXList[0],
        imageTaggerGenThreshold: data?.imageTaggerGenThreshold ?? 0.55,

        localTaggerModels: data?.localTaggerModels ?? FILES.imageTaggerModels[0],
        localTaggerGenThreshold: data?.localTaggerGenThreshold ?? 0.55,
        localTaggerMethod: data?.localTaggerMethod ?? "ComfyUI",
        localTagsText: data?.localTagsText ?? "",

        ituTileSize: data?.ituTileSize ?? 2048,
        ituOverlap: data?.ituOverlap ?? 128,
        ituFeather: data?.ituFeather ?? 2,

        method: data?.method ?? 'Checkpoint',
        sdxlModels: data?.sdxlModels ?? FILES.modelList[0],
        sdxlVAE: data?.sdxlVAE ?? 'Auto',
        unetModels: data?.unetModels ?? FILES.diffusionList[0],
        unetClipModels: data?.unetClipModels ?? FILES.textEncoderList[0],
        unetClipType: data?.unetClipType ?? 'stable_diffusion',
        unetVAE: data?.unetVAE ?? FILES.vaeList[0],

        upscaleModels: data?.upscaleModels ?? 'None',
        upscaleRatio: data?.upscaleRatio ?? 2,
        upscaleVAEmethod: data?.upscaleVAEmethod ?? 'Full',

        positiveText: data?.positiveText ?? '',
        negativeText: data?.negativeText ?? '',
        samplerSelect: data?.samplerSelect ?? 'euler_ancestral',
        schedulerSelect: data?.schedulerSelect ?? 'beta',
        steps: data?.steps ?? 16,
        cfg: data?.cfg ?? 7,
        denoise: data?.denoise ?? 0.4,
        pixelAlignment: data?.pixelAlignment ?? 8,

        referenceMode: data?.referenceMode ?? 'Normal',
        noiseInjectionMethod: data?.noiseInjectionMethod ?? 'adaptive',
        noiseBoost: data?.noiseBoost ?? 0.3,

        colorCorrection: data?.colorCorrection ?? 1,
        luminanceCorrection: data?.luminanceCorrection ?? 1,
        edgeSmoothing: data?.edgeSmoothing ?? 0.1,
    };
}

async function loadMiraITUData() { 
    const FILES = globalThis.cachedFiles;
    let data = null;
    if(FILES.miraITUSettings.length > 0) {
        const hasSettingsJson = FILES.miraITUSettings?.includes('settings.json');
        console.log('FILES.miraITUSettings', FILES.miraITUSettings);
        console.log('hasSettingsJson', hasSettingsJson);
        settingsFileName = hasSettingsJson ? 'settings.json' : FILES.miraITUSettings[0];
        if(globalThis.inBrowser) {
            data = await sendWebSocketMessage({ type: 'API', method: 'loadMiraITUSettingFile', params: [settingsFileName] });
        } else {
            data = await globalThis.api.loadMiraITUSettingFile(settingsFileName);
        }
    } else {
        console.warn("No MiraITU settings file found. Using default settings.");
        globalThis.cachedFiles.miraITUSettings = ['None'];
        settingsFileName = 'None';
    }
    
    if (data) {
        importMiraITUData(data);
    } else {
        const FILES = globalThis.cachedFiles;

        // default options
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
            ituOverlap: 128,
            ituFeather: 2,

            method: 'Checkpoint',   
            sdxlModels: FILES.modelList[0], // Checkpoint
            sdxlVAE: 'Auto', // VAE override
            unetModels: FILES.diffusionList[0], // Diffusion
            unetClipModels: FILES.textEncoderList[0],
            unetClipType: 'stable_diffusion',
            unetVAE: FILES.vaeList[0],

            upscaleModels: 'None',
            upscaleRatio: 2,
            upscaleVAEmethod: 'Full',

            positiveText:'masterpiece, best quality, amazing quality',
            negativeText:'bad quality,worst quality,worst detail,sketch',
            samplerSelect:'euler_ancestral',
            schedulerSelect:'beta',
            steps: 16,
            cfg: 7,
            denoise: 0.4,
            pixelAlignment: 8,

            referenceMode: 'Normal',        // Normal, Reference
            noiseInjectionMethod: 'adaptive',    //uniform, high_frequency, adaptive
            noiseBoost: 0.3,

            colorCorrection: 1,          
            luminanceCorrection: 1,      
            edgeSmoothing: 0.1,          
        };
    }
}


function createTaggerVaeColorTransfer() {
    const SETTINGS = globalThis.globalSettings;
    const FILES = globalThis.cachedFiles;
    const LANG = FILES.language[SETTINGS.language];

    const mainContainer = document.createElement('div');
    mainContainer.style.display = 'grid';
    mainContainer.style.gridTemplateColumns = '6fr';
    mainContainer.innerHTML = ""; 

    const methodContainer = document.createElement('div');
    methodContainer.style.display = 'grid';
    methodContainer.style.gridTemplateColumns = '1fr 1fr 1fr 1fr 1fr 1fr';
    methodContainer.style.columnGap = '10px';
    methodContainer.style.alignItems = 'center';
    methodContainer.innerHTML = LANG.image_info_mira_itu_taggerVaeColorTransfer; 

    const comfyuiTagger = createTagger();
    const localTagger = createLocalTagger();

    const localTaggerMethod = document.createElement('select');
    localTaggerMethod.className = 'controlnet-select';
    localTaggerMethod.innerHTML = createHtmlOptions(['ComfyUI', 'SAA', 'None']);
    localTaggerMethod.value = lastTaggerOptions?.localTaggerMethod || 'ComfyUI';
    localTaggerMethod.addEventListener('change', handleTaggerMethodChange);
    function handleTaggerMethodChange() {
        lastTaggerOptions.localTaggerMethod = localTaggerMethod.value;
        
        if (localTaggerMethod.value === 'ComfyUI') {                        
            localTagger.container.remove();
            mainContainer.appendChild(comfyuiTagger.container);
        } else if (localTaggerMethod.value === 'SAA') {            
            comfyuiTagger.container.remove();
            mainContainer.appendChild(localTagger.container);            
        } else {                
            localTagger.container.remove();
            comfyuiTagger.container.remove();
        }
    }

    const upscaleVAEmethod = document.createElement('select');
    upscaleVAEmethod.className = 'controlnet-select';
    upscaleVAEmethod.innerHTML = createHtmlOptions(['Full', 'Tiled']);
    upscaleVAEmethod.value = lastTaggerOptions?.upscaleVAEmethod || 'Full';
    upscaleVAEmethod.addEventListener('change', handleVAE);
    function handleVAE() {
        lastTaggerOptions.upscaleVAEmethod = upscaleVAEmethod.value;
    }

    // pixel alignment
    const pixelAlignment = document.createElement('select');
    pixelAlignment.className = 'controlnet-select';
    pixelAlignment.innerHTML = createHtmlOptions(['8', '16', '32', '64', '128']);
    pixelAlignment.value = lastTaggerOptions?.localTaggerMethod || '8';
    pixelAlignment.title = 'SDXL/Z Image/Anima: 8\nFlux.2: 16\nQwenImage: 32?';
    pixelAlignment.value = lastTaggerOptions?.pixelAlignment || '8';
    pixelAlignment.addEventListener('input', handlePixelAlignmentInput);
    function handlePixelAlignmentInput() {
        lastTaggerOptions.pixelAlignment = Number(pixelAlignment.value);
        updateMiraITUData();
    }

    // Color correction
    const colorCorrection = document.createElement('textarea');
    colorCorrection.id = 'mira-itu-textarea';
    colorCorrection.className = 'myTextbox-prompt-positive-textarea';
    colorCorrection.rows = 1;
    colorCorrection.placeholder = '1.0';
    colorCorrection.style.resize = 'none';
    colorCorrection.style.boxSizing = 'border-box';
    colorCorrection.style.minHeight = '32px';
    colorCorrection.style.maxHeight = '32px';
    colorCorrection.value = lastTaggerOptions?.colorCorrection || '1.0';
    colorCorrection.addEventListener('input', handleColorCorrectionInput);
    function handleColorCorrectionInput() {
        const validCharsRegex = /^[0-9.]*$/;
        if (validCharsRegex.test(this.value)) {
            if (Number(this.value) > 1) this.value = '1';
            if (Number(this.value) < 0) this.value = '0';
            lastTaggerOptions.colorCorrection = Number(this.value);
        } else {
            this.value = this.value.replaceAll(/[^0-9.]/g, '');
        }
    }

    const luminanceCorrection = document.createElement('textarea');
    luminanceCorrection.id = 'mira-itu-textarea';
    luminanceCorrection.className = 'myTextbox-prompt-positive-right-textarea';
    luminanceCorrection.rows = 1;
    luminanceCorrection.placeholder = '1.0';
    luminanceCorrection.style.resize = 'none';
    luminanceCorrection.style.boxSizing = 'border-box';
    luminanceCorrection.style.minHeight = '32px';
    luminanceCorrection.style.maxHeight = '32px';
    luminanceCorrection.value = lastTaggerOptions?.luminanceCorrection || '1.0';
    luminanceCorrection.addEventListener('input', handleLuminanceCorrectionInput);
    function handleLuminanceCorrectionInput() {
        const validCharsRegex = /^[0-9.]*$/;
        if (validCharsRegex.test(this.value)) {
            if (Number(this.value) > 1) this.value = '1';
            if (Number(this.value) < 0) this.value = '0';
            lastTaggerOptions.luminanceCorrection = Number(this.value);
        } else {
            this.value = this.value.replaceAll(/[^0-9.]/g, '');
        }
    }

    const edgeSmoothing = document.createElement('textarea');
    edgeSmoothing.id = 'mira-itu-textarea';
    edgeSmoothing.className = 'myTextbox-prompt-common-textarea';
    edgeSmoothing.rows = 1;
    edgeSmoothing.placeholder = '0.1';
    edgeSmoothing.style.resize = 'none';
    edgeSmoothing.style.boxSizing = 'border-box';
    edgeSmoothing.style.minHeight = '32px';
    edgeSmoothing.style.maxHeight = '32px';
    edgeSmoothing.value = lastTaggerOptions?.edgeSmoothing || '0.1';
    edgeSmoothing.addEventListener('input', handleEdgeSmoothingInput);
    function handleEdgeSmoothingInput() {
        const validCharsRegex = /^[0-9.]*$/;
        if (validCharsRegex.test(this.value)) {
            if (Number(this.value) > 1) this.value = '1';
            if (Number(this.value) < 0) this.value = '0';
            lastTaggerOptions.edgeSmoothing = Number(this.value);
        } else {
            this.value = this.value.replaceAll(/[^0-9.]/g, '');
        }
    }

    methodContainer.appendChild(localTaggerMethod);
    methodContainer.appendChild(upscaleVAEmethod);    
    methodContainer.appendChild(pixelAlignment);
    methodContainer.appendChild(colorCorrection);
    methodContainer.appendChild(luminanceCorrection);
    methodContainer.appendChild(edgeSmoothing);    

    mainContainer.appendChild(methodContainer);
    
    // Initialize the correct tagger based on saved options
    handleTaggerMethodChange();       

    return {
        container: mainContainer,
        cleanup: () => {
            localTaggerMethod.removeEventListener('change', handleTaggerMethodChange);
            upscaleVAEmethod.removeEventListener('change', handleVAE);

            pixelAlignment.removeEventListener('input', handlePixelAlignmentInput);

            colorCorrection.removeEventListener('input', handleColorCorrectionInput);
            luminanceCorrection.removeEventListener('input', handleLuminanceCorrectionInput);
            edgeSmoothing.removeEventListener('input', handleEdgeSmoothingInput);            

            comfyuiTagger.cleanup();
            localTagger.cleanup();
        }
    };
}

function createTagger() {
    const SETTINGS = globalThis.globalSettings;
    const FILES = globalThis.cachedFiles;
    const LANG = FILES.language[SETTINGS.language];

    const taggerContainer = document.createElement('div');
    taggerContainer.style.display = 'grid';
    taggerContainer.style.gridTemplateColumns = '3fr 1fr 1fr 1fr';
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

    const dummy1 = document.createElement('div');
    const dummy2 = document.createElement('div');

    taggerContainer.appendChild(imageTaggerModels);
    taggerContainer.appendChild(imageTaggerGenThreshold);
    taggerContainer.appendChild(dummy1);
    taggerContainer.appendChild(dummy2);

    return {
        container: taggerContainer,
        cleanup: () => {
            imageTaggerModels.removeEventListener('change', handleModelChange);
            imageTaggerGenThreshold.removeEventListener('change', handleThresholdChange);            
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
    bodyContainer.innerHTML = "";

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

    const manualTagsContainer = document.createElement('div');
    manualTagsContainer.style.display = 'grid';
    manualTagsContainer.style.gridTemplateColumns = '1fr';
    manualTagsContainer.style.columnGap = '10px';
    manualTagsContainer.innerHTML = '';

    const localTagsText = document.createElement('textarea');
    localTagsText.id = 'mira-itu-tagger-textarea';
    localTagsText.className = 'myTextbox-prompt-positive-textarea';
    localTagsText.rows = 10;
    localTagsText.placeholder = LANG.image_info_mira_itu_manualTags + LANG.image_info_mira_itu_manualTags_placeholder;
    localTagsText.style.resize = 'vertical';
    localTagsText.style.boxSizing = 'border-box';
    localTagsText.style.minHeight = '42px';
    localTagsText.style.maxHeight = '320px';
    localTagsText.style.maxWidth = "100%";
    localTagsText.value = lastTaggerOptions?.localTagsText || '';
    localTagsText.addEventListener('input', handleTagsInput);    
    function handleTagsInput() {
        lastTaggerOptions.localTagsText = localTagsText.value;
    }

    const miraITUTaggerButton = document.createElement('button');
    miraITUTaggerButton.className = 'mira-itu-tagger';
    miraITUTaggerButton.textContent = LANG.image_info_mira_itu_local_tagger_button;
    miraITUTaggerButton.style.alignSelf = 'end';
    miraITUTaggerButton.style.minHeight = '32px';
    miraITUTaggerButton.style.maxHeight = '32px';
    miraITUTaggerButton.style.width = '100%';
    miraITUTaggerButton.addEventListener('click', handleMiraTaggerClick);

    const dummy1 = document.createElement('div');

    taggerContainer.appendChild(localTaggerModels);
    taggerContainer.appendChild(localTaggerGenThreshold);
    taggerContainer.appendChild(dummy1);
    taggerContainer.appendChild(miraITUTaggerButton);
    manualTagsContainer.appendChild(localTagsText);
    bodyContainer.appendChild(taggerContainer);
    bodyContainer.appendChild(manualTagsContainer);
    return {
        container: bodyContainer,
        cleanup: () => {
            localTaggerModels.removeEventListener('change', handleSAATaggerModelChange);
            localTaggerGenThreshold.removeEventListener('change', handleLocalThresholdChange);            
            miraITUTaggerButton.removeEventListener('click', handleMiraTaggerClick);
            localTagsText.removeEventListener('input', handleTagsInput);
        }
    };
}

function createModelConfig() {
    const SETTINGS = globalThis.globalSettings;
    const FILES = globalThis.cachedFiles;
    const LANG = FILES.language[SETTINGS.language];
    
    const mainContainer = document.createElement('div');
    mainContainer.style.display = 'grid';
    mainContainer.style.gridTemplateColumns = '6fr';    
    mainContainer.innerHTML = "";

    const modelContainer = document.createElement('div');
    modelContainer.style.display = 'grid';
    modelContainer.style.gridTemplateColumns = '2fr 1fr 2fr 1fr';
    modelContainer.style.columnGap = '10px';
    modelContainer.innerHTML = LANG.image_info_mira_itu_modelContainer_checkpoint;

    // checkpoint models for SDXL
    const sdxlModels = document.createElement('select');
    sdxlModels.className = 'controlnet-select';
    sdxlModels.innerHTML = createHtmlOptions(FILES.modelList);
    sdxlModels.value = lastTaggerOptions?.sdxlModels || FILES.modelList[0];
    sdxlModels.addEventListener('change', handleSDXLModel);
    function handleSDXLModel() {
        lastTaggerOptions.sdxlModels = sdxlModels.value;
    }

    const sdxlVAE = document.createElement('select');
    sdxlVAE.className = 'controlnet-select';
    sdxlVAE.innerHTML = createHtmlOptions(['Auto', ...FILES.vaeList]);
    sdxlVAE.value = lastTaggerOptions?.sdxlVAE || 'Auto';
    sdxlVAE.addEventListener('change', handleSDXLVAE);
    function handleSDXLVAE() {
        lastTaggerOptions.sdxlVAE = sdxlVAE.value;
    }

    const dummy1 = document.createElement('div');
    const dummy2 = document.createElement('div');

    // diffusers unet models
    const unetModels = document.createElement('select');
    unetModels.className = 'controlnet-select';
    unetModels.innerHTML = createHtmlOptions(FILES.diffusionList);
    unetModels.value = lastTaggerOptions?.unetModels || FILES.diffusionList[0];
    unetModels.addEventListener('change', handleUNETModel);
    function handleUNETModel() {
        lastTaggerOptions.unetModels = unetModels.value;
    }

    const unetClipModels = document.createElement('select');
    unetClipModels.className = 'controlnet-select';
    unetClipModels.innerHTML = createHtmlOptions(FILES.textEncoderList);
    unetClipModels.value = lastTaggerOptions?.unetClipModels || FILES.textEncoderList[0];
    unetClipModels.addEventListener('change', handleUNETClip);
    function handleUNETClip() {
        lastTaggerOptions.unetClipModels = unetClipModels.value;
    }

    const unetClipType = document.createElement('select');
    unetClipType.className = 'controlnet-select';
    unetClipType.innerHTML = createHtmlOptions(["stable_diffusion", "stable_cascade", "sd3", "stable_audio", "mochi", "ltxv", "pixart", "cosmos", "lumina2", "wan", "hidream", "chroma", "ace", "omnigen2", "qwen_image", "hunyuan_image", "flux2", "ovis"]);
    unetClipType.value = lastTaggerOptions?.unetClipType || 'stable_diffusion';
    unetClipType.addEventListener('change', handleUNETClipType);
    function handleUNETClipType() {
        lastTaggerOptions.unetClipType = unetClipType.value;
    }

    const unetVAE = document.createElement('select');
    unetVAE.className = 'controlnet-select';
    unetVAE.innerHTML = createHtmlOptions(FILES.vaeList);
    unetVAE.value = lastTaggerOptions?.unetVAE || FILES.vaeList[0];
    unetVAE.addEventListener('change', handleUNETVAE);
    function handleUNETVAE() {
        lastTaggerOptions.unetVAE = unetVAE.value;
    }
    
    const methodContainer = document.createElement('div');
    methodContainer.style.display = 'grid';
    methodContainer.style.gridTemplateColumns = '1fr 1fr 1fr 1fr 1fr 1fr';
    methodContainer.style.columnGap = '10px';
    methodContainer.innerHTML = LANG.image_info_mira_itu_methodContainer;

    const method = document.createElement('select');
    method.className = 'controlnet-select';
    method.innerHTML = createHtmlOptions(['Checkpoint', 'Diffusion']);
    method.value = lastTaggerOptions?.method || 'Checkpoint';
    method.addEventListener('change', handleMethod);
    function handleMethod() {
        lastTaggerOptions.method = method.value;

        if (method.value === 'Checkpoint') {
            unetModels.remove();
            unetClipModels.remove();
            unetVAE.remove();
            modelContainer.innerHTML = LANG.image_info_mira_itu_modelContainer_checkpoint;
            modelContainer.appendChild(sdxlModels);
            modelContainer.appendChild(sdxlVAE);
            modelContainer.appendChild(dummy1);
            modelContainer.appendChild(dummy2);

            if (lastTaggerOptions.referenceMode === 'Reference') {
                const referenceMode = document.querySelector('#mira-itu-reference-mode');
                if (referenceMode) {
                    referenceMode.value = 'Normal';
                    referenceMode.dispatchEvent(new Event('change'));
                }
            }
        } else {    // Diffusion
            sdxlModels.remove();
            sdxlVAE.remove();
            dummy1.remove();
            dummy2.remove();
            modelContainer.innerHTML = LANG.image_info_mira_itu_modelContainer_diffuser;
            modelContainer.appendChild(unetModels);
            modelContainer.appendChild(unetVAE);
            modelContainer.appendChild(unetClipModels);
            modelContainer.appendChild(unetClipType);
        }
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
    scheduleSelect.value = lastTaggerOptions?.schedulerSelect || 'beta';
    scheduleSelect.addEventListener('change', handleSchedule);
    function handleSchedule() {
        lastTaggerOptions.schedulerSelect = scheduleSelect.value;
        updateMiraITUData();
    }
        
    methodContainer.appendChild(method);
    methodContainer.appendChild(stepsText);
    methodContainer.appendChild(cfgText);    
    methodContainer.appendChild(denoiseText);
    methodContainer.appendChild(samplerSelect);    
    methodContainer.appendChild(scheduleSelect);

    // Initial setup
    handleMethod();

    mainContainer.appendChild(methodContainer);
    mainContainer.appendChild(modelContainer);

    return {
        container: mainContainer,
        cleanup: () => {
            method.removeEventListener('change', handleMethod);
            cfgText.removeEventListener('input', handleCFGInput);
            stepsText.removeEventListener('input', handleStepsInput);
            denoiseText.removeEventListener('input', handleDenoiseInput);
            samplerSelect.removeEventListener('change', handleSampler);
            scheduleSelect.removeEventListener('change', handleSchedule);

            sdxlModels.removeEventListener('change', handleSDXLModel);
            sdxlVAE.removeEventListener('change', handleSDXLVAE);

            unetModels.removeEventListener('change', handleUNETModel);
            unetClipModels.removeEventListener('change', handleUNETClip);
            unetClipType.removeEventListener('change', handleUNETClipType);
            unetVAE.removeEventListener('change', handleUNETVAE);            
        }
    };
}

function createUpscaleModelConfig() {
    const SETTINGS = globalThis.globalSettings;
    const FILES = globalThis.cachedFiles;
    const LANG = FILES.language[SETTINGS.language];

    const mainContainer = document.createElement('div');
    mainContainer.style.display = 'grid';
    mainContainer.style.gridTemplateColumns = '6fr';    
    mainContainer.innerHTML = "";

    const upscaleContainer = document.createElement('div');
    upscaleContainer.style.display = 'grid';
    upscaleContainer.style.gridTemplateColumns = '2fr 1fr 1fr 1fr 1fr';
    upscaleContainer.style.columnGap = '10px';
    upscaleContainer.innerHTML = LANG.image_info_mira_itu_upscaleContainer;

    const newUpscaleModels = ['None', ...FILES.upscalerList].filter(model => !model.startsWith("Latent"));    
    const upscaleModels = document.createElement('select');
    upscaleModels.className = 'controlnet-select';
    upscaleModels.innerHTML = createHtmlOptions(newUpscaleModels);
    upscaleModels.value = lastTaggerOptions?.upscaleModels || newUpscaleModels[0];
    upscaleModels.addEventListener('change', handleUpscaleModel);
    function handleUpscaleModel() {
        lastTaggerOptions.upscaleModels = upscaleModels.value;
    }

    const upscaleRatio = document.createElement('textarea');
    upscaleRatio.id = 'mira-itu-textarea';
    upscaleRatio.className = 'myTextbox-prompt-ai-textarea';
    upscaleRatio.rows = 1;
    upscaleRatio.placeholder = '2';
    upscaleRatio.style.resize = 'none';
    upscaleRatio.style.boxSizing = 'border-box';
    upscaleRatio.style.minHeight = '32px';
    upscaleRatio.style.maxHeight = '32px';
    upscaleRatio.value = lastTaggerOptions?.upscaleRatio || '2';
    upscaleRatio.addEventListener('input', handleRatio);
    function handleRatio() {
        const validCharsRegex = /^[0-9.]*$/;
        if (validCharsRegex.test(this.value)) {
            if (Number(this.value) > 8) this.value = '8';
            if (Number(this.value) < 0.1) this.value = '0.1';
            lastTaggerOptions.upscaleRatio = Number(this.value);
            updateMiraITUData();
        } else {
            this.value = this.value.replaceAll(/[^0-9.]/g, '');
        }        
    }

    // MiraITU Settings
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
    ituOverlap.value = lastTaggerOptions?.ituOverlap || 128;
    ituOverlap.addEventListener('change', handleOverlap);
    function handleOverlap() {
        lastTaggerOptions.ituOverlap = Number(ituOverlap.value);
        updateMiraITUData();
    }

    const ituFeather = document.createElement('select');
    ituFeather.className = 'controlnet-select';
    ituFeather.innerHTML = createHtmlOptions([0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4]);
    ituFeather.value = lastTaggerOptions?.ituFeather || 2;
    ituFeather.addEventListener('change', handleFeather);
    function handleFeather() {
        lastTaggerOptions.ituFeather = Number(ituFeather.value);
        updateMiraITUData();
    }
    
    upscaleContainer.appendChild(upscaleModels);
    upscaleContainer.appendChild(upscaleRatio);

    upscaleContainer.appendChild(ituTileSize);
    upscaleContainer.appendChild(ituOverlap);
    upscaleContainer.appendChild(ituFeather);

    mainContainer.appendChild(upscaleContainer);

    return {
        container: mainContainer,
        cleanup: () => {
            upscaleModels.removeEventListener('change', handleUpscaleModel);
            upscaleRatio.removeEventListener('input', handleRatio);       
            
            ituTileSize.removeEventListener('change', handleTileSize);
            ituOverlap.removeEventListener('change', handleOverlap);
            ituFeather.removeEventListener('change', handleFeather);
        }
    };
}

function createPromptConfig() {
    const SETTINGS = globalThis.globalSettings;
    const FILES = globalThis.cachedFiles;
    const LANG = FILES.language[SETTINGS.language];

    const promptContainer = document.createElement('div');
    promptContainer.style.display = 'grid';
    promptContainer.style.gridTemplateColumns = '3fr 3fr';
    promptContainer.style.columnGap = '10px';
    promptContainer.innerHTML = LANG.image_info_mira_itu_promptContainer;

    const positiveText = document.createElement('textarea');
    positiveText.id = 'mira-itu-textarea';
    positiveText.className = 'myTextbox-prompt-positive-textarea';
    positiveText.rows = 12;
    positiveText.placeholder = 'masterpiece, best quality, amazing quality';
    positiveText.style.resize = 'vertical';
    positiveText.style.boxSizing = 'border-box';
    positiveText.style.minHeight = '32px';
    positiveText.style.maxHeight = '200px';
    positiveText.value = lastTaggerOptions?.positiveText;
    positiveText.addEventListener('input', handlePositiveInput);    
    function handlePositiveInput() {
        lastTaggerOptions.positiveText = positiveText.value;
    }    

    const negativeText = document.createElement('textarea');
    negativeText.id = 'mira-itu-textarea';
    negativeText.className = 'myTextbox-prompt-negative-textarea';
    negativeText.rows = 12;
    negativeText.placeholder = 'bad quality,worst quality,worst detail,sketch';
    negativeText.style.resize = 'vertical';
    negativeText.style.boxSizing = 'border-box';
    negativeText.style.minHeight = '32px';
    negativeText.style.maxHeight = '200px';
    negativeText.value = lastTaggerOptions?.negativeText;
    negativeText.addEventListener('input', handleNegativeInput);    
    function handleNegativeInput() {
        lastTaggerOptions.negativeText = negativeText.value;
    }

    promptContainer.appendChild(positiveText);
    promptContainer.appendChild(negativeText);

    return {
        container: promptContainer,
        cleanup: () => {
            positiveText.removeEventListener('input', handlePositiveInput);
            negativeText.removeEventListener('input', handleNegativeInput);
        }
    };
}

function createExtraConfig() {
    const SETTINGS = globalThis.globalSettings;
    const FILES = globalThis.cachedFiles;
    const LANG = FILES.language[SETTINGS.language];

    const extraContainer = document.createElement('div');
    extraContainer.style.display = 'grid';
    extraContainer.style.gridTemplateColumns = '1fr 1fr 1fr 1fr 1fr 1fr';
    extraContainer.style.columnGap = '10px';
    extraContainer.style.alignItems = 'center';
    extraContainer.innerHTML = "";

    const referenceMode = document.createElement('select');
    referenceMode.id = 'mira-itu-reference-mode';
    referenceMode.className = 'controlnet-select';
    referenceMode.title = LANG.image_info_mira_itu_referenceMode_tooltip;
    referenceMode.innerHTML = createHtmlOptions(['Normal', 'Reference']);
    referenceMode.value = lastTaggerOptions?.referenceMode || 'Normal';
    referenceMode.addEventListener('change', handlereferenceMode);

    const noiseInjectionMethod = document.createElement('select');
    noiseInjectionMethod.className = 'controlnet-select';
    noiseInjectionMethod.title = LANG.image_info_mira_itu_noiseInjectionMethod_tooltip;
    noiseInjectionMethod.innerHTML = createHtmlOptions(['uniform', 'high_frequency', 'adaptive']);    
    noiseInjectionMethod.value = lastTaggerOptions?.noiseInjectionMethod || 'adaptive';
    noiseInjectionMethod.addEventListener('change', handlenoiseInjectionMethod);
    function handlenoiseInjectionMethod() {
        lastTaggerOptions.noiseInjectionMethod = noiseInjectionMethod.value;
    }

    const noiseBoost = document.createElement('textarea');
    noiseBoost.id = 'mira-itu-textarea';
    noiseBoost.className = 'myTextbox-prompt-common-textarea';
    noiseBoost.rows = 1;
    noiseBoost.placeholder = '0.3';
    noiseBoost.style.resize = 'none';
    noiseBoost.style.boxSizing = 'border-box';
    noiseBoost.style.minHeight = '32px';
    noiseBoost.style.maxHeight = '32px';
    noiseBoost.value = lastTaggerOptions?.noiseBoost || '0.3';
    noiseBoost.addEventListener('input', handlenoiseBoostInput);
    function handlenoiseBoostInput() {
        const validCharsRegex = /^[0-9.]*$/;
        if (validCharsRegex.test(this.value)) {
            if (Number(this.value) > 1) this.value = '1';
            if (Number(this.value) < 0) this.value = '0';
            lastTaggerOptions.noiseBoost = Number(this.value);
        } else {
            this.value = this.value.replaceAll(/[^0-9.]/g, '');
        }
    }

    const dummy1 = document.createElement('div');
    const dummy2 = document.createElement('div');
    const dummy3 = document.createElement('div');
    dummy1.innerHTML = LANG.image_info_mira_itu_referenceMode;
    dummy2.innerHTML = LANG.image_info_mira_itu_noiseInjectionMethod;
    dummy3.innerHTML = LANG.image_info_mira_itu_noiseBoost;
    extraContainer.appendChild(dummy1);
    extraContainer.appendChild(referenceMode);    

    function handlereferenceMode() {
        if (lastTaggerOptions.method === 'Checkpoint' && referenceMode.value === 'Reference') {
            referenceMode.value = 'Normal';
            globalThis.overlay.custom.createErrorOverlay(LANG.image_info_mira_itu_reference_mode_warning, LANG.image_info_mira_itu_reference_mode_warning);
            return;
        }

        lastTaggerOptions.referenceMode = referenceMode.value;

        if (referenceMode.value === 'Normal') {
            dummy2.remove();
            noiseInjectionMethod.remove();
            dummy3.remove();
            noiseBoost.remove();
        } else {
            extraContainer.appendChild(dummy2);
            extraContainer.appendChild(noiseInjectionMethod);
            extraContainer.appendChild(dummy3);
            extraContainer.appendChild(noiseBoost);
        }        
    }

    handlereferenceMode();

    return {
        container: extraContainer,
        cleanup: () => {
            referenceMode.removeEventListener('change', handlereferenceMode);
            noiseInjectionMethod.removeEventListener('change', handlenoiseInjectionMethod);
            noiseBoost.removeEventListener('input', handlenoiseBoostInput);
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

    const infoContainer = document.createElement('div');    
    infoContainer.style.display = 'grid';
    infoContainer.style.gridTemplateColumns = '2fr';

    const setttings = document.createElement('div');
    setttings.style.display = 'grid';
    setttings.style.gridTemplateColumns = '1.4fr 0.1fr 0.5fr';
    setttings.style.marginRight = '10px';
    setttings.innerHTML = "";

    const settingsList = document.createElement('select');
    settingsList.className = 'controlnet-select';
    settingsList.innerHTML = createHtmlOptions(FILES.miraITUSettings);
    settingsList.value = settingsFileName;
    settingsList.addEventListener('change', handlesettingsListChange);
    async function handlesettingsListChange() {
        settingsFileName = settingsList.value;
        if (settingsFileName !== 'None') {
            let data = null;
            if(globalThis.inBrowser) {
                data = await sendWebSocketMessage({ type: 'API', method: 'loadMiraITUSettingFile', params: [settingsFileName] });
            } else {
                data = await globalThis.api.loadMiraITUSettingFile(settingsFileName);
            }

            if (data) {
                importMiraITUData(data);
                console.log("Loaded", settingsFileName, "settings");
                miraITU.close();
                const tmp_cachedImageB64 = cachedImageB64;
                const tmp_cachedImage = cachedImage;
                await createMiraITUWindow(tmp_cachedImageB64, tmp_cachedImage);
            }
        }
    }
    
    const settingsSave = document.createElement('button');
    settingsSave.className = 'mira-itu-tagger';
    settingsSave.textContent = '💾';
    settingsSave.style.alignSelf = 'start';
    settingsSave.style.minHeight = '32px';
    settingsSave.style.maxHeight = '32px';
    settingsSave.style.minWidth = '48px';
    settingsSave.style.maxWidth = '48px';
    settingsSave.addEventListener('click', handlesettingsSave);
    async function handlesettingsSave() {
        setBlur();
        const inputResult = await showDialog('input', { 
            message: LANG.save_settings_title, 
            placeholder: 'tmp_settings', 
            defaultValue: (settingsFileName === 'None') ? 'settings' : settingsFileName.replace('.json', '')
        });

        if(inputResult){
            console.log("Save current settings as", inputResult);
            const globalSettings = structuredClone(lastTaggerOptions);
            let result;
            if (globalThis.inBrowser) {
                result = await sendWebSocketMessage({ type: 'API', method: 'saveMiraITUSettingFile', params: [`${inputResult}.json`, globalSettings] });
            } else {
                result = await globalThis.api.saveMiraITUSettingFile(`${inputResult}.json`, globalSettings);
            }

            if(result === true) {
                await showDialog('info', { message: LANG.save_settings_success.replace('{0}', inputResult) });
                if (globalThis.inBrowser) {
                    globalThis.cachedFiles.miraITUSettings = await sendWebSocketMessage({ type: 'API', method: 'updateMiraITUSettingFiles' });
                } else {
                    globalThis.cachedFiles.miraITUSettings = await globalThis.api.updateMiraITUSettingFiles();
                    settingsList.innerHTML = createHtmlOptions(globalThis.cachedFiles.miraITUSettings);
                }
            } else {
                await showDialog('info', { message: LANG.save_settings_failed.replace('{0}', inputResult) });
            }
        }
        setNormal();
    }

    const dummy1 = document.createElement('div');
    setttings.appendChild(settingsList);
    setttings.appendChild(dummy1);
    setttings.appendChild(settingsSave);

    const text = document.createElement('div');
    text.className='mira-itu-header-text';
    text.innerHTML = ``;
    
    infoContainer.appendChild(setttings);
    infoContainer.appendChild(text);

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

    headerContainer.appendChild(infoContainer);
    headerContainer.appendChild(img);        
    buttonGridContainer.appendChild(miraITUButton);
    headerContainer.appendChild(buttonGridContainer);
    
    miraITU.setText(LANG.message_mira_itu_requirements);
    miraITU.headerText = text;

    return {
        container: headerContainer,
        cleanup: () => {
            miraITUButton.removeEventListener('click', handleMiraITUClick);
            settingsList.removeEventListener('change', handlesettingsListChange);
            settingsSave.removeEventListener('click', handlesettingsSave);
        }
    };
}

function updateMiraITUData() {   
    const SETTINGS = globalThis.globalSettings;
    const FILES = globalThis.cachedFiles;
    const LANG = FILES.language[SETTINGS.language];

    let comboMessage = `\n\n${LANG.image_info_mira_itu_image_resolution} ${lastTaggerOptions.imageWidth}x${lastTaggerOptions.imageHeight}\n`;

    const pixelAlignment = Number(lastTaggerOptions.pixelAlignment) || 8;
    
    // Apply pixel alignment to target dimensions
    const targetW = Math.floor(lastTaggerOptions.imageWidth * lastTaggerOptions.upscaleRatio / pixelAlignment) * pixelAlignment;
    const targetH = Math.floor(lastTaggerOptions.imageHeight * lastTaggerOptions.upscaleRatio / pixelAlignment) * pixelAlignment;
    
    comboMessage += `${LANG.image_info_mira_itu_upscale_ratio} ${lastTaggerOptions.upscaleRatio}\n`;
    comboMessage += `${LANG.image_info_mira_itu_target_resolution} ${targetW}x${targetH}\n`;

    const maxDeviation = Math.floor(lastTaggerOptions.ituTileSize * 0.25 / pixelAlignment) * pixelAlignment;
    comboMessage += `${LANG.image_info_mira_itu_auto_max_deviation} ${maxDeviation}\n`;

    const maxAspectRatio = 1.33;

    const {tile_width, tile_height, tile_count_w, tile_count_h} = TileHelper._findOptimalTileSize(
        targetW, targetH, lastTaggerOptions.ituTileSize, lastTaggerOptions.ituOverlap, maxDeviation, maxAspectRatio, pixelAlignment);
    comboMessage += `${LANG.image_info_mira_itu_auto_tile_target} ${tile_width}x${tile_height} -> ${tile_count_w}x${tile_count_h}\n`;

    miraITU.headerText.innerHTML = `<span>${comboMessage.replaceAll('\n', '<br>')}</span>`;
}

export async function createMiraITUWindow(imageBase64, imageRawData){
    // init
    if(!lastTaggerOptions)
        await loadMiraITUData();

    // Clean up last time exist ---> Close window with RED DOT
    if (currentCleanupFunctions.length > 0) {
        currentCleanupFunctions.forEach(fn => fn());
        currentCleanupFunctions = [];
    }

    cachedImageB64 = imageBase64;
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
    const model = createModelConfig();
    const upscale = createUpscaleModelConfig();
    const tagger = createTaggerVaeColorTransfer();
    const promptConfig = createPromptConfig();
    const extraConfig = createExtraConfig();

    miraITU.container.appendChild(header.container);
    miraITU.container.appendChild(model.container);
    miraITU.container.appendChild(extraConfig.container);
    miraITU.container.appendChild(upscale.container);    
    miraITU.container.appendChild(tagger.container);
    miraITU.container.appendChild(promptConfig.container);        

    // Collect all clean up
    currentCleanupFunctions = [
        header.cleanup,
        model.cleanup,
        upscale.cleanup,
        tagger.cleanup,
        promptConfig.cleanup,
        extraConfig.cleanup,
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

    if (errorMessage !== '') {
        globalThis.overlay.custom.createErrorOverlay(errorMessage, errorMessage);
        return;
    }

    if (lastTaggerOptions.localTaggerMethod === 'SAA' && lastTaggerOptions.localTagsText.trim() === "") {
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

        if (buttonTagger) {
            buttonTagger.disabled = true;
            buttonTagger.style.opacity = '0.6';
            buttonTagger.style.cursor = 'not-allowed';
        }
        
        // lock 1000ms            
        setTimeout(() => {
            buttonMiraITU.disabled = false;
            buttonMiraITU.style.opacity = '1';
            buttonMiraITU.style.cursor = 'pointer';
            buttonMiraITU.textContent = LANG.image_info_mira_itu_button;

            if (buttonTagger) {
                buttonTagger.disabled = false;
                buttonTagger.style.opacity = '1';
                buttonTagger.style.cursor = 'pointer';
            }
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

    const pixelAlignment = Number(lastTaggerOptions.pixelAlignment) || 8;
    
    // Apply pixel alignment to target dimensions
    const targetW = Math.floor(lastTaggerOptions.imageWidth * lastTaggerOptions.upscaleRatio / pixelAlignment) * pixelAlignment;
    const targetH = Math.floor(lastTaggerOptions.imageHeight * lastTaggerOptions.upscaleRatio / pixelAlignment) * pixelAlignment;
    
    const maxAspectRatio = 1.33;
    const maxDeviation = Math.floor(lastTaggerOptions.ituTileSize * 0.25 / pixelAlignment) * pixelAlignment;
    const {tile_width, tile_height, tile_count_w, tile_count_h} = TileHelper._findOptimalTileSize(
        targetW, targetH, lastTaggerOptions.ituTileSize, lastTaggerOptions.ituOverlap, maxDeviation, maxAspectRatio, pixelAlignment);        
    console.log(`Tagging ${tile_width}x${tile_height} -> ${tile_count_w}x${tile_count_h}`);

    const buffer = await cachedImage.arrayBuffer();
    const cropper = await CropImageHelper.create(buffer, targetW, targetH);
    const tileImages = await cropper.cropWithCalculation(tile_width, tile_height, lastTaggerOptions.ituOverlap, 'png', 0.95, pixelAlignment);    

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
