import * as fs from 'node:fs';
import path from 'node:path';
import { app, ipcMain } from 'electron';
import { setMutexBackendBusy } from '../../main-common.js';
import * as yaml from 'js-yaml';

const CAT = '[ModelList]';
let MODELLIST_COMFYUI = ['Default'];
let MODELLIST_WEBUI = ['Default'];
let MODELLIST_ALL_COMFYUI = MODELLIST_COMFYUI;
let MODELLIST_ALL_WEBUI = MODELLIST_WEBUI;
let LORALIST_COMFYUI = ['None'];
let LORALIST_WEBUI = ['None'];
let CONTROLNET_COMFYUI = ['None'];
let CONTROLNET_WEBUI = ['None'];
let UPSCALER_COMFYUI = ['None'];
let UPSCALER_WEBUI = ['None'];
let ADETAILER_COMFYUI  = ['None'];
let ADETAILER_WEBUI = ['None'];
let ONNX_COMFYUI = ['None'];

let DIFFUSION_MODELS_COMFYUI = ['None'];
let TEXT_ENCODERS_COMFYUI = ['None'];
let VAE_COMFYUI = ['None'];
let VAE_WEBUI = ['None'];

let EXTRA_MODELS = {
    exist: false,
    yamlContent: null,
    checkpoints: [],
    loras: [],
    controlnet: [],
    upscale: []
};
let IMAGE_TAGGER = ['none'];

let CUSTOM_CONFIG = {
    active: false,
    data: null
};

const appPath = app.isPackaged ? path.join(path.dirname(app.getPath('exe')), 'resources', 'app') : app.getAppPath();

function readDirectory(directory='', basePath = '', search_subfolder = false, maxDepth = Infinity, currentDepth = 0, extName = '.safetensors', replaceSlash = false) {
    let files = [];
    try {
        files = fs.readdirSync(directory, { withFileTypes: true });
    } catch (err) {
        console.error(CAT, `Failed to read directory: ${directory}`, err);
        return [];
    }

    let result = [];
    for (const file of files) {
        const relativePath = path.join(basePath, file.name);
        const fullPath = path.join(directory, file.name);

        if (file.isDirectory() && search_subfolder && currentDepth < maxDepth) {
            result = result.concat(readDirectory(fullPath, relativePath, search_subfolder, maxDepth, currentDepth + 1, extName, replaceSlash));
        } else if (file.isFile() && file.name.endsWith(extName)) {
            if (replaceSlash)
                result.push(relativePath.replaceAll('\\', '/'));
            else
                result.push(relativePath);
        }
    }
    return result;
}

function updateONNXList(model_path_comfyui, search_subfolder) {
    const upPathComfyUI = path.join(path.dirname(model_path_comfyui), 'onnx');

    if (fs.existsSync(upPathComfyUI)) {
        const onnxList = readDirectory(upPathComfyUI, '', search_subfolder, Infinity, 0, '.onnx', true);
        ONNX_COMFYUI = onnxList;
    } else {
        ONNX_COMFYUI = [];
    }

    if (ONNX_COMFYUI.length > 0) {
        // do nothing
    } else {
        ONNX_COMFYUI = ['None'];
    }
}

function updateADetailerList(model_path_comfyui, model_path_webui, search_subfolder) {
    // --- ComfyUI ---
    const bboxPaths = resolveCustomPaths(['comfyui'], 'aDetailer_bbox');
    const samsPaths = resolveCustomPaths(['comfyui'], 'aDetailer_sams');

    if (bboxPaths.length > 0 || samsPaths.length > 0) {
        const bbox = scanMultipleDirectories(bboxPaths, search_subfolder, '.pt');
        const sams = scanMultipleDirectories(samsPaths, search_subfolder, '.pth');
        ADETAILER_COMFYUI = [...bbox, ...sams];
    } else {
        const adPatchComfyUIBbox = path.join(path.dirname(model_path_comfyui), 'ultralytics', 'bbox');
        const adPatchComfyUISams = path.join(path.dirname(model_path_comfyui), 'sams');    

        if (fs.existsSync(adPatchComfyUIBbox) && fs.existsSync(adPatchComfyUISams) ) {
            const bbox = readDirectory(adPatchComfyUIBbox, '', search_subfolder, Infinity, 0, '.pt');
            const sams  = readDirectory(adPatchComfyUISams, '', search_subfolder, Infinity, 0, '.pth');
            ADETAILER_COMFYUI = [...bbox, ...sams];
        } else {
            ADETAILER_COMFYUI = [];
        }
    }
    
    // --- WebUI ---
    const webPaths = resolveCustomPaths(['a1111', 'forge'], 'adetailer');
    if (webPaths.length > 0) {
        ADETAILER_WEBUI = scanMultipleDirectories(webPaths, search_subfolder);
    } else {
        const adPatchWebUI = path.join(path.dirname(model_path_webui), 'adetailer');
        if (fs.existsSync(adPatchWebUI)) {
            ADETAILER_WEBUI = readDirectory(adPatchWebUI, '', search_subfolder, Infinity, 0, '.pt');
        } else {
            ADETAILER_WEBUI = [];
        }
    }    

    if (ADETAILER_COMFYUI.length > 0) {
        // do nothing
    } else {
        ADETAILER_COMFYUI = ['None'];
    }

    if (ADETAILER_WEBUI.length > 0) {
        // do nothing
    } else {
        ADETAILER_WEBUI = ['None'];
    }
}

