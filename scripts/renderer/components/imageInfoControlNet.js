import { sendWebSocketMessage } from '../../../webserver/front/wsRequest.js';
import { generateControlnetImage, fileToBase64 } from '../generate.js';
import { getControlNetListWithProcessorList } from "../slots/myControlNetSlot.js";
import { resizeImageToControlNetResolution, arrayBufferToBase64 } from './imageInfoUtils.js';

function createHtmlOptions(itemList) {
    let options = [];
    if (globalThis.globalSettings.api_interface === 'ComfyUI') {
        for (const item of itemList) {
            if (String(item).startsWith('CV->')) 
                continue;
            options.push(`<option value="${item}">${item}</option>`);
        }
    } else {
        // 'WebUI'
        for (const item of itemList) {
            options.push(`<option value="${item}">${item}</option>`);
        }
    }
    return options.join();
}

export function createControlNetButtons(apiInterface, cachedImage, previewImg) {
    const SETTINGS = globalThis.globalSettings;
    const FILES = globalThis.cachedFiles;
    const LANG = FILES.language[SETTINGS.language];

    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'controlnet-buttons';

    const controlNetSelect = document.createElement('select');
    controlNetSelect.className = 'controlnet-select';
    controlNetSelect.innerHTML = createHtmlOptions(getControlNetListWithProcessorList());

    const controlNetResolution = document.createElement('select');
    controlNetResolution.className = 'controlnet-select';
    controlNetResolution.innerHTML = createHtmlOptions([512,640,768,1024,1280,1536,2048]);

    const controlNetPostSelect = document.createElement('select');
    controlNetPostSelect.className = 'controlnet-select';
    controlNetPostSelect.innerHTML = createHtmlOptions(globalThis.cachedFiles.controlnetList);
    
    const postProcessButton = document.createElement('button');
    postProcessButton.className = 'controlnet-postprocess';
    postProcessButton.textContent = LANG.image_info_add_controlnet;

    function setProcessingState() {
        postProcessButton.textContent = LANG.image_info_add_controlnet_processing;
        postProcessButton.style.cursor = 'not-allowed';
        postProcessButton.disabled = true;
    }

    function setNormalState() {
        postProcessButton.textContent = LANG.image_info_add_controlnet;
        postProcessButton.style.cursor = 'pointer';
        postProcessButton.disabled = false;
    }

    async function handleGeneratedControlNet(preImageBase64) {
        const {preImage, preImageAfter, preImageAfterBase64} =
            await generateControlnetImage(
                cachedImage, controlNetSelect.value, controlNetResolution.value,
                apiInterface !== 'ComfyUI'); // WebUI skip gzip
        
        const postMode = (globalThis.globalSettings.api_interface === 'ComfyUI')?"Post":"On";
        if (preImageAfterBase64?.startsWith('data:image/png;base64,')) {
            const slotValues = [[
                controlNetSelect.value,          // preProcessModel
                controlNetResolution.value,      // preProcessResolution
                postMode,                        // slot_enable
                controlNetPostSelect.value,      // postModel
                0.6,                             // postProcessStrength
                0,                               // postProcessStart
                0.5,                             // postProcessEnd
                preImage,                        // pre_image
                preImageAfter,                   // pre_image_after
                preImageBase64,                  // pre_image_base64
                preImageAfterBase64,             // pre_image_after_base64
            ]];
            globalThis.controlnet.AddControlNetSlot(slotValues);

            previewImg.src = preImageAfterBase64;
            setTimeout(() => {
                postProcessButton.textContent = LANG.image_info_add_controlnet_added;
                globalThis.collapsedTabs.controlnet.setCollapsed(false);
            }, 200);
        } else {
            postProcessButton.textContent = LANG.image_info_add_controlnet_failed;
            setTimeout(() => {
                setNormalState();
            }, 5000);
        }
    }

    async function handleDirectControlNet(preImageBase64) {
        async function compressForComfy(buffer) {
            if (globalThis.inBrowser) {
                const base64String = arrayBufferToBase64(buffer);
                return await sendWebSocketMessage({ type: 'API', method: 'compressGzip', params: [base64String.replace('data:image/png;base64,', '')] });
            } else {                    
                return await globalThis.api.compressGzip(buffer);
            }
        }

        let buffer = await cachedImage.arrayBuffer();
        let preImageGzipped = buffer;
        let refImage = null;
        let aftImageB64 = null;
        const onTrigger = controlNetSelect.value.startsWith('ip-adapter');
        if (onTrigger) {
            refImage = `data:image/png;base64,${arrayBufferToBase64(buffer)}`;                
            const afterBuffer = await resizeImageToControlNetResolution(buffer, controlNetResolution.value, false, apiInterface === 'ComfyUI');   // not sure A1111 requires a square image or not
            aftImageB64 = `data:image/png;base64,${arrayBufferToBase64(afterBuffer)}`;
            preImageGzipped = afterBuffer;
        }

        if (apiInterface === 'ComfyUI') {
            preImageGzipped = await compressForComfy(preImageGzipped);
        } else { 
            // WebUI
            preImageGzipped = arrayBufferToBase64(preImageGzipped);
        }

        const postMode = (globalThis.globalSettings.api_interface === 'ComfyUI')?"Post":"On";
        const slotValues = [[
            controlNetSelect.value,          // preProcessModel
            controlNetResolution.value,      // preProcessResolution
            onTrigger ? 'On' : postMode,     // slot_enable
            controlNetPostSelect.value,      // postModel
            0.8,                             // postProcessStrength
            0,                               // postProcessStart
            0.8,                             // postProcessEnd
            onTrigger ? preImageGzipped : null,        // pre_image
            onTrigger ? null : preImageGzipped,        // pre_image_after
            refImage,                                  // pre_image_base64
            onTrigger ? aftImageB64 : preImageBase64,  // pre_image_after_base64 
        ]];
        globalThis.controlnet.AddControlNetSlot(slotValues);

        setTimeout(() => {
            postProcessButton.textContent = LANG.image_info_add_controlnet_added;
            globalThis.collapsedTabs.controlnet.setCollapsed(false);
        }, 200);
    }

    postProcessButton.addEventListener('click', async (e) => {
        if (postProcessButton.disabled) return;

        const modelType = globalThis.dropdownList.model_type.getValue();
        if (modelType !== 'Checkpoint') {
            console.warn('ControlNet is only supported for SDXL/SD15 models.');
            return;
        }

        setProcessingState();

        try {
            const preImageBase64 = await fileToBase64(cachedImage);

            // None for Forge doesn't support direct
            if (controlNetSelect.value !== 'none' && !controlNetSelect.value.startsWith('ip-adapter')) {
                await handleGeneratedControlNet(preImageBase64);
            } else {
                await handleDirectControlNet(preImageBase64);
            }
        } catch (err) {
            console.error('Post process error:', err);
            postProcessButton.textContent = LANG.image_info_add_controlnet_failed;
            setTimeout(() => {
                setNormalState();
            }, 2000);
        } finally {
            // if the button shows "added" keep that briefly, otherwise reset immediately
            if (postProcessButton.textContent.includes(LANG.image_info_add_controlnet_added)) {
                setTimeout(() => setNormalState(), 2000);
            } else {
                setNormalState();
            }
        }
    });

    buttonContainer.appendChild(controlNetSelect);
    buttonContainer.appendChild(controlNetResolution);
    buttonContainer.appendChild(controlNetPostSelect);        
    buttonContainer.appendChild(postProcessButton);
    return buttonContainer;
}

