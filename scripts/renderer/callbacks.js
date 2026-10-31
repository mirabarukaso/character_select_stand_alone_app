import { decodeThumb } from './customThumbGallery.js';
import { generateImage, startQueue, clearHiresSubmitHash } from './generate.js';
import { generateRegionalImage } from './generate_regional.js';
import { generateMiraITU } from './generate_miraITU.js';
import { doSwap, reloadFiles } from './components/myCollapsed.js';
import { updateLanguage, updateSettings, setDropdownLanguage, syncSkipDoubleLayerInput } from './language.js';
import { setBlur, setNormal, showDialog } from './components/myDialog.js';
import { applyTheme } from './theme.js';
import { sendWebSocketMessage, isSaacReadonlyClient } from '../webserver/front/wsRequest.js';
import { myCharacterList, myRegionalCharacterList } from './components/myDropdown.js';
import { flushSlots } from './slots/slotsManager.js';
import { compareAndMergeFavoriteLists } from './components/favoriteCharacters.js';
import { changeFontSize } from './components/myTextbox.js';
import { set_prompt_textBox_Heights } from './components/componentsManager.js';
import { applySavedLayout } from './uiLayout.js';
import { refreshPromptViewToggles, refreshTabLabelHints } from './uiLayoutTabs.js';
import { DIFFUSION_DTYPE, FORGE_UNET_STORAGE_AUTOMATIC, SAMPLER_COMFYUI, SAMPLER_WEBUI, SCHEDULER_COMFYUI, SCHEDULER_WEBUI } from '../types.js';
import { FORGE_FP16_PLUGIN_URL, isFp16CastDtype, visibleDiffusionDtype, visibleForgeStorageDtype } from '../main/sageFp16Switch.js';
import { cancelAutoRetry, isAutoRetryRunning } from './tools/autoRetry.js';

