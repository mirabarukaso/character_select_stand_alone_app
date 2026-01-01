import { getAiPrompt } from '../remoteAI.js';
import { showDialog } from './myDialog.js';
import { sendWebSocketMessage } from '../../../webserver/front/wsRequest.js';

function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

let menuBox = null;
let currentSelectedText = '';
let currentMenuX = 0;
let currentMenuY = 0;

export function addSpellCheckSuggestions(suggestions, word) {
    if (menuBox?.style.display === 'none') {
        // Menu is closed, ignoring spellcheck suggestions
        return;
    }

    if (currentSelectedText && word !== currentSelectedText) {
        // Selected text changed, ignoring spellcheck suggestions
        return;
    }

    const spellCheckFragment = document.createDocumentFragment();
    let maxWidth = Number.parseInt(menuBox.style.width, 10) - 24 || 200;

    const tempDiv = document.createElement('div');
    tempDiv.style.position = 'absolute';
    tempDiv.style.visibility = 'hidden';
    tempDiv.style.whiteSpace = 'nowrap';
    document.body.appendChild(tempDiv);

    if (suggestions.length > 0) {
        let index = 0;
        for( const suggestion of suggestions) {
            const menuItem = document.createElement('div');
            menuItem.className = 'menu-item';
            menuItem.style.padding = '6px 12px';
            menuItem.style.cursor = 'pointer';
            menuItem.style.fontSize = '14px';
            menuItem.style.userSelect = 'none';
            menuItem.innerHTML = suggestion;
            menuItem.dataset.index = `spellcheck_${index}`;

            menuItem.addEventListener('mouseenter', () => {
                menuItem.style.background = 'rgba(192, 192, 192, 0.5)';
            });
            menuItem.addEventListener('mouseleave', () => {
                menuItem.style.background = 'none';
            });

            menuItem.addEventListener('click', async () => {
                try {
                    await globalThis.api.replaceMisspelling(suggestion);
                    menuBox.style.display = 'none';
                } catch (error) {
                    console.error('Error replacing misspelling:', error);
                }
            });

            tempDiv.textContent = suggestion;
            maxWidth = Math.max(maxWidth, tempDiv.offsetWidth);
            spellCheckFragment.appendChild(menuItem);
            index++;
        }

        // Add to dictionary option
        const addToDictItem = document.createElement('div');
        addToDictItem.className = 'menu-item';
        addToDictItem.style.padding = '6px 12px';
        addToDictItem.style.cursor = 'pointer';
        addToDictItem.style.fontSize = '14px';
        addToDictItem.style.userSelect = 'none';
        addToDictItem.innerHTML = 'Add to dictionary';
        addToDictItem.dataset.index = 'spellcheck_add_to_dict';

        addToDictItem.addEventListener('mouseenter', () => {
            addToDictItem.style.background = 'rgba(192, 192, 192, 0.5)';
        });
        addToDictItem.addEventListener('mouseleave', () => {
            addToDictItem.style.background = 'none';
        });

        addToDictItem.addEventListener('click', async () => {
            try {
                await globalThis.api.addToDictionary(word);
                menuBox.style.display = 'none';
            } catch (error) {
                console.error('Error adding to dictionary:', error);
            }
        });

        tempDiv.textContent = 'Add to dictionary';
        maxWidth = Math.max(maxWidth, tempDiv.offsetWidth);
        spellCheckFragment.appendChild(addToDictItem);

        // Add separator
        const separator = document.createElement('div');
        separator.className = 'menu-separator';
        spellCheckFragment.appendChild(separator);
    }

    tempDiv.remove();

    // insert the spell check suggestions at the top of the menu
    const currentChildren = Array.from(menuBox.children);
    menuBox.innerHTML = '';
    menuBox.appendChild(spellCheckFragment);
    for (const child of currentChildren) {
        menuBox.appendChild(child);
    }

    // update the menu width
    menuBox.style.width = `${Math.min(maxWidth + 24, 300)}px`;
    updateMenuPosition(currentMenuX, currentMenuY);
}

