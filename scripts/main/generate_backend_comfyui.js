import { ipcMain, BrowserWindow, net } from 'electron';
import { WebSocket } from 'ws';
import * as wsService from '../../webserver/back/wsService.js';
import { getMutexBackendBusy, setMutexBackendBusy } from '../../main-common.js';

const CAT = '[ComfyUI]';
let backendComfyUI = null;
let cancelMark = false;

function sendToRendererEx(channel, data) {
    const window = BrowserWindow.getAllWindows();
    if (window[0]) {
        window[0].webContents.send(channel, data);
    } else {
        console.error(CAT, 'No focused window to send IPC message');
    }
}

function sendToRenderer(uuid, functionName, ...args) {
  if (!uuid || uuid === 'none') {
    sendToRendererEx('generate-backend', { functionName, args });
  } else if(uuid !== 'error') {
    const callbackName = `${uuid}-${functionName}`;
    const success = wsService.sendToClient(uuid, 'Callback', { callbackName, args }); 
    if(!success) {
      console.warn('Got error from WS. Set uuid to "error" for current generation');
      backendComfyUI.uuid = 'error';
    }
  }
}

function processImage(imageData) {
    try {
        if (Buffer.isBuffer(imageData)) {
            return imageData.toString('base64');
        } 
        else if (ArrayBuffer.isView(imageData) || Array.isArray(imageData)) {
            const buffer = Buffer.from(imageData);
            return buffer.toString('base64');
        } else {
            console.error(CAT, 'Invalid image data type:', typeof imageData);
            return null;
        }
    } catch (error) {
        console.error(CAT, 'Error converting image data to Base64:', error);
        return null;
    }
}

// eslint-disable-next-line sonarjs/cognitive-complexity
function applyControlnet(workflow, controlnet, workflowInfo){
  let {startIndex, now_pos, now_neg, refiner, ref_pos, ref_neg, hiresfix} = workflowInfo;
  let index = startIndex;

  if (Array.isArray(controlnet)) {
    let ipaActived = false;
    index = index + 1;
    for( const slot of controlnet) {
      // skip missing
      if(slot.postModel === 'none') {
        console.log(CAT,"[applyControlnet] Skip ", slot);
        continue;
      }

      if(slot.preModel.startsWith('ip-adapter->')) {
        if(ipaActived)
          continue;
        
        // Only accept the first IPA slot
        ipaActived = true;

        workflow[`${index}`] = {
          "inputs": {
            "base64text": slot.image
          },
          "class_type": "GzippedBase64ToImage",
          "_meta": {
            "title": "Gzipped Base64 To Image"
          }
        };

        workflow[`${index + 1}`] = {
          "inputs": {
            "ip_adapter_name": slot.postModel.replace('IPA->', ''),
            "clip_name": slot.preModel.replace('ip-adapter->', ''),
            "weight": slot.postStr,
            "start_at": slot.postStart,
            "end_at": slot.postEnd,
            "weight_type": "standard",
            "enabled": true,
            "model": [
              "44",
              0
            ],
            "image": [
              `${index}`,
              0
            ]
          },
          "class_type": "AV_IPAdapter",
          "_meta": {
            "title": "IP Adapter Apply"
          }
        };

        // Change model to IPA output
        workflow["34"]["inputs"]["model"] = [`${index + 1}`, 0];
        workflow["20"]["inputs"]["model"] = [`${index + 1}`, 0];

        // move to next
        index = index + 2;

        if(refiner){
          workflow[`${index}`] = {
            "inputs": {
              "ip_adapter_name": slot.postModel.replace('IPA->', ''),
              "clip_name": slot.preModel.replace('ip-adapter->', ''),
              "weight": slot.postStr,
              "start_at": slot.postStart,
              "end_at": slot.postEnd,
              "weight_type": "standard",
              "enabled": true,
              "model": [
                "44",
                0
              ],
              "image": [
                `${index - 2}`,
                0
              ]
            },
            "class_type": "AV_IPAdapter",
            "_meta": {
              "title": "IP Adapter Apply"
            }
          };

          // Change model refiner to IPA output
          workflow["39"]["inputs"]["model"] = [`${index}`, 0];
          workflow["20"]["inputs"]["model"] = [`${index}`, 0];
          
          // move to next
          index = index + 1;
        }
        continue;
      }

      if(slot.image) {  // need pre process and post process
        workflow[`${index}`] = {
          "inputs": {
            "base64text": slot.image
          },
          "class_type": "GzippedBase64ToImage",
          "_meta": {
            "title": "Gzipped Base64 To Image"
          }
        };

        workflow[`${index+1}`] = {
          "inputs": {
            "preprocessor": slot.preModel,
            "resolution": slot.preRes,
            "image": [
              `${index}`,
              0
            ]
          },
          "class_type": "AIO_Preprocessor",
          "_meta": {
            "title": "AIO Aux Preprocessor"
          }
        };

        workflow[`${index+2}`] = {
          "inputs": {
            "control_net_name": slot.postModel
          },
          "class_type": "ControlNetLoader",
          "_meta": {
            "title": "Load ControlNet Model"
          }
        };

        workflow[`${index+3}`] = {
          "inputs": {
            "strength": slot.postStr,
            "start_percent": slot.postStart,
            "end_percent": slot.postEnd,
            "positive": [
              `${now_pos}`,
              0
            ],
            "negative": [
              `${now_neg}`,
              0
            ],
            "control_net": [
              `${index+2}`,
              0
            ],
            "image": [
              `${index+1}`,
              0
            ],
            "vae": [
              "45",
              2
            ]
          },
          "class_type": "ControlNetApplyAdvanced",
          "_meta": {
            "title": "Apply ControlNet"
          }
        };

        // update condition point
        now_pos = index+3;
        now_neg = now_pos;

        workflow["36"]["inputs"]["positive"] = [`${now_pos}`, 0];
        workflow["36"]["inputs"]["negative"] = [`${now_neg}`, 1];

        // move to next
        index = index + 4;

        if(refiner) {
          workflow[`${index}`] = {
            "inputs": {
              "strength": slot.postStr,
              "start_percent": slot.postStart,
              "end_percent": slot.postEnd,
              "positive": [
                `${ref_pos}`,
                0
              ],
              "negative": [
                `${ref_neg}`,
                0
              ],
              "control_net": [
                `${index-4+1}`,
                0
              ],
              "image": [
                `${index-4}`,
                0
              ],
              "vae": [
                "43",
                2
              ]
            },
            "class_type": "ControlNetApplyAdvanced",
            "_meta": {
              "title": "Apply ControlNet"
            }
          };

          ref_pos = index;
          ref_neg = ref_pos;
          workflow["37"]["inputs"]["positive"] = [`${ref_pos}`, 0];
          workflow["37"]["inputs"]["negative"] = [`${ref_neg}`, 1];

          // move to next
          index = index + 1;
        }
        
        if(hiresfix && refiner) {
          workflow["20"]["inputs"]["positive"] = [`${ref_pos}`, 0];
          workflow["20"]["inputs"]["negative"] = [`${ref_neg}`, 1];
        } else if(hiresfix) {
          workflow["20"]["inputs"]["positive"] = [`${now_pos}`, 0];
          workflow["20"]["inputs"]["negative"] = [`${now_neg}`, 1];
        }
      } else if(slot.imageAfter) {  // only need post process
        workflow[`${index}`] = {
          "inputs": {
            "base64text": slot.imageAfter
          },
          "class_type": "GzippedBase64ToImage",
          "_meta": {
            "title": "Gzipped Base64 To Image"
          }
        };

        workflow[`${index+1}`] = {
          "inputs": {
            "control_net_name": slot.postModel
          },
          "class_type": "ControlNetLoader",
          "_meta": {
            "title": "Load ControlNet Model"
          }
        };

        workflow[`${index+2}`] = {
          "inputs": {
            "strength": slot.postStr,
            "start_percent": slot.postStart,
            "end_percent": slot.postEnd,
            "positive": [
              `${now_pos}`,
              0
            ],
            "negative": [
              `${now_neg}`,
              0
            ],
            "control_net": [
              `${index+1}`,
              0
            ],
            "image": [
              `${index}`,
              0
            ],
            "vae": [
              "45",
              2
            ]
          },
          "class_type": "ControlNetApplyAdvanced",
          "_meta": {
            "title": "Apply ControlNet"
          }
        };

        // update condition point
        now_pos = index+2;
        now_neg = now_pos;

        workflow["36"]["inputs"]["positive"] = [`${now_pos}`, 0];
        workflow["36"]["inputs"]["negative"] = [`${now_neg}`, 1];

        // move to next
        index = index + 3;

        if(refiner) {
          workflow[`${index}`] = {
            "inputs": {
              "strength": slot.postStr,
              "start_percent": slot.postStart,
              "end_percent": slot.postEnd,
              "positive": [
                `${ref_pos}`,
                0
              ],
              "negative": [
                `${ref_neg}`,
                0
              ],
              "control_net": [
                `${index-3+1}`,
                0
              ],
              "image": [
                `${index-3}`,
                0
              ],
              "vae": [
                "43",
                2
              ]
            },
            "class_type": "ControlNetApplyAdvanced",
            "_meta": {
              "title": "Apply ControlNet"
            }
          };

          ref_pos = index;
          ref_neg = ref_pos;
          workflow["37"]["inputs"]["positive"] = [`${ref_pos}`, 0];
          workflow["37"]["inputs"]["negative"] = [`${ref_neg}`, 1];

          // move to next
          index = index + 1;
        }

        if(hiresfix && refiner) {
          workflow["20"]["inputs"]["positive"] = [`${ref_pos}`, 0];
          workflow["20"]["inputs"]["negative"] = [`${ref_neg}`, 1];
        } else if(hiresfix) {
          workflow["20"]["inputs"]["positive"] = [`${now_pos}`, 0];
          workflow["20"]["inputs"]["negative"] = [`${now_neg}`, 1];
        }
      } else {  // should not here
        continue;
      }
    }
  }

  return {workflowCN:workflow, indexCN:index};
}

