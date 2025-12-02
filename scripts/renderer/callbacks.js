import { decodeThumb } from './customThumbGallery.js';
import { generateImage, startQueue } from './generate.js';
import { generateRegionalImage } from './generate_regional.js';
import { doSwap, reloadFiles } from './components/myCollapsed.js';
import { SAMPLER_COMFYUI, SAMPLER_WEBUI, SCHEDULER_COMFYUI, SCHEDULER_WEBUI, updateLanguage, updateSettings } from './language.js';
import { setBlur, setNormal } from './components/myDialog.js';
import { applyTheme } from './theme.js';
import { sendWebSocketMessage } from '../../webserver/front/wsRequest.js';

export async function callback_mySettingList(index, selectedValue) {    
    if(!globalThis.initialized)
        return;
    
    const lastApiInterface = globalThis.globalSettings.api_interface;
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

    doSwap(globalThis.globalSettings.rightToleft);    
    await reloadFiles()
    updateLanguage(true, globalThis.inBrowser); 
    updateSettings(true);
    globalThis.dropdownList.settings.updateDefaults(value);
    if(old_css !== globalThis.globalSettings.css_style)
        applyTheme(globalThis.globalSettings.css_style);
    
    globalThis.lora.flush();
    globalThis.initialized = true;

    // The interface has changed!
    if(globalThis.globalSettings.api_interface !== lastApiInterface) {
        console.log("Reload UI and update cache due to interface changed.");
        await callback_api_interface(0, [globalThis.globalSettings.api_interface]);
    }
    setNormal();

    globalThis.globalSettings.lastLoadedSettings = value.slice(0, -5);
}

export async function callback_api_interface(index, selectedValue){
    globalThis.globalSettings.api_interface = selectedValue[0];

    const SETTINGS = globalThis.globalSettings;
    const LANG = globalThis.cachedFiles.language[SETTINGS.language];
    globalThis.generate.sampler.setValue(LANG.api_model_sampler, (SETTINGS.api_interface==='ComfyUI')?SAMPLER_COMFYUI:SAMPLER_WEBUI);
    globalThis.generate.scheduler.setValue(LANG.api_model_scheduler, (SETTINGS.api_interface==='ComfyUI')?SCHEDULER_COMFYUI:SCHEDULER_WEBUI);    

    const currentModelSelect = globalThis.dropdownList.model.getValue();
    await reloadFiles();
    if(globalThis.dropdownList.model.isValueExist(currentModelSelect)){
        globalThis.dropdownList.model.updateDefaults(currentModelSelect);
    }

    globalThis.lora.reload();
    globalThis.controlnet.reload();
    globalThis.jsonlist.reload();
    globalThis.aDetailer.clear();

    if(SETTINGS.api_interface === 'ComfyUI') {
        globalThis.hifix.colorTransfer.setValue(LANG.api_hf_colortransfer, ['None', 'Mean', 'Lab']);
        globalThis.hifix.colorTransfer.updateDefaults(SETTINGS.api_hf_colortransfer);
    } else {
        globalThis.hifix.colorTransfer.setValue(LANG.api_hf_colortransfer, ['None']);
        globalThis.hifix.colorTransfer.updateDefaults('None');        
    }

    if (globalThis.inBrowser) {
        globalThis.cachedFiles.upscalerList = await sendWebSocketMessage({ type: 'API', method: 'getUpscalerList', params: [SETTINGS.api_interface] });
    } else {
        globalThis.cachedFiles.upscalerList = await globalThis.api.getUpscalerList(SETTINGS.api_interface);
    }

    globalThis.hifix.model.setValue(LANG.api_hf_upscaler_selected, globalThis.cachedFiles.upscalerList);
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
}

export async function callback_generate_start(loops = 1, runSame = false){    
    globalThis.generate.generate_single.setClickable(false);
    globalThis.generate.generate_batch.setClickable(false);
    globalThis.generate.generate_same.setClickable(false);

    globalThis.generate.skipClicked = false;
    globalThis.generate.cancelClicked = false;
    globalThis.generate.generate_skip.setClickable(true);
    globalThis.generate.generate_cancel.setClickable(true);

    if(globalThis.globalSettings.regional_condition) {
        await generateRegionalImage(loops, runSame);
    } else {
        await generateImage(loops, runSame);
    }    
}

