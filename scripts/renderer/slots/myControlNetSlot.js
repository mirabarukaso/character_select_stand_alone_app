import { mySimpleList } from '../components/myDropdown.js';
import { setupTextbox } from '../components/myTextbox.js';
import { generateGUID } from './myLoRASlot.js'
import { generateControlnetImage } from '../generate.js';
import { sendWebSocketMessage } from '../../../webserver/front/wsRequest.js';
import { resizeImageToControlNetResolution } from '../components/imageInfoUtils.js';

const controlNetValuesComfyUI = [
    "none",
    "AnimeFace_SemSegPreprocessor",
    "AnyLineArtPreprocessor_aux",
    "BinaryPreprocessor",
    "CannyEdgePreprocessor",
    "ColorPreprocessor",
    "DensePosePreprocessor",
    "DepthAnythingPreprocessor",
    "Zoe_DepthAnythingPreprocessor",
    "DepthAnythingV2Preprocessor",
    "DSINE-NormalMapPreprocessor",
    "DWPreprocessor",
    "AnimalPosePreprocessor",
    "HEDPreprocessor",
    "FakeScribblePreprocessor",
    "LeReS-DepthMapPreprocessor",
    "LineArtPreprocessor",
    "AnimeLineArtPreprocessor",
    "LineartStandardPreprocessor",
    "Manga2Anime_LineArt_Preprocessor",
    "MediaPipe-FaceMeshPreprocessor",
    "MeshGraphormer-DepthMapPreprocessor",
    "Metric3D-DepthMapPreprocessor",
    "Metric3D-NormalMapPreprocessor",
    "MiDaS-NormalMapPreprocessor",
    "MiDaS-DepthMapPreprocessor",
    "M-LSDPreprocessor",
    "BAE-NormalMapPreprocessor",
    "OneFormer-COCO-SemSegPreprocessor",
    "OneFormer-ADE20K-SemSegPreprocessor",
    "OpenposePreprocessor",
    "PiDiNetPreprocessor",
    "PyraCannyPreprocessor",
    "ImageLuminanceDetector",
    "ImageIntensityDetector",
    "ScribblePreprocessor",
    "Scribble_XDoG_Preprocessor",
    "Scribble_PiDiNet_Preprocessor",
    "SAMPreprocessor",
    "ShufflePreprocessor",
    "TEEDPreprocessor",
    "TilePreprocessor",
    "TTPlanet_TileGF_Preprocessor",
    "TTPlanet_TileSimple_Preprocessor",
    "UniFormer-SemSegPreprocessor",
    "SemSegPreprocessor",
    "Zoe-DepthMapPreprocessor"
];

const controlNetValuesWebUI = [
    "none",
    "None",
    "ip-adapter-auto",
    "tile_resample",
    "pidinet",
    "oneformer_ade20k",
    "pidinet_scribble",
    "revision_clipvision",
    "reference_only",
    "recolor_luminance",
    "openpose_full",
    "normal_bae",
    "mlsd",
    "lineart_standard",
    "ip-adapter_clip_sd15",
    "inpaint_only",
    "depth",
    "canny",
    "invert",
    "tile_colorfix+sharp",
    "tile_colorfix",
    "threshold",
    "clip_vision",
    "pidinet_sketch",
    "color",
    "softedge_teed",
    "pidinet_safe",
    "hed_safe",
    "hed",
    "softedge_anyline",
    "shuffle",
    "segmentation",
    "oneformer_coco",
    "anime_face_segment",
    "scribble_xdog",
    "scribble_hed",
    "revision_ignore_prompt",
    "reference_adain+attn",
    "reference_adain",
    "recolor_intensity",
    "openpose_hand",
    "openpose_faceonly",
    "openpose_face",
    "openpose",
    "normal_map",
    "normal_dsine",
    "mobile_sam",
    "mediapipe_face",
    "lineart",
    "lineart_coarse",
    "lineart_anime_denoise",
    "lineart_anime",
    "ip-adapter_pulid",
    "ip-adapter_face_id_plus",
    "ip-adapter_face_id",
    "ip-adapter_clip_sdxl_plus_vith",
    "ip-adapter_clip_sdxl",
    "instant_id_face_keypoints",
    "instant_id_face_embedding",
    "inpaint_only+lama",
    "inpaint",
    "facexlib",
    "dw_openpose_full",
    "depth_zoe",
    "depth_leres++",
    "depth_leres",
    "depth_hand_refiner",
    "depth_anything_v2",
    "depth_anything",
    "densepose_parula",
    "densepose",
    "blur_gaussian",
    "animal_openpose"
];

