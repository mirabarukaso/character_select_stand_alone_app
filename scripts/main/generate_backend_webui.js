import { ipcMain, net } from 'electron';
import path from 'node:path';
import { sendToRenderer } from './generate_backend_comfyui.js';
import { forgeOverrideSettings, forgeResidentUnloadDecision } from './sageFp16Switch.js';
import { makeBackendLockKey, tryAcquireBackendBusy, releaseBackendBusy, forceReleaseBackendBusy } from '../../main-common.js';

const CAT = '[WebUI]';
// Forge applies checkpoint and additional modules before /options returns.
const SET_MODEL_TIMEOUT = 300000;
const FORGE_IDLE_TIMEOUT = 30000;
const FORGE_IDLE_POLL = 500;
const FORGE_UNLOAD_RETRY_WAIT = 500;
const FORGE_UNLOAD_TIMEOUT = 60000;
const webuiBackends = new Map();
const WEBUI_BUSY = 'Error: WebUI is busy, cannot run new generation, please try again later.';

function getWebUIBackend(addr) {
    const key = makeBackendLockKey('WebUI', addr);
    if (!webuiBackends.has(key)) {
        webuiBackends.set(key, new WebUI(addr));
    }
    return webuiBackends.get(key);
}

async function beginWebUIJob(generateData) {
    const addr = generateData.addr;
    const uuid = generateData.uuid || 'none';
    const got = await tryAcquireBackendBusy('WebUI', addr, uuid);
    if (!got.acquired) {
        console.warn(CAT, WEBUI_BUSY);
        return { ok: false, error: WEBUI_BUSY };
    }
    const backend = getWebUIBackend(addr);
    backend.addr = addr;
    backend.uuid = uuid;
    backend.cancelMark = false;
    return { ok: true, backend, uuid, addr };
}

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

function moduleBasename(value) {
    return path.basename(String(value ?? ''));
}

function normalizedModuleNames(list) {
    if (!Array.isArray(list)) return [];
    return list.map(item => moduleBasename(item)).filter(name => name !== '').sort((a, b) => a.localeCompare(b));
}

function sameModuleList(left, right) {
    const a = normalizedModuleNames(left);
    const b = normalizedModuleNames(right);
    return a.length === b.length && a.every((name, index) => name === b[index]);
}

function checkpointKey(value) {
    if (value == null || value === '') return '';
    let text = String(value).trim();
    const bracket = text.lastIndexOf(' [');
    if (bracket > 0 && text.endsWith(']')) {
        text = text.slice(0, bracket);
    }
    return text.replaceAll('\\', '/');
}

function sameCheckpoint(current, next) {
    if (current === next) return true;
    const left = checkpointKey(current);
    const right = checkpointKey(next);
    return left !== '' && left === right;
}

function hasOption(base, key) {
    return !!base && Object.hasOwn(base, key);
}

// A fresh GET can match the frontend and still be a different loaded state.
// First launch and a settings reset have not posted yet, so those keys are sent anyway.
function allowOption(base, key, force) {
    if (hasOption(base, key)) return true;
    return force === true && Object.keys(optionBase(base)).length === 0;
}

function moduleName(value) {
    const base = moduleBasename(value);
    if (!base || base === 'None' || base === 'Automatic' || base === 'Default') return '';
    return base;
}

// Start from an empty list, then add only the modules this request sets.
function forgeModuleNames(unet, vae) {
    const modules = [];
    if (unet?.enable === true) {
        const clip = moduleName(unet.clip_model);
        const vaeModel = moduleName(unet.vae_model);
        if (clip) modules.push(clip);
        if (vaeModel) modules.push(vaeModel);
        return modules;
    }
    if (vae?.vae_override) {
        const vaeName = moduleName(vae.vae);
        if (vaeName) modules.push(vaeName);
    }
    return modules;
}

function optionBase(current) {
    return current && typeof current === 'object' ? current : {};
}

function nextCheckpoint(base, model, unet, force = false) {
    if (!allowOption(base, 'sd_model_checkpoint', force)) return undefined;
    let checkpoint;
    if (unet?.enable === true && unet.model) checkpoint = unet.model;
    else if (unet?.enable !== true && model && model !== 'Default') checkpoint = model;
    if (checkpoint === undefined) return undefined;
    if (!force && sameCheckpoint(base.sd_model_checkpoint, checkpoint)) return undefined;
    return checkpoint;
}

