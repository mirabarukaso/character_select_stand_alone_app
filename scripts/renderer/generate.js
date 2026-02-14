import { decodeThumb } from './customThumbGallery.js';
import { getAiPrompt } from './remoteAI.js';
import { from_renderer_generate_updatePreview } from './generate_backend.js';
import { seartGenerateRegional } from './generate_regional.js';
import { startGenerateMiraITU } from './generate_miraITU.js';
import { sendWebSocketMessage } from '../../webserver/front/wsRequest.js';
import { setADetailerModelList } from './slots/myADetailerSlot.js';
import { processRandomString } from './tools/nestedBraceParsing.js';
import { convertToMultipleOfNFloor, checkNumberInRange } from './tools/numbers.js';
import { setQueueAutoStart } from './callbacks.js';
import { filterPrompts } from './tools/promptFilter.js';

export const REPLACE_AI_MARK = '_|REPLACE_AI_PROMPT|_';

export function toggleQueueColor() {
    globalThis.generate.queueColor1st = !globalThis.generate.queueColor1st;
}

export function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        if (typeof file === 'string') {
            resolve(file);
            return;
        }
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

export function extractHostPort(input) {
    input = input.trim();

    try {
        const urlInput = input.match(/^[a-zA-Z]+:\/\//) ? input : `http://${input}`;
        const url = new URL(urlInput);
        return url.host;
    } catch (e) {
        const hostPortRegex = /^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):(\d{1,5})$/;
        if (hostPortRegex.test(input)) {
            return input;
        }
        const ret = `Invalid input: Expected a URL or host:port format (e.g., 'http://127.0.0.1:58189/' or '127.0.0.1:58188')\n${e}`;
        console.error();        
        globalThis.generate.cancelClicked = true;
        globalThis.mainGallery.hideLoading(ret, ret);
    }

    return '127.0.0.1:58188';   // fail safe
}

export function extractAPISecure(apiInterface) {
    if(apiInterface === 'WebUI') {
        const webui_auth = globalThis.generate.webui_auth.getValue();
        const webui_auth_enable = globalThis.generate.webui_auth_enable.getValue();

        if (webui_auth_enable === 'ON' && webui_auth.includes(':')) {
            return webui_auth.trim();
        }
    }

    return '';
}

export function generateRandomSeed() {
    return Math.floor(Math.random() * 4294967296); // 4294967296 = 2^32
}

function createViewTag(view_list, in_tag, seed, weight) {
    let out_tag = '';

    if (in_tag.toLowerCase() === 'random') {
        if (!globalThis.cachedFiles.viewTags[view_list]) {
            console.error( `[createViewTag] Invalid view_list: ${view_list}`);
            return '';
        }
        const tags = globalThis.cachedFiles.viewTags[view_list];
        const index = seed % tags.length;
        const selectedIndex = (index === 0 || index === 1) ? 2 : index;
        out_tag = `${tags[selectedIndex].toLowerCase()}`;
    } else if (in_tag.toLowerCase() === 'none') {
        return '';
    } else {
        out_tag = `${in_tag.toLowerCase()}`;
    }

    out_tag = out_tag.trim().replaceAll('\\', '\\\\').replaceAll('(', String.raw`\(`).replaceAll(')', String.raw`\)`);
    if(out_tag !== '' && weight !== 1) {
        out_tag = `(${out_tag}:${weight})`;
    }
    return out_tag;
}

export function getViewTags(seed) {
    const tag_angle = createViewTag('angle', globalThis.viewList.getValue()[0], seed, globalThis.viewList.getTextValue(0));
    const tag_camera = createViewTag('camera', globalThis.viewList.getValue()[1], seed, globalThis.viewList.getTextValue(1));
    const tag_background = createViewTag('background', globalThis.viewList.getValue()[2], seed, globalThis.viewList.getTextValue(2));
    const tag_style = createViewTag('style', globalThis.viewList.getValue()[3], seed, globalThis.viewList.getTextValue(3));

    let combo = '';
    if(tag_angle !== '') 
        combo += `${tag_angle}, `;

    if(tag_camera !== '') 
        combo += `${tag_camera}, `;

    if(tag_background !== '') 
        combo += `${tag_background}, `;

    if(tag_style !== '') 
        combo += `${tag_style}, `;

    return combo;
}

async function createCharacters(index, seeds) {
    const FILES = globalThis.cachedFiles;
    const character = globalThis.characterList.getKey()[index];
    const isValueOnly = globalThis.characterList.isValueOnly();
    const seed = seeds[index];

    if (character.toLowerCase() === 'none') {
        return { tag: '', tag_assist: '', thumb: null, info: '' };
    }

    const isOriginalCharacter = index === 3;
    const { tag, thumb, info, weight, name } = isOriginalCharacter
        ? handleOriginalCharacter(character, seed, isValueOnly, index, FILES)
        : await handleStandardCharacter(character, seed, isValueOnly, index, FILES);

    const tagAssist = getTagAssist(tag, globalThis.generate.tag_assist.getValue(), FILES, index, info);
    if (tagAssist.tas !== '')
        tagAssist.tas = `${tagAssist.tas}, `;
    return {
        tag: isOriginalCharacter ? `${tag}` : tag.replaceAll('\\', '\\\\').replaceAll('(', String.raw`\(`).replaceAll(')', String.raw`\)`),
        tag_assist: tagAssist.tas,
        thumb,
        info: tagAssist.info,
        weight: weight,
        characterName:name
    };
}