export async function callback_mySettingList(index, selectedValue) {    
    if(!globalThis.initialized)
        return;

    const lastFavList = globalThis.globalSettings.fav_characters;
    const lastLoadedSettings = globalThis.globalSettings.lastLoadedSettings;

    const lastThumbSelect = globalThis.globalSettings.thumb_select;
    const lastApiInterface = globalThis.globalSettings.api_interface;
    const inheritedAi = globalThis.aiPrompt?.takeInheritSnapshot?.() || null;
    const value = selectedValue[0];
    console.log('Loading settings file:', value);
    const old_css = globalThis.globalSettings.css_style;
    setBlur();
    globalThis.initialized = false;
    let globalSettings;
    if (globalThis.inBrowser) {
        globalSettings = await sendWebSocketMessage({ type: 'API', method: 'loadSettingFile', params: [value] });
    } else {
        globalSettings = await globalThis.api.loadSettingFile(value);
    }    
    globalThis.globalSettings = structuredClone(globalSettings);
    if (inheritedAi) globalThis.aiPrompt?.applyInheritSnapshot?.(inheritedAi);

    doSwap(globalThis.globalSettings.rightToleft);    
    await reloadFiles()    

    // update thumbnail selection if it has changed
    if(lastThumbSelect !== globalThis.globalSettings.thumb_select){
        await update_thumb_select(globalThis.globalSettings.thumb_select);
    }
    
    if(old_css !== globalThis.globalSettings.css_style)
        applyTheme(globalThis.globalSettings.css_style);

    const new_settings_name = value.slice(0, -5);
    // check favorite list
    const new_fav = compareAndMergeFavoriteLists(lastFavList, globalThis.globalSettings.fav_characters);
    if(new_fav) {
        const SETTINGS = globalThis.globalSettings;
        const FILES = globalThis.cachedFiles;
        const LANG = FILES.language[SETTINGS.language];

        const favlist_mismach = LANG.favlist_mismach
                                    .replace('{0}', lastLoadedSettings)
                                    .replace('{1}', lastFavList.length)
                                    .replace('{2}', new_settings_name)
                                    .replace('{3}', globalThis.globalSettings.fav_characters.length);

        const merge = LANG.favlist_title_merge
                        .replace('{0}', lastLoadedSettings)
                        .replace('{1}', new_settings_name)
                        .replace('{2}', new_fav.length);        
        const overwrite = LANG.favlist_title_overwrite.replace('{0}', lastLoadedSettings);
        const replace = LANG.favlist_title_replace.replace('{0}', new_settings_name);

        const combine_itemsTitle = `${replace},${overwrite},${merge}`;
        const combine_items = `${LANG.favlist_replace},${LANG.favlist_overwrite},${LANG.favlist_merge}`;

        // Ask user what's next
        const result = await showDialog('radio', { 
            message: favlist_mismach,
            items: combine_items,
            itemsTitle: combine_itemsTitle,
            buttonText: LANG.setup_ok
        });

        console.log(result);
        if (result === 2)   // merge
            globalThis.globalSettings.fav_characters = new_fav;
        else if(result === 1) // overwrite
            globalThis.globalSettings.fav_characters = lastFavList;            
        // replace  0
    }    

    // The interface has changed!
    if(globalThis.globalSettings.api_interface !== lastApiInterface) {
        console.log("Reload UI and update cache due to interface changed.");
        await callback_api_interface(0, [globalThis.globalSettings.api_interface]);
    }

    updateLanguage(true, globalThis.inBrowser);
    if (!globalThis.inBrowser && globalThis.api?.getWsServiceStatus) {
        try {
            globalThis.wsServiceRuntime = await globalThis.api.getWsServiceStatus();
        } catch (error) {
            console.warn('Failed to refresh SAAC runtime status after loading settings:', error);
        }
    }
    updateSettings();

    // reLoad slots stuff: LoRA, aDetailer
    flushSlots();    

    callback_ptompt_textbox_fontsize(globalThis.globalSettings.ptompt_textbox_fontsize);
    callback_ptompt_textbox_autoresize(globalThis.globalSettings.ptompt_textbox_autoresize);    

    // Done
    globalThis.initialized = true;
    setNormal();

    globalThis.dropdownList.settings.updateDefaults(value);
    globalThis.globalSettings.lastLoadedSettings = new_settings_name;
    await applySavedLayout();
}

export async function callback_api_model_select(index, selectedValue) {
    const value = selectedValue[0];    

    const SETTINGS = globalThis.globalSettings;
    if (SETTINGS.api_model_type === 'Checkpoint') {
        globalThis.globalSettings.api_model_file_select = value;
    } else {
        globalThis.globalSettings.api_model_file_diffusion_select = value;
    }
}

export function callback_forge_fp16_switch(which, value) {
    const settings = globalThis.globalSettings;
    if (!settings) return;
    const on = value === true;
    if (which === 'sage') settings.api_forge_sage_fp16_cast = on;
    else settings.api_forge_compute_fp16 = on;

    if (settings.api_forge_compute_fp16 || settings.api_forge_sage_fp16_cast) {
        settings.api_forge_unet_storage_dtype = FORGE_UNET_STORAGE_AUTOMATIC;
        if (settings.api_interface === 'WebUI') {
            globalThis.dropdownList?.diffusion_model_weight_dtype?.updateDefaults(FORGE_UNET_STORAGE_AUTOMATIC);
        }
        if (on) notifySageFp16Cast(which === 'sage' ? 'Sage_FP16' : 'PyTorch_FP16');
    }
}