function nextSdVae(base, vae, force = false) {
    if (!vae?.vae_override || !allowOption(base, 'sd_vae', force)) return undefined;
    if (!force && vae.vae === base.sd_vae) return undefined;
    return vae.vae;
}

function residentCheckpoint(base, model, unet) {
    const next = nextCheckpoint(base, model, unet);
    if (next !== undefined) return checkpointKey(next);
    return checkpointKey(base?.sd_model_checkpoint);
}

function residentModules(base, unet, vae) {
    if (!hasOption(base, 'forge_additional_modules')) {
        return normalizedModuleNames(base?.forge_additional_modules);
    }
    const modules = forgeModuleNames(unet, vae);
    if (!sameModuleList(modules, base.forge_additional_modules)) return normalizedModuleNames(modules);
    return normalizedModuleNames(base.forge_additional_modules);
}

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatCudaFree(value) {
    return Number.isFinite(value) ? String(value) : 'unavailable';
}

function requestFailureDetail(result) {
    if (result?.error) return result.error;
    if (result?.status) return `HTTP ${result.status}`;
    return 'request failed';
}

function cudaSystemFree(memory) {
    const value = memory?.cuda?.system?.free;
    return Number.isFinite(value) ? value : null;
}

function nextFilenamePattern(base, img_prefix, force = false) {
    if (!allowOption(base, 'directories_filename_pattern', force)) return undefined;
    const unchanged = hasOption(base, 'directories_filename_pattern') && base.directories_filename_pattern === img_prefix;
    if (unchanged && !force) return undefined;
    if (!unchanged && img_prefix !== '[date]') {
        console.error(CAT, 'Override directories_filename_pattern with:', img_prefix);
    }
    return img_prefix;
}

function skipLayerText(value, fallback) {
    if (value == null) return fallback;
    return String(value);
}

function skipLayerPercent(value, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    const clamped = Math.min(1, Math.max(0, number));
    return Math.round(clamped * 100) / 100;
}

function isMossImage(unet) {
    return unet?.enable === true && unet?.clip_type === 'moss_image';
}

// Forge has single-layer skip only. Comma-separated layer numbers stay one string.
function normalizeForgeSkipLayer(skipLayer) {
    const source = skipLayer && typeof skipLayer === 'object' ? skipLayer : {};
    return {
        slg_enable: true,
        slg_single_layers: skipLayerText(source.single_layers, '22'),
        slg_start_percent: skipLayerPercent(source.start_percent, 0),
        slg_end_percent: skipLayerPercent(source.end_percent, 1),
    };
}

function forgeSkipLayerFor(isForge, unet, skipLayer) {
    if (isForge !== true) return null;
    if (isMossImage(unet)) return normalizeForgeSkipLayer(skipLayer);
    return { slg_enable: false };
}

function buildWebUIOptionPayload(current, isForge, model, vae, unet, img_prefix, skipLayer, force = false) {    //NOSONAR
    const base = optionBase(current);
    const payload = {};
    const forge = isForge === true && allowOption(base, 'forge_additional_modules', force);
    const forgeSkipLayer = forgeSkipLayerFor(isForge, unet, skipLayer);

    const checkpoint = nextCheckpoint(base, model, unet, force);
    if (checkpoint !== undefined) payload.sd_model_checkpoint = checkpoint;

    if (forge) {
        const modules = forgeModuleNames(unet, vae);
        if (force || !sameModuleList(modules, base.forge_additional_modules)) {
            payload.forge_additional_modules = modules;
        }
    } else {
        const sdVae = nextSdVae(base, vae, force);
        if (sdVae !== undefined) payload.sd_vae = sdVae;
    }

    const pattern = nextFilenamePattern(base, img_prefix, force);
    if (pattern !== undefined) payload.directories_filename_pattern = pattern;

    return {
        options: Object.keys(payload).length > 0 ? payload : null,
        forgeSkipLayer,
    };
}

