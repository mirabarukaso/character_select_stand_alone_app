import { mySimpleList } from '../components/myDropdown.js';
import { setupTextbox } from '../components/myTextbox.js';
import { sendWebSocketMessage } from '../../../webserver/front/wsRequest.js';

let instanceSlotManager = null;

export function generateGUID() {
    const template = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
    let result = template;
    for (let i = 0; i < template.length; i++) {
        const c = template[i];
        if (c === 'x' || c === 'y') {
            const r = (Math.random() * 16) | Math.trunc(0);
            const v = c === 'x' ? r : (r & 0x3) | 0x8;
            result = result.substring(0, i) + v.toString(16) + result.substring(i + 1);
        }
    }
    return result;
}

async function processLoraMetadata(data) {
    try {
        const jsonString = JSON.stringify(data, null, 2);

        const keyMap = {
            "modelspec.title": "Model Title",
            "modelspec.architecture": "Architecture",
            "modelspec.date": "Date",
            "ss_sd_model_name": "Base Model Name",
            "ss_base_model_version": "Base Model Version",
            "modelspec.resolution": "Resolution",
            "ss_seed": "Seed",
            "ss_clip_skip": "Clip Skip",
            "ss_network_dim": "Network Dim",
            "ss_network_alpha": "Network Alpha"
        };

        const basicInfoObj = {};
        for (const [oldKey, newKey] of Object.entries(keyMap)) {
            if (data[oldKey]) {
                basicInfoObj[newKey] = data[oldKey];
            }
        }
        const basicInfo = Object.entries(basicInfoObj)
            .map(([key, value]) => `${key}: ${value}`)
            .join('\n');

        const topN = 10; 
        let topTags = '';
        if (data['ss_tag_frequency']) {
            try {
                const tagFrequency = JSON.parse(data['ss_tag_frequency']);
                const firstKey = Object.keys(tagFrequency)[0];
                const tags = firstKey ? tagFrequency[firstKey] || {} : {};
                const sortedTags = Object.entries(tags)
                    .map(([tag, count]) => ({ tag, count: Number(count) }))
                    .sort((a, b) => b.count - a.count)
                    .slice(0, topN)
                    .map(item => `${item.tag} (${item.count})`);
                topTags = sortedTags.join(', ');
            } catch (parseError) {
                console.error('Failed to parse ss_tag_frequency:', parseError);
                topTags = '';
            }
        }

        return { jsonString, basicInfo, topTags };
    } catch (error) {
        throw new Error(`Reading metadata failed: ${error.message}`);
    }
}

async function showLoRAInfo(modelPath, prefix, loraPath, lora_trigger_words, lora_metadata, lora_no_metadata){
    const greenColor = (globalThis.globalSettings.css_style==='dark')?'Chartreuse':'SeaGreen';
    try {
        let loraInfo;
        if (globalThis.inBrowser) {
            loraInfo = await sendWebSocketMessage({ type: 'API', method: 'readSafetensors', params: [modelPath, prefix, loraPath] });
        } else {
            loraInfo = await globalThis.api.readSafetensors(modelPath, prefix, loraPath);
        }
        if(typeof loraInfo === 'string')
        {
            if(loraInfo.startsWith('None'))
            {
                globalThis.overlay.custom.createCustomOverlay(
                    'none', `\n\n${lora_no_metadata}`, 384, 'center', 'left', null, 'Lora');
            } else if(loraInfo.startsWith('Error')){
                globalThis.overlay.custom.createCustomOverlay(
                    'none', `\n\n${loraInfo}`, 384, 'center', 'left', null, 'Lora');
            }
        } else {
            const { jsonString, basicInfo, topTags } = await processLoraMetadata(loraInfo);
            let loraImage;
            if (globalThis.inBrowser) {
                loraImage = await sendWebSocketMessage({ type: 'API', method: 'readFile', params: [modelPath, prefix, loraPath.replace('.safetensors', '.png')] });
            } else {
                loraImage = await globalThis.api.readFile(modelPath, prefix, loraPath.replace('.safetensors', '.png'));
            }
            const message = `\n\n${basicInfo}\n${lora_trigger_words}[color=${greenColor}]${topTags}[/color]\n\n${lora_metadata}\n${jsonString}`;
            globalThis.overlay.custom.createCustomOverlay(
                loraImage, message, 384, 'center', 'left', null, 'Lora');
        }
    } catch (error) {
        console.log('error', error);
    }   
}

