# Character Select SAA
A Stand Alone App with AI prompt, Semi-auto Tag Complete and ComfyUI/WebUI(A1111 & Forge Neo) API support.    

> [!IMPORTANT]
> If you find a character that isn't show on the list but can be generated correctly, please don't hesitate to raise an issue to let me know.       
>
> The default thumbList is based on `waiIllustriousSDXL_v160`. There are two alternative thumbList: `waiANIMA_v10Base10` and `waiNSFWIllustrious_v120`. Will download automatically from `HuggingFace` once you have selected it. 
> Create your own thumbList with [SAA Thumb Generator](https://github.com/mirabarukaso/character_select_stand_alone_app/blob/main/scripts/python/thumb-generator/README.md)

<img src="https://github.com/mirabarukaso/character_select_stand_alone_app/blob/main/examples/overall01.png" width=75%>   

| Verified | [ComfyUI](https://github.com/comfyanonymous/ComfyUI)  | [A1111](https://github.com/AUTOMATIC1111/stable-diffusion-webui) | [Forge Neo](https://github.com/Haoming02/sd-webui-forge-classic/tree/neo) |
| --- | --- | --- | --- |
| Release | 0.28.0 | 1.10.1 | 2.27 |
| LoRA | Yes | Yes | Yes |
| BREAK | No | Yes | Yes |
| Refiner | Yes | Yes | Yes |
| Image Color Transfer | Yes | No | No |
| Regional Condition | Yes | Yes | Yes |
| ControlNet/IPA | Yes | Yes | Yes |
| ADetailer | Yes | Yes | Yes |
| API authentication| No | Yes | Yes |
| MiraITU | Yes | No | No |
| UNET Model | Yes | No | Yes |
| Custom VAE for SDXL | Yes | Yes | Yes |
*NOT Support ComfyUI Desktop*

*Online Character Select* [Hugging Face Space](https://huggingface.co/spaces/flagrantia/character_select_saa)             

For browser based SAAC, check [README_SAAC.md](https://github.com/mirabarukaso/character_select_stand_alone_app/blob/main/README_SAAC.md)           
For Python based CLI tool for OpenClaw [SAA Agent](https://github.com/mirabarukaso/character_select_stand_alone_app/blob/main/scripts/python/saa-agent/README_HUMAN.md) and [ClawHub](https://clawhub.ai/mirabarukaso/saa-agent)         

## thumbList manually download guide
<details>
<summary>If you experienced a slow or failed download in SAA, check the manual solution here.</summary>        

Navigate to my [HF dataset](https://huggingface.co/datasets/flagrantia/character_select_stand_alone_app/tree/main), download the following files to the `data` folder and rename them as follows:    

### waiIllustriousSDXL_v160
[waiIllustriousSDXL_v160_thumbs.json](https://huggingface.co/datasets/flagrantia/character_select_stand_alone_app/resolve/main/wai_character_thumbs_v160.json?download=true)        

[waiIllustriousSDXL_v160_characters.csv](https://huggingface.co/datasets/flagrantia/character_select_stand_alone_app/raw/main/wai_characters_v160.csv)           

[waiIllustriousSDXL_v160_tag_assist.json](https://huggingface.co/datasets/flagrantia/character_select_stand_alone_app/raw/main/waiIllustriousSDXL_v160_tag_assist.json)           

### waiIllustriousSDXL_v120
[waiNSFWIllustrious_v120_thumbs.json](https://huggingface.co/datasets/flagrantia/character_select_stand_alone_app/resolve/main/wai_character_thumbs_v120.json?download=true)            

[waiNSFWIllustrious_v120_characters.csv](https://huggingface.co/datasets/flagrantia/character_select_stand_alone_app/raw/main/wai_characters_v120.csv)       

[waiNSFWIllustrious_v120_tag_assist.json](https://huggingface.co/datasets/flagrantia/character_select_stand_alone_app/raw/main/waiIllustriousSDXL_v160_tag_assist.json)        

### waiANIMA_v10Base10
[waiANIMA_v10Base10_thumbs.json](https://huggingface.co/datasets/flagrantia/character_select_stand_alone_app/resolve/main/waiANIMA_v10Base10_thumbs.json?download=true)           

[waiANIMA_v10Base10_characters.csv](https://huggingface.co/datasets/flagrantia/character_select_stand_alone_app/raw/main/waiANIMA_v10Base10_characters.csv)          

[waiANIMA_v10Base10_tag_assist.json](https://huggingface.co/datasets/flagrantia/character_select_stand_alone_app/raw/main/waiANIMA_v10Base10_tag_assist.json)         

</details>

## Install and run
> [!TIP]
> Setup your [Image API Interface](#image-api-interface) before you start SAA.     
> 
> For ComfyUI, you need latest [ComfyUI_Mira](https://github.com/mirabarukaso/ComfyUI_Mira) for SAA.     
>
> *One-Click package v2.8.0*    
> The full package [embeded_env_for_SAA](https://huggingface.co/datasets/flagrantia/character_select_stand_alone_app/resolve/main/embeded_env_for_SAA.zip)      

Clone this repo into your local folder     
```
git clone https://github.com/mirabarukaso/character_select_stand_alone_app.git
cd character_select_stand_alone_app
npm install
npm start
```

## Update
> [!IMPORTANT]
> **Updating version from github will not update the dataset files.**    
> Manually delete `danbooru_e621_merged.csv`, `*_thumbs.json`, `*_characters.csv`, `*_tag_assist.json` in `data` folder. Restart the app to automatically download the latest thumbnail database from HF.      

The `One-Click package` may not the latest version. If you need to update, please use the GitHub clone version with following command instead.     
```
git fetch
git pull
npm install
```
------
# Highlights
## Diffusion Models (UNET/CLIP/VAE) for ComfyUI and Forge Neo 
> [!NOTE]      
> Test and Verified: Anima / Qwen Image / Z Image / Flux / Krea2
> Supports ComfyUI and Forge neo, NOT support original A1111.         

<img src="https://github.com/mirabarukaso/character_select_stand_alone_app/blob/main/examples/diffusion_models.png" width=25%>

<details>
<summary>Details about Diffusion Models</summary>       

**For ComfyUI**, check [Comfy-Org@HF](https://huggingface.co/comfy-Org/)      
`GGUF model` requires custom node [gguf](https://github.com/calcuis/gguf) the small-case one.        
```
|---models
|   |---checkpoints
|   |---diffusion_models
|   |---text_encoders
|   |---vae
```

**For Forge Neo**, check [Download Models@Haoming02](https://github.com/Haoming02/sd-webui-forge-classic/wiki/Download-Models)      
Forge also supports the `GGUF model`, but the `Diffusion models` use the same `Checkpoint` folder. Therefore, manage those models with correct folder yourself.       
```
|---models
|   |---Stable-diffusion
|   |---text_encoder
|   |---VAE
```
</details>     

## Mira Image Tiled Upscaler
> [!NOTE]
> MiraITU: A content-aware image super-resolution ComfyUI custom node based on vision models.       
> Simply drag and drop ANY image into SAA/SAAC to upscale it.       

| Before | 6x After (SDXL) | Before | 3x After (Flux.2) |
| --- | --- | --- | --- | 
| <img src="https://github.com/mirabarukaso/character_select_stand_alone_app/blob/main/examples/2025-12-29-031208_1898628601.png" width=256>   |  <img src="https://github.com/mirabarukaso/character_select_stand_alone_app/blob/main/examples/2026-01-01-223655_3487267443.png" width=256> | <img src="https://github.com/mirabarukaso/character_select_stand_alone_app/blob/main/examples/MiraITU_FLUX2_sample.png" width=256>   |  <img src="https://github.com/mirabarukaso/character_select_stand_alone_app/blob/main/examples/MiraITU_FLUX2_sample_upscaled.png" width=256> |

<details>
<summary>Details about MiraITU</summary>       

Supports magnification scales from 1.5x to 8x. By adjusting different tile sizes, it can optimize VRAM usage to the maximum, enabling 8GB graphics cards to achieve image upscaling at 1.5x to 3x (or higher) scales, while also unleashing the full potential of high-end graphics cards with 24GB or more VRAM to accomplish 4x to 8x image upscaling.       

Requires [ComfyUI_Mira](https://github.com/mirabarukaso/ComfyUI_Mira) `0.5.6.0 or above`         
Requires [MiraSubPack](https://github.com/mirabarukaso/ComfyUI_MiraSubPack) `latest`          

And Image Tagger for [Mira](https://github.com/mirabarukaso/ComfyUI_Mira#tagger)         


| Settings | Drag and Drop | Flux.2 |
| --- | --- | --- | 
| <img src="https://github.com/mirabarukaso/character_select_stand_alone_app/blob/main/examples/miraITU01.png" width=256> | <img src="https://github.com/mirabarukaso/character_select_stand_alone_app/blob/main/examples/miraITU02.png" width=256>   | <img src="https://github.com/mirabarukaso/character_select_stand_alone_app/blob/main/examples/miraITU03.png" width=256>   |

The generated results will be affected by different models. The `SDXL` model requires a `tagger` to provide more precise content descriptions, and using an `upscale model` is recommended. Models such as `Flux2`, which allow a `reference latent` to connected, can skip the upscale model and stretch the original image directly. Then, simply use the `Positive Prompt` to configure all tiles consistently.        

| Upscale Ratio 1024x1360(1536) | Tile Size | VAE 8G | VAE 24G~ |
| --- | --- | --- | --- | 
| x1.5 | 768 | Full | Full |
| x2 | 1280 | Full/Tiled | Full |
| x3 | 1536 | Tiled | Full |
| x4 | 2048 | Tiled | Full |
| x6 | 2048/2560 | Tiled | Full |
| x8 | 2560/3072 | Tiled | Full/Tiled |

Note: Due to limitations of the SDXL model, exceeding 8x magnification will result in overly fragmented visual slices. For higher magnification requirements, it is recommended to use a dedicated ComfyUI workflow instead.         
[Comfyui Workflow MiraITU](https://github.com/mirabarukaso/ComfyUI_MiraSubPack/blob/main/examples/MiraITU_workflow.png)            
</details>

## Image Tagger
Supports [WD@SmilingWolf](https://huggingface.co/SmilingWolf), [CL@cella110n](https://huggingface.co/cella110n/cl_tagger) and [Camie@Camais03](https://huggingface.co/spaces/Camais03/camie-tagger-v2-app) models in ONNX format.             

<img src="https://github.com/mirabarukaso/character_select_stand_alone_app/blob/main/examples/imageTagger.png" width=35%>   

<details>
<summary>Details about Image Tagger</summary>       

Download models with tags from [HF](https://huggingface.co), manually rename them according to the following rules, then copy them into `models/tagger` folder:      
  - cl_tagger_v2.onnx + cl_tagger_v2_tag_mapping.json    
  - wd-eva02-large-tagger-v3.onnx + wd-eva02-large-tagger-v3_selected_tags.csv    
  - wd-v1-4-convnext-tagger.onnx + wd-v1-4-convnext-tagger_selected_tags.csv    

```
SAA
|---models
|   |---tagger
|       |---cl_tagger_1_02.onnx
|       |---cl_tagger_1_02_tag_mapping.json
|       |---wd-eva02-large-tagger-v3.onnx
|       |---wd-eva02-large-tagger-v3_selected_tags.csv
|       |---wd-vit-large-tagger-v3.onnx
|       |---wd-vit-large-tagger-v3_selected_tags.csv
|       |---camie-tagger-v2.onnx
|       |---camie-tagger-v2-metadata.json

Options:
Model Name  >>>  General Threshold(CL/WD/Camie)  >>>  Character Threshold(CL/WD)  >>> Categories(CL/Camie) or mCut(WD)      
```

The Image Tagger running on Node.JS with `onnxruntime-node`. *It DOES NOT require any backend support* But, GPU acceleration seems not working      
The `Generate Speed` is about 3 times slower than `Python` with `onnxruntime` in CPU mode, and 12 times slower than `onnxruntime-gpu`         

In other words with my i9-9960x with Titan RTX    
The good news is, you can run `Image tagger` during gegenerate       
| Device | Avg Tagging Time | Model | Platform | Resolution | Recommend Value |
| --- | --- | --- | --- | --- | --- | 
| onnxruntime | 1.053s | cl_tagger_1_02 | Python | 448 | 0.55/0.60 |
| onnxruntime-gpu | 0.297s | cl_tagger_1_02 | Python | 448 | 0.55/0.60 |
| onnxruntime-node | 3.185s | cl_tagger_1_02 | Electron(NodeJS@CPU) | 448 | 0.55/0.60 |
| onnxruntime-node | 2.917s | wd-eva02-large-tagger-v3 | Electron(NodeJS@CPU) | 448 | 0.35/0.85 |
| onnxruntime-node | 2.113s | camie-tagger-v2 | Electron(NodeJS@CPU) | 512 |  0.50/(NOT USE) |
</details>

## ControlNet / IP Adapter
<img src="https://github.com/mirabarukaso/character_select_stand_alone_app/blob/main/examples/controlnet.png" width=35%>   

<details>
<summary>Details about ControlNet / IP Adapter</summary>      

### Setup for ComfyUI
Upgrade your [ComfyUI_Mira](https://github.com/mirabarukaso/ComfyUI_Mira) to `0.5.6.0 or above`         

`ControlNet` requires [comfyui_controlnet_aux](https://github.com/Fannovel16/comfyui_controlnet_aux) 1.1.5 [latest](https://github.com/Fannovel16/comfyui_controlnet_aux/commit/e8b689a513c3e6b63edc44066560ca5919c0576e)        
Put your `ControlNet` models in `ComfyUI\\models\\controlnet`      

`IP Adapter` requires [comfyui-art-venture](https://github.com/sipherxyz/comfyui-art-venture) 1.1.7 [latest](https://github.com/sipherxyz/comfyui-art-venture/commit/210dc072b1f103f91be18a33bdeb13ab315aaae5) and [ComfyUI_IPAdapter_plus](https://github.com/cubiq/ComfyUI_IPAdapter_plus) 2.0.0 [latest](https://github.com/cubiq/ComfyUI_IPAdapter_plus/commit/a0f451a5113cf9becb0847b92884cb10cbdec0ef)      
Put your `Clip Vision` models in `ComfyUI\\models\\clip_vision`      
Put your `IP Adapter` models in `ComfyUI\\models\\ipadapter`      
I didn't test too much on IPA, but for `SDXL/ilXL/NoobXL` recommends `CLIP-ViT-bigG-14-laion2B-39B-b160k.safetensors` with `ipa_styleIpadapterFor_NoobAI-XL_v10.safetensors`. You may also need `CLIP-ViT-H-14-laion2B-s32B-b79K.safetensors`           
Only the first `IP Adapter` slot will accept by ComfyUI, others set to `On` will ignore.     

### Setup for A1111 and Forge Neo
For ComfyUI and A1111, `Post` directly feed the processed image to controlnet model without requiring Processor Model preprocessing. They accepts `none` as preProcessModel.       
But Forge based controlnet DOES NOT support `none` as preProcessModel, it accepts `None`. 
Unfortunately, it's impossible to determine whether it's A1111 or Forge from API perspective, so WebUI uses `On` by default in all cases. Choose the proper `none` or `None` for A1111 or Forge yourself.  
     
*A1111:*    
  Requires [sd-webui-controlnet](https://github.com/Mikubill/sd-webui-controlnet) [Latest Commit 56cec5b](https://github.com/Mikubill/sd-webui-controlnet/commit/56cec5b2958edf3b1807b7e7b2b1b5186dbd2f81)      
  Put your `ControlNet` and `IP Adapter` models in `stable-diffusion-webui\\extensions\\sd-webui-controlnet\\models`, the extension plugin path.       
  Use `none`

*Forge:*      
  Put your `ControlNet` and `IP Adapter` models in `models\\ControlNet`.        
  Use `None` and always `On`         

### Usage
1. Drag and drop (or click `Add` then `Paste`) your Image(or openPose image) to SAA/SAAC `Image Info`, select `Pre-processor`, `Resolution`, `Post-processor` and then click `Add ControlNet`. After it says `Added` the previre image will swap to your `Pre-processed` image, close `Image info` window, check `ControlNet` tab for more settings. **Hover your mouse over a dropdown/text item to view its feature.**                 
2. In `ControlNet` tab, you can change `Pre-processor` by select the a one and click `Refresh` to generate it and update preview. (Or set `Method` to `On` but SAA preview will not update).      
3. Because images are too big to save in settings file, so `ControlNet` settings will not save when SAA close, but also select another settings will not override current `ControlNet` settings.      
4. `ControlNet` works on normal and regional conditon.       
5. If you are new to `ControlNet`, try `Canny` or `OpenPose` first.      
6. ComfyUI *D-O-E-S N-O-T* like submitting the same data, you may receive an `Empty response error` when submit same data.       
7. ComfyUI [comfyui-art-venture](https://github.com/sipherxyz/comfyui-art-venture) requires a `square image`, you may get warnings with NOT square image input.      
8. In case of your IPA image is too big, the `Resolution` selection for `IP Adapter` will resize your input image to target size, `1024` is enough for most case.      
9. The `Info` button is not working when `Pre-Process Model` select to  `IP Adapter`      

All `Pre-processor` models are managed by  [comfyui_controlnet_aux](https://github.com/Fannovel16/comfyui_controlnet_aux)(ComfyUI) and [sd-webui-controlnet](https://github.com/Mikubill/sd-webui-controlnet)(A1111),  most models will download from Hugging Face.      
All `Post-processor` models, aka the `Apply ControlNet Model` you need download by yourself from `ComfyUI Model Manager` or Hugging Face.      
</details>

## LoRA Slot 
WebUI(A1111) supports it's default LoRA prompt style `<lora:xxxxx:1.0>`.    
ComfyUI supports more detailed configuration of LoRA, for more information please refer to [LoRA from Text](https://github.com/mirabarukaso/ComfyUI_Mira#lora).    
Also support check LoRA info by click the 'i' button in LoRA Slot. And, if there's a same named PNG file with LoRA, the image will show in LoRA info page.       

**To use LoRA in ComfyUI API, you need update your ComfyUI_Mira node to 0.5.6.0 or above**    

<img src="https://github.com/mirabarukaso/character_select_stand_alone_app/blob/main/examples/loraSlot.png" width=45%>   

## ADetailer
> [!CAUTION]
> Check before you download any .pt file from unknown/untrusted site!
> https://github.com/ltdrdata/ComfyUI-Impact-Pack/issues/843

> [!NOTE]
> If the settings are too confusing, just remember to adjust the gold parameter in the bottom-right corner (Denoise).

*For ComfyUI*      
`ADetailer` requires [Impact Pack](https://github.com/ltdrdata/ComfyUI-Impact-Pack) 8.28.3 [latest](https://github.com/ltdrdata/ComfyUI-Impact-Pack/commit/429d0159ad429e64d2b3916e6e7be9c22d025c3c) and [Impact Subpack](https://github.com/ltdrdata/ComfyUI-Impact-Subpack) [latest](https://github.com/ltdrdata/ComfyUI-Impact-Subpack/commit/50c7b71a6a224734cc9b21963c6d1926816a97f1)       
Put your `ADetailer` models in `ComfyUI\\models\\ultralytics\\bbox`      
Put your `SAM` models in `ComfyUI\\models\\sams`      

*For A1111/Forge Neo*      
`ADetailer` requires [ADetailer Plugin](https://github.com/Bing-su/adetailer/) [latest](https://github.com/Bing-su/adetailer/commit/3a599f5d4607d8f9d8b9fc5a15526197418dae1a)            
`Upscaler`, `Control Processor`, `ADetailer`  lists have to be read from the API.       
The default ADetailer model list will be updated after the first generation. Simply start generating an image as normal.        
Put your `ADetailer` models in `sd-webui-forge-neo\\models\\adetailer` or `stable-diffusion-webui\\models\\adetailer`       

<img src="https://github.com/mirabarukaso/character_select_stand_alone_app/blob/main/examples/aDetailer.png" width=35%>   

## Queue Manager
The queue management system enables you to submit multiple generation tasks, each with their own distinct parameters. Once submitted, the queue automatically begins processing them and removes completed tasks.       
If an error occurs, or if you manually unchecked `Enable Generation`, the queue will pause after the current task has finished and will remain preserved.       
You can `delete` or `view details` of tasks within the queue. Deleting the first task in the queue cancels the current generation process.       
*Recommended that the length of the queue should not exceed 10,000.*         

<img src="https://github.com/mirabarukaso/character_select_stand_alone_app/blob/main/examples/queueManager.png" width=35%>   

## JSON/CSV List
**JSON/CSV list will NOT save into your settings file**
Support `*.json` and `*.csv` files, just drag and drop (or click `Add` then `Paste`) those file info `Image Info` window. File format please refer to `wai_characters.csv` and `wai_tag_assist.json`, try drag them into SAA.     
`__Random__`, randomly selects an item from the list without a seed bound, works for `Single` and `Batch (Random)`  generate mode.          
`__Enumerate__`, enumerates every item one by one and only works in `Batch (Random)` mode, in `Single` it downgrade to `__Random__`             

<img src="https://github.com/mirabarukaso/character_select_stand_alone_app/blob/main/examples/json-csv.png" width=35%>   

## Wildcards    
Supports `*.txt` wildcard files, copy your wildcards into `resources\app\data\wildcards`      
By default, wildcards are randomly selected using the current seed. If `wildcard random seed` is `Checked`, a new random seed will be generated for every selection every time.      
**Subfolder is not supported**     

In case you didn't like wildcards file or json/csv wildcard, try the following in your prompts:            
```
{ standing | sitting | on stomach | on back }
{ red | green | blue | blonde } { {long | short} hair | eyes}
```

<img src="https://github.com/mirabarukaso/character_select_stand_alone_app/blob/main/examples/wildcards.png" width=35%>   

## Regional Condition 
Try SAA Regional Condition with only 3 steps:     
1. Click the `Regional Condition` Checkbox     
2. Choose listed character or your OC      
3. Start `common prompt` with `duo, masterpiece, best quality, amazing quality`(Don't forget quality words like me), have fun!     

*For ComfyUI*      
Get tired of [complex workflow](https://github.com/mirabarukaso/ComfyUI_Mira/issues/12#issuecomment-2727190727)?      

*For A1111/Forge Neo*      
`Regional Confition` requires [sd-webui-regional-prompter](https://github.com/hako-mikan/sd-webui-regional-prompter)          

> [!NOTE]
> `Image Left/Right Ratio` is the only working parameter for A1111         
> The generated results may differ significantly from those using ComfyUI      


<img src="https://github.com/mirabarukaso/character_select_stand_alone_app/blob/main/examples/regionalCondition.png" width=35%>   

## Semi-Auto Tag Complete
Tags credits from [a1111-sd-webui-tagcomplete](https://github.com/DominikDoom/a1111-sd-webui-tagcomplete/blob/main/tags/danbooru_e621_merged.csv)    

<img src="https://github.com/mirabarukaso/character_select_stand_alone_app/blob/main/examples/tagAutoComplete.png" width=45%>   

<details>
<summary>Details about Semi-Auto Tag Complete</summary>
Entering the `first few characters` will automatically search for matching tags, starting with `*` will search for tags with a specific ending, and `*tag*` will search for tags that match in the middle.    
Use `mouse` to select the prompt word, but you can also use the `keyboard up and down` with `Enter` or `Tab` to select, press `Esc` to close the prompt box.     
`ctrl + up` and `ctrl + down` arrow to adjust the weight of the current tag, or adjust multiple tags by selecting a fragment, the usage is similar to comfyui and webui, but some details of the logic may be different.      

Supports English and Chinese(translate file required) tag search.     
**Special thanks to Kiratian(天痕) for helping to translate the tags into Chinese version.**

*Artist Search for Anima and others*
Activate it using the `@` symbol. The result will be filtered by groups `1` and `8`.       
To apply the `Artist` tag in `Anima Model`, you need to add an `@` symbol at the start of the tag. E.g. `mira` -> `@mira`         

| Mark | ID | Category | Group |
| --- | --- | --- |  --- | 
| `[G]` | 0 | General | Danbooru |
| `[A]` | 1 | Artist | Danbooru |
| `[©]` | 3 | Copyright | Danbooru |
| `[C]` | 4 | Character | Danbooru |
| `[M]` | 5 | Meta | Danbooru |
| `<G>` | 7 | General | E621 |
| `<A>` | 8 | Artist | E621 |
| `<©>` | 10 | Copyright | E621 |
| `<C>` | 11 | Character | E621 |
| `<S>` | 12 | Species | E621 |
| `<M>` | 14 | Meta | E621 |
| `<L>` | 15 | Lore | E621 |
| `Wildcards` | 255 | Wildcards | SAA |
</details>

## Image info
Drag and drop your image into SAA window, supports Png/Jpeg/Webp.     
Works both for WebUI(A1111) and ComfyUI(with image save node from ComfyUI_Mira).      
Double click the image to close.     
The `Send` button will override `Common Prompt`, `Negative Prompt`, `Width & Height`, `CFG`, `Setp` and `Seed`.    
LoRA in `Common Prompt` also works if you have the same one. If you don't like LoRA in prompts, try `Send LoRA to Slot`.      

<img src="https://github.com/mirabarukaso/character_select_stand_alone_app/blob/main/examples/imageInfo.png" width=45%>   

## Character List
### Favorite Character List
*SAVE your settings after you add/remove facorite list, there are NO HINTS after you press F8/F9*                  

*Add:* Select a character in `Character1` or `OC`, press `Alt` + `D`        
*Remove:* Select a character in `Character3` or `OC`, press `Alt` + `Q`       
*Search:* Use `@` in `ANY` character list to load your `Favorite Character List`          

<img src="https://github.com/mirabarukaso/character_select_stand_alone_app/blob/main/examples/favoriteList.png" width=65%>

### Preview and Search
The Character List supports keywords search in both Chinese and English.      

<img src="https://github.com/mirabarukaso/character_select_stand_alone_app/blob/main/examples/characterPreview.png" width=45%>

## Top buttons and Right Click Menu      
Top buttons from Left to right: Save Settings, Reload Model List, Refresh page, Right to Left, Theme Switch.     

<details>
<summary>I just noticed that the electron app doesn't have a right-click menu, so I made one.</summary>               
      
**Spell Check (English)**    
Right-click on a word that has a spell check error (a wavy line drawn at the bottom) to see a hint for the corresponding word.     
<img src="https://github.com/mirabarukaso/character_select_stand_alone_app/blob/main/examples/spellCheck.png" width=45%>

**AI prompt generate test**     
Right click on `AI prompt` to get AI promot without generate.     
Once got result from Remote/Local AI, an information overlay will show in screen, switch AI rule to `Last` to keep  the result in later generate.    
<img src="https://github.com/mirabarukaso/character_select_stand_alone_app/blob/main/examples/aiPromptTest.png" width=45%>

**Copy Image/Metadata**     
Right click on `Gallery` to copy current image or copy the metadata to clipboard.     
ComfyUI with Image Saver node will output an a1111 like metadata.      
Copy image based on convert base64 data back to png, but metadata trimed by chromium core, it's impossible to put them back with chromium API, a C based lib could solve that problem, but it's not worth to do. If you do need the original image, check from the relevant (ComfyUI/WebUI) output folder.      
For SAAC: Drag and drop image from browser to local folder or `save as` from browser right click.        
<img src="https://github.com/mirabarukaso/character_select_stand_alone_app/blob/main/examples/copyImage.png" width=35%>

**Send LoRA to Slot**     
Right click on `Common` and `Positive` to send text form LoRA to LoRA Slot.     
<img src="https://github.com/mirabarukaso/character_select_stand_alone_app/blob/main/examples/sendLoRAtoSlot.png" width=35%>
</details>

------
# AI prompt
Remote   
1. Follow the setup guide to setup your `Remote AI url` , `Remote AI model` and `API Key`     
2. Put something in `AI Prompt` e.g. `make character furry, and I want a detailed portrait`        

Local    
1. Make sure you know how to build [Llama.cpp](https://github.com/ggml-org/llama.cpp) yourself, or download them from [trusted source](https://github.com/ggml-org/llama.cpp/releases)       
2. Download Model from [HuggingFace](https://huggingface.co/), recommend GGUF like `oh-dcft-v3.1-claude-3-5-sonnet-20241022.Q8_0` ([Here](https://huggingface.co/mradermacher/oh-dcft-v3.1-claude-3-5-sonnet-20241022-GGUF))   
3. Recommend Server args `llama-server.exe -c 16384 --port <your local LLM port> -m "<your GGUF model here>`    
4. Set `AI Prompt Generator` to `Local`    
5. Set `Local Llama.cpp server` to your Local AI address and port      
6. (Optional) You may need to check API settings for any other Local AI service        
7. Put something e.g. `make character furry, and I want a detailed portrait` in `AI Prompt`   

------
# Image API Interface
*For ComfyUI*      
> [!IMPORTANT]
> If you encounter issues with workflows failing to load correctly, try using `2025-05-03-022732_1775747588.json` instead.        

1. Enable `DEV mode` in ComfyUI Settings, and load `examples\2025-05-03-022732_1775747588.png` into your ComfyUI, make sure you have install [ComfyUI_Mira](https://github.com/mirabarukaso/ComfyUI_Mira) **v0.5.6.0 or above**.         
    1.1. You might need install `opencv-python` by ComfyUI->Manager->Install PIP packages-> opencv-python     
2. Select `Image API Interface` to `ComfyUI`   
3. Make sure `Image Interface IP Address:Port` same as your ComfyUI page   
4. Have fun    

In case you have preview issue in SAA, try add `--preview-method latent2rgb` into your startup BAT file        
My setup:      
```
py ComfyUI\main.py --fast --use-sage-attention --cuda-malloc --windows-standalone-build --listen 0.0.0.0 --port 58188 --preview-method latent2rgb
```

*For WebUI(A111/Forge neo)*     
1. Enable `API mode` by add ` --api` in `COMMANDLINE_ARGS` (webui-user.bat)   
2. Start WebUI       
3. Select `Image API Interface` to `WebUI`   
4. Make sure `Image Interface IP Address:Port` same as your WerUI page   
5. Have fun    

## Custom path for some 3rd party mixed backend       
> [!WARNING]
> Enable custom path will override your model path settings.     
> Not recommend for official WebUI(A1111/Forge) and ComfyUI.      
To enable a custom path, modify the file `data/custom_path.yaml`.       
1. Set `use_custom_path` to `true`      
2. Set `enable` to `false` to disable whole category        
3. Comment out to disable any single custom path you don't need to override      
4. Supports both single string and multi-line string for path lists     
5. Supports absolute and relative paths (relative to base_path)      

[#92 Setup custom patch when using ComfyUI with Stability Matrix](https://github.com/mirabarukaso/character_select_stand_alone_app/issues/92)              

## Folder path issue for Remote usage    
SAA needs to search your ComfyUI/WebUI checkpoints folder to retrieve models, LoRAs and other items. If you use a remote back-end address instead of 127.0.0.1, the folder search will fail and SAA will run in `Default` mode. In this mode, you cannot change the models or set the LoRAs by LoRA slot.    
There are two ways to solve this problem:    
1. `Mirror folder` - copy your remote `models` folder to local, then setup SAA with the local folder. This is simple, but you need more space to mirror the entire `models` folder to local folder.
2. `Symbolic link or Shared folder` - Create a `Symbolic link ` or simply setup your remote `models` folder as shared folder (read-only recommended), then setup SAA with that folder.     

## Advanced security settings (API authentication)    
> [!WARNING]
> *DO NOT forward any UNSECURED local port to public internet*    
> *WebUI(A1111) ONLY, DO NOT forward Comfyui API to public internet until they create a proper and secured way*    

Check more WebUI(A1111) command args at [Command-Line-Arguments-and-Settings](https://github.com/AUTOMATIC1111/stable-diffusion-webui/wiki/Command-Line-Arguments-and-Settings)     

Copy your `webui-user.bat` to `webui-user-api.bat` then edit it with following args.     
Replace `user:pass` to your `Username:Password`     
`--api` `--api-auth` Enable API and API authentication.    
`--nowebui` means you don't need the WebUI browser interface.    
`--port 58189` API Call port to `58189`      
```
set COMMANDLINE_ARGS= --xformers --no-half-vae --api --api-auth user:pass --nowebui --port 58189
```
Start your A1111 with new `webui-user-api.bat`    
Copy and paste your `Username:Password` to SAA->Settings->`WebUI API Auth`, then set `Enable` to `ON`    

------
# Hires Fix and Image Color Transfer
Please refer to [Image Color Transfer](https://github.com/mirabarukaso/ComfyUI_Mira#image-color-transfer) for more details about Image Color Transfer.   
*Due to lack of generate rule and missing openCV, Color transfer no longer support in WebUI*

Makesure all upscaler models located in `upscale_models` folder.        

Notes for ComfyUI:        
Comfyui needs to download upscale models by yourself. Select `Manager`->`Model Manager` and filter with `upscale`, then download them.   

Upscaler notes for A1111/Forge:        
A1111 uses a name-based upscaler model list. The `static upscaler list` should work, and will update to API list after the first generate.             

Forge uses a file-based upscaler model list. But it's messy! 
  **IMPORTANT: If the upscale_models folder is NOT exist, SAA will use static upscaler list as A1111**  
  **If you're confused about how to do it, don't panic—just run generate once, and HiFix model list will update properly.**          
  The solution:   
  1. Create a folder called `upscale_models` inside the `models` folder and put all your upscaler models in it.              
  2. Create a symbolic link named after the upscaler model folder, e.g. `ESRGAN`, which points to `upscale_models`.            
  3. Restart your Forge. The `Hires Fix` model should now work and will update to API list after the first generate.       

------
# Chinese Translate and Character Verification       
Many thanks to the following people for their selfless contributions, who gave up their valuable time to provide Chinese translation and character data verification. They are listed in no particular order.   
**Silence, 燦夜, 镜流の粉丝, 樱小路朝日, 满开之萤, and two more who wish to remain anonymous.**   

# Character List Special thanks    
lanner0403 [WAI-NSFW-illustrious-character-select](https://github.com/lanner0403/WAI-NSFW-illustrious-character-select)     
Cell1310  [Illustrious XL (v0.1) Recognized Characters List](https://civitai.com/articles/10242/illustrious-xl-v01-recognized-characters-list)     
mobedoor [#23](https://github.com/mirabarukaso/character_select_stand_alone_app/issues/23)       
UdinXProgrammer [#62](https://github.com/mirabarukaso/character_select_stand_alone_app/issues/62)       
Nurimtod [#75](https://github.com/mirabarukaso/character_select_stand_alone_app/issues/75) [#83](https://github.com/mirabarukaso/character_select_stand_alone_app/issues/83)      
atmogenic [#84](https://github.com/mirabarukaso/character_select_stand_alone_app/issues/84) [#85](https://github.com/mirabarukaso/character_select_stand_alone_app/issues/85)       
funnygeeker [#87](https://github.com/mirabarukaso/character_select_stand_alone_app/issues/87)    
          
------
# FAQ
Double clicked `saa.exe` but nothing happen?    
1. It might caused by files download issue or missing files.    
2. Try run it in console, by input `cmd` in your Explorer's address bar to open a console.      
3. Type `saa` then enter in console, check backend logs for more information.     

I messed up with setup wizard...      
1. Close the App    
2. Delete `settings.json` in `resources/app/settings`     
3. Try it again     

ERR_CONNECTION_REFUSED       
1. In most cases, it's the wrong address for the (ComfyUI/WebUI) back-end API.      

A Browser based SAA?    
1. YES    
2. Check `Advanced security settings (API authentication)` for more information.    

Error HTTP 400 ...... Cannot execute because node StepAndCfg does not exist ......       
1. Install `ComfyUI_Mira`     
2. Restart your ComfyUI

Upscale Model list is `None` (ComfyUI)      
1. Have you modified the default directory configuration?       
2. A non-official version?      
3. Check [#58](https://github.com/mirabarukaso/character_select_stand_alone_app/issues/58)


ComfyUI/WebUI is busy, cannot run new generation, please try again later.       
Refer to 5, 6 in [README_SAAC.md](https://github.com/mirabarukaso/character_select_stand_alone_app/blob/main/README_SAAC.md)     

