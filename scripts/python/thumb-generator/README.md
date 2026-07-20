# Character Select SAA Thumb Generator
Create your own thumb images.         

> [!IMPORTANT]
> 5000+ characters will take 5090 about 3~6 hours based on your setting.     

## Installation and Run
```
cd character_select\scripts\python\thumb-generator
pip install -r requirements
app.bat
```

Set up your ComfyUI on the left-hand sidebar and follow the steps in the instructions to generate your own list.     


## Dataset
Download character dataset CSV from [HF](https://huggingface.co/datasets/flagrantia/character_select_stand_alone_app/tree/main) or create your own list       

*ANIMA*
```
waiANIMA_v10Base10_characters.csv
```

*IL*
```
wai_characters_v160.csv.csv
```

## Custom thumbList in SAA
1. Create your own `*_characters.csv`, `*_tag_assist.json` and `*_thumbs.json` 
2. Replace `*` with your own name, e.g. `testThumbList`       
3. Modify your `settings.json` (or any settings file you want) add `testThumbList` into `thumb_select_list`        
4. Set `thumb_select` to `testThumbList` or select it after you restart SAA      

------

# Wanna raise an issue for new character found?
> [!IMPORTANT]
> Only `waiIllustriousSDXL_v160` and `waiANIMA_v10Base10` model characters accept for now.      

## Rules
1. Test and verify with models above before raise an issue
2. No LORA is allowed
3. Assist tags should not more than 4
4. Post `character name` in a `code` or `table` format list with small case

## Prompts and Configuration
Simply select `checkpoint` or `diffusion` for all default settings below.       

### Common
Seed: 42 or 1028 or 12345
Width: 768
Height: 1152

### SDXL/IL
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

### Anima
Model: `waiIllustriousSDXL_v160.safetensors`
Clip: `qwen_3_06b_base.safetensors`
VAE: `qwen_image_vae.safetensors`

> [!IMPORTANT]
> Anima is `Space Sensitive`, make sure all your tags are separated by `, ` comma and space!!           

Positive
```
masterpiece, best quality, score_7, white background, straight-on, upper body, solo
```

Negative
```
worst quality, low quality, blurry, jpeg artifacts, lowres, artist name, sketch, nsfw, explicit, score_1, score_2, score_3
```

Sampler: er_sde
Scheduler: normal
Steps: 32
CFG: 5.0
