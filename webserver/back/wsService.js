import { createHash } from 'node:crypto';
import * as zlib from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as fs from 'node:fs';
import { appendFileSync, existsSync, mkdirSync } from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcrypt';
import { WebSocketServer } from 'ws';
import { getGlobalSettings, getSettingFiles, updateSettingFiles, loadSettings, saveSettings,
    updateMiraITUSettingFiles, loadMiraITUSettings, saveMiraITUSettings
 } from '../../scripts/main/globalSettings.js';
import { getCachedFilesWithoutThumb, getCharacterThumb } from '../../scripts/main/cachedFiles.js';
import { getModelList, getModelListAll, getVAEList, getDiffusionModelList, getTextEncoderList,
    getLoRAList, getImageTaggerModels, updateModelAndLoRAList, getControlNetList,
    getUpscalerList, getADetailerList, getONNXList } from '../../scripts/main/modelList.js';
import { updateWildcards, loadWildcard } from '../../scripts/main/wildCards.js';
import { tagReload, tagGet } from '../../scripts/main/tagAutoComplete_backend.js';
import { runComfyUI, runComfyUI_Regional, runComfyUI_ControlNet, runComfyUI_MiraITU, 
    openWsComfyUI, closeWsComfyUI, cancelComfyUI, python_runComfyUI } from '../../scripts/main/generate_backend_comfyui.js';
import { runWebUI, runWebUI_Regional, cancelWebUI, startPollingWebUI, stopPollingWebUI, runWebUI_ControlNet, python_runWebUI,
    getControlNetProcessorList, getADetailerModelList, getUpscalersModelList, resetModelLists } from '../../scripts/main/generate_backend_webui.js';
import { remoteAI, localAI } from '../../scripts/main/remoteAI_backend.js';
import { loadFile, readImage, readSafetensors, readBase64Image } from '../../scripts/main/fileHandlers.js';
import { runImageTagger } from '../../scripts/main/imageTagger.js';
import { getAppVersion, compressGzipThenBase64 } from '../../main-common.js';

const CAT = '[WSS]';

let server; // HTTP or HTTPS server instance
let wss; // WebSocket or WebSocket Secure server instance
let clients = new Map(); // Track clients with UUIDs
let useHttps = false;

const blockedIPs = new Map();   // Block IP timeouts
const LOGIN_TIMEOUT = 30000;    // 30 seconds for test

let USERS = {};

// Logs
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOG_DIR = path.join(__dirname, '../../logs');
const LOG_FILE = path.join(LOG_DIR, 'auth.log');

function ensureLogDir() {
  if (!existsSync(LOG_DIR)) {
    mkdirSync(LOG_DIR, { recursive: true });
  }
}

function writeLog(message) {
  const timestamp = new Date().toISOString();
  const logEntry = `${timestamp} - ${message}\n`;
  try {
    ensureLogDir();
    appendFileSync(LOG_FILE, logEntry, 'utf8');
  } catch (error) {
    console.error(CAT, 'Failed to write to log file:', error);
  }
}

