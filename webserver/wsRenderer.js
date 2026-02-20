import { updateLanguage, updateSettings } from '../scripts/renderer/language.js';
import { setupGallery } from '../scripts/renderer/customGallery.js';
import { setupThumbOverlay, setupThumb } from '../scripts/renderer/customThumbGallery.js';
import { setupSuggestionSystem } from '../scripts/renderer/tagAutoComplete.js';
import { setupButtonOverlay, customCommonOverlay } from '../scripts/renderer/customOverlay.js';
import { myCharacterList, myRegionalCharacterList, myViewsList, myLanguageList, mySimpleList } from '../scripts/renderer/components/myDropdown.js';
import { callback_mySettingList, callback_api_model_select, callback_api_model_type, callback_api_interface, 
    callback_generate_start, callback_generate_skip, callback_generate_cancel,callback_keep_gallery,
    callback_regional_condition, callback_controlnet, callback_adetailer, callback_queue_autostart
 } from '../scripts/renderer/callbacks.js';
import { setupSlider } from '../scripts/renderer/components/mySlider.js';
import { setupCheckbox, setupRadiobox } from '../scripts/renderer/components/myCheckbox.js';
import { setupButtons, toggleButtons, showCancelButtons } from '../scripts/renderer/components/myButtons.js';
import { setupCollapsed, setupSaveSettingsToggle, setupModelReloadToggle, 
    setupRefreshToggle, setupSwapToggle, doSwap } from '../scripts/renderer/components/myCollapsed.js';
import { setupTextbox, setupInfoBox } from '../scripts/renderer/components/myTextbox.js';
import { from_main_updateGallery, from_main_updatePreview, from_main_customOverlayProgress } from '../scripts/renderer/generate_backend.js';
import { setupLoRA } from '../scripts/renderer/slots/myLoRASlot.js';
import { setupControlNet } from '../scripts/renderer/slots/myControlNetSlot.js';
import { setupJsonSlot } from '../scripts/renderer/slots/myJsonSlot.js';
import { setupADetailer } from '../scripts/renderer/slots/myADetailerSlot.js';
import { setupQueue } from '../scripts/renderer/slots/myQueueSlot.js';
import { setBlur, setNormal, showDialog } from '../scripts/renderer/components/myDialog.js';
import { setupImageUploadOverlay } from '../scripts/renderer/imageInfo.js';
import { setupThemeToggle } from '../scripts/renderer/theme.js';
import { setupRightClickMenu } from '../scripts/renderer/components/myRightClickMenu.js';
import { initWebSocket, isSecuredConnection, sendWebSocketMessage, registerCallback } from './front/wsRequest.js';

// Run the init function when the DOM is fully loaded
function afterDOMinit() {
    console.log("Script loaded, attempting initial setup");
    (async () => {        
        setBlur();     

        if( await initWebSocket()) {
            await init();         
            registerCallback('updatePreview', from_main_updatePreview);
            registerCallback('appendImage', from_main_updateGallery);
            registerCallback('updateProgress', from_main_customOverlayProgress);
            if (globalThis.initialized) {
                setNormal();                

                // not localhost and not HTTPS
                const SETTINGS = globalThis.globalSettings;
                const FILES = globalThis.cachedFiles;
                const LANG = FILES.language[SETTINGS.language];
                if(!isSecuredConnection()){
                    globalThis.overlay.custom.createErrorOverlay(LANG.saac_http_connection, LANG.saac_http_connection);
                }
            }
        } else {
            console.error('WebSocket initialization failed.');
            await showDialog('error', { 
                message: 'WebSocket initialization failed.\nWebSocket初始化失败',
                buttonText: 'OK'
            });
        }
    })().catch((error) => {
        console.error('Error:', error);
    });
}

