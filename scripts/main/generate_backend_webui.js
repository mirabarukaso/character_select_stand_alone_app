const { ipcMain } = require('electron')
const { net } = require('electron');
const { sendToRenderer } = require('./generate_backend_comfyui'); 

const CAT = '[WebUI]';
let backendWebUI = null;

class WebUI {
    constructor() {
        this.addr = '127.0.0.1:7860';
        this.preview = 0;
        this.refresh = 0;
        this.timeout = 5000;
        this.ret = 'success';
        this.lastProgress = -1;
        this.pollingInterval = null;
        this.vpred = false;
        this.auth = '';
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
            const {addr, auth, model, vpred, positive, negative, width, height, cfg, step, seed, sampler, scheduler, refresh, hifix, refiner} = generateData;
            this.addr = addr;
            this.refresh = refresh;
            this.lastProgress = -1;
            this.vpred = vpred;
            this.auth = auth;

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
                resolve(ret);
            });
    
            request.on('timeout', () => {
                request.destroy();
                console.error(`${CAT} Request timed out after ${this.timeout}ms`);
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
                            sendToRenderer(`updatePreview`, previewData);
                            sendToRenderer(`updateProgress`, `${Math.floor(progress*100)}`, '100%');
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
}

async function setupGenerateBackendWebUI() {
    backendWebUI = new WebUI();

    ipcMain.handle('generate-backend-webui-run', async (event, generateData) => {
        const result = await backendWebUI.setModel(generateData.addr, generateData.model, generateData.auth);
        if(result === '200') {
            try {
                const imageData = await backendWebUI.run(generateData);

                if (typeof imageData === 'string' && imageData.startsWith('Error:')) {
                    console.error(CAT, imageData);
                    return `${imageData}`;
                }

                const jsonData =  JSON.parse(imageData);
                sendToRenderer(`updateProgress`, `100`, '100%');
                const image = jsonData.images[0];
                // parameters info
                return `data:image/png;base64,${image}`;
            } catch (error) {
                console.error(CAT, 'Image not found or invalid:', error);
                return `Error: Image not found or invalid: ${error}`;
            }
        }
        return result;
    });

    ipcMain.handle('generate-backend-webui-start-polling', async (event) => {
        backendWebUI.startPolling();
    });

    ipcMain.handle('generate-backend-webui-stop-polling', async (event) => {
        backendWebUI.stopPolling();
    });

    ipcMain.handle('generate-backend-webui-cancel', async (event) => {        
        backendWebUI.cancelGenerate();
        backendWebUI.stopPolling();
    });
}

module.exports = {
    setupGenerateBackendWebUI
};
