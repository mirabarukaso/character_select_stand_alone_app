import { sendWebSocketMessage } from '../webserver/front/wsRequest.js';

function stripThink(content) {
    return String(content || '').replace(/<think>[\s\S]*<\/think>\s*/, '').trim();
}

function readContent(result) {
    if (typeof result !== 'string' || result.startsWith('Error:') || result.startsWith('[ModelAPI]')) {
        console.error('Request AI failed:', result);
        return '';
    }
    let parsedResult;
    try {
        parsedResult = JSON.parse(result);
    } catch (error) {
        console.error('Failed to parse AI response:', error.message);
        return '';
    }
    const content = parsedResult?.choices?.[0]?.message?.content;
    if (!content) {
        console.error('Content not found in AI response:', parsedResult);
        return '';
    }
    return stripThink(content);
}

async function callApi(method, options) {
    if (globalThis.inBrowser) {
        return sendWebSocketMessage({ type: 'API', method, params: [options] });
    }
    if (method === 'remoteAI') return globalThis.api.remoteAI(options);
    return globalThis.api.localAI(options);
}

export async function requestAiCompletion(aiOptions) {
    const iface = String(aiOptions?.interface || '').toLowerCase();
    if (iface !== 'remote' && iface !== 'local') return { failed: true };
    try {
        const method = iface === 'remote' ? 'remoteAI' : 'localAI';
        const result = await callApi(method, aiOptions);
        if (typeof result === 'string' && result.startsWith('Error: cancelled')) return { cancelled: true };
        const text = readContent(result);
        if (text) return { text };
        const error = typeof result === 'string' ? result.trim() : '';
        return { failed: true, error };
    } catch (error) {
        console.error('Request AI failed:', error.message);
        return { failed: true, error: error?.message || '' };
    }
}

export function cancelAiCompletion(requestId) {
    if (!requestId) return;
    if (globalThis.inBrowser) {
        sendWebSocketMessage({ type: 'API', method: 'cancelAI', params: [requestId] });
        return;
    }
    globalThis.api.cancelAI?.(requestId);
}