export async function setupHeader(SETTINGS, FILES, LANG){
    globalThis.dropdownList = {
        languageList: myLanguageList(FILES.language),            
        model: mySimpleList('model-select', LANG.api_model_file_select, FILES.modelList, 
            callback_api_model_select, 50),
        model_type: mySimpleList('model-type', LANG.api_model_type, ['Checkpoint', 'Diffusion'],
            callback_api_model_type, 5, false, false),

        vae_unet: mySimpleList('vae-unet', LANG.api_difussion_vae_model, FILES.vaeList,
            (index, value) => { globalThis.globalSettings.api_vae_unet_model = value; }, 20, true, true),
        vae_sdxl: mySimpleList('vae-sdxl', LANG.api_ckpt_vae_model, FILES.vaeList,
            (index, value) => { globalThis.globalSettings.api_vae_sdxl_model = value; }, 20, true, true),
        vae_sdxl_override: setupCheckbox('vae-override', LANG.api_vae_sdxl_override, SETTINGS.api_vae_sdxl_override, true,
            (value) => { globalThis.globalSettings.api_vae_sdxl_override = value; }),

        diffusion_model_weight_dtype: mySimpleList('diffusion-model-weight-dtype', LANG.api_diffusion_model_weight_dtype,
            ['default', 'fp8_e4m3fn', 'fp8_e4m3fn_fast', 'fp8_e5m2'],
            (index, value) => { globalThis.globalSettings.diffusion_model_weight_dtype = value; }, 5, false, true),

        textencoder: mySimpleList('text-encoder', LANG.api_text_encoder, FILES.textEncoderList,
            (index, value) => { globalThis.globalSettings.api_model_file_text_encoder = value; }, 20, true, true),
        textencoder_type: mySimpleList('text-encoder-type', LANG.api_text_encoder_type,
            ["stable_diffusion", "stable_cascade", "sd3", "stable_audio", "mochi", "ltxv", "pixart", "cosmos", "lumina2", "wan", "hidream", "chroma", "ace", "omnigen2", "qwen_image", "hunyuan_image", "flux2", "ovis"],
            (index, value) => { globalThis.globalSettings.api_model_file_text_encoder_type = value; }, 10, false, true),
        textencoder_device: mySimpleList('text-encoder-device', LANG.api_text_encoder_device,
            ['default', 'cpu'],
            (index, value) => { globalThis.globalSettings.api_model_file_text_encoder_device = value; }, 5, false, true),

        vpred:  mySimpleList('model-vpred', LANG.vpred, [LANG.vpred_auto, LANG.vpred_on, LANG.vpred_off], 
            (index, value) => { globalThis.globalSettings.api_model_file_vpred = value; }, 5, false, true),        
        settings: mySimpleList('settings-select', LANG.title_settings_load, FILES.settingList, callback_mySettingList)
    }
    globalThis.dropdownList.languageList.updateDefaults(LANG.language);
    globalThis.dropdownList.vpred.updateDefaults(SETTINGS.api_model_file_vpred);

    // Setup Header button
    globalThis.headerIcon = {
        save: setupSaveSettingsToggle(),
        reload: await setupModelReloadToggle(),
        refresh: setupRefreshToggle(),
        swap: setupSwapToggle(),
        theme: setupThemeToggle()
    }        

    // Character and OC List
    globalThis.characterList = myCharacterList('dropdown-character', FILES.characterList, FILES.ocList);
    globalThis.characterListRegional = myRegionalCharacterList('dropdown-character-regional', FILES.characterList, FILES.ocList);
}

export async function setupLeftRight(SETTINGS, FILES, LANG) {
    // Init Left
    globalThis.viewList = myViewsList('dropdown-view', FILES.viewTags);        
    setupGallery('gallery-main-main');        
    globalThis.infoBox = {
        image: setupInfoBox('image-infobox-main', LANG.output_info, '', true, 320),            
    }

    // Init Right
    setupThumb('gallery-thumb-main');
    setupThumbOverlay();
    globalThis.imageInfo = setupImageUploadOverlay();

    globalThis.collapsedTabs = {
        infoBox: setupCollapsed('image-infobox', false),
        gallery: setupCollapsed('gallery-main', false),
        thumb: setupCollapsed('gallery-thumb', true),
        hires: setupCollapsed('highres-fix', true),
        refiner: setupCollapsed('refiner', true),
        controlnet: setupCollapsed('controlnet', true),
        modelSettings: setupCollapsed('model-settings', true),
        lora: setupCollapsed('add-lora', true),
        settings: setupCollapsed('system-settings', true),
        regional: setupCollapsed('regional-condition', true),
        jsonlist: setupCollapsed('jsonlist', true),
        aDetailer: setupCollapsed('adetailer', true),
        queueManager: setupCollapsed('queue', false),
    }
}