function applyADetailer(workflow, adetailers, workflowInfo){
  const {startIndex, refiner, hiresfix} = workflowInfo;
  let index =startIndex + 1;
  const modelUSE = refiner?43:45; // 45: default   43: refiner
  let imageVAED = hiresfix?28:6;
  const randomSeed = Math.floor(Math.random() * 4294967296); // 4294967296 = 2^32

  for(const adetailer of adetailers) {
    if(adetailer.mask_filter_method === 'Off')
      continue;    

    workflow[`${index}`] = {
      "inputs": {
        "model_name": adetailer.mask_filter_method,
        "device_mode": "AUTO"
      },
      "class_type": "SAMLoader",
      "_meta": {
        "title": "SAMLoader (Impact)"
      }
    };

    workflow[`${index + 1}`] = {
      "inputs": {
        "model_name": adetailer.model
      },
      "class_type": "UltralyticsDetectorProvider",
      "_meta": {
        "title": "UltralyticsDetectorProvider"
      }
    };

    workflow[`${index + 2}`] = {
      "inputs": {
        "text": adetailer.prompt,
        "clip": [
          `${modelUSE}`,
          1
        ]
      },
      "class_type": "CLIPTextEncode",
      "_meta": {
        "title": "CLIP Text Encode (Prompt)"
      }
    };

    workflow[`${index + 3}`] = {
      "inputs": {
        "text": adetailer.negative_prompt,
        "clip": [
          `${modelUSE}`,
          1
        ]
      },
      "class_type": "CLIPTextEncode",
      "_meta": {
        "title": "CLIP Text Encode (Prompt)"
      }
    };

    workflow[`${index + 4}`] = {
      "inputs": {
        "guide_size": 512,
        "guide_size_for": true,
        "max_size": 1024,
        "seed": randomSeed,
        "steps": 20,
        "cfg": 8,
        "sampler_name": "euler_ancestral",
        "scheduler": "normal",
        "denoise": adetailer.denoise,
        "feather": adetailer.mask_blur,
        "noise_mask": true,
        "force_inpaint": true,
        "bbox_threshold": adetailer.confidence,
        "bbox_dilation": adetailer.dilate_erode,
        "bbox_crop_factor": 3,
        "sam_detection_hint": `${adetailer.mask_merge_invert}`,
        "sam_dilation": 0,
        "sam_threshold": 0.93,
        "sam_bbox_expansion": 0,
        "sam_mask_hint_threshold": 0.7,
        "sam_mask_hint_use_negative": "False",
        "drop_size": 10,
        "wildcard": "",
        "cycle": 1,
        "inpaint_model": false,
        "noise_mask_feather": 20,
        "tiled_encode": false,
        "tiled_decode": false,
        "image": [
          `${imageVAED}`,
          0
        ],
        "model": [
          `${modelUSE}`,
          0
        ],
        "clip": [
          `${modelUSE}`,
          1
        ],
        "vae": [
          `${modelUSE}`,
          2
        ],
        "positive": [
          `${index + 2}`,
          0
        ],
        "negative": [
          `${index + 3}`,
          0
        ],
        "bbox_detector": [
          `${index + 1}`,
          0
        ],
        "sam_model_opt": [
          `${index}`,
          0
        ]
      },
      "class_type": "FaceDetailer",
      "_meta": {
        "title": "FaceDetailer"
      }
    };

    // set output to imagesaver
    workflow["29"].inputs.images = [`${index + 4}`, 0];

    // move next
    imageVAED = index + 4;
    index = index + 4 + 1;    
  }

  return workflow;
}

// HTTP quick health check: return true if HTTP responds
function checkHttpAlive(addr, timeout = 5000) {
  return new Promise((res) => {
    try {
      const apiUrl = /^https?:\/\//i.test(addr) ? `${addr}/` : `http://${addr}/`;
      const req = net.request({ method: 'GET', url: apiUrl, timeout: Math.min(2000, timeout) });
      let answered = false;

      function onResponse(response) {
        answered = true;
        // treat any HTTP response as alive (200 or non-200); errors will be caught on 'error'
        res(true);
        // consume data to let response finish
        response.on('data', () => {});
        response.on('end', () => {});
      }

      req.on('response', (response) => onResponse(response));
      req.on('error', () => {
        if (!answered) res(false);
      });
      req.on('timeout', () => {
        try { req.destroy(); } catch(err) { console.error(CAT, 'HTTP timeout destroy error:', err); }
        if (!answered) res(false);
      });
      req.end();
    } catch (e) {
      console.error(CAT, 'HTTP health check error:', e.message ?? e);
      res(false);
    }
  });
}

class ComfyUI {
  constructor(clientID) {
    this.clientID = clientID;
    this.prompt_id = clientID;
    this.addr = '127.0.0.1:8188';
    this.webSocket = null;
    this.preview = 0;
    this.refresh = 0;
    this.timeout = 5000;
    this.urlPrefix = '';
    this.step = 0;
    this.firstValidPreview = false;
    this.uuid = 'none';
  }

  cancelGenerate() {
    const apiUrl = `http://${this.addr}/interrupt`;
    let request = net.request({
      method: 'POST',
      url: apiUrl,
      timeout: this.timeout
    });

    request.on('response', (response) => {
      response.on('end', () => {
        if (response.statusCode !== 200) {
          console.error(`${CAT} HTTP error: ${response.statusCode} - ${response.Data}`);
          resolve(`Error: HTTP error: ${response.statusCode}`);
        }                    
      })
    })

    request.on('error', (error) => {
      console.warn(CAT, 'Error on cancel:', error);
    });

    request.end();
  }

