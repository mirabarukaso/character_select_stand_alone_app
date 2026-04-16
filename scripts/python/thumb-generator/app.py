"""
SAA Character Thumbnail Generator
Streamlit UI for the full Step 1 → 2 → 3 pipeline and re-create workflow.

Dependencies:
    pip install streamlit pillow websocket-client requests
"""

import base64
import gzip
import hashlib
import html
import json
import os
import time
import uuid
from io import BytesIO
from typing import Optional
from urllib import request, parse

import streamlit as st

try:
    from PIL import Image
except ImportError:
    st.error("Pillow not installed. Run: pip install Pillow")
    st.stop()

try:
    import websocket
except ImportError:
    st.error("websocket-client not installed. Run: pip install websocket-client")
    st.stop()


# ══════════════════════════════════════════════════════════════════════════════
# UTILITY FUNCTIONS
# ══════════════════════════════════════════════════════════════════════════════

def get_md5_hash(text: str) -> str:
    h = hashlib.md5()
    h.update(text.encode("utf-8"))
    return h.hexdigest()


def escape_name(name: str) -> str:
    """Escape parentheses for prompt use (danbooru tag escaping)."""
    return name.replace("(", "\\(").replace(")", "\\)")


def load_txt_list(path: str) -> list[str]:
    """Load a newline-separated text file, stripping blanks."""
    with open(path, "r", encoding="utf-8") as f:
        return [line.strip() for line in f if line.strip()]


def load_csv_entries(path: str) -> list[tuple[str, str]]:
    """Load a name,md5 CSV. Uses rsplit so names with commas are handled safely."""
    entries = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if "," in line:
                name, md5 = line.rsplit(",", 1)
                entries.append((name.strip(), md5.strip()))
    return entries


def load_tag_assist(path: str) -> dict:
    """Load tag assist JSON. Returns empty dict if file doesn't exist or is invalid."""
    if not path:
        return {}
    try:
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
    except (json.JSONDecodeError, IOError):
        # Silently ignore any errors and return empty dict
        pass
    return {}


# ══════════════════════════════════════════════════════════════════════════════
# COMFYUI CORE  (adapted from comfyui.py)
# ══════════════════════════════════════════════════════════════════════════════

class ComfyGenerator:
    def __init__(self, server: str, client_id: str, workflow_path: str):
        self.server = server
        self.client_id = client_id
        with open(workflow_path, "r") as f:
            self.nodes = json.load(f)

    def set(self, node_id: str, key: str, value):
        self.nodes[node_id]["inputs"][key] = value

    def _fetch_image(self, filename, subfolder, ftype) -> bytes:
        params = parse.urlencode({"filename": filename, "subfolder": subfolder, "type": ftype})
        with request.urlopen(f"http://{self.server}/view?{params}") as r:
            return r.read()

    def _get_history(self, prompt_id) -> dict:
        with request.urlopen(f"http://{self.server}/history/{prompt_id}") as r:
            return json.loads(r.read())

    def _wait_done(self, ws_conn, prompt_id) -> bool:
        while True:
            out = ws_conn.recv()
            if isinstance(out, str):
                msg = json.loads(out)
                if msg.get("type") == "executing":
                    d = msg["data"]
                    if d.get("node") is None and d.get("prompt_id") == prompt_id:
                        return True

    def run(self, ws_conn) -> Optional[bytes]:
        payload = json.dumps({"prompt": self.nodes, "client_id": self.client_id}).encode()
        req = request.Request(
            f"http://{self.server}/prompt",
            data=payload,
            headers={"Content-Type": "application/json"},
        )
        prompt_id = json.loads(request.urlopen(req).read())["prompt_id"]

        if not self._wait_done(ws_conn, prompt_id):
            return None

        history = self._get_history(prompt_id).get(prompt_id, {})
        for _, node_out in history.get("outputs", {}).items():
            for img_info in node_out.get("images", []):
                return self._fetch_image(img_info["filename"], img_info["subfolder"], img_info["type"])
        return None


def comfyui_generate(
    *,
    server: str,
    workflow_path: str,
    model_type: str = "checkpoint",
    diffusion_model_type: str = "stable_diffusion",
    model: str,
    sampler: str,
    scheduler: str,
    steps: int,
    cfg: float,
    seed: int,
    width: int,
    height: int,
    positive_prompt: str,
    negative_prompt: str,
    text_encoder: str = "Anima/qwen_3_06b_base.safetensors",
    vae: str = "qwen_image_vae.safetensors",
) -> Optional[bytes]:
    """Single image generation call. Returns raw PNG/image bytes or None."""
    client_id = str(uuid.uuid4())
    ws_conn = websocket.WebSocket()
    ws_conn.connect(f"ws://{server}/ws?clientId={client_id}")
    try:
        gen = ComfyGenerator(server, client_id, workflow_path)

        if model_type == "checkpoint":
            # ── Checkpoint workflow (classic all-in-one .safetensors) ──────────
            if model and model.lower() != "default":
                gen.set("45", "ckpt_name", model)
                gen.set("29", "modelname", model)

            for nid in ("36", "37", "20", "29"):
                gen.set(nid, "sampler_name", sampler)
                gen.set(nid, "scheduler", scheduler)

        elif model_type == "diffusion":
            # ── Diffusion workflow (Flux/SD3-style, separate encoder & VAE) ───
            gen.set("50", "clip_name", text_encoder)
            gen.set("50", "type", diffusion_model_type)
            gen.set("51", "unet_name", model)
            gen.set("52", "vae_name", vae)
            
            for nid in ("36", "29"):
                gen.set(nid, "sampler_name", sampler)
                gen.set(nid, "scheduler", scheduler)

        else:
            raise ValueError(f"Unknown model_type: {model_type!r}")

        # Common parameters for both workflows
        gen.set("13", "steps", steps)
        gen.set("13", "cfg", cfg)
        gen.set("17", "Width", width)
        gen.set("17", "Height", height)
        gen.set("36", "noise_seed", seed)
        gen.set("29", "seed_value", seed)
        gen.set("32", "text", positive_prompt)
        gen.set("33", "text", negative_prompt)
            
        # Bypass Refiner
        gen.set("6", "samples", ["36", 0])

        # No hires fix: wire Image Saver directly to first VAE Decode output
        gen.set("29", "images", ["6", 0])
            
        return gen.run(ws_conn)
    finally:
        ws_conn.close()


