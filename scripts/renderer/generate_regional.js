import { decodeThumb } from './customThumbGallery.js';
import { generateRandomSeed, resolveGenerateSeed, getTagAssist, getLoRAs, replaceWildcardsAsync, characterRandomMode, pickRandomCharacterEntry, formatCharacterInfo, formatOriginalCharacterInfo,
    getViewTags, createHiFix, formatQueueJobSeed, createRefiner, extractHostPort, checkVpred, extractAPISecure,
    createControlNet, createADetailer, toggleQueueColor, startQueue, previewRegionalCharacters,
    updateADetailerModelList, getImageSavePrefix, readSkipLayer } from './generate.js';
import { processRandomString } from './tools/nestedBraceParsing.js';
import { sendWebSocketMessage } from '../webserver/front/wsRequest.js';
import { filterPrompts } from './tools/promptFilter.js';
import { readForgeDtypeSettings } from '../main/sageFp16Switch.js';


// eslint-disable-next-line sonarjs/cognitive-complexity
function getCustomJSON(loop=-1){
    let BeforeOfPromptsL = '';
    let BeforeOfCharacterL = '';
    let EndOfCharacterL = '';
    let EndOfPromptsL = '';

    let BeforeOfPromptsR = '';
    let BeforeOfCharacterR = '';
    let EndOfCharacterR = '';
    let EndOfPromptsR = '';
    
    const jsonSlots = globalThis.jsonlist.getValues(loop);

    for(const {prompt, strength, regional, method} of jsonSlots) {
        if(method === 'Off')
            continue;

        const trimmedPrompt = prompt.replaceAll('\\', '\\\\').replaceAll('(', String.raw`\(`).replaceAll(')', String.raw`\)`).replaceAll(':', ' ');
        let finalPrompt;
        if (Number.parseFloat(strength) === 1)
            finalPrompt = `${trimmedPrompt}, `;
        else
            finalPrompt = `(${trimmedPrompt}:${strength}), `;


        if(regional == 'Both') {
            if(method === 'BOP') {
                BeforeOfPromptsL = BeforeOfPromptsL + finalPrompt;
                BeforeOfPromptsR = BeforeOfPromptsR + finalPrompt;
            }
            else if(method === 'EOP') {
                EndOfPromptsL = EndOfPromptsL + finalPrompt;
                EndOfPromptsR = EndOfPromptsR + finalPrompt;
            }
            if(method === 'BOC') {
                BeforeOfCharacterL = BeforeOfCharacterL + finalPrompt;
                BeforeOfCharacterR = BeforeOfCharacterR + finalPrompt;
            }
            else if(method === 'EOC') {
                EndOfCharacterL = EndOfCharacterL + finalPrompt;
                EndOfCharacterR = EndOfCharacterR + finalPrompt;
            }
        } else if(regional == 'Left') {
            if(method === 'BOP') {
                BeforeOfPromptsL = BeforeOfPromptsL + finalPrompt;
            }
            else if(method === 'EOP') {
                EndOfPromptsL = EndOfPromptsL + finalPrompt;
            }
            if(method === 'BOC') {
                BeforeOfCharacterL = BeforeOfCharacterL + finalPrompt;
            }
            else if(method === 'EOC') {
                EndOfCharacterL = EndOfCharacterL + finalPrompt;
            }
        } else if(regional == 'Right') {
            if(method === 'BOP') {
                BeforeOfPromptsR = BeforeOfPromptsR + finalPrompt;
            }
            else if(method === 'EOP') {
                EndOfPromptsR = EndOfPromptsR + finalPrompt;
            }
            if(method === 'BOC') {
                BeforeOfCharacterR = BeforeOfCharacterR + finalPrompt;
            }
            else if(method === 'EOC') {
                EndOfCharacterR = EndOfCharacterR + finalPrompt;
            }
        } 
    };

    return {
        BOPL: BeforeOfPromptsL,
        BOCL: BeforeOfCharacterL,
        EOCL: EndOfCharacterL,
        EOPL: EndOfPromptsL,
        BOPR: BeforeOfPromptsR,
        BOCR: BeforeOfCharacterR,
        EOCR: EndOfCharacterR,
        EOPR: EndOfPromptsR
    }
}