  async openWS(prompt_id, skipFirst = true, index='29'){
    return new Promise((resolve) => {
      this.prompt_id = prompt_id;
      this.preview = 0;
      this.step = 0;
      this.firstValidPreview = !skipFirst;

      const wsUrl = `ws://${this.addr}/ws?clientId=${this.clientID}`;
      this.webSocket = new WebSocket(wsUrl);

      let settled = false;
      let timeoutTimer = null;
      let sockTimeoutAttached = false;

      function cleanupTimers() {
        if (timeoutTimer) { clearTimeout(timeoutTimer); timeoutTimer = null; }
      }

      function finalize(ret) {
        if (settled) return;            
        settled = true;
        cleanupTimers();
        setMutexBackendBusy(false);  // Release the mutex after getting image or error
        resolve(ret);
      }

      // schedule connection timeout with HTTP check fallback
      const scheduleConnTimeout = () => {
        cleanupTimers();
        timeoutTimer = setTimeout(async () => {
          if (settled) return;
          const alive = await checkHttpAlive(this.addr, this.timeout);
          if (alive) {
            // reschedule next timeout; do not terminate
            if (!settled) scheduleConnTimeout();
          } else {
            console.error(CAT, `WebSocket connection timed out and HTTP unreachable after ${this.timeout}ms`);
            try { this.webSocket?.terminate(); } catch(err) { console.error(CAT, 'WebSocket terminate error:', err);}
            finalize(`Error: WebSocket connection timed out after ${this.timeout}ms and HTTP unreachable`);
          }
        }, this.timeout);
      };

      // start initial timeout watcher
      scheduleConnTimeout();

      this.webSocket.on('open', () => {
        if (settled) return;
        cleanupTimers();
        // attach underlying socket timeout to detect idle socket; reuse same HTTP-check logic
        try {
          const sock = this.webSocket._socket;
          if (sock && typeof sock.setTimeout === 'function' && !sockTimeoutAttached) {
            sockTimeoutAttached = true;
            sock.setTimeout(this.timeout);
            sock.on('timeout', async () => {
              if (settled) return;
              console.warn(CAT, `WebSocket underlying socket timeout after ${this.timeout}ms -> performing HTTP check`);
              const alive = await checkHttpAlive(this.addr, this.timeout);
              if (alive) {
                console.log(CAT, 'HTTP is alive; ignore underlying socket timeout and continue monitoring.');
                // keep socket open and continue monitoring by scheduling next conn timeout
                scheduleConnTimeout();
              } else {
                console.error(CAT, `Underlying socket timeout and HTTP unreachable after ${this.timeout}ms`);
                try { this.webSocket?.terminate(); } catch(err) { console.error(CAT, 'WebSocket terminate error:', err); }
                finalize(`Error: WebSocket underlying socket timed out after ${this.timeout}ms and HTTP unreachable`);
              }
            });
          }
        } catch (e) {
          console.error(CAT, 'WebSocket open error:', e.message ?? e);
          finalize(`Error:${e.message ?? e}`);
        }
      });

      // eslint-disable-next-line sonarjs/cognitive-complexity
      this.webSocket.on('message', async (data) => {
        if (settled) return;
        // any incoming message -> reset timeout watcher
        cleanupTimers();
        scheduleConnTimeout();

        try {
          const message = JSON.parse(data.toString('utf8'));
          if (message.type === 'executing' || message.type === 'status') {
            const msgData = message.data;
            if (msgData.node === null && msgData.prompt_id === this.prompt_id) {
              try {
                  const image = await this.getImage(index);
                  if (image && Buffer.isBuffer(image)) {
                      const base64Image = processImage(image);
                      if (base64Image) {
                          finalize(`data:image/png;base64,${base64Image}`);
                          return;
                      } else {
                          finalize('Error: Failed to convert image to base64');
                          return;
                      }
                  }
                  if(cancelMark)
                    finalize('Error: Cancelled');
                  else 
                    finalize('Error: Image not found or invalid');
                  return;
              } catch (err) {
                  console.error(CAT, 'Error getting image:', err);
                  finalize(`Error: ${err.message ?? err}`);
                  return;
              }
            } else if(msgData?.status.exec_info.queue_remaining === 0 && this.step === 0) {    
              if(cancelMark) {
                finalize('Error: Cancelled');                  
              } else {
                console.log(CAT, 'No result from backend, running same promot? message =', message);
                finalize(`Error: No result from backend, running same promot?`);
              }
              return;
            }
          } else if(message.type === 'progress'){
            this.step += 1;
            const progress = message.data;
            if(progress?.value && progress?.max){
              sendToRenderer(this.uuid, `updateProgress`, progress.value, progress.max);
            }                    
          }
        } catch {
          // preview
          if (this.refresh !== 0) {
            if (this.preview !== 0 && this.preview % this.refresh === 0) {
              try {
                const previewData = data.slice(8);  //skip websocket header
                if(previewData.byteLength > 256){ // json parse failed 'executing' 110 ~ 120
                  if(this.firstValidPreview) { // skip 1st preview, might last image
                    const base64Data = processImage(previewData);
                    if (base64Data) {
                        sendToRenderer(this.uuid, `updatePreview`, `data:image/png;base64,${base64Data}`);
                    }
                  } else {
                    this.firstValidPreview = true;
                  }
                }
              } catch (err) {
                console.error(CAT, 'Error processing preview image:', err);
              }
            }
            this.preview += 1;  
          }                                        
        }
      });

      this.webSocket.on('error', (error) => {
          if (settled) return;
          cleanupTimers();
          console.error(CAT, 'WebSocket error:', error?.message ?? error);
          finalize(`Error:${error?.message ?? error}`);
      });

      this.webSocket.on('close', (code, reason) => {
        cleanupTimers();
        if (!settled) {
          // if closed before settle, return an error indicating close
          finalize(`Error: WebSocket closed (${code}) ${reason?.toString() ?? ''}`);
        }
      });
    });
  }

  closeWS(){
      this.webSocket.close();
      this.webSocke = null;        
  }

  async getImage(index='29') {
    try {
        this.urlPrefix = `history/${this.prompt_id}`;
        const historyResponse = await this.getUrl();            
        if (typeof historyResponse === 'string' && historyResponse.startsWith('Error:')) {
            console.error(CAT, historyResponse);
            return null;
        }
        
        const jsonData = JSON.parse(historyResponse);
        if (!jsonData[this.prompt_id]?.outputs[index]?.images) {
            return null;
        }
        
        const imageInfo = jsonData[this.prompt_id].outputs[index].images[0];            
        this.urlPrefix = `view?filename=${imageInfo.filename}&subfolder=${imageInfo.subfolder}&type=${imageInfo.type}`;            
        const imageData = await this.getUrl();
        if (typeof imageData === 'string' && imageData.startsWith('Error:')) {
            console.error(CAT, imageData);
            return null;
        }
        
        return imageData;
    } catch (error) {
        console.error(CAT, 'Error in getImage:', error.message);
        return null;
    }
  }

  // Invalid addr blocklist
  static addrBlockList = {};
  static blockDuration = 5 * 60 * 1000; // 5min

  // urlPrefix whitelist
  static allowedPrefixes = [
    'history/',
    'view?filename=',
    'interrupt',
    'prompt',
    'ws',
  ];

  async getUrl() {
    // check addr blocklist
    const now = Date.now();
    if (ComfyUI.addrBlockList[this.addr] && ComfyUI.addrBlockList[this.addr] > now) {
      return `Error: This address is temporarily blocked due to previous failures.`;
    }

    // verify urlPrefix whitelist
    const isAllowedPrefix = ComfyUI.allowedPrefixes.some(prefix => this.urlPrefix.startsWith(prefix));
    if (!isAllowedPrefix) {
      return `Error: urlPrefix not allowed.`;
    }

    let apiUrl = '';
    if (/^https?:\/\//i.test(this.addr)) {
      apiUrl = `${this.addr}/${this.urlPrefix}`;
    } else {
      apiUrl = `http://${this.addr}/${this.urlPrefix}`;
    }

    return new Promise((resolve, reject) => {
      let request = net.request({
        url: apiUrl,
        timeout: this.timeout
      });

      const chunks = [];

      request.on('response', (response) => {
        response.on('data', (chunk) => {
          chunks.push(Buffer.from(chunk));
        });

        response.on('end', () => {
          if (response.statusCode !== 200) {
            console.error(`${CAT} HTTP error: ${response.statusCode}`);
            // blocklist for failed access
            ComfyUI.addrBlockList[this.addr] = Date.now() + ComfyUI.blockDuration;
            resolve(`Error: HTTP error ${response.statusCode}`);
            return;
          }

          const buffer = Buffer.concat(chunks);

          if (this.urlPrefix.startsWith('history')) {
            try {
              resolve(buffer.toString('utf8'));
            } catch (e) {
              console.error(`${CAT} Failed to parse JSON:`, e);
              resolve(`Error: Failed to parse response`);
            }
          } else {
            resolve(buffer);
          }
        });
      });

      request.on('error', (error) => {
        let ret = '';
        ComfyUI.addrBlockList[this.addr] = Date.now() + ComfyUI.blockDuration;
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
        ComfyUI.addrBlockList[this.addr] = Date.now() + ComfyUI.blockDuration;
        console.error(`${CAT} Request timed out after ${this.timeout}ms`);
        resolve(`Error: Request timed out after ${this.timeout}ms`);
      });

      request.end();
    });
  }