function webuiAuthHeaders(auth, extra = {}) {
    const headers = { ...extra };
    if (auth?.includes(':')) {
        headers.Authorization = `Basic ${Buffer.from(auth).toString('base64')}`;
    }
    return headers;
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
        this.isForge = null; // null = not detected, true = Forge, false = A1111
        this.backendOptions = null; // last GET /sdapi/v1/options body
        this.optionsApplied = false; // false until POST /options succeeds; settings reset clears it
        this.forgeSkipLayer = null; // Forge moss SLG override, merged into override_settings only
        this.forgeResident = null; // last txt2img checkpoint, modules, and FP16 switches
        this.residentBaseline = null; // options snapshot taken before setModel
        this.cancelMark = false;
    }

    async detectBackendType(addr, auth) {
        return new Promise((resolve) => {
            const apiUrl = `http://${addr}/sdapi/v1/options`;
            const request = net.request({
                method: 'GET',
                url: apiUrl,
                headers: webuiAuthHeaders(auth),
                timeout: this.timeout,
            });

            const fail = (message) => {
                if (this.isForge === true) {
                    console.warn(`${CAT} ${message}; keeping the previous Forge options`);
                    resolve(true);
                    return;
                }
                console.warn(`${CAT} ${message}; assuming A1111`);
                resolve(false);
            };

            let responseData = '';
            request.on('response', (response) => {
                response.on('data', (chunk) => {
                    responseData += chunk;
                });
                response.on('end', () => {
                    if (response.statusCode !== 200) {
                        fail(`Failed to read options, HTTP ${response.statusCode}`);
                        return;
                    }

                    try {
                        const options = JSON.parse(responseData);
                        this.backendOptions = options;
                        const isForge = 'forge_additional_modules' in options;
                        console.log(CAT, `Backend detected: ${isForge ? 'Forge' : 'A1111'}`);
                        resolve(isForge);
                    } catch (error) {
                        fail(`Failed to parse options: ${error}`);
                    }
                });
            });

            request.on('error', (error) => {
                fail(`Failed to read options: ${error.message}`);
            });

            request.on('timeout', () => {
                request.destroy();
                fail(`Options request timed out after ${this.timeout}ms`);
            });

            request.end();
        });
    }

    postOptions(auth, optionPayload) {
        return new Promise((resolve) => {
            const body = JSON.stringify(optionPayload);
            const apiUrl = `http://${this.addr}/sdapi/v1/options`;
            const request = net.request({
                method: 'POST',
                url: apiUrl,
                headers: webuiAuthHeaders(auth, { 'Content-Type': 'application/json' }),
                timeout: SET_MODEL_TIMEOUT,
            });

            request.on('response', (response) => {
                let responseData = '';
                response.on('data', (chunk) => {
                    responseData += chunk;
                });
                response.on('end', () => {
                    if (response.statusCode !== 200) {
                        console.error(`${CAT} Error: setModel HTTP code: ${response.statusCode} - ${responseData}`);
                        resolve(`Error HTTP ${response.statusCode}`);
                        return;
                    }
                    resolve('200');
                });
            });

            request.on('error', (error) => {
                let ret = '';
                if (error.code === 'ECONNABORTED') {
                    console.error(`${CAT} Request timed out after ${SET_MODEL_TIMEOUT}ms`);
                    ret = `Error: Request timed out after ${SET_MODEL_TIMEOUT}ms`;
                } else {
                    console.error(CAT, 'Request failed:', error.message);
                    ret = `Error: Request failed:, ${error.message}`;
                }
                resolve(ret);
            });

            request.on('timeout', () => {
                request.destroy();
                console.error(`${CAT} Request timed out after ${SET_MODEL_TIMEOUT}ms`);
                resolve(`Error: Request timed out after ${SET_MODEL_TIMEOUT}ms`);
            });

            request.write(body);
            request.end();
        });
    }

    async setModel(addr, model, auth, vae, unet, img_prefix = '[date]', skipLayer = null) {
        this.addr = addr;
        this.residentBaseline = {
            checkpoint: checkpointKey(this.backendOptions?.sd_model_checkpoint),
            modules: normalizedModuleNames(this.backendOptions?.forge_additional_modules),
        };

        if (!this.isForge && unet?.enable === true) {
            console.error(CAT, 'Diffusion Model is not supported by original A1111, please use Forge Neo backend to enable this feature.');
            return 'Error: Diffusion Model is not supported by original A1111, please use Forge Neo backend to enable this feature.';
        }

        const forceApply = this.optionsApplied !== true;
        const built = buildWebUIOptionPayload(this.backendOptions, this.isForge, model, vae, unet, img_prefix, skipLayer, forceApply);
        this.forgeSkipLayer = built.forgeSkipLayer;
        const optionPayload = built.options;
        if (!optionPayload) {
            console.log(CAT, forceApply ? 'setModel skipped, no options to apply' : 'setModel skipped, options unchanged');
            return '200';
        }

        if (forceApply) {
            console.log(CAT, 'setModel apply options');
        }
        const result = await this.postOptions(auth, optionPayload);
        if (result === '200') {
            this.backendOptions = { ...this.backendOptions, ...optionPayload };
            this.optionsApplied = true;
        }
        return result;
    }

    create_override_settings_Forge(model, unet, vae, img_prefix = '[date]', skipLayer = null, forgeDtype = null) {
        const fp16 = forgeOverrideSettings(forgeDtype);
        if (!this.isForge) {
            this.forgeSkipLayer = null;
            if (fp16.forge_compute_fp16 || fp16.forge_sage_fp16_cast) {
                console.warn(CAT, 'FP16 switches skipped: backend is not Forge');
            }
            return {};
        }
        const built = buildWebUIOptionPayload(this.backendOptions, true, model, vae, unet, img_prefix, skipLayer);
        this.forgeSkipLayer = built.forgeSkipLayer;
        return { ...built.options, ...built.forgeSkipLayer, ...fp16 };
    }

    async run (generateData) {
        return new Promise((resolve, reject) => {
            const {addr, auth, uuid, model, vpred, positive, negative, width, height, 
                cfg, step, seed, sampler, scheduler, refresh, hifix, refiner, controlnet, adetailer, img_prefix} = generateData;
            this.addr = addr;
            this.refresh = refresh;
            this.lastProgress = -1;
            this.vpred = vpred;
            this.auth = auth;
            this.uuid = uuid;

            const override_settings = this.create_override_settings_Forge(model, generateData?.unet, generateData?.vae, img_prefix, generateData?.skip_layer, generateData?.forge_dtype);

            this.startPolling();

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

            if(this.isForge) {
                payload = {
                    ...payload,
                    "override_settings_restore_afterwards": true,
                    "override_settings": override_settings,
                }
            }

            if (hifix?.enable){
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
                };
                
                if (this.isForge) {
                    payload["hr_additional_modules"] = [];  //Fix Forge Error #10
                }
            }

            if (refiner?.enable && model !== refiner?.model) {
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

            const request = net.request({
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
                void releaseBackendBusy('WebUI', this.addr, this.uuid || 'none');
                resolve(ret);
            });
    
            request.on('timeout', () => {
                request.destroy();
                console.error(`${CAT} Request timed out after ${this.timeout}ms`);
                void releaseBackendBusy('WebUI', this.addr, this.uuid || 'none');
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
                    hifix, refiner, regional, controlnet, adetailer, img_prefix} = generateData;
            this.addr = addr;
            this.refresh = refresh;
            this.lastProgress = -1;
            this.vpred = vpred;
            this.auth = auth;
            this.uuid = uuid;

            const override_settings = this.create_override_settings_Forge(model, generateData?.unet, generateData?.vae, img_prefix, generateData?.skip_layer, generateData?.forge_dtype);

            // Forge Couple requires SINGLE line for each character with common prompt
            const positive = positive_left.replaceAll('\n', '').trim() + "\n" + positive_right.replaceAll('\n', '').trim();
            const ratioes = regional.ratio.split(',');
            const ratio_left = Number.parseFloat(ratioes[0]);
            const ratio_right = Number.parseFloat(ratioes[1]);
            const weight_left = Number.parseFloat(regional.str_left);
            const weight_right = Number.parseFloat(regional.str_right);

            this.startPolling();            

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
                    "forge couple": {
                        "args": [
                            true,           // enable
                            true,           // disable_hr
                            'Advanced',     // Mode ("Basic" | "Advanced" | "Mask")
                            "\n",           // separator \n
                            'Vertical',     // direction ("Horizontal" | "Vertical")
                            null,           // background
                            null,           // background_weight
                            [               // mapping
                                [
                                    0.0,        // x1
                                    ratio_left, // x2
                                    0.0,        // y1
                                    1.0,        // y2
                                    weight_left // weight
                                ],
                                [
                                    ratio_right,   
                                    1.0,
                                    0.0,
                                    1.0,
                                    weight_right
                                ]
                            ],              // mapping
                            "{ }",          // common_parser
                            false,          // common_debug
                            true,           // def_in_prompt
                            null,
                            null,
                            null,
                            null,
                            null,
                            null,
                        ]
                    },
                },
            }

            if(this.isForge) {
                payload = {
                    ...payload,
                    "override_settings_restore_afterwards": true,
                    "override_settings": override_settings,
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
                };
                
                if (this.isForge) {
                    payload["hr_additional_modules"] = [];  //Fix Forge Error #10
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
                void releaseBackendBusy('WebUI', this.addr, this.uuid || 'none');
                resolve(ret);
            });
    
            request.on('timeout', () => {
                request.destroy();
                console.error(`${CAT} Request timed out after ${this.timeout}ms`);
                void releaseBackendBusy('WebUI', this.addr, this.uuid || 'none');
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

    jsonRequest(method, path, body = undefined, timeout = this.timeout) {
        return new Promise((resolve) => {
            const request = net.request({
                method,
                url: `http://${this.addr}${path}`,
                headers: webuiAuthHeaders(this.auth, { 'Content-Type': 'application/json' }),
                timeout,
            });
            const chunks = [];
            const fail = (error) => resolve({ ok: false, error });

            request.on('response', (response) => {
                response.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
                response.on('end', () => {
                    const text = Buffer.concat(chunks).toString();
                    let json = null;
                    if (text) {
                        try {
                            json = JSON.parse(text);
                        } catch (error) {
                            resolve({ ok: false, status: response.statusCode, error: `Decode error ${error}` });
                            return;
                        }
                    }
                    resolve({ ok: response.statusCode === 200, status: response.statusCode, json });
                });
            });
            request.on('error', (error) => fail(error.message));
            request.on('timeout', () => {
                request.destroy();
                fail(`timed out after ${timeout}ms`);
            });
            if (body !== undefined) request.write(JSON.stringify(body));
            request.end();
        });
    }

    async waitForForgeIdle() {
        const deadline = Date.now() + FORGE_IDLE_TIMEOUT;
        while (Date.now() < deadline) {
            const progress = await this.jsonRequest('GET', '/sdapi/v1/progress');
            if (progress.ok && Number(progress.json?.state?.job_count) === 0) return true;
            await delay(FORGE_IDLE_POLL); // NOSONAR S9382 sequential poll until Forge is idle
        }
        return false;
    }

    async releaseForgeResidentWeights(generateData) {
        if (this.isForge !== true) return;

        const fp16 = forgeOverrideSettings(generateData?.forge_dtype);
        const next = {
            compute: fp16.forge_compute_fp16 === true,
            sage: fp16.forge_sage_fp16_cast === true,
            checkpoint: residentCheckpoint(this.backendOptions, generateData?.model, generateData?.unet),
            modules: residentModules(this.backendOptions, generateData?.unet, generateData?.vae),
        };
        const decision = forgeResidentUnloadDecision(
            this.forgeResident,
            next,
            this.forgeResident ? null : this.residentBaseline,
        );
        this.forgeResident = next;
        if (!decision.unload) return;

        const reasons = decision.reasons.join('; ');
        const idle = await this.waitForForgeIdle();
        if (!idle) {
            console.log(CAT, 'unload checkpoint:', reasons, 'progress still busy, skipped');
            return;
        }

        const beforePayload = await this.jsonRequest('GET', '/sdapi/v1/memory');
        const before = beforePayload.ok ? cudaSystemFree(beforePayload.json) : null;
        const unloaded = await this.jsonRequest('POST', '/sdapi/v1/unload-checkpoint', {}, FORGE_UNLOAD_TIMEOUT);
        if (!unloaded.ok) {
            const detail = requestFailureDetail(unloaded);
            console.log(CAT, 'unload checkpoint:', reasons, `unload-checkpoint failed: ${detail}`, `cuda.system.free ${formatCudaFree(before)} -> unavailable`);
            return;
        }

        const afterPayload = await this.jsonRequest('GET', '/sdapi/v1/memory');
        const after = afterPayload.ok ? cudaSystemFree(afterPayload.json) : null;
        console.log(CAT, 'unload checkpoint:', reasons, `cuda.system.free ${formatCudaFree(before)} -> ${formatCudaFree(after)}`);
        if (before == null || after == null || after > before) return;

        await delay(FORGE_UNLOAD_RETRY_WAIT);
        const again = await this.jsonRequest('POST', '/sdapi/v1/unload-checkpoint', {}, FORGE_UNLOAD_TIMEOUT);
        const retryPayload = await this.jsonRequest('GET', '/sdapi/v1/memory');
        const retryFree = retryPayload.ok ? cudaSystemFree(retryPayload.json) : null;
        const retryDetail = again.ok ? '' : ` ${requestFailureDetail(again)}`;
        console.log(CAT, `unload checkpoint again:${retryDetail}`, `cuda.system.free ${formatCudaFree(after)} -> ${formatCudaFree(retryFree)}`);
    }
}

async function setupGenerateBackendWebUI() {

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
        cancelWebUI('none');
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
    const backend = getWebUIBackend(generateData.addr);
    let result = await backend.makeHttpRequestControlnet(
        url,
        generateData.auth,
        'GET',
        null,
        null,
        backend.timeout
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
    const backend = getWebUIBackend(generateData.addr);
    if (backend.isForge === null)
        backend.isForge = await backend.detectBackendType(generateData.addr, generateData.auth);

    await updateControlNetHashList(generateData);
    await updateControlProcessorList(generateData);
    await updateAdModelList(generateData);
    await updateUpscalerModelList(generateData);
}

async function runWebUI(generateData){
    const started = await beginWebUIJob(generateData);
    if (!started.ok) {
        console.warn(CAT, '[runWebUI] WebUI is busy, cannot run new generation, please try again later.');
        return started.error;
    }
    const backend = started.backend;
    const uuid = started.uuid;
    const addr = started.addr;

    await refreshModelLists(generateData);
    
    const result = await backend.setModel(generateData.addr, generateData.model, generateData.auth, 
            generateData.vae?generateData.vae:{vae_override: false, vae: 'Automatic'},
            generateData.unet?.clip_type ? { clip_type: generateData.unet.clip_type } : null,
            generateData.img_prefix, generateData.skip_layer);

    if(result === '200') {
        try {
            if (backend.isForge) await backend.releaseForgeResidentWeights(generateData);
            if(backend.uuid !== 'none')
                console.log(CAT, 'Running WebUI with uuid:', generateData.uuid);
            const imageData = await backend.run(generateData);
            await releaseBackendBusy('WebUI', addr, uuid);

            if(backend.cancelMark) {
                return 'Error: Cancelled';
            }

            if (typeof imageData === 'string' && imageData.startsWith('Error:')) {
                console.error(CAT, imageData);
                return `${imageData}`;
            }

            const jsonData =  JSON.parse(imageData);
            sendToRenderer(uuid, `updateProgress`, `100`, '100%');
            const image = jsonData.images[0];
            console.log(CAT, 'Image retrieved from WebUI run, sending to renderer');
            return `data:image/png;base64,${image}`;
        } catch (error) {            
            console.error(CAT, 'Image not found or invalid:', error);
            await releaseBackendBusy('WebUI', addr, uuid);
            return `Error: Image not found or invalid: ${error}`;
        }
    }

    console.log(CAT, 'result is not 200', result);
    await releaseBackendBusy('WebUI', addr, uuid);
    return result;
} 

async function runWebUI_Regional(generateData){
    const started = await beginWebUIJob(generateData);
    if (!started.ok) {
        console.warn(CAT, '[runWebUI] WebUI is busy, cannot run new generation, please try again later.');
        return started.error;
    }
    const backend = started.backend;
    const uuid = started.uuid;
    const addr = started.addr;

    await refreshModelLists(generateData);

    const result = await backend.setModel(generateData.addr, generateData.model, generateData.auth, 
            generateData.vae?generateData.vae:{vae_override: false, vae: 'Automatic'},
            generateData.unet?.clip_type ? { clip_type: generateData.unet.clip_type } : null,
            generateData.img_prefix, generateData.skip_layer);            

    if(result === '200') {
        try {
            if (backend.isForge) await backend.releaseForgeResidentWeights(generateData);
            if(backend.uuid !== 'none')
                console.log(CAT, 'Running Regional WebUI with uuid:', generateData.uuid);
            const imageData = await backend.runRegional(generateData);
            await releaseBackendBusy('WebUI', addr, uuid);

            if(backend.cancelMark) {
                return 'Error: Cancelled';
            }

            if (typeof imageData === 'string' && imageData.startsWith('Error:')) {
                console.error(CAT, imageData);
                return `${imageData}`;
            }

            const jsonData =  JSON.parse(imageData);
            sendToRenderer(uuid, `updateProgress`, `100`, '100%');
            const image = jsonData.images[0];
            console.log(CAT, 'Image retrieved from WebUI Regional run, sending to renderer');
            return `data:image/png;base64,${image}`;
        } catch (error) {            
            console.error(CAT, 'Image not found or invalid:', error);
            await releaseBackendBusy('WebUI', addr, uuid);
            return `Error: Image not found or invalid: ${error}`;
        }
    }

    console.log(CAT, 'result is not 200', result);
    await releaseBackendBusy('WebUI', addr, uuid);
    return result;
}

async function runWebUI_ControlNet(generateData) {
    const started = await beginWebUIJob(generateData);
    if (!started.ok) {
        console.warn(CAT, '[runWebUI_ControlNet] WebUI is busy, cannot run new generation, please try again later.');
        return started.error;
    }
    const backend = started.backend;
    const uuid = started.uuid;
    const addr = started.addr;

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

        const result = await backend.makeHttpRequestControlnet(
            `http://${generateData.addr}/controlnet/detect`,
            generateData.auth,
            'POST',
            null,
            controlNetDetect,
            backend.timeout
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
        await releaseBackendBusy('WebUI', addr, uuid);
    }
}

async function python_runWebUI(generateData, isRegional=false, skeletonKey=false) {
    const uuid = generateData.uuid || 'none';
    if(skeletonKey) {
        console.warn(CAT, 'The Skeleton Key triggerd, Mutex Lock set to false');
        await forceReleaseBackendBusy('WebUI', generateData.addr);
        sendToRenderer(uuid, `updateProgress`, 'warn', CAT,  'The Skeleton Key triggerd, Mutex Lock set to false');
    }

    const infoMsg = `Running WebUI ${isRegional ? 'Regional ' : ''}from Python with uuid: ${uuid}`;
    sendToRenderer(uuid, `updateProgress`, 'log', CAT, infoMsg);
    console.log(CAT, infoMsg);

    if (!generateData.vae) {
        generateData.vae = { vae_override: false, vae: 'None' };
    }

    let newImage = null;
    if (isRegional) {
        newImage = await runWebUI_Regional(generateData);
    } else {
        newImage = await runWebUI(generateData);
    }    

    if (typeof newImage === 'string' && newImage.startsWith('Error:')) {
        console.log(CAT, 'Failed to retrieve image from WebUI Python run:', newImage);
        return newImage;
    } 

    console.log(CAT, 'Image retrieved from WebUI Python run.');
    sendToRenderer(uuid, `updateProgress`, newImage);
    return "Success";
}

function cancelWebUI(uuid = 'none') {
    console.log(CAT, 'Processing interrupted for', uuid);
    for (const backend of webuiBackends.values()) {
        if (backend.uuid === uuid) {
            backend.cancelMark = true;
            backend.cancelGenerate();
            backend.stopPolling();
        }
    }
}

function cancelAllWebUI() {
    console.log(CAT, 'Cancelling all WebUI jobs');
    for (const backend of webuiBackends.values()) {
        backend.cancelMark = true;
        try {
            backend.cancelGenerate();
        } catch (error) {
            console.warn(CAT, 'Failed to cancel WebUI job:', error);
        }
        backend.stopPolling();
    }
}

function startPollingWebUI(uuid = 'none') {
    for (const backend of webuiBackends.values()) {
        if (backend.uuid === uuid) {
            backend.startPolling();
        }
    }
}

function stopPollingWebUI(uuid = 'none') {
    for (const backend of webuiBackends.values()) {
        if (backend.uuid === uuid) {
            backend.stopPolling();
        }
    }
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
    for (const backend of webuiBackends.values()) {
        backend.isForge = null;
        backend.backendOptions = null;
        backend.optionsApplied = false;
        backend.forgeResident = null;
        backend.residentBaseline = null;
    }
}

export {
    setupGenerateBackendWebUI,
    runWebUI,
    runWebUI_Regional,
    runWebUI_ControlNet,
    cancelWebUI,
    cancelAllWebUI,
    startPollingWebUI,
    stopPollingWebUI,
    getControlNetProcessorList,
    getADetailerModelList,
    getUpscalersModelList,
    resetModelLists,
    python_runWebUI
};