export async function createGenerate(SETTINGS, FILES, LANG) {
    console.log('Creating globalThis.generate');
    globalThis.generate = {
        skipClicked: false,
        cancelClicked: false,
        nowAPI: 'none',
        lastPos: 'solo, masterpiece, best quality, amazing quality',
        lastPosColored: 'solo, masterpiece, best quality, amazing quality',
        lastNeg: 'bad quality,worst quality,worst detail,sketch',
        loadingMessage: null,

        regionalCondition: setupCheckbox('regional-condition-trigger', LANG.regional_condition, SETTINGS.regional_condition, true, (value) => { callback_regional_condition(value, false); }),
        regionalCondition_dummy: setupCheckbox('regional-condition-trigger-dummy', LANG.regional_condition, SETTINGS.regional_condition, true, (value) => { callback_regional_condition(value, true); }),
        scrollToLatest: setupCheckbox('gallery-main-latest', LANG.scroll_to_last, SETTINGS.scroll_to_last, true, (value) => { globalThis.globalSettings.scroll_to_last = value; }),
        keepGallery: setupCheckbox('gallery-main-keep', LANG.keep_gallery, SETTINGS.keep_gallery, true, callback_keep_gallery),

        seed: setupSlider('generate-random-seed', LANG.random_seed, -1, 4294967295, 1, SETTINGS.random_seed, (value) =>{globalThis.globalSettings.random_seed = value;}),
        cfg: setupSlider('generate-cfg', LANG.cfg, 1, 20, 0.01, SETTINGS.cfg, (value) =>{globalThis.globalSettings.cfg = value;}),
        step: setupSlider('generate-step', LANG.step, 1, 100, 1, SETTINGS.step, (value) =>{globalThis.globalSettings.step = value;}),
        width: setupSlider('generate-width', LANG.width, 512, 2048, 8, SETTINGS.width, (value) =>{globalThis.globalSettings.width = value;}),
        height: setupSlider('generate-height', LANG.height, 512, 2048, 8, SETTINGS.height, (value) =>{globalThis.globalSettings.height = value;}),
        batch: setupSlider('generate-batch', LANG.batch, 1, 2038, 1, SETTINGS.batch, (value) =>{globalThis.globalSettings.batch = value;}),
        hifix: setupCheckbox('generate-hires-fix', LANG.api_hf_enable, SETTINGS.api_hf_enable, true, (value) => { globalThis.globalSettings.api_hf_enable = value; globalThis.generate.hifix_dummy.setValue(value);}),
        hifix_dummy: setupCheckbox('generate-hires-fix-dummy', LANG.api_hf_enable, SETTINGS.api_hf_enable, true, (value) => { globalThis.globalSettings.api_hf_enable = value; globalThis.generate.hifix.setValue(value);}),
        refiner: setupCheckbox('generate-refiner', LANG.api_refiner_enable, SETTINGS.api_refiner_enable, true, (value) => { globalThis.globalSettings.api_refiner_enable = value; globalThis.generate.refiner_dummy.setValue(value);}),
        refiner_dummy: setupCheckbox('generate-refiner-dummy', LANG.api_refiner_enable, SETTINGS.api_refiner_enable, true, (value) => { globalThis.globalSettings.api_refiner_enable = value; globalThis.generate.refiner.setValue(value);}),
        controlnet: setupCheckbox('generate-controlnet', LANG.api_controlnet_enable, SETTINGS.api_controlnet_enable, true, callback_controlnet),
        adetailer: setupCheckbox('generate-adetailer', LANG.api_adetailer_enable, SETTINGS.api_adetailer_enable, true, callback_adetailer),

        landscape: setupCheckbox('generate-landscape', LANG.api_image_landscape, SETTINGS.api_image_landscape, true, (value) =>{globalThis.globalSettings.api_image_landscape = value;}),
        tag_assist: setupCheckbox('generate-tag-assist', LANG.tag_assist, SETTINGS.tag_assist, true, (value) =>{ globalThis.globalSettings.tag_assist = value; }),
        wildcard_random: setupCheckbox('generate-wildcard-random', LANG.wildcard_random, SETTINGS.wildcard_random, true, (value) =>{ globalThis.globalSettings.wildcard_random = value; }),
        sampler: mySimpleList('generate-sampler', LANG.api_model_sampler, ['Auto'], (index, value) =>{ globalThis.globalSettings.api_model_sampler = value; }, 20, false, false),
        scheduler: mySimpleList('generate-scheduler', LANG.api_model_scheduler, ['Auto'], (index, value) =>{ globalThis.globalSettings.api_model_scheduler = value; }, 20, false, false),

        generate_single: setupButtons('generate-button-single', LANG.run_button, {
                defaultColor: 'rgb(234,88,12)',
                hoverColor: 'rgb(194,65,12)',
                disabledColor: 'rgb(136, 121, 115)',
                width: '100%',
                height: '32px',
                hidden: false,
                clickable: true              
            }, async () =>{
                await callback_generate_start('normal', {loops:1, runSame:false});
            }),
        generate_batch: setupButtons('generate-button-batch', LANG.run_random_button, {
                defaultColor: 'rgb(185,28,28)',
                hoverColor: 'rgb(153,27,27)',
                disabledColor: 'rgb(134, 103, 103)',
                width: '100%',
                height: '32px',
                hidden: false,
                clickable: true              
            }, async () =>{
                await callback_generate_start('normal', {loops:globalThis.generate.batch.getValue(), runSame:false});
            }),
        generate_same: setupButtons('generate-button-same', LANG.run_same_button, {
                defaultColor: 'rgb(20,28,46)',
                hoverColor: 'rgb(40,48,66)',
                disabledColor: 'rgb(112, 123, 148)',
                width: '100%',
                height: '32px',
                hidden: false,
                clickable: true              
            }, async () =>{
                await callback_generate_start('normal', {loops:globalThis.generate.batch.getValue(), runSame:true});
            }),            
        generate_skip: setupButtons('generate-button-skip', LANG.run_skip_button, {
                defaultColor: 'rgb(82,82,91)',
                hoverColor: 'rgb(63,63,70)',
                disabledColor: 'rgb(175, 175, 182)',
                width: '100%',
                height: '26px',
                hidden: false,
                clickable: true              
            }, () =>{
                callback_generate_skip();
            }),
        generate_cancel: setupButtons('generate-button-cancel', LANG.run_cancel_button, {
                defaultColor: 'rgb(82,82,91)',
                hoverColor: 'rgb(63,63,70)',
                disabledColor: 'rgb(175, 175, 182)',
                width: '100%',
                height: '26px',
                hidden: false,
                clickable: true              
            }, () =>{
                callback_generate_cancel();
            }),
        api_interface: mySimpleList('system-settings-api-interface', LANG.api_interface, ['None', 'ComfyUI', 'WebUI'], callback_api_interface, 5, false, true),
        api_address: setupTextbox('system-settings-api-address', LANG.api_addr, {
            value: SETTINGS.api_addr,
            maxLines: 1
            }, true, (value) => { globalThis.globalSettings.api_addr = value; }),
        api_preview_refresh_time: setupSlider('system-settings-api-refresh-rate', 
            LANG.api_preview_refresh_time, 0, 5, 1, SETTINGS.api_preview_refresh_time, 
            (value) => { globalThis.globalSettings.api_preview_refresh_time = value; }),
        
        model_filter:setupCheckbox('system-settings-api-fliter', LANG.model_filter, SETTINGS.model_filter,
            false, (value) => {
            globalThis.globalSettings.model_filter = value;
        }),
        model_filter_keyword:setupTextbox('system-settings-api-fliter-list', LANG.model_filter_keyword, {
            value: SETTINGS.model_filter_keyword,
            maxLines: 1
            }, true, (value) => {
            globalThis.globalSettings.model_filter_keyword = value;
        }),
        search_modelinsubfolder:setupCheckbox('system-settings-api-subfolder', LANG.search_modelinsubfolder, SETTINGS.search_modelinsubfolder,
            false, (value) => {
            globalThis.globalSettings.search_modelinsubfolder = value;
        }),

        model_path_comfyui:setupTextbox('system-settings-api-comfyui', LANG.model_path_comfyui, {
            value: SETTINGS.model_path_comfyui,
            maxLines: 1
            }, true, (value) => { globalThis.globalSettings.model_path_comfyui = value; }),
        model_path_webui:setupTextbox('system-settings-api-webui', LANG.model_path_webui, {
            value: SETTINGS.model_path_webui,
            maxLines: 1
            }, true, (value) => {
                globalThis.globalSettings.model_path_webui = value;
        }),
        webui_auth: setupTextbox('system-settings-api-webui-auth', 'API Key', {
            value: SETTINGS.remote_ai_webui_auth,
            defaultTextColor: 'MediumAquaMarine',
            maxLines: 1
            }, true, (value) => { globalThis.globalSettings.remote_ai_webui_auth = value;}, true),  
        webui_auth_enable: mySimpleList('system-settings-api-webui-auth-enable', LANG.remote_ai_webui_auth_enable, ['OFF', 'ON'], 
            (value) => {globalThis.globalSettings.remote_ai_webui_auth_enable = value; }, 5, false, true),
        
        queueAutostart:setupCheckbox('queue-autostart-generate', LANG.generate_auto_start, SETTINGS.generate_auto_start,
            true, async (value) => {
                await callback_queue_autostart(value, false);
        }),
        queueAutostart_dummy:setupCheckbox('queue-autostart-generate-dummy', LANG.generate_auto_start, SETTINGS.generate_auto_start,
            true, async (value) => {
                await callback_queue_autostart(value, true);
        }),
    };
}

