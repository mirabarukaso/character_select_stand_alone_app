function applyButtonChrome(button, options, getClickable) {
    let {
        defaultColor = '#007bff',
        hoverColor = '#0056b3',
        disabledColor = '#cccccc',
        width = '100px',
        height = '40px',
        hidden = false,
        title = ''
    } = options;

    const clickable = () => getClickable();

    button.style.backgroundColor = clickable() ? defaultColor : disabledColor;
    if (width) button.style.width = width;
    if (height) button.style.height = height;
    button.style.display = hidden ? 'none' : 'inline-block';
    button.style.cursor = clickable() ? 'pointer' : 'not-allowed';
    button.style.border = 'none';
    button.style.color = 'white';
    button.style.borderRadius = '4px';
    button.style.fontSize = '14px';
    button.style.transition = 'background-color 0.3s ease';
    button.disabled = !clickable();
    if (title) button.title = title;

    button.addEventListener('mouseover', () => {
        if (clickable()) {
            button.style.backgroundColor = hoverColor;
        }
    });

    button.addEventListener('mouseout', () => {
        button.style.backgroundColor = clickable() ? defaultColor : disabledColor;
    });

    return {
        setColors: (defaultCol, hoverCol, disabledCol) => {
            defaultColor = defaultCol;
            hoverColor = hoverCol;
            disabledColor = disabledCol;
            button.style.backgroundColor = clickable() ? defaultColor : disabledColor;
        },
        applyClickable: () => {
            button.style.cursor = clickable() ? 'pointer' : 'not-allowed';
            button.disabled = !clickable();
            button.style.backgroundColor = clickable() ? defaultColor : disabledColor;
        },
        getDefaultColor: () => defaultColor,
        getHoverColor: () => hoverColor,
        getDisabledColor: () => disabledColor,
        setSize: (btnWidth, btnHeight) => {
            button.style.width = btnWidth;
            button.style.height = btnHeight;
        }
    };
}

export function setupButtons(containerId, buttonText = 'Button', options = {}, callback = null) {
    let clickable = options.clickable !== false;

    const container = document.querySelector(`.${containerId}`);
    if (!container) {
        console.error(`[myButtons] Container with class "${containerId}" not found.`);
        return;
    }

    container.innerHTML = `
    <div class="myButton-${containerId}-container">
        <button class="myButton-${containerId}" type="button">
            ${buttonText}
        </button>
    </div>
    `;

    const button = container.querySelector(`.myButton-${containerId}`);
    if (!button) {
        console.error(`[myButtons] Failed to create button.`);
        return;
    }

    const chrome = applyButtonChrome(button, options, () => clickable);

    button.addEventListener('click', () => {
        if (clickable && callback) {
            callback();
        }
    });

    return {
        click: () => {
            if (clickable && callback) {
                callback();
            }
        },
        setTitle: (text) => {
            button.textContent = text;
        },
        setTooltip: (text) => {
            button.title = text || '';
        },
        setColors: chrome.setColors,
        getDefaultColor: chrome.getDefaultColor,
        getHoverColor: chrome.getHoverColor,
        setSize: chrome.setSize,
        setVisibility: (isVisible) => {
            button.style.display = isVisible ? 'inline-block' : 'none';
        },
        setClickable: (isClickable) => {
            clickable = isClickable;
            chrome.applyClickable();
        }
    };
}

let openSplitMenu = null;
let openSplitChevron = null;

function closeSplitMenu() {
    if (openSplitMenu) {
        openSplitMenu.remove();
        openSplitMenu = null;
    }
    if (openSplitChevron) {
        openSplitChevron.setAttribute('aria-expanded', 'false');
        openSplitChevron = null;
    }
    document.removeEventListener('mousedown', onSplitMenuOutside, true);
    document.removeEventListener('keydown', onSplitMenuKeydown, true);
}

function onSplitMenuOutside(event) {
    if (!openSplitMenu) return;
    if (openSplitMenu.contains(event.target)) return;
    if (event.target.closest?.('.generate-split-chevron')) return;
    closeSplitMenu();
}

function onSplitMenuKeydown(event) {
    if (event.key === 'Escape') {
        closeSplitMenu();
    }
}

