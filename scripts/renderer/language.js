import { callback_regional_condition } from './callbacks.js';
 const CAT = '[Language]'

export const SAMPLER_COMFYUI = ["euler_ancestral", "euler", "euler_cfg_pp", "euler_ancestral_cfg_pp", "heun", "heunpp2","dpm_2", "dpm_2_ancestral",
    "lms", "dpm_fast", "dpm_adaptive", "dpmpp_2s_ancestral", "dpmpp_2s_ancestral_cfg_pp", "dpmpp_sde", "dpmpp_sde_gpu",
    "dpmpp_2m", "dpmpp_2m_cfg_pp", "dpmpp_2m_sde", "dpmpp_2m_sde_gpu", "dpmpp_3m_sde", "dpmpp_3m_sde_gpu", "ddpm", "lcm",
    "ipndm", "ipndm_v", "deis", "res_multistep", "res_multistep_cfg_pp", "res_multistep_ancestral", "res_multistep_ancestral_cfg_pp",
    "gradient_estimation", "er_sde", "seeds_2", "seeds_3"];
export const SCHEDULER_COMFYUI = ["normal", "karras", "exponential", "sgm_uniform", "simple", "ddim_uniform", "beta", "linear_quadratic", "kl_optimal"] ;

export const  SAMPLER_WEBUI = ["Euler a", "Euler", "DPM++ 2M", "DPM++ SDE", "DPM++ 2M SDE", "DPM++ 2M SDE Heun", "DPM++ 2S a", "DPM++ 3M SDE",
   "LMS", "Heun", "DPM2", "DPM2 a", "DPM fast", "DPM adaptive", "Restart"];
export const SCHEDULER_WEBUI = ["Automatic", "Uniform", "Karras", "Exponential", "Polyexponential", "SGM Uniform", "KL Optimal", "Align Your Steps", "Simple", "Normal", "DDIM", "Beta"];

function safeCheck(){
    if (!globalThis.cachedFiles.language || !globalThis.globalSettings.language) {
        console.error(CAT, 'Language data or globalSettings.language is not available.');
        return false;
    }

    const currentLanguage = globalThis.cachedFiles.language[globalThis.globalSettings.language];
    if (!currentLanguage) {
        console.error(CAT, `Language "${LANG}" not found in globalThis.cachedFiles.language.`);
        return false;
    }

    return true;
}

function setDropdownLanguage(containerID, labelPrefixList){
  const labels = document.querySelectorAll(`.${containerID} .mydropdown-input-container`);
  for (const [index, label] of labels.entries()) {
    if (labelPrefixList[index]) {
      label.title = labelPrefixList[index];
    }
  }
}

// incase of array input
function checkElement(input, targetArray) {
  const inputArray = Array.isArray(input) ? input : [input];
  return inputArray.some(element => targetArray.includes(element));
}

