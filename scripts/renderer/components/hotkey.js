const MODIFIER_NAMES = new Set(['control', 'ctrl', 'alt', 'shift', 'meta', 'os']);

export const DEFAULT_HOTKEY_FAVORITE_ADD = Object.freeze({
    ctrl: false,
    alt: true,
    shift: false,
    key: 'd'
});

export const DEFAULT_HOTKEY_FAVORITE_DEL = Object.freeze({
    ctrl: false,
    alt: true,
    shift: false,
    key: 'q'
});

export const HOTKEY_MODIFIER_OPTIONS = ['none', 'ctrl', 'alt', 'shift'];

const LETTER_KEYS = [...'abcdefghijklmnopqrstuvwxyz'];
const DIGIT_KEYS = [...'0123456789'];
const FUNCTION_KEYS = ['f1', 'f2', 'f3', 'f6', 'f7', 'f8', 'f9', 'f10'];

export const HOTKEY_KEY_OPTIONS = [...LETTER_KEYS, ...DIGIT_KEYS, ...FUNCTION_KEYS];

const BLOCKED_KEYS = new Set(['f4', 'f5', 'f11', 'f12', 'tab', 'escape', 'enter', 'backspace']);

const BLOCKED_SIGNATURES = new Set([
    'alt+f4',
    'alt+space',
    'alt+tab',
    'alt+escape',
    'alt+z',
    'f5',
    'f11',
    'f12',
    'ctrl+r',
    'ctrl+shift+r',
    'ctrl+w',
    'ctrl+q',
    'ctrl+shift+i',
    'ctrl+c',
    'ctrl+v',
    'ctrl+x',
    'ctrl+a',
    'ctrl+z',
    'ctrl+y',
    'tab',
    'escape',
    'enter',
    'backspace'
]);

export function cloneHotkey(hotkey) {
    const normalized = normalizeHotkey(hotkey);
    if (!normalized) {
        return null;
    }
    return {
        ctrl: normalized.ctrl,
        alt: normalized.alt,
        shift: normalized.shift,
        key: normalized.key
    };
}

export function normalizeKey(key) {
    if (key == null) {
        return '';
    }
    const raw = String(key).trim().toLowerCase();
    if (!raw || MODIFIER_NAMES.has(raw) || raw === 'unidentified' || raw === 'dead' || raw === 'process') {
        return '';
    }
    if (raw === ' ' || raw === 'spacebar') {
        return 'space';
    }
    if (raw === 'esc') {
        return 'escape';
    }
    if (/^f([1-9]|1[0-2])$/.test(raw)) {
        return raw;
    }
    if (/^[a-z0-9]$/.test(raw)) {
        return raw;
    }
    return raw;
}

export function keyFromEvent(event) {
    const code = String(event?.code || '');
    if (/^Key[A-Z]$/.test(code)) {
        return code.slice(3).toLowerCase();
    }
    if (/^Digit\d$/.test(code)) {
        return code.slice(5);
    }
    if (/^Numpad\d$/.test(code)) {
        return code.slice(6);
    }
    if (/^F([1-9]|1[0-2])$/.test(code)) {
        return code.toLowerCase();
    }
    return normalizeKey(event?.key);
}

export function normalizeHotkey(raw) {
    if (!raw || typeof raw !== 'object') {
        return null;
    }
    const key = normalizeKey(raw.key);
    if (!key) {
        return null;
    }
    return {
        ctrl: Boolean(raw.ctrl),
        alt: Boolean(raw.alt),
        shift: Boolean(raw.shift),
        key
    };
}

export function hotkeyEquals(a, b) {
    const left = normalizeHotkey(a);
    const right = normalizeHotkey(b);
    if (!left || !right) {
        return false;
    }
    return left.ctrl === right.ctrl
        && left.alt === right.alt
        && left.shift === right.shift
        && left.key === right.key;
}

export function hotkeySignature(hotkey) {
    const normalized = normalizeHotkey(hotkey);
    if (!normalized) {
        return '';
    }
    const parts = [];
    if (normalized.ctrl) {
        parts.push('ctrl');
    }
    if (normalized.alt) {
        parts.push('alt');
    }
    if (normalized.shift) {
        parts.push('shift');
    }
    parts.push(normalized.key);
    return parts.join('+');
}