async function handleStandardCharacter(character, seed, isValueOnly, index, FILES) {
    let tag, thumb, info, name;
    if (character.toLowerCase() === 'random') {
        const selectedIndex = getRandomIndex(seed, FILES.characterListArray.length);
        tag = FILES.characterListArray[selectedIndex][1];
        thumb = await decodeThumb(FILES.characterListArray[selectedIndex][0]);
        info = formatCharacterInfo(index, isValueOnly, {
        key: FILES.characterListArray[selectedIndex][0],
        value: FILES.characterListArray[selectedIndex][1]
        });
        if(globalThis.globalSettings.language === 'en-US')
            name = FILES.characterListArray[selectedIndex][1];
        else
            name = FILES.characterListArray[selectedIndex][0];
    } else {
        tag = FILES.characterList[character];
        thumb = await decodeThumb(character);
        info = formatCharacterInfo(index, isValueOnly, {
        key: character,
        value: globalThis.characterList.getValue()[index]
        });
        if(globalThis.globalSettings.language === 'en-US')
            name = tag;
        else
            name = character;
    }
    const weight = globalThis.characterList.getTextValue(index);
    return { tag, thumb, info, weight, name };
}

function handleOriginalCharacter(character, seed, isValueOnly, index, FILES) {
    let tag, info, name;
    if (character.toLowerCase() === 'random') {
        const selectedIndex = getRandomIndex(seed, FILES.ocListArray.length);
        tag = FILES.ocListArray[selectedIndex][1];
        info = formatOriginalCharacterInfo({
        key: FILES.ocListArray[selectedIndex][0],
        value: FILES.ocListArray[selectedIndex][1]
        });
        name = FILES.ocListArray[selectedIndex][0];
    } else {
        tag = FILES.ocList[character];
        info = formatOriginalCharacterInfo({ key: character, value: tag }, isValueOnly);
        name = character;
    }
    const weight = globalThis.characterList.getTextValue(index);
    return { tag, thumb: null, info, weight, name };
}

export function getRandomIndex(seed, listLength) {
    const idx = seed % listLength;
    return idx;
}

export function formatCharacterInfo(index, isValueOnly, { key, value }) {
    const brownColor = (globalThis.globalSettings.css_style==='dark')?'BurlyWood':'Brown';
    const blueColor = (globalThis.globalSettings.css_style==='dark')?'DeepSkyBlue':'MidnightBlue';

    const comboCharacterInfo = isValueOnly
        ? `[color=${blueColor}]${value}[/color]`
        : `[color=${brownColor}]${key}[/color] [[color=${blueColor}]${value}[/color]]`;
    return `Character ${index + 1}: ${comboCharacterInfo}\n`;
}

export function formatOriginalCharacterInfo({ key, value }, isValueOnly = false) {
    const brownColor = (globalThis.globalSettings.css_style==='dark')?'BurlyWood':'Brown';
    const blueColor = (globalThis.globalSettings.css_style==='dark')?'DeepSkyBlue':'MidnightBlue';

    const comboCharacterInfo = isValueOnly
        ? `[color=${blueColor}]${value}[/color]`
        : `[color=${brownColor}]${key}[/color] [[color=${blueColor}]${value}[/color]]`;
    return `Original Character: ${comboCharacterInfo}\n`;
}

export function getTagAssist(tag, useTAS, FILES, index, characterInfo) {
    const tomatoColor = (globalThis.globalSettings.css_style==='dark')?'Tomato':'Maroon';

    let tas = '';
    let info = characterInfo;
    if (useTAS && tag in FILES.tagAssist) {
        tas = FILES.tagAssist[tag];
        info += `Tag Assist ${index + 1}: [[color=${tomatoColor}]${tas}[/color]]\n`;
    }
    return { tas, info };
}

function getCustomJSON(loop = -1) {
    let BeforeOfPrompts = '';
    let BeforeOfCharacter = '';
    let EndOfCharacter = '';
    let EndOfPrompts = '';

    const jsonSlots = globalThis.jsonlist.getValues(loop);

    for (const [prompt, strength, , method] of jsonSlots) {
        if (method === 'Off') continue;

        const trimmedPrompt = prompt.replaceAll('\\', '\\\\').replaceAll('(', String.raw`\(`).replaceAll(')', String.raw`\)`).replaceAll(':', ' ');
        let finalPrompt = Number.parseFloat(strength) === 1 ? `${trimmedPrompt}, ` : `(${trimmedPrompt}:${strength}), `;

        if (method === 'BOP') BeforeOfPrompts += finalPrompt;
        else if (method === 'BOC') BeforeOfCharacter += finalPrompt;
        else if (method === 'EOC') EndOfCharacter += finalPrompt;
        else if (method === 'EOP') EndOfPrompts += finalPrompt;
    }

    return {
        BOP: BeforeOfPrompts,
        BOC: BeforeOfCharacter,
        EOC: EndOfCharacter,
        EOP: EndOfPrompts
    };
}

// eslint-disable-next-line sonarjs/cognitive-complexity
async function getCharacters(){
    const brownColor = (globalThis.globalSettings.css_style==='dark')?'BurlyWood':'Brown';
    let random_seed = globalThis.generate.seed.getValue();
    if (random_seed === -1){
        random_seed = generateRandomSeed();
    }
    const seeds = [random_seed, Math.floor(random_seed /3), Math.floor(random_seed /7), 4294967296 - random_seed];

    let character = '';
    let information = '';
    let thumbImages = [];
    let characters = '';
    for(let index=0; index < 4; index++) {
        let {tag, tag_assist, thumb, info, weight, characterName} = await createCharacters(index, seeds);
        if(weight === 1){
            character += (tag === '')?'':`${tag}, `;
        } else {
            character += (tag === '')?'':`(${tag}:${weight}), `;            
        }
        character += tag_assist;

        if (thumb) {            
            thumbImages.push(thumb);
        }
        information += `${info}`;
        if(characterName)
            characters += (characters.length>0)?`\n${characterName}`:`${characterName}`;
    }

    information += `Seed: [[color=${brownColor}]${seeds[0]}[/color]]\n`;
    return{
        thumb: thumbImages,
        characters_tag:character,
        information: information,
        seed:random_seed,
        characters:characters
    }
}

