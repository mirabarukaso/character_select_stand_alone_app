export function addFavorites(character) {
    const fav_list = Array.isArray(globalThis.globalSettings?.fav_characters)
        ? globalThis.globalSettings.fav_characters
        : [];

    const normalizedCharacter = String(character ?? '').trim();
    if (!normalizedCharacter || normalizedCharacter.toLowerCase() === 'none' ||  normalizedCharacter.toLowerCase() === 'random') {
        return false;
    }

    const exists = fav_list.some(item => String(item ?? '').trim().toLowerCase() === normalizedCharacter.toLowerCase());
    if (!exists) {
        fav_list.push(normalizedCharacter);
        globalThis.globalSettings.fav_characters = fav_list;
        console.log('[addFavorites] Add',character, 'to list.')
    }

    return true;
}

export function delFavorites(character) {
    const fav_list = Array.isArray(globalThis.globalSettings?.fav_characters)
        ? globalThis.globalSettings.fav_characters
        : [];

    const normalizedCharacter = String(character ?? '').trim();
    if (!normalizedCharacter || normalizedCharacter.toLowerCase() === 'none' ||  normalizedCharacter.toLowerCase() === 'random') {
        return false;
    }

    const index = fav_list.findIndex(item => String(item ?? '').trim().toLowerCase() === normalizedCharacter.toLowerCase());
    if (index !== -1) {
        fav_list.splice(index, 1);
        globalThis.globalSettings.fav_characters = fav_list;
        console.log('[delFavorites] Remove',character, 'from list.')
    }

    return true;
}
