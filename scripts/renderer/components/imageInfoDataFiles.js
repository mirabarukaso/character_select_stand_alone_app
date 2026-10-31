/**
 * Resolve a dropped/pasted file to a canonical jsonlist type.
 * Windows often reports empty or Excel MIME for CSV; .txt wildcards are text/plain.
 */
export function resolveJsonListFileType(file) {
    if (!file) return null;
    const name = (file.name || '').toLowerCase();
    const mime = (file.type || '').toLowerCase();
    const ext = name.includes('.') ? name.split('.').pop() : '';

    if (ext === 'json' || mime === 'application/json') {
        return 'application/json';
    }
    if (
        ext === 'csv' ||
        mime === 'text/csv' ||
        mime === 'application/csv' ||
        mime === 'application/vnd.ms-excel' ||
        mime === 'text/comma-separated-values'
    ) {
        return 'text/csv';
    }
    if (ext === 'txt' || mime === 'text/plain') {
        return 'text/plain';
    }
    return null;
}

export function isJsonListDataFile(file) {
    return resolveJsonListFileType(file) !== null;
}

// helper for pasted json/csv file items
export async function handlePastedJsonOrCsvFile(item, hideOverlay) {
    const file = item.getAsFile();
    if (!file) return false;
    const resolvedType = resolveJsonListFileType(file) || file.type;
    console.log('Pasted file:', file.name, resolvedType);
    await globalThis.jsonlist.addJsonSlotFromFile(file, resolvedType);
    globalThis.collapsedTabs.jsonlist.setCollapsed(false);
    hideOverlay();
    return true;
}

// helper for pasted plain text items (keeps async logic inside callback but not nested deeply)
export function handlePastedPlainTextItem(item, hideOverlay) {
    return new Promise((resolve) => {
        item.getAsString(async (text) => {
            try {
                // Try parsing as JSON
                JSON.parse(text);
                const file = new File([text], 'pasted_data.json', { type: 'application/json', lastModified: Date.now() });
                console.log('Pasted JSON text:', file.name);
                await globalThis.jsonlist.addJsonSlotFromFile(file, 'application/json');
                globalThis.collapsedTabs.jsonlist.setCollapsed(false);
                hideOverlay();
                resolve(true);
            } catch {
                // CSV if commas present; otherwise treat as line-based list (wildcards-style)
                if (text.includes(',')) {
                    const file = new File([text], 'pasted_data.csv', { type: 'text/csv', lastModified: Date.now() });
                    console.log('Pasted CSV text:', file.name);
                    await globalThis.jsonlist.addJsonSlotFromFile(file, 'text/csv');
                    globalThis.collapsedTabs.jsonlist.setCollapsed(false);
                    hideOverlay();
                    resolve(true);
                } else if (text.trim()) {
                    const file = new File([text], 'pasted_data.txt', { type: 'text/plain', lastModified: Date.now() });
                    console.log('Pasted plain text list:', file.name);
                    await globalThis.jsonlist.addJsonSlotFromFile(file, 'text/plain');
                    globalThis.collapsedTabs.jsonlist.setCollapsed(false);
                    hideOverlay();
                    resolve(true);
                } else {
                    console.warn('Pasted text is empty');
                    hideOverlay();
                    resolve(true);
                }
            }
        });
    });
}