export function notifySageFp16Cast(value) {
    if (!isFp16CastDtype(value)) return;
    const settings = globalThis.globalSettings;
    const webui = settings?.api_interface === 'WebUI';

    const flag = webui ? 'sage_fp16_webui' : 'sage_fp16';
    if (!globalThis.custom_message || globalThis.custom_message[flag]) return;

    const lang = globalThis.cachedFiles?.language?.[settings.language];
    const applyPluginUrl = (text) => typeof text === 'string' ? text.replaceAll('{plugin}', FORGE_FP16_PLUGIN_URL) : text;
    const message = applyPluginUrl(webui ? lang?.message_sage_fp16_webui : lang?.message_sage_fp16);
    const link = applyPluginUrl(webui ? lang?.message_sage_fp16_webui_link : lang?.message_sage_fp16_link);
    if (!message || !globalThis.overlay?.custom?.createErrorOverlay) return;

    globalThis.custom_message[flag] = true;
    globalThis.overlay.custom.createErrorOverlay(message, link);
}

function syncForgeFp16Switches() {
    const host = document.querySelector('.forge-fp16-switches');
    if (host) host.hidden = false;
    const settings = globalThis.globalSettings;
    globalThis.dropdownList?.forge_compute_fp16?.setValue(settings?.api_forge_compute_fp16 === true);
    globalThis.dropdownList?.forge_sage_fp16_cast?.setValue(settings?.api_forge_sage_fp16_cast === true);
}

function syncDiffusionDtypeMenu(modelType) {
    const dropdown = globalThis.dropdownList?.diffusion_model_weight_dtype;
    if (!dropdown?.setOptions) return;

    const settings = globalThis.globalSettings;
    const lang = globalThis.cachedFiles?.language?.[settings.language];
    const webui = settings.api_interface === 'WebUI';
    syncForgeFp16Switches();

    if (webui) {
        if (settings.api_forge_compute_fp16 || settings.api_forge_sage_fp16_cast) {
            settings.api_forge_unet_storage_dtype = FORGE_UNET_STORAGE_AUTOMATIC;
        }
        const menu = visibleForgeStorageDtype(settings.api_forge_unet_storage_dtype);
        settings.api_forge_unet_storage_dtype = menu.visible;
        dropdown.setOptions(menu.choices, null, lang?.api_forge_unet_storage_dtype || 'UNet Storage', menu.visible);
        return;
    }

    const menu = visibleDiffusionDtype(settings.api_model_file_diffusion_weight_dtype, modelType, DIFFUSION_DTYPE);
    if (settings.api_model_file_diffusion_weight_dtype !== menu.saved) {
        settings.api_model_file_diffusion_weight_dtype = menu.saved;
    }
    dropdown.setOptions(menu.choices, null, lang?.api_diffusion_model_weight_dtype || 'Weight Dtype', menu.visible);
}

export async function callback_api_model_type(index, selectedValue) {
    const SETTINGS = globalThis.globalSettings;
    const LANG = globalThis.cachedFiles.language[SETTINGS.language];

    const value = selectedValue[0];
    console.log('Selected model type:', value);
    globalThis.globalSettings.api_model_type = value;
    syncDiffusionDtypeMenu(value); 

    if (value === 'Checkpoint') {
        globalThis.dropdownList.model.setValue(LANG.api_model_file_select, globalThis.cachedFiles.modelList);
        globalThis.dropdownList.model.setTitle(LANG.api_model_file_select);
        globalThis.dropdownList.model.updateDefaults(SETTINGS.api_model_file_select);

        globalThis.generate.regionalCondition.setEnable(true);
        globalThis.generate.regionalCondition_dummy.setEnable(true);

        globalThis.generate.refiner.setEnable(true);
        globalThis.generate.refiner_dummy.setEnable(true);

        globalThis.generate.controlnet.setEnable(true);

        //globalThis.generate.adetailer.setEnable(true);
    } else {
        globalThis.dropdownList.model.setValue(LANG.api_diffusion_model, globalThis.cachedFiles.diffusionList);
        globalThis.dropdownList.model.setTitle(LANG.api_diffusion_model);
        globalThis.dropdownList.model.updateDefaults(SETTINGS.api_model_file_diffusion_select);

        globalThis.generate.refiner.setValue(false);
        globalThis.generate.refiner_dummy.setValue(false);
        globalThis.generate.refiner.setEnable(false);
        globalThis.generate.refiner_dummy.setEnable(false);

        globalThis.generate.controlnet.setValue(false);
        globalThis.generate.controlnet.setEnable(false);

        //globalThis.generate.adetailer.setValue(false);
        //globalThis.generate.adetailer.setEnable(false);
    }
}

