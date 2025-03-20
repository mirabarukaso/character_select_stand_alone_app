import datetime
import gzip
import hashlib
import os
import glob
import sys
import textwrap
import gradio as gr
import numpy as np
import requests
import json
import base64
from io import BytesIO
from PIL import Image
from PIL import PngImagePlugin
import random
import argparse
from comfyui import run_comfyui
from webui import run_webui
from color_transfer import ColorTransfer
from tag_autocomplete import PromptManager
from setup_wizard import setup_wizard_window

# Language
LANG_EN = {
    "character1": "Character list 1",
    "character2": "Character list 2",
    "character3": "Character list 3",
    "tag_assist": "Character tag assist",
    "original_character": "Original Character",
    "view_angle": "Angle",
    "view_camera": "Camera",
    "view_background": "Background",
    "view_style": "Style",
    "api_model_file_select": "Model list (ComfyUI Default:waiNSFWIllustrious_v120)",
    "random_seed": "Random Seed",
    "custom_prompt": "Custom Prompt (Head)",
    "api_prompt": "Positive Prompt (Tail)",
    "api_neg_prompt": "Negative Prompt",
    "batch_generate_rule": "AI rule for Batch generate",
    "api_image_data": "CFG,Step,W,H,Batch (1-16)",
    "api_image_landscape": "Landscape",
    "ai_prompt": "AI Prompt",
    "prompt_ban": "Prompt Ban List",
    "ai_interface": "AI Prompt Generator",
    "remote_ai_base_url": "Remote AI url",
    "remote_ai_model": "Remote AI model",
    "remote_ai_timeout": "Remote AI connection timeout",
    "ai_local_addr": "Local Llama.cpp server",
    "ai_local_temp": "Local AI Temperature",
    "ai_local_n_predict": "Local AI n_predict",
    "api_interface": "Local Image Generator API",
    "api_addr": "Local Image Generator IP Address:Port",
    "api_image": "Gallery",
    "output_prompt": "Prompt",
    "output_info": "Information",
    "ai_system_prompt_warning": "<h1><span style=\"color:orangered\">System prompt for AI prompt generator.<br>DO NOT MODIFY it if you don\'t understand it!!!</span></h1>",
    "ai_system_prompt_text": "AI System Prompt",
    
    "api_hf_enable": "Enable Hires Fix",
    "api_hf_scale": "Upscale by",
    "api_hf_denoise": "Denoising",
    "api_hf_upscaler_selected": "Upscaler",
    "api_hf_colortransfer": "Color Transfer",
    "api_hf_incorrect_upscaler": "Incorrect Upscaler selected, reset to default {}",
    "colortransfer_webui_warning": "Image Color Transfer is not a webUI embedded feature, so images are saved separately to the \".\\outputs\" directory of this App.",
    "api_webui_savepath_override": "WebUI Save to \".\\outputs\"",
    
    "run_button": "Create Prompt",
    "run_random_button": "Batch (Random)",
    "run_same_button": "Batch (Last Prompt)",
    "save_settings_button": "Save Settings",
    "load_settings_button": "Load Settings",
    "manual_update_database": "Update thumbs and tags",
    
    "gr_info_create_n": "Creating {}of{}, please wait ...",
    "gr_info_settings_saved": "Settings Saved to {}",
    "gr_info_settings_loaded": "Settings Loaded {}",
    "gr_info_manual_update_database": "Now downloading {}, please wait a while.",
    "gr_info_manual_update_database_done": " {} updated",
    
    "gr_warning_interface_both_none": "[Warning] Both AI Gen and Image Gen mode are \"none\" nothing will output",
    "gr_warning_click_create_first": "[Warning] Click \"Create Prompt\" first batch generate",
    "gr_warning_creating_ai_prompt":"[Warning] AI prompt request failed with Code [{}] {}",
    "gr_warning_cfgstepwh_mismatch":"[Warning] \"CFG,Step,W,H,Batch\" data mismatch, use default: 7.0, 30, 1024, 1360, 1",
    "gr_warning_manual_update_database": "Download files failed, please check console logs.\n{}",
    
    "gr_error_creating_image":"[Error] Got error from Image API: {}",
    
    "ai_system_prompt": textwrap.dedent("""\
    You are a Stable Diffusion prompt writer. Follow these guidelines to generate prompts:
    1.Prohibited keywords: Do not use any gender-related words such as "man," "woman," "boy," "girl," "person," or similar terms.
    2.Format: Provide 8 to 16 keywords separated by commas, keeping the prompt concise.
    3.Content focus: Concentrate solely on visual elements of the image; avoid abstract concepts, art commentary, or descriptions of intent.
    4.Keyword categories: Ensure the prompt includes keywords from the following categories:
        - Theme or style (e.g., cyberpunk, fantasy, wasteland)
        - Location or scene (e.g., back alley, forest, street)
        - Visual elements or atmosphere (e.g., neon lights, fog, ruined)
        - Camera angle or composition (e.g., front view, side view, close-up)
        - Action or expression (e.g., standing, jumping, smirk, calm)
        - Environmental details (e.g., graffiti, trees)
        - Time of day or lighting (e.g., sunny day, night, golden hour)
        - Additional effects (e.g., depth of field, blurry background)
    5.Creativity and coherence: Select keywords that are diverse and creative, forming a vivid and coherent scene.
    6.User input: Incorporate the exact keywords from the user's query into the prompt where appropriate.
    7.Emphasis handling: If the user emphasizes a particular aspect, you may increase the number of keywords in that category (up to 6), but ensure the total number of keywords remains between 8 and 16.
    8.Character description: You may describe actions and expressions but must not mention specific character traits (such as gender or age). Words that imply a character (e.g., "warrior") are allowed as long as they do not violate the prohibited keywords.
    9.Output: Provide the answer as a single line of comma-separated keywords.
    Prompt for the following theme:
    """),
    
    "setup_greet_title": "Initial Setup Wizard",
    "setup_greet_message": "Hi there! This wizard will run automatically the first time you start this program, or if you can't find the settings.json configuration file, please follow the instructions to initialize the settings.",
    "setup_model_folder_title": "Setup Model Folder",
    "setup_model_folder": "Please specify the directory where the model file safetensors is located. It is recommended to copy it from the Explore's address bar.",    
    "setup_model_filter_title": "Model File Filter",
    "setup_model_filter": "Do you want to enable the model name filter?",    
    "setup_model_filter_keyword_title": "Model Name Whitelist",
    "setup_model_filter_keyword": "Please set the keyword for the model name in the whitelist",    
    "setup_search_modelinsubfolder_title": "Subfolder",
    "setup_search_modelinsubfolder": "Do you want to search for model files in subfolders?",    
    "setup_remote_ai_api_key_title": "API Key",
    "setup_remote_ai_api_key": "Enter Remote Large Language Model API key (also changeable in settings.json)",    
    "setup_webui_comfyui_title": "Important!",
    "setup_webui_comfyui": "If you are using ComfyUI, enable dev mode in the settings. \nIf you are using WebUI, modify webui-user.bat and COMMANDLINE_ARGS= --api"
}

