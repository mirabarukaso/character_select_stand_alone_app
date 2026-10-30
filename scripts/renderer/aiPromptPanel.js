import { mySimpleList } from './components/myDropdown.js';
import { setupSlider } from './components/mySlider.js';
import { setupButtons } from './components/myButtons.js';
import { setupCheckbox } from './components/myCheckbox.js';
import { setupTextbox } from './components/myTextbox.js';
import { showDialog } from './components/myDialog.js';
import { sendWebSocketMessage } from '../webserver/front/wsRequest.js';
import { requestAiCompletion, cancelAiCompletion } from './remoteAI.js';
import { collectAiSource } from './aiPromptCollect.js';

const SOURCE_IDS = ['brief', 'common', 'positive', 'positive_right', 'negative', 'character', 'full'];
const APPLY_IDS = ['common', 'positive', 'positive_right', 'negative'];
const APPLY_KEYS = {
    common: 'custom_prompt',
    positive: 'api_prompt',
    positive_right: 'api_prompt_right',
    negative: 'api_neg_prompt'
};

let templates = [];
let activeId = '';
let suppress = false;
let saveTimer = 0;
let pendingNotice = '';
let characterSlot = 0;
let applySelection = 'positive';
let ui = null;
let runMode = 'idle';
let runToken = 0;
let activeRequestId = '';

const RUN_COOLDOWN_MS = 200;
const AI_SETTING_KEYS = [
    'ai_prompt',
    'ai_template',
    'ai_prompt_source',
    'ai_interface',
    'remote_ai_base_url',
    'remote_ai_api_key',
    'ai_local_addr',
    'remote_ai_model',
    'remote_ai_timeout',
    'ai_local_temp',
    'ai_local_n_predict',
    'ai_prompt_role',
    'ai_prompt_preview'
];

function lang() {
    return globalThis.cachedFiles.language[globalThis.globalSettings.language];
}

function splitList(text) {
    return String(text || '').split(',').map((item) => item.trim()).filter(Boolean);
}

function sourceLabels() {
    const labels = splitList(lang().ai_prompt_sources);
    return SOURCE_IDS.map((id, index) => labels[index] || id);
}

function applyLabels() {
    const labels = splitList(lang().ai_prompt_apply_targets);
    return APPLY_IDS.map((id, index) => labels[index] || id);
}

function labelFor(ids, labels, id) {
    const index = ids.indexOf(id);
    return labels[index] || labels[0];
}

function idFor(ids, labels, label) {
    const index = labels.indexOf(label);
    return ids[index] || ids[0];
}

function activeTemplate() {
    return templates.find((item) => item.id === activeId) || templates[0] || null;
}

function templateLabel(template) {
    const same = templates.filter((item) => item.name === template.name);
    if (same.length > 1) return `${template.name} (${template.id})`;
    return template.name;
}

function templateFromLabel(label) {
    return templates.find((item) => templateLabel(item) === label) || null;
}

function notice(text) {
    if (!text) return;
    if (globalThis.overlay?.custom?.createErrorOverlay) {
        globalThis.overlay.custom.createErrorOverlay(text, text);
        return;
    }
    pendingNotice = text;
}

export function flushAiPromptNotice() {
    if (!pendingNotice) return;
    const text = pendingNotice;
    pendingNotice = '';
    notice(text);
}

async function loadStore() {
    if (globalThis.inBrowser) {
        return sendWebSocketMessage({ type: 'API', method: 'loadAiPromptTemplates' });
    }
    return globalThis.api.loadAiPromptTemplates();
}

async function saveStore() {
    const payload = { templates };
    if (globalThis.inBrowser) {
        return sendWebSocketMessage({ type: 'API', method: 'saveAiPromptTemplates', params: [payload] });
    }
    return globalThis.api.saveAiPromptTemplates(payload);
}

function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        saveStore().catch((error) => console.error('[AiPrompt] save failed', error));
    }, 400);
}

function writeWidgetsToActive() {
    const template = activeTemplate();
    if (!template || !ui) return;
    template.model = String(ui.model.getValue() || '');
    template.timeout = ui.timeout.getValue();
    template.temperature = Math.round(ui.temperature.getFloat() * 10) / 10;
    template.maxTokens = ui.tokens.getValue();
    template.systemPrompt = String(ui.system.getValue() || '');
    template.defaultSource = globalThis.globalSettings.ai_prompt_source || template.defaultSource;
    template.characterSlot = characterSlot + 1;
}