let instanceControlNetSlotManager = null;

function addEvent(candidateRow, subClassName){
    const SETTINGS = globalThis.globalSettings;
    const FILES = globalThis.cachedFiles;
    const LANG = FILES.language[SETTINGS.language];

    const imageClass = candidateRow.querySelector(`.${subClassName}`);
    if(imageClass){
        imageClass.addEventListener('click', () => {
            globalThis.overlay.custom.createCustomOverlay(
                imageClass.src, LANG.message_controlnet_custom_overlay, 512, 'left', 'left', 'Controlnet');
        });
    }
}

function createControlNetSlotsFromValues(slotManager, slotValues, options = {}) {
    const { validateControlNet = true, clearSlots = true } = options;

    const SETTINGS = globalThis.globalSettings;
    const FILES = globalThis.cachedFiles;
    const LANG = FILES.language[SETTINGS.language];

    if (clearSlots) {
        const slots = slotManager.getSlots();
        for (const slotClass of slots) {
            slotManager.delSlot(slotClass);
        }
    }

    for (const [
        preProcessModel, preProcessResolution,
        slot_enable, postModel, postProcessStrength, postProcessStart, postProcessEnd,
        pre_image, pre_image_after, pre_image_base64, pre_image_after_base64
        ] of slotValues) {
        if (validateControlNet) {
            if (!getControlNetListWithProcessorList().includes(preProcessModel)) {
                console.warn(`Pre-Process Model "${preProcessModel}" not found, skipping`);
                continue;
            }

            if (!FILES.controlnetList.includes(postModel)) {
                console.warn(`Post-Process Model "${postModel}" not found, skipping`);
                continue;
            }
        }

        const className = slotManager.addSlot(pre_image_base64, pre_image_after_base64);
        const slot = slotManager.slotIndex.get(className);
        if (!slot) continue;

        slot.pre_image = pre_image || null;
        slot.pre_image_after = pre_image_after || null;
        slot.pre_image_base64 = pre_image_base64 || null;
        slot.pre_image_after_base64 = pre_image_after_base64 || null;

        requestAnimationFrame(() => {
            const preProcessModelComponent = mySimpleList(
                slot.itemClasses.pre_process_model,
                LANG.api_controlnet_pre_process_model,
                getControlNetListWithProcessorList(),
                null,
                15,
                true,
                false
            );
            preProcessModelComponent.updateDefaults(preProcessModel);
            slot.items.set(slot.itemClasses.pre_process_model, () => preProcessModelComponent);
            slotManager.componentInstances.set(`${className}-${slot.itemClasses.pre_process_model}`, preProcessModelComponent);

            const preProcessResolutionComponent = setupTextbox(
                slot.itemClasses.pre_process_resolution,
                LANG.api_controlnet_pre_process_resolution,
                { value: preProcessResolution, defaultTextColor: 'rgb(179,157,219)', maxLines: 1 },
                false,
                null,
                false,
                true
            );
            slot.items.set(slot.itemClasses.pre_process_resolution, () => preProcessResolutionComponent);
            slotManager.componentInstances.set(`${className}-${slot.itemClasses.pre_process_resolution}`, preProcessResolutionComponent);

            const postProcessComponent = mySimpleList(
                slot.itemClasses.slot_enable,
                LANG.api_controlnet_slot_enable,
                ['On', 'Post', 'Off'],
                null,
                5,
                false,
                false
            );
            postProcessComponent.updateDefaults(slot_enable);
            slot.items.set(slot.itemClasses.slot_enable, () => postProcessComponent);
            slotManager.componentInstances.set(`${className}-${slot.itemClasses.slot_enable}`, postProcessComponent);

            const controlnetList = [];
            for (const controlnet of FILES.controlnetList) {
                if (controlnet.startsWith('CV->')) {
                    continue;
                }
                controlnetList.push(controlnet);
            }

            const postModelComponent = mySimpleList(
                slot.itemClasses.post_model,
                LANG.api_controlnet_post_process_model,
                controlnetList,
                null,
                15,
                true,
                false
            );
            postModelComponent.updateDefaults(postModel);
            slot.items.set(slot.itemClasses.post_model, () => postModelComponent);
            slotManager.componentInstances.set(`${className}-${slot.itemClasses.post_model}`, postModelComponent);

            const postProcessStrengthComponent = setupTextbox(
                slot.itemClasses.post_process_strength,
                LANG.api_controlnet_post_process_strength,
                { value: postProcessStrength, defaultTextColor: 'rgb(255,213,0)', maxLines: 1 },
                false,
                null,
                false,
                true
            );
            slot.items.set(slot.itemClasses.post_process_strength, () => postProcessStrengthComponent);
            slotManager.componentInstances.set(`${className}-${slot.itemClasses.post_process_strength}`, postProcessStrengthComponent);

            const postProcessStartComponent = setupTextbox(
                slot.itemClasses.post_process_start,
                LANG.api_controlnet_post_process_start,
                { value: postProcessStart, defaultTextColor: 'rgb(255,213,0)', maxLines: 1 },
                false,
                null,
                false,
                true
            );
            slot.items.set(slot.itemClasses.post_process_start, () => postProcessStartComponent);
            slotManager.componentInstances.set(`${className}-${slot.itemClasses.post_process_start}`, postProcessStartComponent);

            const postProcessEndComponent = setupTextbox(
                slot.itemClasses.post_process_end,
                LANG.api_controlnet_post_process_end,
                { value: postProcessEnd, defaultTextColor: 'rgb(255,213,0)', maxLines: 1 },
                false,
                null,
                false,
                true
            );
            slot.items.set(slot.itemClasses.post_process_end, () => postProcessEndComponent);
            slotManager.componentInstances.set(`${className}-${slot.itemClasses.post_process_end}`, postProcessEndComponent);
        });
    }
}

