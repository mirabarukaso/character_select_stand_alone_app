import { mySimpleList } from '../components/myDropdown.js';
import { generateGUID } from './myLoRASlot.js';
import { setupTextbox } from '../components/myTextbox.js';

const regionalPositions = ['Both', 'Left', 'Right'];
const promptPositions = ["BOP", "BOC", "EOC", "EOP", "Off"];
const randomKey = '___Random___';
const enumKey = '___Enumerate___';

function encodeJsonToBase64(jsonObj) {
    return btoa(encodeURIComponent(JSON.stringify(jsonObj)));
}
function decodeBase64ToJson(base64String) {
    return JSON.parse(decodeURIComponent(atob(base64String)));
}

function createJsonSlotsFromValues(slotManager, slotValues, options = {}) {
    const { clearSlots = true } = options;
    if (clearSlots) {
        const slots = slotManager.getSlots();
        for (const slotClass of slots) {
            slotManager.delSlot(slotClass);
        }
    }

    for (const [selectedName, selectedStrength, selectedRegional, selectedPosition, jsonObjBase64] of slotValues) {
        const jsonObj = decodeBase64ToJson(jsonObjBase64);
        createJsonSlotFromValues(slotManager, jsonObj, selectedName, selectedStrength, selectedRegional, selectedPosition);
    }
}

function createJsonSlotFromValues(slotManager, jsonObj, 
    selectedName = null, selectedStrength = '1.0', selectedRegional = 'Both', selectedPosition = 'Off'
) {
    const className = slotManager.addSlot();
    if (!className) return;

    const slot = slotManager.slotIndex.get(className);
    if (!slot) return;

    slot.jsonObj = jsonObj;
    const keys = Object.keys(slot.jsonObj);
    //Add enumKey and random key
    keys.unshift(enumKey);
    keys.unshift(randomKey);

    const SETTINGS = globalThis.globalSettings;
    const FILES = globalThis.cachedFiles;
    const LANG = FILES.language[SETTINGS.language];
    requestAnimationFrame(() => {
        const jsonNameComponent = mySimpleList(
            slot.itemClasses.json_name,
            LANG.jsonlist_name || 'Name',
            keys,
            null,
            10,
            true,
            false
        );
        if(selectedName)
            jsonNameComponent.updateDefaults(selectedName);
        slot.items.set(slot.itemClasses.json_name, () => jsonNameComponent);
        slotManager.componentInstances.set(`${className}-${slot.itemClasses.json_name}`, jsonNameComponent);

        const jsonStrengthComponent = setupTextbox(
            slot.itemClasses.json_strength,
            LANG.jsonlist_strength || 'Strength',
            { value: selectedStrength, defaultTextColor: 'rgb(255,213,0)', maxLines: 1 },
            false,
            null,
            false,
            true
        );
        slot.items.set(slot.itemClasses.json_strength, () => jsonStrengthComponent);
        slotManager.componentInstances.set(`${className}-${slot.itemClasses.json_strength}`, jsonStrengthComponent);

        const jsonRegionalComponent = mySimpleList(
            slot.itemClasses.json_regional,
            LANG.json_regional || 'Regional',
            regionalPositions,
            null,
            5,
            false,
            false
        );
        jsonRegionalComponent.updateDefaults(selectedRegional);
        slot.items.set(slot.itemClasses.json_regional, () => jsonRegionalComponent);
        slotManager.componentInstances.set(`${className}-${slot.itemClasses.json_regional}`, jsonRegionalComponent);

        const jsonPositionComponent = mySimpleList(
            slot.itemClasses.json_position,
            LANG.jsonlist_position || 'Position',
            promptPositions,
            null,
            5,
            false,
            false
        );
        jsonPositionComponent.updateDefaults(selectedPosition);
        slot.items.set(slot.itemClasses.json_position, () => jsonPositionComponent);
        slotManager.componentInstances.set(`${className}-${slot.itemClasses.json_position}`, jsonPositionComponent);
    });
}

let instanceJsonSlotManager = null;