function fillWidgets(template) {
    if (!template || !ui) return;
    suppress = true;
    ui.model.setValue(template.model);
    ui.timeout.setValue(template.timeout);
    ui.temperature.setValue(template.temperature);
    ui.tokens.setValue(template.maxTokens);
    ui.system.setValue(template.systemPrompt);
    suppress = false;
}

function refreshTemplateList(selectId) {
    if (!templates.length || !ui?.templates) return;
    const labels = templates.map((item) => templateLabel(item));
    const selected = templates.find((item) => item.id === selectId) || templates[0];
    ui.templates.setOptions(labels, null, lang().ai_prompt_template, templateLabel(selected));
    activeId = selected.id;
    globalThis.globalSettings.ai_template = selected.id;
    fillWidgets(selected);
}

function onTemplateEdited() {
    if (suppress) return;
    writeWidgetsToActive();
    const template = activeTemplate();
    if (!template) return;
    const labels = templates.map((item) => templateLabel(item));
    suppress = true;
    ui.templates.setOptions(labels, null, lang().ai_prompt_template, templateLabel(template));
    suppress = false;
    scheduleSave();
}

function slotFromTemplate(template) {
    const slot = Number(template?.characterSlot);
    if (slot >= 1 && slot <= 4) return slot - 1;
    return 0;
}

function applyTemplateSource(template) {
    if (!template) return;
    globalThis.globalSettings.ai_prompt_source = template.defaultSource || 'brief';
    characterSlot = slotFromTemplate(template);
    ui.source.updateDefaults(labelFor(SOURCE_IDS, sourceLabels(), globalThis.globalSettings.ai_prompt_source));
    ui.character.updateDefaults(String(characterSlot + 1));
    syncCharacterVisibility();
}

function selectTemplateByLabel(label) {
    const next = templateFromLabel(label);
    if (!next || next.id === activeId) return;
    writeWidgetsToActive();
    activeId = next.id;
    globalThis.globalSettings.ai_template = next.id;
    fillWidgets(next);
    applyTemplateSource(next);
    scheduleSave();
}

function syncCharacterVisibility() {
    const show = globalThis.globalSettings.ai_prompt_source === 'character';
    const node = document.querySelector('.ai-prompt-character');
    if (node) node.style.display = show ? '' : 'none';
}

function bindBackend() {
    ui.interface = mySimpleList('ai-prompt-interface', lang().ai_interface, ['None', 'Remote', 'Local'],
        (index, value) => {
            const picked = Array.isArray(value) ? value[0] : value;
            globalThis.globalSettings.ai_interface = picked || ui.interface.getValue();
        }, 5, false, true);
    ui.remoteAddress = setupTextbox('ai-prompt-remote-address', lang().remote_ai_base_url, {
        value: globalThis.globalSettings.remote_ai_base_url,
        maxLines: 1
    }, true, (value) => { globalThis.globalSettings.remote_ai_base_url = value; });
    ui.remoteKey = setupTextbox('ai-prompt-remote-key', 'API Key', {
        value: globalThis.globalSettings.remote_ai_api_key,
        defaultTextColor: 'CornflowerBlue',
        maxLines: 1
    }, true, (value) => { globalThis.globalSettings.remote_ai_api_key = value; }, true);
    ui.localAddress = setupTextbox('ai-prompt-local-address', lang().ai_local_addr, {
        value: globalThis.globalSettings.ai_local_addr,
        maxLines: 1
    }, true, (value) => { globalThis.globalSettings.ai_local_addr = value; });
    ui.interface.updateDefaults(globalThis.globalSettings.ai_interface || 'None');
}

function bindTemplateFields(first) {
    ui.model = setupTextbox('ai-prompt-model', lang().ai_prompt_model, {
        value: first?.model || '',
        maxLines: 1
    }, true, () => onTemplateEdited());
    ui.timeout = setupSlider('ai-prompt-timeout', lang().ai_prompt_timeout,
        { min: 2, max: 180, step: 1, defaultValue: first?.timeout || 20 },
        () => onTemplateEdited());
    ui.temperature = setupSlider('ai-prompt-temperature', lang().ai_prompt_temperature,
        { min: 0, max: 2, step: 0.1, defaultValue: first?.temperature || 0.7 },
        () => onTemplateEdited());
    ui.tokens = setupSlider('ai-prompt-tokens', lang().ai_prompt_max_tokens,
        { min: 64, max: 8192, step: 64, defaultValue: first?.maxTokens || 256 },
        () => onTemplateEdited());
    ui.system = setupTextbox('ai-prompt-system', lang().ai_prompt_system, {
        value: first?.systemPrompt || '',
        minLines: 8,
        maxLines: 18
    }, false, () => onTemplateEdited());
}