LANG_CN = {
    "character1": "角色1",
    "character2": "角色2",
    "character3": "角色3",
    "tag_assist": "角色标签辅助",
    "original_character": "自定义及原创角色",
    "view_angle": "视角",
    "view_camera": "镜头",
    "view_background": "背景",
    "view_style": "风格",
    "api_model_file_select": "模型选择 (ComfyUI默认:waiNSFWIllustrious_v120)",
    "random_seed": "种子",
    "custom_prompt": "自定义提示词（放在最前）",
    "api_prompt": "效果提示词（放在末尾）",
    "api_neg_prompt": "负面提示词",
    "batch_generate_rule": "AI填词规则",
    "api_image_data": "引导,步数,宽,高,批量1-16",
    "api_image_landscape": "宽高互换",
    "ai_prompt": "AI提示词（用于生成填词）",
    "prompt_ban": "提示词黑名单",
    "ai_interface": "AI填词设置",
    "remote_ai_base_url": "远程AI地址",
    "remote_ai_model": "远程AI模型",
    "remote_ai_timeout": "远程AI超时（秒）",
    "ai_local_addr": "本地 Llama.cpp 服务地址",
    "ai_local_temp": "本地AI温度（Temperature）",
    "ai_local_n_predict": "本地AI回复长度（n_predict）",
    "api_interface": "本地生图设置",
    "api_addr": "本地生图API地址（IP Address:Port）",
    "api_image": "输出",
    "output_prompt": "最终提示词",
    "output_info": "相关信息",
    "ai_system_prompt_warning": "<h1><span style=\"color:orangered\">AI系统提示词，建议使用英文<br>如果你不清楚这是干什么的，不要修改！！！</span></h1>",
    "ai_system_prompt_text": "AI系统提示词",
    
    "api_hf_enable": "高清修复",
    "api_hf_scale": "放大倍率",
    "api_hf_denoise": "降噪强度",
    "api_hf_upscaler_selected": "高清修复模型",
    "api_hf_colortransfer": "色彩传递",
    "api_hf_incorrect_upscaler": "选择了错误的高清模型，使用默认 {}",
    "colortransfer_webui_warning" : "注意：色彩传递并非WebUI内嵌功能，色彩传递后的图片保存至 \".\\outputs\" 目录下",
    "api_webui_savepath_override": "WebUI 存盘重定向 \".\\outputs\"",
    
    "run_button": "单图生成",
    "run_random_button": "批量（随机）",
    "run_same_button": "批量（上次生成）",
    "save_settings_button": "保存设置",
    "load_settings_button": "载入设置",
    "manual_update_database": "更新缩略图与标签库",
    
    "gr_info_create_n": "正在生成 {} / {}， 请稍候……",
    "gr_info_settings_saved": "配置已保存： {}",
    "gr_info_settings_loaded": "配置已载入： {}",
    "gr_info_manual_update_database": "正在下载 {} 请稍候",
    "gr_info_manual_update_database_done": " {} 更新完成",
    
    "gr_warning_interface_both_none": "注意：AI题词和图片生成接口都被设定为 \"none\"，此时执行没有图片输出",
    "gr_warning_click_create_first": "注意：批量生成前需要先点 \"Create Prompt\"",
    "gr_warning_creating_ai_prompt":"注意：AI题词请求失败，代码： [{}] {}",
    "gr_warning_cfgstepwh_mismatch":"注意：“引导,步数,宽,高,批量”设置存在错误，使用默认数据：7.0, 30, 1024, 1360, 1",
    "gr_warning_manual_update_database": "文件下载失败，请检查控制台日志确认问题\n{}",
    
    "gr_error_creating_image":"错误：生成图片返回故障信息：[{}]",    
    
    "ai_system_prompt": textwrap.dedent("""\
    你是一个Stable Diffusion提示词编写者，按照以下指南生成提示词：
    1.禁止关键词： 不得使用任何性别相关词，如“man”、“woman”、“boy”、“girl”、“person”或类似词。
    2.格式： 提供8到16个关键词，用逗号分隔，保持简洁。
    3.内容重点： 仅关注图像的可视元素，避免抽象概念、艺术评论或意图描述。
    4.关键词类别： 确保提示词涵盖以下类别：
        - 主题或风格 (e.g., cyberpunk, fantasy, wasteland)
        - 地点或场景 (e.g., back alley, forest, street)
        - 可视元素或氛围 (e.g., neon lights, fog, ruined)
        - 镜头视角或构图 (e.g., front view, side view, close-up)
        - 动作姿势或表情情绪 (e.g., standing, jumping, smirk, calm)        
        - 环境细节 (e.g., graffiti, trees)
        - 时间或光线 (e.g., sunny day, night, golden hour)
        - 额外效果 (e.g., depth of field, blurry background)        
    5.创意与连贯性： 关键词选择需多样且富有创意，形成一个生动连贯的场景。
    6.用户输入： 将用户查询中的关键词逐字纳入，适当融入提示词。
    7.强调处理： 若用户强调某方面，可增加该类别关键词（最多6个），但总数保持在8到16个。
    8.角色描述： 可描述动作和表情，但不得提及角色特征（如性别、年龄）。允许使用暗示角色的词（如warrior），只要不涉及禁止词。
    9.输出： 以单行逗号分隔的关键词形式且必须以英文回答。
    Prompt for the following theme:
    """),
    
    "setup_greet_title": "初次设定界面",
    "setup_greet_message": "你好！在本程序第一次启动或找不到settings.json文件时，会自动运行向导程序，请按照说明进行初始化设定。",
    "setup_model_folder_title": "模型路径",
    "setup_model_folder": "请设置您的模型文件safetensors所在目录，建议从文件夹地址栏复制",    
    "setup_model_filter_title": "模型白名单",
    "setup_model_filter": "请选择是否要开启模型白名单",
    "setup_model_filter_keyword_title": "白名单关键字",
    "setup_model_filter_keyword": "请设置过滤器白名单关键字",    
    "setup_search_modelinsubfolder_title": "子目录",
    "setup_search_modelinsubfolder": "是否搜索模型文件夹子目录下的模型文件",    
    "setup_remote_ai_api_key_title": "API密钥",
    "setup_remote_ai_api_key": "请输入你的远程语言模型API密钥（不需要可以直接跳过）",    
    "setup_webui_comfyui_title": "重要信息",
    "setup_webui_comfyui": "如果你使用ComfyUI，请在设置中开启Dev Mode\n如果你使用WebUI，请修改webui-user.bat，修改COMMANDLINE_ARGS= --api"
}

LANG = LANG_CN

TITLE = "WAI Character Select SAA"
CAT = "WAI_Character_Select"
ENGLISH_CHARACTER_NAME = False
PROMPT_MANAGER = None

current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
json_folder = os.path.join(parent_dir, 'json')
image_outputs_folder = os.path.join(parent_dir, 'outputs')

character_list = ''
character_dict = {}
tag_assist_dict = {}
original_character_list = ''
original_character_dict = {}
wai_image_dict = {}
view_tags = {}

