import { setBlur, setNormal, showDialog, isDialogOpen } from './myDialog.js';
import { sendWebSocketMessage, isSaacReadonlyClient } from '../../webserver/front/wsRequest.js';
import { setADetailerModelList } from '../slots/myADetailerSlot.js';
import { addFavorites, delFavorites } from './favoriteCharacters.js';
import { get_prompt_textBox_Heights } from './componentsManager.js';
import { persistIndependentLayoutFor, deleteIndependentLayoutFor } from '../uiLayout.js';
import { setupButtons } from './myButtons.js';
import {
    DEFAULT_HOTKEY_FAVORITE_ADD,
    DEFAULT_HOTKEY_FAVORITE_DEL,
    cloneHotkey,
    ensureFavoriteHotkeys,
    formatHotkey,
    hotkeyEquals,
    matchesHotkey
} from './hotkey.js';

const CAT = '[myCollapsed]'
const SAAC_SETTINGS_BASENAME = 'saac_settings';

export function setupCollapsed(containerId, collapsed = false) {
    const mainItem = document.querySelector(`.${containerId}-main`);
    if (!mainItem) {
        console.error(CAT, 'mainItem not found', `.${containerId}-main`);
        return null;
    }

    const container = document.querySelector(`.${containerId}-container`);
    if (!container) {
        console.error(CAT, 'Container not found', `.${containerId}-container`);
        return null;
    }

    const arrowId = `${containerId}-toggle`;
    const toggleArrow = document.getElementById(arrowId);
    if (!toggleArrow) {
        console.error(CAT, 'Element not found', arrowId);
        return null;
    }
    
    toggleArrow.addEventListener('click', () => {
        setCollapsed(!container.classList.contains('collapsed'));
    });

    setCollapsed(collapsed);

    function setCollapsed(isCollapsed) {
        if (isCollapsed) {
            mainItem.classList.add('collapsed');
            container.classList.add('collapsed');
            toggleArrow.classList.add('collapsed');
        } else {
            mainItem.classList.remove('collapsed');
            container.classList.remove('collapsed');
            toggleArrow.classList.remove('collapsed');
        }
    }

    function getCollapsed() {
        return container.classList.contains('collapsed');
    }

    return {
        setCollapsed,
        getCollapsed
    };
}