function currentSourceId() {
    return idFor(SOURCE_IDS, sourceLabels(), ui.source.getValue());
}

function currentApplyId() {
    return idFor(APPLY_IDS, applyLabels(), ui.applyTarget.getValue());
}

function paintRunButton() {
    if (!ui?.run) return;
    const text = lang();
    const cancelLook = runMode === 'running' || runMode === 'cooling';
    const button = document.querySelector('.myButton-ai-prompt-run');
    if (button) button.classList.toggle('is-cancel', cancelLook);
    ui.run.setTitle(cancelLook ? text.ai_prompt_cancel : text.ai_prompt_run);
    ui.run.setClickable(runMode === 'idle' || runMode === 'running');
}

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export function takeInheritSnapshot() {
    if (!ui?.inherit?.getValue()) return null;
    const settings = globalThis.globalSettings || {};
    const snapshot = {};
    for (const key of AI_SETTING_KEYS) {
        if (Object.hasOwn(settings, key)) snapshot[key] = settings[key];
    }
    return snapshot;
}

export function applyInheritSnapshot(snapshot) {
    if (!snapshot || !globalThis.globalSettings) return;
    for (const [key, value] of Object.entries(snapshot)) {
        globalThis.globalSettings[key] = value;
    }
    ui?.inherit?.setValue(false);
}

function beginCancel() {
    if (runMode !== 'running') return;
    const token = ++runToken;
    runMode = 'cooling';
    paintRunButton();
    cancelAiCompletion(activeRequestId);
    setTimeout(() => {
        if (token !== runToken) return;
        runMode = 'idle';
        activeRequestId = '';
        paintRunButton();
    }, RUN_COOLDOWN_MS);
}

async function startRun() {
    const text = lang();
    writeWidgetsToActive();
    const template = activeTemplate();
    const iface = String(globalThis.globalSettings.ai_interface || 'None');
    if (iface.toLowerCase() === 'none') {
        notice(text.ai_prompt_interface_none);
        return;
    }
    const source = currentSourceId();
    globalThis.globalSettings.ai_prompt_source = source;
    const collected = collectAiSource(source, ui.brief.getValue(), characterSlot);
    if (!collected.ok) {
        notice(collected.error === 'random' ? text.ai_prompt_character_empty : text.ai_prompt_empty);
        return;
    }
    const token = ++runToken;
    activeRequestId = `ai-${Date.now().toString(36)}-${token}`;
    runMode = 'arming';
    paintRunButton();
    const outcomePromise = requestAiCompletion({
        requestId: activeRequestId,
        interface: iface,
        apiUrl: iface.toLowerCase() === 'remote'
            ? globalThis.globalSettings.remote_ai_base_url
            : globalThis.globalSettings.ai_local_addr,
        apiKey: globalThis.globalSettings.remote_ai_api_key,
        model: template.model,
        modelSelect: template.model,
        userPrompt: collected.text,
        systemPrompt: template.systemPrompt,
        timeout: Number(template.timeout) * 1000,
        temperature: Number(template.temperature),
        maxTokens: Number(template.maxTokens),
        n_predict: Number(template.maxTokens)
    });
    const raced = await Promise.race([
        outcomePromise.then((value) => ({ done: true, value })),
        delay(RUN_COOLDOWN_MS).then(() => ({ done: false }))
    ]);
    if (token !== runToken) return;
    if (!raced.done) {
        runMode = 'running';
        paintRunButton();
    }
    const outcome = raced.done ? raced.value : await outcomePromise;
    if (token !== runToken || (runMode !== 'arming' && runMode !== 'running')) return;
    runMode = 'idle';
    activeRequestId = '';
    paintRunButton();
    if (outcome?.cancelled) return;
    if (!outcome?.text) {
        notice(outcome?.error || text.ai_prompt_failed);
        return;
    }
    ui.result.setValue(outcome.text);
}

function onRunClicked() {
    if (runMode === 'running') {
        beginCancel();
        return;
    }
    if (runMode !== 'idle') return;
    startRun();
}