no_local_settings = False
settings_json = {
    "remote_ai_base_url": "https://api.groq.com/openai/v1/chat/completions",
    "remote_ai_model": "llama-3.3-70b-versatile",
    "remote_ai_api_key":"<Your API Key here>",
    "remote_ai_timeout":30,
    
    "model_path": "F:\\ComfyUI\\ComfyUI_windows_portable\\ComfyUI\\models\\checkpoints",
    "model_filter": False,
    "model_filter_keyword": "waiNSFW",
    "search_modelinsubfolder": False,
    
    "character1": "random",
    "character2": "none",
    "character3": "none",
    "tag_assist": False,
    
    "view_angle": "none",
    "view_camera": "none",
    "view_background": "none",
    "view_style": "none",
    
    "api_model_file_select" : "default",    
    "random_seed": -1,
    
    "custom_prompt": "",
    "api_prompt": "masterpiece, best quality, amazing quality",
    "api_neg_prompt": "bad quality,worst quality,worst detail,sketch,censor,3d",
    "api_image_data": "7.0,30,1024,1360,1",
    "api_image_landscape": False,
    
    "batch_generate_rule": "Once",
    "ai_prompt": "",
    "prompt_ban" : "",
    
    "ai_interface": "none",
    "ai_local_addr": "http://127.0.0.1:8080/chat/completions",
    "ai_local_temp": 0.7,
    "ai_local_n_predict": 768,
    
    "api_interface": "none",
    "api_addr": "127.0.0.1:7860",
    "api_webui_savepath_override": False,
    
    "api_hf_enable": False,
    "api_hf_scale": 1.5,
    "api_hf_denoise": 0.4,
    "api_hf_upscaler_list": ["ESRGAN_4x(W)", "R-ESRGAN 2x+(W)", "R-ESRGAN 4x+(W)", "R-ESRGAN 4x+ Anime6B(W)", "4x_NMKD-Siax_200k(C)", "8x_NMKD-Superscale_150000_G(C)", "4x-AnimeSharp(C)", "4x-UltraSharp(C)", "ESRGAN_4x(C)","RealESRGAN_x2(C)","RealESRGAN_x4(C)"],
    "api_hf_upscaler_selected": "R-ESRGAN 4x+(W)",
    "api_hf_colortransfer": "none",
}

model_files_list = []

last_prompt = ''
last_info = ''
last_ai_text = ''

wai_illustrious_character_select_files = [       
    {'name': 'original_character', 'file_path': os.path.join(json_folder, 'original_character.json'), 'url': 'https://raw.githubusercontent.com/mirabarukaso/character_select_stand_alone_app/refs/heads/main/json/original_character.json'},
    {'name': 'settings', 'file_path': os.path.join(json_folder, 'settings.json'), 'url': 'local'},
    {'name': 'view_tags', 'file_path': os.path.join(json_folder, 'view_tags.json'), 'url': 'https://raw.githubusercontent.com/mirabarukaso/character_select_stand_alone_app/refs/heads/main/json/view_tags.json'},
    {'name': 'wai_characters', 'file_path': os.path.join(json_folder, 'wai_characters.csv'), 'url':'https://raw.githubusercontent.com/mirabarukaso/character_select_stand_alone_app/refs/heads/main/json/wai_characters.csv'},
    {'name': 'wai_tag_assist', 'file_path': os.path.join(json_folder, 'wai_tag_assist.json'), 'url':'https://raw.githubusercontent.com/mirabarukaso/character_select_stand_alone_app/refs/heads/main/json/wai_tag_assist.json'},
    {'name': 'wai_character_thumbs', 'file_path': os.path.join(json_folder, 'wai_character_thumbs.json'), 'url': 'https://huggingface.co/datasets/flagrantia/character_select_stand_alone_app/resolve/main/wai_character_thumbs.json'},
    {'name': 'danbooru_tag', 'file_path': os.path.join(json_folder, 'danbooru.csv'), 'url': 'https://raw.githubusercontent.com/DominikDoom/a1111-sd-webui-tagcomplete/refs/heads/main/tags/danbooru.csv'},
]

def first_setup():
    if not no_local_settings:
        return
    
    wiz = setup_wizard_window()
    wiz.run(LANG["setup_greet_title"], LANG["setup_greet_message"])
    
    model_folder = wiz.get_string(LANG["setup_model_folder_title"], LANG["setup_model_folder"], settings_json["model_path"])
    if model_folder:
        print(f"model_folder: {model_folder}")
        settings_json["model_path"] = model_folder
        get_safetensors()
    else:
        print("model_folder: skipped")
    
    settings_json["model_filter"] = wiz.ask_yes_no(LANG["setup_model_filter_title"], LANG["setup_model_filter"])
    
    if settings_json["model_filter"]:
        model_filter_keyword = wiz.get_string(LANG["setup_model_filter_keyword_title"], LANG["setup_model_filter_keyword"], settings_json["model_filter_keyword"]) 
        if model_filter_keyword:
            print(f"model_filter_keyword: {model_filter_keyword}")
            settings_json["model_filter_keyword"] = model_filter_keyword
        else:
            print("model_filter_keyword: skipped")

    settings_json["search_modelinsubfolder"] = wiz.ask_yes_no(LANG["setup_search_modelinsubfolder_title"], LANG["setup_search_modelinsubfolder"])            
    
    
    remote_ai_api_key = wiz.get_string(LANG["setup_remote_ai_api_key_title"], LANG["setup_remote_ai_api_key"], "<API KEY>")
    if remote_ai_api_key:
        print(f"remote_ai_api_key: {remote_ai_api_key}")
        settings_json["remote_ai_api_key"] = remote_ai_api_key
    else:
        print("remote_ai_api_key: skipped")

    wiz.run(LANG["setup_webui_comfyui_title"], LANG["setup_webui_comfyui"])

    save_json(settings_json, 'settings.json')
    
 
def get_url_by_name(name):
    for item in wai_illustrious_character_select_files:
        if item['name'] == name:
            return item['url'], item['file_path']
    return None, None

def decode_response(response):
    if response.status_code == 200:
        ret = response.json().get('choices', [{}])[0].get('message', {}).get('content', '')
        print(f'[{CAT}]:Response:{ret}')
        # Renmove <think> for DeepSeek
        if str(ret).__contains__('</think>'):
            ret = str(ret).split('</think>')[-1].strip()
            print(f'\n[{CAT}]:Trimed response:{ret}')    
            
        ai_text = ret.strip()
        ai_text = ai_text.replace('"','').replace('*','')
                
        if ai_text.endswith('.'):
            ai_text = ai_text[:-1] + ','      
        if not ai_text.endswith(','):
            ai_text = f'{ai_text},'            
        return ai_text    
    else:
        print(f"[{CAT}]:Error: Request failed with status code {response.status_code}")        
        gr.Warning(LANG["gr_warning_creating_ai_prompt"].format(response.status_code, ''))
        return ''

def llm_send_request(input_prompt, remote_ai_base_url, remote_ai_model, remote_ai_timeout):
    data = {
            'model': remote_ai_model,
            'messages': [
                {"role": "system", "content": LANG["ai_system_prompt"]},
                {"role": "user", "content": input_prompt + ";Response in English"}
            ],  
        }
    
    try:
        response = requests.post(remote_ai_base_url, headers={"Content-Type": "application/json", "Authorization": "Bearer " + settings_json["remote_ai_api_key"]}, json=data, timeout=remote_ai_timeout)
        return decode_response(response)
    except Exception as e:
        print(f"[{CAT}]:Error: Request failed with status code {response.status_code}\nException: {e}")
        gr.Warning(LANG["gr_warning_creating_ai_prompt"].format(response.status_code, e))
    
    return ''