export async function callback_api_interface(index, selectedValue){
    globalThis.globalSettings.api_interface = selectedValue[0];
    syncSkipDoubleLayerInput();

    const SETTINGS = globalThis.globalSettings;
    const LANG = globalThis.cachedFiles.language[SETTINGS.language];
    globalThis.generate.sampler.setValue(LANG.api_model_sampler, (SETTINGS.api_interface==='ComfyUI')?SAMPLER_COMFYUI:SAMPLER_WEBUI);
    globalThis.generate.scheduler.setValue(LANG.api_model_scheduler, (SETTINGS.api_interface==='ComfyUI')?SCHEDULER_COMFYUI:SCHEDULER_WEBUI);    

    const modelType = globalThis.dropdownList.model_type.getValue();
    const currentModelSelect = globalThis.dropdownList.model.getValue();    
    await reloadFiles();
    globalThis.dropdownList.model.updateDefaults(currentModelSelect);

    globalThis.lora.reload();
    globalThis.controlnet.reload();
    globalThis.jsonlist.reload();
    globalThis.aDetailer.clear();

    if(SETTINGS.api_interface === 'ComfyUI') {
        globalThis.hifix.colorTransfer.setValue(LANG.api_hf_colortransfer, ['None', 'Mean', 'Lab']);
        globalThis.hifix.colorTransfer.updateDefaults(SETTINGS.api_hf_colortransfer);

        globalThis.hifix.randomSeed.setEnable(true);
        globalThis.hifix.randomSeed.setValue(SETTINGS.api_hf_random_seed);

        globalThis.refiner.addnoise.setEnable(true);
        globalThis.refiner.addnoise.setValue(SETTINGS.api_refiner_add_noise);
    } else {
        globalThis.hifix.colorTransfer.setValue(LANG.api_hf_colortransfer, ['None']);
        globalThis.hifix.colorTransfer.updateDefaults('None');

        globalThis.hifix.randomSeed.setValue(false);
        globalThis.hifix.randomSeed.setEnable(false);

        globalThis.refiner.addnoise.setValue(false);
        globalThis.refiner.addnoise.setEnable(false);

        if(modelType !== 'Checkpoint') {
            globalThis.dropdownList.model_type.updateDefaults('Checkpoint');
            await callback_api_model_type(0, ['Checkpoint']);
        }
    }

    if (globalThis.inBrowser) {
        globalThis.cachedFiles.upscalerList = await sendWebSocketMessage({ type: 'API', method: 'getUpscalerList', params: [SETTINGS.api_interface] });
    } else {
        globalThis.cachedFiles.upscalerList = await globalThis.api.getUpscalerList(SETTINGS.api_interface);
    }

    globalThis.hifix.model.setValue(LANG.api_hf_upscaler_selected, globalThis.cachedFiles.upscalerList);

    syncDiffusionDtypeMenu(globalThis.globalSettings.api_model_type);
}

export async function callback_myCharacterList_updateThumb(){
    if(globalThis.globalSettings.regional_condition) {
        const L = globalThis.characterListRegional.getKey()[0];
        const R = globalThis.characterListRegional.getKey()[1];

        const iL = await decodeThumb(L);
        const iR = await decodeThumb(R);
        const imgData = [];

        if (iR !== null) imgData.push(iR);
        if (iL !== null) imgData.push(iL);                

        globalThis.thumbGallery.update(imgData);

        globalThis.globalSettings.character_left = L;
        globalThis.globalSettings.character_right = R;
    } else {
        const c1 = globalThis.characterList.getKey()[0];
        const c2 = globalThis.characterList.getKey()[1];
        const c3 = globalThis.characterList.getKey()[2];

        const i1 = await decodeThumb(c1);
        const i2 = await decodeThumb(c2);
        const i3 = await decodeThumb(c3);
        const imgData = [];

        if (i3 !== null) imgData.push(i3);
        if (i2 !== null) imgData.push(i2);
        if (i1 !== null) imgData.push(i1);

        globalThis.thumbGallery.update(imgData);

        globalThis.globalSettings.character1 = c1;
        globalThis.globalSettings.character2 = c2;
        globalThis.globalSettings.character3 = c3;
    }
}