function getPrompts(characters, views, ai='', apiInterface = 'None', loop=-1) {    
    const commonColor = (globalThis.globalSettings.css_style==='dark')?'darkorange':'Sienna';
    const viewColor = (globalThis.globalSettings.css_style==='dark')?'BurlyWood':'Brown';
    const aiColor = (globalThis.globalSettings.css_style==='dark')?'hotpink':'Purple';
    const characterColor = (globalThis.globalSettings.css_style==='dark')?'DeepSkyBlue':'MidnightBlue';
    const positiveColor = (globalThis.globalSettings.css_style==='dark')?'LawnGreen':'SeaGreen';

    let common = globalThis.prompt.common.getValue();
    let positive = globalThis.prompt.positive.getValue().trim();
    let aiPrompt = ai.trim();
    const exclude = globalThis.prompt.exclude.getValue();

    if (common !== '' && !common.endsWith(',')) {
        common += ', ';
    }

    if(aiPrompt !== '' && !aiPrompt.endsWith(','))
        aiPrompt += ', ';

    const {BOP, BOC, EOC, EOP} = getCustomJSON(loop);
    const tmpPositivePrompt = `${BOP}${common}${views}${aiPrompt}${BOC}${characters}${EOC}${positive}${EOP}`.replaceAll(/\n+/g, ''); 
    const tmpPositivePromptColored = `[color=${commonColor}]${BOP}${common}[/color][color=${viewColor}]${views}[/color][color=${aiColor}]${aiPrompt}[/color][color=${characterColor}]${BOC}${characters}${EOC}[/color][color=${positiveColor}]${positive}${EOP}[/color]`.replaceAll(/\n+/g, ''); 

    const {positivePrompt, positivePromptColored} = filterPrompts(tmpPositivePrompt, tmpPositivePromptColored, exclude);
    const loraPromot = getLoRAs(apiInterface);
    return {pos:positivePrompt, posc:positivePromptColored, lora:loraPromot}
}

export function getLoRAs(apiInterface) {
    const loraData = globalThis.lora.getValues();
    if (!Array.isArray(loraData) || loraData.length === 0 || apiInterface === 'None') {
        return '';
    }
    
    const formattedStrings = [];
    
    for (const slot of loraData) {
        if (!Array.isArray(slot) || slot.length < 4) continue;
        
        const [loraName, modelStrength, clipStrength, enableMode] = slot;
        
        // Skip if mode is "OFF"
        if (enableMode === 'OFF') {
            continue;
        }  
        
        if(apiInterface === 'ComfyUI') {
            // Format based on enable mode
            // Feel free to pass 0:0:0:0 to ComfyUI_Mira, I'll take care of it
            switch (enableMode) {
                case "ALL":
                    formattedStrings.push(`<lora:${loraName}:${modelStrength}:${clipStrength}>`);
                    break;
                case "Base":
                    formattedStrings.push(`<lora:${loraName}:${modelStrength}:${clipStrength}:0:0>`);
                    break;
                case "HiFix":
                    formattedStrings.push(`<lora:${loraName}:0:0:${modelStrength}:${clipStrength}>`);
                    break;
                default:
                    continue;
            }
        } else {
            const pattern = /([^/\\]+?)(?=\.safetensors$)/i;
            const match = loraName.match(pattern);
            if (match) {
                formattedStrings.push(`<lora:${match[1]}:${modelStrength}>`);
            }
            
        }
    }
    
    return formattedStrings.join('\n');
}


export async function replaceWildcardsAsync(pos, seed) {
    const wildcardRegex = /__([a-zA-Z0-9_-]+)__/g;

    let random_seed = seed;   

    // collect all wildcards in the prompt
    const matches = [];
    let match;
    while ((match = wildcardRegex.exec(pos)) !== null) {
        matches.push(match[1]);
    }
    // replace each wildcard with its corresponding value
    for (const wildcardName of matches) {
        if (globalThis.generate.wildcard_random.getValue()) {
            random_seed = generateRandomSeed();
        }
        let replacement;
        if (globalThis.inBrowser) {
            replacement = await sendWebSocketMessage({ type: 'API', method: 'loadWildcard', params: [wildcardName, random_seed] }); 
        } else {
            replacement = await globalThis.api.loadWildcard(wildcardName, random_seed);
        }
        pos = pos.replaceAll(new RegExp(`__${wildcardName}__`, 'g'), `${replacement}`);
    }
    return pos;
}

async function createPrompt(runSame, aiPromot, apiInterface, loop=-1){
    let finalInfo = ''
    let randomSeed = -1;
    let positivePrompt = '';
    let positivePromptColored = '';
    let negativePrompt = '';
    let thumbImage = null;
    let charactersName = '';

    if(runSame) {
        let seed = globalThis.generate.seed.getValue();
        if (seed === -1){
            randomSeed = generateRandomSeed();
        }
        positivePrompt = globalThis.generate.lastPos;
        positivePromptColored = globalThis.generate.lastPosColored;
        negativePrompt = globalThis.generate.lastNeg;
        charactersName = globalThis.generate.lastCharacter;

    } else {            
        const {thumb, characters_tag, information, seed, characters} = await getCharacters();
        randomSeed = seed;
        finalInfo = information;

        const views = getViewTags(seed);
        let {pos, posc, lora} = getPrompts(characters_tag, views, aiPromot, apiInterface, loop);
                
        pos = await replaceWildcardsAsync(pos, randomSeed);
        posc = await replaceWildcardsAsync(posc, randomSeed);

        pos = processRandomString(pos);
        posc = processRandomString(posc);

        if(lora === ''){
            positivePrompt = pos;
        }
        else{
            const loraColor = (globalThis.globalSettings.css_style==='dark')?'AliceBlue':'DarkBlue';
            positivePrompt = `${pos}\n${lora}`;
            finalInfo += `LoRA: [color=${loraColor}]${lora}[/color]\n`;
        }
        positivePromptColored = posc;            
        negativePrompt = globalThis.prompt.negative.getValue();
        thumbImage = thumb;
        charactersName = characters;
    }

    return {finalInfo, randomSeed, positivePrompt, positivePromptColored, negativePrompt, thumbImage, charactersName}
}

