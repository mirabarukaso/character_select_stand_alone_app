import streamlit as st
import json
import os
import math
import csv

# ================= Config and Constants =================
PAGE_SIZE = 20
IMAGE_DIR_160 = "thumb_image_v160"
IMAGE_DIR_NEW = "thumb_image_anima"
FILE_MD5 = "data/waiANIMA_v10Base10_character_md5.json"
FILE_TAG = "data/waiANIMA_v10Base10_tag_assist.json"
FILE_CSV = "data/waiANIMA_v10Base10_characters.csv"
FILE_REWORK = "output/rework.json"

OPTIONS = ["Keep", "Rework", "Remove", "NSFW", "TagChange", "Other"]

# ================= Core Functions =================

def load_json(filepath):
    if os.path.exists(filepath):
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}

def load_character_csv(filepath):
    """Load CSV and return a dictionary mapping English names to Chinese names."""
    mapping = {}
    if os.path.exists(filepath):
        with open(filepath, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            for row in reader:
                if len(row) >= 2:
                    # Assume format: Chinese,English
                    mapping[row[1].strip()] = row[0].strip()
    return mapping

def save_rework_file():
    data_to_save = {k: v for k, v in st.session_state.rework_data.items() if v != "Keep"}
    with open(FILE_REWORK, 'w', encoding='utf-8') as f:
        json.dump(data_to_save, f, ensure_ascii=False, indent=4)

def on_radio_change(char_name):
    key = f"radio_{char_name}"
    new_val = st.session_state[key]
    st.session_state.rework_data[char_name] = new_val
    save_rework_file()
    # Note: if the selected filters no longer match after changing an option,
    # the item will disappear after the page rerenders.

def reset_page():
    """Reset to the first page when filter criteria change."""
    st.session_state.current_page = 1

# --- Pagination callback functions ---
def prev_page():
    if st.session_state.current_page > 1:
        st.session_state.current_page -= 1

def next_page():
    st.session_state.current_page += 1

def jump_to_page():
    st.session_state.current_page = st.session_state.page_input_val

# ================= Initialization and loading =================

st.set_page_config(layout="wide", page_title="SAA Character Comparison")

# Place an anchor at the top of the page for returning to top
st.markdown("<div id='linkto_top'></div>", unsafe_allow_html=True)

if 'data_loaded' not in st.session_state:
    md5_data = load_json(FILE_MD5)
    tag_data = load_json(FILE_TAG)
    rework_data = load_json(FILE_REWORK)
    name_map = load_character_csv(FILE_CSV)  # Load Chinese name mapping
    
    char_list = []
    for en_name, md5_val in md5_data.items():
        char_list.append({
            'en_name': en_name,
            'cn_name': name_map.get(en_name, "Unknown CN Name"),  # Show unknown if missing
            'md5': md5_val,
            'has_tag': en_name in tag_data
        })
    # Sort by English name
    char_list.sort(key=lambda x: x['en_name'])
    
    st.session_state.char_list = char_list
    st.session_state.rework_data = rework_data
    st.session_state.data_loaded = True

if 'current_page' not in st.session_state:
    st.session_state.current_page = 1

# ================= UI rendering and filtering logic =================

st.title("🖼️ SAA Character Comparison")

# Top status bar and filter controls
col_top_status, col_top_cfg = st.columns([3, 1])

# --- Change 1: place a multiselect in the upper right ---
with col_top_cfg:
    selected_filters = st.multiselect(
        "🔍 Filter by status (leave blank to show all)",
        options=OPTIONS,
        default=[],
        on_change=reset_page,  # Reset page when filter changes
        key="filter_multiselect"
    )

# --- Change 2: core filtering logic ---
# Build the filtered_list based on the selected filters
# 1. If selected_filters is empty, show all
# 2. Otherwise, include items whose current status matches the filter
filtered_list = []
for item in st.session_state.char_list:
    # Get the current status for this character (default to "Keep" if unset)
    current_status = st.session_state.rework_data.get(item['en_name'], "Keep")
    
    if not selected_filters or current_status in selected_filters:
        filtered_list.append(item)

# ================= Pagination calculation (based on filtered_list) =================

total_items = len(filtered_list)
total_pages = math.ceil(total_items / PAGE_SIZE) if total_items > 0 else 1

# Prevent current page from going out of range (for example, filtering down to 1 page while the current page was 5)
if st.session_state.current_page > total_pages: 
    st.session_state.current_page = total_pages
if st.session_state.current_page < 1: 
    st.session_state.current_page = 1

current_page = st.session_state.current_page
start_idx = (current_page - 1) * PAGE_SIZE
end_idx = start_idx + PAGE_SIZE
current_batch = filtered_list[start_idx:end_idx]

# --- Render status information ---
with col_top_status:
    filter_msg = f" | Filter: {','.join(selected_filters)}" if selected_filters else " | Showing all"
    st.info(f"Progress: Page {current_page} / {total_pages} ({total_items} total results{filter_msg})")

# List header
h1, h2, h3, h4 = st.columns([2, 2, 2, 3])
h1.markdown("**Character Info (CN/EN/MD5)**")
h2.markdown("**V160 Preview**")
h3.markdown("**Anima Preview**")
h4.markdown("**Review Status**")
st.divider()

if total_items == 0:
    st.warning("No items match the filter criteria.")

# --- Render each row in a loop ---
for item in current_batch:
    en_name = item['en_name']
    cn_name = item['cn_name']
    md5_val = item['md5']
    
    col_info, col_img1, col_img2, col_ctrl = st.columns([2, 2, 2, 3])
    
    # 1. Three-line display
    with col_info:
        st.markdown(f"**{cn_name}**")
        st.markdown(f"<small>{en_name}</small>", unsafe_allow_html=True)
        st.code(md5_val, language=None)
    
    # 2. Image paths
    img_path_120 = os.path.join(IMAGE_DIR_160, f"{md5_val}.webp")
    img_path_160 = os.path.join(IMAGE_DIR_NEW, f"{md5_val}.webp")
    
    with col_img1:
        if os.path.exists(img_path_120):
            st.image(img_path_120, width=180)
        else:
            st.warning("120 missing")
            
    with col_img2:
        if os.path.exists(img_path_160):
            st.image(img_path_160, width=180)
        else:
            st.warning("160 missing")
            
    # 3. Controls area
    with col_ctrl:
        tag_status = "✅ Yes" if item['has_tag'] else "❌ No"
        st.write(f"Contains compensation tag: {tag_status}")
        
        current_status = st.session_state.rework_data.get(en_name, "Keep")
        # Fallback in case the JSON contains invalid values not in OPTIONS
        if current_status not in OPTIONS: current_status = "Keep"
        
        st.radio(
            f"Action for {en_name}",
            OPTIONS,
            key=f"radio_{en_name}",
            index=OPTIONS.index(current_status),
            horizontal=True,
            on_change=on_radio_change,
            args=(en_name,),
            label_visibility="collapsed"
        )
    st.divider()

# ================= Bottom pagination area =================

st.markdown("### 📄 Pagination Controls")
b_prev, b_info, b_next, b_jump = st.columns([1, 2, 1, 2])

with b_prev:
    st.button("⬅️ Previous Page", on_click=prev_page, disabled=(current_page <= 1))

with b_info:
    st.markdown(f"<div style='text-align: center; line-height: 2.5;'>Page {current_page} / {total_pages}</div>", unsafe_allow_html=True)

with b_next:
    st.button("Next Page ➡️", on_click=next_page, disabled=(current_page >= total_pages))

with b_jump:
    # Dynamically adjust max_value to prevent jumping to a page that doesn't exist
    st.number_input("Jump to", min_value=1, max_value=total_pages if total_pages > 0 else 1, value=current_page, key="page_input_val", on_change=jump_to_page)