function applyResult(mode) {
    const text = String(ui.result.getValue() || '').trim();
    if (!text) return;
    const target = currentApplyId();
    const box = {
        common: globalThis.prompt.common,
        positive: globalThis.prompt.positive,
        positive_right: globalThis.prompt.positive_right,
        negative: globalThis.prompt.negative
    }[target];
    if (!box?.getValue) return;
    const next = mode === 'append' && String(box.getValue() || '').trim()
        ? `${String(box.getValue()).trim()}\n${text}`
        : text;
    box.setValue(next);
    const key = APPLY_KEYS[target];
    if (key) globalThis.globalSettings[key] = next;
}

async function saveNamedTemplate() {
    const text = lang();
    const current = activeTemplate();
    if (!current) return;
    writeWidgetsToActive();
    const entered = await showDialog('input', {
        message: text.ai_prompt_save_name,
        placeholder: current.name,
        defaultValue: current.name,
        buttonText: text.setup_ok,
        cancelText: text.setup_cancel
    });
    if (entered == null) return;
    const name = String(entered).trim();
    if (!name) return;
    writeWidgetsToActive();
    const latest = activeTemplate();
    if (!latest) return;
    if (name !== latest.name) {
        const copy = structuredClone(latest);
        copy.id = `custom-${Date.now().toString(36)}`;
        copy.name = name;
        templates.push(copy);
        refreshTemplateList(copy.id);
    }
    clearTimeout(saveTimer);
    try {
        await saveStore();
    } catch (error) {
        console.error('[AiPrompt] save failed', error);
    }
}

async function loadBuiltinTemplates() {
    if (globalThis.inBrowser) {
        return sendWebSocketMessage({ type: 'API', method: 'loadBuiltinAiTemplates' });
    }
    return globalThis.api.loadBuiltinAiTemplates();
}

async function applyBuiltinTemplates(replaceAll) {
    const builtins = await loadBuiltinTemplates();
    if (!Array.isArray(builtins) || !builtins.length) {
        notice(lang().ai_prompt_last);
        return;
    }
    if (!replaceAll) writeWidgetsToActive();
    const selectId = replaceAll ? builtins[0].id : (activeTemplate()?.id || builtins[0].id);
    if (replaceAll) {
        templates = builtins.map((item) => structuredClone(item));
    } else {
        for (const builtin of builtins) {
            const copy = structuredClone(builtin);
            const index = templates.findIndex((item) => item.id === copy.id);
            if (index >= 0) templates[index] = copy;
            else templates.push(copy);
        }
    }
    const selected = templates.find((item) => item.id === selectId) || templates[0];
    globalThis.globalSettings.ai_template = selected.id;
    refreshTemplateList(selected.id);
    applyTemplateSource(selected);
    clearTimeout(saveTimer);
    try {
        await saveStore();
    } catch (error) {
        console.error('[AiPrompt] save failed', error);
    }
}

async function restoreBuiltinTemplates() {
    const text = lang();
    const confirmed = await showDialog('confirm', {
        message: text.ai_prompt_restore_confirm,
        yesText: text.setup_yes,
        noText: text.setup_no
    });
    if (!confirmed) return;
    await applyBuiltinTemplates(false);
}

async function deleteTemplate() {
    const text = lang();
    const current = activeTemplate();
    if (!current) return;
    const lastOne = templates.length < 2;
    const confirmed = await showDialog('confirm', {
        message: lastOne
            ? text.ai_prompt_delete_last.replace('{0}', current.name)
            : text.ai_prompt_delete_confirm.replace('{0}', current.name),
        yesText: text.setup_yes,
        noText: text.setup_no
    });
    if (!confirmed) return;
    if (lastOne) {
        await applyBuiltinTemplates(true);
        return;
    }
    templates = templates.filter((item) => item.id !== current.id);
    refreshTemplateList(templates[0].id);
    scheduleSave();
}

