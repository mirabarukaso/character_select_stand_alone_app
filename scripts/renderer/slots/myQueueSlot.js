import { setupTextbox } from '../components/myTextbox.js';
import { generateGUID } from './myLoRASlot.js';
import { sendWebSocketMessage } from '../../../webserver/front/wsRequest.js';
let instanceQueueManager = null;

async function cancelGenerate(slotClass) {
    const generateData = instanceQueueManager.getSlotValue(slotClass);
    console.log(`Cancel current generate slot: ${slotClass} @ ${generateData.queueManager.apiInterface}`);

    let method;
    if (generateData.queueManager.apiInterface === 'ComfyUI') {
        method = 'cancelComfyUI';
    } else if (generateData.queueManager.apiInterface === 'WebUI') {
        method = 'cancelWebUI';
    }

    if (method) {
        if (globalThis.inBrowser) {
            await sendWebSocketMessage({ type: 'API', method });
        } else {
            await globalThis.api[method]();
        }
    }
}

// eslint-disable-next-line sonarjs/cognitive-complexity
async function deleteSlot(slotClass) {
    const index = instanceQueueManager.getSlots().indexOf(slotClass);
    if(index === 0 && !instanceQueueManager.cancelFirst) {        
        instanceQueueManager.cancelFirst = true;
       
        if(globalThis.mainGallery.isLoading) {            
            await cancelGenerate(slotClass);
        } else {
            instanceQueueManager.removeAt(0);
        }
    } else if (instanceQueueManager.cancelFirst){
        instanceQueueManager.removeAt(0);
        instanceQueueManager.cancelFirst = false;    
    } else {
        console.log(`Remove slot: ${slotClass} at ${index}`);
        instanceQueueManager.removeAt(index);
    }

    if(instanceQueueManager.getSlotsCount() === 0) {
        globalThis.generate.showCancelButtons(false);
    }
}

class QueueManager {
    constructor(containerSelector) {
        this.container = document.querySelector(`.${containerSelector}`);
        if (!this.container) {
            console.error(`Container with class "${containerSelector}" not found.`);
            return;
        }
        this.slotIndex = new Map();
        this.candidateClassName = null;
        this.componentInstances = new Map();
        this.cancelFirst = false;
        this.initialize();
        this.bindEvents();
    }

