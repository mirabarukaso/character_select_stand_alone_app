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

## Dataset
1. Download character dataset from [HF](https://huggingface.co/datasets/flagrantia/character_select_stand_alone_app/tree/main) or create your own list       
2. Replace `./data/character_list.txt` with your list        
3. Setart your ComfyUI, setup the correct `Server Address`       
4. Modify `./data/recreate_chatacters.txt` to re-create incorrect thumbs, you may need to adjust `Prompts` or `Seed`      

## Checkpoint / Diffusion 
Like SAA use `Checkpoint` for `SD15/SDXL` and `Diffusion` for `Anima/Flux2/Qwen/ZI...`        
