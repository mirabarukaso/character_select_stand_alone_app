const CAT = '[UiLayoutTabs]';

export const CHARACTER_ID = 'character';

export const ZONE_SEEDS = {
    left: 'generate-settings-static-left',
    right: 'generate-settings-static-right',
    top: CHARACTER_ID
};

export const TOP_ONLY_IDS = new Set([CHARACTER_ID]);
export const NOT_TOP_IDS = new Set([
    'generate-settings-static-left',
    'generate-settings-static-right'
]);

const COLLAPSE_KEYS = {
    'image-infobox': 'infoBox',
    'gallery-main': 'gallery',
    'gallery-thumb': 'thumb',
    'highres-fix': 'hires',
    'refiner': 'refiner',
    'controlnet': 'controlnet',
    'model-settings': 'modelSettings',
    'add-lora': 'lora',
    'system-settings': 'settings',
    'regional-condition': 'regional',
    'jsonlist': 'jsonlist',
    'adetailer': 'aDetailer',
    'queue': 'queueManager'
};

const SPECIAL_NAMES = {
    'gallery-main': 'Gallery',
    'gallery-thumb': 'Thumbnail',
    'prompt-text': 'Prompt',
    'generate-settings-static-left': 'Image',
    'generate-settings-static-right': 'Generate',
    [CHARACTER_ID]: 'Character'
};

const SPAN_IDS = {
    'system-settings': 'system-settings-span',
    'highres-fix': 'highres-fix-span',
    'refiner': 'refiner-span',
    'regional-condition': 'regional-condition-span',
    'image-infobox': 'image-infobox-span',
    'gallery-main': 'gallery-main-span',
    'gallery-thumb': 'gallery-thumb-span',
    'add-lora': 'add-lora-span',
    'model-settings': 'model-settings-span',
    'jsonlist': 'jsonlist-span',
    'controlnet': 'controlnet-span',
    'adetailer': 'adetailer-span',
    'queue': 'queue-span'
};

export function isTabHost(el) {
    return Boolean(el?.classList?.contains('layout-tab-host'));
}

export function getTabHost(el) {
    return el?.closest?.('.layout-tab-host') || null;
}

export function getHostPages(host) {
    if (!host) {
        return [];
    }
    return [...host.querySelectorAll(':scope > .layout-tab-pages > .layout-tab-page')]
        .map((page) => page.querySelector(':scope > [data-layout-id]'))
        .filter(Boolean);
}

export function getHostPageIds(host) {
    return getHostPages(host).map((panel) => panel.dataset.layoutId).filter(Boolean);
}

export function isLastHostPage(panel) {
    const host = getTabHost(panel);
    if (!host) {
        return false;
    }
    return getHostPages(host).length <= 1;
}

function getSpanTitle(panelId, scope) {
    const spanId = SPAN_IDS[panelId];
    if (!spanId) {
        return '';
    }
    const span = scope?.querySelector?.(`#${spanId}`) || document.getElementById(spanId);
    return span?.textContent?.trim() || '';
}

export function getPanelDefaultName(panelId, scope) {
    const spanTitle = getSpanTitle(panelId, scope);
    if (spanTitle) {
        return spanTitle;
    }
    if (SPECIAL_NAMES[panelId]) {
        return SPECIAL_NAMES[panelId];
    }
    return panelId;
}

export function getStoredTitle(host, panelId) {
    try {
        const titles = JSON.parse(host.dataset.tabTitles || '{}');
        const stored = titles[panelId];
        if (stored && stored !== panelId && stored !== getPanelDefaultName(panelId, host)) {
            return stored;
        }
    } catch {
        // ignore
    }
    return getPanelDefaultName(panelId, host);
}

export function setStoredTitle(host, panelId, title) {
    let titles = {};
    try {
        titles = JSON.parse(host.dataset.tabTitles || '{}');
    } catch {
        titles = {};
    }
    const trimmed = String(title || '').trim();
    if (!trimmed || trimmed === panelId || trimmed === getPanelDefaultName(panelId, host)) {
        delete titles[panelId];
    } else {
        titles[panelId] = trimmed;
    }
    host.dataset.tabTitles = JSON.stringify(titles);
}