export function setupRightClickMenu() {
    if (globalThis.rightClick?.initialized) {
        console.log('RightClickMenu already initialized');
        return;
    }

    console.log('Initializing RightClickMenu system');

    menuBox = document.createElement('div');
    menuBox.className = 'right-click-menu';
    menuBox.style.zIndex = '10002';
    menuBox.style.display = 'none';
    document.body.appendChild(menuBox);

    let menuConfig = [];
    let rightClickStartX, rightClickStartY, rightClickStartTime;
    let allowMenu = false;
    let isMoved = false;

    globalThis.rightClick = {
        initialized: true,
        push: (index, displayName, handler) => {
            if (typeof index !== 'string' && typeof index !== 'number') {
                console.error('Invalid index:', index);
                return;
            }
            if (menuConfig.some(item => item.index === index)) {
                console.warn(`Index ${index} already exists, use update or remove first`);
                return;
            }
            const newItem = { index, displayName, handler };
            if (menuConfig.length === 0 || !displayName) {
                menuConfig.push(newItem);
            } else {
                menuConfig.unshift(newItem); // Insert at start
            }
        },
        append: (index, displayName, handler) => {
            if (typeof index !== 'string' && typeof index !== 'number') {
                console.error('Invalid index:', index);
                return;
            }
            if (menuConfig.some(item => item.index === index)) {
                console.warn(`Index ${index} already exists, use update or remove first`);
                return;
            }
            const newItem = { index, displayName, handler };
            menuConfig.push(newItem); // Append at end
        },
        remove: (index) => {
            const itemIndex = menuConfig.findIndex(item => item.index === index);
            if (itemIndex === -1) {
                console.warn(`No menu item found with index ${index}`);
                return;
            }
            menuConfig.splice(itemIndex, 1);
        },
        setTitle: (index, newDisplayName) => {
            const item = menuConfig.find(item => item.index === index);
            if (!item) {
                console.warn(`No menu item found with index ${index}`);
                return;
            }
            if (item.displayName === null) {
                console.warn(`Cannot update display name for separator at index ${index}`);
                return;
            }
            item.displayName = newDisplayName;
        },
        updateLanguage: () => {
            updateRightClickMenu();
        }
    };

    if (!globalThis.inBrowser) {
        // global spellcheck API
        globalThis.api.onSpellCheckSuggestions?.((suggestions, word) => {
            addSpellCheckSuggestions(suggestions, word);
        });
    }

    document.addEventListener('mousedown', (e) => {
        if (e.button === 2 && !allowMenu && !isMoved) { // Right-click
            rightClickStartX = e.clientX;
            rightClickStartY = e.clientY;
            rightClickStartTime = Date.now();
            allowMenu = true;
        }
    });

    document.addEventListener('mousemove', (e) => {        
        if (typeof rightClickStartX === 'number' && typeof rightClickStartY === 'number' && allowMenu) {
            const deltaX = Math.abs(e.clientX - rightClickStartX);
            const deltaY = Math.abs(e.clientY - rightClickStartY);
            if (deltaX > 5 || deltaY > 5) {
                allowMenu = false; // Significant movement, likely resizing
                isMoved = true;
            }
        }
    });

    document.addEventListener('contextmenu', async (e) => {
        // If menu is already visible, prevent opening a new one
        if (menuBox.style.display !== 'none') {
            e.preventDefault(); 
            return;
        }
        
        //e.preventDefault(); // Keep commented to allow main process context-menu
        if (!menuConfig.length) return;

        const duration = Date.now() - rightClickStartTime;
        if (allowMenu && duration > 300 || isMoved) {
            rightClickStartX = undefined;
            rightClickStartY = undefined;
            rightClickStartTime = undefined;
            allowMenu = false;
            isMoved = false;
            return; // Suppress entire menu
        }

        const targetElement = e.target;
        if (globalThis.inBrowser) {
            // Move my right click menu a little left
            await renderMenu(e.clientX - 128, e.clientY, targetElement);
        } else {
            await renderMenu(e.clientX, e.clientY, targetElement);
        }
        rightClickStartX = undefined;
        rightClickStartY = undefined;
        rightClickStartTime = undefined;
        allowMenu = false;
        isMoved = false;
    });

    document.addEventListener('click', (e) => {
        if (!menuBox.contains(e.target)) {
            menuBox.style.display = 'none';
            currentSelectedText = ''; // Clear selected text when menu closes
        }
    });

    document.addEventListener('scroll', debounce(() => {
        if (menuBox.style.display !== 'none') {
            updateMenuPosition();
        }
    }, 100), true);

    // Prevent right-click on the menu itself from triggering a new menu
    menuBox.addEventListener('contextmenu', (e) => {
        e.preventDefault(); 
        e.stopPropagation(); 
    });

    // eslint-disable-next-line sonarjs/cognitive-complexity
    async function renderMenu(x, y, targetElement) {
        const fragment = document.createDocumentFragment();
        let maxWidth = 0;
        const tempDiv = document.createElement('div');
        tempDiv.style.position = 'absolute';
        tempDiv.style.visibility = 'hidden';
        tempDiv.style.whiteSpace = 'nowrap';
        document.body.appendChild(tempDiv);

        const spellCheckClasses = [
            'myTextbox-prompt-common-textarea',
            'myTextbox-prompt-positive-textarea',
            'myTextbox-prompt-positive-right-textarea',
            'myTextbox-prompt-negative-textarea',
            'myTextbox-prompt-ai-textarea',
            'myTextbox-prompt-exclude-textarea'
        ];

        const isTextInput = spellCheckClasses.includes(targetElement.className.trim());

        // update currentSelectedText
        currentSelectedText = '';
        if (isTextInput) {
            if (targetElement.selectionStart === targetElement.selectionEnd) {                
                // cursor word
                const text = targetElement.value;
                const cursorPos = targetElement.selectionStart;
                const wordRegex = /\b[\w,]+\b/g;
                let word = '';
                let match;
                while ((match = wordRegex.exec(text)) !== null) {
                    if (match.index <= cursorPos && cursorPos <= match.index + match[0].length) {
                        word = match[0];
                        break;
                    }
                }
                currentSelectedText = word;
            } else {
                // selected text
                currentSelectedText = targetElement.value.slice(targetElement.selectionStart, targetElement.selectionEnd).trim();
            }
        }
        currentMenuX = x;
        currentMenuY = y;

        // render menu items
        for(const item of menuConfig) {
            if (item.displayName === null && item.handler === null) {
                const separator = document.createElement('div');
                separator.className = 'menu-separator';
                fragment.appendChild(separator);
                continue;
            }

            if (typeof item.handler === 'object' && item.handler.selector) {
                if (!targetElement.closest(item.handler.selector)) {
                    continue;
                }
            }

            const menuItem = document.createElement('div');
            menuItem.className = 'menu-item';
            menuItem.style.padding = '6px 12px';
            menuItem.style.cursor = 'pointer';
            menuItem.style.fontSize = '14px';
            menuItem.style.userSelect = 'none';
            menuItem.innerHTML = item.displayName;
            menuItem.dataset.index = item.index;

            menuItem.addEventListener('mouseenter', () => {
                menuItem.style.background = 'rgba(192, 192, 192, 0.5)';
            });
            menuItem.addEventListener('mouseleave', () => {
                menuItem.style.background = 'none';
            });

            menuItem.addEventListener('click', () => {
                executeMenuAction(item.handler, targetElement);
                menuBox.style.display = 'none';
                currentSelectedText = ''; // Clear selected text when menu closes
            });

            tempDiv.textContent = item.displayName;
            maxWidth = Math.max(maxWidth, tempDiv.offsetWidth);
            fragment.appendChild(menuItem);
        }

        tempDiv.remove();

        if (!fragment.children.length && !currentSelectedText) {
            menuBox.style.display = 'none';
            return;
        }

        menuBox.innerHTML = '';
        menuBox.appendChild(fragment);
        menuBox.style.width = `${Math.min(maxWidth + 24, 300)}px`;
        updateMenuPosition(x, y);
        menuBox.style.display = 'block';
    }

    registerDefaultMenuItems();
}