export function refreshAiPromptLanguage() {
    if (!ui) return;
    const text = lang();
    const span = document.getElementById('ai-prompt-span');
    if (span) span.textContent = text.ai_prompt_panel;
    const backend = document.getElementById('ai-prompt-backend-span');
    if (backend) backend.textContent = text.ai_prompt_backend;
    const backendNote = document.getElementById('ai-prompt-backend-note');
    if (backendNote) backendNote.textContent = text.ai_prompt_backend_shared;
    const modelSpan = document.getElementById('ai-prompt-model-span');
    if (modelSpan) modelSpan.textContent = text.ai_prompt_model_section;
    const systemSpan = document.getElementById('ai-prompt-system-span');
    if (systemSpan) systemSpan.textContent = text.ai_prompt_system;
    const addButton = document.getElementById('ai-prompt-add-toggle');
    if (addButton) addButton.title = text.ai_prompt_save;
    const deleteButton = document.getElementById('ai-prompt-delete-toggle');
    if (deleteButton) deleteButton.title = text.ai_prompt_delete;
    ui.interface?.setTitle(text.ai_interface);
    ui.remoteAddress?.setTitle(text.remote_ai_base_url);
    ui.localAddress?.setTitle(text.ai_local_addr);
    ui.model?.setTitle(text.ai_prompt_model);
    ui.timeout?.setTitle(text.ai_prompt_timeout);
    ui.temperature?.setTitle(text.ai_prompt_temperature);
    ui.tokens?.setTitle(text.ai_prompt_max_tokens);
    ui.system?.setTitle(text.ai_prompt_system);
    ui.brief?.setTitle(text.ai_prompt_brief);
    ui.result?.setTitle(text.ai_prompt_result);
    ui.inherit?.setTitle(text.ai_prompt_inherit);
    ui.restore?.setTitle(text.ai_prompt_restore);
    ui.overwrite?.setTitle(text.ai_prompt_overwrite);
    ui.append?.setTitle(text.ai_prompt_append);
    paintRunButton();
    const sourceId = globalThis.globalSettings.ai_prompt_source || 'brief';
    ui.source.setOptions(sourceLabels(), null, text.ai_prompt_source, labelFor(SOURCE_IDS, sourceLabels(), sourceId));
    ui.applyTarget.setOptions(applyLabels(), null, text.ai_prompt_apply, labelFor(APPLY_IDS, applyLabels(), applySelection));
    ui.character?.setTitle(text.ai_prompt_character);
    const template = activeTemplate();
    if (template) {
        ui.templates.setOptions(templates.map((item) => templateLabel(item)), null, text.ai_prompt_template, templateLabel(template));
    }
}

export function syncAiPromptFromSettings() {
    if (!ui) return;
    suppress = true;
    ui.interface.updateDefaults(globalThis.globalSettings.ai_interface || 'None');
    ui.remoteAddress.setValue(globalThis.globalSettings.remote_ai_base_url || '');
    ui.remoteKey.setValue(globalThis.globalSettings.remote_ai_api_key || '');
    ui.localAddress.setValue(globalThis.globalSettings.ai_local_addr || '');
    ui.brief.setValue(globalThis.globalSettings.ai_prompt || '');
    suppress = false;
    const wanted = globalThis.globalSettings.ai_template;
    const found = templates.find((item) => item.id === wanted);
    if (!found && templates[0]) {
        if (wanted) {
            notice(lang().ai_prompt_missing.replace('{0}', wanted).replace('{1}', templates[0].name));
        }
        globalThis.globalSettings.ai_template = templates[0].id;
    }
    const source = SOURCE_IDS.includes(globalThis.globalSettings.ai_prompt_source)
        ? globalThis.globalSettings.ai_prompt_source
        : 'brief';
    globalThis.globalSettings.ai_prompt_source = source;
    ui.source.updateDefaults(labelFor(SOURCE_IDS, sourceLabels(), source));
    syncCharacterVisibility();
    refreshTemplateList(globalThis.globalSettings.ai_template);
}

export function setAllAiTemplateModels(model) {
    const value = String(model || '').trim();
    if (!value) return;
    for (const template of templates) template.model = value;
    const current = activeTemplate();
    if (current && ui) ui.model.setValue(current.model);
    scheduleSave();
}