def interrupt_comfyui(server: str):
    try:
        req = request.Request(f"http://{server}/interrupt", method="POST")
        request.urlopen(req)
    except Exception:
        pass


# ══════════════════════════════════════════════════════════════════════════════
# PIPELINE STEPS
# ══════════════════════════════════════════════════════════════════════════════

def step1_create_name_dict(char_list_path: str, output_folder: str) -> tuple[dict, str, str]:
    """
    Step 1 – Read character TXT → compute MD5 for each escaped name →
    write character_md5.json and character_md5.csv.
    Returns (name_dict, json_path, csv_path).
    """
    chars = load_txt_list(char_list_path)
    name_dict = {name: get_md5_hash(escape_name(name)) for name in chars}

    os.makedirs(output_folder, exist_ok=True)
    json_path = os.path.join(output_folder, "character_md5.json")
    csv_path = os.path.join(output_folder, "character_md5.csv")

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(name_dict, f, ensure_ascii=False, indent=4)

    with open(csv_path, "w", encoding="utf-8") as f:
        for name, md5 in name_dict.items():
            f.write(f"{name},{md5}\n")

    return name_dict, json_path, csv_path


def _generation_loop(
    entries: list[tuple[str, str]],
    thumb_folder: str,
    tag_assist: dict,
    positive_suffix: str,
    comfyui_cfg: dict,
    log_placeholder,  # Streamlit placeholder for log updates
    skip_existing: bool,
    start_index: int = 0,
) -> dict:
    """
    Run generation in main process with real-time log updates via placeholder.
    entries = list of (raw_name, md5_hash).
    start_index = the original index in the full list (for display purposes).
    
    Returns stats dict: {success, skip, error, elapsed, total}
    """
    os.makedirs(thumb_folder, exist_ok=True)
    total = len(entries)
    success_count = 0
    skip_count = 0
    error_count = 0
    start_time = time.time()
    
    log_lines = []

    log_lines.append(f"\n{'='*80}")
    log_lines.append(f"🚀 Generation started - Processing {total} characters")
    log_lines.append(f"📁 Output folder: {thumb_folder}")
    log_lines.append(f"📊 Range: Index {start_index} to {start_index + total - 1}")
    log_lines.append(f"{'='*80}\n")
    
    # Initial log display
    with log_placeholder.container():
        render_scrollable_log(log_lines, height=480)

    for i, (raw_name, md5) in enumerate(entries):
        # Check if user stopped
        if st.session_state.get("gen_stop_requested", False):
            log_lines.append(f"\n⏹️  User stopped - Completed [{start_index + i}/{start_index + total}]")
            break

        webp_path = os.path.join(thumb_folder, f"{md5}.webp")
        progress_str = f"[{start_index + i + 1:4d}/{start_index + total}]"
        
        # Pre-calculate tag display for logging
        tag_key = raw_name.lower()
        tag_display = tag_assist[tag_key] if tag_key in tag_assist else "no tag"

        if skip_existing and os.path.exists(webp_path):
            log_lines.append(f"{progress_str}  ⏭️  {raw_name}  (exists, skipped)")
            skip_count += 1
        else:
            escaped = escape_name(raw_name)
            tag = f"{tag_assist[tag_key]}," if tag_key in tag_assist else ""
            full_prompt = f"{tag}{escaped},{positive_suffix}"

            if tag_display != "no tag":
                log_lines.append(f"{progress_str}  ⚙️  Generating... '{raw_name}' [tag_assist: {tag_display}]")
            else:
                log_lines.append(f"{progress_str}  ⚙️  Generating... '{raw_name}'")
            
            # Update log display every item
            with log_placeholder.container():
                render_scrollable_log(log_lines, height=480)

            try:
                img_bytes = comfyui_generate(
                    server=comfyui_cfg["server"],
                    workflow_path=comfyui_cfg["workflow_path"],
                    model_type=comfyui_cfg.get("model_type", "checkpoint"),
                    diffusion_model_type=comfyui_cfg.get("diffusion_model_type", "stable_diffusion"),
                    model=comfyui_cfg["model"],
                    sampler=comfyui_cfg["sampler"],
                    scheduler=comfyui_cfg["scheduler"],
                    steps=comfyui_cfg["steps"],
                    cfg=comfyui_cfg["cfg"],
                    seed=comfyui_cfg["seed"],
                    width=comfyui_cfg["width"],
                    height=comfyui_cfg["height"],
                    positive_prompt=full_prompt,
                    negative_prompt=comfyui_cfg["negative"],
                    text_encoder=comfyui_cfg.get("text_encoder", ""),
                    vae=comfyui_cfg.get("vae", ""),
                )
                if img_bytes:
                    img = Image.open(BytesIO(bytes(img_bytes)))
                    orig_size = f"{img.width}x{img.height}"
                    img = img.resize(
                        (int(img.width * 0.4), int(img.height * 0.4)), Image.LANCZOS
                    )
                    new_size = f"{img.width}x{img.height}"
                    img.save(webp_path, "WEBP", quality=70, method=6)
                    file_size = os.path.getsize(webp_path) / 1024  # KB                    
                    log_lines.append(f"{progress_str}  ✅  Success: '{raw_name}' ({orig_size}→{new_size}, {file_size:.1f}KB)")
                    success_count += 1
                else:
                    log_lines.append(f"{progress_str}  ⚠️  Failed: '{raw_name}' - no image returned [tag: {tag_display}]")
                    error_count += 1
            except Exception as exc:
                log_lines.append(f"{progress_str}  ❌  Error: '{raw_name}' - {type(exc).__name__}: {str(exc)[:50]} [tag: {tag_display}]")
                error_count += 1

        if st.session_state.sleep_time > 0:
            # Sleep after each generation to reduce GPU load
            time.sleep(st.session_state.sleep_time)

    if not st.session_state.get("gen_stop_requested", False):
        elapsed = time.time() - start_time
        log_lines.append(f"\n{'='*80}")
        log_lines.append("🎉  Generation completed!")
        log_lines.append(f"📈 Statistics: Success={success_count}, Skipped={skip_count}, Failed={error_count}")
        log_lines.append(f"⏱️  Elapsed time: {elapsed:.1f}s")
        if success_count > 0:
            log_lines.append(f"⚡ Average speed: {elapsed/success_count:.1f}s/item")
        log_lines.append(f"{'='*80}\n")
    
    # Final log update
    with log_placeholder.container():
        render_scrollable_log(log_lines, height=480)
    
    return {
        "success": success_count,
        "skip": skip_count,
        "error": error_count,
        "elapsed": time.time() - start_time,
        "total": total,
        "logs": "\n".join(log_lines),
    }