function appendRegionalSide(blocks, positiveColor) {
    const groups = [
        { text: `${blocks.bop}${blocks.common}`, color: blocks.commonColor },
        { text: blocks.views, color: blocks.viewColor },
        { text: blocks.aiPrompt, color: blocks.aiColor },
        { text: `${blocks.boc}${blocks.character}${blocks.eoc}`, color: blocks.characterColor },
        { text: `${blocks.positive}${blocks.eop}`, color: positiveColor },
    ];
    let prompt = '';
    let promptColored = '';
    for (const group of groups) {
        const text = String(group.text ?? '').replaceAll(/\n+/g, '');
        if (!text) continue;
        prompt += text;
        promptColored += `[color=${group.color}]${text}[/color]`;
    }
    return { prompt, promptColored };
}

// eslint-disable-next-line sonarjs/cognitive-complexity
function getPrompts(character_left, character_right, views, ai='', apiInterface = 'None', loop = -1){
    const commonColor = (globalThis.globalSettings.css_style==='dark')?'darkorange':'Sienna';
    const viewColor = (globalThis.globalSettings.css_style==='dark')?'BurlyWood':'Brown';
    const aiColor = (globalThis.globalSettings.css_style==='dark')?'hotpink':'Purple';
    const characterColor = (globalThis.globalSettings.css_style==='dark')?'DeepSkyBlue':'MidnightBlue';
    const positiveColor = (globalThis.globalSettings.css_style==='dark')?'LawnGreen':'SeaGreen';
    const positiveRColor = (globalThis.globalSettings.css_style==='dark')?'LightSkyBlue':'Navy';

    let common = globalThis.prompt.common.getValue();
    let positive = globalThis.prompt.positive.getValue().trim();
    let positiveR = globalThis.prompt.positive_right.getValue().trim();
    let aiPrompt = ai.trim();
    const exclude = globalThis.prompt.exclude.getValue();

    if (common) {
        const trimmedCommon = common.trim();
        if (trimmedCommon === '') {
            common = '';
        } else if (globalThis.globalSettings.api_model_type === 'Diffusion') {
            if (trimmedCommon.endsWith('.')) {
                common = `${trimmedCommon} `;
            } else if (trimmedCommon.endsWith('|')) {
                common = trimmedCommon.slice(0, -1);
            } else if (!trimmedCommon.endsWith(',') && !trimmedCommon.endsWith('\n')) {
                common = `${trimmedCommon}, `;
            } else {
                common = trimmedCommon;
            }
        } else {
            common = trimmedCommon.endsWith(',') ? trimmedCommon : `${trimmedCommon}, `;
        }
    }

    if(aiPrompt !== '' && !aiPrompt.endsWith(','))
        aiPrompt += ', ';

    const {BOPL, BOCL, EOCL, EOPL, BOPR, BOCR, EOCR, EOPR} = getCustomJSON(loop);
    const shared = { common, views, aiPrompt, commonColor, viewColor, aiColor, characterColor };
    const left = appendRegionalSide({
        ...shared,
        bop: BOPL, boc: BOCL, character: character_left, eoc: EOCL, positive, eop: EOPL,
    }, positiveColor);
    const right = appendRegionalSide({
        ...shared,
        bop: BOPR, boc: BOCR, character: character_right, eoc: EOCR, positive: positiveR, eop: EOPR,
    }, positiveRColor);

    const {
        positivePrompt: positivePromptLeft,
        positivePromptColored: positivePromptLeftColored
    } = filterPrompts(left.prompt, left.promptColored, exclude);

    const {
        positivePrompt: positivePromptRight,
        positivePromptColored: positivePromptRightColored
    } = filterPrompts(right.prompt, right.promptColored, exclude);


    const loraPromot = getLoRAs(apiInterface);
    return {
        posL:positivePromptLeft, posLc:positivePromptLeftColored, 
        posR:positivePromptRight, posRc:positivePromptRightColored, 
        lora:loraPromot}
}