export async function setupAiPromptPanel() {
    const stored = await loadStore();
    templates = Array.isArray(stored?.templates) ? stored.templates : [];
    if (stored?.reset) {
        pendingNotice = lang().ai_prompt_missing.replace('{0}', 'templates.json').replace('{1}', templates[0]?.name || '');
    }
    const wanted = globalThis.globalSettings.ai_template;
    const found = templates.find((item) => item.id === wanted);
    if (!found && templates[0]) {
        if (wanted) {
            pendingNotice = lang().ai_prompt_missing.replace('{0}', wanted).replace('{1}', templates[0].name);
        }
        globalThis.globalSettings.ai_template = templates[0].id;
    }
    activeId = globalThis.globalSettings.ai_template || templates[0]?.id || '';
    if (!SOURCE_IDS.includes(globalThis.globalSettings.ai_prompt_source)) {
        globalThis.globalSettings.ai_prompt_source = activeTemplate()?.defaultSource || 'brief';
    }

    ui = {};
    const text = lang();
    const first = activeTemplate();
    ui.templates = mySimpleList('ai-prompt-template', text.ai_prompt_template,
        templates.map((item) => templateLabel(item)),
        () => {
            if (suppress) return;
            selectTemplateByLabel(ui.templates.getValue());
        }, 8, true, false);
    const addButton = document.getElementById('ai-prompt-add-toggle');
    const deleteButton = document.getElementById('ai-prompt-delete-toggle');
    if (addButton) {
        addButton.title = text.ai_prompt_save;
        addButton.onclick = () => { saveNamedTemplate(); };
    }
    if (deleteButton) {
        deleteButton.title = text.ai_prompt_delete;
        deleteButton.onclick = () => { deleteTemplate(); };
    }
    bindTemplateFields(first);
    ui.source = mySimpleList('ai-prompt-source', text.ai_prompt_source, sourceLabels(),
        () => {
            if (suppress) return;
            globalThis.globalSettings.ai_prompt_source = currentSourceId();
            const template = activeTemplate();
            if (template) template.defaultSource = globalThis.globalSettings.ai_prompt_source;
            syncCharacterVisibility();
            scheduleSave();
        }, 8, false, true);
    ui.character = mySimpleList('ai-prompt-character', text.ai_prompt_character, ['1', '2', '3', '4'],
        (index, value) => {
            if (suppress) return;
            const picked = Array.isArray(value) ? value[0] : ui.character.getValue();
            characterSlot = Math.max(0, ['1', '2', '3', '4'].indexOf(String(picked)));
            const template = activeTemplate();
            if (template) template.characterSlot = characterSlot + 1;
            scheduleSave();
        }, 4, false, true);
    ui.brief = setupTextbox('ai-prompt-brief', text.ai_prompt_brief, {
        value: globalThis.globalSettings.ai_prompt || '',
        minLines: 2,
        maxLines: 8,
        defaultTextColor: 'hotpink'
    }, true, (value) => { globalThis.globalSettings.ai_prompt = value; });
    ui.run = setupButtons('ai-prompt-run', text.ai_prompt_run, { width: '100%', height: '36px' }, () => { onRunClicked(); });
    ui.result = setupTextbox('ai-prompt-result', text.ai_prompt_result, {
        value: '',
        minLines: 6,
        maxLines: 16
    }, true);
    ui.applyTarget = mySimpleList('ai-prompt-apply-target', text.ai_prompt_apply, applyLabels(),
        () => {
            if (suppress) return;
            applySelection = currentApplyId();
        }, 6, false, true);
    ui.overwrite = setupButtons('ai-prompt-overwrite', text.ai_prompt_overwrite, { width: '100%', height: '34px' }, () => applyResult('overwrite'));
    ui.append = setupButtons('ai-prompt-append', text.ai_prompt_append, { width: '100%', height: '34px' }, () => applyResult('append'));
    ui.inherit = setupCheckbox('ai-prompt-inherit', text.ai_prompt_inherit, false, false, null);
    ui.restore = setupButtons('ai-prompt-restore', text.ai_prompt_restore, { width: '100%', height: '34px' }, () => { restoreBuiltinTemplates(); });
    bindBackend();

    ui.source.updateDefaults(labelFor(SOURCE_IDS, sourceLabels(), globalThis.globalSettings.ai_prompt_source));
    ui.applyTarget.updateDefaults(applyLabels()[1] || applyLabels()[0]);
    characterSlot = slotFromTemplate(first);
    ui.character.updateDefaults(String(characterSlot + 1));
    ui.templates.updateDefaults(first ? templateLabel(first) : '');
    syncCharacterVisibility();

    globalThis.prompt.brief = ui.brief;
    globalThis.ai = {
        interface: ui.interface,
        remote_address: ui.remoteAddress,
        remote_apikey: ui.remoteKey,
        local_address: ui.localAddress
    };
    globalThis.aiPrompt = {
        brief: ui.brief,
        result: ui.result,
        system: ui.system,
        refreshLanguage: refreshAiPromptLanguage,
        syncFromSettings: syncAiPromptFromSettings,
        setAllModels: setAllAiTemplateModels,
        takeInheritSnapshot,
        applyInheritSnapshot
    };
}