export async function setupSaveSettingsToggle() {
    const saveSettingsButton = document.getElementById('settings-save-toggle');
    if (!saveSettingsButton) {
        console.error(CAT, '[setupSaveSettingsToggle] Save button not found');
        return null;
    }  

    // eslint-disable-next-line sonarjs/cognitive-complexity
    saveSettingsButton.addEventListener('click', async () => {
        const LANG = globalThis.cachedFiles.language[globalThis.globalSettings.language];
        const readonlySaac = isSaacReadonlyClient();
        setBlur();
        const previousSettingsName = globalThis.globalSettings.lastLoadedSettings;
        let inputResult;
        if (readonlySaac) {
            const confirmed = await showDialog('confirm', {
                message: LANG.saac_settings_save,
                yesText: LANG.setup_yes,
                noText: LANG.setup_no
            });
            inputResult = confirmed ? SAAC_SETTINGS_BASENAME : null;
        } else {
            inputResult = await showDialog('input', {
                message: LANG.save_settings_title,
                placeholder: 'tmp_settings',
                defaultValue: globalThis.globalSettings.lastLoadedSettings
            });
        }
        if(inputResult){
            globalThis.globalSettings.lora_slot = globalThis.lora.getValues();
            globalThis.globalSettings.ad_slot = globalThis.aDetailer.getValues();

            const tag_angle = globalThis.viewList.getTextValue(0);
            const tag_camera = globalThis.viewList.getTextValue(1);
            const tag_background =  globalThis.viewList.getTextValue(2);
            const tag_style = globalThis.viewList.getTextValue(3);
            const c1 = globalThis.characterList.getTextValue(0);
            const c2 = globalThis.characterList.getTextValue(1);
            const c3 = globalThis.characterList.getTextValue(2);
            const r1 = globalThis.characterListRegional.getTextValue(0);
            const r2 = globalThis.characterListRegional.getTextValue(1);

            // save prompt textBox heights
            globalThis.globalSettings.ptompt_textbox_heights = get_prompt_textBox_Heights();

            const globalSettings = structuredClone(globalThis.globalSettings);
            delete globalSettings["lastLoadedSettings"];

            globalSettings["weights4dropdownlist"] = [ 
                tag_angle, tag_camera, tag_background, tag_style, // 0, 1, 2, 3
                c1, c2, c3, // 4, 5, 6
                r1, r2      // 7, 8
            ];            

            let result;
            if (globalThis.inBrowser) {
                result = await sendWebSocketMessage({ type: 'API', method: 'saveSettingFile', params: [`${inputResult}.json`, globalSettings] });
            } else {
                result = await globalThis.api.saveSettingFile(`${inputResult}.json`, globalSettings);
            }

            if(result === true) {
                await showDialog('info', { message: LANG.save_settings_success.replace('{0}', inputResult) });
                if (globalThis.inBrowser) {
                    globalThis.cachedFiles.settingList = await sendWebSocketMessage({ type: 'API', method: 'updateSettingFiles' });
                } else {
                    globalThis.cachedFiles.settingList = await globalThis.api.updateSettingFiles();
                }
                globalThis.dropdownList.settings.setOptions(globalThis.cachedFiles.settingList);
                globalThis.dropdownList.settings.updateDefaults(`${inputResult}.json`);

                // Save As / new config name: bind current independent layout to the new settings name
                const prevName = String(previousSettingsName ?? '').replace(/\.json$/i, '').trim();
                const nextName = String(inputResult).replace(/\.json$/i, '').trim();
                if (!readonlySaac && nextName !== '' && nextName !== prevName) {
                    await persistIndependentLayoutFor(nextName);
                }
            } else {
                await showDialog('info', { message: LANG.save_settings_failed.replace('{0}', inputResult) });
            }
        }

        if (inputResult || !readonlySaac) {
            globalThis.globalSettings.lastLoadedSettings = inputResult;
        }
        setNormal();
    });

    return saveSettingsButton;
}

export async function setupDeleteSettingsToggle() {
    const deleteSettingsButton = document.getElementById('settings-delete-toggle');
    if (!deleteSettingsButton) {
        console.error(CAT, '[setupDeleteSettingsToggle] Delete button not found');
        return null;
    }

    deleteSettingsButton.addEventListener('click', async () => {
        const SETTINGS = globalThis.globalSettings;
        const FILES = globalThis.cachedFiles;
        const LANG = FILES.language[SETTINGS.language];

        if (isSaacReadonlyClient()) {
            await showDialog('info', { message: LANG.saac_readonly_blocked });
            return;
        }
        setBlur();
        const inputResult = await showDialog('confirm', { 
            message: LANG.delete_settings_title.replace('{0}', globalThis.globalSettings.lastLoadedSettings),
            yesText: LANG.setup_yes,
            noText: LANG.setup_no
        });
        if(inputResult) {
            const deletedSettingsName = String(globalThis.globalSettings.lastLoadedSettings || '').replace(/\.json$/i, '').trim();
            let result;
            if (globalThis.inBrowser) {
                result = await sendWebSocketMessage({ type: 'API', method: 'deleteSettingFile', params: [`${globalThis.globalSettings.lastLoadedSettings}.json`, globalSettings] });
            } else {
                result = await globalThis.api.deleteSettingFile(`${globalThis.globalSettings.lastLoadedSettings}.json`, globalSettings);
            }

            if (result === true) {
                await showDialog('info', { message: globalThis.cachedFiles.language[globalThis.globalSettings.language].delete_settings_success.replace('{0}', globalThis.globalSettings.lastLoadedSettings) });
                if (deletedSettingsName) {
                    await deleteIndependentLayoutFor(deletedSettingsName);
                } 

                if (globalThis.inBrowser) {
                    globalThis.cachedFiles.settingList = await sendWebSocketMessage({ type: 'API', method: 'updateSettingFiles' });
                } else {
                    globalThis.cachedFiles.settingList = await globalThis.api.updateSettingFiles();
                }
                globalThis.dropdownList.settings.setOptions(globalThis.cachedFiles.settingList);
                globalThis.dropdownList.settings.updateDefaults(``);
            } else {
                await showDialog('info', { message: globalThis.cachedFiles.language[globalThis.globalSettings.language].delete_settings_failed.replace('{0}', globalThis.globalSettings.lastLoadedSettings) });
            }
        }
        setNormal();
    });
    console.log(CAT, '[setupDeleteSettingsToggle] Delete button setup complete', deleteSettingsButton);
    return deleteSettingsButton;
}