// Function to set up the HTTP or HTTPS server based on certificate availability
function setupHttpServer(basePatch, wsAddr, wsPort) {
    // Check for certificate files
    const certPath = process.env.SSL_CERT_PATH || path.join(__dirname, '../../html/ca/cert.pem');
    const keyPath = process.env.SSL_KEY_PATH || path.join(__dirname, '../../html/ca/key.pem');
    const usersDataPath = path.join(__dirname, '../../html/ca/user.csv');
    useHttps = false;

    try {
        // Verify that both certificate files exist and are readable
        if (fs.existsSync(certPath) && fs.existsSync(keyPath) && fs.existsSync(usersDataPath)) {
            fs.accessSync(certPath, fs.constants.R_OK);
            fs.accessSync(keyPath, fs.constants.R_OK);
            fs.accessSync(usersDataPath, fs.constants.R_OK);
            useHttps = true;
            console.log(CAT, 'Certificate files found. Starting HTTPS server.');
        } else {
            console.log(CAT, 'Certificate files not found or inaccessible. Falling back to HTTP server.');
        }
    } catch (error) {
        console.warn(CAT, 'Error accessing certificate files. Falling back to HTTP server:', error);
    }

    const expressApp = express();

    if (useHttps) {
      // Setup helmet for security headers
      expressApp.use(helmet({
          contentSecurityPolicy: {
              directives: {
                  defaultSrc: ["'self'"],
                  connectSrc: ["'self'", `wss://${wsAddr}:${wsPort}`, `ws://${wsAddr}:${wsPort}`], // Allow both WS and WSS
                  scriptSrc: ["'self'"],
                  styleSrc: ["'self'"],
                  imgSrc: ["'self'", 'data:'],
              },
          },
          hsts: {
              maxAge: 31536000, // 1 year, only applied for HTTPS
              includeSubDomains: true,
              preload: true,
          },
      }));
    }

    // Set up rate limiter: max 100 requests per 15 minutes per IP for index.html
    const indexLimiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100,
        standardHeaders: true,
        legacyHeaders: false,
    });

    expressApp.use(express.static(basePatch));

    // Serve index_browser.html for browser access
    expressApp.get('/', indexLimiter, (req, res) => {
        res.sendFile(path.join(__dirname, 'index.html'));
    });

    // API endpoint to provide WebSocket configuration
    expressApp.get('/api/ws-config', (req, res) => {
        const host = req.headers.host.split(':')[0];
        const protocol = req.headers['x-forwarded-proto'] || (useHttps ? 'https' : 'http');
        const wsProtocol = protocol === 'https' ? 'wss' : 'ws';
        res.json({
            wsAddress: `${wsProtocol}://${host}:${wsPort}`,
            wsPort: wsPort,
        });        
    });
    
    if (useHttps) {
        // Start HTTPS server
        expressApp.post('/api/login', express.json(), async (req, res) => {
            const clientIP = req.ip || req.socket.remoteAddress;
            const blockUntil = blockedIPs.get(clientIP);
            if (blockUntil && blockUntil > Date.now()) {
                console.log(CAT, `IPBlocked - IP: ${clientIP}, Reason: Previous login failures. Block Until: ${new Date(blockUntil)}`);
                writeLog(`IPBlocked - IP: ${clientIP}, Reason: Previous login failures. Block Until: ${new Date(blockUntil)}`);
                return res.status(403).json({ error: 'IP temporarily blocked due to failed login attempts' });
            }

            const { username, password } = req.body;
            const user = USERS[username];

            if (!user || !await bcrypt.compare(password, user.passwordHash)) {
                blockedIPs.set(clientIP, Date.now() + LOGIN_TIMEOUT);
                writeLog(`LoginFailed - IP: ${clientIP}, Username: ${username}, Reason: Invalid credentials`);
                console.log(CAT, `Login failed for IP ${clientIP}, blocked for ${LOGIN_TIMEOUT / 1000} seconds`);
                return res.status(401).json({ error: 'Invalid username or password' });
            }

            const loginToken = crypto.randomUUID();
            clients.set(loginToken, { ip: clientIP, username });
            writeLog(`LoginSuccess (HTTPS) - IP: ${clientIP}, Username: ${username}`);
            res.json({ token: loginToken });
        });
    

        function loadUsersFromCSV(usersDataPath) {
            const users = {};
            if (fs.existsSync(usersDataPath)) {
                const lines = fs.readFileSync(usersDataPath, 'utf-8').split(/\r?\n/);
                for (const line of lines) {
                    if (!line.trim()) continue;
                    const [username, password] = line.split(',');
                    if (username && password) {
                        users[username.trim()] = { passwordHash: password.trim() };
                    }
                }
            }
            return users;
        }

        try {
            const options = {
                cert: fs.readFileSync(certPath),
                key: fs.readFileSync(keyPath),
            };
            USERS = loadUsersFromCSV(usersDataPath);
            server = https.createServer(options, expressApp).listen(wsPort, wsAddr, () => {
                console.log(CAT, `HTTPS server running at https://${wsAddr}:${wsPort}`);
            });
        } catch (error) {
            console.error(CAT, 'Failed to start HTTPS server:', error);
            throw error;
        }
    } else {
        // Start HTTP server
        expressApp.post('/api/login', express.json(), async (req, res) => {
            const clientIP = req.ip || req.socket.remoteAddress;
            
            // bypass username and password
            const loginToken = crypto.randomUUID();
            const username = 'saac_user';
            clients.set(loginToken, { ip: clientIP, username });                        
            writeLog(`LoginSuccess (HTTP) - IP: ${clientIP}`);
            res.json({ token: loginToken });
        });

        server = http.createServer(expressApp).listen(wsPort, wsAddr, () => {
            console.log(CAT, `HTTP server running at http://${wsAddr}:${wsPort}`);
        });
    }

    // Set up WebSocket server
    wss = createWebSocketServer(server, useHttps);
}