export function callback_generate_skip() {
    globalThis.generate.generate_skip.setClickable(false);
    globalThis.generate.skipClicked = true;

    setQueueAutoStart(false);
}

export async function callback_generate_cancel() {
    globalThis.generate.generate_skip.setClickable(false);
    globalThis.generate.generate_cancel.setClickable(false);
    globalThis.generate.cancelClicked = true;
    globalThis.queueManager.removeAll();
    globalThis.generate.showCancelButtons(false);

    if (globalThis.inBrowser) {        
        const apiInterface = globalThis.generate.nowAPI;
        if(apiInterface === 'ComfyUI') {
            await sendWebSocketMessage({ type: 'API', method: 'cancelComfyUI' });
        } else if(apiInterface === 'WebUI') {
            await sendWebSocketMessage({ type: 'API', method: 'cancelWebUI' });
        }
    } else {
        const apiInterface = globalThis.generate.nowAPI;
        if(apiInterface === 'ComfyUI') {
            await globalThis.api.cancelComfyUI();
        } else if(apiInterface === 'WebUI') {
            await globalThis.api.cancelWebUI();
        }
    }
}

export function callback_keep_gallery(keepGallery) {
    if(!keepGallery) {
        globalThis.mainGallery.clearGallery();
    }

    globalThis.globalSettings.keep_gallery = keepGallery;
}

export function callback_regional_condition(trigger, dummy = false) {
    const SETTINGS = globalThis.globalSettings;
    const FILES = globalThis.cachedFiles;
    const LANG = FILES.language[SETTINGS.language];

    const apiInterface = globalThis.generate.api_interface.getValue();    
    if(apiInterface !== 'ComfyUI' && trigger) {
        const errorMessage = LANG.regional_a1111;
        globalThis.overlay.custom.createErrorOverlay(errorMessage, 'https://github.com/hako-mikan/sd-webui-regional-prompter');
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
}

export function callback_controlnet(trigger)  {                
    const SETTINGS = globalThis.globalSettings;
    const FILES = globalThis.cachedFiles;
    const LANG = FILES.language[SETTINGS.language];
    const apiInterface = globalThis.generate.api_interface.getValue();

    globalThis.globalSettings.api_controlnet_enable = trigger; 
    
    if(trigger && apiInterface === 'ComfyUI') 
        globalThis.overlay.custom.createErrorOverlay(LANG.message_controlnet_comfyui , 'Links:\nhttps://github.com/Fannovel16/comfyui_controlnet_aux\nhttps://github.com/sipherxyz/comfyui-art-venture'); 
    if(trigger && apiInterface === 'WebUI') 
        globalThis.overlay.custom.createErrorOverlay(LANG.message_controlnet_webui , 'https://github.com/Mikubill/sd-webui-controlnet'); 
}

export function callback_adetailer(trigger)  {                
    const SETTINGS = globalThis.globalSettings;
    const FILES = globalThis.cachedFiles;
    const LANG = FILES.language[SETTINGS.language];
    const apiInterface = globalThis.generate.api_interface.getValue();

    globalThis.globalSettings.api_adetailer_enable = trigger; 
    if(trigger && apiInterface === 'ComfyUI') {        
        globalThis.overlay.custom.createErrorOverlay(LANG.message_adetailer_comfyui, 'https://github.com/ltdrdata/ComfyUI-Impact-Pack\nhttps://github.com/ltdrdata/ComfyUI-Impact-Subpack');
    }
    
    if(trigger && apiInterface === 'WebUI') {
        globalThis.overlay.custom.createErrorOverlay(LANG.message_adetailer_webui , 'https://github.com/Bing-su/adetailer');         
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
        globalThis.generate.cancelClicked = false;
        globalThis.generate.generate_skip.setClickable(true);
        globalThis.generate.generate_cancel.setClickable(true);
        globalThis.generate.generate_single.setTitle(LANG.run_button);
    } else {
        globalThis.generate.generate_single.setTitle(LANG.run_button_paused);
    }

    globalThis.globalSettings.generate_auto_start = trigger;
    globalThis.overlay.buttons.reload();
    if(trigger && globalThis.queueManager.getSlotsCount()>0) {
        await startQueue();
    }
}

export function setQueueAutoStart(trigger){
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
    globalThis.overlay.buttons.reload();
}