function executeMenuAction(handler, targetElement) {
    try {
        if (typeof handler === 'function') {
            handler();
        } else if (typeof handler === 'object' && handler.func && handler.selector) {
            const element = targetElement.closest(handler.selector);
            if (element) {
                handler.func(element);
            }
        } else {
            console.warn('Invalid handler:', handler);
        }
    } catch (error) {
        console.error('Error executing menu action:', error);
    }
}

function updateMenuPosition(x = currentMenuX, y = currentMenuY) {
    const menuWidth = menuBox.offsetWidth || 200;
    const menuHeight = menuBox.offsetHeight || 100;
    const windowWidth = globalThis.innerWidth;
    const windowHeight = globalThis.innerHeight;
    const paddingX = 10;
    const paddingY = 10;

    let newLeft = x;
    let newTop = y;

    if (newLeft + menuWidth > windowWidth - paddingX) {
        newLeft = Math.max(0, windowWidth - menuWidth - paddingX);
    }
    if (newTop + menuHeight > windowHeight - paddingY) {
        newTop = Math.max(0, y - menuHeight - paddingY);
    }

    menuBox.style.left = `${newLeft}px`;
    menuBox.style.top = `${newTop}px`;
}

function updateRightClickMenu(){
    const SETTINGS = globalThis.globalSettings;
    const FILES = globalThis.cachedFiles;
    const LANG = FILES.language[SETTINGS.language];

    globalThis.rightClick.setTitle('copy_image', LANG.right_menu_copy_image);
    globalThis.rightClick.setTitle('copy_image_metadata', LANG.right_menu_copy_image_metadata);
    globalThis.rightClick.setTitle('copy_image_full_screen', LANG.right_menu_copy_image);
    globalThis.rightClick.setTitle('copy_image_metadata_full_screen', LANG.right_menu_copy_image_metadata);
    
    globalThis.rightClick.setTitle('clear_gallery', LANG.right_menu_clear_gallery);
    globalThis.rightClick.setTitle('bcryptHash', LANG.right_menu_bcrypt_hash);

    globalThis.rightClick.setTitle('lora_common_to_slot', LANG.right_menu_send_lora_to_slot);
    globalThis.rightClick.setTitle('lora_positive_to_slot', LANG.right_menu_send_lora_to_slot);
    globalThis.rightClick.setTitle('test_ai_generate', LANG.right_menu_test_ai_generate);
}

