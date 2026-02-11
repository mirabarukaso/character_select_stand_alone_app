#!/usr/bin/env python3
"""
SAA CLI Tool

A command-line interface for interacting with Character Select SAA via WebSocket connections. 
Supports both ComfyUI and WebUI backends.

Author: mirabarukaso
License: MIT

https://github.com/mirabarukaso/character_select_stand_alone_app
"""

import asyncio
import json
import ssl
import aiohttp
import websockets
from typing import Dict, Callable, Optional, List
import random
import base64
import argparse
import sys
import logging
from dataclasses import dataclass
from enum import Enum

# ============ Constants ============

SAMPLER_COMFYUI = [
    "euler_ancestral", "euler", "euler_cfg_pp", "euler_ancestral_cfg_pp", "heun", "heunpp2",
    "dpm_2", "dpm_2_ancestral", "lms", "dpm_fast", "dpm_adaptive", "dpmpp_2s_ancestral", 
    "dpmpp_2s_ancestral_cfg_pp", "dpmpp_sde", "dpmpp_sde_gpu", "dpmpp_2m", "dpmpp_2m_cfg_pp", 
    "dpmpp_2m_sde", "dpmpp_2m_sde_gpu", "dpmpp_3m_sde", "dpmpp_3m_sde_gpu", "ddpm", "lcm",
    "ipndm", "ipndm_v", "deis", "res_multistep", "res_multistep_cfg_pp", "res_multistep_ancestral", 
    "res_multistep_ancestral_cfg_pp", "gradient_estimation", "er_sde", "seeds_2", "seeds_3"
]

SCHEDULER_COMFYUI = [
    "normal", "karras", "exponential", "sgm_uniform", "simple", "ddim_uniform", 
    "beta", "linear_quadratic", "kl_optimal"
]

SAMPLER_WEBUI = [
    "Euler a", "Euler", "DPM++ 2M", "DPM++ SDE", "DPM++ 2M SDE", "DPM++ 2M SDE Heun", 
    "DPM++ 2S a", "DPM++ 3M SDE", "LMS", "Heun", "DPM2", "DPM2 a", "DPM fast", 
    "DPM adaptive", "Restart"
]

SCHEDULER_WEBUI = [
    "Automatic", "Uniform", "Karras", "Exponential", "Polyexponential", "SGM Uniform", 
    "KL Optimal", "Align Your Steps", "Simple", "Normal", "DDIM", "Beta"
]

WSS = "wss://"
HIFIX_DEFAULT_MODEL = "RealESRGAN_x4plus_anime_6B.pth"

# ============ Exit Codes ============

class ExitCode(Enum):
    """Standard exit codes for the CLI tool"""
    SUCCESS = 0
    CONNECTION_ERROR = 1
    AUTHENTICATION_ERROR = 2
    GENERATION_ERROR = 3
    TIMEOUT_ERROR = 4
    INVALID_PARAMS = 5
    UNKNOWN_ERROR = 99

# ============ Configuration ============

@dataclass
class GenerationConfig:
    """Configuration for image generation"""
    # Connection settings
    ws_address: str
    api_address: str = "127.0.0.1:58188"
    api_interface: str = "ComfyUI"  # ComfyUI or WebUI
    username: str = "saac_user"
    password: str = ""
    timeout: int = 120
    
    # Generation parameters
    model: str = "waiIllustriousSDXL_v160.safetensors"
    positive: str = ""
    negative: str = ""
    width: int = 1024
    height: int = 1360
    cfg: float = 7.0
    steps: int = 28
    seed: int = -1
    sampler: str = "euler_ancestral"
    scheduler: str = "normal"
    
    # Regional settings
    regional: bool = False
    positive_left: str = ""
    positive_right: str = ""
    overlap_ratio: int = 20
    image_ratio: int = 50
    
    # Enhancement settings
    hifix: bool = False
    hifix_scale: float = 2.0
    hifix_denoise: float = 0.55
    hifix_steps: int = 20
    # Hi-res fix model and seed control
    hifix_model: str = HIFIX_DEFAULT_MODEL
    hifix_random_seed: bool = True
    hifix_seed: int = -1
    refiner: bool = False
    refiner_model: str = "None"
    refiner_ratio: float = 0.4
    
    # vpred settings: 0 auto, 1 vpred, 2 no vpred
    vpred: int = 0
    refiner_vpred: int = 0
    
    # Skeleton key for unlocking backend atomic lock
    skeleton_key: bool = False
    
    # Output settings
    output_file: str = "generated_image.png"
    output_base64: bool = False

# ============ Logger Setup ============