export function formatKeyLabel(key) {
    const normalized = normalizeKey(key);
    if (!normalized) {
        return '';
    }
    if (/^f\d{1,2}$/.test(normalized)) {
        return normalized.toUpperCase();
    }
    if (normalized.length === 1) {
        return normalized.toUpperCase();
    }
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export function formatHotkey(hotkey) {
    const normalized = normalizeHotkey(hotkey);
    if (!normalized) {
        return '';
    }
    const parts = [];
    if (normalized.ctrl) {
        parts.push('Ctrl');
    }
    if (normalized.alt) {
        parts.push('Alt');
    }
    if (normalized.shift) {
        parts.push('Shift');
    }
    parts.push(formatKeyLabel(normalized.key));
    return parts.join('+');
}

export function hotkeyToSelectValues(hotkey) {
    const normalized = normalizeHotkey(hotkey) || cloneHotkey(DEFAULT_HOTKEY_FAVORITE_ADD);
    const mods = [];
    if (normalized.ctrl) {
        mods.push('ctrl');
    }
    if (normalized.alt) {
        mods.push('alt');
    }
    if (normalized.shift) {
        mods.push('shift');
    }
    return {
        mod1: mods[0] || 'none',
        mod2: mods[1] || 'none',
        key: HOTKEY_KEY_OPTIONS.includes(normalized.key) ? normalized.key : 'd'
    };
}

export function selectValuesToHotkey(mod1, mod2, key) {
    const hotkey = {
        ctrl: false,
        alt: false,
        shift: false,
        key: normalizeKey(key)
    };
    for (const modifier of [mod1, mod2]) {
        if (modifier === 'ctrl') {
            hotkey.ctrl = true;
        } else if (modifier === 'alt') {
            hotkey.alt = true;
        } else if (modifier === 'shift') {
            hotkey.shift = true;
        }
    }
    return normalizeHotkey(hotkey);
}

export function matchesHotkey(event, hotkey) {
    const binding = normalizeHotkey(hotkey);
    if (!binding || !event) {
        return false;
    }
    if (event.metaKey) {
        return false;
    }
    return hotkeyEquals({
        ctrl: Boolean(event.ctrlKey),
        alt: Boolean(event.altKey),
        shift: Boolean(event.shiftKey),
        key: keyFromEvent(event)
    }, binding);
}

export function validateHotkey(hotkey, { otherHotkey } = {}) {
    const normalized = normalizeHotkey(hotkey);
    if (!normalized) {
        return { ok: false, code: 'need_key' };
    }
    if (!normalized.ctrl && !normalized.alt && !normalized.shift) {
        return { ok: false, code: 'need_modifier' };
    }
    if (BLOCKED_KEYS.has(normalized.key) || BLOCKED_SIGNATURES.has(hotkeySignature(normalized))) {
        return { ok: false, code: 'blocked', label: formatHotkey(normalized) };
    }
    if (otherHotkey && hotkeyEquals(normalized, otherHotkey)) {
        return { ok: false, code: 'conflict' };
    }
    return { ok: true, hotkey: cloneHotkey(normalized) };
}

export function validateHotkeyFromSelects(mod1, mod2, key, otherHotkey) {
    if (mod1 === 'none' && mod2 === 'none') {
        return { ok: false, code: 'need_modifier' };
    }
    if (mod1 !== 'none' && mod1 === mod2) {
        return { ok: false, code: 'duplicate_modifier' };
    }
    if (!normalizeKey(key)) {
        return { ok: false, code: 'need_key' };
    }
    return validateHotkey(selectValuesToHotkey(mod1, mod2, key), { otherHotkey });
}

export function ensureFavoriteHotkeys() {
    const settings = globalThis.globalSettings || {};
    let add = cloneHotkey(settings.hotkey_favorite_add) || cloneHotkey(DEFAULT_HOTKEY_FAVORITE_ADD);
    let del = cloneHotkey(settings.hotkey_favorite_del) || cloneHotkey(DEFAULT_HOTKEY_FAVORITE_DEL);

    if (!validateHotkey(add).ok) {
        add = cloneHotkey(DEFAULT_HOTKEY_FAVORITE_ADD);
    }
    if (!validateHotkey(del, { otherHotkey: add }).ok) {
        del = cloneHotkey(DEFAULT_HOTKEY_FAVORITE_DEL);
    }
    if (hotkeyEquals(add, del)) {
        add = cloneHotkey(DEFAULT_HOTKEY_FAVORITE_ADD);
    }

    settings.hotkey_favorite_add = add;
    settings.hotkey_favorite_del = del;
    return { add, del };
}