export function composeRegionalForAi() {
    try {
        const seedValue = Number(globalThis.generate?.seed?.getValue?.());
        const seed = Number.isFinite(seedValue) && seedValue >= 0 ? seedValue : 0;
        const views = getViewTags(seed);
        const { left, right } = previewRegionalCharacters();
        const api = globalThis.generate?.api_interface?.getValue?.() || 'None';
        const { posL, posR } = getPrompts(left, right, views, '', api, -1);
        return { left: posL || '', right: posR || '' };
    } catch (error) {
        console.error('[ai-prompt] regional preview failed', error);
        return { left: '', right: '' };
    }
}

async function createCharacters(index, seeds) {
    const FILES = globalThis.cachedFiles;
    const character = globalThis.characterListRegional.getKey()[index];
    const isValueOnly = globalThis.characterListRegional.isValueOnly();
    const seed = seeds[index];

    if (character.toLowerCase() === 'none') {
        return { tag: '', tag_assist: '', thumb: null, info: '', neg_tags: '' };
    }

    const isOriginalCharacter = (index === 3 || index === 2);
    const { tag, thumb, info, weight, name } = isOriginalCharacter
        ? handleOriginalCharacter(character, seed, isValueOnly, index, FILES)
        : await handleStandardCharacter(character, seed, isValueOnly, index, FILES);

    const { tag: parsedTag, neg_tags } = splitTagNegativePrompt(tag);
    const tagAssist = getTagAssist(parsedTag, globalThis.generate.tag_assist.getValue(), FILES, index, info);
    if (tagAssist.tas !== '')
        tagAssist.tas = `${tagAssist.tas}, `;

    const finalTag = isOriginalCharacter ? `${parsedTag}` : parsedTag.replaceAll('\\', '\\\\').replaceAll('(', String.raw`\(`).replaceAll(')', String.raw`\)`);
    return {
        tag: finalTag,
        tag_assist: tagAssist.tas,
        thumb,
        info: tagAssist.info,
        weight: weight,
        characterName:name,
        neg_tags
    };
}

async function handleStandardCharacter(character, seed, isValueOnly, index, FILES) {
    let tag, thumb, info, name;
    const randomMode = characterRandomMode(character);
    if (randomMode) {
        const picked = pickRandomCharacterEntry(FILES.characterListArray, seed, randomMode);
        if (!picked) {
            console.warn('[handleStandardCharacter] No favorite characters to randomize');
            return { tag: '', thumb: null, info: '', weight: globalThis.characterListRegional.getTextValue(index), name: '' };
        }
        tag = picked[1];
        thumb = await decodeThumb(picked[0]);
        info = formatCharacterInfo(index, isValueOnly, {
        key: picked[0],
        value: picked[1]
        });
        if(globalThis.globalSettings.language === 'en-US')
            name = picked[1];
        else
            name = picked[0];
    } else {
        tag = FILES.characterList[character];
        thumb = await decodeThumb(character);
        info = formatCharacterInfo(index, isValueOnly, {
        key: character,
        value: globalThis.characterListRegional.getValue()[index]
        });
        if(globalThis.globalSettings.language === 'en-US')
            name = tag;
        else
            name = character;   
    }
    const weight = globalThis.characterListRegional.getTextValue(index);
    return { tag, thumb, info, weight, name };
}

function handleOriginalCharacter(character, seed, isValueOnly, index, FILES) {
    let tag, info, name;
    const randomMode = characterRandomMode(character);
    if (randomMode) {
        const picked = pickRandomCharacterEntry(FILES.ocListArray, seed, randomMode);
        if (!picked) {
            console.warn('[handleOriginalCharacter] No favorite characters to randomize');
            return { tag: '', thumb: null, info: '', weight: globalThis.characterListRegional.getTextValue(index), name: '' };
        }
        tag = picked[1];
        info = formatOriginalCharacterInfo({
        key: picked[0],
        value: picked[1]
        });
        name = picked[0];
    } else {
        tag = FILES.ocList[character];
        info = formatOriginalCharacterInfo({ key: character, value: tag }, isValueOnly);
        name = character;
    }
    const weight = globalThis.characterListRegional.getTextValue(index);
    return { tag, thumb: null, info, weight, name };
}

function splitTagNegativePrompt(tag = '') {
    const marker = '___NEGATIVE_PROMPT___:';
    const lowerTag = tag.toLowerCase();
    const markerIndex = lowerTag.indexOf(marker.toLowerCase());

    if (markerIndex === -1) {
        return { tag, neg_tags: '' };
    }

    const positiveTag = tag.slice(0, markerIndex);
    const neg_tags = tag.slice(markerIndex + marker.length).trim();
    return { tag: positiveTag, neg_tags };
}