// eslint-disable-next-line sonarjs/cognitive-complexity
function updateUpscalerList(model_path_comfyui, model_path_webui, search_subfolder) {
    const LATENT_UPSCALERS = [
        'Latent (nearest-exact)', 
        'Latent (bilinear)',
        'Latent (area)',
        'Latent (bicubic)',
        'Latent (bislerp)'
    ];

    // --- ComfyUI ---
    const customComfyPaths = resolveCustomPaths(['comfyui'], 'upscale_models');    
    if (customComfyPaths.length > 0) {
        const pthList = scanMultipleDirectories(customComfyPaths, search_subfolder, '.pth');
        const stList = scanMultipleDirectories(customComfyPaths, search_subfolder, '.safetensors');
        UPSCALER_COMFYUI = [...pthList, ...stList];
    } else {
        const upPathComfyUI = path.join(path.dirname(model_path_comfyui), 'upscale_models');
        if (fs.existsSync(upPathComfyUI)) {
            const pthList = readDirectory(upPathComfyUI, '', search_subfolder, Infinity, 0, '.pth');
            const safetensorsList = readDirectory(upPathComfyUI, '', search_subfolder, Infinity, 0, '.safetensors');
            UPSCALER_COMFYUI = [...pthList, ...safetensorsList];
        } else {
            UPSCALER_COMFYUI = [];
        }
    }
    
    if (EXTRA_MODELS.exist && Array.isArray(EXTRA_MODELS.upscale) && EXTRA_MODELS.upscale.length > 0) {
        const baseList = Array.isArray(UPSCALER_COMFYUI) ? UPSCALER_COMFYUI : [];
        UPSCALER_COMFYUI = Array.from(new Set([...baseList, ...EXTRA_MODELS.upscale]));
    }

    // --- WebUI ---
    const customWebUIPaths = resolveCustomPaths(['a1111'], 'upscale_models'); 
    const forgePaths = resolveCustomPaths(['forge'], 'upscale_models');
    const allWebCustomPaths = [...customWebUIPaths, ...forgePaths];
    if (allWebCustomPaths.length > 0) {
         const pthList = scanMultipleDirectories(allWebCustomPaths, search_subfolder, '.pth');
         const stList = scanMultipleDirectories(allWebCustomPaths, search_subfolder, '.safetensors');
         UPSCALER_WEBUI = [...pthList, ...stList];
    } else {
        const upPathWebUI = path.join(path.dirname(model_path_webui), 'upscale_models');
        if (fs.existsSync(upPathWebUI)) {
            const pthList = readDirectory(upPathWebUI, '', search_subfolder, Infinity, 0, '.pth');
            const safetensorsList = readDirectory(upPathWebUI, '', search_subfolder, Infinity, 0, '.safetensors');
            UPSCALER_WEBUI =  [...pthList, ...safetensorsList];
        } else {
            UPSCALER_WEBUI = [];
        }
    }

    if (UPSCALER_COMFYUI.length > 0) {
        // do nothing
        UPSCALER_COMFYUI = [...UPSCALER_COMFYUI, ...LATENT_UPSCALERS];
    } else {
        UPSCALER_COMFYUI = ['None', ...LATENT_UPSCALERS];
    }

    if (UPSCALER_WEBUI.length > 0) {
        let newList = [];
        for(const item of UPSCALER_WEBUI) {
            newList.push(path.parse(item).name);
        }
        UPSCALER_WEBUI = newList
    } else {
        // For A1111
        // Use static value
        UPSCALER_WEBUI = [
            "R-ESRGAN 4x+ Anime6B",
            "DAT x2",
            "DAT x3",
            "DAT x4",
            "ESRGAN_4x",
            "LDSR",
            "R-ESRGAN 2x+",
            "R-ESRGAN 4x+",            
            "ScuNET GAN",
            "ScuNET PSNR",
            "SwinIR_4x"
        ];
    }
}

