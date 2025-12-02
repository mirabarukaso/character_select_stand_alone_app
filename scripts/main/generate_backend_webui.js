import { ipcMain, net } from 'electron';
import path from 'node:path';
import { sendToRenderer } from './generate_backend_comfyui.js';
import { getMutexBackendBusy, setMutexBackendBusy } from '../../main-common.js';

const CAT = '[WebUI]';
let backendWebUI = null;
let cancelMark = false;

let contronProcessorList = 'none';
let contronNetModelHashList = 'none';
let aDetailerModelList = 'none';
let upscalersModelList = 'none';

function findControlNetModelByName(name) {
  const cleanName = path.basename(name, '.safetensors');
  
  const matchedModel = contronNetModelHashList.find(model => {
    const modelName = model.split(' [')[0];
    return modelName === cleanName;
  });

  return matchedModel || 'none';
}

function applyControlnet(payload, controlnet){    
    if(controlnet.length === 0) {
        return payload;
    }

    let newPayload = payload;
    newPayload["alwayson_scripts"]['controlnet']={};
    newPayload["alwayson_scripts"]['controlnet']['args']=[];
    for( const slot of controlnet) {
        const controlNetArg = {};
        // skip empty
        if(slot.postModel === 'none') {
            console.log(CAT,"[applyControlnet] Skip ", slot);
            continue;
        }
        
        controlNetArg["enabled"] = true;
        if(slot.image) {
            controlNetArg["module"] = slot.preModel;
            controlNetArg["image"] = slot.image;
        } else if(slot.imageAfter) {
            controlNetArg["module"] = 'none';   // skip pre
            controlNetArg["image"] = slot.imageAfter;
        } else {  // should not here
            continue;            
        }            
        controlNetArg["processor_res"] = Number.parseInt(slot.preRes);
        controlNetArg["model"] = findControlNetModelByName(slot.postModel);
        controlNetArg["weight"] = Number.parseFloat(slot.postStr);
        controlNetArg["guidance_start"] = Number.parseFloat(slot.postStart);
        controlNetArg["guidance_end"] = Number.parseFloat(slot.postEnd);

        // Forge
        controlNetArg["control_mode"] = "Balanced";
        controlNetArg["resize_mode"] = "Just Resize";
        controlNetArg["threshold_a"] = 0.5;
        controlNetArg["threshold_b"] = 0.5;
        controlNetArg["hr_option"] = "Both";
        controlNetArg["pixel_perfect"] = true;

        newPayload["alwayson_scripts"]["controlnet"]["args"].push(controlNetArg);
    };                

    return newPayload;
}

function applyADetailer(payload, adetailer) {    
    if(adetailer.length === 0) {
        return payload;
    }

    let newPayload = payload;    
    newPayload["alwayson_scripts"]['ADetailer']={};
    newPayload["alwayson_scripts"]['ADetailer']['args']=[
        true,   // ad_enable
        false,  // skip_img2img
    ];
    for( const slot of adetailer) {
        const aDetailerArg = {};

        aDetailerArg['ad_model'] = slot.model;
        aDetailerArg['ad_prompt'] = slot.prompt;
        aDetailerArg['ad_negative_prompt'] = slot.negative_prompt;
        // Detection
        aDetailerArg['ad_confidence'] = slot.confidence;
        aDetailerArg['ad_mask_k'] = slot.mask_k;
        aDetailerArg['ad_mask_filter_method'] = slot.mask_filter_method;
        // Mask Preprocessing
        aDetailerArg['ad_dilate_erode'] = slot.dilate_erode;
        aDetailerArg['ad_mask_merge_invert'] = slot.ask_merge_invert;
        // Inpainting
        aDetailerArg['ad_mask_blur'] = slot.mask_blur;
        aDetailerArg['ad_denoising_strength'] = slot.denoise;                    

        newPayload['alwayson_scripts']['ADetailer']['args'].push(aDetailerArg);
    }

    return newPayload;
}
class WebUI {
    constructor(addr) {
        this.addr = addr;
        this.preview = 0;
        this.refresh = 0;
        this.timeout = 5000;
        this.ret = 'success';
        this.lastProgress = -1;
        this.pollingInterval = null;
        this.vpred = false;
        this.auth = '';
        this.uuid = 'none';
    }

