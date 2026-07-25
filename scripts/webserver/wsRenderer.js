import { updateLanguage, updateSettings } from '../renderer/language.js'
import { setupButtonOverlay, customCommonOverlay } from '../renderer/customOverlay.js';
import { toggleButtons, showCancelButtons } from '../renderer/components/myButtons.js';
import { doSwap } from '../renderer/components/myCollapsed.js';
import { from_main_updateGallery, from_main_updatePreview, from_main_customOverlayProgress } from '../renderer/generate_backend.js';
import { setupLoRA } from '../renderer/slots/myLoRASlot.js';
import { setupControlNet } from '../renderer/slots/myControlNetSlot.js';
import { setupJsonSlot } from '../renderer/slots/myJsonSlot.js';
import { setupADetailer } from '../renderer/slots/myADetailerSlot.js';
import { setupQueue } from '../renderer/slots/myQueueSlot.js';
import { setBlur, setNormal, showDialog } from '../renderer/components/myDialog.js';
import { setupRightClickMenu } from '../renderer/components/myRightClickMenu.js';
import { initWebSocket, isSecuredConnection, sendWebSocketMessage, registerCallback } from './front/wsRequest.js';
import { flushSlots } from '../renderer/slots/slotsManager.js';
import { set_prompt_textBox_Heights } from '../renderer/components/componentsManager.js';
import { setupHeader, setupLeftRight, createGenerate, createPrompt, createHifixRefiner, createRegional, createAI } from '../renderer.js';

// Run the init function when the DOM is fully loaded
function afterDOMinit() {    
    (async () => {
        console.log("Script loaded, attempting initial setup");
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

        // Update language and settings
        updateLanguage(true, globalThis.inBrowser); 
        updateSettings();
        
        // reLoad slots stuff: LoRA, aDetailer
        flushSlots();

        // set prompt textBox heights
        set_prompt_textBox_Heights();

        globalThis.globalSettings.lastLoadedSettings = `settings`;
    } catch (error) {
        console.error('Error during initialization:', error);
    }
}

// Run the init function when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    afterDOMinit();        
});
