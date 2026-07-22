import { setupButtons } from './myButtons.js';
import { setupTextbox } from './myTextbox.js';
import { setupRadiobox } from './myCheckbox.js';

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

function showDialog(type, options = {}) {
    return new Promise((resolve) => {
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

export { setBlur, setNormal, showDialog };