    async setModel(addr, model, auth) {
        this.addr = addr;
        return new Promise((resolve, reject) => {            
            if (model !== 'Default') {
                const optionPayload = {"sd_model_checkpoint": model }
                const body = JSON.stringify(optionPayload);
                const apiUrl = `http://${this.addr}/sdapi/v1/options`;

                let headers = {
                    'Content-Type': 'application/json'
                };
                if (auth?.includes(':')) {
                    const encoded = Buffer.from(auth).toString('base64');
                    headers['Authorization'] = `Basic ${encoded}`;
                }

                let request = net.request({
                    method: 'POST',
                    url: apiUrl,
                    headers: headers,
                    timeout: this.timeout,
                });

                request.on('response', (response) => {
                    let responseData = ''            
                    response.on('data', (chunk) => {
                        responseData += chunk
                    })
                    response.on('end', () => {
                        if (response.statusCode !== 200) {
                            console.error(`${CAT} Error: setModel HTTP code: ${response.statusCode} - ${response.Data}`);
                            resolve(`Error HTTP ${response.statusCode}`);
                        }
                        
                        resolve('200');
                    })
                });
                
                request.on('error', (error) => {
                    let ret = '';
                    if (error.code === 'ECONNABORTED') {
                        console.error(`${CAT} Request timed out after ${this.timeout}ms`);
                        ret = `Error: Request timed out after ${this.timeout}ms`;
                    } else {
                        console.error(CAT, 'Request failed:', error.message);
                        ret = `Error: Request failed:, ${error.message}`;
                    }
                    resolve(ret);
                });
        
                request.on('timeout', () => {
                    request.destroy();
                    console.error(`${CAT} Request timed out after ${this.timeout}ms`);
                    resolve(`Error: Request timed out after ${this.timeout}ms`);
                });

                request.write(body);
                request.end();   
            }

            resolve('200');
        });
    }