    initialize() {
        const candidateClassName = this.createCandidateRow();
        
        const candidateSlot = this.slotIndex.get(candidateClassName);
        if (candidateSlot) {
            const row = this.renderAddRow(candidateClassName, candidateSlot.itemClasses);
            this.container.appendChild(row);
        }
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
                await deleteSlot(slotClass);
            } else if (action === 'info') {                
                const generateData = this.getSlotValue(slotClass);

                globalThis.overlay.custom.createCustomOverlay(
                    (generateData.queueManager.thumb?.length>0) ? generateData.queueManager.thumb : [globalThis.cachedFiles.privacyBall], 
                    `${generateData.queueManager.finalInfo || ''}`,
                    384, 'center', 'left', null, 'Lora');
            }
        });
    }

    generateClassName(prefix) {
        return `${prefix}-${generateGUID()}`;
    }

    createCandidateRow() {
        const className = this.generateClassName('slot');
        const itemClasses = {
            add: this.generateClassName('slot-row-add'),
            jobID: this.generateClassName('slot-row-text'),
        };

        this.slotIndex.set(className, {
            itemClasses,
            items: new Map(),
            isCandidate: true,
            generateData: {}
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
            <div></div>
            <div></div>
        `;
        return row;
    }

    createSlotRow() {
        const slot = this.slotIndex.get(this.candidateClassName);

        // Convert candidate to content slot
        slot.isCandidate = false;
        slot.itemClasses.delete = this.generateClassName('slot-row-delete');
        slot.itemClasses.info = this.generateClassName('slot-row-info');
        delete slot.itemClasses.add;
        
        const slotColor = globalThis.generate.queueColor1st ? 'slot-row-text1' : 'slot-row-text2';
        slot.itemClasses.jobID = this.generateClassName(slotColor);
        
        const className = this.candidateClassName;

        // Update the DOM
        const candidateRow = this.container.querySelector(`.${className}`);
        if (candidateRow) {
            candidateRow.classList.remove('add-row');
            candidateRow.classList.add('content-row', 'queue-row');
        }

        // Create new candidate row
        const newCandidateClassName = this.createCandidateRow();
        const newCandidateSlot = this.slotIndex.get(newCandidateClassName);
        if (newCandidateSlot) {
            const newRow = this.renderAddRow(newCandidateClassName, newCandidateSlot.itemClasses);
            this.container.appendChild(newRow);
        }

        return className;
    }

    renderSlotRow(className, itemClasses) {
        const row = document.createElement('div');
        row.className = `slot-row content-row queue-row ${className}`;
        row.innerHTML = `
            <div class="slot-action slot-action-del ${itemClasses.delete}" data-action="delete" data-slot="${className}">
                <img class="slot-action-del-toggle" src="scripts/svg/del.svg" alt="-">
            </div>
            <div class="${itemClasses.jobID}"></div>            
            <div class="slot-action slot-action-info ${itemClasses.info}" data-action="info" data-slot="${className}">
                <img class="slot-action-info-toggle" src="scripts/svg/info.svg" alt="?">
            </div>
        `;
        return row;
    }

    initializeSlotComponents(className, jobID = '') {
        const slot = this.slotIndex.get(className);
        if (!slot) return;
        requestAnimationFrame(() => {
            const jobIDComponent = setupTextbox(
                slot.itemClasses.jobID,
                jobID[1],
                { value: jobID[0], placeholder:jobID[0], defaultTextColor: 'rgb(179,157,219)', maxLines: 1, readOnly: true },
                false,
                null,
                false,
                false
            );
            slot.items.set(slot.itemClasses.jobID, () => jobIDComponent);
            this.componentInstances.set(`${className}-${slot.itemClasses.jobID}`, jobIDComponent);            
        });
    }

    async handleAdd() {        
        globalThis.generate.generate_single.click();
    }

    getSlots() {
        return Array.from(this.slotIndex.keys()).filter(
            className => !this.slotIndex.get(className).isCandidate
        );
    }

    getSlotValue(slotClass) {
        const slot = this.slotIndex.get(slotClass);
        if (!slot) {
            console.log('Slot not found:', slotClass);
            return null;
        }

        return slot.generateData;
    }

    getFirstSlot() {
        this.cancelFirst = false;
        const slots = this.getSlots();
        if (slots.length === 0) {
            return null;
        }

        const firstSlotClass = slots[0];
        const generateData = this.getSlotValue(firstSlotClass);
        return generateData;
    }

    pop() {
        this.cancelFirst = false;
        const slots = this.getSlots();
        if (slots.length === 0) {
            return null;
        } else if (slots.length === 1) {
            this.removeAt(0);
            return null;
        }

        // slots > 1
        const nextSlotClass = slots[1];    //get next
        const generateData = this.getSlotValue(nextSlotClass);
        this.removeAt(0);   // remove generated
        return generateData;
    }
    
    attach(jobID = '', generateData={}) {
        const className = this.createSlotRow();
        if (!className) return;
        
        const slot = this.slotIndex.get(className);
        if (!slot) return;
        
        slot.generateData = generateData;
        
        const existingRow = this.container.querySelector(`.${className}`);
        if (existingRow) {
            existingRow.innerHTML = `
                <div class="slot-action slot-action-del ${slot.itemClasses.delete}" data-action="delete" data-slot="${className}">
                    <img class="slot-action-del-toggle" src="scripts/svg/del.svg" alt="-">
                </div>
                <div class="${slot.itemClasses.jobID}"></div>            
                <div class="slot-action slot-action-info ${slot.itemClasses.info}" data-action="info" data-slot="${className}">
                    <img class="slot-action-info-toggle" src="scripts/svg/info.svg" alt="?">
                </div>
            `;
        }

        this.initializeSlotComponents(className, jobID);
    }

    removeAt(index) {
        const slots = this.getSlots();
        if (index < 0 || index >= slots.length) {
            console.log(`Invalid index ${index} for removeAt. Slot count: ${slots.length}`);
            return;
        }

        const slotClass = slots[index];
        const slot = this.slotIndex.get(slotClass);
        if (slot) {
            for (const itemClass of Object.values(slot.itemClasses)) {
                this.componentInstances.delete(`${slotClass}-${itemClass}`);
            }
            const rowElement = this.container.querySelector(`.${slotClass}`);
            if (rowElement) {
                rowElement.remove();
            }
            this.slotIndex.delete(slotClass);
        }
    }

    removeAll() {
        const slots = this.getSlots();
        let slotsCount = slots.length;
        while (slotsCount > 0) {
            this.removeAt(0);
            slotsCount--;
        }
    }

    clear() {
        this.removeAll();
    }

    getValues() {
        const result = [];
        const slots = this.getSlots();

        for (const slotClass of slots) {
            const generateData = this.getSlotValue(slotClass);
            result.push(generateData);
        }

        return result;
    }

    getSlotsCount() {
        return this.getSlots().length;
    }
}

export function setupQueue(containerID) {
    if (!instanceQueueManager) {
        instanceQueueManager = new QueueManager(containerID);
    }
    return instanceQueueManager;
}