function updateImageTaggerList() {   
    const taggerPath = path.join(appPath, 'models', 'tagger');
    console.log(CAT, 'Checking Image Tagger models in:', taggerPath);
    if (fs.existsSync(taggerPath)) {
        IMAGE_TAGGER = readDirectory(taggerPath, '', false, Infinity, 0, '.onnx');
        // empty check
        if (IMAGE_TAGGER.length === 0) {
            IMAGE_TAGGER = ['none'];
        }
    }
}

// eslint-disable-next-line sonarjs/cognitive-complexity
function updateControlNetList(model_path_comfyui, model_path_webui, search_subfolder) {
    // --- ComfyUI ---
    const cnPaths = resolveCustomPaths(['comfyui'], 'controlnet');
    if (cnPaths.length > 0) {
        CONTROLNET_COMFYUI = scanMultipleDirectories(cnPaths, search_subfolder);       
        // Check Clip Vision & IPAdapter
        const cvPaths = resolveCustomPaths(['comfyui'], 'clip_vision');
        const ipaPaths = resolveCustomPaths(['comfyui'], 'ipadapter');
        
        if (cvPaths.length > 0 && ipaPaths.length > 0) {
            let clipList = scanMultipleDirectories(cvPaths, search_subfolder);
            let ipaList = scanMultipleDirectories(ipaPaths, search_subfolder);
            
            let clipVisionListWithPrefix = clipList.map(item => 'CV->' + item);
            let ipaListWithPrefix = ipaList.map(item => 'IPA->' + item);
            CONTROLNET_COMFYUI = CONTROLNET_COMFYUI.concat(clipVisionListWithPrefix, ipaListWithPrefix);
        }
    } else {
        const cnPathComfyUI = path.join(path.dirname(model_path_comfyui), 'controlnet');
        const clipVisionPathComfyUI = path.join(path.dirname(model_path_comfyui), 'clip_vision');
        const ipadapterPathComfyUI = path.join(path.dirname(model_path_comfyui), 'ipadapter');
        if (fs.existsSync(cnPathComfyUI)) {
            CONTROLNET_COMFYUI = readDirectory(cnPathComfyUI, '', search_subfolder);
            if(fs.existsSync(clipVisionPathComfyUI) && fs.existsSync(ipadapterPathComfyUI)) {
                let clipList = readDirectory(clipVisionPathComfyUI, '', search_subfolder);
                let ipaList = readDirectory(ipadapterPathComfyUI, '', search_subfolder);

                let clipVisionListWithPrefix = clipList.map(item => 'CV->' + item);
                let ipaListWithPrefix = ipaList.map(item => 'IPA->' + item);
                CONTROLNET_COMFYUI = CONTROLNET_COMFYUI.concat(clipVisionListWithPrefix, ipaListWithPrefix);
            }
        } else {
            CONTROLNET_COMFYUI = [];
        }
    }

    if (EXTRA_MODELS.exist && Array.isArray(EXTRA_MODELS.controlnet) && EXTRA_MODELS.controlnet.length > 0) {
        const baseList = Array.isArray(CONTROLNET_COMFYUI) ? CONTROLNET_COMFYUI : [];
        CONTROLNET_COMFYUI = Array.from(new Set([...baseList, ...EXTRA_MODELS.controlnet]));
    }


    // --- WebUI ---
    const webCnPaths = resolveCustomPaths(['a1111', 'forge'], 'controlnet');
    if (webCnPaths.length > 0) {
        CONTROLNET_WEBUI = scanMultipleDirectories(webCnPaths, search_subfolder);
    } else {
        const cnPathWebUI_A1111 = path.join(path.dirname(model_path_webui), '..', 'extensions', 'sd-webui-controlnet', 'models');
        const cnPathWebUI_Forge = path.join(path.dirname(model_path_webui), 'ControlNet');
        
        if (fs.existsSync(cnPathWebUI_A1111)) {
            CONTROLNET_WEBUI = readDirectory(cnPathWebUI_A1111, '', search_subfolder);
        } else if (fs.existsSync(cnPathWebUI_Forge)) {
            CONTROLNET_WEBUI = readDirectory(cnPathWebUI_Forge, '', search_subfolder);
        } else {
            CONTROLNET_WEBUI = [];
        }
    }    

    if (CONTROLNET_COMFYUI.length > 0) {
        CONTROLNET_COMFYUI.unshift('none');
    } else {
        CONTROLNET_COMFYUI = ['none'];
    }

    if (CONTROLNET_WEBUI.length > 0) {
        CONTROLNET_WEBUI.unshift('none');
    } else {
        CONTROLNET_WEBUI = ['none'];
    }
}

