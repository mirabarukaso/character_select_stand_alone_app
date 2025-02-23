import gradio as gr
from lib import init, create_prompt, create_with_last_prompt, save_current_setting, load_saved_setting, batch_generate_rule_change
from lib import JAVA_SCRIPT, CSS_SCRIPT, TITLE, settings_json

if __name__ == '__main__':
    character_list, action_list, original_character_list, model_files_list, prime_directive = init()
    
    with gr.Blocks(js=JAVA_SCRIPT, css=CSS_SCRIPT, title=TITLE) as ui:
        with gr.Row():
            character1 = gr.Dropdown(
                choices=character_list,
                label="Character list 1",
                value=settings_json["character1"],
                allow_custom_value = False,
            )
            
            character2 = gr.Dropdown(
                choices=character_list,
                label="Character list 2",
                value=settings_json["character2"],
                allow_custom_value = False,
            )
                            
            character3 = gr.Dropdown(
                choices=character_list,
                label="Character list 3",
                value=settings_json["character3"],
                allow_custom_value = False,
            )

            action = gr.Dropdown(
                choices=action_list,
                label="Action list",
                value=settings_json["action"],
                allow_custom_value = False,    
            )
            
            original_character = gr.Dropdown(
                choices=original_character_list,
                label="Original Character",
                value='none',
                allow_custom_value = False,
            )
            
        with gr.Row(elem_classes='main_row'):           
            with gr.Column(elem_classes='column_prompts'):
                with gr.Row():
                    api_model_file_select = gr.Dropdown(
                            choices=model_files_list,
                            label="Model list (ComfyUI Default:waiNSFWIllustrious_v110)",
                            value=settings_json["api_model_file_select"],
                            allow_custom_value = False,
                        )            
                    random_seed = gr.Slider(minimum=-1,
                            maximum=4294967295,
                            step=1,
                            value=-1,
                            label=settings_json["random_seed"],
                        )    
                with gr.Row():
                    thumb_image = gr.Gallery(type="pil", columns=3, show_download_button=False, object_fit='scale-down', height=244, label="Thumb Image Gallery")
                with gr.Row():
                    with gr.Column():
                        run_button = gr.Button("Create Prompt (1 Image only)", variant='primary') 
                    with gr.Column():
                        run_same_button = gr.Button("Batch with last Character and Action")
                with gr.Row():
                    with gr.Column():
                        # API prompts
                        custom_prompt = gr.Textbox(value=settings_json["custom_prompt"], label="Custom Prompt (Head)", elem_id="custom_prompt_text") 
                        api_prompt = gr.Textbox(value=settings_json["api_prompt"], label="Positive Prompt (Tail)", elem_id="positive_prompt_text")
                        api_neg_prompt = gr.Textbox(value=settings_json["api_neg_prompt"], label="Negative Prompt", elem_id="negative_prompt_text")                        
                        with gr.Row():
                            # AI prompts
                            batch_generate_rule = gr.Radio(choices=["Last", "Once", "Everytime", "Disable"], 
                                                        value = settings_json["batch_generate_rule"],
                                                        label="AI rule for Batch generate",
                                                        scale=3)
                            api_image_data = gr.Textbox(value=settings_json["api_image_data"], label="CFG,Step,Width,Height,Batch Images(1-16)",scale=2)
                        ai_prompt = gr.Textbox(value=settings_json["ai_prompt"], label="AI Prompt", elem_id="ai_prompt_text")
                        prompt_ban = gr.Textbox(value=settings_json["prompt_ban"], label="Prompt Ban (Remove specific tags e.g. \"masterpiece, quality, amazing\" )", elem_id="prompt_ban_text")                
                with gr.Row():             
                    with gr.Column():                               
                        # AI Prompt Generator                
                        ai_interface = gr.Dropdown(
                            choices=['none', 'Remote', 'Local'],
                            label="AI Prompt Generator",
                            value=settings_json["ai_interface"],
                            allow_custom_value = False,
                        )
                        
                        ai_remote_addr= gr.Textbox(value=settings_json["remote_ai_base_url"], label="Remote AI url")
                        ai_remote_model= gr.Textbox(value=settings_json["remote_ai_model"], label="Remote AI model")
                        ai_remote_timeout = gr.Slider(minimum=5,
                            maximum=300,
                            step=1,
                            value=settings_json["remote_ai_timeout"],
                            label="Remote AI connection timeout",
                        )   
                        
                        ai_local_addr = gr.Textbox(value=settings_json["ai_local_addr"], label="Local Llama.cpp server")   
                        ai_local_temp = gr.Slider(minimum=0.1,
                            maximum=1,
                            step=0.05,
                            value=settings_json["ai_local_temp"],
                            label="Local AI Temperature",
                        )
                        ai_local_n_predict = gr.Slider(minimum=128,
                            maximum=4096,
                            step=128,
                            value=settings_json["ai_local_n_predict"],
                            label="Local AI n_predict",
                        )                            
                        
                    with gr.Column():
                        # API Image Generator                
                        api_interface = gr.Dropdown(
                            choices=['none', 'ComfyUI', 'WebUI'],
                            label="Local Image Generator API",
                            value=settings_json["api_interface"],
                            allow_custom_value = False,
                        )
                        api_addr = gr.Textbox(value=settings_json["api_addr"], label="Local Image Generator IP Address:Port") 
                        with gr.Row():
                                save_settings_button = gr.Button("Save Settings", variant='stop') 
                                load_settings_button = gr.UploadButton("Load Settings", file_count='single', file_types=['.json']) 
            with gr.Column(elem_classes='column_images'):
                api_image = gr.Gallery(type="pil", columns=4, show_download_button=False, object_fit='contain', preview=True, height=789, label="Gallery")
                output_prompt = gr.Textbox(label="Prompt")
                output_info = gr.Textbox(label="Information")
                
                gr.Markdown('<h1><span style="color:orangered">System prompt for AI prompt generator.<br>DO NOT MODIFY it if you don\'t understand it!!!</span></h1>')
                ai_system_prompt_text = gr.Textbox(label="System Prompt", value=prime_directive)
        
        run_button.click(fn=create_prompt, 
                         inputs=[character1, character2, character3, action, original_character, random_seed, custom_prompt, 
                                 ai_interface, ai_prompt, prompt_ban, ai_remote_addr, ai_remote_model, ai_remote_timeout,
                                 ai_local_addr, ai_local_temp, ai_local_n_predict, ai_system_prompt_text,
                                 api_interface, api_addr, api_prompt, api_neg_prompt, api_image_data, api_model_file_select
                                 ], 
                         outputs=[output_prompt, output_info, thumb_image, api_image])
        
        run_same_button.click(fn=create_with_last_prompt, 
                         inputs=[random_seed,  custom_prompt,
                                 ai_interface, ai_prompt, batch_generate_rule, prompt_ban, ai_remote_addr, ai_remote_model, ai_remote_timeout,
                                 ai_local_addr, ai_local_temp, ai_local_n_predict, ai_system_prompt_text,
                                 api_interface, api_addr, api_prompt, api_neg_prompt, api_image_data, api_model_file_select
                                 ], 
                         outputs=[output_prompt, output_info, api_image])
        
        save_settings_button.click(fn=save_current_setting,
                                   inputs=[character1, character2, character3, action, api_model_file_select, random_seed,
                                           custom_prompt, api_prompt, api_neg_prompt, api_image_data, 
                                           ai_prompt, batch_generate_rule, prompt_ban, ai_interface, 
                                           ai_remote_addr, ai_remote_model, ai_remote_timeout,
                                           ai_local_addr, ai_local_temp, ai_local_n_predict, api_interface, api_addr],
                                   outputs=[])
        
        load_settings_button.upload(fn=load_saved_setting,
                                   inputs=[load_settings_button],
                                   outputs=[character1, character2, character3, action, api_model_file_select, random_seed,
                                            custom_prompt, api_prompt, api_neg_prompt, api_image_data, 
                                            batch_generate_rule, ai_prompt, prompt_ban, ai_interface, 
                                            ai_remote_addr, ai_remote_model, ai_remote_timeout,
                                            ai_local_addr, ai_local_temp, ai_local_n_predict, api_interface, api_addr])
        
        batch_generate_rule.change(fn=batch_generate_rule_change,
                                inputs=batch_generate_rule)
        
    ui.launch()