export function createHiFix(randomSeed, apiInterface, brownColor){
    const hfSeed = generateRandomSeed();
    let hifix = {
        enable: globalThis.generate.hifix.getValue(),
        model: globalThis.hifix.model.getValue(),
        colorTransfer: globalThis.hifix.colorTransfer.getValue(),
        randomSeed: globalThis.hifix.randomSeed.getValue(),
        seed: globalThis.hifix.randomSeed.getValue()?hfSeed:randomSeed,
        scale: globalThis.hifix.scale.getFloat(),
        denoise: globalThis.hifix.denoise.getFloat(),
        steps: globalThis.hifix.steps.getValue(),
        info: ''
    }
    if(hifix.enable) {        
        hifix.info += `Hires Fix: [[color=${brownColor}]${hifix.enable}[/color]]\n`;
        hifix.info += `\tSteps: [[color=${brownColor}]${hifix.steps}[/color]]\n`;

        if(hifix.randomSeed) {
            hifix.info += `\tHires Fix Seed: [[color=${brownColor}]${hfSeed}[/color]]\n`;            
            hifix.seed = hfSeed;
        }
    }

    return hifix;
}

export function createRefiner(){
    const refinerVpred = globalThis.refiner.vpred.getValue();        
    let vPred = 0;
    if(refinerVpred == globalThis.cachedFiles.language[globalThis.globalSettings.language].vpred_on)
        vPred = 1;
    else if(refinerVpred == globalThis.cachedFiles.language[globalThis.globalSettings.language].vpred_off)
        vPred = 2;   

    const refiner = {
        enable: globalThis.generate.refiner.getValue(),
        model: globalThis.refiner.model.getValue(),
        vpred: vPred,
        addnoise: globalThis.refiner.addnoise.getValue(),
        ratio: globalThis.refiner.ratio.getFloat(),
        info: ''
    }
    if(refiner.enable && refiner.model !== globalThis.dropdownList.model.getValue())
    {
        const brownColor = (globalThis.globalSettings.css_style==='dark')?'BurlyWood':'Brown';
        refiner.info = `Refiner Model: [[color=${brownColor}]${refiner.model}[/color]]\n`;
    }
     return refiner;
}

export function checkVpred(){
    let vPred = 0;
    const modelVpred = globalThis.dropdownList.vpred.getValue();
    if(modelVpred === globalThis.cachedFiles.language[globalThis.globalSettings.language].vpred_on)
        vPred = 1;
    else if(modelVpred === globalThis.cachedFiles.language[globalThis.globalSettings.language].vpred_off)
        vPred = 2;

    return vPred;
}

export function convertBase64ImageToUint8Array(image) {
    if (!image?.startsWith('data:image/png;base64,')) 
        return null;

    try {
        const base64Data = image.replace('data:image/png;base64,', '');            
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.codePointAt(i);
        }
        
        /*
        In case of any other types...

        const blob = new Blob([bytes], { type: 'image/png' });
        const file = new File([blob], `${name}.png`, { type: 'image/png' });
        */
        return bytes;
        
    } catch (error) {
        console.error('Error converting base64 to image object:', error);
        return null;
    }
}

// eslint-disable-next-line sonarjs/cognitive-complexity
export function createControlNet() {
    if (!globalThis.globalSettings.api_controlnet_enable)
        return [];

    let controlnetToBackend = [];
    let controlNetList = globalThis.controlnet.getValues(true);

    for (const [preProcessModel, preProcessResolution, slot_enable, postProcessModel, 
                postProcessStrength, postProcessStart, postProcessEnd, pre_image, pre_image_after] 
                of controlNetList) {
        if (slot_enable === 'Off')
            continue;

        const realPostProcessStart = checkNumberInRange(postProcessStart, 0, 1, 0);
        const realPostProcessEnd = checkNumberInRange(postProcessEnd, 0, 1, 1);

        if (postProcessStart >= postProcessEnd || postProcessModel.toLowerCase() === 'none') {
            console.warn("Skip controlNet", postProcessModel, postProcessStart, postProcessEnd);
            continue;
        }
        
        // A1111 if none and On
        let slotTrigger = slot_enable;
        if(preProcessModel === 'none' && slotTrigger === 'On'){
            slotTrigger = 'Post';   // Set to Post
        }

        let cnData = {
            preModel: preProcessModel,
            preRes: preProcessResolution,
            postModel: postProcessModel,
            postStr: postProcessStrength,
            postStart: realPostProcessStart,
            postEnd: realPostProcessEnd,
            image: (slotTrigger === 'On') ? pre_image : null,
            imageAfter: (slotTrigger === 'Post') ? pre_image_after : null
        };

        if (preProcessModel.startsWith('ip-adapter')) {
            cnData.image = pre_image; // square image
        }

        controlnetToBackend.push(cnData);
    }

    return controlnetToBackend;
}

