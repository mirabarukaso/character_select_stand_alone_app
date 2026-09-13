const CAT = '[mySlider]';

// eslint-disable-next-line sonarjs/cognitive-complexity
export function setupSlider(containerId, spanText = 'mySlider', options = {},  callback = null, noTitle = false) {
    const {
        min = 0, 
        max = 255, 
        step = 1,
        defaultValue = 0,
        fullGradient = false,
        fill = fullGradient ? 'full' : 'gradient',
        inline = false,
        valueStyle = 'default',
        tooltipValue = false
    } = options;

    const container = document.querySelector(`.${containerId}`);
    if (!container) {
        console.error(CAT, `[setupSlider] Container with class "${containerId}" not found.`);
        return;
    }

    const barClass = [
        `mySlider-${containerId}-bar`,
        fill === 'full' ? 'mySlider-full-gradient' : '',
        fill === 'solid' ? 'mySlider-fill-solid' : ''
    ].filter(Boolean).join(' ');
    const valueClass = [
        `mySlider-${containerId}-value`,
        valueStyle === 'plain' ? 'mySlider-value-plain' : '',
        valueStyle === 'chip' ? 'mySlider-value-chip' : ''
    ].filter(Boolean).join(' ');
    const rowClass = [
        `mySlider-${containerId}-row`,
        inline ? 'mySlider-inline' : ''
    ].filter(Boolean).join(' ');
    const hiddenAttribute = noTitle ? 'hidden' : '';

    const spanHtml = `<span class="mySlider-${containerId}-span" ${hiddenAttribute}>${spanText}</span>`;
    const valueHtml = tooltipValue
        ? ''
        : `<input class="${valueClass}" type="number" min="${min}" max="${max}" step="${step}" value="${defaultValue}" ${hiddenAttribute}>`;
    const barHtml = `<input class="${barClass}" type="range" min="${min}" max="${max}" step="${step}" value="${defaultValue}">`;

    if (inline) {
        container.innerHTML = `
            <div class="${rowClass}">
                ${spanHtml}
                ${barHtml}
                ${valueHtml}
            </div>
        `;
    } else {
        container.innerHTML = `
            <div class="${rowClass}" ${hiddenAttribute}>
                ${spanHtml}
                ${valueHtml}
            </div>
            ${barHtml}
        `;
    }

    const sliderBar = container.querySelector(`.mySlider-${containerId}-bar`);
    const sliderText = container.querySelector(`.mySlider-${containerId}-value`);
    const sliderSpan = container.querySelector(`.mySlider-${containerId}-span`);
    const tooltipId = `mySlider-tooltip-${containerId}`;
    document.getElementById(tooltipId)?.remove();
    let tooltipEl = null;
    if (tooltipValue) {
        tooltipEl = document.createElement('div');
        tooltipEl.id = tooltipId;
        tooltipEl.className = 'mySlider-tooltip';
        tooltipEl.hidden = true;
        document.body.appendChild(tooltipEl);
    }
    let titleText = spanText;

    // Determine if the value should be treated as an integer based on step
    const isIntegerStep = Number.isInteger(step);
    if (sliderText) {
        const fractionDigits = isIntegerStep ? 0 : (String(step).split('.')[1] || '').length;
        const valueChars = String(Math.trunc(Math.max(Math.abs(min), Math.abs(max)))).length
            + (fractionDigits ? fractionDigits + 1 : 0)
            + (min < 0 ? 1 : 0);
        const textCols = Math.max(valueChars, 3) + 1;
        sliderText.style.minWidth = `calc(${textCols}ch + var(--spinner-width))`;
        sliderText.style.maxWidth = `calc(${textCols + 1}ch + var(--spinner-width))`;
    }

    const getTypedValue = (value) => {
        const parsed = Number.parseFloat(value);
        return isIntegerStep ? Number.parseInt(parsed, 10) : parsed;
    };

    const formatHint = (value = sliderBar.value) => `${titleText}: ${getTypedValue(value)}`;

    const updatePct = (value) => {
        const numeric = Number.parseFloat(value);
        const range = max - min;
        const pct = range === 0 || Number.isNaN(numeric)
            ? 0
            : Math.min(100, Math.max(0, ((numeric - min) / range) * 100));
        sliderBar.style.setProperty('--pct', `${pct}%`);
    };

    const getClipRect = (el) => {
        const view = {
            left: 0,
            top: 0,
            right: globalThis.innerWidth,
            bottom: globalThis.innerHeight
        };
        let node = el?.parentElement;
        while (node && node !== document.body) {
            const style = globalThis.getComputedStyle(node);
            const clips = /(auto|scroll|hidden|clip)/.test(style.overflowY)
                || /(auto|scroll|hidden|clip)/.test(style.overflowX);
            if (clips) {
                const box = node.getBoundingClientRect();
                view.left = Math.max(view.left, box.left);
                view.top = Math.max(view.top, box.top);
                view.right = Math.min(view.right, box.right);
                view.bottom = Math.min(view.bottom, box.bottom);
            }
            node = node.parentElement;
        }
        return view;
    };

    const placeTooltip = (clientX, clientY) => {
        if (!tooltipEl) {
            return;
        }
        tooltipEl.hidden = false;
        tooltipEl.textContent = formatHint();
        tooltipEl.style.left = '0px';
        tooltipEl.style.top = '0px';
        const width = tooltipEl.offsetWidth;
        const height = tooltipEl.offsetHeight;
        const gapAbove = 8;
        const gapBelow = 20;
        const pad = 4;
        const clip = getClipRect(container);
        let left = clientX - width / 2;
        const maxLeft = clip.right - width - pad;
        left = Math.min(Math.max(left, clip.left + pad), Math.max(clip.left + pad, maxLeft));
        let top = clientY - height - gapAbove;
        if (top < clip.top + pad) {
            top = clientY + gapBelow;
        }
        if (top + height > clip.bottom - pad) {
            top = Math.max(clip.top + pad, clip.bottom - height - pad);
        }
        tooltipEl.style.left = `${Math.round(left)}px`;
        tooltipEl.style.top = `${Math.round(top)}px`;
    };

    updatePct(defaultValue);

    sliderBar.addEventListener('input', (event) => {
        if (sliderText) {
            sliderText.value = sliderBar.value;
        }
        updatePct(sliderBar.value);
        if (tooltipEl) {
            tooltipEl.hidden = false;
            if (Number.isFinite(event.clientX)) {
                placeTooltip(event.clientX, event.clientY);
            } else {
                tooltipEl.textContent = formatHint();
            }
        }
        if (callback) {
            callback(getTypedValue(sliderBar.value));
        }
    });

    if (sliderText) {
        sliderText.addEventListener('input', () => {
            const value = Number.parseFloat(sliderText.value);

            if (value >= min && value <= max) {
                sliderBar.value = value;
                updatePct(value);
                if (callback) {
                    callback(getTypedValue(value));
                }
            } else {
                console.warn(CAT, '[setupSlider] Value out of range:', value);
            }
        });
    }

    if (tooltipEl) {
        container.classList.add('mySlider-has-tooltip');
        let hovering = false;
        let dragging = false;

        const hideTooltipIfIdle = () => {
            if (!hovering && !dragging) {
                tooltipEl.hidden = true;
            }
        };

        container.addEventListener('pointerenter', (event) => {
            hovering = true;
            tooltipEl.hidden = false;
            placeTooltip(event.clientX, event.clientY);
        });
        container.addEventListener('pointermove', (event) => {
            if (hovering || dragging) {
                placeTooltip(event.clientX, event.clientY);
            }
        });
        container.addEventListener('pointerleave', () => {
            hovering = false;
            hideTooltipIfIdle();
        });
        sliderBar.addEventListener('pointerdown', (event) => {
            dragging = true;
            tooltipEl.hidden = false;
            placeTooltip(event.clientX, event.clientY);
        });
        globalThis.addEventListener('pointerup', () => {
            dragging = false;
            hideTooltipIfIdle();
        });
    }

    return {
        setValue: (value) => {
            if (value >= min && value <= max) {
                sliderBar.value = value;
                if (sliderText) {
                    sliderText.value = value;
                }
                updatePct(value);
                if (tooltipEl) {
                    tooltipEl.textContent = formatHint(value);
                }
                if (callback) {
                    callback(getTypedValue(value));
                }
            } else {
                console.warn(CAT, '[setValue] Value out of range.');
            }
        },
        getValue: () => {
            return Number.parseInt(sliderBar.value, 10);
        },
        getFloat: () => {
            return Number.parseFloat(sliderBar.value);
        },
        setTitle: (text) => {
            titleText = text;
            sliderSpan.textContent = text;
            if (tooltipEl) {
                tooltipEl.textContent = formatHint();
            }
        }
    };
}