export function callback_myViewList_Update(){
    const v1 = globalThis.viewList.getValue()[0];
    const v2 = globalThis.viewList.getValue()[1];
    const v3 = globalThis.viewList.getValue()[2];
    const v4 = globalThis.viewList.getValue()[3];

    globalThis.globalSettings.view_angle = v1;
    globalThis.globalSettings.view_camera = v2;
    globalThis.globalSettings.view_background = v3;
    globalThis.globalSettings.view_style = v4;
    refreshPromptViewToggles();
}

export async function callback_generate_start(runType='normal', dataPack=null){    
    globalThis.generate.generate_single.setClickable(false);
    globalThis.generate.generate_batch.setClickable(false);
    globalThis.generate.generate_same.setClickable(false);
    globalThis.generate.generate_hires?.setClickable(false);

    globalThis.generate.skipClicked = false;
    globalThis.generate.skipCurrentClicked = false;
    globalThis.generate.cancelClicked = false;
    globalThis.generate.generate_skip.setClickable(true);
    globalThis.generate.generate_skip_current.setClickable(true);
    globalThis.generate.generate_cancel.setClickable(true);

    if (runType === 'normal') {
        if(globalThis.globalSettings.regional_condition) {
            await generateRegionalImage(dataPack);
        } else {
            await generateImage(dataPack);
        }    
    } else if (runType === 'MiraITU') {
        await generateMiraITU(dataPack);
    }
}

function shouldCallBackendCancel() {
    return !isAutoRetryRunning() && Boolean(globalThis.globalSettings.generate_auto_start);
}

async function cancelBackendIfNeeded() {
    if (!shouldCallBackendCancel()) {
        return false;
    }

    const apiInterface = globalThis.generate.nowAPI;
    if (globalThis.inBrowser) {
        if (apiInterface === 'ComfyUI') {
            await sendWebSocketMessage({ type: 'API', method: 'cancelComfyUI' });
        } else if (apiInterface === 'WebUI') {
            await sendWebSocketMessage({ type: 'API', method: 'cancelWebUI' });
        }
    } else if (apiInterface === 'ComfyUI') {
        await globalThis.api.cancelComfyUI();
    } else if (apiInterface === 'WebUI') {
        await globalThis.api.cancelWebUI();
    }
    return true;
}

export async function callback_generate_skip() {
    globalThis.generate.generate_skip.setClickable(false);
    globalThis.generate.skipClicked = true;

    const bak_autoStart = globalThis.globalSettings.generate_auto_start;
    await setQueueAutoStart(false);
    globalThis.queueManager.removeFollowings();
    await setQueueAutoStart(bak_autoStart);
}

export async function callback_generate_skip_current() {
    globalThis.generate.generate_skip_current.setClickable(false);

    const backendCancelled = await cancelBackendIfNeeded();
    if (backendCancelled) {
        globalThis.generate.generate_skip_current.setClickable(true);
        return;
    }

    if (globalThis.inGenerating) {
        globalThis.generate.skipCurrentClicked = true;
    }
    globalThis.queueManager.removeAt(0);
    if (globalThis.queueManager.getSlotsCount() === 0) {
        cancelAutoRetry();
        globalThis.generate.showCancelButtons(false);
        globalThis.mainGallery.hideLoading('success', '');
        clearHiresSubmitHash();
        return;
    }
    globalThis.generate.generate_skip_current.setClickable(true);
}