function parseCharacter(weight, tag){
    if(weight === 1){
        return (tag === '')?'':`${tag}, `;
    } 

    return (tag === '')?'':`(${tag}:${weight}), `;
}

// eslint-disable-next-line sonarjs/cognitive-complexity
async function getCharacters(seedOverride = null){    
    const random_seed = resolveGenerateSeed(seedOverride);
    const seeds = [random_seed, Math.floor(random_seed /3), Math.floor(random_seed /7), 4294967296 - random_seed];

    let character_left = '';
    let character_right = '';
    let information = '';
    let thumbImages = [];
    let characters = '';
    let negativeTags = '';
    let character_name_for_image_prefix = '';

    const characterSlots = await Promise.all([0, 1, 2, 3].map((index) => createCharacters(index, seeds)));
    for(let index=0; index < characterSlots.length; index++) {
        let {tag, tag_assist, thumb, info, weight, characterName, neg_tags} = characterSlots[index];
        // Should not happen
        if(tag.startsWith('✨ ')) {            
            tag = tag.replace('✨ ', '');
            console.log('remove fav mark ✨ for', tag);
        }

        if (index === 0 || index === 2){
            character_left += parseCharacter(weight, tag);
            character_left += tag_assist;

            if (thumb) {            
                thumbImages.unshift(thumb);
            }            
        } else {
            character_right += parseCharacter(weight, tag);
            character_right += tag_assist;

            if (thumb) {            
                thumbImages.unshift(thumb);
            }     
        }

        if (neg_tags) {
            negativeTags = (negativeTags === '') ? neg_tags : `${negativeTags}, ${neg_tags}`;
        }

        information += `${info}`;
        if(characterName) {
            characters += (characters.length>0)?`\n${characterName}`:`${characterName}`;
            character_name_for_image_prefix += `${characterName} `;
        }
    }

    const brownColor = (globalThis.globalSettings.css_style==='dark')?'BurlyWood':'Brown';
    information += `Seed: [[color=${brownColor}]${seeds[0]}[/color]]\n`;    

    return{
        thumb: thumbImages,
        character_left:character_left,
        character_right:character_right,
        information: information,
        seed:random_seed,
        characters:characters,
        negative_tags: negativeTags,
        image_prefix: character_name_for_image_prefix.trim()
    }
}

async function createPrompt(runSame, aiPromot, apiInterface, loop=-1, seedOverride = null){
    let finalInfo = ''
    let randomSeed = -1;
    let randomSeedr = -1;
    let positivePromptLeft = '';
    let positivePromptLeftColored = '';
    let positivePromptRight = '';
    let positivePromptRightColored = '';
    let negativePrompt = '';
    let thumbImage = null;
    let charactersName = '';
    let img_prefix = '';

    if(runSame) {
        let seed = globalThis.generate.seed.getValue();
        if (seed === -1){
            randomSeed = generateRandomSeed();
        }
        positivePromptLeft = globalThis.generate.lastPos;
        positivePromptLeftColored = globalThis.generate.lastPosColored;
        positivePromptRight = globalThis.generate.lastPosR;
        positivePromptRightColored = globalThis.generate.lastPosRColored;
        negativePrompt = globalThis.generate.lastNeg;
        charactersName = globalThis.generate.lastCharacter;
        img_prefix = globalThis.generate.lastImagePrefix;
    } else {            
        const {thumb, character_left, character_right, information, seed, characters, negative_tags, image_prefix} = await getCharacters(seedOverride);
        randomSeed = seed;
        randomSeedr = Math.floor(seed / 3);
        finalInfo = information;

        const views = getViewTags(seed);
        let {posL, posLc, posR, posRc, lora} = getPrompts(character_left, character_right, views, aiPromot, apiInterface, loop);

        posL = await replaceWildcardsAsync(posL, randomSeed);
        posLc = await replaceWildcardsAsync(posLc, randomSeed);

        posR = await replaceWildcardsAsync(posR, randomSeedr);
        posRc = await replaceWildcardsAsync(posRc, randomSeedr);

        posL = processRandomString(posL);
        posLc = processRandomString(posLc);

        posR = processRandomString(posR);
        posRc = processRandomString(posRc);

        if(lora === ''){
            positivePromptLeft = posL;
            positivePromptRight = posR;
        }
        else{
            const loraColor = (globalThis.globalSettings.css_style==='dark')?'AliceBlue':'DarkBlue';
            positivePromptLeft = `${posL}\n${lora}`; // only need all lora once
            positivePromptRight = `${posR}\n`;
            finalInfo += `LoRA: [color=${loraColor}]${lora}[/color]\n`;
        }
        positivePromptLeftColored = posLc;
        positivePromptRightColored = posRc;
        const mergedNegativePrompt = [globalThis.prompt.negative.getValue(), negative_tags].filter(Boolean).join(', ').trim();
        negativePrompt = mergedNegativePrompt;
        thumbImage = thumb;
        charactersName = characters;         
        img_prefix = image_prefix;
    }

    return {finalInfo, randomSeed, positivePromptLeft, positivePromptRight, 
            positivePromptLeftColored, positivePromptRightColored, negativePrompt,
            thumbImage, charactersName, img_prefix
    }
}