def setup_logger(verbose: bool = False) -> logging.Logger:
    """Configure logging with appropriate level"""
    logger = logging.getLogger("saa_client")
    logger.setLevel(logging.DEBUG if verbose else logging.INFO)
    
    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(logging.DEBUG if verbose else logging.INFO)
    
    formatter = logging.Formatter(
        '%(asctime)s - %(levelname)s - %(message)s',
        datefmt='%H:%M:%S'
    )
    handler.setFormatter(formatter)
    
    logger.addHandler(handler)
    return logger

# ============ Data Packer ============

class GenerateDataPacker:
    """Packs generation parameters into API-compatible format"""
    
    def __init__(self, api_address: str = "127.0.0.1:58188", api_interface: str = "ComfyUI", logger: Optional[logging.Logger] = None):
        self.api_address = api_address
        self.api_interface = api_interface
        self.logger = logger or logging.getLogger("saa_client")

    def create_hifix(self, enable: bool = False, model: str = HIFIX_DEFAULT_MODEL, random_seed: bool = False, seed: int = -1, scale: float = 2.0, denoise: float = 0.55, steps: int = 20) -> Dict:
        """Create high-resolution fix parameters

        Args:
            enable: whether to enable hifix
            model: hifix model filename
            random_seed: whether the hifix pass should use a freshly generated seed
            seed: seed to use when random_seed is False
            scale, denoise, steps: processing parameters
        """
        return {
            "enable": enable,
            "model": model,
            "colorTransfer": "Mean",
            "randomSeed": bool(random_seed),
            "seed": seed,
            "scale": scale,
            "denoise": denoise,
            "steps": steps,
            "info": ""
        }

    def create_refiner(self, enable: bool = False, model: str = "None", ratio: float = 0.4, vpred: int = 0) -> Dict:
        """Create refiner parameters"""
        return {
            "enable": enable,
            "model": model,
            "vpred": vpred,
            "addnoise": "enable",
            "ratio": ratio,
            "info": ""
        }

    def create_regional_params(
        self, 
        overlap_ratio: int = 20, 
        image_ratio: int = 50, 
        str_left: float = 1.0, 
        str_right: float = 1.0, 
        option_left: str = "default", 
        option_right: str = "default"
    ) -> Dict:
        """Create regional prompting parameters"""
        a = image_ratio / 50.0
        c = 2.0 - a
        b = overlap_ratio / 100.0
        
        if self.api_interface == "WebUI":
            ratio_str = f"{a},{c}"
        else:
            ratio_str = f"{a},{b if b != 0 else 0.01},{c}"

        return {
            "info": "", 
            "ratio": ratio_str,
            "str_left": str_left,
            "str_right": str_right,
            "option_left": option_left,
            "option_right": option_right
        }

    def pack(self, regional: bool = False, **kwargs) -> Dict: # noqa S3776
        """Pack all parameters into generation request"""
        # Handle seed
        seed = kwargs.get("seed", -1)
        if seed == -1:
            seed = random.randint(0, 4294967296)
            self.logger.info(f"Generated random seed: {seed}")
        else:
            self.logger.info(f"Using provided seed: {seed}")
        
        # Validate sampler
        sampler = kwargs.get("sampler", "euler_ancestral")
        if self.api_interface == "ComfyUI" and sampler not in SAMPLER_COMFYUI:
            self.logger.warning(f"Sampler '{sampler}' not supported in ComfyUI, using 'euler_ancestral'")
            sampler = "euler_ancestral"
        elif self.api_interface == "WebUI" and sampler not in SAMPLER_WEBUI:
            self.logger.warning(f"Sampler '{sampler}' not supported in WebUI, using 'Euler a'")
            sampler = "Euler a"
        
        # Validate scheduler
        scheduler = kwargs.get("scheduler", "normal")
        if self.api_interface == "ComfyUI" and scheduler not in SCHEDULER_COMFYUI:
            self.logger.warning(f"Scheduler '{scheduler}' not supported in ComfyUI, using 'normal'")
            scheduler = "normal"
        elif self.api_interface == "WebUI" and scheduler not in SCHEDULER_WEBUI:
            self.logger.warning(f"Scheduler '{scheduler}' not supported in WebUI, using 'Automatic'")
            scheduler = "Automatic"
        
        # --- HiResFix seed/model decision logic ---
        # Determine hifix model
        hifix_model = kwargs.get("hifix_model", HIFIX_DEFAULT_MODEL)

        # Detect if user explicitly provided a hifix seed
        hifix_seed_provided = "hifix_seed" in kwargs
        hifix_seed_user = kwargs.get("hifix_seed", None)

        # Determine if user asked for fresh random seed for hifix
        hifix_random_flag = kwargs.get("hifix_random_seed", kwargs.get("hifix_randomSeed", None))

        # Resolve final hifix seed and random flag following rules:
        # 1) If user provided hifix_seed (present in kwargs) => treat as provided: randomSeed = False,
        #    but if user provided -1 explicitly, follow -1 semantics and generate a new seed here.
        # 2) Else if hifix_random_flag is True => generate a new random seed and set randomSeed = True.
        # 3) Else => use main seed (which may have been generated above) and randomSeed = False.
        if hifix_seed_provided:
            # user provided a value
            if isinstance(hifix_seed_user, int) and hifix_seed_user == -1:
                hifix_seed_to_use = random.randint(0, 4294967296)
                hifix_random = True
                self.logger.info(f"hifix: user provided -1 -> generated hifix seed: {hifix_seed_to_use}")
            else:
                hifix_seed_to_use = int(hifix_seed_user) if hifix_seed_user is not None else seed
                hifix_random = False
                self.logger.info(f"hifix: using user-provided hifix seed: {hifix_seed_to_use}")
        else:
            # no explicit hifix_seed provided
            if hifix_random_flag:
                hifix_seed_to_use = random.randint(0, 4294967296)
                hifix_random = True
                self.logger.info(f"hifix: random seed enabled -> generated hifix seed: {hifix_seed_to_use}")
            else:
                # reuse main seed
                hifix_seed_to_use = seed
                hifix_random = False
                self.logger.info(f"hifix: reusing main seed for hifix: {hifix_seed_to_use}")
            
        data = {
            "addr": kwargs.get("api_address", self.api_address),
            "auth": kwargs.get("auth", ""),
            "uuid": kwargs.get("browserUUID", "python-client"),
            "model": kwargs.get("model", "waiIllustriousSDXL_v160.safetensors"),
            "vpred": kwargs.get("vpred", 0),
            "negative": kwargs.get("negative", ""),
            "width": kwargs.get("width", 1024),
            "height": kwargs.get("height", 1360),
            "cfg": kwargs.get("cfg", 7.0),
            "step": kwargs.get("step", 28),
            "seed": seed,
            "sampler": sampler,
            "scheduler": scheduler,
            "refresh": kwargs.get("refresh", 0),
            "hifix": self.create_hifix(
                enable=kwargs.get("hifix", False),
                model=hifix_model,
                random_seed=hifix_random,
                seed=hifix_seed_to_use,
                scale=kwargs.get("hifix_scale", 2.0),
                denoise=kwargs.get("hifix_denoise", 0.55),
                steps=kwargs.get("hifix_steps", 20)
            ),
            "refiner": self.create_refiner(
                enable=kwargs.get("refiner", False),
                model=kwargs.get("refiner_model", "None"),
                ratio=kwargs.get("refiner_ratio", 0.4),
                vpred=kwargs.get("refiner_vpred", 0)
            ),
            "controlnet": [],
            "adetailer": [],
        }

        if regional:
            data["positive_left"] = kwargs.get("positive_left", "")
            data["positive_right"] = kwargs.get("positive_right", "")
            data["regional"] = kwargs.get("regional_params", self.create_regional_params())
        else:
            data["positive"] = kwargs.get("positive", "")

        return data