function createSlotsFromValues(slotManager, slotValues, options = {}) {
    const { validateLoRA = true, clearSlots = true } = options;

    const SETTINGS = globalThis.globalSettings || {};
    const FILES = globalThis.cachedFiles || { language: {}, loraList: ['Default LoRA'] };
    const LANG = FILES.language[SETTINGS.language] || {
        lora_model_strength: 'Model Strength',
        lora_clip_strength: 'Clip Strength',
        lora_enable_title: 'Enable'
    };

    // Optionally clear existing slots
    if (clearSlots) {
        const slots = slotManager.getSlots();
        for (const slotClass of slots) {
            slotManager.delSlot(slotClass);
        }
    }

    // Process each set of slot values
    for (let [loraName, modelStrength, clipStrength, enableValue] of slotValues) {
        // Validate LoRA existence if required
        if (validateLoRA && !FILES.loraList.includes(loraName)) {
            console.warn(`LoRA "${loraName}" not found in loraList`);
            if (options.skipInvalid) {
                console.log(`LoRA "${loraName}" skipped due to validation failure.`);
                continue;
            }
        }

        const className = slotManager.addSlot();
        if (!className) continue;

        const slot = slotManager.slotIndex.get(className);
        if (!slot) continue;

        requestAnimationFrame(() => {
            // Initialize select1 (LoRA dropdown)            
            const select1Component = mySimpleList(
                slot.itemClasses.select1,
                'LoRA',
                FILES.loraList,
                null,
                15,
                true,
                false
            );
            select1Component.updateDefaults(loraName);
            slot.items.set(slot.itemClasses.select1, () => select1Component);
            slotManager.componentInstances.set(`${className}-${slot.itemClasses.select1}`, select1Component);

            // Initialize text1 (Model Strength)
            const text1Component = setupTextbox(
                slot.itemClasses.text1,
                LANG.lora_model_strength,
                { value: modelStrength, defaultTextColor: 'rgb(179,157,219)', maxLines: 1 },
                false,
                null,
                false,
                true
            ); 
            slot.items.set(slot.itemClasses.text1, () => text1Component);
            slotManager.componentInstances.set(`${className}-${slot.itemClasses.text1}`, text1Component);

            // Initialize text2 (Clip Strength)
            const text2Component = setupTextbox(
                slot.itemClasses.text2,
                LANG.lora_clip_strength,
                { value: clipStrength, defaultTextColor: 'rgb(255,213,0)', maxLines: 1 },
                false,
                null,
                globalThis.generate.api_interface.getValue() !== 'ComfyUI',
                true
            );
            slot.items.set(slot.itemClasses.text2, () => text2Component);
            slotManager.componentInstances.set(`${className}-${slot.itemClasses.text2}`, text2Component);


            // Initialize select2 (Enable dropdown)
            const select2Component = mySimpleList(
                slot.itemClasses.select2,
                LANG.lora_enable_title,
                ["ALL", "Base", "HiFix", "OFF"],
                null,
                5,
                false,
                false
            );
            select2Component.updateDefaults(enableValue);
            slot.items.set(slot.itemClasses.select2, () => select2Component);
            slotManager.componentInstances.set(`${className}-${slot.itemClasses.select2}`, select2Component);
        });
    }
}