export function expandPanel(panel) {
    const id = panel?.dataset?.layoutId;
    const key = COLLAPSE_KEYS[id];
    if (key && globalThis.collapsedTabs?.[key]) {
        globalThis.collapsedTabs[key].setCollapsed(false);
    }
}

export function setHostActive(host, pageId) {
    if (!host) {
        return;
    }
    const pages = getHostPageIds(host);
    const showBar = pages.length > 1;
    host.classList.toggle('layout-tab-multi', showBar);
    const active = pages.includes(pageId) ? pageId : pages[0];
    host.dataset.tabActive = active || '';

    for (const page of host.querySelectorAll(':scope > .layout-tab-pages > .layout-tab-page')) {
        const id = page.querySelector(':scope > [data-layout-id]')?.dataset.layoutId;
        page.hidden = !showBar ? false : id !== active;
        if (showBar && id === active) {
            expandPanel(page.querySelector(':scope > [data-layout-id]'));
        }
    }

    for (const label of host.querySelectorAll(':scope > .layout-tab-bar .layout-tab-label')) {
        label.classList.toggle('layout-tab-active', label.dataset.tabPage === active);
    }
}

function settingOn(key, fallback) {
    const settings = globalThis.globalSettings;
    if (settings && typeof settings[key] === 'boolean') {
        return settings[key];
    }
    try {
        return Boolean(fallback?.());
    } catch {
        return false;
    }
}

function slotsUsed(manager) {
    try {
        if (!manager) {
            return false;
        }
        if (typeof manager.getSlotsCount === 'function') {
            return manager.getSlotsCount() > 0;
        }
        if (typeof manager.getSlots === 'function') {
            return manager.getSlots().length > 0;
        }
    } catch {
        return false;
    }
    return false;
}

export function getTabLabelHint(panelId) {
    switch (panelId) {
        case 'highres-fix':
            return settingOn('api_hf_enable', () => globalThis.generate?.hifix?.getValue()) ? 'on' : '';
        case 'refiner':
            return settingOn('api_refiner_enable', () => globalThis.generate?.refiner?.getValue()) ? 'on' : '';
        case 'regional-condition':
            return settingOn('regional_condition', () => globalThis.generate?.regionalCondition?.getValue()) ? 'on' : '';
        case 'adetailer':
            return settingOn('api_adetailer_enable', () => globalThis.generate?.adetailer?.getValue()) ? 'on' : '';
        case 'controlnet':
            return settingOn('api_controlnet_enable', () => globalThis.generate?.controlnet?.getValue()) ? 'on' : '';
        case 'add-lora':
            return slotsUsed(globalThis.lora) ? 'on' : '';
        case 'jsonlist':
            return slotsUsed(globalThis.jsonlist) ? 'on' : '';
        case 'queue': {
            const running = settingOn('generate_auto_start', () => globalThis.generate?.queueAutostart?.getValue());
            if (!running) {
                return 'alert';
            }
            return slotsUsed(globalThis.queueManager) ? 'on' : '';
        }
        default:
            return '';
    }
}

const TAB_ENABLE_SWITCH = {
    'highres-fix': '.generate-hires-fix input',
    'refiner': '.generate-refiner input',
    'regional-condition': '.regional-condition-trigger-dummy input',
    'controlnet': '.generate-controlnet input',
    'adetailer': '.generate-adetailer input',
    'queue': '.queue-autostart-generate input'
};

function getOriginalEnableInput(panelId) {
    const sel = TAB_ENABLE_SWITCH[panelId];
    return sel ? document.querySelector(sel) : null;
}

function syncTabEnableSwitch(label, panelId) {
    const clone = label?.querySelector(':scope > .layout-tab-enable');
    const original = getOriginalEnableInput(panelId);
    if (!clone || !original) {
        return;
    }
    const on = Boolean(original.checked);
    clone.classList.toggle('is-on', on);
    clone.setAttribute('aria-checked', on ? 'true' : 'false');
    clone.disabled = original.disabled;
}

