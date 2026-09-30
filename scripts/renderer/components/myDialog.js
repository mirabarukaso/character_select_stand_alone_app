import { setupButtons } from './myButtons.js';
import { setupTextbox } from './myTextbox.js';
import { setupRadiobox } from './myCheckbox.js';
import {
    HOTKEY_KEY_OPTIONS,
    HOTKEY_MODIFIER_OPTIONS,
    formatKeyLabel,
    hotkeyToSelectValues,
    validateHotkeyFromSelects
} from './hotkey.js';

const DIALOG_Z_INDEX = 100000;
let blurBackdrop = null;

function createDialogContainer() {
    const backdrop = document.createElement('div');
    backdrop.className = 'dialog-backdrop';
    backdrop.style.zIndex = DIALOG_Z_INDEX;

    const dialog = document.createElement('div');
    dialog.className = 'dialog-container';
    dialog.style.zIndex = DIALOG_Z_INDEX + 1; 
    backdrop.appendChild(dialog);

    return { backdrop, dialog };
}

function createMessageElement(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'dialog-message';
    messageDiv.style.fontSize = '16px';
    messageDiv.style.color = 'auto';
    messageDiv.style.whiteSpace = 'pre-wrap';
    messageDiv.style.wordBreak = 'break-word';
    messageDiv.textContent = message;
    return messageDiv;
}

function isDialogOpen() {
    return Boolean(document.querySelector('.dialog-backdrop'));
}

function createLabeledSelect(labelText, options, selectedValue, optionLabel) {
    const field = document.createElement('div');
    field.className = 'dialog-hotkey-field';

    const label = document.createElement('label');
    label.textContent = labelText;
    field.appendChild(label);

    const select = document.createElement('select');
    for (const optionValue of options) {
        const option = document.createElement('option');
        option.value = optionValue;
        option.textContent = optionLabel(optionValue);
        if (optionValue === selectedValue) {
            option.selected = true;
        }
        select.appendChild(option);
    }
    field.appendChild(select);
    return { field, select };
}

function formatHotkeyError(check, errors) {
    const template = errors?.[check.code] || check.code;
    if (check.code === 'blocked' && check.label) {
        return String(template).replace('{0}', check.label);
    }
    return template;
}

function createButtonContainer(name) {
    const buttonContainer = document.createElement('div');
    buttonContainer.className = `dialog-button-container-${name}`;
    buttonContainer.style.display = 'flex';
    buttonContainer.style.justifyContent = 'flex-end';
    buttonContainer.style.gap = '10px';
    return buttonContainer;
}

function setBlur() {
    if (blurBackdrop) {
        blurBackdrop.style.display = 'block';
        return;
    }

    blurBackdrop = document.createElement('div');
    blurBackdrop.className = 'blur-backdrop';
    blurBackdrop.style.position = 'fixed';
    document.body.appendChild(blurBackdrop);
}

function setNormal() {
    if (blurBackdrop) {
        blurBackdrop.style.display = 'none';
    }
}

function playDialogBeep() {
    if (globalThis.api?.systemBeep) {
        void globalThis.api.systemBeep();
        return;
    }
    try {
        const AudioCtx = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!AudioCtx) {
            return;
        }
        const ctx = new AudioCtx();
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = 880;
        gain.gain.value = 0.08;
        oscillator.connect(gain);
        gain.connect(ctx.destination);
        oscillator.start();
        oscillator.stop(ctx.currentTime + 0.18);
        oscillator.onended = () => {
            void ctx.close();
        };
    } catch (error) {
        console.warn('[Dialog] Failed to play beep:', error);
    }
}