  // eslint-disable-next-line sonarjs/cognitive-complexity
  createWorkflow(generateData) {
    const {addr, auth, uuid, model, vpred, positive, negative, 
      width, height, cfg, step, seed, sampler, scheduler, refresh, 
      hifix, refiner, controlnet, adetailer} = generateData;
    this.addr = addr;
    this.refresh = refresh;
    this.auth = auth;
    this.uuid = uuid;

    let workflow = structuredClone(WORKFLOW);
    let refiner_start_step = 1000;

    if (model !== 'Default') {
      // Set model name
      workflow["45"].inputs.ckpt_name = model;            
      workflow["43"].inputs.ckpt_name = model;

      // Set model name to Image Save
      workflow["29"].inputs.modelname = model;
    }

    // vPred
    if((vpred === 0 && (model.includes('vPred') || model.includes('VPR'))) || vpred === 1) {            
      workflow["35"].inputs.sampling = "v_prediction";
      workflow["44"].inputs.sampling = "v_prediction";
    }

    if (refiner.enable && model !== refiner.model) {
      // Set refiner model name
      workflow["43"].inputs.ckpt_name = refiner.model;
      if((refiner.vpred === 0 && (refiner.model.includes('vPred') || refiner.model.includes('VPR'))) || refiner.vpred === 1) {
        workflow["44"].inputs.sampling = "v_prediction";
      } else {
        workflow["44"].inputs.sampling = "eps";
      }
      refiner_start_step = Math.floor(step * refiner.ratio);
      //Set refiner seed and steps
      workflow["37"].inputs.noise_seed = seed;
      workflow["37"].inputs.start_at_step = refiner_start_step;
      
      if (refiner.addnoise) {
        // Set refiner add noise
        workflow["36"].inputs.return_with_leftover_noise = "disable";
        workflow["37"].inputs.add_noise = "enable";
      } else {
        workflow["36"].inputs.return_with_leftover_noise = "enable";
        workflow["37"].inputs.add_noise = "disable";
      }
    } else {
      // Reconnect nodes
      // Ksampler and Model Loader to Vae Decode
      workflow["6"].inputs.samples = ["36", 0];
      workflow["6"].inputs.vae = ["45", 2];
      // Model Loader to Hires fix Vae Decode Tiled 
      workflow["18"].inputs.vae = ["45", 2];
      // Model Loader to Hires fix Vae Encode Tiled
      workflow["19"].inputs.vae = ["45", 2];
    }

    // Set Sampler and Scheduler
    workflow["20"].inputs.sampler_name = sampler;
    workflow["29"].inputs.sampler_name = sampler;
    workflow["36"].inputs.sampler_name = sampler;
    workflow["37"].inputs.sampler_name = sampler;
    
    workflow["20"].inputs.scheduler = scheduler;
    workflow["29"].inputs.scheduler = scheduler;
    workflow["36"].inputs.scheduler = scheduler;
    workflow["37"].inputs.scheduler = scheduler;

    // Set steps and cfg
    workflow["13"].inputs.steps = step;
    workflow["13"].inputs.cfg = cfg;
                
    // Set Image Saver seed
    workflow["29"].inputs.seed_value = seed;        
    // Set Ksampler seed and steps
    workflow["36"].inputs.noise_seed = seed;
    workflow["36"].inputs.end_at_step = refiner_start_step;       
    
    // Set Positive prompt
    workflow["32"].inputs.text = positive;        
    // Set Negative prompt
    workflow["33"].inputs.text = negative;
    
    // Set width and height
    workflow["17"].inputs.Width = width;
    workflow["17"].inputs.Height = height;

    if (hifix.enable) {            
      // Set Hires fix seed and denoise
      workflow["20"].inputs.seed = hifix.seed;
      workflow["20"].inputs.denoise = hifix.denoise;
      workflow["20"].inputs.steps = hifix.steps;

      // Latent or Model hifix
      if (hifix?.model.includes('Latent')) {
        const match = hifix.model.match(/\(([^)]+)\)/);
        const latentMethod = match ? match[1].trim() : 'nearest-exact'; // Default nearest-exact

        workflow["46"].inputs.upscale_method = latentMethod;
        workflow["46"].inputs.scale_by = hifix.scale;

        // Check if refiner enabled
        if (refiner.enable){
          workflow["46"].inputs.samples = ["37", 0];
        }

        // Connect to 2nd KSampler
        workflow["20"].inputs.latent_image = ["46", 0];        
      } else {
        // Set Hires fix parameters
        workflow["17"].inputs.HiResMultiplier = hifix.scale;

        // Set Hires fix model name
        workflow["27"].inputs.model_name = `${hifix.model}`;
      }

      if(hifix.colorTransfer === 'None'){
        // Image Save set to 2nd VAE Decode (Tiled)
        workflow["29"].inputs.images = ["18", 0];
      } else {
        // Default to Image Color Transfer
        workflow["28"].inputs.method = hifix.colorTransfer;
      }            
    } else {
      // Image Save set to 1st VAE Decode
      workflow["29"].inputs.images = ["6", 0];
    }

    // default pos and neg to ksampler
    let workflowInfo = {
      startIndex: 46,
      now_pos:    2,
      now_neg:    3,
      refiner:    refiner.enable,
      ref_pos:    41,
      ref_neg:    40,
      hiresfix:   hifix.enable
    };
    const { workflowCN, indexCN } = applyControlnet(workflow, controlnet, workflowInfo);

