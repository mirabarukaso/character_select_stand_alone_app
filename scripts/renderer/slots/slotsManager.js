export function flushSlots() {
    // Load LoRA slots and update the collapsed state of the LoRA tab
    globalThis.lora.flush();
    if(globalThis.lora.getSlots().length > 0 ) {
        globalThis.collapsedTabs.lora.setCollapsed(false);
    } else if(globalThis.collapsedTabs.lora.getCollapsed() === false) {
        globalThis.collapsedTabs.lora.setCollapsed(true);
    }

    // Load aDetailer slots and update the collapsed state of the aDetailer tab
    globalThis.aDetailer.flush();
    if(globalThis.aDetailer.getSlots().length > 0 ) {
        globalThis.collapsedTabs.aDetailer.setCollapsed(false);
    } else if(globalThis.collapsedTabs.aDetailer.getCollapsed() === false) {
        globalThis.collapsedTabs.aDetailer.setCollapsed(true);
    }
}