def step3_package_thumbs(thumb_folder: str, csv_path: str, output_path: str, progress_callback=None) -> tuple[int, list[str]]:
    """
    Step 3 – Load webp files keyed by MD5 from CSV, gzip+base64 encode,
    bundle into a single JSON. Returns (packed_count, missing_name_list).
    
    Args:
        thumb_folder: Path to folder containing webp files
        csv_path: Path to CSV file with name,md5 entries
        output_path: Path to output JSON file
        progress_callback: Optional callable(i, total, name, status) for progress updates
    """
    entries = load_csv_entries(csv_path)
    result: dict[str, str] = {}
    missing: list[str] = []
    total = len(entries)

    for i, (name, md5) in enumerate(entries):
        webp_path = os.path.join(thumb_folder, f"{md5}.webp")
        
        if not os.path.exists(webp_path):
            missing.append(name)
            if progress_callback:
                progress_callback(i + 1, total, name, "missing")
            continue
        
        try:
            with open(webp_path, "rb") as f:
                data = f.read()
            file_size = len(data) / 1024  # KB
            result[md5] = base64.b64encode(gzip.compress(data)).decode("ascii")
            compressed_size = len(result[md5]) / 1024  # Approximate KB
            if progress_callback:
                progress_callback(i + 1, total, name, f"packed ({file_size:.1f}KB → {compressed_size:.1f}KB)")
        except Exception as e:
            if progress_callback:
                progress_callback(i + 1, total, name, f"error: {str(e)[:40]}")
            continue

    # Create output directory if it doesn't exist
    output_dir = os.path.dirname(output_path)
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)
    
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=4)

    return len(result), missing


# ══════════════════════════════════════════════════════════════════════════════
# STREAMLIT APP
# ══════════════════════════════════════════════════════════════════════════════

st.set_page_config(
    page_title="SAA Thumb Generator",
    page_icon="🎴",
    layout="wide",
    initial_sidebar_state="expanded",
)

st.markdown(
    """
    <style>
    div[data-testid="stTextArea"] textarea {font-family: monospace; font-size: 12px;}
    div[data-testid="metric-container"] {border: 1px solid #333; border-radius: 6px; padding: 8px;}
    </style>
    """,
    unsafe_allow_html=True,
)


# ── Session-state defaults ────────────────────────────────────────────────────

def _default(key, val):
    if key not in st.session_state:
        st.session_state[key] = val


# ComfyUI settings
_default("server", "127.0.0.1:8188")
_default("model_type", "checkpoint")  # "checkpoint" or "diffusion"
_default("workflow_path", "./workflow_api.json")
_default("sleep_time", 0)  # Seconds to sleep after each generation (to reduce GPU load)
_default("model", "waiIllustriousSDXL_v160.safetensors")
_default("diffusion_model_type", "stable_diffusion")  # Model type for diffusion mode
_default("text_encoder", "textencoder")
_default("vae", "vae")
_default("sampler", "euler_ancestral")
_default("scheduler", "beta")
_default("steps", 22)
_default("cfg", 7.0)
_default("seed", 42)
_default("width", 768)
_default("height", 1152)
_default(
    "positive_suffix",
    "solo, simple background, white background, straight-on, upper body, "
    "masterpiece, best quality, amazing quality",
)
_default("negative", "bad quality,worst quality,worst detail,sketch,nsfw,explicit")

# Path defaults
_default("char_list_path", "./data/character_list.txt")
_default("output_folder", "./output/")
_default("thumb_folder", "./output_thumb/")
_default("tag_assist_path", "./data/tag_assist.json")
_default("recreate_csv", "./data/recreate_chatacters.txt")
_default("recreate_thumb_folder", "./output_thumb/")

# Runtime state
_default("gen_running", False)
_default("gen_stop_requested", False)
_default("step1_result", None)
_default("log_container", None)
_default("last_gen_stats", None)  # Save completion stats


# ── Sidebar ──────────────────────────────────────────────────────────────────