export async function createPrompt(SETTINGS, FILES, LANG) {
    console.log('Creating globalThis.prompt');
    globalThis.prompt = {
        common: setupTextbox('prompt-common', LANG.custom_prompt, {
            value: SETTINGS.custom_prompt,
            defaultTextColor: 'darkorange',
            maxLines: 5                
            }, false, (value) => { globalThis.globalSettings.custom_prompt = value; }),
        positive: setupTextbox('prompt-positive', LANG.api_prompt, {
            value: SETTINGS.api_prompt,
            defaultTextColor: 'LawnGreen',
            maxLines: 5
            }, false, (value) => { globalThis.globalSettings.api_prompt = value; }),
        positive_right: setupTextbox('prompt-positive-right', LANG.api_prompt, {    //Regional Condition
            value: SETTINGS.api_prompt_right,
            defaultTextColor: 'LawnGreen',
            maxLines: 5
            }, false, (value) => { globalThis.globalSettings.api_prompt_right = value; }),
        negative: setupTextbox('prompt-negative', LANG.api_neg_prompt, {
            value: SETTINGS.api_neg_prompt,
            defaultTextColor: 'Crimson',
            maxLines: 5
            }, false, (value) => { globalThis.globalSettings.api_neg_prompt = value; }),
        ai: setupTextbox('prompt-ai', LANG.ai_prompt, {
            value: SETTINGS.ai_prompt,
            defaultTextColor: 'hotpink',
            maxLines: 5
            }, false, (value) => { globalThis.globalSettings.ai_prompt = value; }),
        exclude: setupTextbox('prompt-exclude', LANG.prompt_ban, {
            value: SETTINGS.prompt_ban,
            defaultTextColor: 'khaki',
            maxLines: 5
            }, false, (value) => { globalThis.globalSettings.prompt_ban = value; })
    }
    console.log('Creating setupSuggestionSystem');
    setupSuggestionSystem();
}