function registerDefaultMenuItems() {
    const SETTINGS = globalThis.globalSettings;
    const FILES = globalThis.cachedFiles;
    const LANG = FILES.language[SETTINGS.language];

    //Dynamic menu
    // split mode
    globalThis.rightClick.append('copy_image', LANG.right_menu_copy_image, {
        selector: '.cg-main-image-container',
        func: (element) => menu_copyImage(element)
    });
    globalThis.rightClick.append('copy_image_metadata', LANG.right_menu_copy_image_metadata, {
        selector: '.cg-main-image-container',
        func: async (element) => await menu_copyImageMetadata(element)
    });
    // full screen mode
    globalThis.rightClick.append('copy_image_full_screen', LANG.right_menu_copy_image, {
        selector: '.cg-fullscreen-overlay',
        func: (element) => menu_copyImage(element)
    });
    globalThis.rightClick.append('copy_image_metadata_full_screen', LANG.right_menu_copy_image_metadata, {
        selector: '.cg-fullscreen-overlay',
        func: async (element) => await menu_copyImageMetadata(element)
    });
    // Custom overlay image
    globalThis.rightClick.append('copy_image_preview', LANG.right_menu_copy_image, {
        selector: '.cg-image-wrapper',
        func: (element) => menu_copyImage(element)
    });    

    // Common
    globalThis.rightClick.append('lora_common_to_slot', LANG.right_menu_send_lora_to_slot, {
        selector: '.prompt-common',
        func: (element) => {
            const textPrompt = prompt_sendLoRAtoSlot(element, '.myTextbox-prompt-common-textarea ')
            if(textPrompt) {
                globalThis.prompt.common.setValue(textPrompt.trim());
                globalThis.collapsedTabs.lora.setCollapsed(false);
            }
        }
    });
    // Positive
    globalThis.rightClick.append('lora_positive_to_slot', LANG.right_menu_send_lora_to_slot, {
        selector: '.prompt-positive',
        func: (element) => {
            const textPrompt = prompt_sendLoRAtoSlot(element, '.myTextbox-prompt-positive-textarea ')
            if(textPrompt){
                globalThis.prompt.positive.setValue(textPrompt.trim());
                globalThis.collapsedTabs.lora.setCollapsed(false);
            }
        }
    });

    // AI prompt
    globalThis.rightClick.append('test_ai_generate', LANG.right_menu_test_ai_generate, {
        selector: '.prompt-ai',
        func: async (element) => await prompt_testAIgenerate(element)
    });

    // line-------------------
    globalThis.rightClick.append('separator_1', null, null);

    // Static menu
    globalThis.rightClick.append('clear_gallery', LANG.right_menu_clear_gallery, () => {
        globalThis.mainGallery.clearGallery();
    });

    if(!globalThis.inBrowser) {
        globalThis.rightClick.append('bcryptHash', LANG.right_menu_bcrypt_hash, async () => {
            const SETTINGS = globalThis.globalSettings;
            const FILES = globalThis.cachedFiles;
            const LANG = FILES.language[SETTINGS.language];
            const password = await showDialog('input', { 
                message: LANG.right_menu_bcrypt_hash_text,
                placeholder: 'Password', 
                defaultValue: '',
                showCancel: false,
                buttonText: LANG.setup_ok
            });

            const hashedPassword = await globalThis.api.bcryptHash(password);
            globalThis.overlay.custom.createCustomOverlay(
                'none', `\n\nRAW:\n${password}\n\nHASH:\n${hashedPassword}`,
                384, 'center', 'left', null, 'Info');
        });
    }
}

