const CAT_CB = '[myCheckbox]'
const CAT_RB = '[myRadiobox]';

export function setupCheckbox(containerId, spanText = 'myCheckbox', defaultChecked = false, mirror = false, callback = null) {
    const container = document.querySelector(`.${containerId}`);
    if (!container) {
        console.error(CAT_CB, `Container with class "${containerId}" not found.`);
        return;
    }

    container.innerHTML = `
        <span class="myCheckbox-${containerId}-span">${spanText}</span>        
        <input class="myCheckbox-${containerId}-input" type="checkbox" ${defaultChecked ? 'checked' : ''}>    
    `;

    const checkboxInput = container.querySelector(`.myCheckbox-${containerId}-input`);
    const checkboxSpan = container.querySelector(`.myCheckbox-${containerId}-span`);

    if (!checkboxInput || !checkboxSpan) {
        console.error(CAT_CB, `Failed to create checkbox elements.`);
        return;
    }

    if(mirror) {
        checkboxSpan.before(checkboxInput);
    }

    // control whether the checkbox can be modified by user interaction
    let enabled = true;

    const applyEnable = (enable) => {
        enabled = !!enable;
        checkboxInput.disabled = !enabled;
        if (enabled) {
            container.classList.remove('myCheckbox-disabled');
        } else {
            container.classList.add('myCheckbox-disabled');
        }
    };

    // initialize disabled state according to enabled (default true)
    applyEnable(true);

    container.addEventListener('click', (event) => {
        if (!enabled) return; // ignore user clicks when disabled
        if (event.target !== checkboxInput) {
            checkboxInput.checked = !checkboxInput.checked;            
        }
        if (callback)
            callback(checkboxInput.checked);
    });

    return {
        setValue: (value) => {
            if (typeof value === 'boolean') {
                checkboxInput.checked = value;
            } else {
                console.warn(CAT_CB, `Invalid value for setValue. Expected true or false: `, typeof value);
            }
        },
        setEnable: (enable) => {
            applyEnable(enable);
        },
        getValue: () => {
            return checkboxInput.checked;
        },
        setTitle: (text) => {
            checkboxSpan.textContent = text;
        }
        
    };
}

export function setupRadiobox(containerId, spanText = 'myRadiobox', items = 'ON,OFF', items_title = 'on,off', defaultSelectedIndex = 0, callback = null) {
    const container = document.querySelector(`.${containerId}`);
    if (!container) {
        console.error(CAT_RB, `Container with class "${containerId}" not found.`);
        return;
    }

    const groupName = `radiobox-${containerId}`;
    let itemArray = items.split(',').map(item => item.trim());
    let titleArray = items_title.split(',').map(title => title.trim());

    if (defaultSelectedIndex < 0 || defaultSelectedIndex >= itemArray.length) {
        console.warn(CAT_RB, `Invalid defaultSelectedIndex: ${defaultSelectedIndex}. Defaulting to 0.`);
        defaultSelectedIndex = 0;
    }

    const renderRadioboxItems = (selectedIndex) => {
        return itemArray
            .map((item, index) => {
                const isChecked = index === selectedIndex ? 'checked' : '';
                const title = titleArray[index] || ''; 
                return `
                    <label class="myRadiobox-${containerId}-item" title="${title}">
                        <input class="myRadiobox-${containerId}-input" type="radio" name="${groupName}" value="${index}" ${isChecked} title="${title}">
                        <span class="myRadiobox-${containerId}-label" title="${title}">${item}</span>
                    </label>
                `;
            })
            .join('');
    };

    const renderRadiobox = (selectedIndex) => {
        container.innerHTML = `        
            <div class="myRadiobox-${containerId}-group">
                <span class="myRadiobox-${containerId}-span">${spanText}</span>
                ${renderRadioboxItems(selectedIndex)}
            </div>
        `;
    };

    renderRadiobox(defaultSelectedIndex);

    const radioboxInputs = () => container.querySelectorAll(`.myRadiobox-${containerId}-input`);
    const radioboxSpan = () => container.querySelector(`.myRadiobox-${containerId}-span`);

    if (!radioboxInputs().length || !radioboxSpan()) {
        console.error(CAT_RB, `Failed to create radiobox elements.`);
        return;
    }

    // Track previous value to avoid redundant callback triggers
    let previousValue = defaultSelectedIndex;

    container.addEventListener('click', (event) => {
        const input = event.target.closest(`.myRadiobox-${containerId}-input`);
        if (input) {
            const currentValue = Number.parseInt(input.value, 10);
            if (currentValue !== previousValue && callback) {
                callback(currentValue);
                previousValue = currentValue;
            }
        }
    });

    return {
        setValue: (index) => {
            if (index < 0 || index >= radioboxInputs().length) {
                console.warn(CAT_RB, `Invalid index "${index}".`);
                return;
            }
            radioboxInputs()[index].checked = true;
            if (index !== previousValue && callback) {
                callback(index);
                previousValue = index;
            }
        },
        getValue: () => {
            const inputs = radioboxInputs();
            const selectedIndex = Array.from(inputs).findIndex(input => input.checked);
            return selectedIndex;
        },
        setTitle: (newSpanText, newItems, newItemsTitle) => {
            const oldLength = itemArray.length;
            let selectedIndex = previousValue;

            if (newSpanText) {
                spanText = newSpanText;
                radioboxSpan().textContent = spanText;
            }

            if (newItems) {
                itemArray = newItems.split(',').map(item => item.trim());
            }
            if (newItemsTitle) {
                titleArray = newItemsTitle.split(',').map(title => title.trim());
            }

            if (itemArray.length !== titleArray.length) {
                console.warn(CAT_RB, `Mismatch between items and items_title lengths. Expected ${itemArray.length}, got ${titleArray.length}.`);
                return;
            }

            // If item length changes or selectedIndex is invalid, reset to default
            if (itemArray.length !== oldLength || selectedIndex >= itemArray.length) {
                selectedIndex = defaultSelectedIndex < itemArray.length ? defaultSelectedIndex : 0;
            }

            renderRadiobox(selectedIndex);
            previousValue = selectedIndex;
        }
    };
}