export async function createHifixRefiner(SETTINGS, FILES, LANG) {
    console.log('Creating globalThis.hifix');
    globalThis.hifix = {
        model: mySimpleList('hires-fix-model', LANG.api_hf_upscaler_selected, globalThis.cachedFiles.upscalerList,
            (vindex, value) => { globalThis.globalSettings.api_hf_upscaler_selected = value; }, 10, true, true),
        colorTransfer: mySimpleList('hires-fix-color-transfer', LANG.api_hf_colortransfer, ['None', 'Mean', 'Lab']
            , (index, value) => { globalThis.globalSettings.api_hf_colortransfer = value; }, 3, false, true),
        randomSeed: setupCheckbox('hires-fix-random-seed',LANG.api_hf_random_seed, SETTINGS.api_hf_random_seed, true, 
            (value) => { globalThis.globalSettings.api_hf_random_seed = value; }),
        scale: setupSlider('hires-fix-scale', LANG.api_hf_scale, 1, 2, 0.1, SETTINGS.api_hf_scale, 
            (value) => { globalThis.globalSettings.api_hf_scale = value; }),
        denoise: setupSlider('hires-fix-denoise', LANG.api_hf_denoise, 0.1, 1, 0.01, SETTINGS.api_hf_denoise, 
            (value) => { globalThis.globalSettings.api_hf_denoise = value; }),
        steps: setupSlider('hires-fix-steps', LANG.api_hf_steps, 1, 100, 1, SETTINGS.api_hf_steps,
            (value) => { globalThis.globalSettings.api_hf_steps = value; })
    }

    console.log('Creating globalThis.refiner');
    globalThis.refiner = {
        model: mySimpleList('refiner-model', LANG.api_refiner_model, FILES.modelListAll, 
            (index, value) => { globalThis.globalSettings.api_refiner_model = value; }, 15, true, true),
        vpred: mySimpleList('refiner-vpred', LANG.vpred, [LANG.vpred_auto, LANG.vpred_on, LANG.vpred_off], 
            (index, value) => { globalThis.globalSettings.api_refiner_model_vpred = value; }, 5, false, false),
        addnoise: setupCheckbox('refiner-addnoise', LANG.api_refiner_add_noise, SETTINGS.api_refiner_add_noise, true,
            (value) => { globalThis.globalSettings.api_refiner_add_noise = value; }),
        ratio: setupSlider('refiner-ratio', LANG.api_refiner_ratio, 0.1, 1, 0.1, SETTINGS.api_refiner_ratio,
            (value) => { globalThis.globalSettings.api_refiner_ratio = value; })
    }
}