function closeWebSocketServer() {
    if (wss) {
        wss.close(() => {
            console.log(CAT, 'WebSocket server closed');
        });
        clients.clear();
    }

    if (server) {
        server.close(() => {
            console.log(CAT, 'Server closed');
        });
    }
}

function createWebSocketServer(server, useHttps) {
    const wss = new WebSocketServer({ server });

    wss.on('connection', (ws, req) => {
        const clientIP = req.socket.remoteAddress;
        writeLog(`RemoteAccess - IP: ${clientIP}, Protocol: ${useHttps ? 'WSS' : 'WS'}`);
        console.log(CAT, `WebSocket${useHttps ? ' Secure' : ''} client connected`, clientIP);

        ws.on('message', async (message) => {
            try {
                const data = JSON.parse(message);
                const { id, type, uuid } = data;

                // Sanitize input
                if (typeof data !== 'object' || data === null) {
                    ws.send(JSON.stringify({ type: 'APIError', id, error: 'Invalid message format' }));
                    return;
                }

                switch (type) {
                    case 'registerUUID': {
                         console.log(CAT, `Register UUID from ${clientIP} with ${uuid}`);
                        // HTTPS: Require valid login token
                        if (!uuid || !clients.has(uuid) || clients.get(uuid).ip !== clientIP) {
                            ws.send(JSON.stringify({ type: 'APIError', id, error: 'Invalid or missing login token' }));
                            ws.close(4001, 'Authentication required');
                            return;
                        }

                        // Check if clients in list
                        let client = clients.get(uuid);
                        if (!client) {
                            ws.send(JSON.stringify({ type: 'APIError', id, error: 'Client not found' }));
                            ws.close(4001, 'Client not found');
                            return;
                        }
                        
                        clients.set(uuid, { ws, uuid, ip: clientIP, username: clients.get(uuid).username });
                        console.log(CAT, `Client registered with UUID: ${uuid}`);
                        ws.send(JSON.stringify({ type: 'registerUUIDResponse', id, value: uuid }));
                        return;
                    }                    
                    case 'API': {
                        const { method, params = {}, uuid } = data;

                        if (!uuid || !clients.has(uuid)) {
                            console.log(CAT, 'APIError: Invalid or missing UUID');
                            ws.send(JSON.stringify({ type: 'APIError', id, error: 'Invalid or missing UUID' }));
                            ws.close(4001, 'Authentication required');
                            return;
                        }
                        const client = clients.get(uuid);

                        if (client.ws !== ws) {
                            console.warn(CAT, 'APIError: UUID does not match this connection');
                            console.log(CAT, `Expected WS: ${client.ws}, Actual WS: ${ws}`);
                            ws.send(JSON.stringify({ type: 'APIError', id, error: 'UUID does not match this connection' }));
                            ws.close(4001, 'Authentication required');
                            return;
                        }

                        if (!client.uuid || !client.username) {
                            ws.send(JSON.stringify({ type: 'APIError', id, error: 'Authentication required' }));
                            ws.close(4001, 'Authentication required');
                            return;
                        }

                        if (!method || typeof method !== 'string') {
                            console.warn(CAT, 'Received API message with invalid method');
                            ws.send(JSON.stringify({ type: 'APIError', id, error: 'Method not specified or invalid' }));                            
                            return;
                        }
                        await handleApiRequest(ws, method, params, id);
                        return;
                    }
                    default:
                        console.warn(CAT, `Unknown message type: ${type}`);
                        ws.send(JSON.stringify({ type: 'APIError', id, error: `Unknown message type: ${type}` }));
                }
            } catch (error) {
                console.error(CAT, 'Error processing message:', error);
                ws.send(JSON.stringify({ type: 'APIError', id, error: 'Invalid message format or server error' }));
            }
        });

        ws.on('close', () => {
            writeLog(`ConnectionClosed - IP: ${clientIP}`);
            console.log(CAT, `WebSocket${useHttps ? ' Secure' : ''} client disconnected`);
            for (let [key, client] of clients) {
                if (client.ws === ws) {
                    clients.delete(key);
                    console.log(CAT, `Removed client with UUID: ${client.uuid}`);
                    break;
                }
            }
        });

        ws.on('error', (error) => {
            writeLog(`ConnectionError - IP: ${clientIP}, Error: ${error.message}`);
            console.error(CAT, `WebSocket${useHttps ? ' Secure' : ''} error:`, error);
            for (let [key, client] of clients) {
                if (client.ws === ws) {
                    clients.delete(key);
                    console.log(CAT, `Removed client with UUID: ${client.uuid} due to error`);
                    break;
                }
            }
        });
    });

    return wss;
}