# ============ WebSocket Client ============

class SAAClient:
    """WebSocket client for SAA server communication"""
    
    def __init__(
        self, 
        ws_address: str, 
        username: str = "saac_user", 
        password: str = "", 
        timeout: int = 120,
        logger: Optional[logging.Logger] = None
    ):
        """
        Initialize WebSocket client
        
        Args:
            ws_address: WebSocket server address (e.g., ws://localhost:51028 or wss://example.com)
            username: Login username
            password: Login password
            timeout: Timeout for operations in seconds
            logger: Logger instance
        """
        self.ws_address = ws_address
        self.username = username
        self.password = password
        self.timeout = timeout
        self.logger = logger or logging.getLogger("saa_client")
        
        # Determine HTTP protocol
        self.http_protocol = "https" if ws_address.startswith(WSS) else "http"
        self.http_base = ws_address.replace("ws://", "http://").replace(WSS, "https://")
        
        self.ws: Optional[websockets.WebSocketClientProtocol] = None
        self.client_uuid: Optional[str] = None
        self.message_id = 0
        self.callbacks: Dict[str, Callable] = {}
        self.pending_messages: Dict[int, asyncio.Future] = {}
        self.reconnecting = False
        self.running = False
        self.version: Optional[str] = None
        self._receive_task: Optional[asyncio.Task] = None
        self.generation_completed = asyncio.Event()
        self.should_close = False
        self.generated_image_base64: Optional[str] = None
                
    async def login(self) -> Optional[str]:
        """
        Login via HTTP API to get UUID token
        
        Returns:
            UUID token on success, None on failure
        """
        login_url = f"{self.http_base}/api/login"
        
        try:
            # Create SSL context, ignore self-signed certificate verification
            ssl_context = ssl.create_default_context()
            ssl_context.check_hostname = False
            ssl_context.verify_mode = ssl.CERT_NONE
            
            async with aiohttp.ClientSession(connector=aiohttp.TCPConnector(ssl=ssl_context)) as session:
                async with session.post(
                    login_url,
                    json={"username": self.username, "password": self.password},
                    headers={"Content-Type": "application/json"}
                ) as response:
                    data = await response.json()
                    
                    if response.status == 200:
                        self.logger.debug(f"Login successful, UUID: {data['token']}")
                        return data['token']
                    else:
                        self.logger.error(f"Login failed: {data.get('error', 'Unknown error')}")
                        return None
                        
        except Exception as e:
            self.logger.error(f"Login request failed: {e}")
            return None
    
    async def connect(self) -> bool:
        """
        Connect to WebSocket server and authenticate
        
        Returns:
            True on success, False on failure
        """
        try:
            # If using wss, login first to get UUID
            if self.ws_address.startswith(WSS):
                self.logger.debug("Using WSS connection, performing login...")
                self.client_uuid = await self.login()
                if not self.client_uuid:
                    return False
            else:
                # For ws, generate a random UUID
                self.client_uuid = f"python-client-{random.randint(1000, 9999)}"
            
            self.logger.info(f"Connecting to {self.ws_address}...")
            
            # Create SSL context for wss
            ssl_context = None
            if self.ws_address.startswith(WSS):
                ssl_context = ssl.create_default_context()
                ssl_context.check_hostname = False
                ssl_context.verify_mode = ssl.CERT_NONE
            
            # Connect to WebSocket
            self.ws = await websockets.connect(
                self.ws_address,
                ssl=ssl_context,
                max_size=100 * 1024 * 1024  # 100MB max message size
            )
            
            self.running = True
            self._receive_task = asyncio.create_task(self._receive_messages())
            
            # Register client UUID
            register_response = await self.send_message({
                "type": "registerUUID",
                "method": "registerUUID",
                "uuid": self.client_uuid
            })
            if register_response and "value" in register_response:
                self.logger.debug(f"Register successfully! {register_response["value"]}")
            else:
                self.logger.error("Failed to Register to SAA server")
                return False
            
            # Get server version
            version_response = await self.send_message({
                "type": "API",
                "method": "getAppVersion",
                "params": []
            })
            
            if version_response and "value" in version_response:
                self.version = version_response["value"]
                self.logger.info(f"SAA version: {self.version}")
                return True
            else:
                self.logger.error("Failed to get SAA version")
                return False
                
        except Exception as e:
            self.logger.error(f"Connection failed: {e}")
            return False
    
    async def _receive_messages(self):
        """Receive and process messages from WebSocket"""
        try:
            async for message in self.ws:
                try:
                    data = json.loads(message)
                    await self._handle_message(data)
                except json.JSONDecodeError as e:
                    self.logger.error(f"Failed to parse message: {e}")
                except Exception as e:
                    self.logger.error(f"Error handling message: {e}")
                    
        except websockets.exceptions.ConnectionClosed as e:
            if not self.should_close:
                self.logger.warning(f"WebSocket connection closed: {e}")
            else:
                self.logger.debug("WebSocket connection closed normally")
        except Exception as e:
            self.logger.error(f"Error in receive loop: {e}")
        finally:
            self.running = False
    
    async def _handle_message(self, data: Dict):    # noqa S3776
        """Process incoming WebSocket message"""
        message_type = data.get("type", "")
                
        # Handle callback messages
        if message_type == "Callback":
            value = data.get("value", {})
            callback_name = value.get("callbackName", "")
            args = value.get("args", [])
            
            if callback_name in self.callbacks:
                callback = self.callbacks[callback_name]
                if asyncio.iscoroutinefunction(callback):
                    await callback(args)
                else:
                    callback(args)
            return
        
        elif message_type == "registerUUIDResponse":
            self.logger.debug(f"Received registerUUID response: {data}")
        
        elif message_type == "APIResponse":
            self.logger.debug(f"Received API response: {data}")
        
        elif message_type == "APIError":
            self.logger.error(f"API Error: {data.get('error')}")
        
        else:
            self.logger.warning(f"Received unknown message type: {message_type}")
        
        # Handle response messages
        if "id" in data:
            msg_id = data["id"]
            if msg_id in self.pending_messages:
                future = self.pending_messages[msg_id]
                if not future.done():
                    future.set_result(data)
                del self.pending_messages[msg_id]
    
    async def send_message(self, message: Dict, allow_reconnect: bool = True) -> Optional[Dict]:  # noqa S3776
        """
        Send message to WebSocket server and wait for response
        
        Args:
            message: Message dictionary
            allow_reconnect: Whether to allow reconnection on failure
            
        Returns:
            Response dictionary or None on error
        """
        if not self.ws or self.ws.close_code is not None:
            if allow_reconnect and not self.reconnecting:
                self.logger.warning("WebSocket disconnected, attempting to reconnect...")
                if not await self.connect():
                    raise RuntimeError("WebSocket connection failed and reconnection unsuccessful")
            else:
                raise RuntimeError("WebSocket connection closed")
        
        # Add message ID
        self.message_id += 1
        msg_id = self.message_id
        message_with_id = {**message, "id": msg_id, "uuid": self.client_uuid}
        self.logger.debug(f"Preparing to send message: {message_with_id}")
        
        # Create future for response
        future = asyncio.Future()
        self.pending_messages[msg_id] = future
        
        try:
            # Send message
            await self.ws.send(json.dumps(message_with_id))
            self.logger.debug(f"Sent message: {message.get('type')} - {message.get('method')} (ID: {msg_id})")
            
            # Wait for response with timeout
            response = await asyncio.wait_for(future, timeout=self.timeout)
            return response
            
        except asyncio.TimeoutError:
            if msg_id in self.pending_messages:
                del self.pending_messages[msg_id]
            method = message_with_id.get("method", "")
            ws_status = "closed" if (not self.ws or self.ws.close_code is not None) else "active"
            self.logger.error(f"Message timeout [{message_with_id.get('type')} - {method}] ID={msg_id}")
            self.logger.error(f"  Wait time: {self.timeout}s | WebSocket status: {ws_status}")
            raise RuntimeError(f"Message timeout (ID: {msg_id}, method: {method}, wait: {self.timeout}s)")
        except Exception as e:
            if msg_id in self.pending_messages:
                del self.pending_messages[msg_id]
            raise RuntimeError(f"Failed to send message: {e}")
    
    def register_callback(self, message_type: str, callback: Callable):
        """Register a callback function for specific message type"""
        callback_name = f"{self.client_uuid}-{message_type}"
        self.callbacks[callback_name] = callback
        self.logger.debug(f"Registered callback: {callback_name}")
    
    def unregister_callback(self, message_type: str):
        """Unregister a callback function"""
        callback_name = f"{self.client_uuid}-{message_type}"
        if callback_name in self.callbacks:
            del self.callbacks[callback_name]
            self.logger.debug(f"Unregistered callback: {callback_name}")
    
    async def close(self):
        """Close WebSocket connection"""
        self.running = False
        
        # Cancel receive task
        if self._receive_task and not self._receive_task.done():
            self._receive_task.cancel()
            try:
                await self._receive_task
            except asyncio.CancelledError:
                if self.should_close:
                    self.logger.info("Connection closed normally")
                else:
                    self.logger.warning("Connection closed unexpectedly")
                    raise
            except Exception as e:
                self.logger.error(f"Error cancelling receive task: {e}")
        
        if self.ws and self.ws.close_code is None:
            await self.ws.close()
            self.logger.debug("WebSocket connection closed")

