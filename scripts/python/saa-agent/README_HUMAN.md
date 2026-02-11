# SAA CLI Tool

## Overview

A command-line interface for interacting with Character Select Stand Alone App (SAA) via WebSocket connections. Supports both ComfyUI and WebUI backends for AI image generation.

**Author:** mirabarukaso  
**License:** MIT  
**Project:** https://github.com/mirabarukaso/character_select_stand_alone_app

## Prerequisites

Before using this tool, ensure the following:

1. **SAA Backend Running**: The Stand Alone App must be running and accessible
2. **SAAC Feature Enabled**: The SAA Client (SAAC) feature must be enabled in the backend
3. **Network Access**: Ensure you can reach the SAA backend via WebSocket

For detailed setup instructions, visit the [project repository](https://github.com/mirabarukaso/character_select_stand_alone_app).

## Installation

### Requirements

- Python 3.7 or higher
- Required Python packages:
  - `websockets`
  - `aiohttp`

### Install Dependencies

```bash
pip install websockets aiohttp
```

### Download the Tool

Save `saa-agent.py` to your local directory and make it executable:

```bash
chmod +x saa-agent.py
```

## Basic Usage

### Minimal Command

The simplest generation command requires only the WebSocket address and a positive prompt:

```bash
python saa-agent.py --ws-address "ws://127.0.0.1:51028" --positive "1girl, anime style, beautiful"
```

### Common Usage Example

Generate an image with a specific model:

```bash
python saa-agent.py \
  --ws-address "ws://127.0.0.1:51028" \
  --model "waiIllustriousSDXL_v160.safetensors" \
  --positive "1girl, long hair, school uniform, cherry blossoms" \
  --negative "low quality, blurry, distorted" \
  --output "my_image.png"
```

### Regional Prompting Example

Create split composition with different prompts for left and right regions:

```bash
python saa-agent.py \
  --ws-address "ws://127.0.0.1:51028" \
  --regional \
  --positive-left "1girl, red hair, warrior" \
  --positive-right "1boy, blue hair, mage" \
  --image-ratio 50 \
  --overlap-ratio 20
```

## Command-Line Parameters

### Required Parameters

- `--ws-address`: WebSocket address of the SAA backend (required)
- `--positive`: Positive prompt (required for non-regional generation)
- For regional mode: `--positive-left` and `--positive-right` (required when using `--regional`)

### Connection Settings

- `--api-address`: API address (default: `127.0.0.1:58188`)
- `--api-interface`: Backend interface - `ComfyUI` or `WebUI` (default: `ComfyUI`)
- `--username`: Username for authentication (default: `saac_user`)
- `--password`: Password for authentication (default: empty)
- `--timeout`: Connection timeout in seconds (default: 600)

### Generation Parameters

- `--model`: Model checkpoint filename (default: `waiIllustriousSDXL_v160.safetensors`)
- `--negative`: Negative prompt (what you don't want)
- `--width`: Image width in pixels (default: 1024)
- `--height`: Image height in pixels (default: 1360)
- `--cfg`: CFG scale - classifier-free guidance (default: 7.0)
- `--steps`: Number of sampling steps (default: 28)
- `--seed`: Random seed, use -1 for random (default: -1)
- `--sampler`: Sampler algorithm (default: `euler_ancestral`)
- `--scheduler`: Scheduler type (default: `normal`)

### Regional Prompting

- `--regional`: Enable regional prompting mode
- `--positive-left`: Prompt for left region
- `--positive-right`: Prompt for right region
- `--image-ratio`: Left/right split ratio 0-100 (default: 50)
- `--overlap-ratio`: Overlap between regions 0-100 (default: 20)

### High-Resolution Fix (HiResFix)

**⚠️ Warning:** HiResFix significantly increases generation time. Only use if you have sufficient GPU performance.

- `--hifix`: Enable high-resolution fix
- `--hifix-scale`: Upscale factor (default: 2.0)
- `--hifix-denoise`: Denoise strength (default: 0.55)
- `--hifix-steps`: Sampling steps for hifix (default: 20)
- `--hifix-model`: Upscaler model (default: `RealESRGAN_x4plus_anime_6B.pth`)

### Refiner Options

- `--refiner`: Enable refiner model
- `--refiner-model`: Refiner model name (default: None)
- `--refiner-ratio`: Switch ratio for refiner (default: 0.4)
- `--vpred`: VPred setting for main model - 0 (auto), 1 (vpred), 2 (no vpred)
- `--refiner-vpred`: VPred setting for refiner

### Output Options

- `--output`: Output file path (default: `generated_image.png`)
- `--base64`: Output base64 encoded image to stdout
- `--verbose`: Enable verbose logging
- `--skeleton-key`: Force unlock backend atomic lock (see warning below)

## Error Handling

### Backend Busy Error

If you receive one of these errors:

```
Error: WebUI is busy, cannot run new generation, please try again later.
Error: ComfyUI is busy, cannot run new generation, please try again later.
```

**This means:**
- Another process is currently using the SAA backend, OR
- The backend is locked due to a previous error

**What to do:**
1. Wait 20-60 seconds for the current generation to complete
2. Retry your command
3. If the error persists and you're certain no other process is using the backend, use the skeleton key

### Using Skeleton Key

The skeleton key forcefully unlocks the backend's atomic lock:

```bash
python saa-agent.py \
  --ws-address "ws://127.0.0.1:51028" \
  --skeleton-key \
  --model "waiIllustriousSDXL_v160.safetensors" \
  --positive "1girl, long hair, school uniform, cherry blossoms" \
  --negative "low quality, blurry, distorted" \
  --output "my_image.png"
```

**⚠️ Important:**
- Only use when you're certain the backend is stuck
- Do NOT use if another user/process is actively generating
- Use this feature sparingly as it forcefully terminates backend locks

## Testing

### Quick Test

Verify the tool works with a minimal generation:

```bash
python saa-agent.py \
  --ws-address "ws://127.0.0.1:51028" \
  --positive "simple test, 1girl" \
  --steps 10 \
  --output "test.png"
```

### Verbose Mode Test

Run with detailed logging to diagnose issues:

```bash
python saa-agent.py \
  --ws-address "ws://127.0.0.1:51028" \
  --positive "test prompt" \
  --verbose
```

## Exit Codes

The tool returns standard exit codes:

- `0`: Success
- `1`: Connection error
- `2`: Authentication error
- `3`: Generation error
- `4`: Timeout error
- `5`: Invalid parameters
- `99`: Unknown error

## Supported Samplers and Schedulers

### ComfyUI Samplers
  `euler_ancestral`, `euler`, `euler_cfg_pp`, `euler_ancestral_cfg_pp`, `heun`, `heunpp2`,
  `dpm_2`, `dpm_2_ancestral`, `lms`, `dpm_fast`, `dpm_adaptive`, `dpmpp_2s_ancestral`, 
  `dpmpp_2s_ancestral_cfg_pp`, `dpmpp_sde`, `dpmpp_sde_gpu`, `dpmpp_2m`, `dpmpp_2m_cfg_pp`, 
  `dpmpp_2m_sde`, `dpmpp_2m_sde_gpu`, `dpmpp_3m_sde`, `dpmpp_3m_sde_gpu`, `ddpm`, `lcm`,
  `ipndm`, `ipndm_v`, `deis`, `res_multistep`, `res_multistep_cfg_pp`, `res_multistep_ancestral`, 
  `res_multistep_ancestral_cfg_pp`, `gradient_estimation`, `er_sde`, `seeds_2`, `seeds_3`


### WebUI Samplers
  `normal`, `karras`, `exponential`, `sgm_uniform`, `simple`, `ddim_uniform`, 
  `beta`, `linear_quadratic`, `kl_optimal`

### Schedulers
**ComfyUI:** 
  `Euler a`, `Euler`, `DPM++ 2M`, `DPM++ SDE`, `DPM++ 2M SDE`, `DPM++ 2M SDE Heun`, 
  `DPM++ 2S a`, `DPM++ 3M SDE`, `LMS`, `Heun`, `DPM2`, `DPM2 a`, `DPM fast`, 
  `DPM adaptive`, `Restart`    

**WebUI:** 
  `Automatic`, `Uniform`, `Karras`, `Exponential`, `Polyexponential`, `SGM Uniform`, 
  `KL Optimal`, `Align Your Steps`, `Simple`, `Normal`, `DDIM`, `Beta`

## Troubleshooting

### Connection Issues

1. Verify SAA backend is running
2. Check SAAC feature is enabled
3. Verify the WebSocket address is correct
4. Check firewall settings

### Generation Issues

1. Ensure prompts are not empty
2. Verify the model file exists in the backend
3. Check parameter values are within valid ranges
4. Use `--verbose` flag to see detailed logs

### Performance Issues

1. Avoid using `--hifix` unless necessary
2. Reduce `--steps` for faster generation
3. Use lower resolution for testing
4. Monitor GPU memory usage

## License

MIT License - See project repository for full details.

## Support

For issues, feature requests, or contributions, visit the [GitHub repository](https://github.com/mirabarukaso/character_select_stand_alone_app).