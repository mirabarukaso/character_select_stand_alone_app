export const CLIP_TYPE = [
    "stable_diffusion", "stable_cascade", "sd3", "stable_audio", "mochi", "ltxv", 
    "pixart", "cosmos", "lumina2", "wan", "hidream", "chroma", "ace", "omnigen2", "qwen_image", 
    "hunyuan_image", "flux2", "ovis", "longcat_image", "cogvideox", "lens" , "pixeldit", 
    "ideogram4", "boogu", "krea2"];

export const CLIP_DEVICE = ['default', 'cpu'];

export const DIFFUSION_DTYPE = ['default', 'fp8_e4m3fn', 'fp8_e4m3fn_fast', 'fp8_e5m2'];

export const SAMPLER_COMFYUI = ["euler", "euler_cfg_pp", "euler_ancestral", "euler_ancestral_cfg_pp", "heun", "heunpp2", "exp_heun_2_x0", "exp_heun_2_x0_sde", "dpm_2", "dpm_2_ancestral",
                  "lms", "dpm_fast", "dpm_adaptive", "dpmpp_2s_ancestral", "dpmpp_2s_ancestral_cfg_pp", "dpmpp_sde", "dpmpp_sde_gpu",
                  "dpmpp_2m", "dpmpp_2m_cfg_pp", "dpmpp_2m_sde", "dpmpp_2m_sde_gpu", "dpmpp_2m_sde_heun", "dpmpp_2m_sde_heun_gpu", "dpmpp_3m_sde", "dpmpp_3m_sde_gpu", "ddpm", "lcm",
                  "ipndm", "ipndm_v", "deis", "cfgpp_ud10_ab", "res_multistep", "res_multistep_cfg_pp", "res_multistep_ancestral", "res_multistep_ancestral_cfg_pp",
                  "gradient_estimation", "gradient_estimation_cfg_pp", "er_sde", "seeds_2", "seeds_3", "sa_solver", "sa_solver_pece"];

export const SCHEDULER_COMFYUI = ["normal", "karras", "exponential", "sgm_uniform", "simple", "ddim_uniform", "beta", "linear_quadratic", "kl_optimal"] ;

export const  SAMPLER_WEBUI = ["DPM++ 2M", "DPM++ SDE", "DPM++ 2M SDE", "DPM++ 3M SDE", "DPM++ 2s a RF",
    "Euler a", "Euler", "ER SDE", "LCM", "LMS", "Heun", "DPM2", "Res Multistep", "Kohaku LoNyu Yog", "Restart", "UniPC",
    "DDIM", "PLMS", "DPM++ 2M CFG++", "Euler a CFG++", "Euler CFG++"];
    
export const SCHEDULER_WEBUI = ["Automatic", "Karras", "Exponential", "Polyexponential", "Normal", "Simple", "Uniform", "SGM Uniform",
    "Linear Quadratic", "KL Optimal", "DDIM", "Align Your Steps", "Beta", "Turbo", "Bong Tangent", "FlowMatchEulerDiscrete", "Flux2"];