with st.sidebar:
    st.title("🎴 SAA Thumb Generator")
    st.divider()
    
    # Show generation status
    if st.session_state.gen_running:
        st.warning("**Generation in Progress**", icon="⏳")
        st.caption("UI controls are locked during generation. Check tabs for live logs.")
    
    st.divider()

    with st.expander("🔌 ComfyUI Connection", expanded=True):
        st.session_state.server = st.text_input(
            "Server Address", st.session_state.server,
            disabled=st.session_state.gen_running
        )

        MODEL_TYPES = ["diffusion", "checkpoint"]
        prev_model_type = st.session_state.model_type
        st.session_state.model_type = st.selectbox(
            "Model Type",
            MODEL_TYPES,
            index=MODEL_TYPES.index(st.session_state.model_type)
            if st.session_state.model_type in MODEL_TYPES else 0,
            disabled=st.session_state.gen_running,
            help="diffusion = Flux/SD3-style separate text encoder & VAE; checkpoint = classic all-in-one .safetensors"
        )

        # Auto-update workflow path default when model type changes
        _WORKFLOW_DEFAULTS = {
            "checkpoint": "./workflow_api.json",
            "diffusion":  "./workflow_diffusion_api.json",
        }
        if st.session_state.model_type != prev_model_type:
            st.session_state.workflow_path = _WORKFLOW_DEFAULTS[st.session_state.model_type]

        st.session_state.workflow_path = st.text_input(
            "Workflow JSON Path",
            st.session_state.workflow_path,
            placeholder=_WORKFLOW_DEFAULTS[st.session_state.model_type],
            disabled=st.session_state.gen_running
        )
        st.session_state.sleep_time = st.number_input(
            "Seconds to sleep after each generation", 0.0, 30.0, float(st.session_state.sleep_time), step=0.5,
            disabled=st.session_state.gen_running
        )

    with st.expander("🎨 Generation Parameters", expanded=True):
        SAMPLERS = [
            "euler_ancestral", "euler", "euler_cfg_pp", "euler_ancestral_cfg_pp", "heun", "heunpp2",
            "dpm_2", "dpm_2_ancestral", "lms", "dpm_fast", "dpm_adaptive", "dpmpp_2s_ancestral", 
            "dpmpp_2s_ancestral_cfg_pp", "dpmpp_sde", "dpmpp_sde_gpu", "dpmpp_2m", "dpmpp_2m_cfg_pp", 
            "dpmpp_2m_sde", "dpmpp_2m_sde_gpu", "dpmpp_3m_sde", "dpmpp_3m_sde_gpu", "ddpm", "lcm",
            "ipndm", "ipndm_v", "deis", "res_multistep", "res_multistep_cfg_pp", "res_multistep_ancestral", 
            "res_multistep_ancestral_cfg_pp", "gradient_estimation", "er_sde", "seeds_2", "seeds_3"
        ]
        SCHEDULERS = [
            "normal", "karras", "exponential", "sgm_uniform", "simple", "ddim_uniform", 
            "beta", "linear_quadratic", "kl_optimal"
        ]

        col_l, col_r = st.columns(2)
        with col_l:
            st.session_state.sampler = st.selectbox(
                "Sampler",
                SAMPLERS,
                index=SAMPLERS.index(st.session_state.sampler)
                if st.session_state.sampler in SAMPLERS else 0,
                disabled=st.session_state.gen_running
            )
            st.session_state.steps = st.number_input(
                "Steps", 1, 150, int(st.session_state.steps),
                disabled=st.session_state.gen_running
            )
            st.session_state.width = st.number_input(
                "Width", 256, 2048, int(st.session_state.width), step=64,
                disabled=st.session_state.gen_running
            )
        with col_r:
            st.session_state.scheduler = st.selectbox(
                "Scheduler",
                SCHEDULERS,
                index=SCHEDULERS.index(st.session_state.scheduler)
                if st.session_state.scheduler in SCHEDULERS else 0,
                disabled=st.session_state.gen_running
            )
            st.session_state.cfg = st.number_input(
                "CFG Scale", 1.0, 30.0, float(st.session_state.cfg), step=0.5,
                disabled=st.session_state.gen_running
            )
            st.session_state.height = st.number_input(
                "Height", 256, 2048, int(st.session_state.height), step=64,
                disabled=st.session_state.gen_running
            )

        st.session_state.seed = st.number_input(
            "Seed", 0, 2**32 - 1, int(st.session_state.seed),
            disabled=st.session_state.gen_running
        )
        st.session_state.model = st.text_input(
            "Model Filename", st.session_state.model,
            disabled=st.session_state.gen_running
        )

        if st.session_state.model_type == "diffusion":
            DIFFUSION_MODEL_TYPES = ["stable_diffusion", "sd3", "cosmos", "lumia2", "chroma", "qwen_image", "hunyuan_image", "flux2"]
            st.session_state.diffusion_model_type = st.selectbox(
                "Diffusion Model Type",
                DIFFUSION_MODEL_TYPES,
                index=DIFFUSION_MODEL_TYPES.index(st.session_state.diffusion_model_type)
                if st.session_state.diffusion_model_type in DIFFUSION_MODEL_TYPES else 0,
                disabled=st.session_state.gen_running,
                help="Model type for diffusion-based generation (Flux, SD3, Cosmos, etc.)"
            )
            st.session_state.text_encoder = st.text_input(
                "Text Encoder", st.session_state.text_encoder,
                placeholder="textencoder",
                disabled=st.session_state.gen_running
            )
            st.session_state.vae = st.text_input(
                "VAE", st.session_state.vae,
                placeholder="vae",
                disabled=st.session_state.gen_running
            )

    with st.expander("📝 Prompts", expanded=False):
        st.session_state.positive_suffix = st.text_area(
            "Positive Prompt",
            st.session_state.positive_suffix,
            height=110,
            help="Appended after the character tag. Character tag is prepended automatically.",
            disabled=st.session_state.gen_running
        )
        st.session_state.negative = st.text_area(
            "Negative Prompt", st.session_state.negative, height=80,
            disabled=st.session_state.gen_running
        )

    st.divider()
    # Quick ComfyUI status check
    if st.button("🔍 Ping ComfyUI", disabled=st.session_state.gen_running):
        try:
            with request.urlopen(
                f"http://{st.session_state.server}/system_stats", timeout=3
            ) as r:
                stats = json.loads(r.read())
            st.success("✅ Connected")
            st.json(stats.get("system", {}))
        except Exception as exc:
            st.error(f"❌ Cannot reach ComfyUI: {exc}")


# ── Helper: build cfg dict ────────────────────────────────────────────────────

def get_comfyui_cfg() -> dict:
    cfg = {
        "server": st.session_state.server,
        "workflow_path": st.session_state.workflow_path,
        "model_type": st.session_state.model_type,
        "model": st.session_state.model,
        "sampler": st.session_state.sampler,
        "scheduler": st.session_state.scheduler,
        "steps": int(st.session_state.steps),
        "cfg": float(st.session_state.cfg),
        "seed": int(st.session_state.seed),
        "width": int(st.session_state.width),
        "height": int(st.session_state.height),
        "negative": st.session_state.negative,
    }
    if st.session_state.model_type == "diffusion":
        cfg["diffusion_model_type"] = st.session_state.diffusion_model_type
        cfg["text_encoder"] = st.session_state.text_encoder
        cfg["vae"] = st.session_state.vae
    return cfg


def validate_comfyui_cfg() -> list[str]:
    errs = []
    if not st.session_state.workflow_path:
        errs.append("Workflow JSON path not set (sidebar → ComfyUI Connection).")
    elif not os.path.exists(st.session_state.workflow_path):
        errs.append(f"Workflow file not found: {st.session_state.workflow_path}")
    return errs