function createRegional(apiInterface) {
    const overlap_ratio = globalThis.regional.overlap_ratio.getValue();
    const image_ratio = globalThis.regional.image_ratio.getValue();

    const a = image_ratio / 50;
    const c = 2 - a;
    const b = overlap_ratio / 100;

    let ratio =`${a},${(b===0)?0.01:b},${c}`;
    if(apiInterface === 'WebUI') {
        ratio =`${(a+b)/2},${(c-b)/2}`;
    }
            
    const str_left = globalThis.regional.str_left.getFloat();
    const str_right = globalThis.regional.str_right.getFloat();

    const option_left = globalThis.regional.option_left.getValue();
    const option_right = globalThis.regional.option_right.getValue();    

    const brownColor = (globalThis.globalSettings.css_style==='dark')?'BurlyWood':'Brown';
    const info = `Regional Condition:\n\tOverlap Ratio: [[color=${brownColor}]${overlap_ratio}[/color]]\n\tImage Ratio: [[color=${brownColor}]${image_ratio}[/color]]\n\tLeft Str: [[color=${brownColor}]${str_left}[/color]]\tMask Area: [[color=${brownColor}]${option_left}[/color]]\n\tRight Str: [[color=${brownColor}]${str_right}[/color]]\tMask Area: [[color=${brownColor}]${option_right}[/color]]\n`;

    return {info, ratio, str_left, str_right, option_left, option_right};
}