    async run (generateData) {
        return new Promise((resolve, reject) => {
            const {addr, auth, uuid, model, vpred, positive, negative, width, height, cfg, step, seed, sampler, scheduler, refresh, hifix, refiner, controlnet, adetailer} = generateData;
            this.addr = addr;
            this.refresh = refresh;
            this.lastProgress = -1;
            this.vpred = vpred;
            this.auth = auth;
            this.uuid = uuid;

            backendWebUI.startPolling();

            let payload = {        
                "prompt": positive,
                "negative_prompt": negative,
                "steps": step,
                "width": width,
                "height": height,
                "sampler_index": sampler,
                "scheduler": scheduler,
                "batch_size" : 1,
                "seed": seed,
                "cfg_scale": cfg,
                "save_images": true,
                "alwayson_scripts": {},
            }

            if (hifix.enable){
                payload = {
                    ...payload,
                    "enable_hr": true,
                    "denoising_strength": hifix.denoise,
                    "firstphase_width": width,
                    "firstphase_height": height,
                    "hr_scale": hifix.scale,
                    "hr_upscaler": hifix.model,
                    "hr_second_pass_steps": hifix.steps,
                    "hr_sampler_name": sampler,
                    "hr_scheduler": scheduler,
                    "hr_prompt": positive,
                    "hr_negative_prompt": negative,
                    "hr_additional_modules": [],        //Fix Forge Error #10
                }
            }

            if (refiner.enable && model !== refiner.model) {
                payload = {
                    ...payload,
                    "refiner_checkpoint": refiner.model,
                    "refiner_switch_at": refiner.ratio,
                }
            }
            // ControlNet
            if(controlnet) {
                payload = applyControlnet(payload, controlnet);
            }

            // aDetailer
            if(adetailer) {
                payload = applyADetailer(payload, adetailer);
            }
            
            const body = JSON.stringify(payload);
            const apiUrl = `http://${this.addr}/sdapi/v1/txt2img`;
            
            let headers = {
                'Content-Type': 'application/json'
            };
            if (auth?.includes(':')) {
                const encoded = Buffer.from(auth).toString('base64');
                headers['Authorization'] = `Basic ${encoded}`;
            }

            let request = net.request({
                method: 'POST',
                url: apiUrl,
                headers: headers,
                timeout: this.timeout,
            });

            const chunks = [];

            request.on('response', (response) => {
                response.on('data', (chunk) => {
                    chunks.push(Buffer.from(chunk));
                });

                response.on('end', () => {
                    if (response.statusCode !== 200) {
                        console.error(`${CAT} HTTP error: ${response.statusCode}`);
                        resolve(`Error: HTTP error ${response.statusCode}`);
                        return;
                    }
                    
                    const buffer = Buffer.concat(chunks);
                    resolve(buffer);
                })
            });
            
            request.on('error', (error) => {
                let ret = '';
                if (error.code === 'ECONNABORTED') {
                    console.error(`${CAT} Request timed out after ${this.timeout}ms`);
                    ret = `Error: Request timed out after ${this.timeout}ms`;
                } else {
                    console.error(CAT, 'Request failed:', error.message);
                    ret = `Error: Request failed:, ${error.message}`;
                }
                setMutexBackendBusy(false); // Release the mutex lock
                resolve(ret);
            });
    
            request.on('timeout', () => {
                request.destroy();
                console.error(`${CAT} Request timed out after ${this.timeout}ms`);
                setMutexBackendBusy(false); // Release the mutex lock
                resolve(`Error: Request timed out after ${this.timeout}ms`);
            });

            request.write(body);
            request.end(); 
        });
    }

