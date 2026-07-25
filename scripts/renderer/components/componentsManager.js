export function get_prompt_textBox_Heights(){
    const common = globalThis.prompt.common.getHeight();
    const pos = globalThis.prompt.positive.getHeight();
    const posr = globalThis.prompt.positive_right.getHeight();
    const neg = globalThis.prompt.negative.getHeight();
    const ai = globalThis.prompt.ai.getHeight();
    const exc = globalThis.prompt.exclude.getHeight();

    console.log([common, pos, posr, neg, ai, exc]);
    return [common, pos, posr, neg, ai, exc];    
}

export function set_prompt_textBox_Heights(){
    const heights = Array.isArray(globalThis.globalSettings?.ptompt_textbox_heights)
        ? globalThis.globalSettings.ptompt_textbox_heights
        : [3, 3, 3, 3, 3, 3];
    const [common = 3, pos = 3, posr = 3, neg = 3, ai = 3, exc = 3] = heights;

    globalThis.prompt.common.setHeight(common);
    globalThis.prompt.positive.setHeight(pos);
    globalThis.prompt.positive_right.setHeight(posr);
    globalThis.prompt.negative.setHeight(neg);
    globalThis.prompt.ai.setHeight(ai);
    globalThis.prompt.exclude.setHeight(exc);
}