function attachTabEnableSwitch(label, panelId) {
    if (!label || !TAB_ENABLE_SWITCH[panelId] || label.querySelector(':scope > .layout-tab-enable')) {
        return;
    }
    const clone = document.createElement('button');
    clone.type = 'button';
    clone.className = 'layout-tab-enable';
    clone.setAttribute('role', 'switch');
    clone.setAttribute('aria-label', 'enable');
    clone.tabIndex = 0;
    clone.addEventListener('pointerdown', (event) => {
        event.stopPropagation();
    });
    clone.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const original = getOriginalEnableInput(panelId);
        if (!original || original.disabled) {
            return;
        }
        original.click();
        syncTabEnableSwitch(label, panelId);
        refreshTabLabelHints();
    });
    label.appendChild(clone);
    syncTabEnableSwitch(label, panelId);
}

function applyLabelHint(label, panelId) {
    if (!label) {
        return;
    }
    const hint = getTabLabelHint(panelId);
    label.classList.toggle('layout-tab-hint-on', hint === 'on');
    label.classList.toggle('layout-tab-hint-alert', hint === 'alert');
    syncTabEnableSwitch(label, panelId);
}

export function refreshTabLabelHints(host) {
    const hosts = host ? [host] : [...document.querySelectorAll('.layout-tab-host')];
    for (const item of hosts) {
        if (!item) {
            continue;
        }
        for (const label of item.querySelectorAll('.layout-tab-label')) {
            applyLabelHint(label, label.dataset.tabPage);
        }
    }
}

function setHostFolded(host, folded) {
    if (!host) {
        return;
    }
    host.classList.toggle('layout-tab-folded', Boolean(folded));
    if (folded) {
        host.dataset.tabFolded = '1';
    } else {
        delete host.dataset.tabFolded;
    }
    host.querySelector(':scope > .layout-tab-bar > .layout-tab-collapse')
        ?.classList.toggle('collapsed', Boolean(folded));
}

function ensureCollapseButton(host, bar) {
    let button = bar.querySelector(':scope > .layout-tab-collapse');
    if (button) {
        return button;
    }
    button = document.createElement('img');
    button.className = 'layout-tab-collapse';
    button.src = 'scripts/svg/mydropdown-arrow.svg';
    button.alt = '';
    button.draggable = false;
    button.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        event.stopPropagation();
    });
    button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const folded = !host.classList.contains('layout-tab-folded');
        setHostFolded(host, folded);
        host.dispatchEvent(new CustomEvent('layout-tab-folded', { bubbles: true }));
    });
    bar.appendChild(button);
    button.classList.toggle('collapsed', host.classList.contains('layout-tab-folded'));
    return button;
}

function rebuildTabBar(host) {
    const bar = host.querySelector(':scope > .layout-tab-bar');
    if (!bar) {
        return;
    }
    let labelsRoot = bar.querySelector(':scope > .layout-tab-labels');
    if (!labelsRoot) {
        labelsRoot = document.createElement('div');
        labelsRoot.className = 'layout-tab-labels';
        const collapse = bar.querySelector(':scope > .layout-tab-collapse');
        if (collapse) {
            collapse.before(labelsRoot);
        } else {
            bar.insertBefore(labelsRoot, bar.firstChild);
        }
    }
    labelsRoot.replaceChildren();
    for (const id of getHostPageIds(host)) {
        const label = document.createElement('div');
        label.className = 'layout-tab-label';
        label.dataset.tabPage = id;
        const title = document.createElement('span');
        title.className = 'layout-tab-label-title';
        title.textContent = getStoredTitle(host, id);
        label.appendChild(title);
        attachTabEnableSwitch(label, id);
        applyLabelHint(label, id);
        labelsRoot.appendChild(label);
    }
    ensureCollapseButton(host, bar);
}

function setPanelHeaderSpanHidden(panel, hidden) {
    if (!panel?.classList) {
        return;
    }
    panel.classList.toggle('layout-tab-hide-header-span', Boolean(hidden));
}

export function syncHostPanelHeaderSpans(host) {
    if (!host) {
        return;
    }
    const hide = getHostPages(host).length > 1;
    for (const panel of getHostPages(host)) {
        setPanelHeaderSpanHidden(panel, hide);
    }
}

export function refreshHostChrome(host) {
    if (!host) {
        return;
    }
    rebuildTabBar(host);
    const pages = getHostPageIds(host);
    const current = host.dataset.tabActive;
    const next = pages.includes(current) ? current : pages[0];
    setHostActive(host, next);
    syncHostPanelHeaderSpans(host);
}