    workflowInfo = {
      startIndex: indexCN,
      refiner:    refiner.enable,
      hiresfix:   hifix.enable
    };
    workflow = applyADetailer(workflowCN, adetailer, workflowInfo);
    return workflow;
  }

  // eslint-disable-next-line sonarjs/cognitive-complexity
  createWorkflowRegional(generateData) {      
    const {addr, auth, uuid, model, vpred, positive_left, positive_right, negative, 
      width, height, cfg, step, seed, sampler, scheduler, refresh, 
      hifix, refiner, regional, controlnet, adetailer} = generateData;
    this.addr = addr;
    this.refresh = refresh;
    this.auth = auth;
    this.uuid = uuid;
    
    let workflow = structuredClone(WORKFLOW_REGIONAL);
    let refiner_start_step = 1000;

    if (model !== 'Default') {
        // Set model name
        workflow["45"].inputs.ckpt_name = model;            
        workflow["43"].inputs.ckpt_name = model;

        // Set model name to Image Save
        workflow["29"].inputs.modelname = model;
    }

    // vPred
    if((vpred === 0 && (model.includes('vPred') || model.includes('VPR'))) || vpred === 1) {
        workflow["35"].inputs.sampling = "v_prediction";
        workflow["44"].inputs.sampling = "v_prediction";
    }

    if (refiner.enable && model !== refiner.model) {
        // Set refiner model name
        workflow["43"].inputs.ckpt_name = refiner.model;
        if((refiner.vpred === 0 && (refiner.model.includes('vPred') || refiner.model.includes('VPR'))) || refiner.vpred === 1) {
          workflow["44"].inputs.sampling = "v_prediction";
        } else {
          workflow["44"].inputs.sampling = "eps";
        }
        refiner_start_step = Math.floor(step * refiner.ratio);
        //Set refiner seed and steps
        workflow["37"].inputs.noise_seed = seed;
        workflow["37"].inputs.start_at_step = refiner_start_step;
        
        if (refiner.addnoise) {
          // Set refiner add noise
          workflow["36"].inputs.return_with_leftover_noise = "disable";
          workflow["37"].inputs.add_noise = "enable";
        } else {
          workflow["36"].inputs.return_with_leftover_noise = "enable";
          workflow["37"].inputs.add_noise = "disable";
        }
    } else {
        // Reconnect nodes
        // Ksampler and Model Loader to Vae Decode
        workflow["6"].inputs.samples = ["36", 0];
        workflow["6"].inputs.vae = ["45", 2];
        // Model Loader to Hires fix Vae Decode Tiled 
        workflow["18"].inputs.vae = ["45", 2];
        // Model Loader to Hires fix Vae Encode Tiled
        workflow["19"].inputs.vae = ["45", 2];
    }

    // Set Sampler and Scheduler
    workflow["20"].inputs.sampler_name = sampler;
    workflow["29"].inputs.sampler_name = sampler;
    workflow["36"].inputs.sampler_name = sampler;
    workflow["37"].inputs.sampler_name = sampler;
    
    workflow["20"].inputs.scheduler = scheduler;
    workflow["29"].inputs.scheduler = scheduler;
    workflow["36"].inputs.scheduler = scheduler;
    workflow["37"].inputs.scheduler = scheduler;

    // Set steps and cfg
    workflow["13"].inputs.steps = step;
    workflow["13"].inputs.cfg = cfg;
                
    // Set Image Saver seed
    workflow["29"].inputs.seed_value = seed;        
    // Set Ksampler seed and steps
    workflow["36"].inputs.noise_seed = seed;
    workflow["36"].inputs.end_at_step = refiner_start_step;       
    
    // Set Positive prompt
    workflow["32"].inputs.text = positive_left;
    workflow["46"].inputs.text = positive_right;
    // Combine prompt
    workflow["29"].inputs.positive = `${positive_left}\n${positive_right}`;
    
    // Set Negative prompt
    workflow["33"].inputs.text = negative;
    
    // Set width and height
    workflow["17"].inputs.Width = width;
    workflow["17"].inputs.Height = height;

    // Regional Condition Mask
    // Set Mask Ratio
    workflow["47"].inputs.Layout = regional.ratio;
    // Set Left Mask Strength and Area
    workflow["50"].inputs.strength = regional.str_left;
    workflow["50"].inputs.set_cond_area = regional.option_left;
    workflow["55"].inputs.strength = regional.str_left;
    workflow["55"].inputs.set_cond_area = regional.option_left;
    // Set Right Mask Strength and Area
    workflow["52"].inputs.strength = regional.str_right;
    workflow["52"].inputs.set_cond_area = regional.option_right;
    workflow["56"].inputs.strength = regional.str_right;
    workflow["56"].inputs.set_cond_area = regional.option_right;

    if (hifix.enable) {
      // Set Hires fix seed and denoise
      workflow["20"].inputs.seed = hifix.seed;
      workflow["20"].inputs.denoise = hifix.denoise;
      workflow["20"].inputs.steps = hifix.steps;

      // Latent or Model hifix
      if (hifix?.model.includes('Latent')) {
          const match = hifix.model.match(/\(([^)]+)\)/);
          const latentMethod = match ? match[1].trim() : 'nearest-exact'; // Default nearest-exact

          workflow["58"].inputs.upscale_method = latentMethod;
          workflow["58"].inputs.scale_by = hifix.scale;

          // Check if refiner enabled
          if (refiner.enable){
            workflow["58"].inputs.samples = ["37", 0];
          }

          // Connect to 2nd KSampler
          workflow["20"].inputs.latent_image = ["58", 0];        
      } else {
        // Set Hires fix parameters
        workflow["17"].inputs.HiResMultiplier = hifix.scale;

        // Set Hires fix model name
        workflow["27"].inputs.model_name = `${hifix.model}`;
      }

      if(hifix.colorTransfer === 'None'){
          // Image Save set to 2nd VAE Decode (Tiled)
          workflow["29"].inputs.images = ["18", 0];
      } else {
          // Default to Image Color Transfer
          workflow["28"].inputs.method = hifix.colorTransfer;
      }  
    } else {
      // Image Save set to 1st VAE Decode
      workflow["29"].inputs.images = ["6", 0];
    }

    // default pos and neg to ksampler
    let workflowInfo = {
      startIndex: 58,
      now_pos:    53,
      now_neg:    3,
      refiner:    refiner.enable,
      ref_pos:    57,
      ref_neg:    40,
      hiresfix:   hifix.enable
    };
    const { workflowCN, indexCN } = applyControlnet(workflow, controlnet, workflowInfo);

    workflowInfo = {
      startIndex: indexCN,
      refiner:    refiner.enable,
      hiresfix:   hifix.enable
    };
    workflow = applyADetailer(workflowCN, adetailer, workflowInfo);
    return workflow;
  }

  createWorkflowControlnet(generateData){
    const {addr, auth, uuid, imageData, controlNet, outputResolution} = generateData;
    this.addr = addr;
    this.auth = auth;
    this.uuid = uuid;

    let workflow = structuredClone(WORKFLOW_CONTROLNET);
    workflow["1"].inputs.base64text = imageData;
    workflow["2"].inputs.preprocessor = controlNet;
    workflow["2"].inputs.resolution = outputResolution;
    return workflow;
  }

  run(workflow) {
    return new Promise((resolve, reject) => {
      const requestBody = {
        prompt: workflow,
        client_id: this.clientID
      };
      const body = JSON.stringify(requestBody);
      const apiUrl = `http://${this.addr}/prompt`;

      let request = net.request({
        method: 'POST',
        url: apiUrl,
        headers: {
            'Content-Type': 'application/json'
        },
        timeout: this.timeout,
      });

      request.on('response', (response) => {
        let responseData = ''            
        response.on('data', (chunk) => {
          responseData += chunk
        })
        response.on('end', () => {
          if (response.statusCode !== 200) {
            console.error(`${CAT} HTTP error: ${response.statusCode} - ${responseData}`);
            resolve(`Error HTTP ${response.statusCode} - ${responseData}`);
          }
          resolve(responseData);
        })
      });
      
      request.on('error', (error) => {
        let ret = '';
        if (error.code === 'ECONNABORTED') {
          console.error(`${CAT} Request timed out after ${timeout}ms`);
          ret = `Error: Request timed out after ${timeout}ms`;
        } else {
          console.error(CAT, 'Request failed:', error.message);
          ret = `Error: Request failed:, ${error.message}`;
        }
        setMutexBackendBusy(false); // Release the mutex lock
        resolve(ret);
      });

      request.on('timeout', () => {
        req.destroy();
        console.error(`${CAT} Request timed out after ${timeout}ms`);
        setMutexBackendBusy(false); // Release the mutex lock
        resolve(`Error: Request timed out after ${timeout}ms`);
      });

      request.write(body);
      request.end();   
    });
  }   
}

async function setupGenerateBackendComfyUI() {
  backendComfyUI = new ComfyUI(crypto.randomUUID());

  ipcMain.handle('generate-backend-comfyui-run', async (event, generateData) => {
      return await runComfyUI(generateData);
  });

  ipcMain.handle('generate-backend-comfyui-run-regional', async (event, generateData) => {
      return await runComfyUI_Regional(generateData);
  });

  ipcMain.handle('generate-backend-comfyui-run-controlnet', async (event, generateData) => {
      return await runComfyUI_ControlNet(generateData);
  });

  ipcMain.handle('generate-backend-comfyui-open-ws', async (event, prompt_id) => {
      return await backendComfyUI.openWS(prompt_id);
  });

  ipcMain.handle('generate-backend-comfyui-close-ws', (event) => {
      closeWsComfyUI();
  });

  ipcMain.handle('generate-backend-comfyui-cancel', async (event) => {
      await cancelComfyUI();
  });
}

async function runComfyUI(generateData) {
  const isBusy = await getMutexBackendBusy();
  if (isBusy) {
    console.warn(CAT, 'ComfyUI is busy, cannot run new generation, please try again later.');
    return 'Error: ComfyUI is busy, cannot run new generation, please try again later.';
  }
  setMutexBackendBusy(true); // Acquire the mutex lock
  cancelMark = false;

  const workflow = backendComfyUI.createWorkflow(generateData)
  if(backendComfyUI.uuid !== 'none')
    console.log(CAT, 'Running ComfyUI with uuid:', backendComfyUI.uuid);
  const result = await backendComfyUI.run(workflow);            
  return result;
}

async function runComfyUI_Regional(generateData) {
  const isBusy = await getMutexBackendBusy();
  if (isBusy) {
    console.warn(CAT, 'ComfyUI API is busy, cannot run new generation, please try again later.');
    return 'Error: ComfyUI API is busy, cannot run new generation, please try again later.';
  }
  setMutexBackendBusy(true); // Acquire the mutex lock
  cancelMark = false;

  const workflow = backendComfyUI.createWorkflowRegional(generateData)
  if(backendComfyUI.uuid !== 'none')
    console.log(CAT, 'Running ComfyUI Regional with uuid:', backendComfyUI.uuid);
  const result = await backendComfyUI.run(workflow);
  return result;
}