// eslint-disable-next-line sonarjs/cognitive-complexity
export async function generateRegionalImage(dataPack){
    const {loops, runSame, hiresOneShot = false, seedOverride = null} = dataPack;
    const SETTINGS = globalThis.globalSettings;
    const FILES = globalThis.cachedFiles;
    const LANG = FILES.language[SETTINGS.language];

    const apiInterface = globalThis.generate.api_interface.getValue();
    const apiAddress = extractHostPort(globalThis.generate.api_address.getValue());
    const apiAuth = extractAPISecure(apiInterface);
    const browserUUID = (globalThis.inBrowser)?globalThis.clientUUID:'none';

    const negativeColor = (globalThis.globalSettings.css_style==='dark')?'red':'Crimson';
    const brownColor = (globalThis.globalSettings.css_style==='dark')?'BurlyWood':'Brown';    

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
            globalThis.generate.loadingMessage = LANG.generate_start.replace('{0}', `${loop+1}`).replace('{1}', loops);

        // One job at a time: each pass reads the live UI, and cancel/skip must be able to stop the batch.
        // eslint-disable-next-line no-await-in-loop
        const createPromptResult = await createPrompt(runSame, '', apiInterface, (loops > 1)?loop:-1, seedOverride); // NOSONAR

        const hifix = createHiFix(createPromptResult.randomSeed, apiInterface,brownColor, hiresOneShot);
        const refiner = createRefiner();
        const regional = createRegional(apiInterface);

        const landscape = globalThis.generate.landscape.getValue();
        const width = landscape?globalThis.generate.height.getValue():globalThis.generate.width.getValue();
        const height = landscape?globalThis.generate.width.getValue():globalThis.generate.height.getValue();
        const swap = globalThis.regional.swap.getValue();

        const vae = globalThis.dropdownList.vae_sdxl.getValue();
        let vae_override = globalThis.dropdownList.vae_sdxl_override.getValue();
        if(vae_override && vae !== 'None'){
            console.log('Override VAE to', vae);
        } else {
            vae_override = false;
        }

        globalThis.generate.lastPos = createPromptResult.positivePromptLeft;
        globalThis.generate.lastPosColored = createPromptResult.positivePromptLeftColored;
        globalThis.generate.lastPosR = createPromptResult.positivePromptRight;
        globalThis.generate.lastPosRColored = createPromptResult.positivePromptRightColored;
        globalThis.generate.lastNeg = createPromptResult.negativePrompt;
        globalThis.generate.lastCharacter = createPromptResult.charactersName;
        globalThis.generate.lastImagePrefix = createPromptResult.img_prefix;
        if(createPromptResult.thumbImage)
            globalThis.generate.lastThumb = createPromptResult.thumbImage;

        const generateData = {
            addr: apiAddress,
            auth: apiAuth,
            uuid: browserUUID,
            
            queueManager: {
                genType:'normal',
                isRegional:true,
                apiInterface:apiInterface,
                finalInfo: '',
                loop: loop,
                loops: loops,
                thumb:createPromptResult.thumbImage || globalThis.generate.lastThumb,
                id:createPromptResult.charactersName,
            },

            model: globalThis.dropdownList.model.getValue(),
            vpred: checkVpred(),
            positive_left: swap?createPromptResult.positivePromptRight:createPromptResult.positivePromptLeft,
            positive_right: swap?createPromptResult.positivePromptLeft:createPromptResult.positivePromptRight,
            negative: createPromptResult.negativePrompt,
            width: width,
            height: height,
            cfg: globalThis.generate.cfg.getFloat(),
            step: globalThis.generate.step.getValue(),
            seed: createPromptResult.randomSeed,
            sampler: globalThis.generate.sampler.getValue(),
            scheduler: globalThis.generate.scheduler.getValue(),
            refresh:globalThis.generate.api_preview_refresh_time.getValue(),
            hifix: hifix,
            refiner: refiner,
            regional: regional,
            vae: {vae_override: vae_override, vae: vae},
            skip_layer: readSkipLayer(),
            forge_dtype: readForgeDtypeSettings(SETTINGS),
            adetailer: createADetailer(apiInterface),
            ...(SETTINGS.api_model_type === 'Checkpoint' ? {                
                controlnet: createControlNet(),                
            } : {
                unet: {
                    enable: true,
                    model: globalThis.dropdownList.model.getValue(),
                    dtype: SETTINGS.api_interface === 'WebUI'
                        ? SETTINGS.api_model_file_diffusion_weight_dtype
                        : globalThis.dropdownList.diffusion_model_weight_dtype.getValue(),
                    vae_model: globalThis.dropdownList.vae_unet.getValue(),
                    clip_model: globalThis.dropdownList.textencoder.getValue(),
                    clip_type: globalThis.dropdownList.textencoder_type.getValue(),
                    clip_device: globalThis.dropdownList.textencoder_device.getValue(),
                },
            }),

            img_prefix: getImageSavePrefix(apiInterface, createPromptResult.img_prefix)
        }
        
        let finalInfo = `${createPromptResult.finalInfo}\n`;
            finalInfo += `Positive Left:\n${createPromptResult.positivePromptLeftColored}\n`;
            finalInfo += `Positive Right:\n${createPromptResult.positivePromptRightColored}\n`;
            finalInfo += `Negative:\n[color=${negativeColor}]${generateData.negative}[/color]\n\n`;
            finalInfo += `Layout: [[color=${brownColor}]${generateData.width} x ${generateData.height}[/color]]\t`;
            finalInfo += `CFG: [[color=${brownColor}]${generateData.cfg}[/color]]\t`;
            finalInfo += `Setp: [[color=${brownColor}]${generateData.step}[/color]]\n`;
            finalInfo += `Sampler: [[color=${brownColor}]${generateData.sampler}[/color]]\n`;
            finalInfo += `Scheduler: [[color=${brownColor}]${generateData.scheduler}[/color]]\n`;            
            finalInfo += generateData.hifix.info;
            if(SETTINGS.api_model_type === 'Checkpoint') {
                finalInfo += generateData.refiner.info;
            }
            finalInfo += generateData.regional.info;
            finalInfo +=`\n`;

        generateData.queueManager.finalInfo = finalInfo;

        const nameList = generateData.queueManager.id.replaceAll('\n', ' | ');
        const fullPrompt = `${createPromptResult.positivePromptLeft}\n${createPromptResult.positivePromptRight}`;
        const seedLabel = formatQueueJobSeed(createPromptResult.randomSeed, generateData.hifix?.enable, LANG);
        globalThis.queueManager.attach(
            [   (nameList === '') ? LANG.generate_regional.replace('{0}', `${seedLabel} | ${fullPrompt}`) : 
                LANG.generate_regional.replace('{0}', `${seedLabel} | ${nameList}`), 
                fullPrompt
            ],
            generateData
        );
    }

    globalThis.generate.generate_single.setClickable(true);
    globalThis.generate.generate_batch.setClickable(true);
    globalThis.generate.generate_same.setClickable(true);
    globalThis.generate.generate_hires?.syncFromGallery?.();
    
    if(globalThis.globalSettings.generate_auto_start) {
        await startQueue();
    } else {
        globalThis.mainGallery.hideLoading('success', '');
    }
}