function updateLoRAList(model_path_comfyui, model_path_webui, search_subfolder) {
    // --- ComfyUI ---
    const customComfyPaths = resolveCustomPaths(['comfyui'], 'lora');    
    if (customComfyPaths.length > 0) {
        LORALIST_COMFYUI = scanMultipleDirectories(customComfyPaths, search_subfolder, '.safetensors');
    } else {
        const loraPathComfyUI = path.join(path.dirname(model_path_comfyui), 'loras');
        if (fs.existsSync(loraPathComfyUI)) {
            LORALIST_COMFYUI = readDirectory(loraPathComfyUI, '', search_subfolder);
        } else {
            LORALIST_COMFYUI = [];
        }
    }

    // Merge Extra Models
    if (EXTRA_MODELS.exist && Array.isArray(EXTRA_MODELS.loras) && EXTRA_MODELS.loras.length > 0) {
        const baseList = Array.isArray(LORALIST_COMFYUI) ? LORALIST_COMFYUI : [];
        LORALIST_COMFYUI = Array.from(new Set([...baseList, ...EXTRA_MODELS.loras]));
    }
    
    // --- WebUI (A1111 & Forge) ---
    const customWebUIPaths = resolveCustomPaths(['a1111', 'forge'], 'lora');
    if (customWebUIPaths.length > 0) {
        LORALIST_WEBUI = scanMultipleDirectories(customWebUIPaths, search_subfolder, '.safetensors');
    } else {
        const loraPathWebUI = path.join(path.dirname(model_path_webui), 'Lora');
        if (fs.existsSync(loraPathWebUI)) {
            LORALIST_WEBUI = readDirectory(loraPathWebUI, '', search_subfolder);
        } else {
            LORALIST_WEBUI = [];
        }
    }
}

// eslint-disable-next-line sonarjs/cognitive-complexity
function updateModelList(model_path_comfyui, model_path_webui, model_filter, enable_filter, search_subfolder) {
    // --- ComfyUI ---
    const customComfyPaths = resolveCustomPaths(['comfyui'], 'model'); // yaml key is 'model'
    
    if (customComfyPaths.length > 0) {
        MODELLIST_ALL_COMFYUI = scanMultipleDirectories(customComfyPaths, search_subfolder);
    } else if (fs.existsSync(model_path_comfyui)) {
        MODELLIST_ALL_COMFYUI = readDirectory(model_path_comfyui, '', search_subfolder);
    } else {
        MODELLIST_ALL_COMFYUI = [];
    }    
    // Merge Extra Models
    if (EXTRA_MODELS.exist && Array.isArray(EXTRA_MODELS.checkpoints) && EXTRA_MODELS.checkpoints.length > 0) {
        const baseList = Array.isArray(MODELLIST_ALL_COMFYUI) ? MODELLIST_ALL_COMFYUI : [];
        MODELLIST_ALL_COMFYUI = Array.from(new Set([...baseList, ...EXTRA_MODELS.checkpoints]));
    }
    
    // --- WebUI ---
    const customWebUIPaths = resolveCustomPaths(['a1111', 'forge'], 'model');
    if (customWebUIPaths.length > 0) {
        MODELLIST_ALL_WEBUI = scanMultipleDirectories(customWebUIPaths, search_subfolder);
    } else if (fs.existsSync(model_path_webui)) {
        MODELLIST_ALL_WEBUI = readDirectory(model_path_webui, '', search_subfolder);
    } else {
        MODELLIST_ALL_WEBUI = [];
    }

    // Apply filter
    if (enable_filter && model_filter) {
        const filters = model_filter.split(',').map(f => f.trim().toLowerCase());
        MODELLIST_COMFYUI = MODELLIST_ALL_COMFYUI.filter(fileName =>
            filters.some(filter => fileName.toLowerCase().includes(filter))
        );
        MODELLIST_WEBUI = MODELLIST_ALL_WEBUI.filter(fileName =>
            filters.some(filter => fileName.toLowerCase().includes(filter))
        );
    } else {
        MODELLIST_COMFYUI = [...MODELLIST_ALL_COMFYUI];
        MODELLIST_WEBUI = [...MODELLIST_ALL_WEBUI];
    }

    if (MODELLIST_COMFYUI.length === 0) {        
        MODELLIST_COMFYUI = ['Default'];
    }

    if (MODELLIST_WEBUI.length === 0) {
        MODELLIST_WEBUI = ['Default'];
    }
}