async function runComfyUI_ControlNet(generateData){
  const isBusy = await getMutexBackendBusy();
  if (isBusy) {
    console.warn(CAT, 'ComfyUI API is busy, cannot run new generation, please try again later.');
    return 'Error: ComfyUI API is busy, cannot run new generation, please try again later.';
  }
  setMutexBackendBusy(true); // Acquire the mutex lock
  cancelMark = false;

  const workflow = backendComfyUI.createWorkflowControlnet(generateData)
  console.log(CAT, 'Running ComfyUI ControlNet with uuid:', backendComfyUI.uuid);
  const result = await backendComfyUI.run(workflow);

  if(result.startsWith('Error')){
    console.log("Error with ControlNet:", result);    
  } else {
    const parsedResult = JSON.parse(result);
    let newImage;
    if (parsedResult.prompt_id) {
      try {                
        newImage = await openWsComfyUI(parsedResult.prompt_id, false, '3');
      } catch (error){
        console.log("Error with ControlNet:", error);
      } finally {
        closeWsComfyUI();
      }
      return newImage;
    } 
  }

  return result;
}

async function openWsComfyUI(prompt_id, skipFirst=true, index='29') {
  return await backendComfyUI.openWS(prompt_id, skipFirst,index);
}

function closeWsComfyUI() {
  backendComfyUI.closeWS();
}

async function cancelComfyUI() {
  console.log(CAT, 'Processing interrupted');
  cancelMark = true;
  await backendComfyUI.cancelGenerate();  
}

export {
  sendToRenderer,
  setupGenerateBackendComfyUI,
  runComfyUI,
  runComfyUI_Regional,
  runComfyUI_ControlNet,
  openWsComfyUI,
  closeWsComfyUI,
  cancelComfyUI
};

// Do NOT Modify it here
// Modify it in ComfyUI with your generate result
const WORKFLOW = {
  "2": {
    "inputs": {
      "text": [
        "34",
        4
      ],
      "clip": [
        "34",
        1
      ]
    },
    "class_type": "CLIPTextEncode",
    "_meta": {
      "title": "CLIP Text Encode (Prompt)"
    }
  },
  "3": {
    "inputs": {
      "text": [
        "33",
        0
      ],
      "clip": [
        "34",
        1
      ]
    },
    "class_type": "CLIPTextEncode",
    "_meta": {
      "title": "CLIP Text Encode (Prompt)"
    }
  },
  "5": {
    "inputs": {
      "width": [
        "17",
        0
      ],
      "height": [
        "17",
        1
      ],
      "batch_size": 1
    },
    "class_type": "EmptyLatentImage",
    "_meta": {
      "title": "Empty Latent Image"
    }
  },
  "6": {
    "inputs": {
      "samples": [
        "37",
        0
      ],
      "vae": [
        "43",
        2
      ]
    },
    "class_type": "VAEDecode",
    "_meta": {
      "title": "VAE Decode"
    }
  },
  "13": {
    "inputs": {
      "steps": 30,
      "cfg": 7
    },
    "class_type": "StepsAndCfg",
    "_meta": {
      "title": "Steps & Cfg"
    }
  },
  "17": {
    "inputs": {
      "Width": 1024,
      "Height": 1360,
      "Batch": 1,
      "Landscape": false,
      "HiResMultiplier": 1.5
    },
    "class_type": "CanvasCreatorAdvanced",
    "_meta": {
      "title": "Create Canvas Advanced"
    }
  },
  "18": {
    "inputs": {
      "tile_size": 512,
      "overlap": 64,
      "temporal_size": 64,
      "temporal_overlap": 8,
      "samples": [
        "20",
        0
      ],
      "vae": [
        "43",
        2
      ]
    },
    "class_type": "VAEDecodeTiled",
    "_meta": {
      "title": "VAE Decode (Tiled)"
    }
  },
  "19": {
    "inputs": {
      "tile_size": 512,
      "overlap": 64,
      "temporal_size": 64,
      "temporal_overlap": 8,
      "pixels": [
        "25",
        0
      ],
      "vae": [
        "43",
        2
      ]
    },
    "class_type": "VAEEncodeTiled",
    "_meta": {
      "title": "VAE Encode (Tiled)"
    }
  },
  "20": {
    "inputs": {
      "seed": 3025955348,
      "steps": 20,
      "cfg": [
        "13",
        1
      ],
      "sampler_name": "euler_ancestral",
      "scheduler": "normal",
      "denoise": 0.4,
      "model": [
        "39",
        2
      ],
      "positive": [
        "41",
        0
      ],
      "negative": [
        "40",
        0
      ],
      "latent_image": [
        "19",
        0
      ]
    },
    "class_type": "KSampler",
    "_meta": {
      "title": "KSampler"
    }
  },
  "25": {
    "inputs": {
      "resize_scale": [
        "17",
        5
      ],
      "resize_method": "nearest",
      "upscale_model": [
        "27",
        0
      ],
      "image": [
        "6",
        0
      ]
    },
    "class_type": "UpscaleImageByModelThenResize",
    "_meta": {
      "title": "Upscale Image By Model Then Resize"
    }
  },
  "27": {
    "inputs": {
      "model_name": "RealESRGAN_x4.pth"
    },
    "class_type": "UpscaleModelLoader",
    "_meta": {
      "title": "Load Upscale Model"
    }
  },
  "28": {
    "inputs": {
      "method": "Mean",
      "src_image": [
        "18",
        0
      ],
      "ref_image": [
        "6",
        0
      ]
    },
    "class_type": "ImageColorTransferMira",
    "_meta": {
      "title": "Color Transfer"
    }
  },
  "29": {
    "inputs": {
      "filename": "%time_%seed",
      "path": "%date",
      "extension": "png",
      "steps": [
        "13",
        0
      ],
      "cfg": [
        "13",
        1
      ],
      "modelname": "waiNSFWIllustrious_v120.safetensors",
      "sampler_name": "euler_ancestral",
      "scheduler": "normal",
      "positive": [
        "32",
        0
      ],
      "negative": [
        "33",
        0
      ],
      "seed_value": 3025955348,
      "width": [
        "17",
        0
      ],
      "height": [
        "17",
        1
      ],
      "lossless_webp": true,
      "quality_jpeg_or_webp": 100,
      "optimize_png": false,
      "counter": 0,
      "denoise": 1,
      "clip_skip": -2,
      "time_format": "%Y-%m-%d-%H%M%S",
      "save_workflow_as_json": false,
      "embed_workflow": true,
      "additional_hashes": "",
      "images": [
        "28",
        0
      ]
    },
    "class_type": "ImageSaverMira",
    "_meta": {
      "title": "Image Saver"
    }
  },
  "32": {
    "inputs": {
      "text": "solo, masterpiece, best quality, amazing quality"
    },
    "class_type": "TextBoxMira",
    "_meta": {
      "title": "Text Box"
    }
  },
  "33": {
    "inputs": {
      "text": "bad quality,worst quality,worst detail,sketch"
    },
    "class_type": "TextBoxMira",
    "_meta": {
      "title": "Text Box"
    }
  },
  "34": {
    "inputs": {
      "text": [
        "32",
        0
      ],
      "model": [
        "35",
        0
      ],
      "clip": [
        "45",
        1
      ]
    },
    "class_type": "LoRAfromText",
    "_meta": {
      "title": "LoRA Loader from Text"
    }
  },
  "35": {
    "inputs": {
      "sampling": "eps",
      "zsnr": false,
      "model": [
        "45",
        0
      ]
    },
    "class_type": "ModelSamplingDiscrete",
    "_meta": {
      "title": "ModelSamplingDiscrete"
    }
  },
  "36": {
    "inputs": {
      "add_noise": "enable",
      "noise_seed": 3025955348,
      "steps": [
        "13",
        0
      ],
      "cfg": [
        "13",
        1
      ],
      "sampler_name": "euler_ancestral",
      "scheduler": "normal",
      "start_at_step": 0,
      "end_at_step": 1000,
      "return_with_leftover_noise": "disable",
      "model": [
        "34",
        0
      ],
      "positive": [
        "2",
        0
      ],
      "negative": [
        "3",
        0
      ],
      "latent_image": [
        "5",
        0
      ]
    },
    "class_type": "KSamplerAdvanced",
    "_meta": {
      "title": "KSampler (Advanced)"
    }
  },
  "37": {
    "inputs": {
      "add_noise": "disable",
      "noise_seed": 3025955348,
      "steps": [
        "13",
        0
      ],
      "cfg": [
        "13",
        1
      ],
      "sampler_name": "euler_ancestral",
      "scheduler": "normal",
      "start_at_step": 12,
      "end_at_step": 10000,
      "return_with_leftover_noise": "disable",
      "model": [
        "39",
        0
      ],
      "positive": [
        "41",
        0
      ],
      "negative": [
        "40",
        0
      ],
      "latent_image": [
        "36",
        0
      ]
    },
    "class_type": "KSamplerAdvanced",
    "_meta": {
      "title": "KSampler (Advanced)"
    }
  },
  "39": {
    "inputs": {
      "text": [
        "32",
        0
      ],
      "model": [
        "44",
        0
      ],
      "clip": [
        "43",
        1
      ]
    },
    "class_type": "LoRAfromText",
    "_meta": {
      "title": "LoRA Loader from Text"
    }
  },
  "40": {
    "inputs": {
      "text": [
        "33",
        0
      ],
      "clip": [
        "39",
        1
      ]
    },
    "class_type": "CLIPTextEncode",
    "_meta": {
      "title": "CLIP Text Encode (Prompt)"
    }
  },
  "41": {
    "inputs": {
      "text": [
        "39",
        4
      ],
      "clip": [
        "39",
        1
      ]
    },
    "class_type": "CLIPTextEncode",
    "_meta": {
      "title": "CLIP Text Encode (Prompt)"
    }
  },
  "43": {
    "inputs": {
      "ckpt_name": "waiNSFWIllustrious_v120.safetensors"
    },
    "class_type": "CheckpointLoaderSimple",
    "_meta": {
      "title": "Load Checkpoint"
    }
  },
  "44": {
    "inputs": {
      "sampling": "eps",
      "zsnr": false,
      "model": [
        "43",
        0
      ]
    },
    "class_type": "ModelSamplingDiscrete",
    "_meta": {
      "title": "ModelSamplingDiscrete"
    }
  },
  "45": {
    "inputs": {
      "ckpt_name": "waiNSFWIllustrious_v120.safetensors"
    },
    "class_type": "CheckpointLoaderSimple",
    "_meta": {
      "title": "Load Checkpoint"
    }
  },
  "46": {
    "inputs": {
      "samples": [
        "36",
        0
      ],
      "upscale_method": "nearest-exact",
      "scale_by": 1.5
    },
    "class_type": "LatentUpscaleBy",
    "_meta": {
      "title": "Upscale Latent By"
    }
  }
};

