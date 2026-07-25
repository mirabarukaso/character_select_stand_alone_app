import { from_main_updateGallery, from_main_updatePreview, from_main_customOverlayProgress } from '../../renderer/generate_backend.js';
import { showDialog } from '../../renderer/components/myDialog.js';

function setHTMLTitle(title) {
    document.title = title;
}

let version;
let ws;
let messageId = 0; // Unique ID for tracking messages
const callbacks = new Map(); // Registry for message type callbacks

let reconnectingTrigger = false;
let securedConnection = false;

// Store the instance of message by id
const pendingMessages = new Map();

export function isSecuredConnection(){
    return securedConnection;
}

export async function initWebSocket(reConnect = false) {
    try {
        let userpass = ':';
        const { wsAddress, wsPort, httpProtocol } = await fetchWsConfig();
        console.log('httpProtocol', httpProtocol);
        if(httpProtocol === 'https:') {
            userpass = await showDialog('input', { 
                message: 'Input HTTPS Login User name and Password (user:pass)\n请输入HTTPS登陆用户名及密码 (user:pass)\n',
                placeholder: 'user:pass', 
                defaultValue: 'saac_user:',
                showCancel: false,
                buttonText: 'Login'
            });
        }
        const [username, password] = userpass.split(':');
        globalThis.clientUUID = await attemptLogin(username, password);
        if (!globalThis.clientUUID) {
            throw new Error('Login failed');
        }

        await connectWebSocket(wsAddress, wsPort);
        setupBeforeUnloadListener();

        version = await sendWebSocketMessage({ type: 'API', method: 'getAppVersion' });
        setHTMLTitle(`SAA Client ${version} (Connected)`);
        // Warn if using HTTP/WS in a production-like environment
        if (wsAddress.startsWith('ws://') && globalThis.location.hostname !== 'localhost') {
            console.warn('Using non-secure WebSocket (ws://) on a non-localhost server. Consider enabling HTTPS for security.');
        } else {
            console.log('Using secured WebSocket (wss://)');
            securedConnection = true;
        }

        if(reConnect) {
            registerCallback('updatePreview', from_main_updatePreview);
            registerCallback('appendImage', from_main_updateGallery);
            registerCallback('updateProgress', from_main_customOverlayProgress);
        }
        return true;
    } catch (error) {
        console.error('Failed to initialize WebSocket:', error);
    }

    return false;
}

// Function to fetch WebSocket configuration
async function fetchWsConfig() {
    try {
        const response = await fetch('/api/ws-config', {
            credentials: 'same-origin',
        });
        const data = await response.json();        
        return {
            wsAddress: data.wsAddress,
            wsPort: data.wsPort,
            httpProtocol: globalThis.location.protocol,
        };
    } catch (error) {
        console.error('Failed to fetch WebSocket config:', error);
        // Fallback to current protocol and host
        const protocol = globalThis.location.protocol === 'https:' ? 'wss' : 'ws';
        return {
            wsAddress: `${protocol}://${globalThis.location.host || 'localhost'}`,
            wsPort: globalThis.location.port || 51028,
            httpProtocol: globalThis.location.protocol,
        };
    }
}

async function attemptLogin(username, password) {  
  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ username, password })
    });
    
    const data = await response.json();
    if (response.ok) {
      console.log('Login successful UUID:', data.token);
      return data.token;
    } else {
      console.error('Login failed:', data.error);
      return null;
    }
  } catch (error) {
    console.error('Error during login:', error);
    return null;
  }
}

// Function to register a callback for a specific message type
export function registerCallback(messageType, callback) {
    const callbackName = `${globalThis.clientUUID}-${messageType}`;
    callbacks.set(callbackName, callback);
    console.log(`Registered callback for message type: ${callbackName}`);
}

// Function to unregister a callback for a specific message type
export function unregisterCallback(messageType) {
    const callbackName = `${globalThis.clientUUID}-${messageType}`;
    callbacks.delete(callbackName);
    console.log(`Unregistered callback for message type: ${callbackName}`);
}

// Function to unregister all callbacks
export function unregisterAllCallbacks() {
    if (clientUUID) {
        for (const callbackName of callbacks.keys()) {
            if (callbackName.startsWith(`${clientUUID}-`)) {
                callbacks.delete(callbackName);
                console.log(`Unregistered callback: ${callbackName}`);
            }
        }
    }
    console.log('All callbacks unregistered');
}

// Function to set up beforeunload event listener
function setupBeforeUnloadListener() {
    globalThis.addEventListener('beforeunload', () => {
        unregisterAllCallbacks();
        if (ws && isWebSocketOpen(ws)) {
            ws.close();
            console.log('WebSocket connection closed on page unload');
        }
    });
}

function handleAuthenticationError(ws, reject) {
    console.error('Authentication failed, closing WebSocket');
    ws.close();
    reject(new Error('Authentication failed'));
}