function updateVAEList(model_path_comfyui, model_path_webui, search_subfolder) {
    // --- ComfyUI ---
    const customComfyPaths = resolveCustomPaths(['comfyui'], 'vae'); // yaml key is 'vae'
    
    if (customComfyPaths.length > 0) {
        VAE_COMFYUI = scanMultipleDirectories(customComfyPaths, search_subfolder);
    } else if (fs.existsSync(model_path_comfyui)) {
        const vaePathComfyUI = path.join(path.dirname(model_path_comfyui), 'vae');
        VAE_COMFYUI = readDirectory(vaePathComfyUI, '', search_subfolder);
    } else {
        VAE_COMFYUI = ['None'];
    }    
    
    // --- WebUI ---
    const customWebUIPaths = resolveCustomPaths(['a1111', 'forge'], 'vae');
    if (customWebUIPaths.length > 0) {
        VAE_WEBUI = scanMultipleDirectories(customWebUIPaths, search_subfolder);
    } else if (fs.existsSync(model_path_webui)) {
        const vaePathWebUI = path.join(path.dirname(model_path_webui), 'VAE');
        VAE_WEBUI = readDirectory(vaePathWebUI, '', search_subfolder);
    } else {
        VAE_WEBUI = ['None'];
    }

    if (VAE_COMFYUI.length === 0) {        
        VAE_COMFYUI = ['None'];
    }

    if (VAE_WEBUI.length === 0) {
        VAE_WEBUI = ['None'];
    }
}

function updateDiffusionModelList(model_path_comfyui, search_subfolder) {
    // --- ComfyUI ---
    const customComfyPaths = resolveCustomPaths(['comfyui'], 'diffusion_models'); 
    
    if (customComfyPaths.length > 0) {
        DIFFUSION_MODELS_COMFYUI = scanMultipleDirectories(customComfyPaths, search_subfolder);
    } else if (fs.existsSync(model_path_comfyui)) {
        const diffusionModelsPath = path.join(path.dirname(model_path_comfyui), 'diffusion_models');
        const unetPath = path.join(path.dirname(model_path_comfyui), 'unet');
        DIFFUSION_MODELS_COMFYUI = [...readDirectory(diffusionModelsPath, '', search_subfolder),
             ...readDirectory(unetPath, '', search_subfolder)];
    } else {
        DIFFUSION_MODELS_COMFYUI = ['None'];
    }    
    
    if (DIFFUSION_MODELS_COMFYUI.length === 0) {        
        DIFFUSION_MODELS_COMFYUI = ['None'];
    }
}

function updateTextEncoderList(model_path_comfyui, search_subfolder) {
    // --- ComfyUI ---
    const customComfyPaths = resolveCustomPaths(['comfyui'], 'text_encoders'); // yaml key is 'text_encoders'
    
    if (customComfyPaths.length > 0) {
        TEXT_ENCODERS_COMFYUI = scanMultipleDirectories(customComfyPaths, search_subfolder);
    } else if (fs.existsSync(model_path_comfyui)) {
        const textEncodersPath = path.join(path.dirname(model_path_comfyui), 'text_encoders');
        TEXT_ENCODERS_COMFYUI = readDirectory(textEncodersPath, '', search_subfolder);
    } else {
        TEXT_ENCODERS_COMFYUI = ['None'];
    }    
    
    if (TEXT_ENCODERS_COMFYUI.length === 0) {        
        TEXT_ENCODERS_COMFYUI = ['None'];
    }
}

function collectRelativePaths(fieldName) {
    const raw = EXTRA_MODELS.yamlContent.a111[fieldName];
    if (!raw) return [];
    if (Array.isArray(raw)) {
        return raw.map(r => String(r).trim()).filter(Boolean);
    } else {
        return String(raw).split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    }
}