export async function setupModelReloadToggle() {
    const refreshButton = document.getElementById('model-refresh-toggle');
    if (!refreshButton) {
        console.error(CAT, '[setupModelReloadToggle] Reload button not found');
        return null;
    }

    refreshButton.addEventListener('click', async () => {
        const currentModelSelect = globalThis.dropdownList.model.getValue();
        await reloadFiles(true, true);
        globalThis.dropdownList.model.updateDefaults(currentModelSelect);
        globalThis.lora.reload();
        globalThis.controlnet.reload();
        globalThis.aDetailer.reload();        
    });

    return refreshButton;
}

export async function reloadFiles(unCollapseTab = false, unlockMutex = false){
    const SETTINGS = globalThis.globalSettings;
    const LANG = globalThis.cachedFiles.language[SETTINGS.language];
    const args = [
        globalThis.globalSettings.model_path_comfyui,               // 0
        globalThis.globalSettings.model_path_webui,                 // 1
        globalThis.globalSettings.model_filter_keyword,             // 2
        globalThis.globalSettings.model_filter,                     // 3
        globalThis.globalSettings.search_modelinsubfolder,          // 4
        globalThis.globalSettings.model_filter_keyword_diffusion    // 5   
    ];

    if (globalThis.inBrowser) {
        await sendWebSocketMessage({ type: 'API', method: 'updateModelList', params: [args, unlockMutex] });
        await sendWebSocketMessage({ type: 'API', method: 'updateWildcards'});
        await sendWebSocketMessage({ type: 'API', method: 'tagReload'});

        globalThis.cachedFiles.modelList = await sendWebSocketMessage({ type: 'API', method: 'getModelList', params: [SETTINGS.api_interface] });
        globalThis.cachedFiles.modelListAll = await sendWebSocketMessage({ type: 'API', method: 'getModelListAll', params: [SETTINGS.api_interface] });
        globalThis.cachedFiles.vaeList = await sendWebSocketMessage({ type: 'API', method: 'getVAEList', params: [SETTINGS.api_interface] });
        globalThis.cachedFiles.diffusionList = await sendWebSocketMessage({ type: 'API', method: 'getDiffusionModelList', params: [SETTINGS.api_interface] });
        globalThis.cachedFiles.textEncoderList = await sendWebSocketMessage({ type: 'API', method: 'getTextEncoderList', params: [SETTINGS.api_interface] });
        globalThis.cachedFiles.loraList = await sendWebSocketMessage({ type: 'API', method: 'getLoRAList', params: [SETTINGS.api_interface] });
        globalThis.cachedFiles.controlnetList = await sendWebSocketMessage({ type: 'API', method: 'getControlNetList', params: [SETTINGS.api_interface] });
        globalThis.cachedFiles.upscalerList = await sendWebSocketMessage({ type: 'API', method: 'getUpscalerList', params: [SETTINGS.api_interface] });
        globalThis.cachedFiles.aDetailerList = await sendWebSocketMessage({ type: 'API', method: 'getADetailerList', params: [SETTINGS.api_interface] });
        globalThis.cachedFiles.settingList = await sendWebSocketMessage({ type: 'API', method: 'updateSettingFiles' });
        globalThis.cachedFiles.imageTaggerModels = await sendWebSocketMessage({ type: 'API', method: 'getImageTaggerModels' });
        if (SETTINGS.api_interface === 'WebUI')
            await sendWebSocketMessage({ type: 'API', method: 'resetModelListsWebUI'});
    } else {
        await globalThis.api.updateModelList(args, unlockMutex);
        await globalThis.api.updateWildcards();
        await globalThis.api.tagReload();

        globalThis.cachedFiles.modelList = await globalThis.api.getModelList(SETTINGS.api_interface);
        globalThis.cachedFiles.modelListAll = await globalThis.api.getModelListAll(SETTINGS.api_interface);
        globalThis.cachedFiles.vaeList = await globalThis.api.getVAEList(SETTINGS.api_interface);
        globalThis.cachedFiles.diffusionList = await globalThis.api.getDiffusionModelList(SETTINGS.api_interface);
        globalThis.cachedFiles.textEncoderList = await globalThis.api.getTextEncoderList(SETTINGS.api_interface);
        globalThis.cachedFiles.loraList = await globalThis.api.getLoRAList(SETTINGS.api_interface);
        globalThis.cachedFiles.controlnetList = await globalThis.api.getControlNetList(SETTINGS.api_interface);
        globalThis.cachedFiles.upscalerList = await globalThis.api.getUpscalerList(SETTINGS.api_interface);
        globalThis.cachedFiles.aDetailerList = await globalThis.api.getADetailerList(SETTINGS.api_interface);
        globalThis.cachedFiles.settingList = await globalThis.api.updateSettingFiles();
        globalThis.cachedFiles.imageTaggerModels = await globalThis.api.getImageTaggerModels();
        if (SETTINGS.api_interface === 'WebUI') {
            await globalThis.api.resetModelListsWebUI();
        }
    }
        
    if (SETTINGS.api_interface === 'WebUI') {
        // reset few list for Forge Neo
        globalThis.cachedFiles.controlnetProcessorListWebUI = 'none';
        globalThis.cachedFiles.upscalerListWebUI = 'none';
        setADetailerModelList(globalThis.cachedFiles.aDetailerList, true);
    } else {
        setADetailerModelList(globalThis.cachedFiles.aDetailerList);
    }

    if (globalThis.globalSettings.api_model_type === 'Checkpoint') {
        globalThis.dropdownList.model.setValue(LANG.api_model_file_select, globalThis.cachedFiles.modelList);
        globalThis.dropdownList.model.updateDefaults(SETTINGS.api_model_file_select);
    } else {
        globalThis.dropdownList.model.setValue(LANG.api_model_file_select, globalThis.cachedFiles.diffusionList);
        globalThis.dropdownList.model.updateDefaults(SETTINGS.api_model_file_diffusion_select);
    }
    globalThis.dropdownList.vae_unet.setValue(LANG.api_difussion_vae_model, globalThis.cachedFiles.vaeList);
    globalThis.dropdownList.vae_sdxl.setValue(LANG.api_ckpt_vae_model, globalThis.cachedFiles.vaeList);
    globalThis.dropdownList.textencoder.setValue(LANG.api_text_encoder, globalThis.cachedFiles.textEncoderList);

    globalThis.dropdownList.settings.setValue('', globalThis.cachedFiles.settingList);
    globalThis.refiner.model.setValue(LANG.api_refiner_model, globalThis.cachedFiles.modelListAll);

    if(globalThis.collapsedTabs.modelSettings.getCollapsed() && unCollapseTab) {
        globalThis.collapsedTabs.modelSettings.setCollapsed(false);
    }
}