function showDialog(type, options = {}) {
    return new Promise((resolve) => {
        if (options.beep) {
            playDialogBeep();
        }
        const { backdrop, dialog } = createDialogContainer();
        let result = null;

        const cleanup = () => {
            dialog.remove();
            backdrop.remove();
            document.body.style.overflow = 'auto';
        };

        document.body.style.overflow = 'hidden';
        document.body.appendChild(backdrop);

        switch (type) {
            case 'info': {
                const { message = 'Information', buttonText = 'OK' } = options;
                dialog.appendChild(createMessageElement(message));               
                
                const buttonContainer = createButtonContainer('ok');
                dialog.appendChild(buttonContainer);
                setupButtons(
                    `dialog-button-container-ok`,
                    buttonText,
                    {
                        defaultColor: '#007bff',
                        hoverColor: '#0056b3',
                        width: '80px',
                        height: '36px'
                    },
                    () => {
                        result = true;
                        cleanup();
                        resolve(result);
                    }
                );
                break;
            }

            case 'input': {
                const { message = 'Please enter:', placeholder = 'Input', defaultValue = '', buttonText = 'OK', cancelText = 'Cancel', showCancel = true } = options;
                dialog.appendChild(createMessageElement(message));

                const inputContainer = document.createElement('div');
                inputContainer.className = `dialog-input`;
                dialog.appendChild(inputContainer);                

                const textbox = setupTextbox(
                    inputContainer.className,
                    placeholder,
                    { value: defaultValue, maxLines: 1 },
                    false,
                    (value) => { result = value; }
                );

                const buttonContainerOk = createButtonContainer(`ok`);
                buttonContainerOk.style.marginTop = '10px';
                dialog.appendChild(buttonContainerOk);

                if(showCancel) {
                    const buttonContainerCancel = createButtonContainer(`cancel`);                
                    buttonContainerCancel.style.marginTop = '10px';                
                    dialog.appendChild(buttonContainerCancel);
                }
                
                setupButtons(
                    `dialog-button-container-ok`,
                    buttonText,
                    {
                        defaultColor: '#007bff',
                        hoverColor: '#0056b3',
                        width: '80px',
                        height: '36px'
                    },
                    () => {
                        cleanup();
                        resolve(result || textbox.getValue());
                    }
                );
                if(showCancel) {
                    setupButtons(
                        `dialog-button-container-cancel`,
                        cancelText,
                        {
                            defaultColor: '#6c757d',
                            hoverColor: '#5a6268',
                            width: '80px',
                            height: '36px'
                        },
                        () => {
                            result = null;
                            cleanup();
                            resolve(null);
                        }
                    );
                }

                // Press 'Enter'
                if (!showCancel) {
                    const inputElem = inputContainer.querySelector('input,textarea');
                    if (inputElem) {
                        inputElem.addEventListener('keydown', (e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                cleanup();
                                resolve(result || textbox.getValue());
                            }
                        });
                    }
                }
                break;
            }

            case 'radio': {
                const { message = 'Please select:', items = 'Option 1,Option 2', itemsTitle = 'Option 1,Option 2', defaultSelectedIndex = 0, buttonText = 'OK' } = options;
                dialog.appendChild(createMessageElement(message));

                const radioContainer = document.createElement('div');
                radioContainer.className = `dialog-radio`;
                dialog.appendChild(radioContainer);

                const radiobox = setupRadiobox(
                    radioContainer.className,
                    '',
                    itemsTitle.replaceAll('\n', '<br>'),
                    items,                    
                    defaultSelectedIndex,
                    null
                );

                const buttonContainer = createButtonContainer('ok');
                dialog.appendChild(buttonContainer);
                setupButtons(
                    `dialog-button-container-ok`,
                    buttonText,
                    {
                        defaultColor: '#007bff',
                        hoverColor: '#0056b3',
                        width: '80px',
                        height: '36px'
                    },
                    () => {
                        result = radiobox.getValue();
                        cleanup();
                        resolve(result);
                    }
                );
                break;
            }

            case 'hotkey': {
                const {
                    message = 'Set shortcut',
                    defaultValue = null,
                    otherHotkey = null,
                    labels = {},
                    errors = {},
                    buttonText = 'OK',
                    cancelText = 'Cancel'
                } = options;

                dialog.classList.add('dialog-container-hotkey');
                dialog.appendChild(createMessageElement(message));

                const selected = hotkeyToSelectValues(defaultValue);
                const row = document.createElement('div');
                row.className = 'dialog-hotkey-row';

                const modifierLabel = (value) => {
                    if (value === 'none') {
                        return labels.none || 'None';
                    }
                    if (value === 'ctrl') {
                        return 'Ctrl';
                    }
                    if (value === 'alt') {
                        return 'Alt';
                    }
                    if (value === 'shift') {
                        return 'Shift';
                    }
                    return value;
                };

                const mod1 = createLabeledSelect(
                    labels.mod1 || 'Modifier 1',
                    HOTKEY_MODIFIER_OPTIONS,
                    selected.mod1,
                    modifierLabel
                );
                const mod2 = createLabeledSelect(
                    labels.mod2 || 'Modifier 2',
                    HOTKEY_MODIFIER_OPTIONS,
                    selected.mod2,
                    modifierLabel
                );
                const keySelect = createLabeledSelect(
                    labels.key || 'Key',
                    HOTKEY_KEY_OPTIONS,
                    selected.key,
                    (value) => formatKeyLabel(value)
                );

                row.appendChild(mod1.field);
                row.appendChild(mod2.field);
                row.appendChild(keySelect.field);
                dialog.appendChild(row);

                const errorDiv = document.createElement('div');
                errorDiv.className = 'dialog-hotkey-error';
                dialog.appendChild(errorDiv);

                const buttonContainerOk = createButtonContainer('ok');
                const buttonContainerCancel = createButtonContainer('cancel');
                buttonContainerOk.style.marginTop = '10px';
                buttonContainerCancel.style.marginTop = '10px';
                dialog.appendChild(buttonContainerOk);
                dialog.appendChild(buttonContainerCancel);

                setupButtons(
                    `dialog-button-container-ok`,
                    buttonText,
                    {
                        defaultColor: '#007bff',
                        hoverColor: '#0056b3',
                        width: '80px',
                        height: '36px'
                    },
                    () => {
                        const check = validateHotkeyFromSelects(
                            mod1.select.value,
                            mod2.select.value,
                            keySelect.select.value,
                            otherHotkey
                        );
                        if (!check.ok) {
                            errorDiv.textContent = formatHotkeyError(check, errors);
                            return;
                        }
                        result = check.hotkey;
                        cleanup();
                        resolve(result);
                    }
                );
                setupButtons(
                    `dialog-button-container-cancel`,
                    cancelText,
                    {
                        defaultColor: '#6c757d',
                        hoverColor: '#5a6268',
                        width: '80px',
                        height: '36px'
                    },
                    () => {
                        result = null;
                        cleanup();
                        resolve(null);
                    }
                );
                break;
            }

            case 'confirm': {
                const { message = 'Are you sure?', yesText = 'Yes', noText = 'No' } = options;
                dialog.appendChild(createMessageElement(message));

                const buttonContainerYes = createButtonContainer(`yes`);
                const buttonContainerNo = createButtonContainer(`no`);
                buttonContainerYes.style.marginTop = '10px';
                buttonContainerNo.style.marginTop = '10px';
                dialog.appendChild(buttonContainerYes);
                dialog.appendChild(buttonContainerNo);
                setupButtons(
                    `dialog-button-container-yes`,
                    yesText,
                    {
                        defaultColor: '#007bff',
                        hoverColor: '#0056b3',
                        width: '80px',
                        height: '36px'
                    },
                    () => {
                        result = true;
                        cleanup();
                        resolve(result);
                    }
                );
                setupButtons(
                    `dialog-button-container-no`,
                    noText,
                    {
                        defaultColor: '#6c757d',
                        hoverColor: '#5a6268',
                        width: '80px',
                        height: '36px'
                    },
                    () => {
                        result = false;
                        cleanup();
                        resolve(result);
                    }
                );                
                break;
            }

            default:
                console.error(`[Dialog] Unknown dialog type: ${type}`);
                cleanup();
                resolve(null);
        }
    });
}

export { setBlur, setNormal, showDialog, isDialogOpen };