def llm_send_local_request(input_prompt, server, temperature=0.5, n_predict=512):
    data = {
            "temperature": temperature,
            "n_predict": n_predict,
            "cache_prompt": True,
            "stop": ["<|im_end|>"],
            'messages': [
                {"role": "system", "content": LANG["ai_system_prompt"]},
                {"role": "user", "content": input_prompt + ";Response in English"}
            ],  
        }
    try:
        response = requests.post(server, headers={"Content-Type": "application/json"}, json=data)    
        return decode_response(response)
    except Exception as e:
        print(f"[{CAT}]:Error: Request failed with status code {response.status_code}\nException: {e}")
        gr.Warning(LANG["gr_warning_creating_ai_prompt"].format(response.status_code, e))
    
    return ''

def manual_update_database():
    global wai_image_dict
    global PROMPT_MANAGER
    
    try:               
        file_list = ["danbooru_tag", "wai_character_thumbs"]
        
        for name in file_list:
            url, file_path = get_url_by_name(name)
            if  None != url:
                gr.Info(LANG["gr_info_manual_update_database"].format(name), duration=15)
                if os.path.exists(file_path):
                    os.unlink(file_path)
                    
                download_file(url, file_path)                
                if 'wai_character_thumbs' == name:
                    with open(file_path, 'r', encoding='utf-8') as file:
                        wai_image_dict = json.load(file)
                elif 'danbooru_tag' == name:
                    PROMPT_MANAGER.reload_data()
                gr.Info(LANG["gr_info_manual_update_database_done"].format(name), duration=15)
            else:
                gr.Warning(LANG["gr_warning_manual_update_database"].format(name))        
    except Exception as e:
        gr.Warning(LANG["gr_warning_manual_update_database"].format(e))

def download_file(url, file_path):   
    response = requests.get(url)
    response.raise_for_status() 
    print(f'[{CAT}]:Downloading... {url}')
    with open(file_path, 'wb') as file:
        file.write(response.content)        

def get_md5_hash(input_str):
    md5_hash = hashlib.md5()
    md5_hash.update(input_str.encode('utf-8'))
    return md5_hash.hexdigest()

def base64_to_image(base64_data):
    compressed_data = base64.b64decode(base64_data)
    webp_data = gzip.decompress(compressed_data)
    image = Image.open(BytesIO(webp_data))  
    return image

def get_safetensors_files(directory, search_subfolder):
    if not os.path.isdir(directory):
        print(f'[{CAT}]:{directory} not exist, use default')
        return []
    
    if search_subfolder:
        safetensors_files = glob.glob(os.path.join(directory, '**', '*.safetensors'), recursive=True)
    else:
        safetensors_files = glob.glob(os.path.join(directory, '*.safetensors'))
        
    safetensors_filenames = [os.path.relpath(file, directory) for file in safetensors_files]
    
    return safetensors_filenames

def get_safetensors():
    global model_files_list
    model_files_list=[]
    files_list = get_safetensors_files(settings_json["model_path"], settings_json["search_modelinsubfolder"])
    
    if len(files_list) > 0 :
        for model in files_list:
            if settings_json["model_filter"]:
                if (model).__contains__(settings_json["model_filter_keyword"]):
                    model_files_list.append(model)
            else:
                model_files_list.append(model)            
    model_files_list.insert(0, 'default')    

def save_json(now_settings_json, file_name):
    tmp_file = os.path.join(json_folder, file_name)
    with open(tmp_file, 'w', encoding='utf-8') as f:
        json.dump(now_settings_json, f, ensure_ascii=False, indent=4)
            
    print(f"[{CAT}]:Json saved to {tmp_file}")
    return tmp_file

def load_settings(temp_settings_json):    
    for key, value in temp_settings_json.items():
        if settings_json.__contains__(key):
            #print(f'[{CAT}] Settings: Load [{key}] : [{value}]')
            settings_json[key] = value
        else:
            print(f'[{CAT}] Settings: Ignore Unknown [{key}] : [{value}]')    

def load_text_file(file_path):
    raw_text = ''
    if os.path.exists(file_path):
        with open(file_path, 'r', encoding='utf-8') as js_file:
            raw_text = js_file.read()
    else:
        print(f"[{CAT}] ERROR: {file_path} file missing!!!")

    return raw_text
            
def load_jsons():
    global character_list
    global character_dict
    global original_character_dict
    global original_character_list
    global wai_image_dict
    global settings_json    
    global view_tags
    global tag_assist_dict
    global PROMPT_MANAGER
    global no_local_settings
    
    # download file
    for item in wai_illustrious_character_select_files:
        name = item['name']
        file_path = item['file_path']
        url = item['url']        
            
        if 'local' == url:
           if 'settings' == name and not os.path.exists(file_path):
                print(f'[{CAT}] Settings: Local settings.json not found, use default.')
                no_local_settings = True                
                continue
        else:
            if not os.path.exists(file_path):
                download_file(url, file_path)
        
        if 'danbooru_tag' == name:
            PROMPT_MANAGER = PromptManager(file_path)
            print(f"[{CAT}]:PROMPT_MANAGER initialized.")
            continue    

        with open(file_path, 'r', encoding='utf-8') as file:
            if 'original_character' == name:
                original_character_dict.update(json.load(file))   
            elif 'settings' == name:
                temp_settings_json = {}
                temp_settings_json.update(json.load(file))
                load_settings(temp_settings_json)
            elif 'view_tags' == name:
                view_tags.update(json.load(file))
            elif 'wai_characters' == name:
                lines = file.readlines()
                for line in lines:
                    #print(f'Loading {line}')
                    key, value = line.split(',')
                    character_dict[key.strip()]=value.strip()
            elif 'wai_tag_assist' == name:
                tag_assist_dict.update(json.load(file))
            elif 'wai_character_thumbs' == name:
                wai_image_dict = json.load(file)            
                                        
    # Create list        
    view_tags['angle'].insert(0, "none")
    view_tags['angle'].insert(0, "random")
    view_tags['camera'].insert(0, "none")
    view_tags['camera'].insert(0, "random")
    view_tags['background'].insert(0, "none")
    view_tags['background'].insert(0, "random")
    view_tags['style'].insert(0, "none")
    view_tags['style'].insert(0, "random")
                
    if ENGLISH_CHARACTER_NAME:
        character_list = list(character_dict.values())   
    else:
        character_list = list(character_dict.keys())   
    
    character_list.insert(0, "none")
    character_list.insert(0, "random")
    
    original_character_list = list(original_character_dict.keys())    
    original_character_list.insert(0, "none")
    original_character_list.insert(0, "random")    
                            
    # Search models
    get_safetensors()
            
def remove_duplicates(input_string):
    items = input_string.split(',')    
    unique_items = list(dict.fromkeys(item.strip() for item in items))    
    result = ', '.join(unique_items)
    return result