class ControlNetSlotManager {
    constructor(containerSelector) {
        this.container = document.querySelector(`.${containerSelector}`);
        this.slotIndex = new Map();
        this.candidateClassName = null;
        this.componentInstances = new Map();
        this.initialize();
        this.bindEvents();
    }

    updateAfterImage(slotClass){
        const slot = this.slotIndex.get(slotClass);        
        const image_base64_after = this.container.querySelector(`.${slotClass}-image-after`);
        if(image_base64_after){
            image_base64_after.src = slot.pre_image_after_base64;
        }
    }

    bindEvents() {
        // eslint-disable-next-line sonarjs/cognitive-complexity
        this.container.addEventListener('click', async (e) => {
            const target = e.target.closest('.slot-action');
            if (!target) return;

            const action = target.dataset.action;
            const slotClass = target.dataset.slot;
            const slot = this.slotIndex.get(slotClass);
            const apiInterface = globalThis.generate.api_interface.getValue();

            if (action === 'add') {
                /*
                We use add for refresh controlnet result
                this.handleAdd();
                */        
                const rowValues = this.getValue(slotClass, slot, true);
                const preProcessModel = rowValues[0];   
                let preProcessResolution = rowValues[1];
                preProcessResolution = Math.round(preProcessResolution / 64) * 64;
                if (preProcessResolution<512)
                    preProcessResolution = 512;
                else if (preProcessResolution > 2048)
                    preProcessResolution = 2048;

                const slotValues = this.getValue(slotClass, slot);
                if(slotValues[0].startsWith('ip-adapter')) {            
                    const imageB64 = await resizeImageToControlNetResolution(slot.pre_image_base64, preProcessResolution, true, true);
                    slot.pre_image_after_base64 = `data:image/png;base64,${imageB64}`;
                    globalThis.overlay.custom.createCustomOverlay(
                        slot.pre_image_after_base64, slotValues.toString(), preProcessResolution, 'center', 'center', 'Controlnet');

                    this.updateAfterImage(slotClass);
                } else {
                    if(!slot.pre_image && slot.pre_image_after && preProcessModel !== 'none') {
                        let tmpImage;
                        if(apiInterface === 'ComfyUI'){
                            if (globalThis.inBrowser) {
                                tmpImage = await sendWebSocketMessage({ type: 'API', method: 'decompressGzip', params: [slot.preImageAfter] });
                                slot.pre_image = await sendWebSocketMessage({ type: 'API', method: 'compressGzip', params: [Array.from(tmpImage)] });                                
                            } else {
                                tmpImage = await globalThis.api.decompressGzip(slot.pre_image_after);
                                slot.pre_image = await globalThis.api.compressGzip(tmpImage);
                            }
                        } else {
                            slot.pre_image = slot.pre_image_after.replace('data:image/png;base64,', '');
                        }
                    }

                    if(slot.pre_image) {
                        const {preImage, preImageAfter, preImageAfterBase64} = 
                            await generateControlnetImage(slot.pre_image, preProcessModel, preProcessResolution, true);
                        if(preImageAfterBase64?.startsWith('data:image/png;base64,') && preImage) {
                            slot.pre_image_after = preImageAfter;
                            slot.pre_image_after_base64 = preImageAfterBase64;
                        }
                        
                        this.updateAfterImage(slotClass);
                        globalThis.overlay.custom.createCustomOverlay(
                            [slot.pre_image_base64, slot.pre_image_after_base64], slotValues.toString(), 512, 'center', 'center', 'Controlnet');
                    }
                }
            } else if (action === 'delete') {
                this.delSlot(slotClass);
            } else if (action === 'info') {
                /*
                Since slot already show images, info button are now hide by default
                */               
                if(slot.pre_image && slot.pre_image_after) {
                    globalThis.overlay.custom.createCustomOverlay(
                        [slot.pre_image_base64, slot.pre_image_after_base64], this.getValue(slotClass, slot).toString(), 
                        512, 'center', 'center', 'Controlnet');
                } else if(!slot.pre_image && slot.pre_image_after) {
                    globalThis.overlay.custom.createCustomOverlay(
                        slot.pre_image_after_base64, this.getValue(slotClass, slot).toString(), 
                        512, 'center', 'center', 'Controlnet');
                }
                else if(!slot.pre_image && !slot.pre_image_after) {
                    // Empty Slot by click Add.....
                    globalThis.imageInfo.showOverlay();
                }
            } 
        });

        this.container.addEventListener('input', (e) => {
            const input = e.target;
            if (!input.matches('.numeric-input')) return;

            const value = input.value;
            const validPattern = /^-?\d*\.?\d*$/;
            if (validPattern.test(value)) {
                input.dataset.lastValid = value;
            } else {
                input.value = input.dataset.lastValid || '';
            }
        });

        this.container.addEventListener('keydown', (e) => {
            const input = e.target;
            if (!input.matches('.numeric-input')) return;

            const key = e.key;
            const value = input.value;
            const cursorPos = input.selectionStart;

            if (['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Home', 'End'].includes(key)) {
                return;
            }

            if (key === '.' && value.includes('.')) {
                e.preventDefault();
                return;
            }

            if (key === '-' && (cursorPos !== 0 || value.includes('-'))) {
                e.preventDefault();
                return;
            }

            if (!/[\d.-]/.test(key)) {
                e.preventDefault();
            }
        });
    }