class JsonSlotManager {
    constructor(containerSelector) {
        this.container = document.querySelector(`.${containerSelector}`);
        this.slotIndex = new Map();
        this.candidateClassName = null;
        this.componentInstances = new Map();
        this.initialize();
        this.bindEvents();
    }

    bindEvents() {
        this.container.addEventListener('click', (e) => {
            const target = e.target.closest('.slot-action');
            if (!target) return;

            const action = target.dataset.action;
            const slotClass = target.dataset.slot;

            if (action === 'add') {
                globalThis.imageInfo.showOverlay();
            } else if (action === 'delete') {
                this.delSlot(slotClass);
            } else if (action === 'info') {
                const slot = this.slotIndex.get(slotClass);
                if (!slot) return;

                const jsonNameComponent = this.componentInstances.get(`${slotClass}-${slot.itemClasses.json_name}`);
                const selectedName = jsonNameComponent?.getValue() || randomKey;

                if(selectedName === randomKey || selectedName === enumKey)
                    return;

                const jsonStrComponent = this.componentInstances.get(`${slotClass}-${slot.itemClasses.json_strength}`);
                const selectedStr = Number.parseFloat(jsonStrComponent?.getValue()) || 1;
                const description = (selectedStr===1)?slot.jsonObj[selectedName]:`(${slot.jsonObj[selectedName]}:${selectedStr})`;                

                globalThis.overlay.custom.createCustomOverlay(
                    null, `\n\n${selectedName}\n${description}`, 64, 'left', 'left', 'Info');
            }
        });

        this.container.addEventListener('input', (e) => {
            const input = e.target;
            if (!input.matches('.numeric-input')) return;

            const value = input.value;
            const validPattern = /^-?\d*\.?\d*$/;
            if (!validPattern.test(value)) {
                input.value = input.dataset.lastValid || '1.0';
                return;
            }

            const numValue = Number.parseFloat(value);
            if (Number.isNaN(numValue) || numValue < 0 || numValue > 10) {
                input.value = input.dataset.lastValid || '1.0';
            } else {
                input.dataset.lastValid = value;
            }
        });

        this.container.addEventListener('keydown', (e) => {
            const input = e.target;
            if (!input.matches('.numeric-input')) return;

            const key = e.key;
            const value = input.value;

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
            json_name: this.generateClassName('slot-row-json-name'),
            json_strength: this.generateClassName('slot-row-text1-json-strength'),
            json_regional: this.generateClassName('slot-row-json-regional'),
            json_position: this.generateClassName('slot-row-json-position')
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
            <div class="controlnet-slot-image">
                <img class="filter-controlnet-icon" id="global-file-upload-icon" src="scripts/svg/file-upload.svg" max-width="48px" height="48px">
                <img class="filter-controlnet-icon" id="global-clipboard-paste-icon" src="scripts/svg/paste.svg" max-width="48px" height="48px">
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
            candidateRow.classList.add('content-row');
            candidateRow.innerHTML = `
                <div class="slot-action slot-action-del ${slot.itemClasses.delete}" data-action="delete" data-slot="${className}">
                    <img class="slot-action-del-toggle" src="scripts/svg/del.svg" alt="-">
                </div>
                <div class="${slot.itemClasses.json_name}"></div>
                <div class="${slot.itemClasses.json_strength}"></div>
                <div class="${slot.itemClasses.json_regional}"></div>
                <div class="${slot.itemClasses.json_position}"></div>
                <div class="slot-action slot-action-info" data-action="info" data-slot="${className}">
                    <img class="slot-action-info-toggle" src="scripts/svg/info.svg" alt="?">
                </div>
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
                slot.jsonObj = null;
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
        this.jsonDataDict.clear();
    }

    getSlots() {
        return Array.from(this.slotIndex.keys()).filter(className => !this.slotIndex.get(className).isCandidate);
    }

    flushValue(className, slot) {
        const { json_name, json_strength, json_regional, json_position } = slot.itemClasses;

        try {
            const jsonNameComponent = this.componentInstances.get(`${className}-${json_name}`);
            const jsonStrengthComponent = this.componentInstances.get(`${className}-${json_strength}`);
            const jsonRegionalComponent = this.componentInstances.get(`${className}-${json_regional}`);
            const jsonPositionComponent = this.componentInstances.get(`${className}-${json_position}`);

            return [
                jsonNameComponent.getValue(),
                jsonStrengthComponent.getValue(),
                jsonRegionalComponent.getValue(),
                jsonPositionComponent.getValue(),
                encodeJsonToBase64(slot.jsonObj)
            ];
        } catch (error) {
            console.error(`Error getting values for slot ${className}:`, error);
            return [];
        }
    }

    flush() {
        const result = [];
        const contentSlots = this.getSlots();

        for (const className of contentSlots) {
            const slot = this.slotIndex.get(className);
            if (!slot) continue;

            result.push(this.flushValue(className, slot));
        }
        return result;
    }

    getValue(className, slot, loop=-1) {
        const rowValues = [];
        const { json_name, json_strength, json_regional, json_position } = slot.itemClasses;

        try {
            const jsonNameComponent = this.componentInstances.get(`${className}-${json_name}`);
            const selectedName = jsonNameComponent.getValue();
            const keys = Object.keys(slot.jsonObj);
            if(selectedName === randomKey || (selectedName === enumKey && loop === -1)) {                
                const rnd = keys[Math.floor(keys.length*Math.random())];
                rowValues.push(slot.jsonObj[rnd]);
            } else if(selectedName === enumKey) {
                const idx = loop % keys.length;
                const key = keys[idx];
                rowValues.push(slot.jsonObj[key]);
            } else {
                rowValues.push(slot.jsonObj[selectedName]);
            }            

            const jsonStrengthComponent = this.componentInstances.get(`${className}-${json_strength}`);
            rowValues.push(jsonStrengthComponent.getValue());

            const jsonRegionalComponent = this.componentInstances.get(`${className}-${json_regional}`);
            rowValues.push(jsonRegionalComponent.getValue());

            const jsonPositionComponent = this.componentInstances.get(`${className}-${json_position}`);
            rowValues.push(jsonPositionComponent.getValue());
        } catch (error) {
            console.error(`Error getting values for slot ${className}:`, error);
        }
        return rowValues;
    }

    getValues(loop=-1) {
        const result = [];
        const contentSlots = this.getSlots();

        for (const className of contentSlots) {
            const slot = this.slotIndex.get(className);
            if (!slot) continue;

            result.push(this.getValue(className, slot, loop));
        }
        return result;
    }

    async addJsonSlotFromFile(file, type) {
        try {
            const textDecoder = new TextDecoder('utf-8');
            const fileContent = textDecoder.decode(await file.arrayBuffer());

            let jsonObj;
            if (type === 'application/json') {
                jsonObj = JSON.parse(fileContent);
            } else if (type === 'text/csv') {
                jsonObj = {};
                const lines = fileContent.trim().split('\n');
                for (const line of lines) {
                    const columns = line.split(',').map(item => {
                        let trimmed = item.trim();
                        if (trimmed.includes('"')) {
                            trimmed = trimmed.replaceAll('"', '');
                        }
                        return trimmed;
                    });
                    if (columns.length < 1) continue;
                    const key = columns[0];
                    const values = columns.slice(1).join(', ');

                    if (key) jsonObj[key] = values || '';
                }
                if (Object.keys(jsonObj).length === 0) {
                    console.error(`No valid data found in CSV file "${file.name}"`);
                    return;
                }
            } else {
                console.error(`Unsupported file type: ${type} for file "${file.name}"`);
                return;
            }

            createJsonSlotFromValues(this, jsonObj);
        } catch (error) {
            console.error(`Error processing file "${file.name}":`, error);
        }
    }

    reload() {
        const slotValues = this.flush();
        if(slotValues.length > 0) {
            createJsonSlotsFromValues(this, slotValues, { clearSlots: true });
        }
    }
}

export function setupJsonSlot(containerID) {
    if (!instanceJsonSlotManager) {
        instanceJsonSlotManager = new JsonSlotManager(containerID);
    }
    return instanceJsonSlotManager;
}