const WORKFLOW_REGIONAL = {
  "2": {
    "inputs": {
      "text": [
        "34",
        4
      ],
      "clip": [
        "34",
        1
      ]
    },
    "class_type": "CLIPTextEncode",
    "_meta": {
      "title": "CLIP Text Encode (Prompt)"
    }
  },
  "3": {
    "inputs": {
      "text": [
        "33",
        0
      ],
      "clip": [
        "34",
        1
      ]
    },
    "class_type": "CLIPTextEncode",
    "_meta": {
      "title": "CLIP Text Encode (Prompt)"
    }
  },
  "5": {
    "inputs": {
      "width": [
        "17",
        0
      ],
      "height": [
        "17",
        1
      ],
      "batch_size": 1
    },
    "class_type": "EmptyLatentImage",
    "_meta": {
      "title": "Empty Latent Image"
    }
  },
  "6": {
    "inputs": {
      "samples": [
        "37",
        0
      ],
      "vae": [
        "43",
        2
      ]
    },
    "class_type": "VAEDecode",
    "_meta": {
      "title": "VAE Decode"
    }
  },
  "13": {
    "inputs": {
      "steps": 30,
      "cfg": 7.000000000000002
    },
    "class_type": "StepsAndCfg",
    "_meta": {
      "title": "Steps & Cfg"
    }
  },
  "17": {
    "inputs": {
      "Width": 1024,
      "Height": 1360,
      "Batch": 1,
      "Landscape": false,
      "HiResMultiplier": 1.5
    },
    "class_type": "CanvasCreatorAdvanced",
    "_meta": {
      "title": "Create Canvas Advanced"
    }
  },
  "18": {
    "inputs": {
      "tile_size": 512,
      "overlap": 64,
      "temporal_size": 64,
      "temporal_overlap": 8,
      "samples": [
        "20",
        0
      ],
      "vae": [
        "43",
        2
      ]
    },
    "class_type": "VAEDecodeTiled",
    "_meta": {
      "title": "VAE Decode (Tiled)"
    }
  },
  "19": {
    "inputs": {
      "tile_size": 512,
      "overlap": 64,
      "temporal_size": 64,
      "temporal_overlap": 8,
      "pixels": [
        "25",
        0
      ],
      "vae": [
        "43",
        2
      ]
    },
    "class_type": "VAEEncodeTiled",
    "_meta": {
      "title": "VAE Encode (Tiled)"
    }
  },
  "20": {
    "inputs": {
      "seed": 715010500915488,
      "steps": 20,
      "cfg": [
        "13",
        1
      ],
      "sampler_name": "euler_ancestral",
      "scheduler": "normal",
      "denoise": 0.4000000000000001,
      "model": [
        "39",
        2
      ],
      "positive": [
        "57",
        0
      ],
      "negative": [
        "40",
        0
      ],
      "latent_image": [
        "19",
        0
      ]
    },
    "class_type": "KSampler",
    "_meta": {
      "title": "KSampler"
    }
  },
  "25": {
    "inputs": {
      "resize_scale": [
        "17",
        5
      ],
      "resize_method": "nearest",
      "upscale_model": [
        "27",
        0
      ],
      "image": [
        "6",
        0
      ]
    },
    "class_type": "UpscaleImageByModelThenResize",
    "_meta": {
      "title": "Upscale Image By Model Then Resize"
    }
  },
  "27": {
    "inputs": {
      "model_name": "4x-UltraSharp.pth"
    },
    "class_type": "UpscaleModelLoader",
    "_meta": {
      "title": "Load Upscale Model"
    }
  },
  "28": {
    "inputs": {
      "method": "Mean",
      "src_image": [
        "18",
        0
      ],
      "ref_image": [
        "6",
        0
      ]
    },
    "class_type": "ImageColorTransferMira",
    "_meta": {
      "title": "Color Transfer"
    }
  },
  "29": {
    "inputs": {
      "filename": "%time_%seed",
      "path": "%date",
      "extension": "png",
      "steps": [
        "13",
        0
      ],
      "cfg": [
        "13",
        1
      ],
      "modelname": "waiNSFWIllustrious_v130.safetensors",
      "sampler_name": "euler_ancestral",
      "scheduler": "normal",
      "positive": [
        "32",
        0
      ],
      "negative": [
        "33",
        0
      ],
      "seed_value": 1775747588,
      "width": [
        "17",
        0
      ],
      "height": [
        "17",
        1
      ],
      "lossless_webp": true,
      "quality_jpeg_or_webp": 100,
      "optimize_png": false,
      "counter": 0,
      "denoise": 1,
      "clip_skip": -2,
      "time_format": "%Y-%m-%d-%H%M%S",
      "save_workflow_as_json": false,
      "embed_workflow": true,
      "additional_hashes": "",
      "images": [
        "28",
        0
      ]
    },
    "class_type": "ImageSaverMira",
    "_meta": {
      "title": "Image Saver"
    }
  },
  "32": {
    "inputs": {
      "text": "2girls"
    },
    "class_type": "TextBoxMira",
    "_meta": {
      "title": "Text Box"
    }
  },
  "33": {
    "inputs": {
      "text": "bad quality, worst quality, worst detail, sketch"
    },
    "class_type": "TextBoxMira",
    "_meta": {
      "title": "Text Box"
    }
  },
  "34": {
    "inputs": {
      "text": [
        "32",
        0
      ],
      "model": [
        "35",
        0
      ],
      "clip": [
        "45",
        1
      ]
    },
    "class_type": "LoRAfromText",
    "_meta": {
      "title": "LoRA Loader from Text"
    }
  },
  "35": {
    "inputs": {
      "sampling": "eps",
      "zsnr": false,
      "model": [
        "45",
        0
      ]
    },
    "class_type": "ModelSamplingDiscrete",
    "_meta": {
      "title": "ModelSamplingDiscrete"
    }
  },
  "36": {
    "inputs": {
      "add_noise": "enable",
      "noise_seed": 1094643513798864,
      "steps": [
        "13",
        0
      ],
      "cfg": [
        "13",
        1
      ],
      "sampler_name": "euler_ancestral",
      "scheduler": "normal",
      "start_at_step": 0,
      "end_at_step": 1000,
      "return_with_leftover_noise": "disable",
      "model": [
        "34",
        0
      ],
      "positive": [
        "53",
        0
      ],
      "negative": [
        "3",
        0
      ],
      "latent_image": [
        "5",
        0
      ]
    },
    "class_type": "KSamplerAdvanced",
    "_meta": {
      "title": "KSampler (Advanced)"
    }
  },
  "37": {
    "inputs": {
      "add_noise": "disable",
      "noise_seed": 790295579866824,
      "steps": [
        "13",
        0
      ],
      "cfg": [
        "13",
        1
      ],
      "sampler_name": "euler_ancestral",
      "scheduler": "normal",
      "start_at_step": 12,
      "end_at_step": 10000,
      "return_with_leftover_noise": "disable",
      "model": [
        "39",
        0
      ],
      "positive": [
        "57",
        0
      ],
      "negative": [
        "40",
        0
      ],
      "latent_image": [
        "36",
        0
      ]
    },
    "class_type": "KSamplerAdvanced",
    "_meta": {
      "title": "KSampler (Advanced)"
    }
  },
  "39": {
    "inputs": {
      "text": [
        "32",
        0
      ],
      "model": [
        "44",
        0
      ],
      "clip": [
        "43",
        1
      ]
    },
    "class_type": "LoRAfromText",
    "_meta": {
      "title": "LoRA Loader from Text"
    }
  },
  "40": {
    "inputs": {
      "text": [
        "33",
        0
      ],
      "clip": [
        "39",
        1
      ]
    },
    "class_type": "CLIPTextEncode",
    "_meta": {
      "title": "CLIP Text Encode (Prompt)"
    }
  },
  "41": {
    "inputs": {
      "text": [
        "39",
        4
      ],
      "clip": [
        "39",
        1
      ]
    },
    "class_type": "CLIPTextEncode",
    "_meta": {
      "title": "CLIP Text Encode (Prompt)"
    }
  },
  "43": {
    "inputs": {
      "ckpt_name": "waiNSFWIllustrious_v120.safetensors"
    },
    "class_type": "CheckpointLoaderSimple",
    "_meta": {
      "title": "Load Checkpoint"
    }
  },
  "44": {
    "inputs": {
      "sampling": "eps",
      "zsnr": false,
      "model": [
        "43",
        0
      ]
    },
    "class_type": "ModelSamplingDiscrete",
    "_meta": {
      "title": "ModelSamplingDiscrete"
    }
  },
  "45": {
    "inputs": {
      "ckpt_name": "miaomiaoHarem_v16G.safetensors"
    },
    "class_type": "CheckpointLoaderSimple",
    "_meta": {
      "title": "Load Checkpoint"
    }
  },
  "46": {
    "inputs": {
      "text": "2girls"
    },
    "class_type": "TextBoxMira",
    "_meta": {
      "title": "Text Box"
    }
  },
  "47": {
    "inputs": {
      "Width": [
        "17",
        0
      ],
      "Height": [
        "17",
        1
      ],
      "Colum_first": true,
      "Rows": 1,
      "Colums": 1,
      "Layout": "1,0.2,1"
    },
    "class_type": "CreateTillingPNGMask",
    "_meta": {
      "title": "Create Tilling PNG Mask"
    }
  },
  "48": {
    "inputs": {
      "Intenisity": 1,
      "Blur": 0,
      "Start_At_Index": 0,
      "Overlap": "Next",
      "Overlap_Count": 1,
      "PngRectangles": [
        "47",
        2
      ]
    },
    "class_type": "PngRectanglesToMask",
    "_meta": {
      "title": "PngRectangles to Mask"
    }
  },
  "49": {
    "inputs": {
      "Intenisity": 1,
      "Blur": 0,
      "Start_At_Index": 2,
      "Overlap": "Previous",
      "Overlap_Count": 1,
      "PngRectangles": [
        "47",
        2
      ]
    },
    "class_type": "PngRectanglesToMask",
    "_meta": {
      "title": "PngRectangles to Mask"
    }
  },
  "50": {
    "inputs": {
      "strength": 1,
      "set_cond_area": "default",
      "conditioning": [
        "2",
        0
      ],
      "mask": [
        "48",
        0
      ]
    },
    "class_type": "ConditioningSetMask",
    "_meta": {
      "title": "Conditioning (Set Mask)"
    }
  },
  "51": {
    "inputs": {
      "text": [
        "46",
        0
      ],
      "clip": [
        "34",
        1
      ]
    },
    "class_type": "CLIPTextEncode",
    "_meta": {
      "title": "CLIP Text Encode (Prompt)"
    }
  },
  "52": {
    "inputs": {
      "strength": 1,
      "set_cond_area": "default",
      "conditioning": [
        "51",
        0
      ],
      "mask": [
        "49",
        0
      ]
    },
    "class_type": "ConditioningSetMask",
    "_meta": {
      "title": "Conditioning (Set Mask)"
    }
  },
  "53": {
    "inputs": {
      "conditioning_1": [
        "50",
        0
      ],
      "conditioning_2": [
        "52",
        0
      ]
    },
    "class_type": "ConditioningCombine",
    "_meta": {
      "title": "Conditioning (Combine)"
    }
  },
  "54": {
    "inputs": {
      "text": [
        "46",
        0
      ],
      "clip": [
        "39",
        1
      ]
    },
    "class_type": "CLIPTextEncode",
    "_meta": {
      "title": "CLIP Text Encode (Prompt)"
    }
  },
  "55": {
    "inputs": {
      "strength": 1,
      "set_cond_area": "default",
      "conditioning": [
        "41",
        0
      ],
      "mask": [
        "48",
        0
      ]
    },
    "class_type": "ConditioningSetMask",
    "_meta": {
      "title": "Conditioning (Set Mask)"
    }
  },
  "56": {
    "inputs": {
      "strength": 1,
      "set_cond_area": "default",
      "conditioning": [
        "54",
        0
      ],
      "mask": [
        "49",
        0
      ]
    },
    "class_type": "ConditioningSetMask",
    "_meta": {
      "title": "Conditioning (Set Mask)"
    }
  },
  "57": {
    "inputs": {
      "conditioning_1": [
        "55",
        0
      ],
      "conditioning_2": [
        "56",
        0
      ]
    },
    "class_type": "ConditioningCombine",
    "_meta": {
      "title": "Conditioning (Combine)"
    }
  },
  "58": {
    "inputs": {
      "samples": [
        "36",
        0
      ],
      "upscale_method": "nearest-exact",
      "scale_by": 1.5
    },
    "class_type": "LatentUpscaleBy",
    "_meta": {
      "title": "Upscale Latent By"
    }
  }
};

const WORKFLOW_CONTROLNET = {
  "1": {
    "inputs": {
      "base64text": ""
    },
    "class_type": "GzippedBase64ToImage",
    "_meta": {
      "title": "Gzipped Base64 To Image"
    }
  },
  "2": {
    "inputs": {
      "preprocessor": "Manga2Anime_LineArt_Preprocessor",
      "resolution": 512,
      "image": [
        "1",
        0
      ]
    },
    "class_type": "AIO_Preprocessor",
    "_meta": {
      "title": "AIO Aux Preprocessor"
    }
  },
  "3": {
    "inputs": {
      "images": [
        "2",
        0
      ]
    },
    "class_type": "PreviewImage",
    "_meta": {
      "title": "Preview Image"
    }
  }
};