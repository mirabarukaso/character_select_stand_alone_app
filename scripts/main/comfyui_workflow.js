// Do NOT Modify it here
// Modify it in ComfyUI with your generate result
export const WORKFLOW = {
  "2": {
    "inputs": {
      "text": [
        "34",
        4
      ],
      "clip": [
        "34",
        1
      ]
    },
    "class_type": "CLIPTextEncode",
    "_meta": {
      "title": "CLIP Text Encode (Prompt)"
    }
  },
  "3": {
    "inputs": {
      "text": [
        "33",
        0
      ],
      "clip": [
        "34",
        1
      ]
    },
    "class_type": "CLIPTextEncode",
    "_meta": {
      "title": "CLIP Text Encode (Prompt)"
    }
  },
  "5": {
    "inputs": {
      "width": [
        "17",
        0
      ],
      "height": [
        "17",
        1
      ],
      "batch_size": 1
    },
    "class_type": "EmptyLatentImage",
    "_meta": {
      "title": "Empty Latent Image"
    }
  },
  "6": {
    "inputs": {
      "samples": [
        "37",
        0
      ],
      "vae": [
        "43",
        2
      ]
    },
    "class_type": "VAEDecode",
    "_meta": {
      "title": "VAE Decode"
    }
  },
  "13": {
    "inputs": {
      "steps": 30,
      "cfg": 7
    },
    "class_type": "StepsAndCfg",
    "_meta": {
      "title": "Steps & Cfg"
    }
  },
  "17": {
    "inputs": {
      "Width": 1024,
      "Height": 1360,
      "Batch": 1,
      "Landscape": false,
      "HiResMultiplier": 1.5
    },
    "class_type": "CanvasCreatorAdvanced",
    "_meta": {
      "title": "Create Canvas Advanced"
    }
  },
  "18": {
    "inputs": {
      "tile_size": 1024,
      "overlap": 64,
      "temporal_size": 64,
      "temporal_overlap": 8,
      "samples": [
        "20",
        0
      ],
      "vae": [
        "43",
        2
      ]
    },
    "class_type": "VAEDecodeTiled",
    "_meta": {
      "title": "VAE Decode (Tiled)"
    }
  },
  "19": {
    "inputs": {
      "tile_size": 1024,
      "overlap": 64,
      "temporal_size": 64,
      "temporal_overlap": 8,
      "pixels": [
        "25",
        0
      ],
      "vae": [
        "43",
        2
      ]
    },
    "class_type": "VAEEncodeTiled",
    "_meta": {
      "title": "VAE Encode (Tiled)"
    }
  },
  "20": {
    "inputs": {
      "seed": 3025955348,
      "steps": 20,
      "cfg": [
        "13",
        1
      ],
      "sampler_name": "euler_ancestral",
      "scheduler": "normal",
      "denoise": 0.4,
      "model": [
        "39",
        2
      ],
      "positive": [
        "41",
        0
      ],
      "negative": [
        "40",
        0
      ],
      "latent_image": [
        "19",
        0
      ]
    },
    "class_type": "KSampler",
    "_meta": {
      "title": "KSampler"
    }
  },
  "25": {
    "inputs": {
      "resize_scale": [
        "17",
        5
      ],
      "resize_method": "nearest",
      "upscale_model": [
        "27",
        0
      ],
      "image": [
        "6",
        0
      ]
    },
    "class_type": "UpscaleImageByModelThenResize",
    "_meta": {
      "title": "Upscale Image By Model Then Resize"
    }
  },
  "27": {
    "inputs": {
      "model_name": "RealESRGAN_x4.pth"
    },
    "class_type": "UpscaleModelLoader",
    "_meta": {
      "title": "Load Upscale Model"
    }
  },
  "28": {
    "inputs": {
      "method": "Mean",
      "src_image": [
        "18",
        0
      ],
      "ref_image": [
        "6",
        0
      ]
    },
    "class_type": "ImageColorTransferMira",
    "_meta": {
      "title": "Color Transfer"
    }
  },
  "29": {
    "inputs": {
      "filename": "%time_%seed",
      "path": "%date",
      "extension": "png",
      "steps": [
        "13",
        0
      ],
      "cfg": [
        "13",
        1
      ],
      "modelname": "waiIllustriousSDXL_v160.safetensors",
      "sampler_name": "euler_ancestral",
      "scheduler": "normal",
      "positive": [
        "32",
        0
      ],
      "negative": [
        "33",
        0
      ],
      "seed_value": 3025955348,
      "width": [
        "17",
        0
      ],
      "height": [
        "17",
        1
      ],
      "lossless_webp": true,
      "quality_jpeg_or_webp": 100,
      "optimize_png": false,
      "counter": 0,
      "denoise": 1,
      "clip_skip": -2,
      "time_format": "%Y-%m-%d-%H%M%S",
      "save_workflow_as_json": false,
      "embed_workflow": true,
      "additional_hashes": "",
      "images": [
        "28",
        0
      ]
    },
    "class_type": "ImageSaverMira",
    "_meta": {
      "title": "Image Saver"
    }
  },
  "32": {
    "inputs": {
      "text": "solo, masterpiece, best quality, amazing quality"
    },
    "class_type": "TextBoxMira",
    "_meta": {
      "title": "Text Box"
    }
  },
  "33": {
    "inputs": {
      "text": "bad quality,worst quality,worst detail,sketch"
    },
    "class_type": "TextBoxMira",
    "_meta": {
      "title": "Text Box"
    }
  },
  "34": {
    "inputs": {
      "text": [
        "32",
        0
      ],
      "model": [
        "35",
        0
      ],
      "clip": [
        "45",
        1
      ]
    },
    "class_type": "LoRAfromText",
    "_meta": {
      "title": "LoRA Loader from Text"
    }
  },
  "35": {
    "inputs": {
      "sampling": "eps",
      "zsnr": false,
      "model": [
        "45",
        0
      ]
    },
    "class_type": "ModelSamplingDiscrete",
    "_meta": {
      "title": "ModelSamplingDiscrete"
    }
  },
  "36": {
    "inputs": {
      "add_noise": "enable",
      "noise_seed": 3025955348,
      "steps": [
        "13",
        0
      ],
      "cfg": [
        "13",
        1
      ],
      "sampler_name": "euler_ancestral",
      "scheduler": "normal",
      "start_at_step": 0,
      "end_at_step": 1000,
      "return_with_leftover_noise": "disable",
      "model": [
        "34",
        0
      ],
      "positive": [
        "2",
        0
      ],
      "negative": [
        "3",
        0
      ],
      "latent_image": [
        "5",
        0
      ]
    },
    "class_type": "KSamplerAdvanced",
    "_meta": {
      "title": "KSampler (Advanced)"
    }
  },
  "37": {
    "inputs": {
      "add_noise": "disable",
      "noise_seed": 3025955348,
      "steps": [
        "13",
        0
      ],
      "cfg": [
        "13",
        1
      ],
      "sampler_name": "euler_ancestral",
      "scheduler": "normal",
      "start_at_step": 12,
      "end_at_step": 10000,
      "return_with_leftover_noise": "disable",
      "model": [
        "39",
        0
      ],
      "positive": [
        "41",
        0
      ],
      "negative": [
        "40",
        0
      ],
      "latent_image": [
        "36",
        0
      ]
    },
    "class_type": "KSamplerAdvanced",
    "_meta": {
      "title": "KSampler (Advanced)"
    }
  },
  "39": {
    "inputs": {
      "text": [
        "32",
        0
      ],
      "model": [
        "44",
        0
      ],
      "clip": [
        "43",
        1
      ]
    },
    "class_type": "LoRAfromText",
    "_meta": {
      "title": "LoRA Loader from Text"
    }
  },
  "40": {
    "inputs": {
      "text": [
        "33",
        0
      ],
      "clip": [
        "39",
        1
      ]
    },
    "class_type": "CLIPTextEncode",
    "_meta": {
      "title": "CLIP Text Encode (Prompt)"
    }
  },
  "41": {
    "inputs": {
      "text": [
        "39",
        4
      ],
      "clip": [
        "39",
        1
      ]
    },
    "class_type": "CLIPTextEncode",
    "_meta": {
      "title": "CLIP Text Encode (Prompt)"
    }
  },
  "43": {
    "inputs": {
      "ckpt_name": "waiIllustriousSDXL_v160.safetensors"
    },
    "class_type": "CheckpointLoaderSimple",
    "_meta": {
      "title": "Load Checkpoint"
    }
  },
  "44": {
    "inputs": {
      "sampling": "eps",
      "zsnr": false,
      "model": [
        "43",
        0
      ]
    },
    "class_type": "ModelSamplingDiscrete",
    "_meta": {
      "title": "ModelSamplingDiscrete"
    }
  },
  "45": {
    "inputs": {
      "ckpt_name": "waiIllustriousSDXL_v160.safetensors"
    },
    "class_type": "CheckpointLoaderSimple",
    "_meta": {
      "title": "Load Checkpoint"
    }
  },
  "46": {
    "inputs": {
      "samples": [
        "36",
        0
      ],
      "upscale_method": "nearest-exact",
      "scale_by": 1.5
    },
    "class_type": "LatentUpscaleBy",
    "_meta": {
      "title": "Upscale Latent By"
    }
  },
  "47": {
    "inputs": {
      "vae_name": "sdxl_vae.safetensors"
    },
    "class_type": "VAELoader",
    "_meta": {
      "title": "Load VAE"
    }
  }
};