class SlotManager {
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
            if (action === 'add') {
                this.handleAdd();
            } else if (action === 'delete') {
                const slotClass = target.dataset.slot;
                this.delSlot(slotClass);
            } else if (action === 'info') {
                const slotClass = target.dataset.slot;
                
                const SETTINGS = globalThis.globalSettings;
                const FILES = globalThis.cachedFiles;
                const LANG = FILES.language[SETTINGS.language];

                const apiInterface = globalThis.generate.api_interface.getValue();
                let modelPath = '';
                let prefix = '';
                if(apiInterface == 'ComfyUI'){
                    modelPath = SETTINGS.model_path_comfyui;
                    prefix = 'loras';
                } else if(apiInterface == 'WebUI'){
                    modelPath = SETTINGS.model_path_webui;
                    prefix = 'Lora';
                }

                const loraPath = this.getSlotValue(slotClass, 0);
                await showLoRAInfo(modelPath, prefix, loraPath, LANG.lora_trigger_words, LANG.lora_metadata, LANG.lora_no_metadata);                             
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
    
    getSlotValue(slotClass, index){
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
                const value = component.getValue ? component.getValue() : 'No getValue method';
                ret = value;
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
            const row = this.renderAddRow(candidateClassName, candidateSlot.itemClasses);
            this.container.appendChild(row);
        }
    }

    createCandidateRow() {
        const className = this.generateClassName('slot');
        const itemClasses = {
            add: this.generateClassName('slot-row-add'),
            select1: this.generateClassName('slot-row-select1'),
            text1: this.generateClassName('slot-row-text1'),
            text2: this.generateClassName('slot-row-text2'),
            select2: this.generateClassName('slot-row-select2')
        };

        this.slotIndex.set(className, {
            itemClasses,
            items: new Map(),
            isCandidate: true
        });
        this.candidateClassName = className;
        return className;
    }