export function createADetailer(apiInterface) {   
    if (!globalThis.globalSettings.api_adetailer_enable)
        return [];

    let aDetailerToBackend = [];
    const aDetailerList = globalThis.aDetailer.getValues(true);    
    for (const [
        ad_model, ad_confidence, ad_mask_k, slot_enable,
        ad_prompt, ad_dilate_erode, ad_mask_merge_invert,
        ad_negative_prompt, ad_mask_blur, ad_denoise
    ] of aDetailerList) {
        if (slot_enable === 'Off' || ad_model.toLowerCase() === 'none')
            continue;
        
        const mask_filter = slot_enable;
        let adData = {};
        if(apiInterface === 'WebUI') {
            adData ={
                model: ad_model,
                prompt: ad_prompt,
                negative_prompt: ad_negative_prompt,
                // Detection
                confidence: checkNumberInRange(ad_confidence, 0, 1, 0.3, false),
                mask_k: checkNumberInRange(ad_mask_k, 0, 10, true),
                mask_filter_method: mask_filter,
                // Mask Preprocessing
                dilate_erode: convertToMultipleOfNFloor(ad_dilate_erode, 4),
                mask_merge_invert: ad_mask_merge_invert,
                // Inpainting
                mask_blur:checkNumberInRange(ad_mask_blur, 0, 64, 4, true),
                denoise: checkNumberInRange(ad_denoise, 0, 1, 0.4, false),
            };
        } else {
            adData ={
                model: `bbox/${ad_model}`,
                prompt: ad_prompt,
                negative_prompt: ad_negative_prompt,
                // bbox_threshold
                confidence: checkNumberInRange(ad_confidence, 0, 1, 0.3, false),
                // sam_dilation
                mask_k: checkNumberInRange(ad_mask_k, -512, 512, 0, true),
                // sam_modelname/Off
                mask_filter_method: mask_filter,
                // bbox_dilation
                dilate_erode: checkNumberInRange(ad_dilate_erode, -512, 512, 4, true),
                // sam_detection_hint
                mask_merge_invert: ad_mask_merge_invert, 
                // feather
                mask_blur:checkNumberInRange(ad_dilate_erode, 0, 100, 4, true),
                // denoise
                denoise: checkNumberInRange(ad_denoise, 0, 1, 0.4, false),
            };
        }
        aDetailerToBackend.push(adData);
    }

    return aDetailerToBackend;
}
// eslint-disable-next-line sonarjs/cognitive-complexity
export async function generateControlnetImage(imageData, controlNetSelect, controlNetResolution, skipGzip=false){
    let ret = 'success';
    let retCopy = '';
    const SETTINGS = globalThis.globalSettings;
    const FILES = globalThis.cachedFiles;
    const LANG = FILES.language[SETTINGS.language];
    globalThis.mainGallery.showLoading(LANG.overlay_title, LANG.overlay_te, LANG.overlay_sec);

    let res = Number(controlNetResolution) || 512;
    res = Math.round(res / 64) * 64;
    if (res < 512) res = 512;
    if (res > 2048) res = 2048;
    controlNetResolution = res;

    let imageGzipped = imageData;
    if(!skipGzip) {
        const buffer = await imageData.arrayBuffer();
        const uint8Array = new Uint8Array(buffer);

        if (globalThis.inBrowser) {
            imageGzipped = await sendWebSocketMessage({ type: 'API', method: 'compressGzip', params: [Array.from(uint8Array)] });
        } else {
            imageGzipped = await globalThis.api.compressGzip(uint8Array);
        }
    }

    let browserUUID = 'none';
    if(globalThis.inBrowser) {
        browserUUID = globalThis.clientUUID;
    }
    const apiInterface = globalThis.generate.api_interface.getValue();
    const generateData = {
        addr: extractHostPort(globalThis.generate.api_address.getValue()),
        auth: extractAPISecure(apiInterface),
        uuid: browserUUID,
        imageData: (apiInterface === 'ComfyUI' && !skipGzip)?imageGzipped:(await fileToBase64(imageGzipped)).replace('data:image/png;base64,', ''),
        controlNet: controlNetSelect,
        outputResolution: controlNetResolution
    };
    
    // ControlNet Start
    globalThis.generate.loadingMessage = `${LANG.generate_controlnet_process}${controlNetSelect}\n`;
    let newImage;
    if(apiInterface === 'None') {
        console.warn('apiInterface', apiInterface);
    } else if(apiInterface === 'ComfyUI') {        
        if (globalThis.inBrowser) {
            newImage = await sendWebSocketMessage({ type: 'API', method: 'runComfyUI_ControlNet', params: [generateData] });
        } else {
            newImage = await globalThis.api.runComfyUI_ControlNet(generateData);
        }     

        if(!newImage) {
            ret = 'No Image return from ComfyUI Backend';
        } else if(newImage.startsWith('Error')) {
            ret = newImage;
            newImage = ret;
        } 
        retCopy = ret;
    } else if(apiInterface === 'WebUI') {
        if (globalThis.inBrowser) {
            newImage = await sendWebSocketMessage({ type: 'API', method: 'runWebUI_ControlNet', params: [generateData] });
        } else {
            newImage = await globalThis.api.runWebUI_ControlNet(generateData);
        }     

        if(!newImage) {
            ret = 'No Image return from WebUI Backend';
        } else if(newImage.startsWith('Error')) {
            ret = newImage;
            newImage = ret;
        } else {
            // got image
        }
        retCopy = ret;
    }

    let preImageAftGzipped;
    if(apiInterface === 'ComfyUI') {
        const preImageAft = convertBase64ImageToUint8Array(newImage);
        if (globalThis.inBrowser) {            
            preImageAftGzipped = await sendWebSocketMessage({ type: 'API', method: 'compressGzip', params: [Array.from(preImageAft)] });
        } else {
            preImageAftGzipped = await globalThis.api.compressGzip(preImageAft);
        }        
    } 
    globalThis.mainGallery.hideLoading(ret, retCopy);

    if (apiInterface === 'WebUI') {
        return {
            preImage: await fileToBase64(imageGzipped), 
            preImageAfter: newImage,
            preImageAfterBase64: (newImage.startsWith('Error'))? newImage : 'data:image/png;base64,' + newImage
        };
    } 

    return {
        preImage: imageGzipped, 
        preImageAfter: preImageAftGzipped,
        preImageAfterBase64: newImage
    };
}