export const WORKFLOW_REGIONAL = {
  "2": {
    "inputs": {
      "text": [
        "34",
        4
      ],
      "clip": [
        "34",
        1
      ]
    },
    "class_type": "CLIPTextEncode",
    "_meta": {
      "title": "CLIP Text Encode (Prompt)"
    }
  },
  "3": {
    "inputs": {
      "text": [
        "33",
        0
      ],
      "clip": [
        "34",
        1
      ]
    },
    "class_type": "CLIPTextEncode",
    "_meta": {
      "title": "CLIP Text Encode (Prompt)"
    }
  },
  "5": {
    "inputs": {
      "width": [
        "17",
        0
      ],
      "height": [
        "17",
        1
      ],
      "batch_size": 1
    },
    "class_type": "EmptyLatentImage",
    "_meta": {
      "title": "Empty Latent Image"
    }
  },
  "6": {
    "inputs": {
      "samples": [
        "37",
        0
      ],
      "vae": [
        "43",
        2
      ]
    },
    "class_type": "VAEDecode",
    "_meta": {
      "title": "VAE Decode"
    }
  },
  "13": {
    "inputs": {
      "steps": 30,
      "cfg": 7.000000000000002
    },
    "class_type": "StepsAndCfg",
    "_meta": {
      "title": "Steps & Cfg"
    }
  },
  "17": {
    "inputs": {
      "Width": 1024,
      "Height": 1360,
      "Batch": 1,
      "Landscape": false,
      "HiResMultiplier": 1.5
    },
    "class_type": "CanvasCreatorAdvanced",
    "_meta": {
      "title": "Create Canvas Advanced"
    }
  },
  "18": {
    "inputs": {
      "tile_size": 1024,
      "overlap": 64,
      "temporal_size": 64,
      "temporal_overlap": 8,
      "samples": [
        "20",
        0
      ],
      "vae": [
        "43",
        2
      ]
    },
    "class_type": "VAEDecodeTiled",
    "_meta": {
      "title": "VAE Decode (Tiled)"
    }
  },
  "19": {
    "inputs": {
      "tile_size": 1024,
      "overlap": 64,
      "temporal_size": 64,
      "temporal_overlap": 8,
      "pixels": [
        "25",
        0
      ],
      "vae": [
        "43",
        2
      ]
    },
    "class_type": "VAEEncodeTiled",
    "_meta": {
      "title": "VAE Encode (Tiled)"
    }
  },
  "20": {
    "inputs": {
      "seed": 715010500915488,
      "steps": 20,
      "cfg": [
        "13",
        1
      ],
      "sampler_name": "euler_ancestral",
      "scheduler": "normal",
      "denoise": 0.4000000000000001,
      "model": [
        "39",
        2
      ],
      "positive": [
        "57",
        0
      ],
      "negative": [
        "40",
        0
      ],
      "latent_image": [
        "19",
        0
      ]
    },
    "class_type": "KSampler",
    "_meta": {
      "title": "KSampler"
    }
  },
  "25": {
    "inputs": {
      "resize_scale": [
        "17",
        5
      ],
      "resize_method": "nearest",
      "upscale_model": [
        "27",
        0
      ],
      "image": [
        "6",
        0
      ]
    },
    "class_type": "UpscaleImageByModelThenResize",
    "_meta": {
      "title": "Upscale Image By Model Then Resize"
    }
  },
  "27": {
    "inputs": {
      "model_name": "4x-UltraSharp.pth"
    },
    "class_type": "UpscaleModelLoader",
    "_meta": {
      "title": "Load Upscale Model"
    }
  },
  "28": {
    "inputs": {
      "method": "Mean",
      "src_image": [
        "18",
        0
      ],
      "ref_image": [
        "6",
        0
      ]
    },
    "class_type": "ImageColorTransferMira",
    "_meta": {
      "title": "Color Transfer"
    }
  },
  "29": {
    "inputs": {
      "filename": "%time_%seed",
      "path": "%date",
      "extension": "png",
      "steps": [
        "13",
        0
      ],
      "cfg": [
        "13",
        1
      ],
      "modelname": "waiNSFWIllustrious_v130.safetensors",
      "sampler_name": "euler_ancestral",
      "scheduler": "normal",
      "positive": [
        "32",
        0
      ],
      "negative": [
        "33",
        0
      ],
      "seed_value": 1775747588,
      "width": [
        "17",
        0
      ],
      "height": [
        "17",
        1
      ],
      "lossless_webp": true,
      "quality_jpeg_or_webp": 100,
      "optimize_png": false,
      "counter": 0,
      "denoise": 1,
      "clip_skip": -2,
      "time_format": "%Y-%m-%d-%H%M%S",
      "save_workflow_as_json": false,
      "embed_workflow": true,
      "additional_hashes": "",
      "images": [
        "28",
        0
      ]
    },
    "class_type": "ImageSaverMira",
    "_meta": {
      "title": "Image Saver"
    }
  },
  "32": {
    "inputs": {
      "text": "2girls"
    },
    "class_type": "TextBoxMira",
    "_meta": {
      "title": "Text Box"
    }
  },
  "33": {
    "inputs": {
      "text": "bad quality, worst quality, worst detail, sketch"
    },
    "class_type": "TextBoxMira",
    "_meta": {
      "title": "Text Box"
    }
  },
  "34": {
    "inputs": {
      "text": [
        "32",
        0
      ],
      "model": [
        "35",
        0
      ],
      "clip": [
        "45",
        1
      ]
    },
    "class_type": "LoRAfromText",
    "_meta": {
      "title": "LoRA Loader from Text"
    }
  },
  "35": {
    "inputs": {
      "sampling": "eps",
      "zsnr": false,
      "model": [
        "45",
        0
      ]
    },
    "class_type": "ModelSamplingDiscrete",
    "_meta": {
      "title": "ModelSamplingDiscrete"
    }
  },
  "36": {
    "inputs": {
      "add_noise": "enable",
      "noise_seed": 1094643513798864,
      "steps": [
        "13",
        0
      ],
      "cfg": [
        "13",
        1
      ],
      "sampler_name": "euler_ancestral",
      "scheduler": "normal",
      "start_at_step": 0,
      "end_at_step": 1000,
      "return_with_leftover_noise": "disable",
      "model": [
        "34",
        0
      ],
      "positive": [
        "53",
        0
      ],
      "negative": [
        "3",
        0
      ],
      "latent_image": [
        "5",
        0
      ]
    },
    "class_type": "KSamplerAdvanced",
    "_meta": {
      "title": "KSampler (Advanced)"
    }
  },
  "37": {
    "inputs": {
      "add_noise": "disable",
      "noise_seed": 790295579866824,
      "steps": [
        "13",
        0
      ],
      "cfg": [
        "13",
        1
      ],
      "sampler_name": "euler_ancestral",
      "scheduler": "normal",
      "start_at_step": 12,
      "end_at_step": 10000,
      "return_with_leftover_noise": "disable",
      "model": [
        "39",
        0
      ],
      "positive": [
        "57",
        0
      ],
      "negative": [
        "40",
        0
      ],
      "latent_image": [
        "36",
        0
      ]
    },
    "class_type": "KSamplerAdvanced",
    "_meta": {
      "title": "KSampler (Advanced)"
    }
  },
  "39": {
    "inputs": {
      "text": [
        "32",
        0
      ],
      "model": [
        "44",
        0
      ],
      "clip": [
        "43",
        1
      ]
    },
    "class_type": "LoRAfromText",
    "_meta": {
      "title": "LoRA Loader from Text"
    }
  },
  "40": {
    "inputs": {
      "text": [
        "33",
        0
      ],
      "clip": [
        "39",
        1
      ]
    },
    "class_type": "CLIPTextEncode",
    "_meta": {
      "title": "CLIP Text Encode (Prompt)"
    }
  },
  "41": {
    "inputs": {
      "text": [
        "39",
        4
      ],
      "clip": [
        "39",
        1
      ]
    },
    "class_type": "CLIPTextEncode",
    "_meta": {
      "title": "CLIP Text Encode (Prompt)"
    }
  },
  "43": {
    "inputs": {
      "ckpt_name": "waiIllustriousSDXL_v160.safetensors"
    },
    "class_type": "CheckpointLoaderSimple",
    "_meta": {
      "title": "Load Checkpoint"
    }
  },
  "44": {
    "inputs": {
      "sampling": "eps",
      "zsnr": false,
      "model": [
        "43",
        0
      ]
    },
    "class_type": "ModelSamplingDiscrete",
    "_meta": {
      "title": "ModelSamplingDiscrete"
    }
  },
  "45": {
    "inputs": {
      "ckpt_name": "miaomiaoHarem_v16G.safetensors"
    },
    "class_type": "CheckpointLoaderSimple",
    "_meta": {
      "title": "Load Checkpoint"
    }
  },
  "46": {
    "inputs": {
      "text": "2girls"
    },
    "class_type": "TextBoxMira",
    "_meta": {
      "title": "Text Box"
    }
  },
  "47": {
    "inputs": {
      "Width": [
        "17",
        0
      ],
      "Height": [
        "17",
        1
      ],
      "Colum_first": true,
      "Rows": 1,
      "Colums": 1,
      "Layout": "1,0.2,1"
    },
    "class_type": "CreateTillingPNGMask",
    "_meta": {
      "title": "Create Tilling PNG Mask"
    }
  },
  "48": {
    "inputs": {
      "Intenisity": 1,
      "Blur": 0,
      "Start_At_Index": 0,
      "Overlap": "Next",
      "Overlap_Count": 1,
      "PngRectangles": [
        "47",
        2
      ]
    },
    "class_type": "PngRectanglesToMask",
    "_meta": {
      "title": "PngRectangles to Mask"
    }
  },
  "49": {
    "inputs": {
      "Intenisity": 1,
      "Blur": 0,
      "Start_At_Index": 2,
      "Overlap": "Previous",
      "Overlap_Count": 1,
      "PngRectangles": [
        "47",
        2
      ]
    },
    "class_type": "PngRectanglesToMask",
    "_meta": {
      "title": "PngRectangles to Mask"
    }
  },
  "50": {
    "inputs": {
      "strength": 1,
      "set_cond_area": "default",
      "conditioning": [
        "2",
        0
      ],
      "mask": [
        "48",
        0
      ]
    },
    "class_type": "ConditioningSetMask",
    "_meta": {
      "title": "Conditioning (Set Mask)"
    }
  },
  "51": {
    "inputs": {
      "text": [
        "46",
        0
      ],
      "clip": [
        "34",
        1
      ]
    },
    "class_type": "CLIPTextEncode",
    "_meta": {
      "title": "CLIP Text Encode (Prompt)"
    }
  },
  "52": {
    "inputs": {
      "strength": 1,
      "set_cond_area": "default",
      "conditioning": [
        "51",
        0
      ],
      "mask": [
        "49",
        0
      ]
    },
    "class_type": "ConditioningSetMask",
    "_meta": {
      "title": "Conditioning (Set Mask)"
    }
  },
  "53": {
    "inputs": {
      "conditioning_1": [
        "50",
        0
      ],
      "conditioning_2": [
        "52",
        0
      ]
    },
    "class_type": "ConditioningCombine",
    "_meta": {
      "title": "Conditioning (Combine)"
    }
  },
  "54": {
    "inputs": {
      "text": [
        "46",
        0
      ],
      "clip": [
        "39",
        1
      ]
    },
    "class_type": "CLIPTextEncode",
    "_meta": {
      "title": "CLIP Text Encode (Prompt)"
    }
  },
  "55": {
    "inputs": {
      "strength": 1,
      "set_cond_area": "default",
      "conditioning": [
        "41",
        0
      ],
      "mask": [
        "48",
        0
      ]
    },
    "class_type": "ConditioningSetMask",
    "_meta": {
      "title": "Conditioning (Set Mask)"
    }
  },
  "56": {
    "inputs": {
      "strength": 1,
      "set_cond_area": "default",
      "conditioning": [
        "54",
        0
      ],
      "mask": [
        "49",
        0
      ]
    },
    "class_type": "ConditioningSetMask",
    "_meta": {
      "title": "Conditioning (Set Mask)"
    }
  },
  "57": {
    "inputs": {
      "conditioning_1": [
        "55",
        0
      ],
      "conditioning_2": [
        "56",
        0
      ]
    },
    "class_type": "ConditioningCombine",
    "_meta": {
      "title": "Conditioning (Combine)"
    }
  },
  "58": {
    "inputs": {
      "samples": [
        "36",
        0
      ],
      "upscale_method": "nearest-exact",
      "scale_by": 1.5
    },
    "class_type": "LatentUpscaleBy",
    "_meta": {
      "title": "Upscale Latent By"
    }
  },
  "59": {
    "inputs": {
      "vae_name": "sdxl_vae.safetensors"
    },
    "class_type": "VAELoader",
    "_meta": {
      "title": "Load VAE"
    }
  }
};