# ══════════════════════════════════════════════════════════════════════════════
# UI CALLBACKS
# ══════════════════════════════════════════════════════════════════════════════

def cb_start_run(trigger_key: str):
    """Clicking Start triggers: locks UI and sets the execution flag for the corresponding Tab"""
    st.session_state.gen_running = True
    st.session_state.gen_stop_requested = False
    st.session_state.last_gen_stats = None
    st.session_state[trigger_key] = True

def cb_stop_run():
    """Clicking Stop triggers: interrupts the background process and resets the UI state"""
    st.session_state.gen_stop_requested = True
    st.session_state.gen_running = False
    interrupt_comfyui(st.session_state.server)


def render_scrollable_log(log_lines: list[str], height: int = 300):
    """
    Display logs in a scrollable container that auto-scrolls to bottom.
    Uses HTML <pre> tag to preserve exact formatting without Markdown parsing.
    Accepts either a list of strings or a single string.
    """
    if isinstance(log_lines, list):
            log_text = "\n".join(log_lines)
    else:
        log_text = log_lines

    escaped = html.escape(log_text).replace("\n", "<br>")
    
    # create a unique container ID based on the log content to ensure Streamlit updates it correctly
    container_id = f"log-container-{abs(hash(log_text)) % 999999}"

    st.markdown(
        f"""
        <div id="{container_id}" class="custom-log-container" style="
            border: 1px solid #333;
            border-radius: 6px;
            padding: 14px 16px;
            height: {height}px;
            overflow-y: auto;
            background-color: #0e1117;
            color: #c9d1d9;
            font-family: ui-monospace, 'Cascadia Mono', 'Segoe UI Mono', Consolas, 'Liberation Mono', monospace;
            font-size: 13px !important;
            line-height: 1.5 !important;
            white-space: pre-wrap;
            word-break: break-word;
        ">{escaped}</div>
        """,
        unsafe_allow_html=True,
    )

def render_stop_button(key: str = "stop_btn"):
    st.button(
        "⏹ Stop", 
        key=key, 
        disabled=not st.session_state.gen_running,
        on_click=cb_stop_run  # Bind callback
    )        

def start_generation(
    entries: list[tuple[str, str]],
    thumb_folder: str,
    tag_assist_path: str,
    skip_existing: bool,
    start_index: int = 0,
    count: int = -1,
):
    """
    Run generation directly in main process (synchronously).
    This allows real-time log updates and UI state management.
    Displays logs in a dedicated area that updates in real-time.
    
    Args:
        entries: List of (name, md5) tuples
        thumb_folder: Output folder for thumbnails
        tag_assist_path: Path to tag assist JSON
        skip_existing: Whether to skip existing files
        start_index: 1-based starting index
        count: Number of items to generate (-1 = all)
    """
    # Validate and convert start_index from 1-based to 0-based
    actual_start_idx = max(0, start_index - 1) if start_index > 0 else 0
    
    # Check if start index is beyond the list
    if actual_start_idx >= len(entries):
        st.error(f"❌ Start index {start_index} exceeds total count ({len(entries)}). No generation started.")
        return
    
    # Calculate end index
    remaining = len(entries) - actual_start_idx
    if count == -1 or count > remaining:
        actual_end_idx = len(entries)
    else:
        actual_end_idx = actual_start_idx + count
    
    # Extract the slice of entries to process
    entries_to_process = entries[actual_start_idx:actual_end_idx]
    
    tag_assist = load_tag_assist(tag_assist_path)
    cfg = get_comfyui_cfg()
    suffix = st.session_state.positive_suffix
    
    # Show initialization info
    col1, col2, col3, col4 = st.columns(4)
    col1.metric("Total", len(entries))
    col2.metric("To Process", len(entries_to_process))
    col3.metric("Start", start_index)
    col4.metric("Server", cfg['server'].split(':')[0])
    
    st.info(f"⏳ Generating {len(entries_to_process):,} thumbnails...")
    
    # Create a placeholder for log updates
    log_placeholder = st.empty()
    
    # Run generation synchronously (blocks until complete)
    stats = _generation_loop(
        entries_to_process, thumb_folder, tag_assist, suffix, cfg, log_placeholder, skip_existing, actual_start_idx
    )
    
    # Mark as completed and save stats
    st.session_state.gen_running = False
    st.session_state.last_gen_stats = stats
    
    # Trigger a rerun to update the UI with the latest stats and reset state
    st.rerun()  

# ─────────────────────────────────────────────────────────────────────────────
# TABS
# ─────────────────────────────────────────────────────────────────────────────

tab1, tab2, tab3, tab4 = st.tabs([
    "📋 Step 1 · Name Dict",
    "🖼️ Step 2 · Generate Thumbs",
    "📦 Step 3 · Package Thumbs",
    "🔄 Re-create Thumbs",
])