function cleanupExtraModelPaths(reload=false) {
    // release EXTRA_MODELS
    EXTRA_MODELS.checkpoints = [];
    EXTRA_MODELS.loras = [];
    EXTRA_MODELS.controlnet = [];
    EXTRA_MODELS.upscale = [];
    
    // reload extra model paths
    if (EXTRA_MODELS.exist && reload) {
        readExtraModelPaths(model_path_comfyui);
    }
}

function readExtraModelPaths(model_path_comfyui) {
    cleanupExtraModelPaths(false);
    
    const basePath = path.dirname(path.dirname(model_path_comfyui));
    const extraModelPathsFile = path.join(basePath, 'extra_model_paths.yaml');

    if (!fs.existsSync(extraModelPathsFile)) {
        console.log(CAT, 'readExtraModelPaths: extra_model_paths.yaml not found at', extraModelPathsFile);
        return false;
    }

    console.log(CAT, 'readExtraModelPaths: reading from', extraModelPathsFile);

    try {
        const raw = fs.readFileSync(extraModelPathsFile, 'utf8');        
        EXTRA_MODELS.yamlContent = yaml.load(raw);
    } catch (err) {
        console.log(CAT, 'readExtraModelPaths: failed to read/parse yaml', err);
        return false;
    }

    if (!EXTRA_MODELS.yamlContent?.a111?.base_path) {
        return false;
    }

    const a111Base = EXTRA_MODELS.yamlContent.a111.base_path;
    if (!fs.existsSync(a111Base)) {
        console.log(CAT, 'readExtraModelPaths: a111 base_path does not exist:', a111Base);
        return false;
    }

    //function readDirectory(directory='', basePath = '', search_subfolder = false, maxDepth = Infinity, currentDepth = 0, extName = '.safetensors')
    function collectFromRelativeList(relList, targetArray, ext) {
        for (const rel of relList) {
            const absPath = path.isAbsolute(rel) ? rel : path.join(a111Base, rel);
            if (fs.existsSync(absPath) && fs.statSync(absPath).isDirectory()) {
                try {
                    const items = readDirectory(absPath, '', true, false, Infinity, ext);
                    if (items?.length) {
                        targetArray.push(...items);
                    }
                } catch (e) {
                    console.log(CAT, 'readExtraModelPaths: readDirectory failed for', absPath, e);
                }
            }
        }
    }

    // checkpoints
    collectFromRelativeList(collectRelativePaths('checkpoints'), EXTRA_MODELS.checkpoints, '.safetensors');
    // loras
    collectFromRelativeList(collectRelativePaths('loras'), EXTRA_MODELS.loras, '.safetensors');
    // controlnet
    collectFromRelativeList(collectRelativePaths('controlnet'), EXTRA_MODELS.controlnet, '.safetensors');
    // upscale_models
    collectFromRelativeList(collectRelativePaths('upscale_models'), EXTRA_MODELS.upscale, '.pth');

    EXTRA_MODELS.checkpoints = Array.from(new Set(EXTRA_MODELS.checkpoints));
    EXTRA_MODELS.loras = Array.from(new Set(EXTRA_MODELS.loras));
    EXTRA_MODELS.controlnet = Array.from(new Set(EXTRA_MODELS.controlnet));
    EXTRA_MODELS.upscale = Array.from(new Set(EXTRA_MODELS.upscale));

    console.log(CAT, 'readExtraModelPaths: found extra models:', {
        checkpoints: EXTRA_MODELS.checkpoints.length,
        loras: EXTRA_MODELS.loras.length,
        controlnet: EXTRA_MODELS.controlnet.length,
        upscale: EXTRA_MODELS.upscale.length
    });

    return true;
}

function loadCustomConfig() {    
    const configPath = path.join(appPath, 'data', 'custom_path.yaml');
    let targetPath = fs.existsSync(configPath) ? configPath : null;

    if (targetPath) {
        try {
            const raw = fs.readFileSync(targetPath, 'utf8');
            const parsed = yaml.load(raw);
            if (parsed?.use_custom_path === true) {
                CUSTOM_CONFIG.data = parsed;
                CUSTOM_CONFIG.active = true;
                console.log(CAT, 'Custom path config loaded and active:', targetPath);
                return;
            }
            console.log(CAT, 'Custom path config found but use_custom_path is not true:', targetPath);
        } catch (e) {
            console.warn(CAT, 'Error loading custom_path.yaml:', e);
        }
    }
    CUSTOM_CONFIG.active = false;
    CUSTOM_CONFIG.data = null;
}