export const WORKFLOW_CONTROLNET = {
  "1": {
    "inputs": {
      "base64text": ""
    },
    "class_type": "GzippedBase64ToImage",
    "_meta": {
      "title": "Gzipped Base64 To Image"
    }
  },
  "2": {
    "inputs": {
      "preprocessor": "Manga2Anime_LineArt_Preprocessor",
      "resolution": 512,
      "image": [
        "1",
        0
      ]
    },
    "class_type": "AIO_Preprocessor",
    "_meta": {
      "title": "AIO Aux Preprocessor"
    }
  },
  "3": {
    "inputs": {
      "images": [
        "2",
        0
      ]
    },
    "class_type": "PreviewImage",
    "_meta": {
      "title": "Preview Image"
    }
  }
};

export const WORKFLOW_MIRA_ITU = {
  "1": {
    "inputs": {
      "base64text": ""
    },
    "class_type": "GzippedBase64ToImage",
    "_meta": {
      "title": "Gzipped Base64 To Image"
    }
  },
  "2": {
    "inputs": {
      "resize_scale": 2,
      "resize_method": "lanczos",
      "upscale_model": [
        "3",
        0
      ],
      "image": [
        "1",
        0
      ]
    },
    "class_type": "UpscaleImageByModelThenResize",
    "_meta": {
      "title": "Upscale Image By Model Then Resize"
    }
  },
  "3": {
    "inputs": {
      "model_name": "RealESRGAN_x4plus_anime_6B.pth"
    },
    "class_type": "UpscaleModelLoader",
    "_meta": {
      "title": "Load Upscale Model"
    }
  },
  "4": {
    "inputs": {
      "tile_size": 1536,
      "overlap": 64,
      "overlap_feather_rate": 1,
      "adaptable_tile_size": true,
      "adaptable_max_deviation_ratio": 0.25,
      "adaptable_max_aspect_ratio": 1.33,
      "image": [
        "2",
        0
      ]
    },
    "class_type": "ImageCropTiles_MiraSubPack",
    "_meta": {
      "title": "Image Crop to Tiles"
    }
  },
  "5": {
    "inputs": {
      "model_name": "cl_tagger/cl_tagger_1_02.onnx",
      "general": 0.55,
      "character": 0.6,
      "replace_space": true,
      "categories": "general",
      "exclude_tags": "",
      "session_method": "GPU",
      "image": [
        "4",
        0
      ]
    },
    "class_type": "cl_tagger_mira",
    "_meta": {
      "title": "CL Tagger"
    }
  },
  "6": {
    "inputs": {
      "ckpt_name": "waiIllustriousSDXL_v160.safetensors"
    },
    "class_type": "CheckpointLoaderSimpleMira",
    "_meta": {
      "title": "Checkpoint Loader with Name"
    }
  },
  "7": {
    "inputs": {
      "pixels": [
        "4",
        0
      ],
      "vae": [
        "6",
        2
      ]
    },
    "class_type": "VAEEncode",
    "_meta": {
      "title": "VAE Encode"
    }
  },
  "8": {
    "inputs": {
      "common_positive": [
        "9",
        0
      ],
      "common_negative": [
        "10",
        0
      ],
      "tagger_text": [
        "5",
        0
      ],
      "seed": 413820312837004,
      "steps": 14,
      "cfg": 7,
      "sampler_name": "euler_ancestral",
      "scheduler": "beta",
      "denoise": 0.4,
      "model": [
        "17",
        0
      ],
      "clip": [
        "6",
        1
      ],
      "tiled_samples": [
        "7",
        0
      ]
    },
    "class_type": "ImageTiledKSamplerWithTagger_MiraSubPack",
    "_meta": {
      "title": "Tiled Image KSampler with Tagger"
    }
  },
  "9": {
    "inputs": {
      "text": "masterpiece, best quality, amazing quality"
    },
    "class_type": "TextBoxMira",
    "_meta": {
      "title": "Text Box"
    }
  },
  "10": {
    "inputs": {
      "text": "bad quality,worst quality,worst detail,sketch,censor,3d"
    },
    "class_type": "TextBoxMira",
    "_meta": {
      "title": "Text Box"
    }
  },
  "11": {
    "inputs": {
      "samples": [
        "8",
        0
      ],
      "vae": [
        "6",
        2
      ]
    },
    "class_type": "VAEDecode",
    "_meta": {
      "title": "VAE Decode"
    }
  },
  "12": {
    "inputs": {
      "feather_rate_override": 0,
      "tiled_images": [
        "11",
        0
      ],
      "mira_itu_pipeline": [
        "4",
        1
      ]
    },
    "class_type": "OverlappedImageMerge_MiraSubPack",
    "_meta": {
      "title": "Overlapped Image Merge"
    }
  },
  "14": {
    "inputs": {
      "filename": "%time_%seed",
      "path": "%date",
      "extension": "png",
      "steps": 14,
      "cfg": 7,
      "modelname": [
        "6",
        3
      ],
      "sampler_name": "euler_ancestral",
      "scheduler": "beta",
      "positive": [
        "15",
        0
      ],
      "negative": [
        "10",
        0
      ],
      "seed_value": 3737927281,
      "width": 512,
      "height": 512,
      "lossless_webp": true,
      "quality_jpeg_or_webp": 100,
      "optimize_png": false,
      "counter": 0,
      "denoise": 1,
      "clip_skip": -2,
      "time_format": "%Y-%m-%d-%H%M%S",
      "save_workflow_as_json": false,
      "embed_workflow": true,
      "additional_hashes": "",
      "images": [
        "12",
        0
      ]
    },
    "class_type": "ImageSaverMira",
    "_meta": {
      "title": "Image Saver"
    }
  },
  "15": {
    "inputs": {
      "text1": [
        "9",
        0
      ],
      "text2": [
        "5",
        0
      ]
    },
    "class_type": "TextCombinerTwo",
    "_meta": {
      "title": "Text Combiner 2"
    }
  },
  "17": {
    "inputs": {
      "sampling": "eps",
      "zsnr": false,
      "model": [
        "6",
        0
      ]
    },
    "class_type": "ModelSamplingDiscrete",
    "_meta": {
      "title": "ModelSamplingDiscrete"
    }
  }
};