export async function createRegional(SETTINGS, FILES, LANG) {
    console.log('Creating globalThis.regional');
    globalThis.regional = {
        swap: setupCheckbox('regional-condition-swap', LANG.regional_swap, SETTINGS.regional_swap, true,
            (value) => { globalThis.globalSettings.regional_swap = value; }),
        overlap_ratio: setupSlider('regional-condition-overlap-ratio', LANG.regional_overlap_ratio, 0, 200, 10, SETTINGS.regional_overlap_ratio,
            (value) => { globalThis.globalSettings.regional_overlap_ratio = value; }),
        image_ratio: setupSlider('regional-condition-image-ratio', LANG.regional_image_ratio, 10, 90, 5, SETTINGS.regional_image_ratio,
            (value) => { globalThis.globalSettings.regional_image_ratio = value; }),
        str_left: setupSlider('regional-condition-strength-left', LANG.regional_str_left, 0, 10, 0.1, SETTINGS.regional_str_left,
            (value) => { globalThis.globalSettings.regional_str_left = value; }),
        str_right: setupSlider('regional-condition-strength-right', LANG.regional_str_right, 0, 10, 0.1, SETTINGS.regional_str_right,
            (value) => { globalThis.globalSettings.regional_str_right = value; }),
        option_left: mySimpleList('regional-condition-option-left', LANG.regional_option_left, ['default', 'mask bounds'],
            (index, value) => { globalThis.globalSettings.regional_option_left = value; }, 5, false, true),
        option_right: mySimpleList('regional-condition-option-right', LANG.regional_option_right, ['default', 'mask bounds'],
            (index, value) => { globalThis.globalSettings.regional_option_right = value; }, 5, false, true)
    }
}