    async runRegional(generateData) {
        return new Promise((resolve, reject) => {
            const {addr, auth, uuid, model, vpred, positive_left, positive_right, negative, 
                    width, height, cfg, step, seed, sampler, scheduler, refresh, 
                    hifix, refiner, regional, controlnet, adetailer} = generateData;
            this.addr = addr;
            this.refresh = refresh;
            this.lastProgress = -1;
            this.vpred = vpred;
            this.auth = auth;
            this.uuid = uuid;

            const positive = positive_left + "\nBREAK\n" + positive_right;
            const ratio = regional.ratio;

            backendWebUI.startPolling();            

            let payload = {        
                "prompt": positive,
                "negative_prompt": negative,
                "steps": step,
                "width": width,
                "height": height,
                "sampler_index": sampler,
                "scheduler": scheduler,
                "batch_size" : 1,
                "seed": seed,
                "cfg_scale": cfg,
                "save_images": true,
                "alwayson_scripts": {
                    "Regional Prompter": {
                        "args": [
                            true,           // Active
                            false,          // debug
                            'Matrix',       // Mode (Matrix, Mask, Prompt)
                            'Columns',      // Mode (Matrix)  (Horizontal, Vertical, Columns, Rows)
                            'Mask',         // Mode (Mask) (Mask)
                            'Prompt',       // Mode (Prompt) (Prompt, Prompt-Ex)
                            ratio,          // Ratios
                            "",             // Base Ratios
                            false,          // Use Base
                            false,          // Use Common
                            false,          // Use Neg-Common
                            'Attention',    // Calcmode (Attention, Latent)
                            false,          // Not Change AND
                            '0',            // LoRA Textencoder
                            '0',            // LoRA U-Net
                            '0',            // Threshold
                            "",             // Mask
                            '0',            // LoRA stop step
                            '0',            // LoRA Hires stop step
                            false,          // flip
                        ]
                    },
                }
            }

            if (hifix.enable){
                payload = {
                    ...payload,
                    "enable_hr": true,
                    "denoising_strength": hifix.denoise,
                    "firstphase_width": width,
                    "firstphase_height": height,
                    "hr_scale": hifix.scale,
                    "hr_upscaler": hifix.model,
                    "hr_second_pass_steps": hifix.steps,
                    "hr_sampler_name": sampler,
                    "hr_scheduler": scheduler,
                    "hr_prompt": positive,
                    "hr_negative_prompt": negative,
                    "hr_additional_modules": [],        //Fix Forge Error #10
                }
            }

            if (refiner.enable && model !== refiner.model) {
                payload = {
                    ...payload,
                    "refiner_checkpoint": refiner.model,
                    "refiner_switch_at": refiner.ratio,
                }
            }
            // ControlNet
            if(controlnet) {
                payload = applyControlnet(payload, controlnet);
            }

            // aDetailer
            if(adetailer) {
                payload = applyADetailer(payload, adetailer);
            }
            
            const body = JSON.stringify(payload);
            const apiUrl = `http://${this.addr}/sdapi/v1/txt2img`;
            
            let headers = {
                'Content-Type': 'application/json'
            };
            if (auth?.includes(':')) {
                const encoded = Buffer.from(auth).toString('base64');
                headers['Authorization'] = `Basic ${encoded}`;
            }

            let request = net.request({
                method: 'POST',
                url: apiUrl,
                headers: headers,
                timeout: this.timeout,
            });

            const chunks = [];

            request.on('response', (response) => {
                response.on('data', (chunk) => {
                    chunks.push(Buffer.from(chunk));
                });

                response.on('end', () => {
                    if (response.statusCode !== 200) {
                        console.error(`${CAT} HTTP error: ${response.statusCode}`);
                        resolve(`Error: HTTP error ${response.statusCode}`);
                        return;
                    }
                    
                    const buffer = Buffer.concat(chunks);
                    resolve(buffer);
                })
            });
            
            request.on('error', (error) => {
                let ret = '';
                if (error.code === 'ECONNABORTED') {
                    console.error(`${CAT} Request timed out after ${this.timeout}ms`);
                    ret = `Error: Request timed out after ${this.timeout}ms`;
                } else {
                    console.error(CAT, 'Request failed:', error.message);
                    ret = `Error: Request failed:, ${error.message}`;
                }
                setMutexBackendBusy(false); // Release the mutex lock
                resolve(ret);
            });
    
            request.on('timeout', () => {
                request.destroy();
                console.error(`${CAT} Request timed out after ${this.timeout}ms`);
                setMutexBackendBusy(false); // Release the mutex lock
                resolve(`Error: Request timed out after ${this.timeout}ms`);
            });

            request.write(body);
            request.end(); 
        });
    }

    cancelGenerate() {
        const auth = this.auth;
        const apiUrl = `http://${this.addr}/sdapi/v1/interrupt`;

        let headers = {
            'Content-Type': 'application/json'
        };
        if (auth?.includes(':')) {
            const encoded = Buffer.from(auth).toString('base64');
            headers['Authorization'] = `Basic ${encoded}`;
        }

        let request = net.request({
            method: 'POST',
            url: apiUrl,
            headers: headers,
            timeout: this.timeout,
        });

        request.end();           
    }

    startPolling() {
        this.lastProgress = 0;
        if(this.refresh === 0)
            return;

        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }

        const interval = (this.refresh > 0 ? this.refresh : 1) * 1000;
        this.pollingInterval = setInterval(() => {
            const auth = this.auth;
            const apiUrl = `http://${this.addr}/sdapi/v1/progress`;

            let headers = {};
            if (auth?.includes(':')) {
                const encoded = Buffer.from(auth).toString('base64');
                headers['Authorization'] = `Basic ${encoded}`;
            }

            let request = net.request({
                method: 'GET',
                url: apiUrl,
                headers: headers,
                timeout: this.timeout,
            });

            const chunks = [];

            request.on('response', (response) => {
                response.on('data', (chunk) => {
                    chunks.push(Buffer.from(chunk));
                });

                response.on('end', () => {
                    if (response.statusCode !== 200) {
                        console.error(`${CAT} HTTP polling error: ${response.statusCode}`);
                        return;
                    }
                    
                    try {
                        const buffer = Buffer.concat(chunks);
                        const jsonData = JSON.parse(buffer.toString());
                        const progress = jsonData.progress;

                        if (Math.abs(progress - this.lastProgress) >= 0.05 && progress !== 0) {
                            this.lastProgress = progress;
                            const image = jsonData.current_image;
                            const previewData = `data:image/png;base64,${image}`;
                            sendToRenderer(this.uuid, `updatePreview`, previewData);
                            sendToRenderer(this.uuid, `updateProgress`, `${Math.floor(progress*100)}`, '100%');
                        }
                    } catch (error) {
                        console.error(`${CAT} Ignore Error: ${error}`);
                    }                
                });
            });
            
            request.on('error', (error) => {
                console.error(`${CAT} Polling request failed: ${error.message}`);
                if (error.code === 'ECONNREFUSED') {
                    this.stopPolling();
                    console.log(`${CAT} Polling stopped: connection refused`);
                }
            });

            request.on('timeout', () => {
                request.destroy();
                console.error(`${CAT} Polling request timed out after ${this.timeout}ms`);
            });

            request.end();
        }, interval);
    }

    stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }        
    }

    async makeHttpRequestControlnet(
        apiUrl,
        auth,
        method = 'GET',
        headers = null,
        data = null,
        timeout = 5000
    ) {
        return new Promise((resolve, reject) => {
            try {
                // Default headers if none provided
                let defaultHeaders = headers || { 'Content-Type': 'application/json' };
                if (auth?.includes(':')) {
                    const encoded = Buffer.from(auth).toString('base64');
                    defaultHeaders['Authorization'] = `Basic ${encoded}`;
                }

                const chunks = [];
                let request;

                if (method.toUpperCase() === 'GET') {
                    request = net.request({
                        method: 'GET',
                        url: apiUrl,
                        headers: defaultHeaders,
                        timeout: timeout,
                    });
                    
                    request.on('response', (response) => {
                        response.on('data', (chunk) => {
                            chunks.push(Buffer.from(chunk));
                        });

                        response.on('end', () => {
                            if (response.statusCode !== 200) {
                                console.error(`${CAT} HTTP error: ${response.statusCode}`);
                                console.log(response);
                                resolve(`Error: HTTP error ${response.statusCode}`);
                            }
                            
                            try {
                                const buffer = Buffer.concat(chunks);
                                const jsonData = JSON.parse(buffer.toString());
                                resolve(jsonData);
                            } catch(error) {
                                console.error(`${CAT} modelList Decode error: ${error}`);
                                resolve(`Error: modelList Decode error ${error}`);
                            }
                        });
                    });
                    
                    request.on('error', (error) => {
                        let ret = '';
                        if (error.code === 'ECONNABORTED') {
                            console.error(`${CAT} Request timed out after ${this.timeout}ms`);
                            ret = `Error: Request timed out after ${this.timeout}ms`;
                        } else {
                            console.error(CAT, 'Request failed:', error.message);
                            ret = `Error: Request failed:, ${error.message}`;
                        }
                        request.destroy(); // Explicitly destroy to close any lingering connection
                        resolve(ret);
                    });
            
                    request.on('timeout', () => {
                        request.destroy();
                        console.error(`${CAT} Request timed out after ${this.timeout}ms`);
                        resolve(`Error: Request timed out after ${this.timeout}ms`);
                    });

                    request.end();
                } else if (method.toUpperCase() === 'POST') {
                    request = net.request({
                        method: 'POST',
                        url: apiUrl,
                        headers: defaultHeaders,
                        timeout: timeout,
                    });

                    request.on('response', (response) => {
                        response.on('data', (chunk) => {
                            chunks.push(Buffer.from(chunk));
                        });

                        response.on('end', () => {
                            if (response.statusCode !== 200) {
                                console.error(`${CAT} HTTP error: ${response.statusCode}`);
                                console.log(response);
                                resolve(`Error: HTTP error ${response.statusCode}`);
                            }
                            
                            try {
                                const buffer = Buffer.concat(chunks);
                                const jsonData = JSON.parse(buffer.toString());
                                if(jsonData?.info === 'Success') {
                                    resolve(jsonData.images[0]);
                                } else {
                                    console.error(CAT, 'Error: No image from backend');
                                    resolve('Error: No image from backend');
                                }
                            } catch(error) {
                                console.error(`${CAT} Decode error: ${error}`);
                                resolve(`Error: Decode error ${error}`);
                            }
                        });
                    });
                    
                    request.on('error', (error) => {
                        let ret = '';
                        if (error.code === 'ECONNABORTED') {
                            console.error(`${CAT} Request timed out after ${this.timeout}ms`);
                            ret = `Error: Request timed out after ${this.timeout}ms`;
                        } else {
                            console.error(CAT, 'Request failed:', error.message);
                            ret = `Error: Request failed:, ${error.message}`;
                        }
                        request.destroy(); // Explicitly destroy to close any lingering connection
                        resolve(ret);
                    });
            
                    request.on('timeout', () => {
                        request.destroy();
                        console.error(`${CAT} Request timed out after ${this.timeout}ms`);
                        resolve(`Error: Request timed out after ${this.timeout}ms`);
                    });

                    const body = JSON.stringify(data);
                    request.write(body);
                    request.end(); 
                } else {
                    throw new Error('Method must be either "GET" or "POST"');
                }
            } catch (error) {
                console.log('Error:', error);
                resolve(`Error: ${error.message}`);
            }
        });
    }
}

