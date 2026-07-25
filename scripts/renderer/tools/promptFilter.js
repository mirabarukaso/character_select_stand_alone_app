////////////////////////////////////////////////////////////////////////////////
// Helper Function: Escape special characters for Regular Expressions
////////////////////////////////////////////////////////////////////////////////
function escapeRegExp(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

////////////////////////////////////////////////////////////////////////////////
// Basic Normalization: Strip prompt weight modifiers like (1.2), (tag:1.3), 
// or [tag] to allow precise tag matching
////////////////////////////////////////////////////////////////////////////////
function normalizeTag(tag) {
    return tag
        .replaceAll(/^\(+/g, '')
        .replaceAll(/\)+$/g, '')    // NOSONAR S8786
        .replaceAll(/:\s*[\d.]+$/g, '')
        .trim();
}

////////////////////////////////////////////////////////////////////////////////
// Cleanup Formatting: Remove redundant commas, whitespace, and empty [color] tags
// Preserves newlines (\n) and line-ending commas specifically for Diffusion prompts
////////////////////////////////////////////////////////////////////////////////
function cleanPromptText(text) {
    return text
        // Remove empty [color=xxx][/color] blocks or those containing only spaces/commas/semicolons
        .replaceAll(/\[color=[^\]]+\][\s,;]*\[\/color\]/gi, '')
        // Normalize spaces around commas while preserving surrounding newlines
        .replaceAll(/[ \t]*,[ \t]*/g, ', ') // NOSONAR S8786
        // Remove duplicate consecutive commas (e.g. "tag1,, tag2" -> "tag1, tag2")
        .replaceAll(/(,[ \t]*)+,/g, ',')
        // Clean multiple consecutive horizontal spaces (spaces and tabs only, leaving \n intact)
        .replaceAll(/[ \t]{2,}/g, ' ')
        // Trim spaces at line start/end, but preserve commas at line endings
        .replaceAll(/^[ \t,]+|[ \t]+$/gm, '')   // NOSONAR S8786
        // Clean up leading/trailing empty lines or trailing commas at the very end of the prompt
        .trim();
}

////////////////////////////////////////////////////////////////////////////////
// Core Processing Logic: Handles both tag replacement (key:value) 
// and tag removal (plain tag)
////////////////////////////////////////////////////////////////////////////////
// eslint-disable-next-line sonarjs/cognitive-complexity
function processExcludedTags(text, excludeList) {
    if (!text || !excludeList.length) return text;

    const replacementItems = []; // [{ target, replacement }]
    const removalTags = [];       // [ tag ]

    // 1. Categorize excludeList items into replacements and removals
    for (const item of excludeList) {
        if (item.includes(':')) {
            const parts = item.split(':');
            const target = normalizeTag(parts[0]);
            const replacement = parts.slice(1).join(':').trim(); // Support replacements that might contain colons
            if (target && replacement) {
                replacementItems.push({ target, replacement });
            }
        } else {
            const tag = normalizeTag(item);
            if (tag) {
                removalTags.push(tag);
            }
        }
    }

    let resultText = text;

    // 2. Perform Tag Replacements (Sorted by target length descending)
    if (replacementItems.length > 0) {
        replacementItems.sort((a, b) => b.target.length - a.target.length);

        for (const { target, replacement } of replacementItems) {
            const escapedTarget = escapeRegExp(target);
            // Regex captures optional leading brackets ($1), weight modifier ($2), and trailing brackets ($3)
            const replaceRegex = new RegExp(String.raw`(\(+)?\b${escapedTarget}\b(:[\d.]+)?(\)*)`, 'gi');
            
            resultText = resultText.replace(replaceRegex, (match, p1 = '', p2 = '', p3 = '') => {
                return `${p1}${replacement}${p2}${p3}`;
            });
        }
    }

    // 3. Perform Tag Removals (Sorted by tag length descending)
    if (removalTags.length > 0) {
        removalTags.sort((a, b) => b.length - a.length);

        const patterns = removalTags.map(tag => {
            const escaped = escapeRegExp(tag);
            return String.raw`(?:\(+)?\b${escaped}\b(?::[\d.]+)?\)*`;
        });

        const removeRegex = new RegExp(patterns.join('|'), 'gi');
        resultText = resultText.replace(removeRegex, '');
    }

    // 4. Clean up structural artifacts (isolated commas and spaces left after removal/replacement)
    return cleanPromptText(resultText);
}

////////////////////////////////////////////////////////////////////////////////
// Exported Entry Function
////////////////////////////////////////////////////////////////////////////////
export function filterPrompts(positivePrompt, positivePromptColored, exclude) {
    const excludeList = exclude
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

    if (excludeList.length === 0) {
        return { positivePrompt, positivePromptColored };
    }

    // Process positivePrompt directly while preserving \n and line-end commas
    const newPlainPrompt = processExcludedTags(positivePrompt, excludeList);

    // Process positivePromptColored with full tag and color cleanup
    const newColoredPrompt = processExcludedTags(positivePromptColored, excludeList);

    return {
        positivePrompt: newPlainPrompt,
        positivePromptColored: newColoredPrompt
    };
}