# ─────────────────────────────────────────────────────────────────────────────
# STEP 1 · create_name_dict
# ─────────────────────────────────────────────────────────────────────────────
with tab1:
    st.header("Step 1 — Create Name Dictionary")
    st.caption(
        "Reads a character list `.txt` file (one name per line), computes an MD5 hash "
        "for each escaped name, and saves the mapping as both **JSON** and **CSV**. "
        "The CSV is used by Step 3 and Re-create."
    )

    c1, c2 = st.columns(2)
    with c1:
        s1_char = st.text_input(
            "Character List TXT",
            st.session_state.char_list_path,
            placeholder="./data/character_list.txt",
            key="s1_char_input",
        )
    with c2:
        s1_out = st.text_input(
            "Output Folder (JSON + CSV saved here)",
            st.session_state.output_folder,
            placeholder="./output/",
            key="s1_out_input",
        )

    if st.button("▶ Run Step 1", type="primary"):
        errs = []
        if not s1_char or not os.path.exists(s1_char):
            errs.append("Character list TXT not found.")
        if not s1_out:
            errs.append("Output folder is required.")
        if errs:
            for e in errs:
                st.error(f"❌ {e}")
        else:
            st.session_state.char_list_path = s1_char
            st.session_state.output_folder = s1_out
            with st.spinner("Computing MD5 hashes…"):
                try:
                    name_dict, jpath, cpath = step1_create_name_dict(s1_char, s1_out)
                    st.session_state.step1_result = {
                        "dict": name_dict,
                        "json": jpath,
                        "csv": cpath,
                    }
                    st.success(f"✅ {len(name_dict):,} characters processed.")
                except Exception as exc:
                    st.error(f"Error: {exc}")

    if st.session_state.step1_result:
        r = st.session_state.step1_result
        m1, m2, m3 = st.columns(3)
        m1.metric("Total Characters", f"{len(r['dict']):,}")
        m2.metric("JSON", "✅ saved")
        m3.metric("CSV", "✅ saved")

        st.code(f"JSON → {r['json']}\nCSV  → {r['csv']}")

        with st.expander("🔍 Preview first 30 entries"):
            rows = list(r["dict"].items())[:30]
            col_h1, col_h2 = st.columns([3, 2])
            col_h1.markdown("**Character Name**")
            col_h2.markdown("**MD5 Hash**")
            for name, md5 in rows:
                ca, cb = st.columns([3, 2])
                ca.text(name)
                cb.code(md5, language=None)
            if len(r["dict"]) > 30:
                st.caption(f"… and {len(r['dict']) - 30:,} more entries")


# ─────────────────────────────────────────────────────────────────────────────
# STEP 2 · character_thumb_create
# ─────────────────────────────────────────────────────────────────────────────
with tab2:
    st.header("Step 2 — Generate Character Thumbnails")
    st.caption(
        "Iterates through the same character TXT list, builds a prompt for each character "
        "(optionally prepending tag-assist tags), calls ComfyUI, resizes to 40 %, and saves "
        "as `<md5>.webp`.  Already-existing files can be skipped."
    )

    c1, c2 = st.columns(2)
    with c1:
        s2_char = st.text_input(
            "Character List TXT",
            st.session_state.char_list_path,
            placeholder="./data/character_list.txt",
            key="s2_char_input",
        )
        s2_tag = st.text_input(
            "Tag Assist JSON (optional)",
            st.session_state.tag_assist_path,
            placeholder="./data/tag_assist.json",
            key="s2_tag_input",
        )
    with c2:
        s2_thumb = st.text_input(
            "Thumb Output Folder",
            st.session_state.thumb_folder,
            placeholder="./output_thumb/",
            key="s2_thumb_input",
        )
        s2_skip = st.checkbox("⏭ Skip already-generated files", value=True)

    # Index range controls
    st.markdown("**📍 Generation Range** *(optional — leave as default to generate all)*")
    col_idx1, col_idx2 = st.columns(2)
    with col_idx1:
        s2_start_idx = st.number_input(
            "Start Index (1-based, min 1)",
            min_value=1,
            value=1,
            step=1,
            help="The first character index to generate (1-based). Index 1 = first character.",
            key="s2_start_idx",
        )
    with col_idx2:
        s2_count = st.number_input(
            "Generate Count (-1 for all)",
            min_value=-1,
            value=-1,
            step=1,
            help="-1 or value > remaining = generate all remaining characters",
            key="s2_count",
        )

    # Show summary of what will run
    if s2_char and os.path.exists(s2_char):
        try:
            preview_list = load_txt_list(s2_char)
            
            # Calculate actual range
            actual_start = max(0, s2_start_idx - 1)
            if actual_start >= len(preview_list):
                st.error(f"❌ Start index {s2_start_idx} exceeds total ({len(preview_list)})")
            else:
                remaining = len(preview_list) - actual_start
                if s2_count == -1 or s2_count > remaining:
                    actual_count = remaining
                else:
                    actual_count = s2_count
                actual_end = actual_start + actual_count
                
                already_done = 0
                if s2_thumb and os.path.exists(s2_thumb):
                    for n in preview_list[actual_start:actual_end]:
                        md5 = get_md5_hash(escape_name(n))
                        if os.path.exists(os.path.join(s2_thumb, f"{md5}.webp")):
                            already_done += 1
                pm1, pm2, pm3, pm4 = st.columns(4)
                pm1.metric("Total in list", len(preview_list))
                pm2.metric("Range start", s2_start_idx)
                pm3.metric("To generate", actual_count)
                pm4.metric("Already done", already_done)
        except Exception:
            pass

    col_b1, col_b2 = st.columns([3, 1])
    with col_b1:
        st.button(
            "▶ Start Generation",
            type="primary",
            disabled=st.session_state.gen_running,
            key="s2_start",
            on_click=cb_start_run,
            args=("trigger_tab2",)  # Trigger
        )
    with col_b2:
        render_stop_button("s2_stop")

    # Display last generation stats if available
    if st.session_state.last_gen_stats:
        stats = st.session_state.last_gen_stats
        st.success("Generation Completed!", icon="✅")
        stat_col1, stat_col2, stat_col3, stat_col4 = st.columns(4)
        stat_col1.metric("✅ Success", f"{stats['success']:,}")
        stat_col2.metric("⏭️ Skipped", f"{stats['skip']:,}")
        stat_col3.metric("❌ Failed", f"{stats['error']:,}")
        stat_col4.metric("⏱️ Time", f"{stats['elapsed']:.1f}s")
        
        if "logs" in stats:
            render_scrollable_log(stats["logs"], height=480)

    if st.session_state.get("trigger_tab2", False):
        st.session_state["trigger_tab2"] = False # De-reset trigger
        
        errs = validate_comfyui_cfg()
        if not s2_char or not os.path.exists(s2_char):
            errs.append("Character list TXT not found.")
        if not s2_thumb:
            errs.append("Thumb output folder required.")
            
        if errs:
            for e in errs:
                st.error(f"❌ {e}")
            # if there are errors, ensure we reset the running state so UI doesn't get stuck
            st.session_state.gen_running = False
            st.rerun()
        else:
            st.session_state.char_list_path = s2_char
            st.session_state.thumb_folder = s2_thumb
            st.session_state.tag_assist_path = s2_tag
            chars = load_txt_list(s2_char)
            entries = [(n, get_md5_hash(escape_name(n))) for n in chars]
            
            start_generation(
                entries, 
                s2_thumb, 
                s2_tag, 
                s2_skip,
                start_index=s2_start_idx,
                count=s2_count,
            )