export const WORKFLOW_UNET = 
{
  "2": {
    "inputs": {
      "text": [
        "34",
        4
      ],
      "clip": [
        "50",
        0
      ]
    },
    "class_type": "CLIPTextEncode",
    "_meta": {
      "title": "CLIP Text Encode (Prompt)"
    }
  },
  "3": {
    "inputs": {
      "text": [
        "33",
        0
      ],
      "clip": [
        "50",
        0
      ]
    },
    "class_type": "CLIPTextEncode",
    "_meta": {
      "title": "CLIP Text Encode (Prompt)"
    }
  },
  "5": {
    "inputs": {
      "width": [
        "17",
        0
      ],
      "height": [
        "17",
        1
      ],
      "batch_size": 1
    },
    "class_type": "EmptyLatentImage",
    "_meta": {
      "title": "Empty Latent Image"
    }
  },
  "6": {
    "inputs": {
      "samples": [
        "36",
        0
      ],
      "vae": [
        "52",
        0
      ]
    },
    "class_type": "VAEDecode",
    "_meta": {
      "title": "VAE Decode"
    }
  },
  "13": {
    "inputs": {
      "steps": 11,
      "cfg": 1
    },
    "class_type": "StepsAndCfg",
    "_meta": {
      "title": "Steps & Cfg"
    }
  },
  "17": {
    "inputs": {
      "Width": 1024,
      "Height": 1360,
      "Batch": 1,
      "Landscape": false,
      "HiResMultiplier": 1.5
    },
    "class_type": "CanvasCreatorAdvanced",
    "_meta": {
      "title": "Create Canvas Advanced"
    }
  },
  "29": {
    "inputs": {
      "filename": "%time_%seed",
      "path": "%date",
      "extension": "png",
      "steps": [
        "13",
        0
      ],
      "cfg": [
        "13",
        1
      ],
      "modelname": "anima-preview.safetensors",
      "sampler_name": "euler_ancestral",
      "scheduler": "simple",
      "positive": [
        "32",
        0
      ],
      "negative": [
        "33",
        0
      ],
      "seed_value": 1775747588,
      "width": [
        "17",
        0
      ],
      "height": [
        "17",
        1
      ],
      "lossless_webp": true,
      "quality_jpeg_or_webp": 100,
      "optimize_png": false,
      "counter": 0,
      "denoise": 1,
      "clip_skip": -2,
      "time_format": "%Y-%m-%d-%H%M%S",
      "save_workflow_as_json": false,
      "embed_workflow": true,
      "additional_hashes": "",
      "images": [
        "6",
        0
      ]
    },
    "class_type": "ImageSaverMira",
    "_meta": {
      "title": "Image Saver"
    }
  },
  "32": {
    "inputs": {
      "text": ""
    },
    "class_type": "TextBoxMira",
    "_meta": {
      "title": "Text Box"
    }
  },
  "33": {
    "inputs": {
      "text": ""
    },
    "class_type": "TextBoxMira",
    "_meta": {
      "title": "Text Box"
    }
  },
  "34": {
    "inputs": {
      "text": [
        "32",
        0
      ],
      "model": [
        "51",
        0
      ],
      "clip": [
        "50",
        0
      ]
    },
    "class_type": "LoRAfromText",
    "_meta": {
      "title": "LoRA Loader from Text"
    }
  },
  "36": {
    "inputs": {
      "add_noise": "enable",
      "noise_seed": 153956129556641,
      "steps": [
        "13",
        0
      ],
      "cfg": [
        "13",
        1
      ],
      "sampler_name": "er_sde",
      "scheduler": "simple",
      "start_at_step": 0,
      "end_at_step": 1000,
      "return_with_leftover_noise": "disable",
      "model": [
        "34",
        0
      ],
      "positive": [
        "2",
        0
      ],
      "negative": [
        "3",
        0
      ],
      "latent_image": [
        "5",
        0
      ]
    },
    "class_type": "KSamplerAdvanced",
    "_meta": {
      "title": "KSampler (Advanced)"
    }
  },
  "50": {
    "inputs": {
      "clip_name": "Anima\\qwen_3_06b_base.safetensors",
      "type": "stable_diffusion",
      "device": "default"
    },
    "class_type": "CLIPLoader",
    "_meta": {
      "title": "Load CLIP"
    }
  },
  "51": {
    "inputs": {
      "unet_name": "Anima\\anima-preview.safetensors",
      "weight_dtype": "default"
    },
    "class_type": "UNETLoader",
    "_meta": {
      "title": "Load Diffusion Model"
    }
  },
  "52": {
    "inputs": {
      "vae_name": "qwen_image_vae.safetensors"
    },
    "class_type": "VAELoader",
    "_meta": {
      "title": "Load VAE"
    }
  }
};
