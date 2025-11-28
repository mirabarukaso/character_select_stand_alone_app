2025.11.28 v1.16.9       
Bugfix ComfyUI incorrectly selected the EPS method when performing Hires-fix with Vpred model     


2025.11.22 v1.16.8       
Add `Show Metadata` display image metadata in a more readable format        


2025.11.19 v1.16.7       
Bugs fix         


2025.11.10 v1.16.6        
Add `extra_model_paths.yaml` from ComfyUI root now supports `upscale_models`[#58]           


2025.11.10 v1.16.5        
Add `Seed info` to queue slot       
Change CombyUI Backend Auto select 1st upscaler model in list when loading elder settings.json        


2025.11.09 v1.16.4       
Bug fix       
 Views and Characters weight not stored in settings file       
 

2025.11.08 v1.16.3       
Bug fix      
 A1111/Forge Neo - ADetailer/Controlnet always on          


2025.11.07 v1.16.2       
Bug fix
 A fake `same prompt` error appears in the ComfyUI backend when the `Delete` button is clicked too frequently in queue manager.     


2025.11.07 v1.16.1       
Add `ADetailer` for ComfyUI [#49]         
Add more clear `Pause marker` when `Enable Generate` unchecked      
Adjust tabs order       
Bugs fix      


2025.11.06 v1.16.0       
Add `ADetailer` for A1111(WebUI/Forge Neo) [#49]       
Add `Queue Manager` slot [#48]       
Change `Skip/Cancel` buttons' position to `Thumb Preview`           
Change `Hires Fix` now uses real model name for both backend       
 To update the previous version configuration file, first select your preferred upscaler model and then save the configuration file.             
Improved nested random [#50]            
Improved generate preview display       
Bugs fix      

A1111 Important Changes:         
 `ControlNet` now limit supports Forge based A1111         
 `Upscaler`, `Control Processor`, `ADetailer`  lists have to be read from the API.       
 The default ADetailer model list will be updated after the first generation. Simply start generating an image as normal.       

Controlnet notes for A1111/Forge:      
 For ComfyUI and A1111, `Post` directly feed the processed image to controlnet model without requiring Processor Model preprocessing. They accepts `none` as preProcessModel.       
 But Forge based controlnet DOES NOT support `none` as preProcessModel, it accepts `None`. 
 Unfortunately, it's impossible to determine whether it's A1111 or Forge from API perspective, so WebUI uses `On` by default in all cases. Choose the proper `none` or `None` for A1111 or Forge yourself.        

Upscaler notes for A1111/Forge Neo:        
A1111 uses a name-based upscaler model list. The `static upscaler list` should work, and will update to API list after the first generate.             

Forge uses a file-based upscaler model list. But it's messy! 
  **IMPORTANT: If the upscale_models folder is NOT exist, SAA will use static upscaler list as A1111**  
  **If you're confused about how to do it, don't panic—just run generate once, and HiFix model list will update properly.**          
  The solution:   
  1. Create a folder called `upscale_models` inside the `models` folder and put all your upscaler models in it.              
  2. Create a symbolic link named after the upscaler model folder, e.g. `ESRGAN`, which points to `upscale_models`.            
  3. Restart your Forge. The `Hires Fix` model should now work and will update to API list after the first generate.      


2025.11.02 v1.15.5       
Add random string selector with square bracket parsing [#47]       


2025.10.30 v1.15.4       
Improved reload Model/LoRA/ControlNet trigger [#45]          
 Model list will not reset to `Default` if selected model exist        
 All exist LoRA/ControlNet slots will update their list to latest       
 Missing model LoRA/ControlNet slots will automatically remove after reload         


2025.10.28 v1.15.3      
Add `iTxt` and `zTxt` support for metadata reader      
Fix When the same prompt is rejected by the ComfyUI backend, an ambiguous error message is displayed in SAA        


2025.10.23 v1.15.2     
Bugfix: [#43] An error in `Image Info` caused by an empty tagger model folder        


2025.10.23 v1.15.1     
More precise handling of tags containing colons        


2025.10.22 v1.15.0     
Code Refactoring      

Improve tag completion feature and Chinese translation      
  Add new Chinese translation file by **Kiratian(天痕)**      
  Add category group mark for tags        
  Imporve default tag search mode        

Bug fix
  Fix `Rating` tag missing for `WD Tagger`        
  Fix Sampler/Scheduler mismatch during switch settings         
  Fix SAA/SAAC WebUI generating stop polling preview image by clicking Generate in another SAA/SAAC window        
  Fix WebUI IPAdapter reference image resize mismatch        
  Fix AI prompt `<think>` `</think>` content not trimmed       
  Minor bug fixes


2025.10.15 v1.14.6      
Bug fix       


2025.10.08 v1.14.5      
Add WS health check for ComfyUI Backend             
Change ComfyUI IPAdapter reference image to square           
Bug fix       


2025.10.06 v1.14.4     
Bug fix      

v1.14.3      
Add Category support for `Image Tagger`     
  Add `Camie` tagger support    

v1.14.2     
Remove uselesss hardware acceleration code     


2025.10.05 v1.14.1     
Improve `Image Tagger` image process             
  Change Subprocess timeout 5s to 10s     
  Bug fix      


2025.10.05 v1.14.0      
Add `Image Tagger`      
  Native feature, not backend API call       
  Supports `CL` and `WD` tagger       


2025.09.26 v1.13.2       
Rename `Create Prompt` to `Create Single Image` [#41]       


2025.09.24 v1.13.1       
Add `Enumerate` for `JSON/CSV`         
  Iterate through all the elements of the list in a sequential order     
  Only work in `Batch (Random)` mode      
  Single model `Create Prompt` will `Enumerate` run as `Random`      


2025.09.24 v1.13.0       
Add test function for ComfyUI backend [#39]      
  Load `extra_model_paths.yaml` from ComfyUI root folder to add more Models/LoRAs/ControlNets from A1111       


2025.09.18 v1.12.6       
Add more Vpred auto detect for ComfyUI      


2025.09.11 v1.12.5       
Change Character List search input will not reset by click [#35]      


2025.09.03 v1.12.4       
Bugfix remove quotation marks `"` from csv data item          


2025.08.24 v1.12.3       
Bugfix copy metadata return `[object]`      
Bugfix SAA hangs when using ComfyUI convert single preview controlNet image with new pre-processor       


2025.08.18 v1.12.2      
Add `IP Adapter` models for ComfyUI       
 - IPA required https://github.com/sipherxyz/comfyui-art-venture         
Add `Resize by select` for `IP Adapter`      
Bugfix `A1111 ip-adapter` not working      


2025.08.18 v1.12.1      
Add `Paste (Ctrl+V)` Image/Json/Csv/Text for `Image Info Upload` window     


2025.08.17 v1.12.0      
Add custom `JSON/CSV` list       
Add `Copy Image` for ControlNet Preview      
Change ComfyUI Refiner `return_with_leftover_noise` to `enable` when `Add Noise Disable`         


2025.08.17 v1.11.2
Bugfix WebUI Mutex Lock      
Bugfix corrupted ControlNet preview image when WebUI  is Busy      


2025.08.17 v1.11.1     
Add ControlNet support for A1111(WebUI)      
Bugfix ControlNet List not update with Refresh     
Minor bug fixes     


2025.08.16 v1.11.0
Add ControlNet support for ComfyUI      
Bugfix error on load thumb image in SAA     


2025.08.06 v1.10.1      
Add Latent hires-fix for both backend      
  - Latent Upscale need at least 0.5 or higher denoise       
Bugfix Load config doesn't update upscale model list       


2025.07.30 v1.10.0     
Add metadata decode for Jpeg and Webp     
Minor bug fixes     


2025.07.25 v1.9.8          
Enable SandBox     
Remove dompurify     


2025.07.24 v1.9.7      
Add right-click menu `Hash Password` for local SAA to generate password for SAAC HTTPS      


2025.07.24 v1.9.6      
Add Login for HTTPS mode      
Add Login Audit Log    
Move `cert.pem` and `key.pem` to `html/ca`       

HTTP mode not required any audit       
HTTPS mode always required login     
Reconnect with HTTPS now required login    


2025.07.23 v1.9.5      
Add [HTTPS mode](https://github.com/mirabarukaso/character_select_stand_alone_app/blob/main/README_SAAC.md#https-mode) to solve HTTP mode clipboard issue    


2025.07.23 v1.9.4      
Bugfix and Alternative solution:     
Write to clipboard not working from remote addr with HTTP protocol       
[More information](https://webkit.org/blog/10855/async-clipboard-api/)        


2025.07.23 v1.9.3     
Minor bug fixes    

Improvements:    
Add Connection status indicator for SAAC    
Sync SAC version to SAAC    
SAAC will reconnect and re-register Callbacks after SAA restart    

Update dependencies:    
- electron 37.2.0 to 37.2.3       
- isomorphic-dompurify 2.24.0 to 2.26.0    
- ws 8.18.1 to 8.18.3    


2025.07.22 v1.9.1    
Bugfix:    
Mutex Lock for both backend    


2025.07.22 v1.9.0    
Add web client for SAA    


2025.07.18 v1.8.0    
Add WebUI(A1111) API authentication     


2025.07.03 v1.7.2
Update Electron to `37.2.0`      


2025.06.21 v1.7.1     
Bugfix:     
Dropdown zone exists when a non-image file is dropped for image information    


2025.06.19 v1.7.0     
Add wildcards(txt) support     

Bugfix:
Missing translate switch for Common and Positive prompt input      


2025.06.13 v1.6.2    
Change danbooru.csv to danbooru_e621_merged.csv      

2025.06.05 v1.6.1      
Update Electron to `36.4.0`     

Bugfix:      
Add delay for copy image if window is not focused(might.....)      
Right-click on right click menu      


2025.06.03 v1.6.0      
Add:      
More Settings in Regional Condition two      

Bugfix:      
Error in console when switching settings from LoRAs to empty      


2025.05.23 v1.5.3
Bugfix:
WebUI backend generate always report error with `imageData.startsWith.......`                
Search subfolder from only 1 depth to infinity depth [#18]               

2025.05.23 v1.5.1        
Improvements:     
More detailed error report information from A1111(WebUI) backend      
Right-click menu selections have an easier-to-read background color           
Batch size 128 to 2048    


2025.05.21 v1.5.0     
Add:     
Hires fix steps 1~100      
Spell Check en-US      


2025.05.13 v1.4.3
Bugfix:     
Interface didn't change to normal/regional by loading settings      
Prompt textbox mouse hover message error      

Change:
Regional Condition Character List now has new outline color      


2025.05.12 v1.4.1
Regional Condition Bugfix:     
Copy Tags missing     
Copy Metadata missing Right clip      
`undefined` in Info      
Character list always `None` when load settings      


2025.05.12 v1.4.0
Add:     
Regional Condition two      


2025.05.11 v1.3.0
Add:     
Error dialog for initialization phase     
`Privacy Ball` now supports custom image, try replace `data/imgs/privacy_ball.png` to your own image      
Weight adjust (0.1~2.0 step 0.1) for Character and View lists      


2025.05.09 v1.2.9
Modify code to fix security alerts    

Bugfix:
Thumb preview missing when generate with selected character           

2025.05.07 v1.2.7      
Bugfix:     
Index never choose 0 and 1      
WebUI Folder setup error in wizard     

2025.05.06 v1.2.5      
Bugfix:     
Index error after clear gallery      
[#10] Forge High-res fix doesn't work      
Comfyui High-res fix error if you don't have `waiNSFWIllustrious_v120.safetensors`       

Improvements:       
`Image Interface` Now supports whatever starts with `http` or not      


2025.05.05 v1.2.2      
Bugfix:     
Load Seting didn't work with few dropdowns      
Radiobox callback didn't return any value     


2025.05.04 v1.2.1     
Bugfix:     
Hires-Fix model select overwrite model list      


2025.05.04 v1.2.0     
Add:
Send LoRA data to slot from Common and Positive prompt      
LoRA slot now saved in setting.json      

Bugfix:     
The right click menu shows in the upper left corner after initialization     

Change:
When clicked `Send` in image information, `Landscape` will set to false, and `AI generate rule` set to None.    


2025.05.03 v1.1.1     
Add:     
CheckBox - Auto scroll to latest image in split mode.     

Bugfix:     
CheckBox callback didn't pass value back.     
CombyUI backend sometimes didn't parse WA preview data correctly in some cases, ignore those data.      


2025.05.03 v1.1.0     
Add:    
Progress information for ComfyUI and WebUI          
Right Click menu     
    Copy Image/Metadata     
    AI generate test   

Bugfix:          
A dead loop caused by sending the exactly same prompt to ComfyUI.     
Resize button missing on information overlay.     
Elements drag issue.       


2025.05.02 v1.0.0     
Initial Release, Code Completely Refactored from Python     