export async function createAI(SETTINGS, FILES, LANG) {
    console.log('Creating globalThis.ai');
    globalThis.ai ={
        ai_select: setupRadiobox("system-settings-ai-select", LANG.batch_generate_rule, LANG.ai_select, LANG.ai_select_title, SETTINGS.ai_prompt_role, 
            (value) => { globalThis.globalSettings.ai_prompt_role = value; }),
        ai_prompt_preview: setupCheckbox('system-settings-ai-preview', LANG.ai_prompt_preview, SETTINGS.ai_prompt_preview, true,
            (value) => { globalThis.globalSettings.ai_prompt_preview = value; }),
            
        interface: mySimpleList('system-settings-ai-interface', LANG.ai_interface, ['None', 'Remote', 'Local'], 
            (index, value) => {globalThis.globalSettings.ai_interface = value;}, 5, false, true),
        remote_timeout: setupSlider('system-settings-ai-timeout', LANG.remote_ai_timeout, 2, 60, 1, SETTINGS.remote_ai_timeout, 
            (value) => { globalThis.globalSettings.remote_ai_timeout = value; }),
        remote_address: setupTextbox('system-settings-ai-address', LANG.remote_ai_base_url, {
            value: SETTINGS.remote_ai_base_url,
            maxLines: 1
            }, true, (value) => { globalThis.globalSettings.remote_ai_base_url = value; }),
        remote_model_select: setupTextbox('system-settings-ai-modelselect', LANG.remote_ai_model, {
            value: SETTINGS.remote_ai_model,
            maxLines: 1
            }, true, (value) => { globalThis.globalSettings.remote_ai_model = value; }),
        remote_apikey: setupTextbox('system-settings-ai-apikey', 'API Key', {
            value: SETTINGS.remote_ai_api_key,
            defaultTextColor: 'CornflowerBlue',
            maxLines: 1
            }, true, (value) => { globalThis.globalSettings.remote_ai_api_key = value;}, true),  

        local_address: setupTextbox('system-settings-ai-local-address', LANG.ai_local_addr, {
            value: SETTINGS.ai_local_addr,
            maxLines: 1
            }, true, (value) => { globalThis.globalSettings.ai_local_addr = value;}),
        local_temp: setupSlider('system-settings-ai-local-temperature', 
            LANG.ai_local_temp, 0.1, 2, 0.1, SETTINGS.ai_local_temp,
            (value) => { globalThis.globalSettings.ai_local_temp = value;} ),
        local_n_predict: setupSlider('system-settings-ai-local-npredict', 
            LANG.ai_local_n_predict, 256, 4096, 256, SETTINGS.ai_local_n_predict,
            (value) => { globalThis.globalSettings.ai_local_n_predict = value;} ),

        ai_system_prompt: setupTextbox('system-settings-ai-sysprompt', LANG.ai_system_prompt_text, {
            value: LANG.ai_system_prompt,
            maxLines: 30
            }, true),  
    }
}