    getSlotValue(slotClass, index) {
        let ret = 'none';
        const slot = this.slotIndex.get(slotClass);
        if (!slot) {
            console.log('Slot not found:', slotClass);
            return ret;
        }

        let i = 0;
        for (const item of slot.items) {
            const itemClass = item[0];
            const componentKey = `${slotClass}-${itemClass}`;
            const component = this.componentInstances.get(componentKey);
            if (component && index === i) {
                ret = component.getValue ? component.getValue() : 'No getValue method';
            }
            i += 1;
        }
        return ret;
    }

    generateClassName(prefix) {
        return `${prefix}-${generateGUID()}`;
    }

    initialize() {
        const candidateClassName = this.createCandidateRow();
        const candidateSlot = this.slotIndex.get(candidateClassName);
        if (candidateSlot) {
            const row = this.renderAddRow(candidateClassName);
            this.container.appendChild(row);
        }
    }

    createCandidateRow() {
        const className = this.generateClassName('slot');
        const itemClasses = {
            add: this.generateClassName('slot-row-add'),
            pre_process_model: this.generateClassName('slot-row-pre-process-model'),
            pre_process_resolution: this.generateClassName('slot-row-text1-pre-process-resolution'),
            slot_enable: this.generateClassName('slot-row-enable'),
            post_model: this.generateClassName('slot-row-post-model'),
            post_process_strength: this.generateClassName('slot-row-text1-post-process-strength'),
            post_process_start: this.generateClassName('slot-row-text2-post-process-start'),
            post_process_end: this.generateClassName('slot-row-text2-post-process-end'),
            pre_process_image: this.generateClassName('slot-row-pre-process-image'),
            pre_image_after: this.generateClassName('slot-row-pre-process-image-after')
        };

        this.slotIndex.set(className, {
            itemClasses,
            items: new Map(),
            isCandidate: true,
            pre_image: '',
            pre_image_after: ''
        });
        this.candidateClassName = className;
        return className;
    }

