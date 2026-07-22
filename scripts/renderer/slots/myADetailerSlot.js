import { mySimpleList } from '../components/myDropdown.js';
import { setupTextbox } from '../components/myTextbox.js';
import { generateGUID } from './myLoRASlot.js';

const aDetailerWebUI = [
    "face_yolov8n.pt",
    "face_yolov8s.pt",
    "hand_yolov8n.pt",
    "person_yolov8n-seg.pt",
    "person_yolov8s-seg.pt",
    "yolov8x-worldv2.pt",
    "mediapipe_face_full",
    "mediapipe_face_short",
    "mediapipe_face_mesh",
    "mediapipe_face_mesh_eyes_only"
];

let adetailerModels = [];
let adetailerModelsComfyUISams = [];
let instanceADetailerSlotManager = null;

function createADetailerSlotsFromValues(slotManager, slotValues, options = {}) {
    const { validateADetailer = true, clearSlots = true } = options;

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
        ad_model, ad_confidence, ad_mask_k, slot_enable,
        ad_prompt, ad_dilate_erode, ad_mask_merge_invert,
        ad_negative_prompt, ad_mask_blur, ad_denoise
    ] of slotValues) {
        if (validateADetailer) {
            if (!adetailerModels.includes(ad_model)) {
                console.warn(`ADetailer Model "${ad_model}" not found, skipping`);
                continue;
            }
        }

        const className = slotManager.addSlot();
        const slot = slotManager.slotIndex.get(className);
        if (!slot) continue;

        const apiInterface = globalThis.generate.api_interface.getValue();

        requestAnimationFrame(() => {
            const adModelComponent = mySimpleList(
                slot.itemClasses.ad_model,
                LANG.api_adetailer_model,
                adetailerModels,
                null,
                10,
                true,
                false
            );
            adModelComponent.updateDefaults(ad_model);
            slot.items.set(slot.itemClasses.ad_model, () => adModelComponent);
            slotManager.componentInstances.set(`${className}-${slot.itemClasses.ad_model}`, adModelComponent);

            const adConfidenceComponent = setupTextbox(
                slot.itemClasses.ad_confidence,
                LANG.api_adetailer_confidence,
                { value: ad_confidence, defaultTextColor: 'rgb(179,157,219)', maxLines: 1 },
                false,
                null,
                false,
                true
            );
            slot.items.set(slot.itemClasses.ad_confidence, () => adConfidenceComponent);
            slotManager.componentInstances.set(`${className}-${slot.itemClasses.ad_confidence}`, adConfidenceComponent);

            const adMaskKComponent = setupTextbox(
                slot.itemClasses.ad_mask_k,
                LANG.api_adetailer_mask_k,
                { value: ad_mask_k, defaultTextColor: 'rgb(179,157,219)', maxLines: 1 },
                false,
                null,
                false,
                true
            );
            slot.items.set(slot.itemClasses.ad_mask_k, () => adMaskKComponent);
            slotManager.componentInstances.set(`${className}-${slot.itemClasses.ad_mask_k}`, adMaskKComponent);

            const slotEnableComponent = mySimpleList(
                slot.itemClasses.slot_enable,
                LANG.api_adetailer_slot_enable,
                (apiInterface==='WebUI')?['Area', 'Confidence', 'Off']:[...adetailerModelsComfyUISams, 'Off'],
                null,
                3,
                false,
                false
            );
            slotEnableComponent.updateDefaults(slot_enable);
            slot.items.set(slot.itemClasses.slot_enable, () => slotEnableComponent);
            slotManager.componentInstances.set(`${className}-${slot.itemClasses.slot_enable}`, slotEnableComponent);

            const adPromptComponent = setupTextbox(
                slot.itemClasses.ad_prompt,
                LANG.api_adetailer_prompt,
                { value: ad_prompt, defaultTextColor: 'rgb(255,213,0)', maxLines: 2 },
                false,
                null,
                false,
                false
            );
            slot.items.set(slot.itemClasses.ad_prompt, () => adPromptComponent);
            slotManager.componentInstances.set(`${className}-${slot.itemClasses.ad_prompt}`, adPromptComponent);

            const adDilateErodeComponent = setupTextbox(
                slot.itemClasses.ad_dilate_erode,
                LANG.api_adetailer_dilate_erode,
                { value: ad_dilate_erode, defaultTextColor: 'rgb(179,157,219)', maxLines: 1 },
                false,
                null,
                false,
                true
            );
            slot.items.set(slot.itemClasses.ad_dilate_erode, () => adDilateErodeComponent);
            slotManager.componentInstances.set(`${className}-${slot.itemClasses.ad_dilate_erode}`, adDilateErodeComponent);

            const adMaskMergeInvertComponent = mySimpleList(
                slot.itemClasses.ad_mask_merge_invert,
                LANG.api_adetailer_mask_merge_invert,
                (apiInterface==='WebUI')?['None', 'Merge', 'Merge and Invert']:
                ["center-1", "horizontal-2", "vertical-2", "rect-4", "diamond-4", "mask-area", "mask-points", "mask-point-bbox", "none"],
                null,
                3,
                false,
                false
            );
            adMaskMergeInvertComponent.updateDefaults(ad_mask_merge_invert);
            slot.items.set(slot.itemClasses.ad_mask_merge_invert, () => adMaskMergeInvertComponent);
            slotManager.componentInstances.set(`${className}-${slot.itemClasses.ad_mask_merge_invert}`, adMaskMergeInvertComponent);

            const adNegativePromptComponent = setupTextbox(
                slot.itemClasses.ad_negative_prompt,
                LANG.api_adetailer_negative_prompt,
                { value: ad_negative_prompt, defaultTextColor: 'rgb(255,100,100)', maxLines: 2 },
                false,
                null,
                false,
                false
            );
            slot.items.set(slot.itemClasses.ad_negative_prompt, () => adNegativePromptComponent);
            slotManager.componentInstances.set(`${className}-${slot.itemClasses.ad_negative_prompt}`, adNegativePromptComponent);

            const adMaskBlurComponent = setupTextbox(
                slot.itemClasses.ad_mask_blur,
                LANG.api_adetailer_mask_blur,
                { value: ad_mask_blur, defaultTextColor: 'rgb(179,157,219)', maxLines: 1 },
                false,
                null,
                false,
                true
            );
            slot.items.set(slot.itemClasses.ad_mask_blur, () => adMaskBlurComponent);
            slotManager.componentInstances.set(`${className}-${slot.itemClasses.ad_mask_blur}`, adMaskBlurComponent);

            const adDenoiseComponent = setupTextbox(
                slot.itemClasses.ad_denoise,
                LANG.api_adetailer_denoise,
                { value: ad_denoise, defaultTextColor: 'rgb(255,213,0)', maxLines: 1 },
                false,
                null,
                false,
                true
            );
            slot.items.set(slot.itemClasses.ad_denoise, () => adDenoiseComponent);
            slotManager.componentInstances.set(`${className}-${slot.itemClasses.ad_denoise}`, adDenoiseComponent);
        });
    }
}

