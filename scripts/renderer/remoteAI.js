import { sendWebSocketMessage } from '../webserver/front/wsRequest.js';
let lastAIPromot = '';

async function remoteGenerateWithPrompt(aiOptions = null) {
    try {
        const options = aiOptions || {
                apiUrl: globalThis.ai.remote_address.getValue(),
                apiKey: globalThis.ai.remote_apikey.getValue(),
                modelSelect: globalThis.ai.remote_model_select.getValue(),
                userPrompt: globalThis.prompt.ai.getValue(),
                systemPrompt: globalThis.ai.ai_system_prompt.getValue(),
                timeout: globalThis.ai.remote_timeout.getValue() * 1000
            };
        let result;
        if (globalThis.inBrowser) {
            result = await sendWebSocketMessage({ type: 'API', method: 'remoteAI', params: [options] });
        } else {
            result = await globalThis.api.remoteAI(options);
        }

        if(result.startsWith('Error:')){
            console.error('Request remote AI failed:', result);
            return '';
        }
        
        let parsedResult;
        try {
            parsedResult = JSON.parse(result);
        } catch (error) {
            console.error('Failed to parse JSON response:', error.message);
            return '';
        }

        const content = parsedResult?.choices?.[0]?.message?.content;
        if (!content) {
            console.error('Content not found in response:', parsedResult);
            return '';
        }
        // Just in case, trim off <think>...</think>
        const final_result = content.replace(/<think>[\s\S]*<\/think>\s*/, '').trim();
        return final_result;
    } catch (error) {
        console.error('Request remote AI failed:', error.message);
        return '';
    }
}

async function localGenerateWithPrompt(aiOptions = null) {
    try {
        const options = aiOptions || {
                apiUrl: globalThis.ai.local_address.getValue(),
                userPrompt: globalThis.prompt.ai.getValue(),
                systemPrompt: globalThis.ai.ai_system_prompt.getValue(),
                temperature: globalThis.ai.local_temp.getValue(),
                n_predict:globalThis.ai.local_n_predict.getValue(),
                timeout: globalThis.ai.remote_timeout.getValue() * 1000
            };

        let result;
        if (globalThis.inBrowser) {
            result = await sendWebSocketMessage({ type: 'API', method: 'localAI', params: [options] });
        } else {
            result = await globalThis.api.localAI(options);
        }

        if(result.startsWith('Error:')){
            console.error('Request local AI failed:', result);
            return '';
        }
        
        let parsedResult;
        try {
            parsedResult = JSON.parse(result);
        } catch (error) {
            console.error('Failed to parse JSON local response:', error.message);
            return '';
        }

        const content = parsedResult?.choices?.[0]?.message?.content;
        if (!content) {
            console.error('Content not found in local response:', parsedResult);
            return '';
        }
        // trim off <think>...</think>
        const final_result = content.replace(/<think>[\s\S]*<\/think>\s*/, '').trim();
        return final_result;
    } catch (error) {
        console.error('Request local AI failed:', error.message);
        return '';
    }
}


export async function getAiPrompt(loop, overlay_generate_ai, aiInterface=null, aiRole=null, aiOptions=null) {
    const currentInterface = aiInterface || globalThis.ai.interface.getValue();
    const currentRole = aiRole || globalThis.ai.ai_select.getValue();

    if(currentRole === 0)   // None
        return '';
    else if(currentRole === 1 && loop !== 0)   // Once 
        return lastAIPromot;
    else if(currentRole === 3 )   // Last
        return lastAIPromot;    
    if (currentInterface.toLowerCase() === 'none') {
        return '';
    } else if (currentInterface.toLowerCase() === 'remote') {     
        globalThis.generate.loadingMessage = overlay_generate_ai;
        lastAIPromot = await remoteGenerateWithPrompt(aiOptions);        
    } else {
        globalThis.generate.loadingMessage = overlay_generate_ai;
        lastAIPromot = await localGenerateWithPrompt(aiOptions);
    }    
    return lastAIPromot;
}