import { setBlur, setNormal, showDialog } from './myDialog.js';
import { sendWebSocketMessage } from '../../../webserver/front/wsRequest.js';
import { setADetailerModelList } from '../slots/myADetailerSlot.js';

const CAT = '[myCollapsed]'

export function setupCollapsed(containerId, collapsed = false) {
    const mainItem = document.querySelector(`.${containerId}-main`);
    if (!mainItem) {
        console.error(CAT, 'mainItem not found', `.${containerId}-main`);
        return null;
    }

    const container = document.querySelector(`.${containerId}-container`);
    if (!container) {
        console.error(CAT, 'Container not found', `.${containerId}-container`);
        return null;
    }

    const arrowId = `${containerId}-toggle`;
    const toggleArrow = document.getElementById(arrowId);
    if (!toggleArrow) {
        console.error(CAT, 'Element not found', arrowId);
        return null;
    }
    
    toggleArrow.addEventListener('click', () => {
        setCollapsed(!container.classList.contains('collapsed'));
    });

    setCollapsed(collapsed);

    function setCollapsed(isCollapsed) {
        if (isCollapsed) {
            mainItem.classList.add('collapsed');
            container.classList.add('collapsed');
            toggleArrow.classList.add('collapsed');
        } else {
            mainItem.classList.remove('collapsed');
            container.classList.remove('collapsed');
            toggleArrow.classList.remove('collapsed');
        }
    }

    return {
        setCollapsed
    };
}

export async function setupSaveSettingsToggle(){
    const saveSettingsButton = document.getElementById('settings-save-toggle');
    if (!saveSettingsButton) {
        console.error(CAT, '[setupSaveSettingsToggle] Save button not found');
        return null;
    }  

    saveSettingsButton.addEventListener('click', async () => {
        setBlur();
        const inputResult = await showDialog('input', { 
            message: globalThis.cachedFiles.language[globalThis.globalSettings.language].save_settings_title, 
            placeholder: 'tmp_settings', 
            defaultValue: globalThis.globalSettings.lastLoadedSettings
        });
        if(inputResult){
            globalThis.globalSettings.lora_slot = globalThis.lora.getValues();

            const tag_angle = globalThis.viewList.getTextValue(0);
            const tag_camera = globalThis.viewList.getTextValue(1);
            const tag_background =  globalThis.viewList.getTextValue(2);
            const tag_style = globalThis.viewList.getTextValue(3);
            const c1 = globalThis.characterList.getTextValue(0);
            const c2 = globalThis.characterList.getTextValue(1);
            const c3 = globalThis.characterList.getTextValue(2);
            const r1 = globalThis.characterListRegional.getTextValue(0);
            const r2 = globalThis.characterListRegional.getTextValue(1);

            const globalSettings = structuredClone(globalThis.globalSettings);
            delete globalSettings["lastLoadedSettings"];

            globalSettings["weights4dropdownlist"] = [ 
                tag_angle, tag_camera, tag_background, tag_style, // 0, 1, 2, 3
                c1, c2, c3, // 4, 5, 6
                r1, r2      // 7, 8
            ];

            let result;
            if (globalThis.inBrowser) {
                result = await sendWebSocketMessage({ type: 'API', method: 'saveSettingFile', params: [`${inputResult}.json`, globalSettings] });
            } else {
                result = await globalThis.api.saveSettingFile(`${inputResult}.json`, globalSettings);
            }

            if(result === true) {
                await showDialog('info', { message: globalThis.cachedFiles.language[globalThis.globalSettings.language].save_settings_success.replace('{0}', inputResult) });
                if (globalThis.inBrowser) {
                    globalThis.cachedFiles.settingList = await sendWebSocketMessage({ type: 'API', method: 'updateSettingFiles' });
                } else {
                    globalThis.cachedFiles.settingList = await globalThis.api.updateSettingFiles();
                }
                globalThis.dropdownList.settings.setOptions(globalThis.cachedFiles.settingList);
                globalThis.dropdownList.settings.updateDefaults(`${inputResult}.json`);
            } else {
                await showDialog('info', { message: globalThis.cachedFiles.language[globalThis.globalSettings.language].save_settings_failed.replace('{0}', inputResult) });
            }
        }
        setNormal();
    });

    return saveSettingsButton;
}