    renderAddRow(className) {
        const row = document.createElement('div');
        row.className = `slot-row add-row ${className}`;
        row.innerHTML = `            
            <div class="slot-action slot-action-add" data-action="info" data-slot="${className}">
                <img class="slot-action-add-toggle" src="scripts/svg/add.svg" alt="+">
            </div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>

            <div></div>
            <div class="controlnet-slot-image">
                <img class="filter-controlnet-icon" id="global-image-upload-icon" src="scripts/svg/image-upload.svg" max-width="48px" height="48px">
                <img class="filter-controlnet-icon" id="global-clipboard-paste-icon" src="scripts/svg/paste.svg" max-width="48px" height="48px">
                <img class="filter-controlnet-icon" id="global-sliders-icon" src="scripts/svg/sliders.svg" max-width="48px" height="48px">                
                <img class="filter-controlnet-icon" id="global-pose-icon" src="scripts/svg/pose.svg" max-width="48px" height="48px">
            </div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
        `;
        return row;
    }

    addSlot(pre_image_base64 = null, pre_image_after_base64 = null) {
        const slot = this.slotIndex.get(this.candidateClassName);

        slot.isCandidate = false;
        slot.itemClasses.delete = this.generateClassName('delete');
        delete slot.itemClasses.add;
        const className = this.candidateClassName;

        const candidateRow = this.container.querySelector(`.${className}`);
        if (candidateRow) {
            candidateRow.classList.remove('add-row');
            candidateRow.classList.add('content-row');
            /*
            Hide info button

            <div class="slot-action slot-action-info" data-action="info" data-slot="${className}">
                <img class="slot-action-info-toggle" src="scripts/svg/info.svg" alt="?">
            </div>
            */
            candidateRow.innerHTML = `
                <div class="slot-action slot-action-del ${slot.itemClasses.delete}" data-action="delete" data-slot="${className}">
                    <img class="slot-action-del-toggle" src="scripts/svg/del.svg" alt="-">
                </div>                
                <div class="${slot.itemClasses.pre_process_model}"></div>
                <div class="${slot.itemClasses.pre_process_resolution}"></div>
                <div></div>
                <div></div>
                <div class="slot-action slot-action-info" data-action="add" data-slot="${className}">
                    <img class="slot-action-info-toggle" src="scripts/svg/refresh.svg" alt="Refresh">
                </div>                

                <div></div>
                <div class="${slot.itemClasses.post_model}"></div>
                <div class="${slot.itemClasses.post_process_strength}"></div>
                <div class="${slot.itemClasses.post_process_start}"></div>
                <div class="${slot.itemClasses.post_process_end}"></div>
                <div class="${slot.itemClasses.slot_enable}"></div>
            `;
            if(pre_image_base64 && pre_image_after_base64) {
                candidateRow.innerHTML += `
                    <div></div>
                    <div class="controlnet-slot-image"><img class="${className}-image" src="${pre_image_base64}" max-width="100px" height="100px"><img class="${className}-image-after" src="${pre_image_after_base64}" max-width="100px" height="100px"></div>
                    <div></div>
                    <div></div>
                    <div></div>
                    <div></div>
                `;

                addEvent(candidateRow, `${className}-image`);
                addEvent(candidateRow, `${className}-image-after`);
                
            } else if(!pre_image_base64 && pre_image_after_base64) {
                candidateRow.innerHTML += `
                    <div></div>
                    <div class="controlnet-slot-image"><img class="${className}-image-after" src="${pre_image_after_base64}" max-width="100px" height="100px"></div>
                    <div></div>
                    <div></div>
                    <div></div>
                    <div></div>
                `;
                addEvent(candidateRow, `${className}-image-after`);
            }
            
        }

        const newCandidateClassName = this.createCandidateRow();
        const newCandidateSlot = this.slotIndex.get(newCandidateClassName);
        if (newCandidateSlot) {
            const newRow = this.renderAddRow(newCandidateClassName);
            this.container.appendChild(newRow);
        }

        return className;
    }