// Function to send a message to a specific client by UUID
function sendToClient(uuid, type, data) {
    const client = clients.get(uuid);
    if (client && client.ws.readyState === client.ws.OPEN) {
        try {
            const message = JSON.stringify({ type, value: data });
            client.ws.send(message);
            return true;
        } catch (error) {
            console.error(CAT, `Failed to send message to client ${uuid}:`, error);
            return false;
        }
    } else {
        console.warn(CAT, `Client ${uuid} not found or not open`);
        return false;
    }
}

// Function to broadcast a message to all connected clients
function broadcastMessage(type, data) {
    const message = JSON.stringify({ type, value: data });
    for ( const { uuid, client } of clients ) {
        if (client.ws.readyState === client.ws.OPEN) {
            try {
                client.ws.send(message);
                console.log(CAT, `Broadcasted message of type ${type} to client ${uuid}`);
            } catch (error) {
                console.error(CAT, `Failed to broadcast to client ${uuid}:`, error);
            }
        }
    }
}

// API method handler (unchanged)
const methodHandlers = {
  // version
  'getAppVersion': ()=> getAppVersion(),

  // cached files
  'getCachedFiles': ()=> getCachedFilesWithoutThumb(),

  // fileHandlers
  'readFile': (params)=> loadFile(...params),
  'readImage': (params)=> readImage(...params),
  'readSafetensors': (params)=> readSafetensors(...params),
  'readBase64Image': (params)=> readBase64Image(...params),

  // global settings
  'getGlobalSettings': ()=> getGlobalSettings(),
  'loadSettingFile': (params)=> loadSettings(...params),
  'saveSettingFile': (params)=> saveSettings(...params),
  'getSettingFiles': ()=> getSettingFiles(),
  'updateSettingFiles': ()=> updateSettingFiles(),

  'updateMiraITUSettingFiles': ()=> updateMiraITUSettingFiles(),
  'loadMiraITUSettingFile': (params)=> loadMiraITUSettings(...params),
  'saveMiraITUSettingFile': (params)=> saveMiraITUSettings(...params),

  // file lists
  'getModelList': (params)=> getModelList(...params),
  'getModelListAll': (params)=> getModelListAll(...params),
  'getVAEList': (params)=> getVAEList(...params),
  'getDiffusionModelList': (params)=> getDiffusionModelList(...params),
  'getTextEncoderList': (params)=> getTextEncoderList(...params),

  'getLoRAList': (params)=> getLoRAList(...params),
  'getControlNetList': (params)=> getControlNetList(...params),
  'getUpscalerList': (params)=> getUpscalerList(...params),
  'getADetailerList': (params)=> getADetailerList(...params),
  'getONNXList': (params)=> getONNXList(...params),
  'getImageTaggerModels': ()=> getImageTaggerModels(),
  'updateModelList': (params)=> updateModelAndLoRAList(...params),

  // wildcards
  'updateWildcards': ()=> updateWildcards(),
  'loadWildcard': (params)=> loadWildcard(...params),

  // tag auto complete
  'tagReload': ()=> tagReload(),
  'tagGet': (params)=> tagGet(...params),

  // AI
  'remoteAI': (params)=> remoteAI(...params),
  'localAI': (params)=> localAI(...params),

  // character thumb
  'getCharacterThumb': (params)=> getCharacterThumb(...params),

  // md5 hash
  'md5Hash': (params) => {
    const input = params[0];
    const hash = createHash('md5');
    hash.update(input);
    return hash.digest('hex');
  },

  // decompressGzip
  'decompressGzip': (params) => {    
    const base64Data = params[0];
    const compressedData = Buffer.from(base64Data, 'base64');
    const decompressedData = zlib.gunzipSync(compressedData);
    return decompressedData;
  },

  // compressGzip
  'compressGzip': (params) => {
    const base64Data = params[0];
    return compressGzipThenBase64(Buffer.from(base64Data, 'base64'));
  },

  // create password
  'bcryptHash': (params) => {
    const pass = params[0];
    return bcrypt.hash(pass, 12);
  },

  // comfyui
  'runComfyUI': (params)=> runComfyUI(...params),
  'runComfyUI_Regional': (params)=> runComfyUI_Regional(...params),
  'runComfyUI_ControlNet': (params)=> runComfyUI_ControlNet(...params),
  'runComfyUI_MiraITU': (params)=> runComfyUI_MiraITU(...params),
  'openWsComfyUI': (params)=> openWsComfyUI(...params),
  'closeWsComfyUI': ()=> closeWsComfyUI(),
  'cancelComfyUI': ()=> cancelComfyUI(),

  // webui
  'runWebUI': (params)=> runWebUI(...params),
  'runWebUI_Regional': (params)=> runWebUI_Regional(...params),
  'runWebUI_ControlNet': (params)=> runWebUI_ControlNet(...params),
  'cancelWebUI': ()=> cancelWebUI(),
  'startPollingWebUI': ()=> startPollingWebUI(),
  'stopPollingWebUI': ()=> stopPollingWebUI(),
  'getControlNetProcessorListWebUI': ()=> getControlNetProcessorList(),
  'getADetailerModelListWebUI': ()=> getADetailerModelList(),
  'getUpscalersModelListWebUI': ()=> getUpscalersModelList(),
  'resetModelListsWebUI': ()=> resetModelLists(),

  // Image Tagger
  'runImageTagger': (params)=> {
    const packedArgs = {
        image_input: params[0],
        model_choice: params[1],
        gen_threshold: params[2], 
        char_threshold: params[3],
        model_options: params[4],
        wait: params[5]?params[5]:false
    }
    return runImageTagger(packedArgs);
  },

  // Python Tools Requests
  'python_runComfyUI': (params) => python_runComfyUI(...params),
  'python_runWebUI': (params) => python_runWebUI(...params),
};

async function handleApiRequest(ws, method, params, id) {
    let result;

    const handler = methodHandlers[method];
    if (handler) {
        result = await handler(params);
    } else {
        ws.send(JSON.stringify({ type: 'APIError', method, id, error: `Unknown API method: ${method}` }));
        console.warn(CAT, `Unknown API method: ${method}`);
        return;
    }

    try {
        ws.send(JSON.stringify({ type: 'APIResponse', method, id, value: result }));
    } catch (error) {
        ws.send(JSON.stringify({ type: 'APIError', method, id, error: error.message }));
        console.error(CAT, `Error executing API method ${method}:`, error);
    }
}

export {
    setupHttpServer,
    closeWebSocketServer,
    broadcastMessage,
    sendToClient,
};