async function setupGenerateBackendWebUI() {
    backendWebUI = new WebUI('127.0.0.1:7860');

    ipcMain.handle('generate-backend-webui-run', async (event, generateData) => {
        return await runWebUI(generateData);
    });

    ipcMain.handle('generate-backend-webui-run-regional', async (event, generateData) => {
        return await runWebUI_Regional(generateData);
    });    

    ipcMain.handle('generate-backend-webui-run-controlnet', async (event, generateData) => {
        return await runWebUI_ControlNet(generateData);
    });

    ipcMain.handle('generate-backend-webui-start-polling', async (event) => {
        startPollingWebUI();
    });

    ipcMain.handle('generate-backend-webui-stop-polling', async (event) => {
        stopPollingWebUI();
    });

    ipcMain.handle('generate-backend-webui-cancel', async (event) => {        
        cancelWebUI();
    });
    
    ipcMain.handle('generate-backend-webui-get-module-list', async (event) => {
        return getControlNetProcessorList();
    });
    
    ipcMain.handle('generate-backend-webui-get-ad-model', async (event) => {
        return getADetailerModelList();
    });

    ipcMain.handle('generate-backend-webui-get-upscaler-model', async (event) => {
        return getUpscalersModelList();
    });

    ipcMain.handle('generate-backend-webui-reset-model-list', async (event) => {
        return resetModelLists();
    });
}

async function getListFromBAckend(generateData, url){
    let result = await backendWebUI.makeHttpRequestControlnet(
        url,
        generateData.auth,
        'GET',
        null,
        null,
        backendWebUI.timeout
    );

    if (typeof result === 'string' && result.startsWith('Error:')) {
        console.error(CAT, 'GET request failed:', result);
        console.log(CAT, 'URL = ', url);
        result = 'none';
    }

    return result;
}

async function updateControlNetHashList(generateData) {
    // update contronNe tModel Hash List first
    // that's really annoying, why they did not use prefix with model name?!
    const  result = await getListFromBAckend(generateData, `http://${generateData.addr}/controlnet/model_list?update=true`);
    contronNetModelHashList = result?.model_list;    
    if (!Array.isArray(contronNetModelHashList)) {
        console.error(CAT, 'Invalid controlnet model_list from GET');
        contronNetModelHashList = 'none';
    }

    return contronNetModelHashList;
}

