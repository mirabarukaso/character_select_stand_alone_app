import { sendWebSocketMessage } from '../../../webserver/front/wsRequest.js';
import { fileToBase64 } from '../generate.js';

let lastTaggerOptions = null;

export function createHtmlOptions(itemList) {
    let options = [];
    if (globalThis.globalSettings.api_interface === 'ComfyUI') {
        for (const item of itemList) {
            if (String(item).startsWith('CV->')) continue;
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

function modelOptionsOptions(modelChoice) {
    if(modelChoice.startsWith('wd-')) {
        return ['Rating/General/Character', 'General/Character', 'General', 'Rating',  'Character'];
    } else if(modelChoice.startsWith('cl_')) {
        return ['All', 'General/Character/Artist/CopyRight', 'General', 'Character', 'Artist', 'Copyright', 'Meta', 'Model', 'Rating', 'Quality'];
    } else if(modelChoice.startsWith('camie-')) {
        return ['without Year', 'All', 'without Year/Rating', 'General/Character/Artist/CopyRight', 'general', 'rating', 'meta', 'character', 'artist', 'copyright', 'year'];
    } else {
        return ['N/A']
    }
}

export function createImageTagger(metadataContainer, cachedImage) {    
    const SETTINGS = globalThis.globalSettings;
    const FILES = globalThis.cachedFiles;
    const LANG = FILES.language[SETTINGS.language];

    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'image-tagger-buttons';

    const modelOptions = document.createElement('select');
    const genThreshold = document.createElement('select');
    const charThreshold = document.createElement('select');

    const imageTaggerModels = document.createElement('select');
    imageTaggerModels.className = 'controlnet-select';
    imageTaggerModels.innerHTML = createHtmlOptions(FILES.imageTaggerModels);
    imageTaggerModels.value = lastTaggerOptions?.model_choice || FILES.imageTaggerModels[0];
    imageTaggerModels.addEventListener('change', () => {
        modelOptions.innerHTML = createHtmlOptions(modelOptionsOptions(imageTaggerModels.value));
    });
    buttonContainer.appendChild(imageTaggerModels);
    
    genThreshold.className = 'controlnet-select';
    genThreshold.innerHTML = createHtmlOptions([0.25,0.3,0.35,0.4,0.45,0.5,0.55,0.6,0.65,0.7,0.75,0.8,0.85,0.9,0.95,1]);
    genThreshold.value = lastTaggerOptions?.gen_threshold || 0.55;
    buttonContainer.appendChild(genThreshold);
    
    charThreshold.className = 'controlnet-select';
    charThreshold.innerHTML = createHtmlOptions([0.25,0.3,0.35,0.4,0.45,0.5,0.55,0.6,0.65,0.7,0.75,0.8,0.85,0.9,0.95,1]);
    charThreshold.value = lastTaggerOptions?.char_threshold || 0.6;
    buttonContainer.appendChild(charThreshold);

    modelOptions.className = 'controlnet-select';
    modelOptions.innerHTML = createHtmlOptions(modelOptionsOptions(lastTaggerOptions?.model_choice || FILES.imageTaggerModels[0]));
    buttonContainer.appendChild(modelOptions);

    const imageTaggerButton = document.createElement('button');
    imageTaggerButton.className = 'image-tagger-process';
    imageTaggerButton.textContent = LANG.image_tagger_run;
    imageTaggerButton.addEventListener('click', async () => {            
        if(!imageTaggerButton.disabled) {
            if(imageTaggerModels.value === 'none') {
                imageTaggerButton.textContent = 'Select Model';
                imageTaggerButton.style.cursor = 'not-allowed';
                imageTaggerButton.disabled = true;
                
                setTimeout(() => {
                    imageTaggerButton.textContent = LANG.image_tagger_run;
                    imageTaggerButton.style.cursor = 'pointer';
                    imageTaggerButton.disabled = false;
                }, 500);
                return;
            }

            imageTaggerButton.textContent = LANG.image_tagger_run_processing;
            imageTaggerButton.style.cursor = 'not-allowed';
            imageTaggerButton.disabled = true;
            try {                    
                let imageBase64 = await fileToBase64(cachedImage);
                if (typeof imageBase64 === 'string' && imageBase64.startsWith('data:')) {
                    imageBase64 = imageBase64.split(',')[1];
                }

                let result = '';
                if (globalThis.inBrowser) {
                    result = await sendWebSocketMessage({ 
                        type: 'API', 
                        method: 'runImageTagger', 
                        params: [
                            imageBase64,
                            imageTaggerModels.value,
                            genThreshold.value,
                            charThreshold.value,
                            modelOptions.value
                        ]});
                } else {
                    result = await globalThis.api.runImageTagger({
                        image_input: imageBase64,
                        model_choice: imageTaggerModels.value,
                        gen_threshold: genThreshold.value,
                        char_threshold: charThreshold.value,
                        model_options: modelOptions.value
                    });
                }

                lastTaggerOptions = {
                    model_choice: imageTaggerModels.value,
                    gen_threshold: genThreshold.value,
                    char_threshold: charThreshold.value
                };

                if(result) {
                    imageTaggerButton.textContent = LANG.image_tagger_run_tagged;
                    console.log(result.join(', '));
                    globalThis.overlay.custom.closeCustomOverlaysByGroup('Info'); // close exist
                    globalThis.overlay.custom.createCustomOverlay('none', "\n\n" + result.join(', '),
                                                                384, 'center', 'left', null, 'Info');
                } else {
                    imageTaggerButton.textContent = LANG.image_tagger_run_no_tag;
                }   
            } catch (err) {
                console.error('Image Tagger error:', err);
                imageTaggerButton.textContent = LANG.image_tagger_run_error;
            }
            setTimeout(() => {
                imageTaggerButton.textContent = LANG.image_tagger_run;
                imageTaggerButton.style.cursor = 'pointer';
                imageTaggerButton.disabled = false;
            }, 2000);
        }
    });
    buttonContainer.appendChild(imageTaggerButton);
    
    metadataContainer.appendChild(buttonContainer);
}