def illustrious_character_select_ex(character = 'random', optimise_tags = True, random_action_seed = 1, tag_assist=False):
    chara = ''
    rnd_character = ''
    
    if 'none' == character:
        return '', '', None, ''
    
    if 'random' == character:
        index = random_action_seed % len(character_list)
        rnd_character = character_list[index]
        if 'random' == rnd_character:
            rnd_character = character_list[index+2]
        elif 'none' == rnd_character:
            rnd_character = character_list[index+1]
    else:
        rnd_character = character
    if ENGLISH_CHARACTER_NAME:
        chara = rnd_character
    else:
        chara = character_dict[rnd_character]
        
    tas=''
    if tag_assist and tag_assist_dict.__contains__(chara):        
        tas=tag_assist_dict[chara]
        print(f'{CAT}:Tag assist: [{chara}] add [{tas}]')
        
    md5_chara = get_md5_hash(chara.replace('(','\\(').replace(')','\\)'))
    thumb_image = None
    if wai_image_dict.keys().__contains__(md5_chara):
        thumb_image = base64_to_image(wai_image_dict.get(md5_chara))
    
    opt_chara = chara
    if optimise_tags:
        opt_chara = opt_chara.replace('(', '\\(').replace(')', '\\)')  
        #print(f'{CAT}:Optimise Tags:[{chara}]->[{opt_chara}]')
    
    if not opt_chara.endswith(','):
        opt_chara = f'{opt_chara},'   
            
    return rnd_character, opt_chara, thumb_image, tas

def original_character_select_ex(character = 'random', random_action_seed = 1):
    chara = ''
    rnd_character = ''
    
    if 'none' == character:
        return '', ''
    
    if 'random' == character:
        index = random_action_seed % len(original_character_list)
        rnd_character = original_character_list[index]
        if 'random' == rnd_character:
            rnd_character = original_character_list[index+2]
        elif 'none' == rnd_character:
            rnd_character = original_character_list[index+1]
    else:
        rnd_character = character
    chara = original_character_dict[rnd_character]                                    
    
    opt_chara = chara
    if not opt_chara.endswith(','):
        opt_chara = f'{opt_chara},'   
            
    return rnd_character, opt_chara

def parse_api_image_data(api_image_data,api_image_landscape):
    try:
        cfg, steps, width, height, loops = map(float, api_image_data.split(','))
        if 1 > int(loops) or 16 < int(loops):
            loops = 1
        if not api_image_landscape:
            return float(cfg), int(steps), int(width), int(height), int(loops)
        else:
            return float(cfg), int(steps), int(height), int(width), int(loops)
    except ValueError:
        gr.Warning(LANG["gr_warning_cfgstepwh_mismatch"])
        return 7.0, 30, 1024, 1360, 1

def create_prompt_info(rnd_character1, opt_chara1, tas1,
                        rnd_character2, opt_chara2, tas2,
                        rnd_character3, opt_chara3, tas3,
                        rnd_oc, opt_oc):
    info = ''    
    if '' != opt_chara1:
        info += f'Character 1:{rnd_character1}[{opt_chara1}]\n'
        if ''!= tas1:
            tas1=f'{tas1},'
            info += f'Character 1 tag assist:[{tas1}]\n'
        
    if '' != opt_chara2:
        info += f'Character 2:{rnd_character2}[{opt_chara2}]\n'
        if ''!= tas2:
            tas2=f'{tas2},'
            info += f'Character 2 tag assist:[{tas2}]\n'
    
    if '' != opt_chara3:
        info += f'Character 3:{rnd_character3}[{opt_chara3}]\n'
        if ''!= tas3:
            tas2=f'{tas3},'
            info += f'Character 3 tag assist:[{tas3}]\n'

    if '' != rnd_oc:
        info += f'Original Character:{rnd_oc}[{opt_oc}]\n'

    prompt = f'{tas1}{opt_chara1}{tas2}{opt_chara2}{tas3}{opt_chara3}{opt_oc}'

    return prompt, info

def create_image(interface, addr, model_file_select, prompt, neg_prompt, 
                 seed, cfg, steps, width, height, 
                 api_hf_enable, ai_hf_scale, ai_hf_denoise, api_hf_upscaler_selected, api_hf_colortransfer, api_webui_savepath_override):
    def convert_to_condensed_format(data, api_webui_savepath_override):
        # Ensure data is a dictionary by parsing it if it's a string
        if isinstance(data, str):
            data = json.loads(data)
        elif not isinstance(data, dict):
            print(f"[{CAT}]Color Transfer:Input must be a string (JSON) or dictionary")
            return ""
        
        # Extract main prompt components
        main_prompt = data["prompt"]
        negative_prompt = data["negative_prompt"]
        
        # Extract key generation parameters with fallbacks
        steps = data["steps"]
        sampler = data.get("sampler_name", "Euler a")
        cfg_scale = data["cfg_scale"]
        seed = data["seed"]
        width = data["width"]
        height = data["height"]
        
        # Model and VAE parameters
        model_hash = data.get("sd_model_hash", "unknown")
        model = data.get("sd_model_name", "unknown")
        vae_hash = data.get("sd_vae_hash", "unknown")
        vae = data.get("sd_vae_name", "unknown")
        denoising = data["denoising_strength"]
        clip_skip = data.get("clip_skip", 2)
        
        # High-resolution parameters from extra_generation_params
        extra_params = data.get("extra_generation_params", {})
        hires_upscale = extra_params.get("Hires upscale", 1.2)  # Using value from your input
        hires_steps = extra_params.get("Hires steps", 20)
        hires_upscaler = extra_params.get("Hires upscaler", "R-ESRGAN 4x+")
        downcast = extra_params.get("Downcast alphas_cumprod", True)
        version = data.get("version", "unknown")

        # Construct the condensed format
        condensed = f"{main_prompt}\n"
        condensed += f"Negative prompt: {negative_prompt}\n"
        condensed += f"Steps: {steps}, Sampler: {sampler}, Schedule type: Automatic, CFG scale: {cfg_scale}, Seed: {seed}, "
        condensed += f"Size: {width}x{height}, Model hash: {model_hash}, Model: {model}, "        
        if api_webui_savepath_override:
            condensed += f"VAE hash: {vae_hash}, VAE: {vae}, Denoising strength: {denoising}, Clip skip: {clip_skip}, "
            condensed += f"Hires upscale: {hires_upscale}, Hires steps: {hires_steps}, Hires upscaler: {hires_upscaler}, "
        else:
            condensed += f"VAE hash: {vae_hash}, VAE: {vae}, Clip skip: {clip_skip}, "
        condensed += f"Downcast alphas_cumprod: {downcast}, Version: {version}"

        return condensed

    if 'none' != interface:
        api_image = None
        src_info = ''
        current_time = None
        try:            
            if 'ComfyUI' == interface:
                if api_hf_enable: 
                    if not str(api_hf_upscaler_selected).__contains__('(C)'):
                        print(f"[{CAT}]Reset {api_hf_upscaler_selected} to 4x-UltraSharp")
                        api_hf_upscaler_selected = '4x-UltraSharp'
                        gr.Warning(LANG["api_hf_incorrect_upscaler"].format(api_hf_upscaler_selected))
                    else:
                        api_hf_upscaler_selected = str(api_hf_upscaler_selected).replace('(C)', '')
                    
                image_data_list = run_comfyui(server_address=addr, model_name=model_file_select, 
                                              positive_prompt=prompt, negative_prompt=neg_prompt, random_seed=seed, cfg=cfg, steps=steps, width=width, height=height,
                                              hf_enable=api_hf_enable, hf_scale=ai_hf_scale, hf_denoising_strength=ai_hf_denoise, hf_upscaler=api_hf_upscaler_selected, hf_colortransfer=api_hf_colortransfer,
                                              )
                image_data_bytes = bytes(image_data_list)  
                api_image = Image.open(BytesIO(image_data_bytes))
            elif 'WebUI' == interface:                
                metadata = PngImagePlugin.PngInfo()
                
                if api_hf_enable: 
                    if not str(api_hf_upscaler_selected).__contains__('(W)'):
                        print(f"[{CAT}]Reset {api_hf_upscaler_selected} to R-ESRGAN 4x+")
                        api_hf_upscaler_selected = 'R-ESRGAN 4x+'
                        gr.Warning(LANG["api_hf_incorrect_upscaler"].format(api_hf_upscaler_selected))
                    else:
                        api_hf_upscaler_selected = str(api_hf_upscaler_selected).replace('(W)', '')
                        
                    src_image, _, src_info = run_webui(server_address=addr, model_name=model_file_select, 
                                    positive_prompt=prompt, negative_prompt=neg_prompt, random_seed=seed, cfg=cfg, steps=steps, width=width, height=height,
                                    hf_enable=api_hf_enable, hf_scale=ai_hf_scale, hf_denoising_strength=ai_hf_denoise, hf_upscaler=api_hf_upscaler_selected, savepath_override=api_webui_savepath_override)
                    
                    
                    if 'none' != api_hf_colortransfer:
                        gr.Warning(LANG["colortransfer_webui_warning"])
                        ref_image, _, ref_info = run_webui(server_address=addr, model_name=model_file_select, 
                                            positive_prompt=prompt, negative_prompt=neg_prompt, random_seed=seed, cfg=cfg, steps=steps, width=width, height=height,
                                            hf_enable=False, hf_scale=ai_hf_scale, hf_denoising_strength=ai_hf_denoise, hf_upscaler=api_hf_upscaler_selected, savepath_override=api_webui_savepath_override)  
                        
                        PT = ColorTransfer()        
                        if "Mean" == api_hf_colortransfer:
                            s = np.array(src_image).astype(np.float32)     
                            r = np.array(ref_image).astype(np.float32)       
                            api_image = Image.fromarray(PT.mean_std_transfer(img_arr_in=s, img_arr_ref=r))
                        elif "Lab" == api_hf_colortransfer:
                            s = np.array(src_image).astype(np.uint8)     
                            r = np.array(ref_image).astype(np.uint8)       
                            api_image = Image.fromarray(PT.lab_transfer(img_arr_in=s, img_arr_ref=r))
                            
                        current_time = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")                                                
                        image_filename = f"{current_time}_{seed}_reference.png"
                        image_filepath = os.path.join(image_outputs_folder, image_filename)
                        ref_para = convert_to_condensed_format(''.join(ref_info), False)
                        metadata.add_text("parameters", ref_para)                        
                        ref_image.save(image_filepath, pnginfo=metadata)
                        print(f"[{CAT}]Color Transfer: Reference Image saved to {image_filepath}")                        
                    else:
                        api_image = src_image                    
                else:
                    api_image, _, src_info = run_webui(server_address=addr, model_name=model_file_select, 
                                        positive_prompt=prompt, negative_prompt=neg_prompt, random_seed=seed, cfg=cfg, steps=steps, width=width, height=height,
                                        hf_enable=api_hf_enable, hf_scale=ai_hf_scale, hf_denoising_strength=ai_hf_denoise, hf_upscaler=api_hf_upscaler_selected, savepath_override=api_webui_savepath_override)                                    
                
                if api_webui_savepath_override:
                    if not current_time:
                        current_time = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
                    image_filename = f"{current_time}_{seed}.png"
                    image_filepath = os.path.join(image_outputs_folder, image_filename)                        
                    str_para = convert_to_condensed_format(''.join(src_info), api_hf_enable)
                    metadata.add_text("parameters", str_para)       
                    api_image.save(image_filepath, pnginfo=metadata)                        
                    print(f"[{CAT}]WebUI: Image saved to {image_filepath}")
                                                
            return api_image
        except Exception as e:
            print(f"[{CAT}]Error creating image: {e}")
            raise gr.Error(LANG["gr_error_creating_image"].format(e))            
    
    return None