async function updateControlProcessorList(generateData) {
    // update controlnet module_list
    const result = await getListFromBAckend(generateData, `http://${generateData.addr}/controlnet/module_list`);
    contronProcessorList = result?.module_list;    
    if (!Array.isArray(contronProcessorList)) {
        console.error(CAT, 'Invalid controlnet module_list from GET');
        contronProcessorList = 'none';
    }
    return contronProcessorList;
}

async function updateAdModelList(generateData) {
    // update aDetailer Model List 
    const result = await getListFromBAckend(generateData, `http://${generateData.addr}/adetailer/v1/ad_model`);
    aDetailerModelList = result?.ad_model;
    if (!Array.isArray(aDetailerModelList)) {
        console.error(CAT, 'Invalid aDetailer ad_model from GET');
        aDetailerModelList = 'not_exist';    // ADetailer plugin may not exist, stop refresh
    }
    return aDetailerModelList;
}

async function updateUpscalerModelList(generateData) {
    // update Upscaler Model List 
    const jsonData = await getListFromBAckend(generateData, `http://${generateData.addr}/sdapi/v1/upscalers`);
    if (typeof jsonData === 'string') {
        upscalersModelList = 'none';
        return upscalersModelList;
    } 

    const names = jsonData
        .filter(item => item.name && item.name !== "None")
        .map(item => item.name);
    
    upscalersModelList = names;
    return upscalersModelList;
}

async function refreshModelLists(generateData) {
    if (contronNetModelHashList === 'none') {
        console.log(CAT, "Refresh controlNet model hash list:");
        const result = await updateControlNetHashList(generateData);
        console.log(result);        
    }

    if (contronProcessorList === 'none') {
        console.log(CAT, "Refresh ControlNet processor list:");
        contronProcessorList = await updateControlProcessorList(generateData);
        console.log(contronProcessorList);
    }

    if (aDetailerModelList === 'none') {
        console.log(CAT, "Refresh aDetailer model list:");
        aDetailerModelList = await updateAdModelList(generateData);
        console.log(aDetailerModelList);
    }

    if (upscalersModelList === 'none'){
        console.log(CAT, "Refresh upscaler model list:");
        upscalersModelList = await updateUpscalerModelList(generateData);
        console.log(upscalersModelList);
    }
}

async function runWebUI(generateData){
    const isBusy = await getMutexBackendBusy();
    if (isBusy) {
        console.warn(CAT, '[runWebUI] WebUI is busy, cannot run new generation, please try again later.');
        return 'Error: WebUI is busy, cannot run new generation, please try again later.';
    }
    setMutexBackendBusy(true); // Acquire the mutex lock
    cancelMark = false;

    await refreshModelLists(generateData);
    
    const result = await backendWebUI.setModel(generateData.addr, generateData.model, generateData.auth);
    if(result === '200') {
        try {
            if(backendWebUI.uuid !== 'none')
                console.log(CAT, 'Running A1111 with uuid:', generateData.uuid);
            const imageData = await backendWebUI.run(generateData);
            setMutexBackendBusy(false); // Release the mutex lock

            if(cancelMark) {
                return 'Error: Cancelled';
            }

            if (typeof imageData === 'string' && imageData.startsWith('Error:')) {
                console.error(CAT, imageData);
                return `${imageData}`;
            }

            const jsonData =  JSON.parse(imageData);
            sendToRenderer(backendWebUI.uuid, `updateProgress`, `100`, '100%');
            const image = jsonData.images[0];
            // parameters info
            return `data:image/png;base64,${image}`;
        } catch (error) {            
            console.error(CAT, 'Image not found or invalid:', error);
            return `Error: Image not found or invalid: ${error}`;
        }
    }

    console.log(CAT, 'result is not 200', result);
    return result;
} 