async function init() {    
    globalThis.initialized = false;
    globalThis.inBrowser = true; // Set to true for browser environment    
    globalThis.custom_message = {
        controlnet: false,
        adetailer: false,
        a1111_regional: false
    };

    // Init Global Settings
    try {
        globalThis.globalSettings = await sendWebSocketMessage({ type: 'API', method: 'getGlobalSettings' });
        console.log('Global settings loaded:', globalThis.globalSettings);    
    } catch (error) {
        console.error('Failed to load global settings:', error);
        return;
    }

    if(globalThis.globalSettings.setup_wizard) {
        console.error('Run setup wizard at SAA first');
        while(true) {
            await showDialog('info', { 
                message: 'Run setup wizard at SAA first\n请先在SAA运行设置向导',
                buttonText: 'OK'
            }); 

            globalThis.globalSettings = await sendWebSocketMessage({ type: 'API', method: 'getGlobalSettings' });
            if(!globalThis.globalSettings.setup_wizard) {
                break;
            }
        }       
    }
    
    try {
        // Setup main func
        globalThis.mainGallery = {};
        globalThis.thumbGallery = {};        

        // Loading files
        const cachedFiles = await sendWebSocketMessage({ type: 'API', method: 'getCachedFiles'});
        console.log('Cached files loaded:', cachedFiles);
        globalThis.cachedFiles = {
            language: cachedFiles.languages,
            //characterThumb: cachedFiles.characterThumb,
            characterList: cachedFiles.characters,
            ocList: cachedFiles.ocCharacters,
            viewTags: cachedFiles.viewTags,
            tagAssist: cachedFiles.tagAssist,            
            settingList: await sendWebSocketMessage({ type: 'API', method: 'getSettingFiles'}),
            loadingWait:`data:image/webp;base64,${cachedFiles.loadingWait.data}`,
            loadingFailed:`data:image/webp;base64,${cachedFiles.loadingFailed.data}`,
            privacyBall:`data:image/webp;base64,${cachedFiles.privacyBall.data}`
        };       
        
        const SETTINGS = globalThis.globalSettings;
        const FILES = globalThis.cachedFiles;
        const LANG = FILES.language[SETTINGS.language];

        globalThis.cachedFiles.modelList = await sendWebSocketMessage({ type: 'API', method: 'getModelList', params: [SETTINGS.api_interface] });
        globalThis.cachedFiles.modelListAll = await sendWebSocketMessage({ type: 'API', method: 'getModelListAll', params: [SETTINGS.api_interface] });
        globalThis.cachedFiles.vaeList = await sendWebSocketMessage({ type: 'API', method: 'getVAEList', params: [SETTINGS.api_interface] });
        globalThis.cachedFiles.diffusionList = await sendWebSocketMessage({ type: 'API', method: 'getDiffusionModelList', params: [SETTINGS.api_interface] });
        globalThis.cachedFiles.textEncoderList = await sendWebSocketMessage({ type: 'API', method: 'getTextEncoderList', params: [SETTINGS.api_interface] });

        globalThis.cachedFiles.loraList = await sendWebSocketMessage({ type: 'API', method: 'getLoRAList', params: [SETTINGS.api_interface] });
        globalThis.cachedFiles.controlnetList = await sendWebSocketMessage({ type: 'API', method: 'getControlNetList', params: [SETTINGS.api_interface] });
        globalThis.cachedFiles.controlnetProcessorListWebUI = await sendWebSocketMessage({ type: 'API', method: 'getControlNetProcessorListWebUI'});
        globalThis.cachedFiles.upscalerList = await sendWebSocketMessage({ type: 'API', method: 'getUpscalerList', params: [SETTINGS.api_interface] });
        globalThis.cachedFiles.aDetailerList = await sendWebSocketMessage({ type: 'API', method: 'getADetailerList', params: [SETTINGS.api_interface] });
        globalThis.cachedFiles.ONNXList = await sendWebSocketMessage({ type: 'API', method: 'getONNXList', params: [SETTINGS.api_interface] });

        globalThis.cachedFiles.characterListArray = Object.entries(FILES.characterList);
        globalThis.cachedFiles.ocListArray = Object.entries(FILES.ocList);
        globalThis.cachedFiles.imageTaggerModels = await sendWebSocketMessage({ type: 'API', method: 'getImageTaggerModels' });

        globalThis.cachedFiles.miraITUSettings = await sendWebSocketMessage({ type: 'API', method: 'updateMiraITUSettingFiles' });

        // Init Header
        await setupHeader(SETTINGS, FILES, LANG);

        // Init Left & Right
        await setupLeftRight(SETTINGS, FILES, LANG);

        // Functions
        await createGenerate(SETTINGS, FILES, LANG);
        await createPrompt(SETTINGS, FILES, LANG);
        await createHifixRefiner(SETTINGS, FILES, LANG);
        await createRegional(SETTINGS, FILES, LANG);
        await createAI(SETTINGS, FILES, LANG);

        // LoRA
        globalThis.lora = setupLoRA('add-lora-main');
                
        // Control Net
        globalThis.controlnet = setupControlNet('controlnet-main');

        // Custom JSON
        globalThis.jsonlist = setupJsonSlot('jsonlist-main');

        // aDetailer
        globalThis.aDetailer = setupADetailer('adetailer-main');

        // Queue management
        globalThis.queueManager = setupQueue('queue-main');
        
        // Setup Overlay
        globalThis.overlay = {
            buttons: setupButtonOverlay(),
            custom: customCommonOverlay()
        }

        globalThis.generate.toggleButtons = toggleButtons;
        globalThis.generate.showCancelButtons = showCancelButtons;
        globalThis.generate.queueColor1st = false;
        globalThis.generate.lastPos = '';
        globalThis.generate.lastPosColored = '';
        globalThis.generate.lastPosR = '';
        globalThis.generate.lastPosRColored = '';
        globalThis.generate.lastNeg = '';
        globalThis.generate.lastCharacter = '';
        globalThis.generate.lastThumb = [];

        // Right Click Menu
        // globalThis.rightClick
        setupRightClickMenu();

        // Done
        globalThis.initialized = true;        
        
        doSwap(globalThis.globalSettings.rightToleft);   //default is right to left        
        updateLanguage(false, globalThis.inBrowser); 
        updateSettings();
        globalThis.globalSettings.lastLoadedSettings = 'settings';
    } catch (error) {
        console.error('Error during initialization:', error);
    }
}

// Run the init function when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    afterDOMinit();        
});