export function setupFuctionKeys() {
    const refreshButton = document.getElementById('global-refresh-toggle');
    if (!refreshButton) {
        console.error(CAT, '[setupFuctionKeys] Refresh button not found');
        return null;
    }

    // Refresh
    refreshButton.addEventListener('click', () => {
        location.reload(); 
    });

    document.addEventListener('keydown', (event) => {
        // Refresh
        if (event.key === 'F5') {
            event.preventDefault(); 
            location.reload(); 
            return;
        }

        if (event.repeat || event.isComposing || event.metaKey || isDialogOpen()) {
            return;
        }

        const { add, del } = ensureFavoriteHotkeys();

        if (matchesHotkey(event, add)) {
            event.preventDefault();
            const c1 = globalThis.characterList.getValue()[0];
            const oc = globalThis.characterList.getKey()[3];

            addFavorites(c1);
            addFavorites(oc);
            return;
        }

        if (matchesHotkey(event, del)) {
            event.preventDefault();
            const c3 = globalThis.characterList.getValue()[2];
            const oc = globalThis.characterList.getKey()[3];

            delFavorites(c3);
            delFavorites(oc);
        }
    });

    return refreshButton;
}

function getHotkeyLanguage() {
    return globalThis.cachedFiles?.language?.[globalThis.globalSettings?.language] || {};
}