async function runWebUI_Regional(generateData){
    const isBusy = await getMutexBackendBusy();
    if (isBusy) {
        console.warn(CAT, '[runWebUI] WebUI is busy, cannot run new generation, please try again later.');
        return 'Error: WebUI is busy, cannot run new generation, please try again later.';
    }
    setMutexBackendBusy(true); // Acquire the mutex lock
    cancelMark = false;

    await refreshModelLists(generateData);
    
    const result = await backendWebUI.setModel(generateData.addr, generateData.model, generateData.auth);
    if(result === '200') {
        try {
            if(backendWebUI.uuid !== 'none')
                console.log(CAT, 'Running Regional A1111 with uuid:', generateData.uuid);
            const imageData = await backendWebUI.runRegional(generateData);
            setMutexBackendBusy(false); // Release the mutex lock

            if(cancelMark) {
                return 'Error: Cancelled';
            }

            if (typeof imageData === 'string' && imageData.startsWith('Error:')) {
                console.error(CAT, imageData);
                return `${imageData}`;
            }

            const jsonData =  JSON.parse(imageData);
            sendToRenderer(backendWebUI.uuid, `updateProgress`, `100`, '100%');
            const image = jsonData.images[0];
            // parameters info
            return `data:image/png;base64,${image}`;
        } catch (error) {            
            console.error(CAT, 'Image not found or invalid:', error);
            return `Error: Image not found or invalid: ${error}`;
        }
    }

    console.log(CAT, 'result is not 200', result);
    return result;
}

async function runWebUI_ControlNet(generateData) {
    const isBusy = await getMutexBackendBusy();
    if (isBusy) {
        console.warn(CAT, '[runWebUI_ControlNet] WebUI is busy, cannot run new generation, please try again later.');
        return 'Error: WebUI is busy, cannot run new generation, please try again later.';
    }
    setMutexBackendBusy(true); // Acquire lock for the entire operation
    cancelMark = false;

    try {
        await updateControlNetHashList(generateData);

        const controlNetDetect = {
            "controlnet_module": generateData.controlNet,
            "controlnet_input_images": [generateData.imageData],
            "controlnet_processor_res": generateData.outputResolution,
            "controlnet_threshold_a": 64,
            "controlnet_threshold_b": 64,
            "controlnet_masks": [],
            "low_vram": false
        };

        const result = await backendWebUI.makeHttpRequestControlnet(
            `http://${generateData.addr}/controlnet/detect`,
            generateData.auth,
            'POST',
            null,
            controlNetDetect,
            backendWebUI.timeout
        );

        if (typeof result === 'string' && result.startsWith('Error:')) {
            console.error(CAT, 'POST request failed:', result);
            return result;
        }

        return result;
    } catch (error) {
        console.error(CAT, 'Unexpected error in ControlNet run:', error);
        return `Error: Unexpected failure - ${error.message}`;
    } finally {
        setMutexBackendBusy(false); // Release lock after everything (success or error)
    }
}

function cancelWebUI() {
    console.log(CAT, 'Processing interrupted');
    cancelMark = true;
    backendWebUI.cancelGenerate();
    stopPollingWebUI();
}

function startPollingWebUI() {
    backendWebUI.startPolling();
}

function stopPollingWebUI() {
    backendWebUI.stopPolling();    
}

function getControlNetProcessorList() {
    return contronProcessorList;
}

function getADetailerModelList() {
    return aDetailerModelList;
}

function getUpscalersModelList() {
    return upscalersModelList;
}

function resetModelLists() {
    contronProcessorList = 'none';
    contronNetModelHashList = 'none';
    aDetailerModelList = 'none';
    upscalersModelList = 'none';
}

export {
    setupGenerateBackendWebUI,
    runWebUI,
    runWebUI_Regional,
    runWebUI_ControlNet,
    cancelWebUI,
    startPollingWebUI,
    stopPollingWebUI,
    getControlNetProcessorList,
    getADetailerModelList,
    getUpscalersModelList,
    resetModelLists
};