export function setupSplitButton(containerId, buttonText = 'Button', options = {}, callback = null, menuItems = []) {
    let clickable = options.clickable !== false;
    const items = menuItems.map((item) => ({
        text: item.text || '',
        callback: item.callback || null,
        destructive: Boolean(item.destructive),
        title: item.title || '',
        clickable: item.clickable !== false
    }));

    const container = document.querySelector(`.${containerId}`);
    if (!container) {
        console.error(`[myButtons] Container with class "${containerId}" not found.`);
        return;
    }

    container.innerHTML = `
    <div class="myButton-${containerId}-container myButton-split-container">
        <button class="myButton-${containerId}" type="button">${buttonText}</button>
        <button class="generate-split-chevron" type="button" aria-haspopup="menu" aria-expanded="false"></button>
    </div>
    `;

    const button = container.querySelector(`.myButton-${containerId}`);
    const chevron = container.querySelector('.generate-split-chevron');
    if (!button || !chevron) {
        console.error(`[myButtons] Failed to create split button.`);
        return;
    }

    const chrome = applyButtonChrome(button, { ...options, width: '' }, () => clickable);
    chevron.style.backgroundColor = clickable ? chrome.getDefaultColor() : chrome.getDisabledColor();
    chevron.style.cursor = clickable ? 'pointer' : 'not-allowed';
    chevron.style.transition = 'background-color 0.3s ease';
    chevron.disabled = !clickable;
    chevron.title = options.menuTitle || '';

    chevron.addEventListener('mouseover', () => {
        if (clickable) {
            chevron.style.backgroundColor = chrome.getHoverColor();
        }
    });
    chevron.addEventListener('mouseout', () => {
        chevron.style.backgroundColor = clickable ? chrome.getDefaultColor() : chrome.getDisabledColor();
    });

    function applyChevronClickable() {
        chevron.style.cursor = clickable ? 'pointer' : 'not-allowed';
        chevron.disabled = !clickable;
        chevron.style.backgroundColor = clickable ? chrome.getDefaultColor() : chrome.getDisabledColor();
    }

    button.addEventListener('click', () => {
        if (clickable && callback) {
            closeSplitMenu();
            callback();
        }
    });

    function openMenu() {
        if (!clickable) return;
        closeSplitMenu();

        const menu = document.createElement('div');
        menu.className = 'generate-split-menu';
        menu.setAttribute('role', 'menu');

        items.forEach((item, index) => {
            const row = document.createElement('div');
            row.className = 'generate-split-menu-item';
            if (item.destructive) row.classList.add('destructive');
            if (!item.clickable) row.classList.add('disabled');
            row.textContent = item.text;
            if (item.title) row.title = item.title;
            row.setAttribute('role', 'menuitem');
            row.addEventListener('click', () => {
                if (!item.clickable || !item.callback) return;
                closeSplitMenu();
                item.callback();
            });
            row.dataset.index = String(index);
            menu.appendChild(row);
        });

        document.body.appendChild(menu);
        const rect = chevron.getBoundingClientRect();
        const menuWidth = Math.max(menu.offsetWidth, rect.width + 28);
        menu.style.minWidth = `${menuWidth}px`;
        let left = rect.right - menuWidth;
        let top = rect.bottom + 4;
        left = Math.max(8, Math.min(left, globalThis.innerWidth - menuWidth - 8));
        if (top + menu.offsetHeight > globalThis.innerHeight - 8) {
            top = Math.max(8, rect.top - menu.offsetHeight - 4);
        }
        menu.style.left = `${left}px`;
        menu.style.top = `${top}px`;

        openSplitMenu = menu;
        openSplitChevron = chevron;
        chevron.setAttribute('aria-expanded', 'true');
        document.addEventListener('mousedown', onSplitMenuOutside, true);
        document.addEventListener('keydown', onSplitMenuKeydown, true);
    }

    chevron.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!clickable) return;
        if (openSplitMenu) {
            closeSplitMenu();
            chevron.setAttribute('aria-expanded', 'false');
            return;
        }
        openMenu();
    });

    return {
        click: () => {
            if (clickable && callback) {
                callback();
            }
        },
        setTitle: (text) => {
            button.textContent = text;
        },
        setTooltip: (text) => {
            button.title = text || '';
        },
        setColors: (defaultCol, hoverCol, disabledCol) => {
            chrome.setColors(defaultCol, hoverCol, disabledCol);
            applyChevronClickable();
        },
        getDefaultColor: chrome.getDefaultColor,
        getHoverColor: chrome.getHoverColor,
        setSize: chrome.setSize,
        setVisibility: (isVisible) => {
            container.style.display = isVisible ? 'flex' : 'none';
        },
        setClickable: (isClickable) => {
            clickable = isClickable;
            chrome.applyClickable();
            applyChevronClickable();
            if (!clickable) closeSplitMenu();
        },
        setMenuTitle: (index, text) => {
            if (!items[index]) return;
            items[index].text = text;
        },
        setMenuClickable: (index, isClickable) => {
            if (!items[index]) return;
            items[index].clickable = isClickable;
        },
        clickMenu: (index) => {
            const item = items[index];
            if (item?.clickable && item.callback) {
                item.callback();
            }
        }
    };
}

function menuFacade(split, index) {
    return {
        click: () => split.clickMenu(index),
        setTitle: (text) => split.setMenuTitle(index, text),
        setTooltip: () => {},
        setColors: () => {},
        getDefaultColor: split.getDefaultColor,
        getHoverColor: split.getHoverColor,
        setSize: () => {},
        setVisibility: () => {},
        setClickable: (isClickable) => split.setMenuClickable(index, isClickable)
    };
}

export function createSplitMenuApi(split, index) {
    return menuFacade(split, index);
}

let showButtons2 = false;

function setCancelButtonsVisible(trigger) {
    closeSplitMenu();
    const frame = document.getElementById('generate-settings-static-right');
    if (frame) {
        frame.classList.toggle('show-cancel', Boolean(trigger));
    }
    showButtons2 = Boolean(trigger);
}

export function toggleButtons() {
    setCancelButtonsVisible(!showButtons2);
}

export function showCancelButtons(trigger) {
    setCancelButtonsVisible(trigger);
}