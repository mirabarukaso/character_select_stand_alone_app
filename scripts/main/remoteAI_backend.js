import { ipcMain, net } from 'electron';

const CAT = '[ModelAPI]';
const aiRequests = new Map();

function trackAiRequest(request, requestId, resolve) {
    const id = String(requestId || '');
    let settled = false;
    if (id) aiRequests.set(id, request);
    const finish = (value) => {
        if (settled) return;
        settled = true;
        if (id && aiRequests.get(id) === request) aiRequests.delete(id);
        resolve(value);
    };
    request.on('abort', () => {
        if (request.cancelledByUser) finish('Error: cancelled');
    });
    return finish;
}

function cancelAiRequest(requestId) {
    const request = aiRequests.get(String(requestId || ''));
    if (!request) return false;
    request.cancelledByUser = true;
    request.destroy();
    return true;
}

function remoteChatUrl(apiUrl) {
    const raw = String(apiUrl || '').trim();
    let url;
    try {
        url = new URL(raw);
    } catch {
        return raw;
    }
    const path = url.pathname.replace(/\/+$/, '');
    if (path.endsWith('/chat/completions')) return url.href;
    url.pathname = `${path}/chat/completions`;
    return url.href;
}

function requestRemote(options) {
    return new Promise((resolve, reject) => {
        const { apiUrl, apiKey, modelSelect, userPrompt, systemPrompt, timeout, temperature, maxTokens } = options;
        const chatUrl = remoteChatUrl(apiUrl);

        const requestBody = {
            model: modelSelect,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: String(userPrompt || '') }
            ],
        };
        if (Number.isFinite(Number(temperature))) requestBody.temperature = Number(temperature);
        if (Number.isFinite(Number(maxTokens)) && Number(maxTokens) > 0) requestBody.max_tokens = Number(maxTokens);
        const body = JSON.stringify(requestBody);

        let request = net.request({
            method: 'POST',
            url: chatUrl,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            timeout: timeout,
        });
        const finish = trackAiRequest(request, options.requestId, resolve);

        request.on('response', (response) => {
            let responseData = ''            
            response.on('data', (chunk) => {
                responseData += chunk
            })
            response.on('end', () => {
                if (response.statusCode !== 200) {
                    const detail = `${CAT} HTTP error: ${response.statusCode} ${chatUrl} - ${responseData}`;
                    console.error(detail);
                    finish(detail);
                    return;
                }

                finish(responseData);
            })
        })

        request.on('error', (error) => {
            if (request.cancelledByUser) {
                finish('Error: cancelled');
                return;
            }
            let ret = '';
            if (error.code === 'ECONNABORTED') {
                console.error(`${CAT} Request timed out after ${timeout}ms`);
                ret = `Request timed out after ${timeout}ms`;
            } else {
                console.error(CAT, 'Request failed:', error.message);
                ret = `Request failed:, ${error.message}`;
            }
            finish(ret);
        });

        request.on('timeout', () => {
            request.destroy();
            console.error(`${CAT} Request timed out after ${timeout}ms`);
            finish(`Error: Request timed out after ${timeout}ms`);
        });

        request.write(body);
        request.end();        
    });
}

function requestLocal(options) {
    return new Promise((resolve, reject) => {
        const { apiUrl, userPrompt, systemPrompt, temperature, n_predict, timeout } = options;

        const requestBody = {
            temperature: temperature,
            n_predict: n_predict,
            cache_prompt: true,
            stop: ["<|im_end|>"],
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: String(userPrompt || '') }
            ],
        };
        const body = JSON.stringify(requestBody);

        let request = net.request({
            method: 'POST',
            url: apiUrl,
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: timeout,
        });
        const finish = trackAiRequest(request, options.requestId, resolve);

        request.on('response', (response) => {
            let responseData = ''            
            response.on('data', (chunk) => {
                responseData += chunk
            })
            response.on('end', () => {
                if (response.statusCode !== 200) {
                    const detail = `${CAT} HTTP error: ${response.statusCode} ${apiUrl} - ${responseData}`;
                    console.error(detail);
                    finish(detail);
                    return;
                }

                finish(responseData);
            })
        })

        request.on('error', (error) => {
            if (request.cancelledByUser) {
                finish('Error: cancelled');
                return;
            }
            let ret = '';
            if (error.code === 'ECONNABORTED') {
                console.error(`${CAT} Request timed out after ${timeout}ms`);
                ret = `Request timed out after ${timeout}ms`;
            } else {
                console.error(CAT, 'Request failed:', error.message);
                ret = `Request failed:, ${error.message}`;
            }
            finish(ret);
        });

        request.on('timeout', () => {
            request.destroy();
            console.error(`${CAT} Request timed out after ${timeout}ms`);
            finish(`Error: Request timed out after ${timeout}ms`);
        });

        request.write(body);
        request.end();        
    });
}

function setupModelApi() {
    ipcMain.handle('request-ai-remote', async (event, options) => {
        return await requestRemote(options);
    });

    ipcMain.handle('request-ai-local', async (event, options) => {
        return await requestLocal(options);
    });

    ipcMain.handle('cancel-ai-request', async (event, requestId) => {
        return cancelAiRequest(requestId);
    });
}

async function remoteAI(options){
    return await requestRemote(options);
}

async function localAI(options){
    return await requestLocal(options);
}

export {
    setupModelApi,
    remoteAI,
    localAI,
    cancelAiRequest
};