// eslint-disable-next-line sonarjs/cognitive-complexity
function resolveCustomPaths(appKeys, modelKey) {
    if (!CUSTOM_CONFIG.active || !CUSTOM_CONFIG.data) return [];

    let finalPaths = [];

    for (const appKey of appKeys) {
        const section = CUSTOM_CONFIG.data[appKey];
        if (!section) continue;

        const enabled = section['enable'];
        if (!enabled) {
            continue;
        }

        const basePath = section.base_path;
        if(fs.existsSync(basePath) === false) {
            console.warn(CAT, `Base path does not exist for ${appKey} - ${modelKey}:`, basePath);
            continue;
        }

        const rawValue = section[modelKey];
        if (!rawValue) {
            console.log(CAT, `No paths specified for ${appKey} - ${modelKey}, use default.`);
            continue;
        }

        let rawPaths = [];
        if (Array.isArray(rawValue)) {
            rawPaths = rawValue;
        } else if (typeof rawValue === 'string') {
            rawPaths = rawValue.split(/[\r\n]+/).map(s => s.trim()).filter(s => s.length > 0);
        }

        for (const p of rawPaths) {
            let absPath;
            if (path.isAbsolute(p)) {
                absPath = p;
            } else if (basePath) {
                absPath = path.join(basePath, p);
            } else {
                continue;
            }

            if (fs.existsSync(absPath)) {
                finalPaths.push(absPath);
            }
        }
    }

    return Array.from(new Set(finalPaths));
}

function scanMultipleDirectories(paths, search_subfolder, extName, replaceSlash = false) {
    let allFiles = [];
    for (const dir of paths) {
        // readDirectory(directory, basePath, search_subfolder, maxDepth, currentDepth, extName, replaceSlash)
        // basePath send '', all returned paths are relative to that directory (e.g., "SDXL/my_lora.safetensors")
        const files = readDirectory(dir, '', search_subfolder, Infinity, 0, extName, replaceSlash);
        allFiles = [...allFiles, ...files];
    }
    return Array.from(new Set(allFiles));
}

function setupModelList(settings) {
    ipcMain.handle('update-model-list', (event, args) => {                
        updateModelAndLoRAList(args);
    });

    ipcMain.handle('get-model-list', async (event, args) => {
        return getModelList(args);
    });

    ipcMain.handle('get-model-list-all', async (event, args) => {
        return getModelListAll(args);
    });

    ipcMain.handle('get-vae-list', async (event, args) => {
        return getVAEList(args);
    });

    ipcMain.handle('get-diffusion-model-list', async (event, args) => {
        return getDiffusionModelList(args);
    });

    ipcMain.handle('get-text-encoder-list', async (event, args) => {
        return getTextEncoderList(args);
    });

    ipcMain.handle('get-lora-list-all', async (event, args) => {
        return getLoRAList(args);
    });

    ipcMain.handle('get-controlnet-list', async (event, args) => {
        return getControlNetList(args);
    });

    ipcMain.handle('get-upscaler-list', async (event, args) => {
        return getUpscalerList(args);
    });    

    ipcMain.handle("get-image-tagger-models", async (event) => {
        return getImageTaggerModels();
    });

    ipcMain.handle("get-adetailer-list", async (event, args) => {
        return getADetailerList(args);
    });

    ipcMain.handle("get-onnx-list", async (event, args) => {
        return getONNXList(args);
    });

    loadCustomConfig();
    EXTRA_MODELS.exist = readExtraModelPaths(settings.model_path_comfyui);

    updateModelList(
        settings.model_path_comfyui,
        settings.model_path_webui,
        settings.model_filter_keyword,
        settings.model_filter,
        settings.search_modelinsubfolder
    );

    updateVAEList(
        settings.model_path_comfyui,
        settings.model_path_webui,
        settings.search_modelinsubfolder
    );

    updateDiffusionModelList(
        settings.model_path_comfyui,
        settings.search_modelinsubfolder
    );

    updateTextEncoderList(
        settings.model_path_comfyui,
        settings.search_modelinsubfolder
    );

    updateLoRAList(
        settings.model_path_comfyui,
        settings.model_path_webui,
        settings.search_modelinsubfolder
    );

    updateControlNetList(
        settings.model_path_comfyui,
        settings.model_path_webui,
        settings.search_modelinsubfolder
    );

    updateUpscalerList(
        settings.model_path_comfyui,
        settings.model_path_webui,
        settings.search_modelinsubfolder
    );

    updateADetailerList(
        settings.model_path_comfyui,
        settings.model_path_webui,
        settings.search_modelinsubfolder
    );

    updateONNXList(
        settings.model_path_comfyui,
        true
    );

    updateImageTaggerList();
}