class ADetailerSlotManager {
    constructor(containerSelector) {
        this.container = document.querySelector(`.${containerSelector}`);
        this.slotIndex = new Map();
        this.candidateClassName = null;
        this.componentInstances = new Map();
        this.initialize();
        this.bindEvents();
    }

    bindEvents() {
        this.container.addEventListener('click', async (e) => {
            const target = e.target.closest('.slot-action');
            if (!target) return;

            const action = target.dataset.action;
            const slotClass = target.dataset.slot;

            if (action === 'add') {
                this.handleAdd();
            } else if (action === 'delete') {
                this.delSlot(slotClass);
            }
        });

        this.container.addEventListener('input', (e) => {
            const input = e.target;
            if (!input.matches('.numeric-input')) return;

            const value = input.value;
            const validPattern = /^-?\d*\.?\d*$/;   //NOSONAR S8786
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

    handleAdd() {
        const SETTINGS = globalThis.globalSettings || {};
        const FILES = globalThis.cachedFiles || { language: {}, loraList: ['Default LoRA'] };
        const LANG = FILES.language[SETTINGS.language] || {
            lora_model_strength: 'Model Strength',
            lora_clip_strength: 'Clip Strength',
            lora_enable_title: 'Enable'
        };

        const className = this.addSlot();
        if (!className) return;

        const slot = this.slotIndex.get(className);
        if (!slot) return;

        const apiInterface = globalThis.generate.api_interface.getValue();

        requestAnimationFrame(() => {
            const adModelComponent = mySimpleList(
                slot.itemClasses.ad_model,
                LANG.api_adetailer_model,
                adetailerModels,
                null,
                10,
                true,
                false
            );
            slot.items.set(slot.itemClasses.ad_model, () => adModelComponent);
            this.componentInstances.set(`${className}-${slot.itemClasses.ad_model}`, adModelComponent);

            const adConfidenceComponent = setupTextbox(
                slot.itemClasses.ad_confidence,
                LANG.api_adetailer_confidence,
                { value: 0.3, defaultTextColor: 'rgb(179,157,219)', maxLines: 1 },
                false,
                null,
                false,
                true
            );
            slot.items.set(slot.itemClasses.ad_confidence, () => adConfidenceComponent);
            this.componentInstances.set(`${className}-${slot.itemClasses.ad_confidence}`, adConfidenceComponent);

            const adMaskKComponent = setupTextbox(
                slot.itemClasses.ad_mask_k,
                LANG.api_adetailer_mask_k,
                { value: 0, defaultTextColor: 'rgb(179,157,219)', maxLines: 1 },
                false,
                null,
                false,
                true
            );
            slot.items.set(slot.itemClasses.ad_mask_k, () => adMaskKComponent);
            this.componentInstances.set(`${className}-${slot.itemClasses.ad_mask_k}`, adMaskKComponent);

            const slotEnableComponent = mySimpleList(
                slot.itemClasses.slot_enable,
                LANG.api_adetailer_slot_enable,
                (apiInterface==='WebUI')?['Area', 'Confidence', 'Off']:[...adetailerModelsComfyUISams],
                null,
                3,
                false,
                false
            );
            slotEnableComponent.updateDefaults((apiInterface==='WebUI')?'Area':adetailerModelsComfyUISams[0]);
            slot.items.set(slot.itemClasses.slot_enable, () => slotEnableComponent);
            this.componentInstances.set(`${className}-${slot.itemClasses.slot_enable}`, slotEnableComponent);

            const adPromptComponent = setupTextbox(
                slot.itemClasses.ad_prompt,
                LANG.api_adetailer_prompt,
                { value: "", defaultTextColor: 'rgb(255,213,0)', maxLines: 2, placeholder: 'ADetailer Prompt' },
                false,
                null,
                false,
                false
            );
            slot.items.set(slot.itemClasses.ad_prompt, () => adPromptComponent);
            this.componentInstances.set(`${className}-${slot.itemClasses.ad_prompt}`, adPromptComponent);

            const adDilateErodeComponent = setupTextbox(
                slot.itemClasses.ad_dilate_erode,
                LANG.api_adetailer_dilate_erode,
                { value: 4, defaultTextColor: 'rgb(179,157,219)', maxLines: 1 },
                false,
                null,
                false,
                true
            );
            slot.items.set(slot.itemClasses.ad_dilate_erode, () => adDilateErodeComponent);
            this.componentInstances.set(`${className}-${slot.itemClasses.ad_dilate_erode}`, adDilateErodeComponent);

            const adMaskMergeInvertComponent = mySimpleList(
                slot.itemClasses.ad_mask_merge_invert,
                LANG.api_adetailer_mask_merge_invert,
                (apiInterface==='WebUI')?['None', 'Merge', 'Merge and Invert']:
                ["center-1", "horizontal-2", "vertical-2", "rect-4", "diamond-4", "mask-area", "mask-points", "mask-point-bbox", "none"],
                null,
                10,
                false,
                false
            );
            adMaskMergeInvertComponent.updateDefaults((apiInterface==='WebUI')?'None':"center-1");
            slot.items.set(slot.itemClasses.ad_mask_merge_invert, () => adMaskMergeInvertComponent);
            this.componentInstances.set(`${className}-${slot.itemClasses.ad_mask_merge_invert}`, adMaskMergeInvertComponent);

            const adNegativePromptComponent = setupTextbox(
                slot.itemClasses.ad_negative_prompt,
                LANG.api_adetailer_negative_prompt,
                { value: "", defaultTextColor: 'rgb(255,100,100)', maxLines: 2, placeholder: 'ADetailer Negative Prompt' },
                false,
                null,
                false,
                false
            );
            slot.items.set(slot.itemClasses.ad_negative_prompt, () => adNegativePromptComponent);
            this.componentInstances.set(`${className}-${slot.itemClasses.ad_negative_prompt}`, adNegativePromptComponent);

            const adMaskBlurComponent = setupTextbox(
                slot.itemClasses.ad_mask_blur,
                LANG.api_adetailer_mask_blur,
                { value: 4, defaultTextColor: 'rgb(179,157,219)', maxLines: 1 },
                false,
                null,
                false,
                true
            );
            slot.items.set(slot.itemClasses.ad_mask_blur, () => adMaskBlurComponent);
            this.componentInstances.set(`${className}-${slot.itemClasses.ad_mask_blur}`, adMaskBlurComponent);

            const adDenoiseComponent = setupTextbox(
                slot.itemClasses.ad_denoise,
                LANG.api_adetailer_denoise,
                { value: 0.5, defaultTextColor: 'rgb(255,213,0)', maxLines: 1 },
                false,
                null,
                false,
                true
            );
            slot.items.set(slot.itemClasses.ad_denoise, () => adDenoiseComponent);
            this.componentInstances.set(`${className}-${slot.itemClasses.ad_denoise}`, adDenoiseComponent);
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
        const className = this.generateClassName('adetailer-slot');
        const itemClasses = {
            add: this.generateClassName('slot-row-add'),
            ad_model: this.generateClassName('slot-row-ad-model'),
            ad_confidence: this.generateClassName('slot-row-text1-ad-confidence'),
            ad_mask_k: this.generateClassName('slot-row-text2-ad-mask-k'),
            slot_enable: this.generateClassName('slot-row-enable'),
            ad_prompt: this.generateClassName('slot-row-text1-ad-prompt'),
            ad_dilate_erode: this.generateClassName('slot-row-text1-ad-dilate-erode'),
            ad_mask_merge_invert: this.generateClassName('slot-row-ad-mask-merge-invert'),
            ad_negative_prompt: this.generateClassName('slot-row-text2-ad-negative-prompt'),
            ad_mask_blur: this.generateClassName('slot-row-text1-ad-mask-blur'),
            ad_denoise: this.generateClassName('slot-row-text2-ad-denoise')
        };

        this.slotIndex.set(className, {
            itemClasses,
            items: new Map(),
            isCandidate: true
        });
        this.candidateClassName = className;
        return className;
    }

    renderAddRow(className) {
        const row = document.createElement('div');
        row.className = `slot-row add-row ${className}`;
        row.innerHTML = `            
            <div class="slot-action slot-action-add" data-action="add" data-slot="${className}">
                <img class="slot-action-add-toggle" src="scripts/svg/add.svg" alt="+">
            </div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div class="controlnet-slot-image">
                <img class="filter-controlnet-icon" id="global-portrait-icon" src="scripts/svg/portrait.svg" max-width="48px" height="48px">
                <img class="filter-controlnet-icon" id="global-sliders-icon" src="scripts/svg/sliders.svg" max-width="48px" height="48px">                
                <img class="filter-controlnet-icon" id="global-painting-icon" src="scripts/svg/painting.svg" max-width="48px" height="48px">
            </div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
        `;
        return row;
    }

    addSlot() {
        const slot = this.slotIndex.get(this.candidateClassName);

        slot.isCandidate = false;
        slot.itemClasses.delete = this.generateClassName('delete');
        delete slot.itemClasses.add;
        const className = this.candidateClassName;

        const candidateRow = this.container.querySelector(`.${className}`);
        if (candidateRow) {
            candidateRow.classList.remove('add-row');
            candidateRow.classList.add('adetailer-row');
            candidateRow.innerHTML = `
                <div class="slot-action slot-action-del ${slot.itemClasses.delete}" data-action="delete" data-slot="${className}">
                    <img class="slot-action-del-toggle" src="scripts/svg/del.svg" alt="-">
                </div>                
                <div class="${slot.itemClasses.ad_model}"></div>
                <div class="${slot.itemClasses.ad_confidence}"></div>
                <div class="${slot.itemClasses.ad_mask_k}"></div>
                <div class="${slot.itemClasses.slot_enable}"></div>

                <div></div>
                <div class="${slot.itemClasses.ad_prompt}"></div>
                <div class="${slot.itemClasses.ad_dilate_erode}"></div>
                <div></div>
                <div class="${slot.itemClasses.ad_mask_merge_invert}"></div>

                <div></div>
                <div class="${slot.itemClasses.ad_negative_prompt}"></div>
                <div class="${slot.itemClasses.ad_mask_blur}"></div>
                <div class="${slot.itemClasses.ad_denoise}"></div>
                <div></div>
            `;
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

    getValue(className, slot) {
        const rowValues = [];
        const {
            ad_model, ad_confidence, ad_mask_k, slot_enable,
            ad_prompt, ad_dilate_erode, ad_mask_merge_invert,
            ad_negative_prompt, ad_mask_blur, ad_denoise
        } = slot.itemClasses;

        try {
            const adModelComponent = this.componentInstances.get(`${className}-${ad_model}`);
            rowValues.push(adModelComponent?.getValue ? adModelComponent.getValue() : 'none');

            const adConfidenceComponent = this.componentInstances.get(`${className}-${ad_confidence}`);
            rowValues.push(adConfidenceComponent?.getValue ? adConfidenceComponent.getValue() : '0.3');

            const adMaskKComponent = this.componentInstances.get(`${className}-${ad_mask_k}`);
            rowValues.push(adMaskKComponent?.getValue ? adMaskKComponent.getValue() : '0');

            const slotEnableComponent = this.componentInstances.get(`${className}-${slot_enable}`);
            rowValues.push(slotEnableComponent?.getValue ? slotEnableComponent.getValue() : 'Off');

            const adPromptComponent = this.componentInstances.get(`${className}-${ad_prompt}`);
            rowValues.push(adPromptComponent?.getValue ? adPromptComponent.getValue() : '');

            const adDilateErodeComponent = this.componentInstances.get(`${className}-${ad_dilate_erode}`);
            rowValues.push(adDilateErodeComponent?.getValue ? adDilateErodeComponent.getValue() : '4');

            const adMaskMergeInvertComponent = this.componentInstances.get(`${className}-${ad_mask_merge_invert}`);
            rowValues.push(adMaskMergeInvertComponent?.getValue ? adMaskMergeInvertComponent.getValue() : 'None');

            const adNegativePromptComponent = this.componentInstances.get(`${className}-${ad_negative_prompt}`);
            rowValues.push(adNegativePromptComponent?.getValue ? adNegativePromptComponent.getValue() : '');

            const adMaskBlurComponent = this.componentInstances.get(`${className}-${ad_mask_blur}`);
            rowValues.push(adMaskBlurComponent?.getValue ? adMaskBlurComponent.getValue() : '4');

            const adDenoiseComponent = this.componentInstances.get(`${className}-${ad_denoise}`);
            rowValues.push(adDenoiseComponent?.getValue ? adDenoiseComponent.getValue() : '0.4');
        } catch (error) {
            console.error(`Error getting values for slot ${className}:`, error);
        }
        return rowValues;
    }

    getValues() {
        const result = [];
        const contentSlots = this.getSlots();

        for (const className of contentSlots) {
            const slot = this.slotIndex.get(className);
            if (!slot) continue;

            result.push(this.getValue(className, slot));
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

    flush() {
        this.clear();

        const slots = globalThis.globalSettings.ad_slot;
        if (!slots || slots.length === 0) {
            return;
        }

        this.AddADetailerSlot(slots);
    }

    reload() {
        const slotValues = this.getValues();
    
        createADetailerSlotsFromValues(this, slotValues, {
            context: 'Restored',
            validateADetailer: true
        });
    }

    AddADetailerSlot(slotValues) {
        createADetailerSlotsFromValues(this, slotValues, { validateADetailer: true, clearSlots: false });
    }
}

export function setADetailerModelList(modelList, addDef=false) {
    if(Array.isArray(modelList)) {
        if(addDef) {
            adetailerModels = [...aDetailerWebUI, ...modelList];
        } else {            
            adetailerModels = [];
            adetailerModelsComfyUISams = [];
            for (const model of modelList){
                if(String(model).toLocaleLowerCase().startsWith('sam_vit_')){
                    adetailerModelsComfyUISams.push(model);
                } else {
                    adetailerModels.push(model);
                }                
            }
            adetailerModelsComfyUISams.push('Off');
        }
    }
}

export function getADetailerModelList() {
    return adetailerModels;
}

export function setupADetailer(containerID) {
    if (!instanceADetailerSlotManager) {
        instanceADetailerSlotManager = new ADetailerSlotManager(containerID);
        if(globalThis.globalSettings.api_interface === 'WebUI') {
            setADetailerModelList(globalThis.cachedFiles.aDetailerList, true);
        } else {
            setADetailerModelList(globalThis.cachedFiles.aDetailerList, false);
        }
    }
    return instanceADetailerSlotManager;
}