// eslint-disable-next-line sonarjs/cognitive-complexity
export async function generateImage(dataPack){
    const {loops, runSame} = dataPack;
    const SETTINGS = globalThis.globalSettings;
    const FILES = globalThis.cachedFiles;
    const LANG = FILES.language[SETTINGS.language];

    const apiInterface = globalThis.generate.api_interface.getValue();
    const apiAddress = extractHostPort(globalThis.generate.api_address.getValue());
    const apiAuth = extractAPISecure(apiInterface);
    const browserUUID = (globalThis.inBrowser)?globalThis.clientUUID:'none';
            
    const negativeColor = (globalThis.globalSettings.css_style==='dark')?'red':'Crimson';
    const brownColor = (globalThis.globalSettings.css_style==='dark')?'BurlyWood':'Brown';    
    
    const aiPromptInterface = globalThis.ai.interface.getValue();
    const aiPromptCurrentRole = globalThis.ai.ai_select.getValue();        
    const aiPromot = (aiPromptCurrentRole===0 || String(aiPromptCurrentRole).toLowerCase() === 'none')?'':REPLACE_AI_MARK;

    toggleQueueColor();

    if(!globalThis.mainGallery.isLoading && !globalThis.globalSettings.generate_auto_start && !globalThis.inGenerating) {
        globalThis.generate.showCancelButtons(true);
        globalThis.mainGallery.showLoading(LANG.overlay_title, LANG.overlay_te, LANG.overlay_sec);
        globalThis.thumbGallery.clear();
        globalThis.infoBox.image.clear();
    }

    for(let loop = 0; loop < loops; loop++){        
        if(globalThis.generate.cancelClicked){
            globalThis.queueManager.removeAll();
            break;
        }                                

        if(globalThis.generate.skipClicked){
            break;
        } 

        if(!globalThis.inGenerating)
            globalThis.generate.loadingMessage = LANG.generate_warmup.replace('{0}', `${loop+1}`).replace('{1}', loops);

        const createPromptResult = await createPrompt(runSame, aiPromot, apiInterface, (loops > 1)?loop:-1);
        const landscape = globalThis.generate.landscape.getValue();
        const width = landscape?globalThis.generate.height.getValue():globalThis.generate.width.getValue();
        const height = landscape?globalThis.generate.width.getValue():globalThis.generate.height.getValue();
        
        const hifix = createHiFix(createPromptResult.randomSeed, apiInterface,brownColor);
        const refiner = createRefiner();

        const vae = globalThis.dropdownList.vae_sdxl.getValue();
        let vae_override = globalThis.dropdownList.vae_sdxl_override.getValue();
        if(vae_override && vae !== 'None'){
            console.log('Override VAE to', vae);
        } else {
            vae_override = false;
        }
        
        globalThis.generate.lastPos = createPromptResult.positivePrompt;
        globalThis.generate.lastPosColored = createPromptResult.positivePromptColored;
        globalThis.generate.lastNeg = createPromptResult.negativePrompt;
        globalThis.generate.lastCharacter = createPromptResult.charactersName;
        if(createPromptResult.thumbImage)
            globalThis.generate.lastThumb = createPromptResult.thumbImage;

        const generateData = {
            addr: apiAddress,
            auth: apiAuth,
            uuid: browserUUID,
            refresh:globalThis.generate.api_preview_refresh_time.getValue(),

            queueManager : {
                genType:'normal',
                isRegional:false,
                apiInterface:apiInterface,
                finalInfo: '',
                loop: loop,
                loops: loops,
                aiInterface: aiPromptInterface,
                aiRole: aiPromptCurrentRole,
                aiOptions: (aiPromptInterface.toLowerCase() === 'remote') ? {
                        apiUrl: globalThis.ai.remote_address.getValue(),
                        apiKey: globalThis.ai.remote_apikey.getValue(),
                        modelSelect: globalThis.ai.remote_model_select.getValue(),
                        userPrompt: globalThis.prompt.ai.getValue(),
                        systemPrompt: globalThis.ai.ai_system_prompt.getValue(),
                        timeout: globalThis.ai.remote_timeout.getValue() * 1000
                    } : {
                        apiUrl: globalThis.ai.local_address.getValue(),
                        userPrompt: globalThis.prompt.ai.getValue(),
                        systemPrompt: globalThis.ai.ai_system_prompt.getValue(),
                        temperature: globalThis.ai.local_temp.getValue(),
                        n_predict:globalThis.ai.local_n_predict.getValue(),
                        timeout: globalThis.ai.remote_timeout.getValue() * 1000
                    },
                thumb:createPromptResult.thumbImage || globalThis.generate.lastThumb,
                id:createPromptResult.charactersName,
            },
            
            positive: createPromptResult.positivePrompt,
            negative: createPromptResult.negativePrompt,
            width: width,
            height: height,
            cfg: globalThis.generate.cfg.getValue(),
            step: globalThis.generate.step.getValue(),
            seed: createPromptResult.randomSeed,
            sampler: globalThis.generate.sampler.getValue(),
            scheduler: globalThis.generate.scheduler.getValue(),            
            ...(SETTINGS.api_model_type === 'Checkpoint' ? {
                model: globalThis.dropdownList.model.getValue(),
                vpred: checkVpred(),
                hifix: hifix,
                refiner: refiner,
                controlnet: createControlNet(),
                adetailer: createADetailer(apiInterface),
                vae: {vae_override: vae_override, vae: vae},
            } : {
                unet: {
                    enable: true,
                    model: globalThis.dropdownList.model.getValue(),
                    dtype: globalThis.dropdownList.diffusion_model_weight_dtype.getValue(),
                    vae_model: globalThis.dropdownList.vae_unet.getValue(),
                    clip_model: globalThis.dropdownList.textencoder.getValue(),
                    clip_type: globalThis.dropdownList.textencoder_type.getValue(),
                    clip_device: globalThis.dropdownList.textencoder_device.getValue(),
                },
            })
        };        

        let finalInfo = `${createPromptResult.finalInfo}\n`;
            finalInfo += `Positive: ${createPromptResult.positivePromptColored}\n`;
            finalInfo += `Negative: [color=${negativeColor}]${generateData.negative}[/color]\n\n`;
            finalInfo += `Layout: [[color=${brownColor}]${generateData.width} x ${generateData.height}[/color]]\t`;
            finalInfo += `CFG: [[color=${brownColor}]${generateData.cfg}[/color]]\t`;
            finalInfo += `Setp: [[color=${brownColor}]${generateData.step}[/color]]\n`;
            finalInfo += `Sampler: [[color=${brownColor}]${generateData.sampler}[/color]]\n`;
            finalInfo += `Scheduler: [[color=${brownColor}]${generateData.scheduler}[/color]]\n`;
            finalInfo += hifix.info;
            finalInfo += refiner.info;        
            finalInfo +=`\n`;

        generateData.queueManager.finalInfo = finalInfo;
        
        const nameList = generateData.queueManager.id.replaceAll('\n', ' | ');
        globalThis.queueManager.attach(
            [   (nameList === '') ? LANG.generate_normal.replace('{0}', `${createPromptResult.randomSeed} | ${createPromptResult.positivePrompt}`) : 
                LANG.generate_normal.replace('{0}', `${createPromptResult.randomSeed} | ${nameList}`), 
                createPromptResult.positivePrompt
            ], 
            generateData
        );
    }

    globalThis.generate.generate_single.setClickable(true);
    globalThis.generate.generate_batch.setClickable(true);
    globalThis.generate.generate_same.setClickable(true);    
    
    if(globalThis.globalSettings.generate_auto_start) {
        await startQueue();
    } else {
        globalThis.mainGallery.hideLoading('success', '');
    }
}

