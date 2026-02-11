---
name: saa-agent
description: Enables AI agents to generate images using the Character Select Stand Alone App (SAA) image generation backend via command-line interface.
license: MIT
---

# SAA CLI Tool

A command-line interface for interacting with Character Select Stand Alone App (SAA) via WebSocket connections. Supports both ComfyUI and WebUI backends for AI image generation.

## Prerequisites

**CRITICAL:** Before invoking this tool, confirm with the user that:
1. The SAA backend is running, and version is above 2.4.0
2. The SAAC (SAA Client) feature is enabled
3. The WebSocket address is available
4. Some Mac users uses `python3` instead of `python` to invoke Python 3.x

For SAA setup details, let your owner visit the [project repository](https://github.com/mirabarukaso/character_select_stand_alone_app).

## Basic Usage

The tool requires minimal parameters to function. The examples below demonstrate the standard usage pattern:

### Minimal Command With Model Selection (Recommended for Most Cases)

```bash
python saa-agent.py \
  --ws-address "user_provided_ws_address" \
  --model "waiIllustriousSDXL_v160.safetensors" \
  --positive "your detailed prompt here" \
  --negative "low quality, blurry, bad anatomy"
```
### Regional Prompting (Split Composition)

```bash
python saa-agent.py \
  --ws-address "user_provided_ws_address" \
  --model "waiIllustriousSDXL_v160.safetensors" \
  --regional \
  --positive-left "1girl, warrior, red armor" \
  --positive-right "1boy, mage, blue robes"
```

### More Examples
Get more usage examples and detailed parameter explanations:

```bash
python saa-agent.py
python saa-agent.py --help
```

## Key Parameters

### Required
- `--ws-address`: WebSocket address (obtain from user)
- `--positive`: Main prompt OR use `--regional` mode with `--positive-left` and `--positive-right`

### Commonly Modified
- `--model`: Change the checkpoint model (default: `waiIllustriousSDXL_v160.safetensors`)
- `--negative`: Specify unwanted elements
- `--width` / `--height`: Image dimensions (defaults: 1024x1360)
- `--steps`: Sampling steps (default: 28)
- `--seed`: Set specific seed or -1 for random

### Advanced (Use Sparingly)
- `--cfg`: CFG scale (default: 7.0)
- `--sampler`: Sampling algorithm (default: `euler_ancestral`)
- `--scheduler`: Scheduler type (default: `normal`)

## Important Guidelines

### HiResFix Warning

**DO NOT use `--hifix` unless specifically requested by the user.**

HiResFix significantly increases generation time and requires substantial GPU resources. Only enable if:
- User explicitly requests high-resolution upscaling
- User confirms their GPU can handle the additional load

### Backend Busy State

If the generation returns either of these errors:

```
Error: WebUI is busy, cannot run new generation, please try again later.
Error: ComfyUI is busy, cannot run new generation, please try again later.
```

**Actions to take:**

1. **DO NOT** automatically retry the generation
2. Inform the user: "The SAA backend is currently busy. This could mean another process is generating an image, or the backend is locked from a previous error."
3. Advise: "Please wait 20-60 seconds before trying again."
4. Let the user manually retry

**DO NOT** chain multiple retry attempts as this can worsen backend congestion.

### Skeleton Key Usage

The `--skeleton-key` parameter forcefully unlocks the backend's atomic lock.

**When to use:**
- User confirms no other processes are using the backend
- Backend appears stuck despite waiting
- User explicitly requests unlocking

**How to use:**

```bash
python saa-agent.py \
  --ws-address "user_provided_ws_address" \
  --skeleton-key \
  --positive "test prompt"
```

**Rules:**
1. **ALWAYS** ask for user confirmation before using `--skeleton-key`
2. **ONLY** use it once per user request
3. Explain to the user that this forcefully terminates any locks

Example conversation:
```
AI: "The backend appears to be locked. Would you like me to use the skeleton key to force unlock it? This will terminate any existing locks."
User: "Yes, please unlock it."
AI: [proceeds to run command with --skeleton-key]
```

## Parameter Defaults

When in doubt, rely on these defaults - they work well for most cases:

- Model: `waiIllustriousSDXL_v160.safetensors`
- Dimensions: 1024x1360
- CFG: 7.0
- Steps: 28
- Sampler: `euler_ancestral`
- Scheduler: `normal`
- Seed: -1 (random)

## Output Handling

By default, images are saved to `generated_image.png`. You can specify a custom output path:

```bash
--output "custom_filename.png"
```

For programmatic handling, use base64 output:

```bash
--base64
```

This outputs base64-encoded image data(huge!!!) to stdout instead of saving a file.

## Example Workflow

1. User requests: "Generate an anime girl with long blue hair"

2. AI executes:
```bash
python saa-agent.py \
  --ws-address "user_ws_address" \
  --positive "1girl, long hair, blue hair, anime style, detailed" \
  --negative "low quality, blurry, bad anatomy"
```

3. If backend busy error occurs:
   - Inform user
   - Wait for user to retry (don't auto-retry)

4. If success:
   - Confirm image was generated
   - Provide file path if relevant

## Common Pitfalls to Avoid

1. **Don't use `--hifix`** unless explicitly requested
2. **Don't auto-retry** on backend busy errors
3. **Don't use `--skeleton-key`** without user permission
4. **Don't add excessive parameters** - unless explicitly requested, the defaults are well-tuned
5. **Don't assume backend is ready** - always confirm with user first

## Error Codes

- Exit code 0: Success
- Exit code 1: Connection error (check backend is running)
- Exit code 2: Authentication error (check credentials)
- Exit code 3: Generation error (check parameters)
- Exit code 4: Timeout (backend may be overloaded)
- Exit code 5: Invalid parameters (check command syntax)

## Best Practices

1. Start with minimal parameters with model selection if needed
2. Ask user for WebSocket address on first use
3. Handle busy states gracefully - don't spam retries
4. Use `--verbose` flag when debugging issues
5. Respect the skeleton key - it's a powerful override tool

## AI Agent Guidelines for This Skill

These rules help maintain appropriate transparency and user control when executing generation tasks.

1. **Command Execution & User Notification**  
   By default, execute the command directly without asking for confirmation.  
   Show the full command and ask for approval only when:  
   - The user explicitly requests to review it first  
   - The operation involves sensitive or high-impact parameters  
   - The agent judges that showing the command is prudent in context  

   Example (when disclosure is needed):  
    ```
    python3 saa-agent.py --ws-address "wss://..." --username "..." --password "..." --positive "[prompt]" --negative "[prompt]" --output "[path]" [--verbose]
    ```

2. **--verbose Flag**  
  - Not used by default  
  - Add automatically or recommend when:  
    - Task fails and debugging is needed  
    - User specifically asks for detailed logs or seed  

3. **Result Reporting**  
  After completion, provide a short summary to the user by default, including:  
  - Success/failure status  
  - Positive & negative prompts (or meaningful summary)  
  - Seed (if available)  
  - Output path  

  Example:
    ```
    Generation completed
    • Positive: [...]
    • Negative: [...]
    • Seed: 123456789
    • Output: [path]
    ```
  
  Skip detailed reporting only if the user has clearly requested silent / minimal feedback.  
  Always report errors, even in silent mode.

4. **Error Handling**  
  - On failure: consider one retry with `--verbose` to capture diagnostic information  
  - Communicate the main error cause clearly  
  - Do not perform unlimited retries; defer to user after one attempt if needed