export function updateLanguage(skipLoRA = false, skipRightClick = false) {
    if(!safeCheck)
        return;    

    const LANG = globalThis.cachedFiles.language[globalThis.globalSettings.language];

    // Header 
    globalThis.dropdownList.model.setTitle(LANG.api_model_file_select);
    globalThis.dropdownList.vpred.setTitle(LANG.vpred);
    globalThis.dropdownList.vpred.setValue(LANG.vpred, [LANG.vpred_auto, LANG.vpred_on, LANG.vpred_off]);
    globalThis.dropdownList.settings.setTitle(LANG.title_settings_load);
    globalThis.headerIcon.save.title = LANG.title_settings_save;
    globalThis.headerIcon.reload.title = LANG.title_model_reload;
    globalThis.headerIcon.refresh.title = LANG.title_global_refresh;
    globalThis.headerIcon.swap.title = LANG.title_swap_layout;
    globalThis.headerIcon.theme.title = LANG.title_theme;

    // Language List
    setDropdownLanguage('global-settings-language', [LANG.language_select]);

    // Character List
    setDropdownLanguage('dropdown-character', [LANG.character1, LANG.character2, LANG.character3, LANG.original_character]);
    globalThis.characterList.setValueOnly(globalThis.globalSettings.language === 'en-US');

    // Regional Condition
    setDropdownLanguage('dropdown-character-regional', [LANG.regional_character_left, LANG.regional_character_right, LANG.regional_origina_character_left, LANG.regional_origina_character_right]);
    globalThis.characterListRegional.setValueOnly(globalThis.globalSettings.language === 'en-US');

    // View List
    setDropdownLanguage('dropdown-view', [LANG.view_angle, LANG.view_camera, LANG.view_background,LANG.view_style]);

    // Gallery Thumb
    let labels = document.querySelector('#gallery-thumb-span');
    labels.textContent = LANG.gallery_thumb_span;

    globalThis.generate.regionalCondition.setTitle(LANG.regional_condition);
    globalThis.generate.regionalCondition_dummy.setTitle(LANG.regional_condition);
    globalThis.regional.swap.setTitle(LANG.regional_swap);
    globalThis.regional.overlap_ratio.setTitle(LANG.regional_overlap_ratio);
    globalThis.regional.image_ratio.setTitle(LANG.regional_image_ratio);
    globalThis.regional.str_left.setTitle(LANG.regional_str_left);
    globalThis.regional.str_right.setTitle(LANG.regional_str_right);
    globalThis.regional.option_left.setTitle(LANG.regional_option_left);
    globalThis.regional.option_right.setTitle(LANG.regional_option_right);

    globalThis.generate.seed.setTitle(LANG.random_seed);
    globalThis.generate.cfg.setTitle(LANG.cfg);
    globalThis.generate.step.setTitle(LANG.step);
    globalThis.generate.width.setTitle(LANG.width);
    globalThis.generate.height.setTitle(LANG.height);
    globalThis.generate.batch.setTitle(LANG.batch);

    globalThis.generate.hifix.setTitle(LANG.api_hf_enable);
    globalThis.generate.hifix_dummy.setTitle(LANG.api_hf_enable);
    globalThis.generate.refiner.setTitle(LANG.api_refiner_enable);
    globalThis.generate.refiner_dummy.setTitle(LANG.api_refiner_enable);
    globalThis.generate.controlnet.setTitle(LANG.api_controlnet_enable);
    globalThis.generate.adetailer.setTitle(LANG.api_adetailer_enable);

    globalThis.generate.landscape.setTitle(LANG.api_image_landscape);
    globalThis.generate.tag_assist.setTitle(LANG.tag_assist);
    globalThis.generate.wildcard_random.setTitle(LANG.wildcard_random);

    globalThis.generate.sampler.setValue(LANG.api_model_sampler, globalThis.globalSettings.api_interface==='ComfyUI'?SAMPLER_COMFYUI:SAMPLER_WEBUI);
    globalThis.generate.scheduler.setValue(LANG.api_model_scheduler, globalThis.globalSettings.api_interface==='ComfyUI'?SCHEDULER_COMFYUI:SCHEDULER_WEBUI);
    globalThis.generate.sampler.setTitle(LANG.api_model_sampler);
    globalThis.generate.scheduler.setTitle(LANG.api_model_scheduler);

    globalThis.generate.generate_single.setTitle(globalThis.globalSettings.generate_auto_start?LANG.run_button:LANG.run_button_paused);
    globalThis.generate.generate_batch.setTitle(LANG.run_random_button);
    globalThis.generate.generate_same.setTitle(LANG.run_same_button);
    globalThis.generate.generate_skip.setTitle(LANG.run_skip_button);
    globalThis.generate.generate_cancel.setTitle(LANG.run_cancel_button);

    globalThis.generate.api_interface.setTitle(LANG.api_interface);
    globalThis.generate.api_address.setTitle(LANG.api_addr);
    globalThis.generate.api_preview_refresh_time.setTitle(LANG.api_preview_refresh_time);    
    
    globalThis.generate.model_filter.setTitle(LANG.model_filter);    
    globalThis.generate.model_filter_keyword.setTitle(LANG.model_filter_keyword);
    globalThis.generate.search_modelinsubfolder.setTitle(LANG.search_modelinsubfolder);    
    globalThis.generate.model_path_comfyui.setTitle(LANG.model_path_comfyui);
    globalThis.generate.model_path_webui.setTitle(LANG.model_path_webui);
    globalThis.generate.webui_auth.setTitle(LANG.webui_auth);
    globalThis.generate.webui_auth_enable.setTitle(LANG.webui_auth_enable);
    globalThis.generate.queueAutostart.setTitle(LANG.generate_auto_start);
    globalThis.generate.queueAutostart_dummy.setTitle(LANG.generate_auto_start);

    globalThis.generate.scrollToLatest.setTitle(LANG.scroll_to_last);
    globalThis.generate.keepGallery.setTitle(LANG.keep_gallery);
    globalThis.infoBox.image.setTitle(LANG.output_info);

    globalThis.prompt.common.setTitle(LANG.custom_prompt);
    globalThis.prompt.positive.setTitle(LANG.api_prompt);
    globalThis.prompt.positive_right.setTitle(LANG.regional_api_prompt_right);
    globalThis.prompt.negative.setTitle(LANG.api_neg_prompt);
    globalThis.prompt.ai.setTitle(LANG.ai_prompt);
    globalThis.prompt.exclude.setTitle(LANG.prompt_ban);

    globalThis.hifix.model.setTitle(LANG.api_hf_upscaler_selected);
    globalThis.hifix.colorTransfer.setTitle(LANG.api_hf_colortransfer);
    globalThis.hifix.randomSeed.setTitle(LANG.api_hf_random_seed);
    globalThis.hifix.scale.setTitle(LANG.api_hf_scale);
    globalThis.hifix.denoise.setTitle(LANG.api_hf_denoise);
    globalThis.hifix.steps.setTitle(LANG.api_hf_steps);

    globalThis.refiner.model.setTitle(LANG.api_refiner_model);
    globalThis.refiner.addnoise.setTitle(LANG.api_refiner_add_noise);
    globalThis.refiner.ratio.setTitle(LANG.api_refiner_ratio);
    globalThis.refiner.vpred.setTitle(LANG.vpred);
    globalThis.refiner.vpred.setValue(LANG.vpred, [LANG.vpred_auto, LANG.vpred_on, LANG.vpred_off]);

    globalThis.ai.interface.setTitle(LANG.ai_interface);
    globalThis.ai.remote_timeout.setTitle(LANG.remote_ai_timeout);
    globalThis.ai.remote_address.setTitle(LANG.remote_ai_base_url);
    globalThis.ai.remote_model_select.setTitle(LANG.remote_ai_model);
    globalThis.ai.remote_apikey.setTitle('API Key');
    globalThis.ai.ai_select.setTitle(LANG.batch_generate_rule, LANG.ai_select, LANG.ai_select_title);
    globalThis.ai.ai_prompt_preview.setTitle(LANG.ai_prompt_preview);
    globalThis.ai.local_address.setTitle(LANG.ai_local_addr);
    globalThis.ai.local_temp.setTitle(LANG.ai_local_temp);
    globalThis.ai.local_n_predict.setTitle(LANG.ai_local_n_predict);
    globalThis.ai.ai_system_prompt.setTitle(LANG.ai_system_prompt_text);
    globalThis.ai.ai_system_prompt.setValue(LANG.ai_system_prompt);

    globalThis.overlay.buttons.reload();

    if(!skipLoRA) {
        globalThis.lora.reload();
        globalThis.controlnet.reload();
        globalThis.jsonlist.reload();
        globalThis.aDetailer.reload();
    }

    if(!skipRightClick)
        globalThis.rightClick.updateLanguage();

    globalThis.imageInfo.updateHintText(LANG.image_info_drag_hint_top, LANG.image_info_drag_hint_bottom);
}