// eslint-disable-next-line sonarjs/cognitive-complexity
export async function startQueue(){
    if(globalThis.inGenerating)
        return;    
    globalThis.inGenerating = true;

    let ret = 'success';
    let retCopy = '';

    const SETTINGS = globalThis.globalSettings;
    const FILES = globalThis.cachedFiles;
    const LANG = FILES.language[SETTINGS.language];

    if(!globalThis.mainGallery.isLoading) {
        globalThis.generate.showCancelButtons(true);
        globalThis.mainGallery.showLoading(LANG.overlay_title, LANG.overlay_te, LANG.overlay_sec);
        globalThis.thumbGallery.clear();
        globalThis.infoBox.image.clear();
    }

    let generateData = globalThis.queueManager.getFirstSlot();
    while (generateData) {
        if(globalThis.generate.cancelClicked){
            globalThis.queueManager.removeAll();
            break;
        }                                
        if(globalThis.generate.skipClicked) {
            break;
        }

        // start generate        
        const queueManager = generateData.queueManager;        
        let result = '';
        if(queueManager.genType === 'normal') {
            globalThis.thumbGallery.append(queueManager.thumb);

            const aiPrompt = await getAiPrompt(queueManager.loop, LANG.generate_ai, queueManager.aiInterface, queueManager.aiRole, queueManager.aiOptions);            
            if (globalThis.globalSettings.ai_prompt_preview && globalThis.globalSettings.ai_prompt_role !== 0) {
                globalThis.overlay.custom.closeCustomOverlaysByGroup('aiText'); // close exist
                globalThis.overlay.custom.createCustomOverlay('none', `\n\n\n${aiPrompt}`,
                                                        384, 'center', 'left', null, 'aiText');
            }

            const finalInfo = String(queueManager.finalInfo).replaceAll(REPLACE_AI_MARK, aiPrompt);
            globalThis.infoBox.image.appendValue(finalInfo);            
            globalThis.generate.loadingMessage = LANG.generate_start.replace('{0}', `${queueManager.id}`).replace('{1}', `[${queueManager.loop + 1}/${queueManager.loops}]`);

            if(queueManager.isRegional) {
                generateData.positive_left = String(generateData.positive_left).replaceAll(REPLACE_AI_MARK, aiPrompt);
                generateData.positive_right = String(generateData.positive_right).replaceAll(REPLACE_AI_MARK, aiPrompt);            
                result = await seartGenerateRegional(queueManager.apiInterface, generateData);
            } else {
                generateData.positive = String(generateData.positive).replaceAll(REPLACE_AI_MARK, aiPrompt);
                result = await seartGenerate(queueManager.apiInterface, generateData);
            }
        } else if(queueManager.genType === 'miraITU') {
            from_renderer_generate_updatePreview(`data:image/png;base64,${generateData.preview}`);
            const ogResolution = `${generateData.taggerOptions.imageWidth}x${generateData.taggerOptions.imageHeight}`;
            const tgtResolution = `${generateData.taggerOptions.imageWidth*generateData.taggerOptions.upscaleRatio}x${generateData.taggerOptions.imageHeight*generateData.taggerOptions.upscaleRatio}`;
            globalThis.generate.loadingMessage = `MiraITU: ${generateData.seed}\n${ogResolution} -> ${tgtResolution}\n`;
            result = await startGenerateMiraITU(queueManager.apiInterface, generateData);
        }        

        // result
        ret = result.ret;
        retCopy = result.retCopy;
        
        if(result.breakNow) {
            if(globalThis.generate.cancelClicked) {
                globalThis.queueManager.removeAll();
            }

            if(ret !== 'success') {
                // Disable auto start, the error may solved in future
                setQueueAutoStart(false);
            }
            break;
        }

        generateData = globalThis.queueManager.pop();

        if(!globalThis.globalSettings.generate_auto_start)
            break;
    }

    globalThis.mainGallery.hideLoading(ret, retCopy);
    if(globalThis.queueManager.getSlotsCount() === 0)
        globalThis.generate.showCancelButtons(false);
    globalThis.inGenerating = false;
}

