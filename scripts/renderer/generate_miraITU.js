import { sendWebSocketMessage } from '../../webserver/front/wsRequest.js';
import { extractHostPort, extractAPISecure, toggleQueueColor, generateRandomSeed, startQueue, checkVpred } from './generate.js';
import { resizeImageToControlNetResolution } from './components/imageInfoUtils.js';

export async function generateMiraITU(dataPack){
    const {imageData, taggerOptions} = dataPack;

    const SETTINGS = globalThis.globalSettings;
    const FILES = globalThis.cachedFiles;
    const LANG = FILES.language[SETTINGS.language];
    
    let imageGzipped;
    const buffer = await imageData.arrayBuffer();
    const uint8Array = new Uint8Array(buffer);
    if (globalThis.inBrowser) {
        imageGzipped = await sendWebSocketMessage({ type: 'API', method: 'compressGzip', params: [Array.from(uint8Array)] });
    } else {
        imageGzipped = await globalThis.api.compressGzip(uint8Array);
    }

    let browserUUID = 'none';
    if(globalThis.inBrowser) {
        browserUUID = globalThis.clientUUID;
    }            
    let seed = globalThis.generate.seed.getValue();
    if (seed === -1){
        seed = generateRandomSeed();
    }
    const apiInterface = globalThis.generate.api_interface.getValue();

    toggleQueueColor();
    if(!globalThis.mainGallery.isLoading && !globalThis.globalSettings.generate_auto_start && !globalThis.inGenerating) {
        globalThis.generate.showCancelButtons(true);
        globalThis.mainGallery.showLoading(LANG.overlay_title, LANG.overlay_te, LANG.overlay_sec);
    }

    const generateData = {
        addr: extractHostPort(globalThis.generate.api_address.getValue()),
        auth: extractAPISecure(apiInterface),
        uuid: browserUUID,

        queueManager : {
            genType:'miraITU',
            apiInterface:apiInterface,
        },

        model: taggerOptions.sdxlModels,
        vpred: checkVpred(),
        seed:seed,
        exclude:globalThis.prompt.exclude.getValue(),

        refresh:globalThis.generate.api_preview_refresh_time.getValue(),

        imageData: imageGzipped,
        taggerOptions: taggerOptions,

        preview: await resizeImageToControlNetResolution(buffer, 256, true, false)
    };

    const ogResolution = `${generateData.taggerOptions.imageWidth}x${generateData.taggerOptions.imageHeight}`;
    const tgtResolution = `${generateData.taggerOptions.imageWidth*generateData.taggerOptions.upscaleRatio}x${generateData.taggerOptions.imageHeight*generateData.taggerOptions.upscaleRatio}`;
    const bannerInfo = [`MiraITU: ${generateData.seed} |  ${ogResolution} -> ${tgtResolution}`, `${generateData.seed} |  ${ogResolution} -> ${tgtResolution}`];    
    globalThis.queueManager.attach(bannerInfo, generateData);

    globalThis.generate.generate_single.setClickable(true);
    globalThis.generate.generate_batch.setClickable(true);
    globalThis.generate.generate_same.setClickable(true);    

    if(globalThis.globalSettings.generate_auto_start) {        
        await startQueue();        
    } else {
        globalThis.mainGallery.hideLoading('success', '');
    }
}

export async function startGenerateMiraITU(apiInterface, generateData){
    let ret = 'success';
    let retCopy = '';
    let breakNow = false;

    if(apiInterface === 'ComfyUI') {
        const result = await runComfyUI(apiInterface, generateData);
        ret = result.ret;
        retCopy = result.retCopy;
        breakNow = result.breakNow
    } else if(apiInterface === 'WebUI') {
        ret = 'Error: Not ComfyUI';
        retCopy = 'Error: Not ComfyUI';
        breakNow = true;
    } else if(apiInterface === 'None') {
        console.warn('apiInterface', apiInterface);
    }

    return {ret, retCopy, breakNow}
}

// eslint-disable-next-line sonarjs/cognitive-complexity
async function runComfyUI(apiInterface, generateData){
    function sendToGallery(image, generateData){
        if(!image)  // same prompts from backend will return null
            return;

        if(!keepGallery)
            globalThis.mainGallery.clearGallery();

        const ogResolution = `${generateData.taggerOptions.imageWidth}x${generateData.taggerOptions.imageHeight}`;
        const tgtResolution = `${generateData.taggerOptions.imageWidth*generateData.taggerOptions.upscaleRatio}x${generateData.taggerOptions.imageHeight*generateData.taggerOptions.upscaleRatio}`;
        const tag = `by MiraITU: ${generateData.seed}\n${ogResolution} -> ${tgtResolution}\n`;
        globalThis.mainGallery.appendImageData(image, `${generateData.seed}`, tag, keepGallery, globalThis.globalSettings.scroll_to_last);
    }

    const SETTINGS = globalThis.globalSettings;
    const FILES = globalThis.cachedFiles;
    const LANG = FILES.language[SETTINGS.language];

    globalThis.generate.nowAPI = apiInterface;
    const keepGallery = globalThis.generate.keepGallery.getValue();
    let ret = 'success';
    let retCopy = '';
    let breakNow = false;

    try {
        let result;
        if (globalThis.inBrowser) {
            result = await sendWebSocketMessage({ type: 'API', method: 'runComfyUI_MiraITU', params: [generateData] });
        } else {
            result = await globalThis.api.runComfyUI_MiraITU(generateData);
        }

        if(result.startsWith('Error')){
            ret = LANG.gr_error_creating_image.replace('{0}',result).replace('{1}', apiInterface);
            retCopy = result;
            breakNow = true;
        } else {
            const parsedResult = JSON.parse(result);            
            if (parsedResult.prompt_id) {
                try {
                    let image;
                    if (globalThis.inBrowser) {
                        image = await sendWebSocketMessage({ type: 'API', method: 'openWsComfyUI', params: [parsedResult.prompt_id, true, '14'] });
                    } else {
                        image = await globalThis.api.openWsComfyUI(parsedResult.prompt_id, true, '14');
                    }

                    if (globalThis.generate.cancelClicked) {
                        breakNow = true;
                    } else if(image.startsWith('Error')) {
                        if(image.endsWith('Cancelled')) {
                            console.log('Generate cancelled from queue manager');
                        } else {
                            ret = LANG.gr_error_creating_image.replace('{0}',image).replace('{1}', apiInterface);
                            retCopy = image;
                            breakNow = true;
                        }
                    } else {
                        sendToGallery(image, generateData);
                    }
                } catch (error){
                    ret = LANG.gr_error_creating_image.replace('{0}',error.message).replace('{1}', apiInterface);
                    retCopy = error.message;
                    breakNow = true;
                } finally {
                    if (globalThis.inBrowser) {
                        sendWebSocketMessage({ type: 'API', method: 'closeWsComfyUI' });
                    } else {
                        globalThis.api.closeWsComfyUI();
                    }
                }                
            } else {
                ret = parsedResult;
                retCopy = result;
                breakNow = true;
            }
        }
    } catch (error) {
        ret = LANG.gr_error_creating_image.replace('{0}',error.message).replace('{1}', apiInterface)
        retCopy = error.message;
        breakNow = true;
    }

    return {ret, retCopy, breakNow }
}