// eslint-disable-next-line sonarjs/cognitive-complexity
export function updateSettings() {
    if(!safeCheck)
        return;    

    const SETTINGS = globalThis.globalSettings;
    const LANG = globalThis.cachedFiles.language[SETTINGS.language];

    globalThis.dropdownList.languageList.updateDefaults(LANG.language);

    globalThis.ai.remote_address.setValue(SETTINGS.remote_ai_base_url);
    globalThis.ai.remote_model_select.setValue(SETTINGS.remote_ai_model);
    globalThis.ai.remote_apikey.setValue(SETTINGS.remote_ai_api_key);
    globalThis.ai.remote_timeout.setValue(SETTINGS.remote_ai_timeout);

    globalThis.generate.regionalCondition.setValue(SETTINGS.regional_condition);
    globalThis.generate.regionalCondition_dummy.setValue(SETTINGS.regional_condition);
    globalThis.regional.swap.setValue(SETTINGS.regional_swap);
    globalThis.regional.overlap_ratio.setValue(SETTINGS.regional_overlap_ratio);
    globalThis.regional.image_ratio.setValue(SETTINGS.regional_image_ratio);
    globalThis.regional.str_left.setValue(SETTINGS.regional_str_left);
    globalThis.regional.str_right.setValue(SETTINGS.regional_str_right);
    globalThis.regional.option_left.updateDefaults(SETTINGS.regional_option_left);
    globalThis.regional.option_right.updateDefaults(SETTINGS.regional_option_right);

    globalThis.generate.model_filter.setValue(SETTINGS.model_filter);
    globalThis.generate.model_filter_keyword.setValue(SETTINGS.model_filter_keyword);
    globalThis.generate.search_modelinsubfolder.setValue(SETTINGS.search_modelinsubfolder);    
    globalThis.generate.model_path_comfyui.setValue(SETTINGS.model_path_comfyui);
    globalThis.generate.model_path_webui.setValue(SETTINGS.model_path_webui);
    globalThis.generate.webui_auth.setValue(SETTINGS.webui_auth);
    globalThis.generate.webui_auth_enable.updateDefaults(SETTINGS.webui_auth_enable);
    globalThis.generate.queueAutostart.setValue(SETTINGS.generate_auto_start);
    globalThis.generate.queueAutostart_dummy.setValue(SETTINGS.generate_auto_start);

    globalThis.characterList.updateDefaults(SETTINGS.character1, SETTINGS.character2, SETTINGS.character3, 'None');
    globalThis.characterList.setTextValue(0, SETTINGS.weights4dropdownlist[4]);
    globalThis.characterList.setTextValue(1, SETTINGS.weights4dropdownlist[5]);
    globalThis.characterList.setTextValue(2, SETTINGS.weights4dropdownlist[6]);
    globalThis.characterListRegional.updateDefaults(SETTINGS.character_left, SETTINGS.character_right, 'None', 'None');
    globalThis.characterListRegional.setTextValue(0, SETTINGS.weights4dropdownlist[7]);
    globalThis.characterListRegional.setTextValue(1, SETTINGS.weights4dropdownlist[8]);
    globalThis.generate.tag_assist.setValue(SETTINGS.tag_assist);
    globalThis.generate.wildcard_random.setValue(SETTINGS.wildcard_random);

    globalThis.viewList.updateDefaults(SETTINGS.view_angle, SETTINGS.view_camera, SETTINGS.view_background, SETTINGS.view_style);
    globalThis.viewList.setTextValue(0, SETTINGS.weights4dropdownlist[0]);  // tag_angle
    globalThis.viewList.setTextValue(1, SETTINGS.weights4dropdownlist[1]);  // tag_camera
    globalThis.viewList.setTextValue(2, SETTINGS.weights4dropdownlist[2]);  // tag_background
    globalThis.viewList.setTextValue(3, SETTINGS.weights4dropdownlist[3]);  // tag_style

    // need more careful for sampler and scheduler due to different list
    if (SETTINGS.api_interface==='ComfyUI') {
        if(checkElement(SETTINGS.api_model_sampler, SAMPLER_COMFYUI)) {
            globalThis.generate.sampler.updateDefaults(SETTINGS.api_model_sampler);
        } else {
            console.warn(CAT, `Sampler ${SETTINGS.api_model_sampler} not found in ComfyUI list, setting to default.`);
            globalThis.generate.sampler.updateDefaults(SAMPLER_COMFYUI[0]);
        }
        if(checkElement(SETTINGS.api_model_scheduler, SCHEDULER_COMFYUI)) {
            globalThis.generate.scheduler.updateDefaults(SETTINGS.api_model_scheduler);
        } else {
            console.warn(CAT, `Scheduler ${SETTINGS.api_model_scheduler} not found in ComfyUI list, setting to default.`);
            globalThis.generate.scheduler.updateDefaults(SCHEDULER_COMFYUI[0]);
        }   
    } else {
        if(checkElement(SETTINGS.api_model_sampler, SAMPLER_WEBUI)) {
            globalThis.generate.sampler.updateDefaults(SETTINGS.api_model_sampler);
        } else {
            console.warn(CAT, `Sampler ${SETTINGS.api_model_sampler} not found in WebUI list, setting to default.`);
            globalThis.generate.sampler.updateDefaults(SAMPLER_WEBUI[0]);
        }
        if(checkElement(SETTINGS.api_model_scheduler, SCHEDULER_WEBUI)) {
            globalThis.generate.scheduler.updateDefaults(SETTINGS.api_model_scheduler);
        } else {    
            console.warn(CAT, `Scheduler ${SETTINGS.api_model_scheduler} not found in WebUI list, setting to default.`);
            globalThis.generate.scheduler.updateDefaults(SCHEDULER_WEBUI[0]);
        }
    }

    globalThis.dropdownList.model.updateDefaults(SETTINGS.api_model_file_select);
    globalThis.dropdownList.vpred.updateDefaults(SETTINGS.api_model_file_vpred);
    globalThis.generate.seed.setValue(SETTINGS.random_seed);
    globalThis.generate.cfg.setValue(SETTINGS.cfg);
    globalThis.generate.step.setValue(SETTINGS.step);
    globalThis.generate.width.setValue(SETTINGS.width);
    globalThis.generate.height.setValue(SETTINGS.height);
    globalThis.generate.batch.setValue(SETTINGS.batch);    
    globalThis.generate.landscape.setValue(SETTINGS.api_image_landscape);
    globalThis.generate.scrollToLatest.setValue(SETTINGS.scroll_to_last);
    globalThis.generate.keepGallery.setValue(SETTINGS.keep_gallery);

    globalThis.prompt.common.setValue(SETTINGS.custom_prompt);
    globalThis.prompt.positive.setValue(SETTINGS.api_prompt);
    globalThis.prompt.positive_right.setValue(SETTINGS.regional_api_prompt_right);
    globalThis.prompt.negative.setValue(SETTINGS.api_neg_prompt);
    globalThis.prompt.ai.setValue(SETTINGS.ai_prompt);
    globalThis.prompt.exclude.setValue(SETTINGS.prompt_ban);

    globalThis.ai.interface.updateDefaults(SETTINGS.ai_interface);
    globalThis.ai.local_address.setValue(SETTINGS.ai_local_addr);
    globalThis.ai.local_temp.setValue(SETTINGS.ai_local_temp);
    globalThis.ai.local_n_predict.setValue(SETTINGS.ai_local_n_predict);
    globalThis.ai.ai_select.setValue(SETTINGS.ai_prompt_role);
    globalThis.ai.ai_prompt_preview.setValue(SETTINGS.ai_prompt_preview);

    globalThis.generate.api_interface.updateDefaults(SETTINGS.api_interface);
    globalThis.generate.api_preview_refresh_time.setValue(SETTINGS.api_preview_refresh_time);
    globalThis.generate.api_address.setValue(SETTINGS.api_addr);

    globalThis.generate.hifix.setValue(SETTINGS.api_hf_enable);
    globalThis.generate.hifix_dummy.setValue(SETTINGS.api_hf_enable);
    globalThis.hifix.scale.setValue(SETTINGS.api_hf_scale);
    globalThis.hifix.denoise.setValue(SETTINGS.api_hf_denoise);
    if(globalThis.hifix.model.isValueExist(SETTINGS.api_hf_upscaler_selected)){
        globalThis.hifix.model.updateDefaults(SETTINGS.api_hf_upscaler_selected);
    } else {
        globalThis.hifix.model.updateDefaults(globalThis.cachedFiles.upscalerList[0]);
    }
    globalThis.hifix.colorTransfer.updateDefaults(SETTINGS.api_hf_colortransfer);
    globalThis.hifix.randomSeed.setValue(SETTINGS.api_hf_random_seed);
    globalThis.hifix.steps.setValue(SETTINGS.api_hf_steps);    
    globalThis.hifix.model.setOptions(globalThis.cachedFiles.upscalerList, null, LANG.api_hf_upscaler_selected, SETTINGS.api_hf_upscaler_selected);

    globalThis.generate.refiner.setValue(SETTINGS.api_refiner_enable);
    globalThis.generate.refiner_dummy.setValue(SETTINGS.api_refiner_enable);
    globalThis.refiner.addnoise.setValue(SETTINGS.api_refiner_add_noise);    
    globalThis.refiner.model.updateDefaults(SETTINGS.api_refiner_model);
    globalThis.refiner.vpred.updateDefaults(SETTINGS.api_refiner_model_vpred);
    globalThis.refiner.ratio.setValue(SETTINGS.api_refiner_ratio);

    callback_regional_condition(globalThis.generate.regionalCondition.getValue(), false); //Regional Condition
}