function setLabeledHint(key, text) {
    const el = document.querySelector(`[data-settings-hint="${key}"]`);
    if (el) {
        el.textContent = text ?? '';
    }
}

function refreshSettingsLabeledHints() {
    const LANG = getHotkeyLanguage();
    setLabeledHint('backend_log', LANG.backend_log_hint);
    setLabeledHint('backend_log_copy', LANG.backend_log_copy_hint);
    setLabeledHint('hotkey_favorite_add', LANG.hotkey_favorite_add_hint);
    setLabeledHint('hotkey_favorite_del', LANG.hotkey_favorite_del_hint);
    setLabeledHint('hotkey_favorite_search', LANG.hotkey_favorite_search_hint);
}

export function refreshFavoriteHotkeyButtons() {
    const LANG = getHotkeyLanguage();
    refreshSettingsLabeledHints();

    const generate = globalThis.generate;
    if (!generate?.hotkeyAddCurrent) {
        return;
    }

    const { add, del } = ensureFavoriteHotkeys();
    generate.hotkeyAddCurrent.setTitle(formatHotkey(add));
    generate.hotkeyDelCurrent.setTitle(formatHotkey(del));
    generate.hotkeyAddChange.setTitle(LANG.hotkey_favorite_change || 'Change');
    generate.hotkeyDelChange.setTitle(LANG.hotkey_favorite_change || 'Change');
    generate.hotkeyAddDefault.setTitle(LANG.hotkey_favorite_default || 'Default');
    generate.hotkeyDelDefault.setTitle(LANG.hotkey_favorite_default || 'Default');
}

async function editFavoriteHotkey(action) {
    const LANG = getHotkeyLanguage();
    const { add, del } = ensureFavoriteHotkeys();
    const current = action === 'add' ? add : del;
    const other = action === 'add' ? del : add;

    const result = await showDialog('hotkey', {
        message: action === 'add' ? LANG.hotkey_dialog_add_title : LANG.hotkey_dialog_del_title,
        defaultValue: current,
        otherHotkey: other,
        labels: {
            mod1: LANG.hotkey_dialog_mod1,
            mod2: LANG.hotkey_dialog_mod2,
            key: LANG.hotkey_dialog_key,
            none: LANG.hotkey_dialog_mod_none
        },
        buttonText: LANG.hotkey_dialog_ok || 'OK',
        cancelText: LANG.hotkey_dialog_cancel || 'Cancel',
        errors: {
            need_modifier: LANG.hotkey_error_need_modifier,
            duplicate_modifier: LANG.hotkey_error_duplicate_modifier,
            need_key: LANG.hotkey_error_need_key,
            blocked: LANG.hotkey_error_blocked,
            conflict: LANG.hotkey_error_conflict
        }
    });

    if (!result) {
        return;
    }

    if (action === 'add') {
        globalThis.globalSettings.hotkey_favorite_add = result;
    } else {
        globalThis.globalSettings.hotkey_favorite_del = result;
    }
    refreshFavoriteHotkeyButtons();
}

async function restoreFavoriteHotkey(action) {
    const LANG = getHotkeyLanguage();
    const defaults = action === 'add' ? DEFAULT_HOTKEY_FAVORITE_ADD : DEFAULT_HOTKEY_FAVORITE_DEL;
    const { add, del } = ensureFavoriteHotkeys();
    const other = action === 'add' ? del : add;

    if (hotkeyEquals(defaults, other)) {
        await showDialog('info', { message: LANG.hotkey_error_conflict });
        return;
    }

    if (action === 'add') {
        globalThis.globalSettings.hotkey_favorite_add = cloneHotkey(defaults);
    } else {
        globalThis.globalSettings.hotkey_favorite_del = cloneHotkey(defaults);
    }
    refreshFavoriteHotkeyButtons();
}