# ─────────────────────────────────────────────────────────────────────────────
# STEP 3 · create_thumb
# ─────────────────────────────────────────────────────────────────────────────
with tab3:
    st.header("Step 3 — Package Thumbnails")
    st.caption(
        "Reads every `<md5>.webp` listed in the Step-1 CSV, gzip-compresses and "
        "base64-encodes each image, then bundles everything into a single JSON file "
        "(`character_thumbs.json`). Reports any missing images."
    )

    # Display last execution stats if available
    if st.session_state.last_gen_stats and st.session_state.last_gen_stats.get("step3_mode"):
        stats = st.session_state.last_gen_stats
        st.success("Packaging Completed!", icon="✅")
        stat_col1, stat_col2, stat_col3 = st.columns(3)
        stat_col1.metric("✅ Packed", f"{stats['success']:,}")
        stat_col2.metric("⚠️ Missing", f"{stats['skip']:,}")
        stat_col3.metric("⏱️ Time", f"{stats['elapsed']:.1f}s")
        
        if "logs" in stats:
            render_scrollable_log(stats["logs"], height=480)

    # Auto-fill from step 1 results
    default_csv = (
        os.path.join(st.session_state.output_folder, "character_md5.csv")
        if st.session_state.output_folder else ""
    )
    default_out = (
        os.path.join(st.session_state.output_folder, "character_thumbs.json")
        if st.session_state.output_folder else ""
    )

    c1, c2 = st.columns(2)
    with c1:
        s3_thumb = st.text_input(
            "Thumb Folder (webp files)",
            st.session_state.thumb_folder,
            placeholder="./output_thumb/",
            key="s3_thumb_input",
        )
        s3_csv = st.text_input(
            "CSV from Step 1",
            default_csv,
            placeholder="./output/character_md5.csv",
            key="s3_csv_input",
        )
    with c2:
        s3_out = st.text_input(
            "Output JSON Path",
            default_out,
            placeholder="./output/character_thumbs.json",
            key="s3_out_input",
        )

    # Preview coverage before running
    if s3_thumb and os.path.exists(s3_thumb) and s3_csv and os.path.exists(s3_csv):
        try:
            entries_preview = load_csv_entries(s3_csv)
            found_count = sum(
                1 for _, md5 in entries_preview
                if os.path.exists(os.path.join(s3_thumb, f"{md5}.webp"))
            )
            pp1, pp2 = st.columns(2)
            pp1.metric("Listed in CSV", len(entries_preview))
            pp2.metric("WebP files found", found_count,
                       delta=f"missing: {len(entries_preview)-found_count}" if found_count < len(entries_preview) else None,
                       delta_color="inverse")
        except Exception:
            pass

    st.button(
        "▶ Run Step 3",
        type="primary",
        disabled=st.session_state.gen_running,
        key="s3_run",
        on_click=cb_start_run,
        args=("trigger_tab3",)
    )

    if st.session_state.get("trigger_tab3", False):
        st.session_state["trigger_tab3"] = False  # De-reset trigger
        
        errs = []
        if not s3_thumb or not os.path.exists(s3_thumb):
            errs.append("Thumb folder not found.")
        if not s3_csv or not os.path.exists(s3_csv):
            errs.append("CSV file not found.")
        if not s3_out:
            errs.append("Output JSON path required.")
        
        if errs:
            for e in errs:
                st.error(f"❌ {e}")
            # Reset running state and rerun if validation fails
            st.session_state.gen_running = False
            st.rerun()
        else:
            # Create a placeholder for live log updates
            log_placeholder = st.empty()
            
            log_lines = []
            log_lines.append(f"\n{'='*80}")
            log_lines.append("🚀 Packaging started - Processing files...")
            log_lines.append(f"{'='*80}\n")
            
            # Initial log display
            with log_placeholder.container():
                render_scrollable_log(log_lines, height=300)
            
            # Track execution time
            start_time = time.time()
            
            # Define progress callback
            def s3_progress_callback(current, total, name, status):
                log_lines.append(f"[{current:4d}/{total}] {name:50s} {status}")
                # Update log display every 10 items to avoid too many updates
                if current % 10 == 0 or current == total:
                    with log_placeholder.container():
                        render_scrollable_log(log_lines, height=300)
            
            try:
                packed, missing = step3_package_thumbs(s3_thumb, s3_csv, s3_out, progress_callback=s3_progress_callback)
                elapsed = time.time() - start_time
                st.session_state.gen_running = False
                
                # Final log update
                log_lines.append(f"\n{'='*80}")
                log_lines.append("✅ Packaging completed!")
                log_lines.append(f"{'='*80}\n")
                with log_placeholder.container():
                    render_scrollable_log(log_lines, height=300)
                
                st.success(f"✅ Packaged {packed:,} thumbnails → `{s3_out}`")

                rm1, rm2, rm3 = st.columns(3)
                rm1.metric("Packed", f"{packed:,}")
                rm2.metric("Missing", f"{len(missing):,}",
                           delta=f"-{len(missing)}" if missing else None,
                           delta_color="inverse")
                rm3.metric("Time", f"{elapsed:.1f}s")

                if missing:
                    with st.expander(f"⚠️ {len(missing)} missing characters (no webp found)"):
                        st.text("\n".join(missing[:200]))
                        if len(missing) > 200:
                            st.caption(f"… {len(missing)-200} more")
                    # Offer to auto-fill missing TXT for re-create
                    missing_txt_path = os.path.join(
                        os.path.dirname(s3_out), "recreate_chatacters.txt"
                    )
                    # Create directory if it doesn't exist
                    missing_dir = os.path.dirname(missing_txt_path)
                    if missing_dir:
                        os.makedirs(missing_dir, exist_ok=True)
                    
                    missing_entries = load_csv_entries(s3_csv)
                    missing_set = set(missing)
                    with open(missing_txt_path, "w", encoding="utf-8") as mf:
                        for name, md5 in missing_entries:
                            if name in missing_set:
                                mf.write(f"{name}\n")
                    st.info(
                        f"Missing list saved to `{missing_txt_path}` — "
                        "load it in the **Re-create Thumbs** tab."
                    )
                    st.session_state.recreate_csv = missing_txt_path
                
                # Save stats for display on next rerun
                st.session_state.last_gen_stats = {
                    "step3_mode": True,
                    "success": packed,
                    "total": len(missing) + packed,
                    "skip": len(missing),
                    "error": 0,
                    "elapsed": elapsed,
                    "logs": "\n".join(log_lines),
                }
                
                # Rerun to update UI state after completion
                st.rerun()
            except Exception as exc:
                elapsed = time.time() - start_time
                st.session_state.gen_running = False
                log_lines.append(f"\n❌ Error: {exc}")
                with log_placeholder.container():
                    render_scrollable_log(log_lines, height=300)
                st.error(f"Error: {exc}")
                
                # Save error logs
                st.session_state.last_gen_stats = {
                    "step3_mode": True,
                    "success": packed,
                    "total": len(missing) + packed,
                    "skip": len(missing),
                    "error": 1,
                    "elapsed": elapsed,
                    "logs": "\n".join(log_lines),
                }
                st.rerun()


