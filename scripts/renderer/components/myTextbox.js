const CAT = '[myTextbox]';

function addDynamicColorClass(color) {
    try {
        const sanitizedColor = color.replaceAll(/[^a-zA-Z0-9]/g, '-');
        const className = `color-${sanitizedColor}`;
        const styleSheet = document.styleSheets[0];

        if (![...styleSheet.cssRules].some(rule => rule.selectorText === `.${className}`)) {        
            styleSheet.insertRule(`.${className} { color: ${color}; }`, styleSheet.cssRules.length);    
        }

        return className;
    } catch (e) {
        console.error(`[setupInfoBox] Failed to add dynamic color class for color: ${color}`, e);
    } 
    
    return 'none';
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replaceAll(/[&<>"']/g, char => map[char]);
}

export function parseTaggedContent(content) {
    const colorRegex = /\[color=([^\]]*?)\]([\s\S]*?)\[\/color\]/g;
    content = content.replaceAll(colorRegex, (match, color, text) => {
        const isValidColor = /^#[0-9A-Fa-f]{6}$|^rgb\(\d{1,3},\s*\d{1,3},\s*\d{1,3}\)$|^[a-zA-Z]+$/.test(color);
        if (isValidColor) {
            const colorClass = addDynamicColorClass(color); 
            return `<span class="${colorClass}">${escapeHtml(text)}</span>`;
        }
        return escapeHtml(text);
    });

    const urlRegex = /\[url=([^\]]*?)\]([\s\S]*?)\[\/url\]/g;
    content = content.replaceAll(urlRegex, (match, url, text) => {
        const isValidUrl = /^(https?:\/\/[^\s<>"']+)$/.test(url);
        if (isValidUrl) {
            return `<a href="${url}" target="_blank" class="myInfoBox-link">${escapeHtml(text)}</a>`;
        }
        return escapeHtml(text);
    });

    const loraRegex = /<lora:[^>]+>/g;
    content = content.replaceAll(loraRegex, match => escapeHtml(match));
    content = content.replaceAll('\n', '<br>');
    return content;
}

export function setupTextbox(containerId, placeholder = 'Enter text...', options = {}, showTitle = false, onInputCallback = null, passwordMode = false, numberOnly = false) {
    const {
        value = '',
        defaultTextColor = 'auto', 
        minLines = 2,
        maxLines = 20,
        readOnly = false,
        autoResize = true
    } = options;

    const container = document.querySelector(`.${containerId}`);
    if (!container) {
        console.error(CAT, `Container with class "${containerId}" not found.`);
        return;
    }

    let isAutoMode = Boolean(autoResize);
    let currentAllowedLines = minLines;

    const wrapperHTML = `
        <div class="myTextbox-wrapper">
            ${showTitle ? `<div class="myTextbox-${containerId}-header">${placeholder}</div>` : ''}
            <div class="myTextbox-container-relative">
                <textarea class="myTextbox-${containerId}-textarea ${numberOnly ? 'numeric-input' : ''}" title="${placeholder}" placeholder="${placeholder}" ${readOnly ? 'readonly' : ''}></textarea>
                <div class="myTextbox-${containerId}-resize-handle">◢</div>
            </div>
        </div>
    `;

    container.innerHTML = wrapperHTML;

    const textbox_header = container.querySelector(`.myTextbox-${containerId}-header`);
    const textbox = container.querySelector(`.myTextbox-${containerId}-textarea`);
    const resizeHandle = container.querySelector(`.myTextbox-${containerId}-resize-handle`);

    if (!textbox) {
        console.error(CAT, `Failed to create textbox.`, textbox);
        return;
    }

    textbox.value = value;
    if (defaultTextColor !== 'auto') textbox.style.color = defaultTextColor;
    
    const DEFAULT_LINE_HEIGHT = 20;     

    const getLineHeight = () => {
        let lineHeight = Number.parseInt(globalThis.getComputedStyle(textbox).lineHeight, 10);
        if (Number.isNaN(lineHeight)) {
            lineHeight = DEFAULT_LINE_HEIGHT;
        }
        return lineHeight;
    };

    const updateHandleVisibility = () => {
        if (resizeHandle) {
            resizeHandle.style.display = isAutoMode ? 'none' : 'block';
        }
    };

    const adjustHeight = () => {
        const lineHeight = getLineHeight();

        if (maxLines === 1) {
            textbox.style.height = `${lineHeight}px`;
            textbox.style.overflowY = 'hidden';

            textbox.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                }                
            });
            return;
        }

        // Auto mode: calculate needed lines strictly based on current content
        if (isAutoMode) {
            textbox.style.height = 'auto';
            const neededLines = Math.ceil(textbox.scrollHeight / lineHeight);
            currentAllowedLines = Math.max(minLines, Math.min(maxLines, neededLines));
        }

        // Apply clamped allowed lines limit
        const clampedLines = Math.max(minLines, Math.min(maxLines, currentAllowedLines));
        const targetHeight = clampedLines * lineHeight;

        textbox.style.height = `${targetHeight}px`;

        // Overflow/scrollbar control independent of resize capability
        if (textbox.scrollHeight > targetHeight) {
            textbox.style.overflowY = 'scroll'; 
        } else {
            textbox.style.overflowY = 'hidden';
        }
    };

    // --- Drag-to-resize logic by single-line increments ---
    let startY = 0;
    let startLines = currentAllowedLines;

    const onMouseMove = (e) => {
        if (isAutoMode) return;
        
        const deltaY = e.clientY - startY;
        const lineHeight = getLineHeight();
        const lineDelta = Math.round(deltaY / lineHeight);

        let targetLines = startLines + lineDelta;
        targetLines = Math.max(minLines, Math.min(maxLines, targetLines));

        if (targetLines !== currentAllowedLines) {
            currentAllowedLines = targetLines;
            adjustHeight();
        }
    };

    const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    };

    if (resizeHandle) {
        resizeHandle.addEventListener('mousedown', (e) => {
            if (isAutoMode) return;
            e.preventDefault();
            startY = e.clientY;
            startLines = currentAllowedLines;
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
    }

    updateHandleVisibility();

    setTimeout(() => {
        adjustHeight();
    }, 0);

    let realValue = textbox.value;
    if (passwordMode) {
        realValue = textbox.value; 
        textbox.value = '******';
    }

    textbox.addEventListener('input', () => {
        if (numberOnly) {
            const val = textbox.value;
            const validPattern = /^-?\d*\.?\d*$/;       // NOSONAR S8786
            if (validPattern.test(val)) {
                textbox.dataset.lastValid = val;
            } else {
                textbox.value = textbox.dataset.lastValid || '';
            }
        }
        
        adjustHeight();
        if (onInputCallback) {
            onInputCallback(textbox.value);
        }
        realValue = textbox.value;
    });

    if (numberOnly) {
        textbox.addEventListener('keydown', (e) => {
            const key = e.key;
            const val = textbox.value;
            const cursorPos = textbox.selectionStart;

            if (['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Home', 'End'].includes(key)) {
                return;
            }

            if (key === '.' && val.includes('.')) {
                e.preventDefault();
                return;
            }

            if (key === '-' && (cursorPos !== 0 || val.includes('-'))) {
                e.preventDefault();
                return;
            }

            if (!/[\d.-]/.test(key)) {
                e.preventDefault();
            }
        });
    }

    textbox.addEventListener('blur', () => {
        if (!textbox.value.trim()) {
            textbox.style.opacity = '0.5'; 
        }
        if (passwordMode) {
            realValue = textbox.value; 
            textbox.value = '******';
        }
    });

    textbox.addEventListener('focus', () => {
        textbox.style.opacity = '1'; 
        if (passwordMode) {
            textbox.value = realValue;
        }
    });

    globalThis.addEventListener('resize', adjustHeight);

    return {
        getValue: () => {
            if (passwordMode)
                return realValue;
            return textbox.value;
        },
        setValue: (value) => {
            textbox.value = value;
            if (numberOnly) {
                const validPattern = /^-?\d*\.?\d*$/;   // NOSONAR S8786
                if (validPattern.test(value)) {
                    textbox.dataset.lastValid = value;
                } else {
                    textbox.value = textbox.dataset.lastValid || '';
                }
            }
            realValue = textbox.value;
            if (passwordMode) {
                textbox.value = '******';
            }
            setTimeout(adjustHeight, 0);
        },
        setColors: (backgroundColor, textColor) => {
            textbox.style.backgroundColor = backgroundColor;
            textbox.style.color = textColor;
        },
        setTitle: (titleText) => {
            textbox.placeholder = titleText; 
            textbox.title = titleText; 
            if (textbox_header)
                textbox_header.textContent = titleText;
        },

        setAutoResize: (isAuto) => {
            isAutoMode = Boolean(isAuto);
            updateHandleVisibility();
            adjustHeight();
        },
        getHeight: (inPixels = false) => {
            if (inPixels) {
                return textbox.offsetHeight;
            }
            return currentAllowedLines;
        },
        setHeight: (lines) => {
            const targetLines = Number.parseInt(lines, 10);
            if (!Number.isNaN(targetLines)) {
                currentAllowedLines = Math.max(minLines, Math.min(maxLines, targetLines));
                adjustHeight();
            }
        },

        flush() {
            setTimeout(adjustHeight, 0);
        },
        getElement: () => textbox,  
        isNumberOnly: () => numberOnly 
    };
}

export function setupInfoBox(containerId, initialTitle = '', initialContent = '', showTitle = false, maxHeight = 200) {
    const container = document.querySelector(`.${containerId}`);
    if (!container) {
        console.error(`[setupInfoBox] Container with class "${containerId}" not found.`);
        return;
    }

    if (showTitle) {
        container.innerHTML = `
            <div class="myInfoBox-${containerId}-header">${initialTitle}</div>
            <div class="myInfoBox-${containerId}-content">
                <pre>${parseTaggedContent(initialContent)}</pre>
            </div>
        `;
    } else {
        container.innerHTML = `
            <div class="myInfoBox-${containerId}-content">
                <pre>${parseTaggedContent(initialContent)}</pre>
            </div>
        `;
    }

    const infoBoxHeader = container.querySelector(`.myInfoBox-${containerId}-header`);
    const infoBoxContent = container.querySelector(`.myInfoBox-${containerId}-content`);

    if (!infoBoxContent) {
        console.error(`[setupInfoBox] Failed to create InfoBox content.`);
        return;
    }

    infoBoxContent.style.maxHeight = `${maxHeight}px`;
    infoBoxContent.style.overflowX = `hidden`;
    infoBoxContent.style.overflowY = `auto`;

    let currentContent = initialContent;

    return {
        clear: () => {
            currentContent = '';
            infoBoxContent.querySelector('pre').innerHTML = '';
        },
        setTitle: (newTitle) => {
            if (infoBoxHeader) {
                infoBoxHeader.textContent = newTitle;
            }
        },
        setValue: (newContent) => {
            currentContent = newContent;
            infoBoxContent.querySelector('pre').innerHTML = parseTaggedContent(newContent);
        },
        appendValue: (newContent) => {
            currentContent += newContent;
            infoBoxContent.querySelector('pre').innerHTML += parseTaggedContent(newContent);
        },
        getValue: () => {
            return currentContent;
        }
    };
}

/**
 * Dynamically adjust font size for textboxes and infoboxes
 * @param {string|number} fontSize - Size value, e.g., '14px', '1.2rem', or number 14
 */
export function changeFontSize(fontSize, lineHeight = '1.4') {
    const formattedFontSize = typeof fontSize === 'number' ? `${fontSize}px` : fontSize;

    const selectors = [
        '[class*="myTextbox-"][class*="-textarea"]',
        '[class*="myInfoBox-"][class*="-content"]',
        '[class*="myInfoBox-"][class*="-content"] pre'
    ];

    const elements = document.querySelectorAll(selectors.join(', '));
    for (const el of elements) {
        el.style.fontSize = formattedFontSize;
        el.style.lineHeight = lineHeight;
    }

    globalThis.dispatchEvent(new Event('resize'));
}