function setupHotkeyButton(containerId, text, colors, callback) {
    return setupButtons(containerId, text, {
        defaultColor: colors.defaultColor,
        hoverColor: colors.hoverColor,
        disabledColor: 'rgb(136, 121, 115)',
        width: '100%',
        height: '32px',
        hidden: false,
        clickable: true
    }, callback);
}

function setupHotkeyValue(containerId, text) {
    const container = document.querySelector(`.${containerId}`);
    if (!container) {
        console.error(CAT, '[setupHotkeyValue] Container not found', containerId);
        return {
            setTitle: () => {}
        };
    }

    container.classList.add('system-settings-hotkey-value');
    container.textContent = text ?? '';
    return {
        setTitle: (value) => {
            container.textContent = value ?? '';
        }
    };
}

export function createFavoriteHotkeyControls() {
    const { add, del } = ensureFavoriteHotkeys();
    refreshSettingsLabeledHints();
    const LANG = getHotkeyLanguage();
    const changeColors = {
        defaultColor: 'rgb(37, 99, 235)',
        hoverColor: 'rgb(29, 78, 216)'
    };
    const defaultColors = {
        defaultColor: 'rgb(100, 116, 139)',
        hoverColor: 'rgb(71, 85, 105)'
    };

    return {
        hotkeyAddCurrent: setupHotkeyValue(
            'system-settings-hotkey-add-current',
            formatHotkey(add)
        ),
        hotkeyAddChange: setupHotkeyButton(
            'system-settings-hotkey-add-change',
            LANG.hotkey_favorite_change || 'Change',
            changeColors,
            () => { void editFavoriteHotkey('add'); }
        ),
        hotkeyAddDefault: setupHotkeyButton(
            'system-settings-hotkey-add-default',
            LANG.hotkey_favorite_default || 'Default',
            defaultColors,
            () => { void restoreFavoriteHotkey('add'); }
        ),
        hotkeyDelCurrent: setupHotkeyValue(
            'system-settings-hotkey-del-current',
            formatHotkey(del)
        ),
        hotkeyDelChange: setupHotkeyButton(
            'system-settings-hotkey-del-change',
            LANG.hotkey_favorite_change || 'Change',
            changeColors,
            () => { void editFavoriteHotkey('del'); }
        ),
        hotkeyDelDefault: setupHotkeyButton(
            'system-settings-hotkey-del-default',
            LANG.hotkey_favorite_default || 'Default',
            defaultColors,
            () => { void restoreFavoriteHotkey('del'); }
        )
    };
}

export function doSwap(rightToLeft) {
    const left = document.getElementById('left');
    const right = document.getElementById('right');

    document.body.classList.toggle('right-to-left', Boolean(rightToLeft));

    if (rightToLeft) {
        right.before(left);
        left.style.marginLeft = '10px';
        left.style.marginRight = '5px';
        right.style.marginLeft = '5px';
        right.style.marginRight = '10px';
    } else {
        left.before(right);
        left.style.marginLeft = '5px';
        left.style.marginRight = '10px';
        right.style.marginLeft = '10px';
        right.style.marginRight = '5px';
    }

    if (typeof globalThis.mainGallery?.updateMetaButtonsLayout === 'function') {
        globalThis.mainGallery.updateMetaButtonsLayout();
    }
}

export function setupSwapToggle(){
    const swapButton = document.getElementById('global-settings-swap-layout-toggle');
    if (!swapButton) {
        console.error(CAT, '[setupSwapToggle] Swap button not found');
        return null;
    }
    
    swapButton.addEventListener('click', () => {
        globalThis.globalSettings.rightToleft = !globalThis.globalSettings.rightToleft;
        doSwap(globalThis.globalSettings.rightToleft);
    });    

    return swapButton;
}