# ─────────────────────────────────────────────────────────────────────────────
# RE-CREATE THUMBS
# ─────────────────────────────────────────────────────────────────────────────
with tab4:
    st.header("Re-create Thumbnails")
    st.caption(
        "Generate (or regenerate) thumbnails for a **specific subset** of characters "
        "using a name list `.txt` file (one name per line). Typically used for the missing list "
        "exported by Step 3, or any custom selection. You can also paste entries directly."
    )

    c1, c2 = st.columns(2)
    with c1:
        s4_txt = st.text_input(
            "Source TXT (character names, one per line)",
            st.session_state.recreate_csv,
            placeholder="./data/recreate_chatacters.txt",
            key="s4_txt_input",
        )
        s4_tag = st.text_input(
            "Tag Assist JSON (optional)",
            st.session_state.tag_assist_path,
            placeholder="./data/tag_assist.json",
            key="s4_tag_input",
        )
    with c2:
        s4_thumb = st.text_input(
            "Thumb Output Folder",
            st.session_state.recreate_thumb_folder or st.session_state.thumb_folder,
            placeholder="./output_thumb/",
            key="s4_thumb_input",
        )
        s4_overwrite = st.checkbox(
            "Overwrite existing files",
            value=True,
            help="When unchecked, characters whose webp already exists are skipped.",
        )

    st.markdown("**Manual Entry** *(optional — paste extra character names here, one per line)*")
    s4_manual = st.text_area(
        "Character names — one per line",
        height=90,
        placeholder="2b (nier automata)\n9s (nier automata)\n…",
        key="s4_manual_input",
    )

    col_b1, col_b2 = st.columns([3, 1])
    with col_b1:
        st.button(
            "▶ Start Re-create",
            type="primary",
            disabled=st.session_state.gen_running,
            key="s4_start",
            on_click=cb_start_run,
            args=("trigger_tab4",)
        )
    with col_b2:
        render_stop_button("s4_stop")

    if st.session_state.last_gen_stats and not st.session_state.last_gen_stats.get("step3_mode"):
        stats = st.session_state.last_gen_stats
        if stats.get("error", 0) == 0 and stats.get("success", 0) + stats.get("skip", 0) > 0:
            st.success("Re-create Completed!", icon="✅")
        else:
            st.error("Re-create Finished with issues", icon="⚠️")
        
        stat_col1, stat_col2, stat_col3, stat_col4 = st.columns(4)
        stat_col1.metric("✅ Success", f"{stats.get('success', 0):,}")
        stat_col2.metric("⏭️ Skipped", f"{stats.get('skip', 0):,}")
        stat_col3.metric("❌ Failed", f"{stats.get('error', 0):,}")
        stat_col4.metric("⏱️ Time", f"{stats.get('elapsed', 0):.1f}s")
        
        if "logs" in stats and stats["logs"]:
            render_scrollable_log(stats["logs"], height=480)

    if st.session_state.get("trigger_tab4", False):
        st.session_state["trigger_tab4"] = False
        
        log_lines = []
        log_lines.append(f"\n{'='*80}")
        log_lines.append("🚀 Re-create Thumbnails started")
        log_lines.append(f"{'='*80}\n")
        
        errs = validate_comfyui_cfg()
        entries: list[tuple[str, str]] = []

        # Load from TXT file
        if s4_txt:
            if not os.path.exists(s4_txt):
                errs.append(f"TXT file not found: {s4_txt}")
            else:
                names = load_txt_list(s4_txt)
                for name in names:
                    md5 = get_md5_hash(escape_name(name))
                    entries.append((name, md5))

        # Load from manual input
        if s4_manual.strip():
            for line in s4_manual.strip().splitlines():
                line = line.strip()
                if line:
                    md5 = get_md5_hash(escape_name(line))
                    entries.append((line, md5))

        if not entries:
            errs.append("No entries found — check TXT file or manual input.")
        if not s4_thumb:
            errs.append("Thumb output folder required.")

        if errs:
            for e in errs:
                log_lines.append(f"❌ {e}")
            log_lines.append("\n" + "="*80)
            log_lines.append("⛔ Re-create failed due to validation errors")
            log_lines.append("="*80)
            
            st.session_state.last_gen_stats = {
                "success": 0,
                "skip": 0,
                "error": len(errs),
                "elapsed": 0.0,
                "total": 0,
                "logs": "\n".join(log_lines),
            }
            st.session_state.gen_running = False
            st.error("Validation failed. See logs below.")
            st.rerun()
            
        else:
            st.session_state.recreate_csv = s4_txt
            st.session_state.recreate_thumb_folder = s4_thumb
            st.session_state.tag_assist_path = s4_tag
            
            # Deduplicate while preserving order
            seen: set[str] = set()
            deduped = []
            for name, md5 in entries:
                if md5 not in seen:
                    seen.add(md5)
                    deduped.append((name, md5))
            
            start_generation(deduped, s4_thumb, s4_tag, not s4_overwrite)