function handleAPIResponseOrError(data, id) {
    const { type, method, value, error } = data;
    const promiseCallback = pendingMessages.get(id);
    if (promiseCallback) {
        if (type === 'APIResponse') {
            promiseCallback.resolve(value);
        } else {
            console.error('API Error for method:', method, 'type:', type, 'error:', error);
            promiseCallback.reject(new Error(`API Error for method ${method}: ${error}`));
        }
        pendingMessages.delete(id);
    } else {
        console.warn(`No callback found for message ID: ${id}`);
    }
}

function handleCallbackMessage(value) {
    const { callbackName, args } = value;
    const callback = callbacks.get(callbackName);
    if (typeof callback === 'function') {
        callback(...args);
    } else {
        console.warn(`No valid callback registered for ${callbackName}`);
    }
}

async function connectWebSocket(wsAddress, wsPort) {    
    return new Promise((resolve, reject) => {
        if (ws && ws.readyState !== WebSocket.CLOSED) {
            ws.close();
        }

        function handleRegisterUUIDResponse(data, resolve) {
            console.log(`UUID registration response: ${data.value}`);
            if(data.value === globalThis.clientUUID) {
                resolve();
            } else {
                console.log('UUID registration failed:', data.error);
                reject(new Error(`UUID registration failed: ${data.error}`));
            }
        }       

        ws = new WebSocket(wsAddress);

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                const { type, id } = data;

                switch (type) {
                    case 'registerUUIDResponse':
                        handleRegisterUUIDResponse(data, resolve);
                        break;
                    case 'APIError':
                        if (data?.error.includes('Authentication required')) {
                            handleAuthenticationError(ws, reject);
                        } else {
                            handleAPIResponseOrError(data, id);
                        }
                        break;
                    case 'APIResponse':
                        handleAPIResponseOrError(data, id);
                        break;
                    case 'Callback':
                        handleCallbackMessage(data.value);
                        break;
                    default:
                        console.warn(`Unexpected message type: ${type}`);
                }
            } catch (error) {
                console.error('Error parsing message:', error);
                const id = (() => {
                    try {
                        return JSON.parse(event.data).id;
                    } catch {
                        return undefined;
                    }
                })();
                if (id !== undefined) {
                    pendingMessages.get(id)?.reject(new Error(`Error parsing message: ${error}`));
                }
            }
        };
        
        ws.onopen = async () => {
            if (ws.readyState === WebSocket.OPEN) {
                console.log(`Connected to WebSocket${wsAddress.startsWith('wss://') ? ' Secure' : ''} server`, wsAddress, `Port: ${wsPort}`);
                reconnectingTrigger = false;
                await sendWebSocketMessage({type: 'registerUUID', id: messageId++});
            }
        };

        ws.onclose = () => {
            const SETTINGS = globalThis.globalSettings;
            const FILES = globalThis.cachedFiles;
            const LANG = FILES.language[SETTINGS.language];
            console.warn('Disconnected from SAA');
            globalThis.overlay.custom.createErrorOverlay(LANG.saac_disconnected , 'Disconnected from SAA');

            for (const [id, { reject }] of pendingMessages) {
                reject(new Error('WebSocket connection closed, delete pending message'));
                pendingMessages.delete(id);
            }
            callbacks.clear();
            console.log('Cleared all pending messages and callbacks');
            ws = null;
            setHTMLTitle('SAA Client (Disconnected)');
        };

        ws.onerror = (err) => {
            console.error('WebSocket error:', err);
            const errorMessage = wsAddress.startsWith('wss://') && (err.message?.includes('SSL') || err.message?.includes('certificate'))
                ? 'WebSocket connection failed due to SSL certificate issue. Please ensure the server certificate is valid or accept it in your browser.'
                : 'WebSocket connection error. Please check the server status.';
            reconnectingTrigger = false;
            reject(new Error(errorMessage));
        };
    });
}

// Function to check if WebSocket is open
function isWebSocketOpen(ws) {
    return ws?.readyState === WebSocket.OPEN;
}

// Function to handle reconnection attempts
async function attemptReconnection() {
    try {        
       await initWebSocket(true);
    } catch (error) {
        console.error('Reconnection failed:', error);
        throw error;
    } finally {
        reconnectingTrigger = false;
    }
}

// Function to send a message with reconnection handling
export async function sendWebSocketMessage(message) {
    const id = messageId++;
    const messageWithId = { ...message, id };

    if (!isWebSocketOpen(ws)) {
        if (reconnectingTrigger) {
            throw new Error('Reconnection in progress');
        }
        reconnectingTrigger = true;

        try {
            await attemptReconnection();
        } catch (error) {
            console.error('Failed to reconnect:', error);
            throw error;
        }
    }

    if (!isWebSocketOpen(ws)) {
        console.error('Failed to send message: WebSocket still not open');
        throw new Error('WebSocket not open after reconnection attempt');
    }

    return new Promise((resolve, reject) => {
        pendingMessages.set(id, { resolve, reject });

        try {
            messageWithId.uuid = globalThis.clientUUID;
            ws.send(JSON.stringify(messageWithId));
        } catch (error) {
            console.error('Failed to send message:', error);
            pendingMessages.delete(id);
            reject(new Error(`Failed to send message: ${error}`));
        }
    });
}