    delSlot(className) {
        if (this.slotIndex.has(className) && !this.slotIndex.get(className).isCandidate) {
            const slot = this.slotIndex.get(className);
            if (slot) {
                slot.pre_image = null;
                slot.pre_image_after = null;
                slot.pre_image_base64 = null;
                slot.pre_image_after_base64 = null;                
                
                for (const itemClass of Object.values(slot.itemClasses)) {
                    const componentKey = `${className}-${itemClass}`;
                    if (this.componentInstances.has(componentKey)) {
                        this.componentInstances.delete(componentKey);
                    }
                }
            }
            const rowElement = this.container.querySelector(`.${className}`);
            if (rowElement) {
                rowElement.remove();
            }
            this.slotIndex.delete(className);
        }
    }

    clear() {
        const slots = this.getSlots();
        for (const slotClass of slots) {
            this.delSlot(slotClass);
        }
    }

    getSlots() {
        return Array.from(this.slotIndex.keys()).filter(className => !this.slotIndex.get(className).isCandidate);
    }

    getValue(className, slot, includeImage) {
        const rowValues = [];
        const {
                pre_process_model, pre_process_resolution,
                slot_enable, post_model, post_process_strength,
                post_process_start, post_process_end
            } = slot.itemClasses;

        try {
            const preProcessModelComponent = this.componentInstances.get(`${className}-${pre_process_model}`);
            rowValues.push(preProcessModelComponent?.getValue ? preProcessModelComponent.getValue() : 'none');

            const preProcessResolutionComponent = this.componentInstances.get(`${className}-${pre_process_resolution}`);
            rowValues.push(preProcessResolutionComponent?.getValue ? preProcessResolutionComponent.getValue() : '');

            const postProcessComponent = this.componentInstances.get(`${className}-${slot_enable}`);
            rowValues.push(postProcessComponent?.getValue ? postProcessComponent.getValue() : 'Off');

            const postModelComponent = this.componentInstances.get(`${className}-${post_model}`);
            rowValues.push(postModelComponent?.getValue ? postModelComponent.getValue() : '');

            const postProcessStrengthComponent = this.componentInstances.get(`${className}-${post_process_strength}`);
            rowValues.push(postProcessStrengthComponent?.getValue ? postProcessStrengthComponent.getValue() : '');

            const postProcessStartComponent = this.componentInstances.get(`${className}-${post_process_start}`);
            rowValues.push(postProcessStartComponent?.getValue ? postProcessStartComponent.getValue() : '');

            const postProcessEndComponent = this.componentInstances.get(`${className}-${post_process_end}`);
            rowValues.push(postProcessEndComponent?.getValue ? postProcessEndComponent.getValue() : '');

            if(includeImage) {
                rowValues.push(slot.pre_image || null, slot.pre_image_after || null, slot.pre_image_base64 || null, slot.pre_image_after_base64 || null);
            } else {
                rowValues.push(null, null, null, null);
            }
        } catch (error) {
            console.error(`Error getting values for slot ${className}:`, error);
        }
        return rowValues;
    }