export async function setupModelReloadToggle() {
    const refreshButton = document.getElementById('model-refresh-toggle');
    if (!refreshButton) {
        console.error(CAT, '[setupModelReloadToggle] Reload button not found');
        return null;
    }

    refreshButton.addEventListener('click', async () => {
        const currentModelSelect = globalThis.dropdownList.model.getValue();
        await reloadFiles();
        globalThis.dropdownList.model.updateDefaults(currentModelSelect);
        globalThis.lora.reload();
        globalThis.controlnet.reload();
        globalThis.aDetailer.reload();
    });

    return refreshButton;
}

export async function reloadFiles(){
    const SETTINGS = globalThis.globalSettings;
    const LANG = globalThis.cachedFiles.language[SETTINGS.language];
    const args = [globalThis.globalSettings.model_path_comfyui,
                globalThis.globalSettings.model_path_webui,
                globalThis.globalSettings.model_filter_keyword,
                globalThis.globalSettings.model_filter,
                globalThis.globalSettings.search_modelinsubfolder];

    if (globalThis.inBrowser) {
        await sendWebSocketMessage({ type: 'API', method: 'updateModelList', params: [args] });
        await sendWebSocketMessage({ type: 'API', method: 'updateWildcards'});
        await sendWebSocketMessage({ type: 'API', method: 'tagReload'});

        globalThis.cachedFiles.modelList = await sendWebSocketMessage({ type: 'API', method: 'getModelList', params: [SETTINGS.api_interface] });
        globalThis.cachedFiles.modelListAll = await sendWebSocketMessage({ type: 'API', method: 'getModelListAll', params: [SETTINGS.api_interface] });
        globalThis.cachedFiles.vaeList = await sendWebSocketMessage({ type: 'API', method: 'getVAEList', params: [SETTINGS.api_interface] });
        globalThis.cachedFiles.diffusionList = await sendWebSocketMessage({ type: 'API', method: 'getDiffusionModelList', params: [SETTINGS.api_interface] });
        globalThis.cachedFiles.textEncoderList = await sendWebSocketMessage({ type: 'API', method: 'getTextEncoderList', params: [SETTINGS.api_interface] });
        globalThis.cachedFiles.loraList = await sendWebSocketMessage({ type: 'API', method: 'getLoRAList', params: [SETTINGS.api_interface] });
        globalThis.cachedFiles.controlnetList = await sendWebSocketMessage({ type: 'API', method: 'getControlNetList', params: [SETTINGS.api_interface] });
        globalThis.cachedFiles.upscalerList = await sendWebSocketMessage({ type: 'API', method: 'getUpscalerList', params: [SETTINGS.api_interface] });
        globalThis.cachedFiles.aDetailerList = await sendWebSocketMessage({ type: 'API', method: 'getADetailerList', params: [SETTINGS.api_interface] });
        globalThis.cachedFiles.settingList = await sendWebSocketMessage({ type: 'API', method: 'updateSettingFiles' });
        globalThis.cachedFiles.imageTaggerModels = await sendWebSocketMessage({ type: 'API', method: 'getImageTaggerModels' });
        if (SETTINGS.api_interface === 'WebUI')
            await sendWebSocketMessage({ type: 'API', method: 'resetModelListsWebUI'});
    } else {
        await globalThis.api.updateModelList(args);
        await globalThis.api.updateWildcards();
        await globalThis.api.tagReload();

        globalThis.cachedFiles.modelList = await globalThis.api.getModelList(SETTINGS.api_interface);
        globalThis.cachedFiles.modelListAll = await globalThis.api.getModelListAll(SETTINGS.api_interface);
        globalThis.cachedFiles.vaeList = await globalThis.api.getVAEList(SETTINGS.api_interface);
        globalThis.cachedFiles.diffusionList = await globalThis.api.getDiffusionModelList(SETTINGS.api_interface);
        globalThis.cachedFiles.textEncoderList = await globalThis.api.getTextEncoderList(SETTINGS.api_interface);
        globalThis.cachedFiles.loraList = await globalThis.api.getLoRAList(SETTINGS.api_interface);
        globalThis.cachedFiles.controlnetList = await globalThis.api.getControlNetList(SETTINGS.api_interface);
        globalThis.cachedFiles.upscalerList = await globalThis.api.getUpscalerList(SETTINGS.api_interface);
        globalThis.cachedFiles.aDetailerList = await globalThis.api.getADetailerList(SETTINGS.api_interface);
        globalThis.cachedFiles.settingList = await globalThis.api.updateSettingFiles();
        globalThis.cachedFiles.imageTaggerModels = await globalThis.api.getImageTaggerModels();
        if (SETTINGS.api_interface === 'WebUI') {
            await globalThis.api.resetModelListsWebUI();
        }
    }
        
    if (SETTINGS.api_interface === 'WebUI') {
        // reset few list for A1111
        globalThis.cachedFiles.controlnetProcessorListWebUI = 'none';
        globalThis.cachedFiles.upscalerListWebUI = 'none';
        setADetailerModelList(globalThis.cachedFiles.aDetailerList, true);
    } else {
        setADetailerModelList(globalThis.cachedFiles.aDetailerList);
    }

    if (globalThis.globalSettings.api_model_type === 'Checkpoint') {
        globalThis.dropdownList.model.setValue(LANG.api_model_file_select, globalThis.cachedFiles.modelList);
        globalThis.dropdownList.model.updateDefaults(SETTINGS.api_model_file_select);
    } else {
        globalThis.dropdownList.model.setValue(LANG.api_model_file_select, globalThis.cachedFiles.diffusionList);
        globalThis.dropdownList.model.updateDefaults(SETTINGS.api_model_file_diffusion_select);
    }
    globalThis.dropdownList.vae_unet.setValue(LANG.api_difussion_vae_model, globalThis.cachedFiles.vaeList);
    globalThis.dropdownList.vae_sdxl.setValue(LANG.api_ckpt_vae_model, globalThis.cachedFiles.vaeList);
    globalThis.dropdownList.textencoder.setValue(LANG.api_text_encoder, globalThis.cachedFiles.textEncoderList);

    globalThis.dropdownList.settings.setValue('', globalThis.cachedFiles.settingList);
    globalThis.refiner.model.setValue(LANG.api_refiner_model, globalThis.cachedFiles.modelListAll);    
}