function getImageTaggerModels() {
    return IMAGE_TAGGER;
}

function getModelList(apiInterface) {
    if (apiInterface === 'ComfyUI') {
        return MODELLIST_COMFYUI;
    } else if (apiInterface === 'WebUI') {
        return MODELLIST_WEBUI;
    } else {
        return ['None'];
    }
}

function getModelListAll(apiInterface) {
    if (apiInterface === 'ComfyUI') {
        return MODELLIST_ALL_COMFYUI;
    } else if (apiInterface === 'WebUI') {
        return MODELLIST_ALL_WEBUI;
    } else {
        return ['None'];
    }
}

function getVAEList(apiInterface) {
    if (apiInterface === 'ComfyUI') {
        return VAE_COMFYUI;
    } else if (apiInterface === 'WebUI') {
        return VAE_WEBUI;
    } else {
        return ['None'];
    }   
}

function getDiffusionModelList(apiInterface) {
    if (apiInterface === 'ComfyUI') {
        return DIFFUSION_MODELS_COMFYUI;
    } else {
        return ['None'];
    }
}

function getTextEncoderList(apiInterface) {
    if (apiInterface === 'ComfyUI') {
        return TEXT_ENCODERS_COMFYUI;
    } else {
        return ['None'];
    }
}

function getLoRAList(apiInterface) {
    if (apiInterface === 'ComfyUI') {
        return LORALIST_COMFYUI;
    } else if (apiInterface === 'WebUI') {
        return LORALIST_WEBUI;
    } else {
        return ['None'];
    }
}

function getControlNetList(apiInterface) {
    if (apiInterface === 'ComfyUI') {
        return CONTROLNET_COMFYUI;
    } else if (apiInterface === 'WebUI') {
        return CONTROLNET_WEBUI;
    } else {
        return ['None'];
    }
}

function getUpscalerList(apiInterface) {
    if (apiInterface === 'ComfyUI') {
        return UPSCALER_COMFYUI;
    } else if (apiInterface === 'WebUI') {
        return UPSCALER_WEBUI;
    } else {
        return ['None'];
    }    
}

function getADetailerList(apiInterface) {
    if (apiInterface === 'ComfyUI') {
        return ADETAILER_COMFYUI;
    } else if (apiInterface === 'WebUI') {
        return ADETAILER_WEBUI;
    } else {
        return ['None'];
    }    
}

function getONNXList(apiInterface) {
    if (apiInterface === 'ComfyUI') {
        return ONNX_COMFYUI;
    } else {
        return ['None'];
    }    
}

function updateModelAndLoRAList(args) {
    // reload custom paths
    loadCustomConfig();

    // model_path, model_path_2nd, model_filter, enable_filter, search_subfolder
    console.log(CAT, 'Update model/lora list with following args: ', args);

    EXTRA_MODELS.exist = readExtraModelPaths(args[0]);

    updateModelList(args[0], args[1], args[2], args[3], args[4]);
    updateVAEList(args[0], args[1], args[4]);
    updateDiffusionModelList(args[0], args[4]);
    updateTextEncoderList(args[0], args[4]);

    updateLoRAList(args[0], args[1], args[4]);
    updateControlNetList(args[0], args[1], args[4]);
    updateUpscalerList(args[0], args[1], args[4]);
    updateADetailerList(args[0], args[1], args[4]);
    updateONNXList(args[0], true);
    updateImageTaggerList();

    // This is the Skeleton Key to unlock the Mutex Lock
    // In case ...
    console.warn(CAT, 'The Skeleton Key triggerd, Mutex Lock set to false');
    setMutexBackendBusy(false);
}


function getExtraModels() {
    return EXTRA_MODELS;
}

export {
    setupModelList,
    getModelList,
    getModelListAll,
    getVAEList,
    getDiffusionModelList,
    getTextEncoderList,
    getLoRAList,
    getControlNetList,
    getUpscalerList,
    getADetailerList,
    getONNXList,
    getImageTaggerModels,
    updateModelAndLoRAList,
    collectRelativePaths,
    getExtraModels
};