    getValues(includeImage=false) {
        const result = [];
        const contentSlots = this.getSlots();

        for (const className of contentSlots) {
            const slot = this.slotIndex.get(className);
            if (!slot) continue;

            result.push(this.getValue(className, slot, includeImage));
        }
        return result;
    }

    initializeSlotComponents(className, slot, currentValues = null) {
        requestAnimationFrame(() => {
            for (const [itemClass, generator] of slot.items.entries()) {
                if (generator) {
                    const component = generator();
                    if (component) {
                        const componentKey = `${className}-${itemClass}`;
                        this.componentInstances.set(componentKey, component);
                        if (currentValues?.has(componentKey) && component.setValue) {
                            const previousValue = currentValues.get(componentKey);
                            component.setValue(previousValue);
                            console.log(`Restored value for ${componentKey}:`, previousValue);
                        }
                        console.log(`Initialized component for ${componentKey}`);
                    }
                }
            }
        });
    }

    reload() {
        const slotValues = this.getValues(true);
    
        createControlNetSlotsFromValues(this, slotValues, {
            context: 'Restored',
            validateLoRA: true
        });
    }

    AddControlNetSlot(slotValues) {
        createControlNetSlotsFromValues(this, slotValues, { validateControlNet: true, clearSlots: false });
    }
}

export function getControlNetListWithProcessorList() {
    let controlNetPreprocessor = [];

    if(globalThis.globalSettings.api_interface === 'ComfyUI') {
        controlNetPreprocessor = [...controlNetValuesComfyUI];

        let clipVisionList = [];
        for (const clipVision of globalThis.cachedFiles.controlnetList) {
            if (!clipVision.startsWith('CV->')) {
                continue;
            }
            clipVisionList.push(clipVision.replaceAll('CV->', 'ip-adapter->'));
        }

        controlNetPreprocessor = controlNetPreprocessor.concat(clipVisionList);
    } else if(globalThis.globalSettings.api_interface === 'WebUI') {
        if (globalThis.cachedFiles.controlnetProcessorListWebUI === 'none'){
            controlNetPreprocessor = [...controlNetValuesWebUI];
        } else {
            controlNetPreprocessor = [...globalThis.cachedFiles.controlnetProcessorListWebUI];
        }
    } else {
        controlNetPreprocessor = [];
    }

    return controlNetPreprocessor;
}

export function setupControlNet(containerID) {
    if (!instanceControlNetSlotManager) {
        instanceControlNetSlotManager = new ControlNetSlotManager(containerID);
    }
    return instanceControlNetSlotManager;
}