# ============ Callbacks ============

class ProgressCallback:
    """Callback handler for generation progress updates"""
    
    def __init__(self, client: SAAClient, output_file: str, output_base64: bool, logger: logging.Logger):
        self.client = client
        self.output_file = output_file
        self.output_base64 = output_base64
        self.logger = logger
    
    def __call__(self, args: List):  # noqa S3776
        """Handle progress update"""
        if len(args) == 2:
            # Progress update
            current = args[0]
            total = args[1]
            
            if isinstance(total, str):
                self.logger.debug(f"Progress: {current}/{total}")
                if current >= total:
                    self.logger.info("Generation completed, waiting for final image...")
            else:
                percentage = (current * 100 // total) if total > 0 else 0
                self.logger.debug(f"Progress: {current}/{total} ({percentage}%)")
                if percentage >= 100:
                    self.logger.info("Generation completed, waiting for final image...")
                    
        elif len(args) == 1:
            # Final image data
            self.logger.debug("Received final image data")
            image_data = args[0]
            
            if image_data.startswith("Error:"):
                self.logger.error(f"Generation failed: {image_data}")
                self.client.should_close = True
            elif image_data.startswith("data:image/png;base64,"):
                self.logger.debug("Received valid image data (base64)")
                image_base64 = image_data.split(",", 1)[1]
                
                # Save to file
                try:
                    with open(self.output_file, "wb") as f:
                        f.write(base64.b64decode(image_base64))
                    self.logger.info(f"Image saved to: {self.output_file}")
                except Exception as e:
                    self.logger.error(f"Failed to save image: {e}")
                
                # Store base64 for output
                if self.output_base64:
                    self.client.generated_image_base64 = image_base64
                
                self.client.should_close = True
                
        elif len(args) == 3:
            # Backend message
            level = args[0]
            category = args[1]
            message = args[2]
            
            level_map = {
                "warn": "WARNING",
                "error": "ERROR",
                "log": "INFO"
            }
            log_level = level_map.get(level, "INFO")
            
            backend_message = f"Backend message: {category} {message}"
            if log_level == "ERROR":
                self.logger.error(backend_message)
            elif log_level == "WARNING":
                self.logger.warning(backend_message)
            else:
                self.logger.info(backend_message)
        else:
            self.logger.warning(f"Unexpected callback args count: {len(args)}")

# ============ Main Functions ============

async def generate_image(config: GenerationConfig, logger: logging.Logger) -> int:
    """
    Generate image using SAA WebSocket client
    
    Args:
        config: Generation configuration
        logger: Logger instance
        
    Returns:
        Exit code
    """
    client = SAAClient(
        config.ws_address, 
        config.username, 
        config.password, 
        config.timeout,
        logger
    )
    
    try:
        # Connect to server
        if not await client.connect():
            logger.error("Connection failed")
            return ExitCode.CONNECTION_ERROR.value
        
        logger.debug("Connected successfully!")
        
        # Register progress callback
        callback = ProgressCallback(client, config.output_file, config.output_base64, logger)
        client.register_callback("updateProgress", callback)
        
        # Prepare generation data
        packer = GenerateDataPacker(
            api_address=config.api_address,
            api_interface=config.api_interface,
            logger=logger
        )
        
        # Build parameters
        params = {
            "browserUUID": client.client_uuid,
            "refresh": 1,
            "model": config.model,
            "vpred": config.vpred,
            "negative": config.negative,
            "width": config.width,
            "height": config.height,
            "cfg": config.cfg,
            "step": config.steps,
            "seed": config.seed,
            "sampler": config.sampler,
            "scheduler": config.scheduler,
            "hifix": config.hifix,
            "hifix_scale": config.hifix_scale,
            "hifix_denoise": config.hifix_denoise,
            "hifix_steps": config.hifix_steps,
            "hifix_model": config.hifix_model,
            "hifix_random_seed": config.hifix_random_seed,
            "hifix_seed": config.hifix_seed,
            "refiner": config.refiner,
            "refiner_model": config.refiner_model,
            "refiner_ratio": config.refiner_ratio,
            "refiner_vpred": config.refiner_vpred,
        }
        
        if config.regional:
            params["positive_left"] = config.positive_left
            params["positive_right"] = config.positive_right
            params["regional_params"] = packer.create_regional_params(
                overlap_ratio=config.overlap_ratio,
                image_ratio=config.image_ratio
            )
        else:
            params["positive"] = config.positive
        
        packet = packer.pack(regional=config.regional, **params)
        
        # Send generation request
        logger.info("Sending generation request...")
        method = f"python_run{config.api_interface}"
        
        result = await client.send_message({
            "type": "API",
            "method": method,
            "params": [packet, config.regional, config.skeleton_key]
        }, allow_reconnect=False)        
        logger.info(f"Generation result: {result.get('value')}")
        
        # Wait a bit for final callback
        await asyncio.sleep(2)
        
        # Output base64 if requested
        if config.output_base64 and client.generated_image_base64:
            print("\n" + "="*50)
            print("BASE64_IMAGE_DATA_START")
            print(client.generated_image_base64)
            print("BASE64_IMAGE_DATA_END")
            print("="*50 + "\n")
        
        return ExitCode.SUCCESS.value
        
    except asyncio.TimeoutError:
        logger.error("Operation timed out")
        return ExitCode.TIMEOUT_ERROR.value
    except KeyboardInterrupt:
        logger.info("Interrupted by user")
        return ExitCode.SUCCESS.value
    except Exception as e:
        logger.error(f"Error occurred: {e}", exc_info=True)
        return ExitCode.UNKNOWN_ERROR.value
    #finally:
        #await client.close()

def print_usage():
    """Print usage information and examples"""
    print("""
SAA WebSocket Client CLI Tool
=============================

A command-line interface for generating images using Stable Diffusion API Character Select SAA.

Project URL:
    https://github.com/mirabarukaso/character_select_stand_alone_app

BASIC USAGE:
    python saa_websocket_cli.py --ws-address <address> --positive "<prompt>"

EXAMPLES:
    # Basic generation
    python saa_websocket_cli.py \\
        --ws-address ws://127.0.0.1:51028 \\
        --positive "1girl, masterpiece, best quality" \\
        --negative "low quality, blurry" \\
        --width 1024 --height 1360

    # Regional prompting (split composition) with authentication
    python saa_websocket_cli.py \\
        --ws-address wss://127.0.0.1:51028 \\
        --username saac_user --password ****** \\
        --regional \\
        --positive-left "1girl, blue hair, dress" \\
        --positive-right "1girl, red hair, suit" \\
        --image-ratio 50 --overlap-ratio 20

    # Advanced settings with HiResFix
    python saa_websocket_cli.py \\
        --ws-address ws://127.0.0.1:51028 \\
        --positive "landscape, mountains, sunset" \\
        --sampler "dpmpp_2m" \\
        --scheduler "karras" \\
        --cfg 7.5 --steps 30 \\
        --hifix --hifix-scale 2.0

SUPPORTED INTERFACES:
    - ComfyUI (default)
    - WebUI (A1111/Forge)

OUTPUT FORMATS:
    - PNG file (always)
    - Base64 encoded data (when --base64 flag is used)

For full parameter list, use: python saa_websocket_cli.py --help
""")

def create_parser() -> argparse.ArgumentParser:
    """Create argument parser with all options"""
    parser = argparse.ArgumentParser(
        description="SAA WebSocket Client - Generate images via Stable Diffusion API Aggregator",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        add_help=True
    )
    
    # Connection parameters
    conn_group = parser.add_argument_group('Connection Settings')
    conn_group.add_argument(
        '--ws-address',
        type=str,
        help='WebSocket server address (e.g., ws://127.0.0.1:51028 or wss://example.com:51028)'
    )
    conn_group.add_argument(
        '--api-address',
        type=str,
        default='127.0.0.1:58188',
        help='API backend address (default: 127.0.0.1:58188)'
    )
    conn_group.add_argument(
        '--api-interface',
        type=str,
        choices=['ComfyUI', 'WebUI'],
        default='ComfyUI',
        help='API interface type (default: ComfyUI)'
    )
    conn_group.add_argument(
        '--username',
        type=str,
        default='saac_user',
        help='Login username for WSS connections (default: saac_user)'
    )
    conn_group.add_argument(
        '--password',
        type=str,
        default='',
        help='Login password for WSS connections'
    )
    conn_group.add_argument(
        '--timeout',
        type=int,
        default=120,
        help='Operation timeout in seconds (default: 120)'
    )
    
    # Generation parameters
    gen_group = parser.add_argument_group('Generation Parameters')
    gen_group.add_argument(
        '--model',
        type=str,
        default='waiIllustriousSDXL_v160.safetensors',
        help='Model file name (default: waiIllustriousSDXL_v160.safetensors)'
    )
    gen_group.add_argument(
        '--positive',
        type=str,
        default='',
        help='Positive prompt (what you want)'
    )
    gen_group.add_argument(
        '--negative',
        type=str,
        default='',
        help='Negative prompt (what you don\'t want)'
    )
    gen_group.add_argument(
        '--width',
        type=int,
        default=1024,
        help='Image width in pixels (default: 1024)'
    )
    gen_group.add_argument(
        '--height',
        type=int,
        default=1360,
        help='Image height in pixels (default: 1360)'
    )
    gen_group.add_argument(
        '--cfg',
        type=float,
        default=7.0,
        help='CFG scale (classifier-free guidance) (default: 7.0)'
    )
    gen_group.add_argument(
        '--steps',
        type=int,
        default=28,
        help='Number of sampling steps (default: 28)'
    )
    gen_group.add_argument(
        '--seed',
        type=int,
        default=-1,
        help='Random seed (-1 for random) (default: -1)'
    )
    gen_group.add_argument(
        '--sampler',
        type=str,
        default='euler_ancestral',
        help='Sampler algorithm (default: euler_ancestral)'
    )
    gen_group.add_argument(
        '--scheduler',
        type=str,
        default='normal',
        help='Scheduler type (default: normal)'
    )
    
    # Regional prompting
    regional_group = parser.add_argument_group('Regional Prompting')
    regional_group.add_argument(
        '--regional',
        action='store_true',
        help='Enable regional prompting (split composition)'
    )
    regional_group.add_argument(
        '--positive-left',
        type=str,
        default='',
        help='Positive prompt for left region'
    )
    regional_group.add_argument(
        '--positive-right',
        type=str,
        default='',
        help='Positive prompt for right region'
    )
    regional_group.add_argument(
        '--image-ratio',
        type=int,
        default=50,
        help='Left/right split ratio (0-100) (default: 50)'
    )
    regional_group.add_argument(
        '--overlap-ratio',
        type=int,
        default=20,
        help='Overlap ratio between regions (0-100) (default: 20)'
    )
    
    # Enhancement options
    enhance_group = parser.add_argument_group('High Resolution Fix Options')
    enhance_group.add_argument(
        '--hifix',
        action='store_true',
        help='Enable high-resolution fix'
    )
    enhance_group.add_argument(
        '--hifix-scale',
        type=float,
        default=2.0,
        help='HiResFix upscale factor (default: 2.0)'
    )
    enhance_group.add_argument(
        '--hifix-denoise',
        type=float,
        default=0.55,
        help='HiResFix denoise strength (default: 0.55)'
    )
    enhance_group.add_argument(
        '--hifix-steps',
        type=int,
        default=20,
        help='HiResFix sampling steps (default: 20)'
    )
    enhance_group.add_argument(
        '--hifix-model',
        type=str,
        default=HIFIX_DEFAULT_MODEL,
        help=f'HiResFix model filename (default: {HIFIX_DEFAULT_MODEL})'
    )
    
    enhance_group = parser.add_argument_group('Refiner Options')
    enhance_group.add_argument(
        '--refiner',
        action='store_true',
        help='Enable refiner model'
    )
    enhance_group.add_argument(
        '--refiner-model',
        type=str,
        default='None',
        help='Refiner model name (default: None)'
    )
    enhance_group.add_argument(
        '--refiner-ratio',
        type=float,
        default=0.4,
        help='Refiner switch ratio (default: 0.8)'
    )
    enhance_group.add_argument(
        '--vpred',
        type=int,
        choices=[0,1,2],
        default=0,
        help='VPred setting for main model: 0 auto, 1 vpred, 2 no vpred (default: 0)'
    )
    enhance_group.add_argument(
        '--refiner-vpred',
        type=int,
        choices=[0,1,2],
        default=0,
        help='VPred setting for refiner: 0 auto, 1 vpred, 2 no vpred (default: 0)'
    )
    
    # Output options
    output_group = parser.add_argument_group('Output Options')
    output_group.add_argument(
        '--output',
        type=str,
        default='generated_image.png',
        help='Output file path (default: generated_image.png)'
    )
    output_group.add_argument(
        '--base64',
        action='store_true',
        help='Output base64 encoded image data to stdout'
    )
    output_group.add_argument(
        '--verbose',
        action='store_true',
        help='Enable verbose logging'
    )
    output_group.add_argument(
        '--skeleton-key',
        action='store_true',
        help='Force unlock backend atomic lock state (default: False)'
    )
    
    return parser

def main():
    """Main entry point"""
    parser = create_parser()
    args = parser.parse_args()
    
    # If no arguments, show usage
    if len(sys.argv) == 1:
        print_usage()
        return ExitCode.SUCCESS.value
    
    # Validate required parameters
    if not args.ws_address:
        print("Error: --ws-address is required", file=sys.stderr)
        print("\nUse --help for usage information", file=sys.stderr)
        return ExitCode.INVALID_PARAMS.value
    
    if not args.regional and not args.positive:
        print("Error: --positive is required for non-regional generation", file=sys.stderr)
        return ExitCode.INVALID_PARAMS.value
    
    if args.regional and (not args.positive_left or not args.positive_right):
        print("Error: --positive-left and --positive-right are required for regional generation", file=sys.stderr)
        return ExitCode.INVALID_PARAMS.value
    
    # Setup logger
    logger = setup_logger(args.verbose)
    
    # Create configuration
    config = GenerationConfig(
        ws_address=args.ws_address,
        api_address=args.api_address,
        api_interface=args.api_interface,
        username=args.username,
        password=args.password,
        timeout=args.timeout,
        model=args.model,
        positive=args.positive,
        negative=args.negative,
        width=args.width,
        height=args.height,
        cfg=args.cfg,
        steps=args.steps,
        seed=args.seed,
        sampler=args.sampler,
        scheduler=args.scheduler,
        regional=args.regional,
        positive_left=args.positive_left,
        positive_right=args.positive_right,
        overlap_ratio=args.overlap_ratio,
        image_ratio=args.image_ratio,
        hifix=args.hifix,
        hifix_scale=args.hifix_scale,
        hifix_denoise=args.hifix_denoise,
        hifix_steps=args.hifix_steps,
        hifix_model=args.hifix_model,
        refiner=args.refiner,
        refiner_model=args.refiner_model,
        refiner_ratio=args.refiner_ratio,
        vpred=args.vpred,
        refiner_vpred=args.refiner_vpred,
        skeleton_key=args.skeleton_key,
        output_file=args.output,
        output_base64=args.base64
    )
    
    # Run generation
    try:
        exit_code = asyncio.run(generate_image(config, logger))
        return exit_code
    except KeyboardInterrupt:
        logger.info("Interrupted by user")
        return ExitCode.SUCCESS.value
    except Exception as e:
        logger.error(f"Unexpected error: {e}", exc_info=args.verbose)
        return ExitCode.UNKNOWN_ERROR.value

if __name__ == "__main__":
    sys.exit(main())    