async function seartGenerate(apiInterface, generateData){
    let ret = 'success';
    let retCopy = '';
    let breakNow = false;

    if(apiInterface === 'ComfyUI') {
        const result = await runComfyUI(apiInterface, generateData);
        ret = result.ret;
        retCopy = result.retCopy;
        breakNow = result.breakNow
    } else if(apiInterface === 'WebUI') {
        const result = await runWebUI(apiInterface, generateData);
        ret = result.ret;
        retCopy = result.retCopy;
        breakNow = result.breakNow
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
        globalThis.mainGallery.appendImageData(image, `${generateData.seed}`, generateData.positive, keepGallery, globalThis.globalSettings.scroll_to_last);
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
            result = await sendWebSocketMessage({ type: 'API', method: 'runComfyUI', params: [generateData] });
        } else {
            result = await globalThis.api.runComfyUI(generateData);
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
                        image = await sendWebSocketMessage({ type: 'API', method: 'openWsComfyUI', params: [parsedResult.prompt_id, true, '29'] });
                    } else {
                        image = await globalThis.api.openWsComfyUI(parsedResult.prompt_id, true, '29');
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

// eslint-disable-next-line sonarjs/cognitive-complexity
async function runWebUI(apiInterface, generateData) {
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
            result = await sendWebSocketMessage({ type: 'API', method: 'runWebUI', params: [generateData] });
        } else {
            result = await globalThis.api.runWebUI(generateData);
        }        
        
        if(globalThis.generate.cancelClicked) {
            breakNow = true;
        } else {
            const typeResult = typeof result;
            if(typeResult === 'string'){
                if(result.startsWith('Error')){
                    if(result.endsWith('Cancelled')) {
                        console.log('Generate cancelled from queue manager');
                    } else {
                        ret = LANG.gr_error_creating_image.replace('{0}',result).replace('{1}', apiInterface)
                        retCopy = result;
                        breakNow = true;
                    }
                } else {
                    if(!keepGallery)
                        globalThis.mainGallery.clearGallery();
                    globalThis.mainGallery.appendImageData(result, `${generateData.seed}`, generateData.positive, keepGallery, globalThis.globalSettings.scroll_to_last);
                }
            }
        }
    } catch (error) {
        ret = LANG.gr_error_creating_image.replace('{0}',error.message).replace('{1}', apiInterface)
        retCopy = error.message;
        breakNow = true;
    }

    if(ret.includes('cannot run new generation,')) {
        // not stop polling due to WebUI is busy
    } else if (globalThis.inBrowser) {
        sendWebSocketMessage({ type: 'API', method: 'stopPollingWebUI'});
    } else {
        globalThis.api.stopPollingWebUI();
    }

    if (globalThis.cachedFiles.controlnetProcessorListWebUI === 'none') {   // aDetailer might not installed 
        await updateADetailerModelList();
    }
    
    return {ret, retCopy, breakNow }
}

export async function updateADetailerModelList() {    
    const SETTINGS = globalThis.globalSettings;
    const FILES = globalThis.cachedFiles;
    const LANG = FILES.language[SETTINGS.language];

    if (globalThis.inBrowser) {
        globalThis.cachedFiles.controlnetProcessorListWebUI = await sendWebSocketMessage({ type: 'API', method: 'getControlNetProcessorListWebUI'});
        globalThis.cachedFiles.aDetailerList = await sendWebSocketMessage({ type: 'API', method: 'getADetailerModelListWebUI'});
        globalThis.cachedFiles.upscalerListWebUI = await sendWebSocketMessage({ type: 'API', method: 'getUpscalersModelListWebUI'});            
    } else {
        globalThis.cachedFiles.controlnetProcessorListWebUI = await globalThis.api.getControlNetProcessorListWebUI();
        globalThis.cachedFiles.aDetailerList = await globalThis.api.getADetailerModelListWebUI();
        globalThis.cachedFiles.upscalerListWebUI = await globalThis.api.getUpscalersModelListWebUI();            
    } 

    console.log("WebUI: Processor, Upscaler and aDetailer List updated!");
    console.log(globalThis.cachedFiles.controlnetProcessorListWebUI);
    console.log(globalThis.cachedFiles.aDetailerList);
    console.log(globalThis.cachedFiles.upscalerListWebUI);

    setADetailerModelList(globalThis.cachedFiles.aDetailerList);
    
    const currentModelSelect = globalThis.hifix.model.getValue();        
    globalThis.cachedFiles.upscalerList = [...globalThis.cachedFiles.upscalerListWebUI];
    globalThis.hifix.model.setValue(LANG.api_hf_upscaler_selected, globalThis.cachedFiles.upscalerList);
    globalThis.hifix.model.updateDefaults(currentModelSelect);
}