def create_view_tag(view_list, in_tag, seed):
    if 'none' == in_tag:
        out_tag = ''
    elif 'random' == in_tag:
        index = seed % len(view_tags[view_list])
        if 'none' == view_tags[view_list][index]:
            index = index + 1
        elif 'random' == view_tags[view_list][index]:
            index = index + 2
        out_tag = f'{view_tags[view_list][index]}, '
    else:
        out_tag = f'{in_tag}, '
    
    out_tag = out_tag.replace('(','\\(').replace(')','\\)')    
    return out_tag

def create_view_tags(view_angle, view_camera, view_background, view_style, seed):
    tag_angle = create_view_tag('angle', view_angle, seed)
    tag_camera = create_view_tag('camera', view_camera, seed)
    tag_background = create_view_tag('background', view_background, seed)
    tag_style = create_view_tag('style', view_style, seed)
        
    return tag_angle, tag_camera, tag_background, tag_style

rnd_character_list = []
opt_chara_list = []
rnd_oc_list = []
opt_oc_list = []
tag_assist_list = []
seed_list = []

def create_characters(batch_random, character1, character2, character3, tag_assist, original_character, random_seed, api_image_data, api_image_landscape):
    global rnd_character_list
    global opt_chara_list
    global rnd_oc_list
    global opt_oc_list
    global tag_assist_list
    global seed_list
    
    rnd_character_list = []
    opt_chara_list = []
    rnd_oc_list = []
    opt_oc_list = []
    tag_assist_list = []
    seed_list = []
    
    generated_thumb_image_list = []
    
    _, _, _, _, loops = parse_api_image_data(api_image_data, api_image_landscape)
    
    if not batch_random:
        loops = 1
    
    rnd_character = [''] * 3
    opt_chara = [''] * 3
    thumb_image = [None] * 3
    tas = [''] * 3
    rnd_seed = [0] * 3
    characters = [character1, character2, character3]
    for _ in range(0, loops):
        if random_seed == -1:
            rnd_seed[0] = random.randint(0, 4294967295)
        else :
            rnd_seed[0] = random_seed
        rnd_seed[1] = int(rnd_seed[0] / 3)
        rnd_seed[2] = int(rnd_seed[0] / 7)
        seed_list.append(rnd_seed[0])
        oc_seed = 4294967295 - rnd_seed[0]
        
        rnd_oc, opt_oc = original_character_select_ex(character = original_character, random_action_seed=oc_seed)
        for index in range(0,3):
            rnd_character[index], opt_chara[index], thumb_image[index], tas[index] = illustrious_character_select_ex(character = characters[index], random_action_seed=rnd_seed[index], tag_assist=tag_assist)        
        
        for index in range(0,3):
            rnd_character_list.append(rnd_character[index])
            opt_chara_list.append(opt_chara[index])
            rnd_oc_list.append(rnd_oc)
            opt_oc_list.append(opt_oc)
            tag_assist_list.append(tas[index])
            if thumb_image[index]:
                generated_thumb_image_list.append(thumb_image[index])
    
    return generated_thumb_image_list
        