export async function callback_generate_cancel() {
    globalThis.generate.generate_skip.setClickable(false);
    globalThis.generate.generate_skip_current.setClickable(false);
    globalThis.generate.generate_cancel.setClickable(false);
    globalThis.generate.cancelClicked = true;
    cancelAutoRetry();
    globalThis.queueManager.removeAll();
    globalThis.generate.showCancelButtons(false);
    clearHiresSubmitHash();

    await cancelBackendIfNeeded();
}

export function callback_regional_condition(trigger, dummy = false) {
    const SETTINGS = globalThis.globalSettings;
    const FILES = globalThis.cachedFiles;
    const LANG = FILES.language[SETTINGS.language];

    const apiInterface = globalThis.generate.api_interface.getValue();    
    if(apiInterface !== 'ComfyUI' && trigger && !globalThis.custom_message.regional_forge_neo) {
        globalThis.overlay.custom.createErrorOverlay(LANG.regional_forge_neo, LANG.regional_forge_neo_link);
        globalThis.custom_message.regional_forge_neo = true;
    }

    if (dummy) {
        globalThis.generate.regionalCondition.setValue(globalThis.generate.regionalCondition_dummy.getValue());
    } else {
        globalThis.generate.regionalCondition_dummy.setValue(globalThis.generate.regionalCondition.getValue());
    }
    globalThis.globalSettings.regional_condition = trigger;

    const dropdown1 = document.querySelector('.dropdown-character');
    const dropdown2 = document.querySelector('.dropdown-character-regional');
    const text1 = document.querySelector('.prompt-positive-right');

    if (trigger) {
        dropdown1.style.display = 'none';
        dropdown2.style.display = 'flex';
        text1.style.display = 'block';       

        globalThis.prompt.common.setTitle(LANG.regional_custom_prompt);
        globalThis.prompt.positive.setTitle(LANG.regional_api_prompt);

        globalThis.prompt.positive_right.setValue(SETTINGS.api_prompt_right);
    } else {
        dropdown1.style.display = 'flex';
        dropdown2.style.display = 'none';
        text1.style.display = 'none';

        globalThis.prompt.common.setTitle(LANG.custom_prompt);
        globalThis.prompt.positive.setTitle(LANG.api_prompt);
    }
    syncBoundingWithRegional(trigger);
}

function syncBoundingWithRegional(regionalOn) {
    const box = globalThis.generate?.boundingEnable;
    if (regionalOn) {
        if (globalThis.globalSettings) globalThis.globalSettings.bounding_enable = false;
        box?.setValue(false);
        box?.setEnable(false);
    } else {
        box?.setEnable(true);
    }
    globalThis.bounding?.invalidatePreview?.();
    refreshTabLabelHints();
}

export function callback_controlnet(trigger)  {                
    const SETTINGS = globalThis.globalSettings;
    const FILES = globalThis.cachedFiles;
    const LANG = FILES.language[SETTINGS.language];
    const apiInterface = globalThis.generate.api_interface.getValue();

    globalThis.globalSettings.api_controlnet_enable = trigger; 

    if(globalThis.custom_message.controlnet)
        return;
    
    if(trigger && apiInterface === 'ComfyUI') {
        globalThis.overlay.custom.createErrorOverlay(LANG.message_controlnet_comfyui , LANG.message_controlnet_comfyui_link);
    }

    globalThis.custom_message.controlnet = true;
}

export function callback_adetailer(trigger)  {                
    const SETTINGS = globalThis.globalSettings;
    const FILES = globalThis.cachedFiles;
    const LANG = FILES.language[SETTINGS.language];
    const apiInterface = globalThis.generate.api_interface.getValue();

    globalThis.globalSettings.api_adetailer_enable = trigger; 

    if(globalThis.custom_message.adetailer)
        return;

    if(trigger && apiInterface === 'ComfyUI') {        
        globalThis.overlay.custom.createErrorOverlay(LANG.message_adetailer_comfyui, LANG.message_adetailer_comfyui_link);
    }    
    if(trigger && apiInterface === 'WebUI') {
        globalThis.overlay.custom.createErrorOverlay(LANG.message_adetailer_webui , LANG.message_adetailer_webui_link);
    }
    globalThis.custom_message.adetailer = true;
}