export function createTabHost() {
    const host = document.createElement('div');
    host.className = 'layout-tab-host';
    host.dataset.layoutRole = 'tab-host';
    host.dataset.tabTitles = '{}';
    host.innerHTML = `
        <div class="layout-tab-bar">
            <div class="layout-tab-labels"></div>
        </div>
        <div class="layout-tab-pages"></div>
    `;
    const bar = host.querySelector('.layout-tab-bar');
    bar.addEventListener('click', (event) => {
        const label = event.target.closest('.layout-tab-label');
        if (!label || !host.contains(label)) {
            return;
        }
        setHostActive(host, label.dataset.tabPage);
    });
    bar.addEventListener('dblclick', (event) => {
        const label = event.target.closest('.layout-tab-label');
        if (!label || event.target.closest('.layout-tab-enable')) {
            return;
        }
        const title = label.querySelector('.layout-tab-label-title') || label;
        event.preventDefault();
        title.contentEditable = 'true';
        title.focus();
        const range = document.createRange();
        range.selectNodeContents(title);
        const sel = globalThis.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        const finish = () => {
            title.contentEditable = 'false';
            setStoredTitle(host, label.dataset.tabPage, title.textContent);
            title.textContent = getStoredTitle(host, label.dataset.tabPage);
            host.dispatchEvent(new CustomEvent('layout-tab-renamed', { bubbles: true }));
        };
        title.addEventListener('blur', finish, { once: true });
        title.addEventListener('keydown', (keyEvent) => {
            if (keyEvent.key === 'Enter') {
                keyEvent.preventDefault();
                title.blur();
            } else if (keyEvent.key === 'Escape') {
                title.textContent = getStoredTitle(host, label.dataset.tabPage);
                title.blur();
            }
        });
    });
    return host;
}

function wrapPanelInPage(panel) {
    const page = document.createElement('div');
    page.className = 'layout-tab-page';
    page.appendChild(panel);
    return page;
}

export function ensureHostForPanel(panel) {
    const existing = getTabHost(panel);
    if (existing) {
        return existing;
    }
    const host = createTabHost();
    panel.before(host);
    host.querySelector('.layout-tab-pages').appendChild(wrapPanelInPage(panel));
    refreshHostChrome(host);
    return host;
}

export function mergePanelIntoHost(host, panel, makeActive = true) {
    if (!host || !panel) {
        return host;
    }
    const sourceHost = getTabHost(panel);
    if (sourceHost === host) {
        return host;
    }
    if (sourceHost && getHostPages(sourceHost).length <= 1) {
        const inner = getHostPages(sourceHost)[0];
        if (inner) {
            panel = inner;
        }
    }
    const oldPage = panel.closest('.layout-tab-page');
    const pages = host.querySelector('.layout-tab-pages');
    pages.appendChild(wrapPanelInPage(panel));
    if (oldPage && oldPage.parentElement !== pages) {
        oldPage.remove();
    }
    if (sourceHost && sourceHost !== host) {
        cleanupTabHost(sourceHost);
    }
    for (const inner of getHostPages(host)) {
        expandPanel(inner);
    }
    refreshHostChrome(host);
    if (makeActive) {
        setHostActive(host, panel.dataset.layoutId);
    }
    return host;
}

export function movePageInHost(host, panel, beforePanel) {
    if (!host || !panel) {
        return;
    }
    const page = panel.closest('.layout-tab-page');
    const pagesRoot = host.querySelector(':scope > .layout-tab-pages');
    if (!page || !pagesRoot || !host.contains(page)) {
        return;
    }
    if (beforePanel === panel) {
        refreshHostChrome(host);
        setHostActive(host, panel.dataset.layoutId);
        return;
    }
    if (beforePanel) {
        const beforePage = beforePanel.closest('.layout-tab-page');
        if (beforePage && beforePage !== page) {
            beforePage.before(page);
        }
    } else if (page.nextElementSibling) {
        pagesRoot.appendChild(page);
    }
    refreshHostChrome(host);
    setHostActive(host, panel.dataset.layoutId);
}

export function extractPanelFromHost(panel, beforeEl, allowLast = false) {
    const host = getTabHost(panel);
    if (!host) {
        return panel;
    }
    const onlyPage = getHostPages(host).length <= 1;
    if (onlyPage && !allowLast) {
        return host;
    }
    const page = panel.closest('.layout-tab-page');
    if (beforeEl) {
        beforeEl.before(panel);
    } else {
        host.after(panel);
    }
    page?.remove();
    setPanelHeaderSpanHidden(panel, false);
    cleanupTabHost(host);
    return panel;
}