    renderAddRow(className, itemClasses) {
        const row = document.createElement('div');
        row.className = `slot-row add-row ${className}`;
        row.innerHTML = `
            <div class="slot-action slot-action-add ${itemClasses.add}" data-action="add" data-slot="${className}">
                <img class="slot-action-add-toggle" src="scripts/svg/add.svg" alt="+">
            </div>
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
        slot.itemClasses.info = this.generateClassName('info');
        delete slot.itemClasses.add;
        const className = this.candidateClassName;

        const candidateRow = this.container.querySelector(`.${className}`);
        if (candidateRow) {
            candidateRow.classList.remove('add-row');
            candidateRow.classList.add('content-row');
            
            const itemClasses = slot.itemClasses;
            candidateRow.innerHTML = `
                <div class="slot-action slot-action-del ${itemClasses.delete}" data-action="delete" data-slot="${className}">
                    <img class="slot-action-del-toggle" src="scripts/svg/del.svg" alt="-">
                </div>
                <div class="${itemClasses.select1}"></div>
                <div class="${itemClasses.text1}"></div>
                <div class="${itemClasses.text2}"></div>
                <div class="${itemClasses.select2}"></div>
                <div class="slot-action slot-action-info ${itemClasses.info}" data-action="info" data-slot="${className}">
                    <img class="slot-action-info-toggle" src="scripts/svg/info.svg" alt="?">
                </div>
            `;
        }

        const newCandidateClassName = this.createCandidateRow();        
        const newCandidateSlot = this.slotIndex.get(newCandidateClassName);
        if (newCandidateSlot) {
            const newRow = this.renderAddRow(newCandidateClassName, newCandidateSlot.itemClasses);
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

    getSlot(className) {
        const slot = this.slotIndex.get(className);
        if (!slot) return [];
        return Object.values(slot.itemClasses);
    }

    setSlotItem(itemClass, generator) {
        for (const [className, slot] of this.slotIndex.entries()) {
            if (Object.values(slot.itemClasses).includes(itemClass)) {
                const generatorFn = typeof generator === 'function' ? generator : () => generator;
                slot.items.set(itemClass, generatorFn);
                
                const component = generatorFn();
                if (component) {
                    const componentKey = `${className}-${itemClass}`;
                    this.componentInstances.set(componentKey, component);
                    console.log('Set component for', componentKey, 'value:', component.getValue ? component.getValue() : 'N/A');
                }
            }
        }
    }

    getSlotItem(itemClass) {
        for (const [className, slot] of this.slotIndex.values()) {
            if (slot.items.has(itemClass)) {
                const componentKey = `${className}-${itemClass}`;
                if (this.componentInstances.has(componentKey)) {
                    return () => this.componentInstances.get(componentKey);
                }
                return slot.items.get(itemClass);
            }
        }
        return null;
    }

    getValues() {
        const result = [];        
        const contentSlots = this.getSlots();
        
        for (const className of contentSlots) {
            const slot = this.slotIndex.get(className);
            if (!slot) continue;
            
            const rowValues = [];
            const { select1, text1, text2, select2 } = slot.itemClasses;
            
            try {
                const loraNameComponent = this.componentInstances.get(`${className}-${select1}`);
                const loraName = loraNameComponent?.getValue ? loraNameComponent.getValue() : '';
                rowValues.push(loraName);
                
                const modelStrengthComponent = this.componentInstances.get(`${className}-${text1}`);
                const modelStrength = modelStrengthComponent?.getValue ? modelStrengthComponent.getValue() : '';
                rowValues.push(modelStrength);
                
                const clipStrengthComponent = this.componentInstances.get(`${className}-${text2}`);
                const clipStrength = clipStrengthComponent?.getValue ? clipStrengthComponent.getValue() : '';
                rowValues.push(clipStrength);
                
                const enableComponent = this.componentInstances.get(`${className}-${select2}`);
                const enableValue = enableComponent?.getValue ? enableComponent.getValue() : '';
                rowValues.push(enableValue);
                
                result.push(rowValues);            
            } catch (error) {
                console.error(`Error getting values for slot ${className}:`, error);
            }
        }
        
        return result;
    }

    flush(){
        this.clear();

        const slots = globalThis.globalSettings.lora_slot;
        if (!slots || slots.length === 0) {
            return;
        }

        const loraStrings = slots.map(([loraName, modelStrength, clipStrength, enableValue]) => {
    
            const modelStr = Number.parseFloat(modelStrength) || 0;
            const clipStr = Number.parseFloat(clipStrength) || 0;
    
            let loraFormat = '';
            switch (enableValue) {
                case 'ALL':
                    loraFormat = `<lora:${loraName}:${modelStr}:${clipStr}>`;
                    break;
                case 'Base':
                    loraFormat = `<lora:${loraName}:${modelStr}:${clipStr}:0:0>`;
                    break;
                case 'HiFix':
                    loraFormat = `<lora:${loraName}:0:0:${modelStr}:${clipStr}>`;
                    break;
                case 'OFF':
                    loraFormat = `<lora:${loraName}:0:0>`;
                    break;
                default:
                    loraFormat = `<lora:${cleanLoraName}:0>`;
            }
    
            return loraFormat;
        });
    
        const loraString = loraStrings.join('');
        this.flushSlot(loraString);
    }

    // eslint-disable-next-line sonarjs/cognitive-complexity
    flushSlot(loraString) {
        this.clear();
        
        const FILES = globalThis.cachedFiles || { language: {}, loraList: ['Default LoRA'] };
    
        // Parse loraString into slotValues
        const slotValues = [];
        const loraRegex = /<lora:([^>]+)>/g;
        const loraMatches = [...loraString.matchAll(loraRegex)];
    
        for (const match of loraMatches) {
            const loraContent = match[1];
            const parts = loraContent.split(':');
            const loraName = parts[0];
            const values = parts.slice(1).map(v => Number.parseFloat(v) || 0);
    
            let select1 = loraName;
            let text1 = '0';
            let text2 = '0';
            let select2 = 'OFF';
    
            const loraExists = FILES.loraList.includes(loraName);
            if (!loraExists) {
                slotValues.push([select1, text1, text2, select2]);
                continue;
            }
    
            if (values.length <= 2) {
                text1 = values[0]?.toString() || '0';
                text2 = values[1]?.toString() || '0';
                select2 = (Number.parseFloat(text1) !== 0 || Number.parseFloat(text2) !== 0) ? 'ALL' : 'OFF';
                slotValues.push([select1, text1, text2, select2]);
            } else if (values.length === 4) {
                const pair1 = [values[0], values[1]];
                const pair2 = [values[2], values[3]];
                const pair1HasNonZero = pair1.some(v => v !== 0);
                const pair2HasNonZero = pair2.some(v => v !== 0);
                const pairsEqual = pair1[0] === pair2[0] && pair1[1] === pair2[1];
    
                if (pairsEqual && pair1HasNonZero) {
                    text1 = pair1[0].toString();
                    text2 = pair1[1].toString();
                    select2 = 'ALL';
                    slotValues.push([select1, text1, text2, select2]);
                } else {
                    if (pair1HasNonZero) {
                        text1 = pair1[0].toString();
                        text2 = pair1[1].toString();
                        select2 = 'Base';
                        slotValues.push([select1, text1, text2, select2]);
                    }
                    if (pair2HasNonZero) {
                        text1 = pair2[0].toString();
                        text2 = pair2[1].toString();
                        select2 = 'HiFix';
                        slotValues.push([select1, text1, text2, select2]);
                    }
                    if (!pair1HasNonZero && !pair2HasNonZero) {
                        select2 = 'OFF';
                        slotValues.push([select1, text1, text2, select2]);
                    }
                }
            }
        }
    
        createSlotsFromValues(this, slotValues, { context: 'Created', validateLoRA: true });
    }

    reload() {
        const slotValues = this.getValues();
    
        createSlotsFromValues(this, slotValues, {
            context: 'Restored',
            validateLoRA: true,
            skipInvalid: true
        });
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
        
        requestAnimationFrame(() => {
            const select1Generator = () => 
                mySimpleList(
                    slot.itemClasses.select1, 
                    'LoRA', 
                    FILES.loraList, 
                    null, 
                    15, 
                    true, 
                    false
                );
            slot.items.set(slot.itemClasses.select1, select1Generator);
            const select1Component = select1Generator();
            if (select1Component) {
                this.componentInstances.set(`${className}-${slot.itemClasses.select1}`, select1Component);
            }
            
            const text1Generator = () => 
                setupTextbox(
                    slot.itemClasses.text1, 
                    LANG.lora_model_strength, 
                    { value: '1.0', defaultTextColor: 'rgb(179,157,219)', maxLines: 1 }, 
                    false, 
                    null,
                    false,  // passwordMode
                    true    // numberOnly
                );
            slot.items.set(slot.itemClasses.text1, text1Generator);
            const text1Component = text1Generator();
            if (text1Component) {
                this.componentInstances.set(`${className}-${slot.itemClasses.text1}`, text1Component);
            }
            
            const text2Generator = () => 
                setupTextbox(
                    slot.itemClasses.text2, 
                    LANG.lora_clip_strength, 
                    { value: '1.0', defaultTextColor: 'rgb(255,213,0)', maxLines: 1 }, 
                    false, 
                    null,
                    globalThis.generate.api_interface.getValue() !== 'ComfyUI',  
                    true    
                );
            slot.items.set(slot.itemClasses.text2, text2Generator);
            const text2Component = text2Generator();
            if (text2Component) {
                this.componentInstances.set(`${className}-${slot.itemClasses.text2}`, text2Component);
            }
            
            const select2Generator = () => 
                mySimpleList(
                    slot.itemClasses.select2, 
                    LANG.lora_enable_title, 
                    ["ALL", "Base", "HiFix", "OFF"], 
                    null, 
                    5, 
                    false, 
                    false
                );
            slot.items.set(slot.itemClasses.select2, select2Generator);
            const select2Component = select2Generator();
            if (select2Component) {
                this.componentInstances.set(`${className}-${slot.itemClasses.select2}`, select2Component);
            }            
        });
    }
}

export function setupLoRA(containerID) {
    if(!instanceSlotManager) {
        instanceSlotManager = new SlotManager(containerID);
    }
    return instanceSlotManager;
}