export async function seartGenerateRegional(apiInterface, generateData){
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

        globalThis.mainGallery.appendImageData(image, `${generateData.seed}`, `${generateData.positive_left}\n${generateData.positive_right}`, globalThis.globalSettings.scroll_to_last, generateData.queueManager?.finalInfo);
    }

    const SETTINGS = globalThis.globalSettings;
    const FILES = globalThis.cachedFiles;
    const LANG = FILES.language[SETTINGS.language];

    globalThis.generate.nowAPI = apiInterface;
    let ret = 'success';
    let retCopy = '';
    let breakNow = false;

    try {
        let result;
        if (globalThis.inBrowser) {
            result = await sendWebSocketMessage({ type: 'API', method: 'runComfyUI_Regional', params: [generateData] });
        } else {
            result = await globalThis.api.runComfyUI_Regional(generateData);
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
                    try {
                        if (globalThis.inBrowser) {
                            await sendWebSocketMessage({ type: 'API', method: 'closeWsComfyUI', params: [parsedResult.prompt_id] });
                        } else {
                            await globalThis.api.closeWsComfyUI(parsedResult.prompt_id);
                        }
                    } catch (error) {
                        console.warn('Failed to close ComfyUI websocket:', error);
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
    let ret = 'success';
    let retCopy = '';
    let breakNow = false;

    try {
        let result;
        if (globalThis.inBrowser) {
            result = await sendWebSocketMessage({ type: 'API', method: 'runWebUI_Regional', params: [generateData] });
        } else {
            result = await globalThis.api.runWebUI_Regional(generateData);
        }        
        
        if(globalThis.generate.cancelClicked) {
            breakNow = true;
        } else {
            const typeResult = typeof result;
            if(typeResult === 'string'){
                if(result.startsWith('Error')){
                    if(result.endsWith('Cancelled')) {
                        console.log('Generate regional cancelled from queue manager');
                    } else {
                        ret = LANG.gr_error_creating_image.replace('{0}',result).replace('{1}', apiInterface)
                        retCopy = result;
                        breakNow = true;
                    }
                } else {
                    globalThis.mainGallery.appendImageData(result, `${generateData.seed}`, `${generateData.positive_left}\nBREAK\n${generateData.positive_right}`, globalThis.globalSettings.scroll_to_last, generateData.queueManager?.finalInfo);
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
    } else {
        try {
            if (globalThis.inBrowser) {
                await sendWebSocketMessage({ type: 'API', method: 'stopPollingWebUI'});
            } else {
                await globalThis.api.stopPollingWebUI();
            }
        } catch (error) {
            console.warn('Failed to stop WebUI polling:', error);
        }
    }

    if (globalThis.cachedFiles.controlnetProcessorListWebUI === 'none') {   // aDetailer might not installed 
        await updateADetailerModelList();
    }
    
    return {ret, retCopy, breakNow }
}