export function setupRefreshToggle() {
    const refreshButton = document.getElementById('global-refresh-toggle');
    if (!refreshButton) {
        console.error(CAT, '[setupRefreshToggle] Refresh button not found');
        return null;
    }

    refreshButton.addEventListener('click', () => {
        location.reload(); 
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'F5') {
            event.preventDefault(); 
            location.reload(); 
        }
    });

    return refreshButton;
}

export function doSwap(rightToLeft) {
    const left = document.getElementById('left');
    const right = document.getElementById('right');

    if (rightToLeft) {
        right.before(left);
        left.style.marginLeft = '10px';
        left.style.marginRight = '5px';
        right.style.marginLeft = '5px';
        right.style.marginRight = '10px';
    } else {
        left.before(right);
        left.style.marginLeft = '5px';
        left.style.marginRight = '10px';
        right.style.marginLeft = '10px';
        right.style.marginRight = '5px';
    }
}

export function setupSwapToggle(){
    const swapButton = document.getElementById('global-settings-swap-layout-toggle');
    if (!swapButton) {
        console.error(CAT, '[setupSwapToggle] Swap button not found');
        return null;
    }
    
    swapButton.addEventListener('click', () => {
        globalThis.globalSettings.rightToleft = !globalThis.globalSettings.rightToleft;
        doSwap(globalThis.globalSettings.rightToleft);
    });    

    return swapButton;
}