function menu_copyImage(element) {
    const img = element.querySelector('img');
    if (img?.src.startsWith('data:image/')) {
        try {
            // Check if the document is focused
            if (document.hasFocus()) {
                proceedWithCopy(img);
            } else {
                console.log('Document is not focused, attempting to focus the window');
                globalThis.focus(); // Attempt to bring the window into focus
                // Add a small delay to ensure focus is applied before clipboard access
                setTimeout(() => {
                    proceedWithCopy(img);
                }, 100); // 100ms delay to allow focus to take effect
            }
        } catch (err) {
            console.error('Error processing image:', err);
        }
    }
}

function proceedWithCopy(img) {
    try {
        const image = new Image();
        image.src = img.src;
        image.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = image.width;
            canvas.height = image.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(image, 0, 0);
            canvas.toBlob(async (blob) => {
                if (blob) {
                    try {
                        await navigator.clipboard.write([
                            new ClipboardItem({ 'image/png': blob })
                        ]);
                        console.log('Image successfully copied to clipboard');
                    } catch (err){
                        console.warn('Failed to copy PNG image to clipboard:', err);
                        const SETTINGS = globalThis.globalSettings;
                        const FILES = globalThis.cachedFiles;
                        const LANG = FILES.language[SETTINGS.language];
                        globalThis.overlay.custom.createCustomOverlay(
                            'none', LANG.saac_macos_copy_image, 384, 'center', 'left', null, 'Clipboard');
                    }
                }
            }, 'image/png');
        };
        image.onerror = () => {
            console.error('Failed to load image for conversion');
        };
    } catch (err) {
        console.error('Error in proceedWithCopy:', err);
    }
}

async function menu_copyImageMetadata(element) {
    const img = element.querySelector('img');
    if (img?.src.startsWith('data:image/')) {
        try {
            let result;
            if (globalThis.inBrowser) {
                result = await sendWebSocketMessage({ type: 'API', method: 'readBase64Image', params: [img.src] });
            } else {
                result = await globalThis.api.readBase64Image(img.src);
            }
            if (result.error || !result.metadata) {
                return ;
            }
            try {
                await navigator.clipboard.writeText(result.metadata?.parameters || result.metadata?.data);
            } catch (err){
                console.warn('Failed to copy PNG image metadata to clipboard:', err);
                const SETTINGS = globalThis.globalSettings;
                const FILES = globalThis.cachedFiles;
                const LANG = FILES.language[SETTINGS.language];
                globalThis.overlay.custom.createCustomOverlay(
                    'none', LANG.saac_macos_clipboard.replace('{0}', result.metadata),
                    384, 'center', 'left', null, 'Clipboard');
            }
            
        } catch (error) {
            throw new Error(`Metadata extraction failed: ${error.message}`);
        }
    }
}

function prompt_sendLoRAtoSlot(element, textArea){
    try {
        const textarea = element.querySelector(textArea);
        if (!textarea) {
            console.warn(`No textarea found with class ${textArea}`,);
            return null;
        }

        const text = textarea.value.trim();
        if (!text) {
            console.warn(`${textArea} is empty`);
            return null;
        }

        const loraRegex = /<lora:[^>]+>/g;
        const loraMatches = text.match(loraRegex) || [];
        const allLora = loraMatches.join(' ');
        const allPrompt = text.replaceAll(loraRegex, '').replaceAll(/,\s*,/g, ',').replaceAll(/(^,\s*)|(\s*,$)/g, '').trim();

        if(allLora.trim() === '') {
            console.warn(`No LoRA in ${textArea}`);
        } else {
            globalThis.lora.flushSlot(allLora);
        }

        return `${allPrompt} `;
    } catch (err) {
        console.error(`Error on get ${textArea} prompt:`, err);
        return null;
    }
}

async function prompt_testAIgenerate(element){
    try {
        const textarea = element.querySelector('.myTextbox-prompt-ai-textarea');
        if (!textarea) {
            console.warn('No textarea found with class myTextbox-prompt-ai-textarea');
            return;
        }

        const text = textarea.value.trim();
        if (!text) {
            console.warn('Textarea is empty');
            return;
        }

        const aiText = await getAiPrompt(0, text);
        globalThis.overlay.custom.createCustomOverlay('none', `\n\n\n${aiText}`,
                                                    384, 'center', 'left', null, 'aiText');
    } catch (err) {
        console.error('Error on get AI prompt:', err);
    }
}