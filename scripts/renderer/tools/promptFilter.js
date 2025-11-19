////////////////////////////////////////////////////////////////////////////////
// Parse a color-tagged prompt into a list of blocks
// block = { color, text, items }
////////////////////////////////////////////////////////////////////////////////
function parseColoredBlocks(promptColored) {
    const blocks = [];
    const regex = /\[color=([^\]]+)]([\s\S]*?)\[\/color]/gi;

    let match;
    while ((match = regex.exec(promptColored)) !== null) {
        const color = match[1];
        const text = match[2];

        const items = text
            .split(',')
            .map(s => s.trim())
            .filter(s => s.length > 0);

        blocks.push({ color, text, items });
    }
    return blocks;
}

////////////////////////////////////////////////////////////////////////////////
// Extract items from plain prompts
////////////////////////////////////////////////////////////////////////////////
function parsePlainPrompt(prompt) {
    return prompt
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0);
}

////////////////////////////////////////////////////////////////////////////////
// Filter items (fuzzy matching: brackets, weights)
////////////////////////////////////////////////////////////////////////////////
function normalize(item) {
    return item
        .replaceAll(/^\(+/g, '')
        .replaceAll(/\)+$/g, '')
        .replaceAll(/:\s*[\d.]+$/g, '')
        .trim()
        .toLowerCase();
}

function shouldRemove(item, excludeList) {
    return excludeList.some(ex => normalize(item) === normalize(ex));
}

////////////////////////////////////////////////////////////////////////////////
// Reconstruct the colored prompt in the order of the plain prompt (preserving colors)
////////////////////////////////////////////////////////////////////////////////
function rebuildColoredPrompt(plainItems, blocks, excludeList) {
    // Map items within the block to colors
    const colorMap = new Map();
    for (const block of blocks) {
        for (const item of block.items) {
            if (!shouldRemove(item, excludeList)) {
                colorMap.set(item, block.color);
            }
        }
    }

    const output = [];
    for (const item of plainItems) {
        if (shouldRemove(item, excludeList)) continue;

        const color = colorMap.get(item) || "white";
        output.push(`[color=${color}]${item}[/color]`);
    }

    return output.join(', ');
}

export function filterPrompts(positivePrompt, positivePromptColored, exclude) {
    const excludeList = exclude
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

    const plainItems = parsePlainPrompt(positivePrompt);
    const blocks = parseColoredBlocks(positivePromptColored);

    const newPlainPrompt = plainItems
        .filter(i => !shouldRemove(i, excludeList))
        .join(', ');

    const newColoredPrompt =
        rebuildColoredPrompt(plainItems, blocks, excludeList);

    return {
        positivePrompt: newPlainPrompt,
        positivePromptColored: newColoredPrompt
    };
}