export function updateQueuePausedBorder() {
    const queueContainer = document.querySelector('.queue-container');
    if (queueContainer) {
        queueContainer.classList.toggle('queue-generate-paused', !globalThis.globalSettings.generate_auto_start);
    }
}

export async function callback_queue_autostart(trigger, isDummy=false) {
    const SETTINGS = globalThis.globalSettings;
    const FILES = globalThis.cachedFiles;
    const LANG = FILES.language[SETTINGS.language];

    if(isDummy) {
        globalThis.generate.queueAutostart.setValue(trigger);
    } else {
        globalThis.generate.queueAutostart_dummy.setValue(trigger);
    }

    if(trigger) {        
        globalThis.generate.skipClicked = false;
        globalThis.generate.skipCurrentClicked = false;
        globalThis.generate.cancelClicked = false;
        globalThis.generate.generate_skip.setClickable(true);
        globalThis.generate.generate_skip_current.setClickable(true);
        globalThis.generate.generate_cancel.setClickable(true);
        globalThis.generate.generate_single.setTitle(LANG.run_button);
        cancelAutoRetry();
    } else {
        globalThis.generate.generate_single.setTitle(LANG.run_button_paused);
    }

    globalThis.globalSettings.generate_auto_start = trigger;
    updateQueuePausedBorder();
    globalThis.overlay.buttons.reload();
    if (trigger) {
        globalThis.mainGallery?.syncGalleryStatus?.({ dismissHold: true });
    }
    if(trigger && globalThis.queueManager.getSlotsCount()>0) {
        await startQueue();
    } else if (!trigger) {
        globalThis.mainGallery?.syncGalleryStatus?.();
    }
}

export async function setQueueAutoStart(trigger) {
    const SETTINGS = globalThis.globalSettings;
    const FILES = globalThis.cachedFiles;
    const LANG = FILES.language[SETTINGS.language];

    if(trigger)
        globalThis.generate.generate_single.setTitle(LANG.run_button);
    else 
        globalThis.generate.generate_single.setTitle(LANG.run_button_paused);

    globalThis.globalSettings.generate_auto_start=trigger;
    globalThis.generate.queueAutostart.setValue(trigger);
    globalThis.generate.queueAutostart_dummy.setValue(trigger);
    updateQueuePausedBorder();
    globalThis.overlay.buttons.reload();

    if (trigger) {
        globalThis.mainGallery?.syncGalleryStatus?.({ dismissHold: true });
    }

    if(trigger && globalThis.queueManager.getSlotsCount() > 0 && !globalThis.inGenerating) {
        return await startQueue();
    }

    if (!trigger) {
        globalThis.mainGallery?.syncGalleryStatus?.();
    }

    return { ret: 'success', retCopy: '' };
}

export async function callback_thumb_select(index, selectedValue) {
    const value = selectedValue[0];
    if(value === globalThis.globalSettings.thumb_select ) {
        console.log('Thumbnail selection unchanged:', value);
        return;
    }

    setBlur();
    await update_thumb_select(value);
    setNormal();
}