export function readHostEntry(host) {
    if (!isTabHost(host)) {
        return null;
    }
    const pages = getHostPageIds(host);
    if (pages.length === 0) {
        return null;
    }
    if (pages.length === 1) {
        return pages[0];
    }
    let rawTitles = {};
    try {
        rawTitles = JSON.parse(host.dataset.tabTitles || '{}');
    } catch {
        rawTitles = {};
    }
    const titles = {};
    for (const id of pages) {
        const stored = rawTitles[id];
        if (stored && stored !== id && stored !== getPanelDefaultName(id, host)) {
            titles[id] = stored;
        }
    }
    const entry = {
        type: 'tab-host',
        active: host.dataset.tabActive || pages[0],
        titles,
        pages
    };
    if (host.classList.contains('layout-tab-folded')) {
        entry.folded = true;
    }
    return entry;
}

export function mountHostFromEntry(entry, panelMap) {
    const host = createTabHost();
    if (entry.titles && typeof entry.titles === 'object') {
        host.dataset.tabTitles = JSON.stringify(entry.titles);
    }
    const pagesRoot = host.querySelector('.layout-tab-pages');
    for (const id of entry.pages || []) {
        const panel = panelMap[id];
        if (panel) {
            pagesRoot.appendChild(wrapPanelInPage(panel));
            expandPanel(panel);
        }
    }
    if (getHostPages(host).length === 0) {
        return null;
    }
    refreshHostChrome(host);
    if (entry.active) {
        setHostActive(host, entry.active);
    }
    if (entry.folded) {
        setHostFolded(host, true);
    }
    return host;
}

export function cleanupTabHost(host) {
    if (!isTabHost(host)) {
        return;
    }
    if (!host.isConnected) {
        host.remove();
        return;
    }
    for (const page of [...host.querySelectorAll(':scope > .layout-tab-pages > .layout-tab-page')]) {
        if (!page.querySelector(':scope > [data-layout-id]')) {
            page.remove();
        }
    }
    const remaining = getHostPages(host);
    if (remaining.length === 0) {
        host.remove();
        return;
    }
    if (remaining.length === 1) {
        unwrapHost(host);
        return;
    }
    refreshHostChrome(host);
}

export function pruneTabHosts(root = document) {
    for (const host of [...(root?.querySelectorAll?.('.layout-tab-host') || [])]) {
        cleanupTabHost(host);
    }
}

export function unwrapHost(host) {
    if (!isTabHost(host)) {
        return;
    }
    const parent = host.parentElement;
    if (!parent) {
        host.remove();
        return;
    }
    for (const panel of getHostPages(host)) {
        setPanelHeaderSpanHidden(panel, false);
        host.before(panel);
    }
    host.remove();
}

export function ensureSeedHost(panel) {
    if (!panel) {
        console.warn(CAT, 'Seed panel missing');
        return null;
    }
    return ensureHostForPanel(panel);
}

export function collectColumnLayout(column) {
    const result = [];
    if (!column) {
        return result;
    }
    for (const child of column.children) {
        if (isTabHost(child)) {
            const entry = readHostEntry(child);
            if (entry) {
                result.push(entry);
            }
            continue;
        }
        if (child.dataset?.layoutId) {
            result.push(child.dataset.layoutId);
        }
    }
    return result;
}

export function zoneOfColumn(column) {
    if (!column) {
        return null;
    }
    if (column.id === 'left') {
        return 'left';
    }
    if (column.id === 'right') {
        return 'right';
    }
    if (column.id === 'full-width') {
        return 'top';
    }
    return null;
}

export function panelZoneAllowed(panelId, zone) {
    if (!panelId || !zone) {
        return false;
    }
    if (TOP_ONLY_IDS.has(panelId) && zone !== 'top') {
        return false;
    }
    if (NOT_TOP_IDS.has(panelId) && zone === 'top') {
        return false;
    }
    return true;
}

export function hostZoneAllowed(host, zone) {
    return getHostPageIds(host).every((id) => panelZoneAllowed(id, zone));
}
