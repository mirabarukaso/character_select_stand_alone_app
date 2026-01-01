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

let EXTRA_MODELS = {
    exist: false,
    yamlContent: null,
    checkpoints: [],
    loras: [],
    controlnet: [],
    upscale: []
};
let IMAGE_TAGGER = ['none'];

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
    const adPatchComfyUIBbox = path.join(path.dirname(model_path_comfyui), 'ultralytics', 'bbox');
    const adPatchComfyUISams = path.join(path.dirname(model_path_comfyui), 'sams');
    const adPatchWebUI = path.join(path.dirname(model_path_webui), 'adetailer');

    if (fs.existsSync(adPatchComfyUIBbox) && fs.existsSync(adPatchComfyUISams) ) {
         const bbox = readDirectory(adPatchComfyUIBbox, '', search_subfolder, Infinity, 0, '.pt');
         const sams  = readDirectory(adPatchComfyUISams, '', search_subfolder, Infinity, 0, '.pth');
         ADETAILER_COMFYUI = [...bbox, ...sams];
    } else {
        ADETAILER_COMFYUI = [];
    }

    if (fs.existsSync(adPatchWebUI)) {
        ADETAILER_WEBUI = readDirectory(adPatchWebUI, '', search_subfolder, Infinity, 0, '.pt');
    } else {
        ADETAILER_WEBUI = [];
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

function updateUpscalerList(model_path_comfyui, model_path_webui, search_subfolder) {
    const LATENT_UPSCALERS = [
        'Latent (nearest-exact)', 
        'Latent (bilinear)',
        'Latent (area)',
        'Latent (bicubic)',
        'Latent (bislerp)'
    ];
    const upPathComfyUI = path.join(path.dirname(model_path_comfyui), 'upscale_models');
    const upPathWebUI = path.join(path.dirname(model_path_webui), 'upscale_models');

    if (fs.existsSync(upPathComfyUI)) {
        const pthList = readDirectory(upPathComfyUI, '', search_subfolder, Infinity, 0, '.pth');
        const safetensorsList = readDirectory(upPathComfyUI, '', search_subfolder, Infinity, 0, '.safetensors');
        UPSCALER_COMFYUI = [...pthList, ...safetensorsList];
    } else {
        UPSCALER_COMFYUI = [];
    }

    if (EXTRA_MODELS.exist && Array.isArray(EXTRA_MODELS.upscale) && EXTRA_MODELS.upscale.length > 0) {
        const baseList = Array.isArray(UPSCALER_COMFYUI) ? UPSCALER_COMFYUI : [];
        UPSCALER_COMFYUI = Array.from(new Set([...baseList, ...EXTRA_MODELS.upscale]));
    }

    if (fs.existsSync(upPathWebUI)) {
        const pthList = readDirectory(upPathWebUI, '', search_subfolder, Infinity, 0, '.pth');
        const safetensorsList = readDirectory(upPathWebUI, '', search_subfolder, Infinity, 0, '.safetensors');
        UPSCALER_WEBUI =  [...pthList, ...safetensorsList];
    } else {
        UPSCALER_WEBUI = [];
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
    const cnPathComfyUI = path.join(path.dirname(model_path_comfyui), 'controlnet');
    const clipVisionPathComfyUI = path.join(path.dirname(model_path_comfyui), 'clip_vision');
    const ipadapterPathComfyUI = path.join(path.dirname(model_path_comfyui), 'ipadapter');
    const cnPathWebUI_A1111 = path.join(path.dirname(model_path_webui), '..', 'extensions', 'sd-webui-controlnet', 'models');
    const cnPathWebUI_Forge = path.join(path.dirname(model_path_webui), 'ControlNet');

    if (fs.existsSync(cnPathComfyUI)) {
        CONTROLNET_COMFYUI = readDirectory(cnPathComfyUI, '', search_subfolder);
        if(fs.existsSync(clipVisionPathComfyUI) && fs.existsSync(ipadapterPathComfyUI)) {
            let clipList = readDirectory(clipVisionPathComfyUI, '', search_subfolder);
            let ipaList = readDirectory(ipadapterPathComfyUI, '', search_subfolder);

            let clipVisionListWithPrefix = [];
            for (const item of clipList) {
                clipVisionListWithPrefix.push('CV->' + item);
            }

            let ipaListWithPrefix = [];
            for (const item of ipaList ) {
                ipaListWithPrefix.push('IPA->' + item);
            }

            CONTROLNET_COMFYUI = CONTROLNET_COMFYUI.concat(clipVisionListWithPrefix, ipaListWithPrefix);

            if (EXTRA_MODELS.exist && Array.isArray(EXTRA_MODELS.controlnet) && EXTRA_MODELS.controlnet.length > 0) {
                const baseList = Array.isArray(CONTROLNET_COMFYUI) ? CONTROLNET_COMFYUI : [];
                CONTROLNET_COMFYUI = Array.from(new Set([...baseList, ...EXTRA_MODELS.controlnet]));
            }
        }
    } else {
        CONTROLNET_COMFYUI = [];
    }
    
    if (fs.existsSync(cnPathWebUI_A1111)) {
        CONTROLNET_WEBUI = readDirectory(cnPathWebUI_A1111, '', search_subfolder);
    } else if (fs.existsSync(cnPathWebUI_Forge)) {
        CONTROLNET_WEBUI = readDirectory(cnPathWebUI_Forge, '', search_subfolder);
    } else {
        CONTROLNET_WEBUI = [];
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
    const loraPathComfyUI = path.join(path.dirname(model_path_comfyui), 'loras');
    const loraPathWebUI = path.join(path.dirname(model_path_webui), 'Lora');

    if (fs.existsSync(loraPathComfyUI)) {
        LORALIST_COMFYUI = readDirectory(loraPathComfyUI, '', search_subfolder);

        if (EXTRA_MODELS.exist && Array.isArray(EXTRA_MODELS.loras) && EXTRA_MODELS.loras.length > 0) {
            const baseList = Array.isArray(LORALIST_COMFYUI) ? LORALIST_COMFYUI : [];
            LORALIST_COMFYUI = Array.from(new Set([...baseList, ...EXTRA_MODELS.loras]));
        }
    } else {
        LORALIST_COMFYUI = [];
    }
    
    if (fs.existsSync(loraPathWebUI)) {
        LORALIST_WEBUI = readDirectory(loraPathWebUI, '', search_subfolder);
    } else {
        LORALIST_WEBUI = [];
    }

}

// eslint-disable-next-line sonarjs/cognitive-complexity
function updateModelList(model_path_comfyui, model_path_webui, model_filter, enable_filter, search_subfolder) {
    if (fs.existsSync(model_path_comfyui)) {
        MODELLIST_ALL_COMFYUI = readDirectory(model_path_comfyui, '', search_subfolder);

        if (EXTRA_MODELS.exist && Array.isArray(EXTRA_MODELS.checkpoints) && EXTRA_MODELS.checkpoints.length > 0) {
            const baseList = Array.isArray(MODELLIST_ALL_COMFYUI) ? MODELLIST_ALL_COMFYUI : [];
            MODELLIST_ALL_COMFYUI = Array.from(new Set([...baseList, ...EXTRA_MODELS.checkpoints]));
        }
    } else {
        MODELLIST_ALL_COMFYUI = [];
    }
    
    if (fs.existsSync(model_path_webui)) {
        MODELLIST_ALL_WEBUI = readDirectory(model_path_webui, '', search_subfolder);
    } else {
        MODELLIST_ALL_WEBUI = [];
    }

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

    if (MODELLIST_COMFYUI.length > 0) {        
        MODELLIST_COMFYUI.unshift('Default');
    } else {
        MODELLIST_COMFYUI = ['Default'];
    }

    if (MODELLIST_WEBUI.length > 0) {
        MODELLIST_WEBUI.unshift('Default');
    } else {
        MODELLIST_WEBUI = ['Default'];
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

    EXTRA_MODELS.exist = readExtraModelPaths(settings.model_path_comfyui);

    updateModelList(
        settings.model_path_comfyui,
        settings.model_path_webui,
        settings.model_filter_keyword,
        settings.model_filter,
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
    // model_path, model_path_2nd, model_filter, enable_filter, search_subfolder
    console.log(CAT, 'Update model/lora list with following args: ', args);

    EXTRA_MODELS.exist = readExtraModelPaths(args[0]);

    updateModelList(args[0], args[1], args[2], args[3], args[4]);
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
