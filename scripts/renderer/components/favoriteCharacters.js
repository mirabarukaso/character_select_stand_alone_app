function normalizeFavoriteCharacter(value) {
    return String(value ?? '').trim();
}

function sortFavoriteList(list) {
    return [...list]
        .map(item => normalizeFavoriteCharacter(item))
        .filter(item => item !== '')
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

export function mergeFavoriteLists(...lists) {
    const merged = [];
    const seen = new Set();

    for (const list of lists) {
        if (!Array.isArray(list)) {
            continue;
        }

        for (const item of list) {
            const normalized = normalizeFavoriteCharacter(item);
            if (!normalized) {
                continue;
            }

            const key = normalized.toLowerCase();
            if (!seen.has(key)) {
                seen.add(key);
                merged.push(normalized);
            }
        }
    }

    return sortFavoriteList(merged);
}

export function compareAndMergeFavoriteLists(listA, listB) {
    const normalizedListA = sortFavoriteList(Array.isArray(listA) ? listA : []);
    const normalizedListB = sortFavoriteList(Array.isArray(listB) ? listB : []);

    if (normalizedListA.length !== normalizedListB.length) {
        return mergeFavoriteLists(normalizedListA, normalizedListB);
    }

    const isSame = normalizedListA.every((item, index) => item.toLowerCase() === normalizedListB[index].toLowerCase());
    if (isSame) {
        return null;
    }

    return mergeFavoriteLists(normalizedListA, normalizedListB);
}

export function addFavorites(character) {
    const fav_list = Array.isArray(globalThis.globalSettings?.fav_characters)
        ? [...globalThis.globalSettings.fav_characters]
        : [];

    const normalizedCharacter = String(character ?? '').trim();
    if (!normalizedCharacter || normalizedCharacter.toLowerCase() === 'none' || normalizedCharacter.toLowerCase() === 'random') {
        return false;
    }

    const mergedList = mergeFavoriteLists(fav_list, [normalizedCharacter]);
    const exists = fav_list.some(item => String(item ?? '').trim().toLowerCase() === normalizedCharacter.toLowerCase());
    if (!exists) {
        globalThis.globalSettings.fav_characters = mergedList;
        console.log('[addFavorites] Add', character, 'to list.');
    } else {
        globalThis.globalSettings.fav_characters = mergedList;
    }

    return true;
}

export function delFavorites(character) {
    const fav_list = Array.isArray(globalThis.globalSettings?.fav_characters)
        ? [...globalThis.globalSettings.fav_characters]
        : [];

    const normalizedCharacter = String(character ?? '').trim();
    if (!normalizedCharacter || normalizedCharacter.toLowerCase() === 'none' || normalizedCharacter.toLowerCase() === 'random') {
        return false;
    }

    const filteredList = fav_list.filter(item => String(item ?? '').trim().toLowerCase() !== normalizedCharacter.toLowerCase());
    const sortedList = sortFavoriteList(filteredList);
    globalThis.globalSettings.fav_characters = sortedList;

    if (filteredList.length !== fav_list.length) {
        console.log('[delFavorites] Remove', character, 'from list.');
    }

    return true;
}

