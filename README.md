# Character Select SAA
A Stand Alone App with AI prompt, Semi-auto Tag Complete and ComfyUI/Forge Neo(WebUI) API support.    

> [!NOTE]
> If you find a character that isn't show on the list but can be generated correctly, please don't hesitate to raise an issue to let me know.       
>
> The default thumbList is based on `waiIllustriousSDXL_v160`. There are two alternative thumbList: `waiANIMA_v10Base10` and `waiNSFWIllustrious_v120`. Will download automatically from `HuggingFace` once you have selected it. 
> Create your own thumbList with [SAA Thumb Generator](https://github.com/mirabarukaso/character_select_stand_alone_app/blob/main/scripts/python/thumb-generator/README.md)

> [!TIP]
> FP16 Compute and Sage Attention are for Turing GPUs (RTX 20 series) only. Newer cards can keep using bf16 or fp8. See [Turing FP16](#turing-fp16-rtx-20-series).

<img src="https://github.com/mirabarukaso/character_select_stand_alone_app/blob/main/examples/overall01.png" width=45%><img src="https://github.com/mirabarukaso/character_select_stand_alone_app/blob/main/examples/overall03.png" width=45%>

| Verified | [ComfyUI](https://github.com/comfyanonymous/ComfyUI)  | [Forge Neo](https://github.com/Haoming02/sd-webui-forge-classic/tree/neo) |
| --- | --- | --- | 
| Release | 0.42.3 | 2.31.0 |
| Refiner (SDXL) | Yes | Yes |
| Image Color Transfer (ALL) | Yes | No |
| Regional Condition / Couple (SDXL/Anima) | Yes | Yes |
| ControlNet/IPA (SDXL) | Yes | Yes |
| ADetailer (ALL) | Yes | Yes |
| API authentication| No | Yes |
| MiraITU | Yes | No |

> [!IMPORTANT]
> `Regional Condition / Couple` and `ADetailer` on `Forge Neo` supports `SDXL and Anima`
> on `ComfyUI` should support all SAA supports `diffusion models` need to verify          
>
> *ComfyUI Desktop not support SAA*       
> *Removed A1111 from support list due to a lack of maintenance, A1111 still working with SAA, but will not test on it*        
> 
> *Online Character Select* [Hugging Face Space](https://huggingface.co/spaces/flagrantia/character_select_saa)             
>
> For browser based SAAC, check [README_SAAC.md](https://github.com/mirabarukaso/character_select_stand_alone_app/blob/main/README_SAAC.md)           
> SAAC is **read-only by default**. It can generate, load host settings, switch layout mode, and save only to `saac_settings.json`. Dragged layout is not written, and a missing thumbList is not downloaded. The host `SAAC read-only` switch stays with the live host when switching settings. Turn it off in host `Settings` if a client should write this PC.       
 
> For Python based CLI tool for OpenClaw [SAA Agent](https://github.com/mirabarukaso/character_select_stand_alone_app/blob/main/scripts/python/saa-agent/README_HUMAN.md) and [ClawHub](https://clawhub.ai/mirabarukaso/saa-agent)         

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
> *One-Click package v2.10.0*    
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
## AI Prompt
Write or polish a prompt in the AI Prompt panel, then put the result into a prompt box yourself. Image generation does not call the language model.     

<img src="https://github.com/mirabarukaso/character_select_stand_alone_app/blob/main/examples/aiPrompt.png" width=45%>

<details>
<summary>More about AI Prompt</summary>

`Template` chooses how the reply is written. `Source` chooses which text is sent. Picking a template also sets that template's source and character slot. Change either one afterwards and it is stored on the template.     

Three templates are included:     

* `Tag scene` reads `Brief` and answers with one line of English comma-separated tags, about 8 to 16 tags. Gender words are left out.     
* `Natural scene` reads `Brief` and answers with one English paragraph for diffusion models. Width and height stay with the app, so the paragraph does not contain an aspect ratio.     
* `Character natural` reads character slot `4`. It polishes the text it actually received. The usual reply is one English paragraph. If that text explicitly asks for tags, the reply is one line of tags. A place, time, light, weather, background, prop, or extra person is added only when the source text already has it.     

Sources are `Brief`, `Common`, `Positive`, `Right positive`, `Negative`, `Character`, and `Full prompt`. `Character` uses one fixed slot from 1 to 4. A random slot is not sent. `Full prompt` skips a random character slot. LoRA lines are not sent. Wildcards stay as written.     

`Generate` runs the request. After a short pause the button becomes `Cancel` and can stop the request. The reply stays in `Result` until you choose where it goes. `Overwrite` replaces `Common`, `Positive`, `Right positive`, or `Negative`. `Append` adds the reply to the end of that box. Character files are left unchanged.     

Each template keeps its own system prompt, model, timeout, temperature, max tokens, source, and character slot. Model settings and the system prompt start folded. The save icon asks for a name. The same name updates the current template. A new name saves a copy and selects it. Delete asks first. Deleting the last template restores the three original templates. `Restore defaults`, under `Backend`, adds a missing original template and replaces an edited original with the stored one. Templates you added yourself stay.     

`Backend` is shared by every template.     

* `Remote` expects an OpenAI-compatible base URL and an API key. A base such as `https://nano-gpt.com/api/v1` is called at `/chat/completions`. A URL that already ends with `/chat/completions` is used as it is.     
* `Local` expects a llama.cpp server address, for example `http://127.0.0.1:8080/chat/completions`. Build [llama.cpp](https://github.com/ggml-org/llama.cpp) or take a [release](https://github.com/ggml-org/llama.cpp/releases), then start it with your GGUF model: `llama-server.exe -c 16384 --port 8080 -m "<your GGUF model>"`.     

Built-in templates ship in `data/ai_prompt_templates.json`. The app copies them into `settings/ai/templates.json` on first run, and later saves stay in that file. The selected template and source are stored with the current settings file. `Inherit settings` starts off. Turn it on before loading another settings file to keep the current interface, addresses, key, template, source, and brief. The switch turns itself off after that load. Save the settings file to store the kept configuration in the file you just opened.     

</details>

## Bounding Box for Moss Image
Draw rectangles on a canvas that follows the current `Width` and `Height`, then submit the merged positive prompt as one JSON payload. Turn on the header switch to enable it. `Regional Condition` keeps this switch off.     

<img src="https://github.com/mirabarukaso/character_select_stand_alone_app/blob/main/examples/bounding.png" width=45%>

<details>
<summary>More about Bounding Box</summary>
The canvas uses the current generation size, including landscape swap, and fits the panel. It stays at or below 1:1, so a smaller generation size is shown at its native pixel size.     

Drag on empty space to create a box. Drag inside a box to move it, and drag an edge to resize it. A selected box is solid; the others stay semi-transparent. Boxes are numbered from `01`, up to 64. Deleting one renumbers the rest from `01` in list order, and a new box is appended at the end.     

Click selects the smallest box under the pointer. The area outside that box still selects the larger one. After the canvas has focus, `Tab` walks outward through the nested boxes under the pointer, and `Shift+Tab` walks back. If the pointer is not over two or more boxes, `Tab` uses the boxes around the selected box, then the full list in number order. `Enter` or a double-click edits the description. Inside the editor, `Enter` saves, `Shift+Enter` adds a line, and `Esc` cancels. `Delete` removes the selection.     

Each box is `object` or `text`. `object` is the default. For Moss, `object` generates the description as an item inside the box, and `text` generates the description as annotation text inside the box.     
* An empty `object` sends its number as `caption` and has no `text` field.     
* An `object` with a description sends that item text as `caption` and has no `text` field. In the example below, `burger` and `price list` are generated as items.     
* A `text` box keeps the number as `caption` and sends the description in `text`, so Moss generates that description as annotation text.     

The background grid follows the grid-size slider. `Snap` is optional and uses that same size. Pick a color from 16 swatches or the color picker. Color is only drawn on the canvas and is left out of the payload. The preview under the canvas shows the positive prompt that will be sent.     

A long description wraps to the box width. Lines that do not fit stay hidden. The editor opened by `Enter` or a double-click grows with the text and stays inside the canvas.     

`Plate` loads the image currently shown in the gallery. Image Info can also send its loaded picture with `To Bounding`, under the tagger row. In the split view that is the large image. In grid view it is the opened image, or the newest image when none is opened. Click `Plate` again to clear it. A matching aspect ratio scales to the canvas. A different ratio scales by the short side and stays centered, and the canvas clips the overflow. `Opacity` runs from 0 to 100 and stays disabled until a plate is loaded. The opacity is saved with settings. The image itself lasts for the current session. While a plate is loaded, box fills follow that slider and thin out as the image gets stronger, so the picture, the region edge, and the description stay visible together.     

`Lock` keeps the selected box from being moved or resized. A locked box can still be selected, recolored, and edited, and `Delete` still removes it. `Clear` asks first. It removes unlocked boxes and leaves locked ones. When every remaining box is locked, `Clear` removes those too.     

Coordinates use the full generation pixels. The origin is the canvas center, `x` points right, `y` points down, and each box is `[y_min, x_min, y_max, x_max]`. On a 1024×1360 canvas the packed prompt looks like this:     

```json
{
  "summary": {
    "caption": "japanese anime style, solo anthro, aged down, fluffy,\nrestaurant, huge burger,two-tone fur, (grey fur:1.1), white cheek fur, white paws, grey wolf ears, grey wolf tail, blonde hair, grey eyes, wolf girl, hair between eyes, long sidelocks, short hair, (fluffy, chest fluff:1.4), cheek fluff, furry, petite, fangs, ear fluff, claws, sitting,"
  },
  "items": [
    { "label": "object", "caption": "furry", "bbox": [-680, -96, 680, 512] },
    { "label": "object", "caption": "burger", "bbox": [-238, -173, 101, 182] },
    { "label": "object", "caption": "price list", "bbox": [-619, -480, -234, -224] },
    { "label": "object", "caption": "table", "bbox": [124, -512, 363, 224] },
    { "label": "object", "caption": "soda drink", "bbox": [-69, -313, 168, -221] },
    { "label": "object", "caption": "Seasoning", "bbox": [98, -484, 166, -320] },
    { "label": "object", "caption": "Dinner Plate", "bbox": [204, -277, 273, 179] }
  ],
  "bbox_coord_space": "abs_centralized",
  "bbox_format": "yxyx"
}
```

`summary.caption` is the merged positive prompt after replacement and AI. The JSON is written onto the positive prompt that is actually submitted.     
</details>

## UI Layout
<img src="https://github.com/mirabarukaso/character_select_stand_alone_app/blob/main/examples/uiLayout.png" width=25%>

Drag panels between the left and right columns. The icon next to `Save Settings` chooses a shared layout, a layout stored with this settings file, or the original default.     

<details>
<summary>How to drag panels and how the layout icon works</summary>

Drag a panel by its collapse dot (the small circle on the header) to reorder it up/down, or drop it on the other column to swap left/right.     
Click the collapse dot to fold/unfold as before. To move a panel, hover the drag area for about 1 second until the border turns green, then drag. A quick pass or click will not start a layout move.     

The generate bars (width/CFG and seed/run buttons) and the prompt box have no collapse dot. Hover empty space (especially the padding at the top) for about 1 second until the border turns green, then drag.     
Don't drag sliders, dropdowns, buttons, or prompt text — those keep their normal behavior.     

The layout icon next to `Save Settings` cycles how the layout is stored:      

* Default color - Shared UI layout for all settings files     
* Green - Independent UI layout for the current settings file only     
* Orange - Restore the original default layout. Drag any panel afterwards to save it as an Independent layout (Green)     

</details>

## Diffusion Models (UNET/CLIP/VAE) for ComfyUI and Forge Neo 
> [!NOTE]      
> Test and Verified: Moss / Anima / Qwen Image / Z Image / Flux / Krea2
> Supports ComfyUI and Forge neo, NOT support original A1111.         

<img src="https://github.com/mirabarukaso/character_select_stand_alone_app/blob/main/examples/diffusion_models.png" width=25%>

<details>
<summary>Details about Diffusion Models</summary>       

*For ComfyUI*, check [Comfy-Org@HF](https://huggingface.co/comfy-Org/)      
`GGUF model` requires custom node [gguf](https://github.com/calcuis/gguf) the small-case one.        
```
|---models
|   |---checkpoints
|   |---diffusion_models
|   |---text_encoders
|   |---vae
```

*For Forge Neo*, check [Download Models@Haoming02](https://github.com/Haoming02/sd-webui-forge-classic/wiki/Download-Models)      
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

### For ComfyUI
Upgrade your [ComfyUI_Mira](https://github.com/mirabarukaso/ComfyUI_Mira) to `0.5.6.0 or above`         

`ControlNet` requires [comfyui_controlnet_aux](https://github.com/Fannovel16/comfyui_controlnet_aux) 1.1.5 [latest](https://github.com/Fannovel16/comfyui_controlnet_aux/commit/e8b689a513c3e6b63edc44066560ca5919c0576e)        
Put your `ControlNet` models in `ComfyUI\\models\\controlnet`      

`IP Adapter` requires [comfyui-art-venture](https://github.com/sipherxyz/comfyui-art-venture) 1.1.7 [latest](https://github.com/sipherxyz/comfyui-art-venture/commit/210dc072b1f103f91be18a33bdeb13ab315aaae5) and [ComfyUI_IPAdapter_plus](https://github.com/cubiq/ComfyUI_IPAdapter_plus) 2.0.0 [latest](https://github.com/cubiq/ComfyUI_IPAdapter_plus/commit/a0f451a5113cf9becb0847b92884cb10cbdec0ef)      
Put your `Clip Vision` models in `ComfyUI\\models\\clip_vision`      
Put your `IP Adapter` models in `ComfyUI\\models\\ipadapter`      
I didn't test too much on IPA, but for `SDXL/ilXL/NoobXL` recommends `CLIP-ViT-bigG-14-laion2B-39B-b160k.safetensors` with `ipa_styleIpadapterFor_NoobAI-XL_v10.safetensors`. You may also need `CLIP-ViT-H-14-laion2B-s32B-b79K.safetensors`           
Only the first `IP Adapter` slot will accept by ComfyUI, others set to `On` will ignore.     

### For Forge Neo
For ComfyUI, `Post` directly feed the processed image to controlnet model without requiring Processor Model preprocessing. They accepts `none(null)` as preProcessModel.       
But Forge based controlnet DOES NOT support `none(null)` as preProcessModel, it accepts `None(String)`. 
     
*Forge Neo:*      
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

All `Pre-processor` models are managed by  [comfyui_controlnet_aux](https://github.com/Fannovel16/comfyui_controlnet_aux)(ComfyUI),  most models will download from Hugging Face.      
All `Post-processor` models, aka the `Apply ControlNet Model` you need download by yourself from `ComfyUI Model Manager` or Hugging Face.      
</details>

## LoRA Slot 
Forge Neo(WebUI) supports it's default LoRA prompt style `<lora:xxxxx:1.0>`.    
ComfyUI supports more detailed configuration of LoRA, for more information please refer to [LoRA from Text](https://github.com/mirabarukaso/ComfyUI_Mira#lora).    
Also support check LoRA info by click the 'i' button in LoRA Slot. And, if there's a same named PNG file with LoRA, the image will show in LoRA info page.       

**To use LoRA in ComfyUI API, you need update your ComfyUI_Mira node to 0.5.6.0 or above**    

<img src="https://github.com/mirabarukaso/character_select_stand_alone_app/blob/main/examples/loraSlot.png" width=45%>   

## ADetailer
> [!TIP]
> If the settings are too confusing, just remember to adjust the gold parameter in the bottom-right corner (Denoise).

*For ComfyUI*      
> [!CAUTION]
> Check before you download any .pt file from unknown/untrusted site!
> https://github.com/ltdrdata/ComfyUI-Impact-Pack/issues/843

`ADetailer` requires [Impact Pack](https://github.com/ltdrdata/ComfyUI-Impact-Pack) 8.28.3 [latest](https://github.com/ltdrdata/ComfyUI-Impact-Pack/commit/429d0159ad429e64d2b3916e6e7be9c22d025c3c) and [Impact Subpack](https://github.com/ltdrdata/ComfyUI-Impact-Subpack) [latest](https://github.com/ltdrdata/ComfyUI-Impact-Subpack/commit/50c7b71a6a224734cc9b21963c6d1926816a97f1)       
Put your `ADetailer` models in `ComfyUI\\models\\ultralytics\\bbox`      
Put your `SAM` models in `ComfyUI\\models\\sams`      

*For Forge Neo*      
`ADetailer` requires [ADetailer Neo](https://github.com/Haoming02/ADetailer-Neo) [latest](https://github.com/Haoming02/ADetailer-Neo/commits/main/)
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

Wildcard tag requires DOUBLE(2) underline `__` on both head and tail        
```
__YourWildCardName__
```

In case you didn't like wildcards file or json/csv wildcard, try the following in your prompts:            
```
{ standing | sitting | on stomach | on back }
{ red | green | blue | blonde } { {long | short} hair | eyes}
```

<img src="https://github.com/mirabarukaso/character_select_stand_alone_app/blob/main/examples/wildcards.png" width=35%>   

## Regional Condition / Couple 
> [!TIP]
> Now supports Anima model          
> 

Try SAA Regional Condition with only 3 steps:     
1. Click the `Regional Condition` Checkbox     
2. Choose listed character or your OC      
3. Start `common prompt` with `duo, masterpiece, best quality, amazing quality`(Don't forget quality words like me), have fun!     

*For Forge Neo*      
`Regional Condition` requires [SD Forge Attention Couple](https://github.com/Haoming02/sd-forge-couple) [latest](https://github.com/Haoming02/sd-forge-couple/commits/main/)    


<img src="https://github.com/mirabarukaso/character_select_stand_alone_app/blob/main/examples/regionalCondition.png" width=35%>   

## Semi-Auto Tag Complete
Tags credits from [DraconicDragon/dbr-e621-lists-archive/danbooru_e621_merged_2026-04-01_pt20-ia-dd-ed-spc.csv](https://github.com/DraconicDragon/dbr-e621-lists-archive/blob/main/tag-lists/danbooru_e621_merged/README.MD)    

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
<details>
<summary>Drag and drop your image into SAA window, supports Png/Jpeg/Webp.</summary>             
Works WebUI(Forge Neo and A1111) and ComfyUI(with image save node from ComfyUI_Mira).      
Double click the image to close.     
The `Send` button will override `Common Prompt`, `Negative Prompt`, `Width & Height`, `CFG`, `Setp` and `Seed`.    
LoRA in `Common Prompt` also works if you have the same one. If you don't like LoRA in prompts, try `Send LoRA to Slot`.      

<img src="https://github.com/mirabarukaso/character_select_stand_alone_app/blob/main/examples/imageInfo.png" width=45%>   
</details>

## Character List
### Favorite Character List
*SAVE your settings after you add/remove favorite list*                  

*Add:* Select a character in `Character1` or `OC`, press `Alt` + `D` (default)        
*Remove:* Select a character in `Character3` or `OC`, press `Alt` + `Q` (default)       
*Search:* Use `@` in `ANY` character list to load your `Favorite Character List`      
*Hotkeys:* Change add/remove shortcuts in `Settings`      


*Merge/Overwrite/Replace*: So, when you switch settings files, you might find that the favourite lists aren't the same. An options dialogue box will pop up and ask you what you want to do next. It's a little annoying, but it will get better once you have merged all.         

<img src="https://github.com/mirabarukaso/character_select_stand_alone_app/blob/main/examples/favoriteList.png" width=25%>

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

**Copy Image/Metadata**     
Right click on `Gallery` to copy current image or copy the metadata to clipboard.     
ComfyUI with Image Saver node will output an a1111-like format metadata.      
Copy image based on convert base64 data back to png, but metadata trimed by chromium core, it's impossible to put them back with chromium API, a C based lib could solve that problem, but it's not worth to do. If you do need the original image, check from the relevant (ComfyUI/WebUI) output folder.      
For SAAC: Drag and drop image from browser to local folder or `save as` from browser right click.        
<img src="https://github.com/mirabarukaso/character_select_stand_alone_app/blob/main/examples/copyImage.png" width=35%>

**Send LoRA to Slot**     
Right click on `Common` and `Positive` to send text form LoRA to LoRA Slot.     
<img src="https://github.com/mirabarukaso/character_select_stand_alone_app/blob/main/examples/sendLoRAtoSlot.png" width=35%>
</details>

## Turing FP16 (RTX 20 series)
Turing cards (RTX 20 series) cannot run bf16. These two switches keep that generation on fp16. Newer cards can leave both off and use bf16 or fp8.

`FP16 Compute` casts the loaded UNet compute to fp16. Weight storage stays as it is.      
`Sage Attention` casts attention q/k/v to fp16 and casts them back. It does not turn compute fp16 on by itself. SageAttention 1.0.6 or 2.2 still has to be installed for that path.      

The two switches are independent. Turning either one on keeps UNet storage at `Automatic`.      

*ComfyUI* inserts the switch with [ComfyUI_MiraSubPack](https://github.com/mirabarukaso/ComfyUI_MiraSubPack).      
*Forge Neo* sends `forge_compute_fp16` and `forge_sage_fp16_cast` with [forge-turing-fp16](https://github.com/mirabarukaso/forge-turing-fp16). Before the next txt2img, SAA unloads the resident UNet, text encoder, and VAE when either switch turns off, or when the checkpoint or additional modules change. That frees the previous weights. A later float32 load can still offload part of a large UNet.      

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

*For Forge Neo(WebUI)*     
1. Enable `API mode` by add ` --api` in `COMMANDLINE_ARGS` (webui-user.bat)   
2. Start WebUI       
3. Select `Image API Interface` to `WebUI`   
4. Make sure `Image Interface IP Address:Port` same as your WerUI page   
5. Have fun    

## Custom path for some 3rd party mixed backend       
> [!WARNING]
> Enable custom path will override your model path settings.     
> Not recommend for official WebUI(Forge Neo/A1111) and ComfyUI.      
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
> *WebUI(Forge Neo) ONLY, DO NOT forward Comfyui API to public internet until they create a proper and secured way*    

Check more WebUI(Forge Neo) command args at [Command-Line-Arguments-and-Settings](https://github.com/AUTOMATIC1111/stable-diffusion-webui/wiki/Command-Line-Arguments-and-Settings)     

Copy your `webui-user.bat` to `webui-user-api.bat` then edit it with following args.     
Replace `user:pass` to your `Username:Password`     
`--api` `--api-auth` Enable API and API authentication.    
`--nowebui` means you don't need the WebUI browser interface.    
`--port 58189` API Call port to `58189`      
```
set COMMANDLINE_ARGS= --xformers --no-half-vae --api --api-auth user:pass --nowebui --port 58189
```
Start your Forge Neo with new `webui-user-api.bat`    
Copy and paste your `Username:Password` to SAA->Settings->`WebUI API Auth`, then set `Enable` to `ON`    

------
# Hires Fix and Image Color Transfer
Please refer to [Image Color Transfer](https://github.com/mirabarukaso/ComfyUI_Mira#image-color-transfer) for more details about Image Color Transfer.   
*Due to lack of generate rule and missing openCV, Color transfer no longer support in WebUI*

Makesure all upscaler models located in `upscale_models` folder.        

Notes for ComfyUI:        
Comfyui needs to download upscale models by yourself. Select `Manager`->`Model Manager` and filter with `upscale`, then download them.   

Upscaler notes for WebUI(Forge Neo/A1111):        
WebUI uses a name-based upscaler model list. The `static upscaler list` should work, and will update to API list after the first generate.             

Forge uses a file-based upscaler model list. But it's messy! 
  **IMPORTANT: If the upscale_models folder is NOT exist, SAA will use static upscaler list**  
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

