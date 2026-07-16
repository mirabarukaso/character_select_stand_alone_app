---
name: New character template
about: New character found!
title: "[NewCharacter]"
labels: ''
assignees: ''

---

Switch to preview, READ BEFORE your next step.

> [!IMPORTANT]
> Only `waiIllustriousSDXL_v160` and `waiANIMA_v10Base10` model characters accept for now.      
>
> Create your own thumbList with [SAA Thumb Generator](https://github.com/mirabarukaso/character_select_stand_alone_app/blob/main/scripts/python/thumb-generator/README.md)

# Rules
1. Test and verify with models above before raise an issue
2. No LORA is allowed
3. Assist tags should not more than 4
4. Post in a `code` or `table` format list with small case

# Prompts and Configuration
## Common
Seed: 42 or 1024 or 12345
Width: 768
Height: 1152

## SDXL/IL
Model: `waiIllustriousSDXL_v160.safetensors`

Positive
```
solo, simple background, white background, straight-on, upper body, masterpiece, best quality, amazing quality
```

Negative
```
bad quality,worst quality,worst detail,sketch,nsfw,explicit
```

Sampler: euler_ancestral
Scheduler: beta
Steps: 22
CFG: 7.0

## Anima
Model: `waiIllustriousSDXL_v160.safetensors`
Clip: `qwen_3_06b_base.safetensors`
VAE: `qwen_image_vae.safetensors`

Positive
```
masterpiece, best quality, score_7, solo, simple background, white background, straight-on, upper body
```

Negative
```
worst quality, low quality, blurry, jpeg artifacts, lowres, artist name, sketch, nsfw, explicit,, score_1, score_2, score_3
```

Sampler: er_sde
Scheduler: normal
Steps: 32
CFG: 5.0