def create_prompt_ex(batch_random, view_angle, view_camera, view_background, view_style, custom_prompt, 
                                 ai_interface, ai_prompt, batch_generate_rule, prompt_ban, remote_ai_base_url, remote_ai_model, remote_ai_timeout,
                                 ai_local_addr, ai_local_temp, ai_local_n_predict, ai_system_prompt_text,
                                 api_interface, api_addr, api_prompt, api_neg_prompt, api_image_data, api_image_landscape, api_model_file_select,
                                 api_hf_enable, api_hf_scale, api_hf_denoise, api_hf_upscaler_selected, api_hf_colortransfer, api_webui_savepath_override
            ) -> tuple[str, str, Image.Image, Image.Image]:            
    global last_prompt
    global last_info
    global last_ai_text
    global LANG
        
    cfg, steps, width, height, loops = parse_api_image_data(api_image_data, api_image_landscape)
    if '' != custom_prompt and not custom_prompt.endswith(','):
        custom_prompt = f'{custom_prompt},'
        
    if not batch_random:
        loops = 1
        
    if 'none' == ai_interface == api_interface:
        gr.Warning(LANG["gr_warning_interface_both_none"])
        
    api_images = []
    final_prompts = []
    final_infos = []
    
    ai_text=''
    LANG["ai_system_prompt"] = textwrap.dedent(ai_system_prompt_text)
    if 'none' != batch_generate_rule:  
        if 'none' != ai_interface:
            ai_text = last_ai_text
            
        if 'Last' != batch_generate_rule:
            LANG["ai_system_prompt"] = textwrap.dedent(ai_system_prompt_text)
            if 'Remote' == ai_interface:
                ai_text = llm_send_request(ai_prompt, remote_ai_base_url, remote_ai_model, remote_ai_timeout)
            elif 'Local' == ai_interface:
                ai_text = llm_send_local_request(ai_prompt, ai_local_addr, ai_local_temp, ai_local_n_predict)     
                    
    for index in range(1, loops + 1):
        rnd_character = ['','','']
        opt_chara = ['','','']
        tas = ['','','']
        rnd_oc = ''
        opt_oc = ''
        seed1 = seed_list[(index-1)]
        for count in range(0, 3):
            rnd_character[count] = rnd_character_list[int(3)*(index-int(1)) + count]
            opt_chara[count] = opt_chara_list[3*(index-1) + count]
            tas[count] = tag_assist_list[3*(index-1) + count]
        rnd_oc = rnd_oc_list[(index-1)]
        opt_oc = opt_oc_list[(index-1)]
                    
        prompt, info = create_prompt_info(rnd_character[0], opt_chara[0], tas[0],
                                          rnd_character[1], opt_chara[1], tas[1],
                                          rnd_character[2], opt_chara[2], tas[2],
                                          rnd_oc, opt_oc)   
        
        if 'none' != ai_interface or 'none' != api_interface:
            gr.Info(LANG["gr_info_create_n"].format(index, loops))
        
        if 1 != index and 'Every' == batch_generate_rule:
            if 'Remote' == ai_interface:
                ai_text = llm_send_request(ai_prompt, remote_ai_base_url, remote_ai_model, remote_ai_timeout)
            elif 'Local' == ai_interface:
                ai_text = llm_send_local_request(ai_prompt, ai_local_addr, ai_local_temp, ai_local_n_predict)         
                
        tag_angle, tag_camera, tag_background, tag_style = create_view_tags(view_angle, view_camera, view_background, view_style, seed1)            
        to_image_create_prompt = f'{custom_prompt}{tag_angle}{tag_camera}{tag_background}{tag_style}{prompt}{ai_text}{api_prompt}'
        for ban_word in prompt_ban.split(','):
            to_image_create_prompt = to_image_create_prompt.replace(ban_word.strip(), '')

        api_image = create_image(api_interface, api_addr, api_model_file_select, to_image_create_prompt, api_neg_prompt, 
                                seed1, cfg, steps, width, height, 
                                api_hf_enable, api_hf_scale, api_hf_denoise, api_hf_upscaler_selected, api_hf_colortransfer, api_webui_savepath_override)
        
        final_info = f'{index}:\nCustom Promot:[{custom_prompt}]\nTags:[{tag_angle}{tag_camera}{tag_background}{tag_style}]\n{info}\nAI Prompt:[{ai_text}]\nSeed:[{seed1}]\n'        
        final_prompt = f'{index}:\n{to_image_create_prompt}\n'
        if api_image:
            api_images.append(api_image)
        final_prompts.append(final_prompt)
        final_infos.append(final_info)        
        
        # Collect prompts
        last_prompt = prompt
        last_info = info
        last_ai_text = ai_text

    return ''.join(final_prompts), ''.join(final_infos), api_images
    
def create_with_last_prompt(view_angle, view_camera, view_background, view_style, random_seed,  custom_prompt,
                            ai_interface, ai_prompt, batch_generate_rule, prompt_ban, remote_ai_base_url, remote_ai_model, remote_ai_timeout,
                            ai_local_addr, ai_local_temp, ai_local_n_predict, ai_system_prompt_text,
                            api_interface, api_addr, api_prompt, api_neg_prompt, api_image_data, api_image_landscape, api_model_file_select,
                            api_hf_enable, api_hf_scale, api_hf_denoise, api_hf_upscaler_selected, api_hf_colortransfer, api_webui_savepath_override
            ) -> tuple[str, str, Image.Image, Image.Image]:        
    global LANG
    if '' == last_prompt and '' == custom_prompt:
        gr.Warning(LANG["gr_warning_click_create_first"])
        return 'Click \"Create Prompt" or add some \"Custom prompt\" first', '', None
        
    cfg, steps, width, height, loops = parse_api_image_data(api_image_data, api_image_landscape)
    if '' != custom_prompt and not custom_prompt.endswith(','):
        custom_prompt = f'{custom_prompt},'
            
    api_images = []
    final_prompts = []
    final_infos = []

    ai_text=''
    if 'none' != batch_generate_rule:         
        ai_text = last_ai_text        
        if 'Last' != batch_generate_rule:            
            LANG["ai_system_prompt"] = textwrap.dedent(ai_system_prompt_text)
            if 'Remote' == ai_interface:
                ai_text = llm_send_request(ai_prompt, remote_ai_base_url, remote_ai_model, remote_ai_timeout)
            elif 'Local' == ai_interface:
                ai_text = llm_send_local_request(ai_prompt, ai_local_addr, ai_local_temp, ai_local_n_predict)                

    for index in range(1, loops + 1):       
        gr.Info(LANG["gr_info_create_n"].format(index, loops))
        seed = random_seed
        if random_seed == -1:
            seed = random.randint(0, 4294967295)        
            
        if 1 != index and 'Every' == batch_generate_rule:
            if 'Remote' == ai_interface:
                ai_text = llm_send_request(ai_prompt, remote_ai_base_url, remote_ai_model, remote_ai_timeout)
            elif 'Local' == ai_interface:
                ai_text = llm_send_local_request(ai_prompt, ai_local_addr, ai_local_temp, ai_local_n_predict)                
        
        tag_angle, tag_camera, tag_background, tag_style = create_view_tags(view_angle, view_camera, view_background, view_style, seed)
        to_image_create_prompt = f'{custom_prompt}{tag_angle}{tag_camera}{tag_background}{tag_style}{last_prompt}{ai_text}{api_prompt}'
        for ban_word in prompt_ban.split(','):
            to_image_create_prompt = to_image_create_prompt.replace(ban_word.strip(), '')
        
        final_info = f'{index}:\nCustom Promot:[{custom_prompt}]\nTags:[{tag_angle}{tag_camera}{tag_background}{tag_style}]\n{last_info}\nAI Prompt:[{ai_text}]'
        api_image = create_image(api_interface, api_addr, api_model_file_select, to_image_create_prompt, api_neg_prompt, 
                                 seed, cfg, steps, width, height, 
                                 api_hf_enable, api_hf_scale, api_hf_denoise, api_hf_upscaler_selected, api_hf_colortransfer, api_webui_savepath_override)
        final_prompt = f'{index}:\n{to_image_create_prompt}\n'
        final_info = f'{final_info}\nSeed {index}:[{seed}]\n'
        
        if api_image:
            api_images.append(api_image)
        final_prompts.append(final_prompt)
        final_infos.append(final_info)
    
    return ''.join(final_prompts), ''.join(final_infos), api_images