async function update_thumb_select(value) {
    const bak_thumb_select = globalThis.globalSettings.thumb_select;    
    globalThis.globalSettings.thumb_select = value;
    console.log('Selected thumbnail:', globalThis.globalSettings.thumb_select);

    // load new thumbnail files
    let success;
    if (globalThis.inBrowser) {
        success = await sendWebSocketMessage({ type: 'API', method: 'updateCharacterThumb', params: [globalThis.globalSettings.thumb_select] });
    } else {
        success = await globalThis.api.updateCachedCharacterThumb(globalThis.globalSettings.thumb_select);
    }
    if (!success) {
        console.error('Failed to load thumbnail files for selection:', globalThis.globalSettings.thumb_select);
        globalThis.globalSettings.thumb_select = bak_thumb_select;
        if (isSaacReadonlyClient()) {
            const LANG = globalThis.cachedFiles.language[globalThis.globalSettings.language];
            await showDialog('info', { message: LANG.saac_readonly_thumb });
        }
        return;
    }        

    // update globalThis.cachedFiles with the new results
    let cachedFiles
    if (globalThis.inBrowser) {
        cachedFiles = await sendWebSocketMessage({ type: 'API', method: 'getCachedFiles'});
    } else {
        cachedFiles = await globalThis.api.getCachedFiles();
    }
    globalThis.cachedFiles.characterThumb = cachedFiles.characterThumb;
    globalThis.cachedFiles.characterList = cachedFiles.characters;
    globalThis.cachedFiles.tagAssist = cachedFiles.tagAssist;

    const SETTINGS = globalThis.globalSettings;
    const FILES = globalThis.cachedFiles;
    const LANG = FILES.language[SETTINGS.language];
    globalThis.cachedFiles.characterListArray = Object.entries(FILES.characterList);    

    // Character and OC List
    globalThis.characterList = myCharacterList('dropdown-character', FILES.characterList, FILES.ocList);
    globalThis.characterListRegional = myRegionalCharacterList('dropdown-character-regional', FILES.characterList, FILES.ocList);
        
    // Character List
    setDropdownLanguage('dropdown-character', [LANG.character1, LANG.character2, LANG.character3, LANG.original_character]);
    globalThis.characterList.setValueOnly(globalThis.globalSettings.language === 'en-US');
    globalThis.characterList.updateDefaults(SETTINGS.character1, SETTINGS.character2, SETTINGS.character3, 'None');
    globalThis.characterList.setTextValue(0, SETTINGS.weights4dropdownlist[4]);
    globalThis.characterList.setTextValue(1, SETTINGS.weights4dropdownlist[5]);
    globalThis.characterList.setTextValue(2, SETTINGS.weights4dropdownlist[6]);
    

    // Regional Condition
    setDropdownLanguage('dropdown-character-regional', [LANG.regional_character_left, LANG.regional_character_right, LANG.regional_origina_character_left, LANG.regional_origina_character_right]);
    globalThis.characterListRegional.setValueOnly(globalThis.globalSettings.language === 'en-US');
    globalThis.characterListRegional.updateDefaults(SETTINGS.character_left, SETTINGS.character_right, 'None', 'None');
    globalThis.characterListRegional.setTextValue(0, SETTINGS.weights4dropdownlist[7]);
    globalThis.characterListRegional.setTextValue(1, SETTINGS.weights4dropdownlist[8]);

    console.log('Thumbnail files loaded successfully.', FILES.characterListArray.length, 'characters available.');
}

export function callback_ptompt_textbox_autoresize(value) {    
    globalThis.globalSettings.ptompt_textbox_autoresize = value

    globalThis.prompt.common.setAutoResize(value);
    globalThis.prompt.positive.setAutoResize(value);
    globalThis.prompt.positive_right.setAutoResize(value);
    globalThis.prompt.negative.setAutoResize(value);
    globalThis.aiPrompt?.brief?.setAutoResize(value);
    globalThis.aiPrompt?.result?.setAutoResize(value);
    globalThis.prompt.exclude.setAutoResize(value);

    if (value === false) {
        // set to manual hight
        set_prompt_textBox_Heights();
    }
}

export function callback_ptompt_textbox_fontsize(value) { 
    globalThis.globalSettings.ptompt_textbox_fontsize=value; 

    changeFontSize(value);
}

export function callback_ai_promot_role(value) {
    globalThis.globalSettings.ai_prompt_role = value;
}