def save_current_setting(character1, character2, character3, tag_assist,
                        view_angle, view_camera, view_background, view_style, api_model_file_select, random_seed,
                        custom_prompt, api_prompt, api_neg_prompt, api_image_data, api_image_landscape,
                        ai_prompt, batch_generate_rule, prompt_ban, ai_interface, 
                        remote_ai_base_url, remote_ai_model, remote_ai_timeout,
                        ai_local_addr, ai_local_temp, ai_local_n_predict, api_interface, api_addr,
                        api_hf_enable, api_hf_scale, api_hf_denoise, api_hf_upscaler_selected, api_hf_colortransfer, api_webui_savepath_override
                        ):        
    now_settings_json = {        
        "remote_ai_base_url": remote_ai_base_url,
        "remote_ai_model": remote_ai_model,
        "remote_ai_api_key": settings_json["remote_ai_api_key"],
        "remote_ai_timeout":remote_ai_timeout,
        
        "model_path": settings_json["model_path"],
        "model_filter": settings_json["model_filter"],
        "model_filter_keyword": settings_json["model_filter_keyword"],
        "search_modelinsubfolder": settings_json["search_modelinsubfolder"],
        
        "character1": character1,
        "character2": character2,
        "character3": character3,
        "tag_assist": tag_assist,
        
        "view_angle": view_angle,
        "view_camera": view_camera,
        "view_background": view_background,
        "view_style": view_style, 
        
        "api_model_file_select" : api_model_file_select,
        "random_seed": random_seed,
        
        "custom_prompt": custom_prompt,
        "api_prompt": api_prompt,
        "api_neg_prompt": api_neg_prompt,
        "api_image_data": api_image_data,   
        "api_image_landscape": api_image_landscape,   

        "batch_generate_rule": batch_generate_rule,
        "ai_prompt" : ai_prompt,                
        "prompt_ban": prompt_ban,
               
        "ai_interface": ai_interface,
        "ai_local_addr": ai_local_addr,
        "ai_local_temp": ai_local_temp,
        "ai_local_n_predict": ai_local_n_predict,
        
        "api_interface": api_interface,
        "api_addr": api_addr,
        
        "api_hf_enable": api_hf_enable,
        "api_hf_scale": api_hf_scale,
        "api_hf_denoise": api_hf_denoise,
        "api_hf_upscaler_list": settings_json["api_hf_upscaler_list"],
        "api_hf_upscaler_selected": api_hf_upscaler_selected,
        "api_hf_colortransfer": api_hf_colortransfer,
        "api_webui_savepath_override": api_webui_savepath_override,
    }
    
    tmp_file = save_json(now_settings_json=now_settings_json, file_name='tmp_settings.json')
    gr.Info(LANG["gr_info_settings_saved"].format(tmp_file))
    
def load_saved_setting(file_path):
    
    temp_settings_json = {}                
    with open(file_path, 'r', encoding='utf-8') as file:
        temp_settings_json.update(json.load(file))    
    load_settings(temp_settings_json)        
    gr.Info(LANG["gr_info_settings_loaded"].format(file_path))
        
    return settings_json["character1"],settings_json["character2"],settings_json["character3"],settings_json["tag_assist"],\
            settings_json["view_angle"],settings_json["view_camera"],settings_json["view_background"], settings_json["view_style"], settings_json["api_model_file_select"],settings_json["random_seed"],\
            settings_json["custom_prompt"],settings_json["api_prompt"],settings_json["api_neg_prompt"],settings_json["api_image_data"],settings_json["api_image_landscape"],\
            settings_json["ai_prompt"],settings_json["batch_generate_rule"],settings_json["prompt_ban"],settings_json["ai_interface"],\
            settings_json["remote_ai_base_url"],settings_json["remote_ai_model"],settings_json["remote_ai_timeout"],\
            settings_json["ai_local_addr"],settings_json["ai_local_temp"],settings_json["ai_local_n_predict"],settings_json["api_interface"],settings_json["api_addr"],\
            settings_json["api_hf_enable"],settings_json["api_hf_scale"],settings_json["api_hf_denoise"],settings_json["api_hf_upscaler_selected"],settings_json["api_hf_colortransfer"],settings_json["api_webui_savepath_override"]

def batch_generate_rule_change(options_selected):
    print(f'[{CAT}]AI rule for Batch generate:{options_selected}')

def refresh_character_thumb_image(character1, character2, character3):
    thumb_image = []
    rnd_character = [''] * 3
    opt_chara = [''] * 3
    
    if 'none' != character1 and 'random' != character1:
        rnd_character[0], opt_chara[0], thumb_image1, _ = illustrious_character_select_ex(character = character1, random_action_seed=42)        
        thumb_image.append(thumb_image1)
    
    if 'none' != character2 and 'random' != character2:
        rnd_character[1], opt_chara[1], thumb_image2, _ = illustrious_character_select_ex(character = character2, random_action_seed=42)        
        thumb_image.append(thumb_image2)
        
    if 'none' != character3 and 'random' != character3:
        rnd_character[2], opt_chara[2], thumb_image3, _ = illustrious_character_select_ex(character = character3, random_action_seed=42)                
        thumb_image.append(thumb_image3)
        
    _, character_info = create_prompt_info(rnd_character[0], opt_chara[0], '',
                                    rnd_character[1], opt_chara[1], '',
                                    rnd_character[2], opt_chara[2], '',
                                    '', '')   
    
    return thumb_image, character_info

def parse_arguments():
    parser = argparse.ArgumentParser(description='Character Select Application')
    parser.add_argument("--english", type=bool, default=False, required=False, help='Use English Character Name')
    args = parser.parse_args()

    return args.english

def get_prompt_manager():
    return PROMPT_MANAGER

def init():
    global ENGLISH_CHARACTER_NAME
    global LANG
    global JAVA_SCRIPT
        
    ENGLISH_CHARACTER_NAME = parse_arguments()
    if ENGLISH_CHARACTER_NAME:
        print(f'[{CAT}]:Use tags as Character Name')
        LANG = LANG_EN
    
    try:
        lib_js_path = os.path.join(current_dir, 'lib.js')
        lib_css_path = os.path.join(current_dir, 'lib.css')
            
        load_jsons()
        js_script = load_text_file(lib_js_path)
        css_script = load_text_file(lib_css_path)
        
        first_setup()
    except Exception as e:
        print(f"[{CAT}]:Initialization failed: {e}")
        sys.exit(1)
        
    print(f'[{CAT}]:Starting...')
    return character_list, view_tags, original_character_list, model_files_list, LANG, js_script, css_script
