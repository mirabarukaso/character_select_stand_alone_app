import { sendWebSocketMessage } from '../webserver/front/wsRequest.js';

function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

function extractCurrentWeight(targetText) {
    const weightMatch = targetText.match(/^\((.+):(\d*\.?\d+)\)$/); //NOSONAR S8786
    return weightMatch ? Number.parseFloat(weightMatch[2]) : 1;
}

function calculateNewWeight(currentWeight, isIncrease) {
    const step = 0.05;
    const newWeight = isIncrease ? currentWeight + step : currentWeight - step;
    if (newWeight < 0 || newWeight > 3) return null;
    return Number.parseFloat(newWeight.toFixed(2));
}

function formatNewTag(targetText, newWeight) {
    const baseText = targetText.match(/^\((.+):\d*\.?\d+\)$/)?.[1] || targetText;    //NOSONAR S8786
    return newWeight === 1 ? baseText : `(${baseText}:${newWeight})`;
}

function updateTextboxValue(textbox, value, start, end, newTag) {
    textbox.value = value.slice(0, start) + newTag + value.slice(end);
    const newCursorPos = start + newTag.length;
    textbox.setSelectionRange(newCursorPos, newCursorPos);
    textbox.dispatchEvent(new Event('input', { bubbles: true }));
}

function findBracketedTag(beforeCursor, afterCursor) {
    const fullText = beforeCursor + afterCursor;
    const cursorPos = beforeCursor.length;

    const bracketRegex = /\(([^()]+:\d*\.?\d+)\)/g;  //NOSONAR S8786
    let match;
    while ((match = bracketRegex.exec(fullText)) !== null) {
        const start = match.index;
        const end = start + match[0].length;
        if (start <= cursorPos && cursorPos <= end) {
            return {
                text: match[0],
                start: start,
                end: end
            };
        }
    }
    return null;
}

function extractTargetText(value, startPos, endPos) {
    if (startPos !== endPos) {
        return { targetText: value.slice(startPos, endPos), start: startPos, end: endPos };
    }

    const beforeCursor = value.slice(0, startPos);
    const afterCursor = value.slice(startPos);
    const bracketMatch = findBracketedTag(beforeCursor, afterCursor);

    if (bracketMatch) {
        return { targetText: bracketMatch.text, start: bracketMatch.start, end: bracketMatch.end };
    }

    const lastSeparatorBefore = Math.max(beforeCursor.lastIndexOf(','), beforeCursor.lastIndexOf('\n'));
    const firstSeparatorAfter = afterCursor.includes(',') ? afterCursor.indexOf(',') : afterCursor.indexOf('\n');
    const start = lastSeparatorBefore >= 0 ? lastSeparatorBefore + 1 : 0;
    const end = firstSeparatorAfter >= 0 ? startPos + firstSeparatorAfter : value.length;

    return { targetText: value.slice(start, end).trim(), start, end };
}

function formatSuggestion(suggestion) {
    const withoutHeat = suggestion.replace(/\s\(\d+\)$/, '');

    // AS IS: wildcards like __my_special_tag__
    if (/^__.*__$/.test(withoutHeat)) {
        return withoutHeat;
    }

    // otherwise, format the suggestion
    if (withoutHeat.startsWith(':') || withoutHeat.endsWith(':')) {
        return withoutHeat;
    }

    let formatted = withoutHeat.replaceAll('_', ' ');
    formatted = formatted.replaceAll(/[\\()]/g, String.raw`\$&`);

    return formatted;
}


function adjustWeight(isIncrease, textbox) {
    const { value, selectionStart: startPos, selectionEnd: endPos } = textbox;

    const { targetText, start, end } = extractTargetText(value, startPos, endPos);
    if (!targetText) return;

    const currentWeight = extractCurrentWeight(targetText);
    const newWeight = calculateNewWeight(currentWeight, isIncrease);
    if (newWeight === null) return;

    const newTag = formatNewTag(targetText, newWeight);
    updateTextboxValue(textbox, value, start, end, newTag);
}

function extractWordToSend(value, cursorPosition) {
    const beforeCursor = value.slice(0, cursorPosition);
    const afterCursor = value.slice(cursorPosition);                
    const lastCommaBefore = beforeCursor.lastIndexOf(',');
    const lastNewlineBefore = beforeCursor.lastIndexOf('\n');
    const start = Math.max(lastCommaBefore, lastNewlineBefore) >= 0 
        ? Math.max(lastCommaBefore, lastNewlineBefore) + 1 
        : 0;        
    const firstCommaAfter = afterCursor.indexOf(',');
    const firstNewlineAfter = afterCursor.indexOf('\n');
    
    let end;
    if (firstNewlineAfter === 0) {
        end = cursorPosition;
    } else if (firstCommaAfter >= 0 || firstNewlineAfter >= 0) {
        end = firstCommaAfter >= 0 && (firstNewlineAfter < 0 || firstCommaAfter < firstNewlineAfter)
            ? cursorPosition + firstCommaAfter
            : (() => {
                if (firstNewlineAfter >= 0) {
                    return cursorPosition + firstNewlineAfter;
                }
                return value.length;
            })();
    } else {
        end = value.length;
    }

    const extracted = value.slice(start, end).trim();
    return extracted.endsWith(',') || extracted === '' ? '' : extracted;
}

export function setupSuggestionSystem() {
    const textboxes = document.querySelectorAll(
        '.myTextbox-prompt-common-textarea, .myTextbox-prompt-positive-textarea, .myTextbox-prompt-positive-right-textarea, .myTextbox-prompt-negative-textarea, .myTextbox-prompt-exclude-textarea'
        //'.myTextbox-prompt-ai-textarea',
    );

    let lastWordSent = '';
    let skipSuggestion = false;

    for(const textbox of textboxes) {
        if (textbox.dataset.suggestionSetup) continue;

        console.log('Setting up the Suggestion System for ', textbox);

        const suggestionBox = document.createElement('div');
        suggestionBox.className = 'suggestion-box scroll-container';
        suggestionBox.style.display = 'none';
        document.body.appendChild(suggestionBox);

        let selectedIndex = -1;
        let currentSuggestions = [];
        const textboxWidth = textbox.offsetWidth;

        suggestionBox.addEventListener('click', (e) => {
            const item = e.target.closest('.suggestion-item');
            if (item) applySuggestion(item.dataset.value);
        });

        textbox.addEventListener('input', debounce(async () => {
            if (skipSuggestion) {
                skipSuggestion = false;
                return; 
            }

            updateSuggestionBoxPosition();

            const value = textbox.value;
            const cursorPosition = textbox.selectionStart;
            let wordToSend = extractWordToSend(value, cursorPosition);

            if (!wordToSend || wordToSend === lastWordSent) {
                suggestionBox.style.display = 'none';
                return;
            }
            wordToSend = wordToSend.replaceAll(' ', '_');
            lastWordSent = wordToSend;

            try {            
                let suggestions;
                if (globalThis.inBrowser) {
                    suggestions = await sendWebSocketMessage({ type: 'API', method: 'tagGet', params: [wordToSend] });
                } else {
                    suggestions = await globalThis.api.tagGet(wordToSend);
                }

                if (!suggestions || suggestions.every(s => s.length === 0)) {
                    suggestionBox.style.display = 'none';
                    return;
                }

                const fragment = document.createDocumentFragment();
                let maxWidth = 0;
                const tempDiv = document.createElement('div');
                tempDiv.style.position = 'absolute';
                tempDiv.style.visibility = 'hidden';
                tempDiv.style.whiteSpace = 'nowrap';
                document.body.appendChild(tempDiv);

                currentSuggestions = [];
                for (const [index, suggestion] of suggestions.entries()) {
                    if (!Array.isArray(suggestion) || suggestion.length === 0) {
                        console.warn('Invalid suggestion format at index', index, suggestion);
                        continue;
                    }
                    const element = suggestion[0];
                    if (typeof element !== 'string') {
                        console.error('Unexpected element type at index', index, ':', typeof element, element);
                        continue;
                    }
                    const item = document.createElement('div');
                    item.className = 'suggestion-item';
                    item.innerHTML = element;
                    const boldRegex = /<b>(.*?)<\/b>/;
                    const promptMatch = boldRegex.exec(element);
                    item.dataset.value = promptMatch ? promptMatch[1] : element.split(':')[0].trim();
                    let sanitizedElement = element;
                    let previousElement;
                    do {
                        previousElement = sanitizedElement;
                        sanitizedElement = sanitizedElement.replaceAll(/<[^>]+>/g, '');  //NOSONAR S8786
                    } while (sanitizedElement !== previousElement);
                    tempDiv.textContent = sanitizedElement;
                    maxWidth = Math.max(maxWidth, tempDiv.offsetWidth);
                    currentSuggestions.push({ prompt: element });
                    fragment.appendChild(item);
                }

                tempDiv.remove();
                suggestionBox.innerHTML = '';
                suggestionBox.appendChild(fragment);
                suggestionBox.style.width = `${Math.min(maxWidth + 20, 300)}px`;
                suggestionBox.style.display = 'block';
                selectedIndex = -1;

            } catch (error) {
                console.error('Suggestion system error:', error);
                suggestionBox.style.display = 'none';
            }
        }, 50));

        textbox.addEventListener('keydown', (e) => {
            if (suggestionBox.style.display !== 'none') {

                const items = suggestionBox.querySelectorAll('.suggestion-item');
                if (items.length === 0) return;

                if (e.key === 'Tab' || e.key === 'Enter') {
                    e.preventDefault();
                    if (selectedIndex >= 0 && selectedIndex < currentSuggestions.length) {
                        applySuggestion(currentSuggestions[selectedIndex].prompt);
                    } else if (items.length > 0) {
                        applySuggestion(currentSuggestions[0].prompt);
                    }
                } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
                    updateSelection(items);
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    selectedIndex = Math.max(selectedIndex - 1, 0);
                    updateSelection(items);
                } else if (e.key === 'Escape') {
                    suggestionBox.style.display = 'none';
                }
            }

            if (e.ctrlKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                e.preventDefault();
                adjustWeight(e.key === 'ArrowUp', textbox);
            }
        });        

        document.addEventListener('click', (e) => {
            if (!suggestionBox.contains(e.target) && e.target !== textbox) {
                suggestionBox.style.display = 'none';
            }
        });

        document.addEventListener('scroll', debounce(() => {
            if (suggestionBox.style.display !== 'none') {
                updateSuggestionBoxPosition();
            }
        }, 100), true);

        function updateSelection(items) {
            for (const [idx, item] of items.entries()) {
                item.classList.toggle('selected', idx === selectedIndex);
            }
            if (selectedIndex >= 0) items[selectedIndex].scrollIntoView({ block: 'nearest' });
            textbox.focus();
        }

        function applySuggestion(promptText) {
            const promptMatch = promptText.match(/<b>(.*?)<\/b>/);
            let formattedText = '';
        
            if (promptMatch) {
                formattedText = formatSuggestion(promptMatch[1]);
            } 
            // :3 or 3:
            else if (promptText.startsWith(':') || promptText.endsWith(':')) {
                formattedText = promptText.trim();
            } 
            // 1:1, 4:3, 16:9 ....
            else if (/^\d+:\d+$/.test(promptText.trim())) {
                formattedText = promptText.trim();
            } 
            // Other cases
            else {
                formattedText = formatSuggestion(promptText.replace(':', ' '));
            }

        
            const value = textbox.value;
            const cursorPosition = textbox.selectionStart;
        
            const beforeCursor = value.slice(0, cursorPosition);
            const afterCursor = value.slice(cursorPosition);
            const lastSeparatorBefore = Math.max(beforeCursor.lastIndexOf(','), beforeCursor.lastIndexOf('\n'));
            const firstCommaAfter = afterCursor.indexOf(',');
            const firstNewlineAfter = afterCursor.indexOf('\n');
            const start = lastSeparatorBefore >= 0 ? lastSeparatorBefore + 1 : 0;
            let end = cursorPosition;
            let suffix = ', ';
        
            if (firstNewlineAfter === 0) {
                end = cursorPosition;
                suffix = ',';
            } else if (firstCommaAfter >= 0 || firstNewlineAfter >= 0) {
                end = firstCommaAfter >= 0 && (firstNewlineAfter < 0 || firstCommaAfter < firstNewlineAfter)
                    ? cursorPosition + firstCommaAfter
                    : (() => {
                        if (firstNewlineAfter >= 0) {
                            return cursorPosition + firstNewlineAfter;
                        }
                        return value.length;
                    })();
                if (firstCommaAfter >= 0) {
                    suffix = '';
                } else if (firstNewlineAfter >= 0) {
                    suffix = ',';
                }
            }
        
            const isFirstWordInLine = start === 0 || value[start - 1] === '\n';
            const prefix = isFirstWordInLine ? '' : ' ';
            const newValue = value.slice(0, start) + prefix + formattedText + suffix + value.slice(end);
            textbox.value = newValue.trim();
        
            const newCursorPosition = start + prefix.length + formattedText.length + (suffix.startsWith(',') ? 1 : 0);
            textbox.setSelectionRange(newCursorPosition, newCursorPosition);
        
            currentSuggestions = [];
            suggestionBox.innerHTML = '';
            suggestionBox.style.display = 'none';
        
            const inputEvent = new Event('input', { bubbles: true });
            skipSuggestion = true;
            textbox.dispatchEvent(inputEvent);
            textbox.focus();
        }

        function updateSuggestionBoxPosition() {
            const rect = textbox.getBoundingClientRect();
            const textboxTop = rect.top + globalThis.scrollY;
            const textboxBottom = rect.bottom + globalThis.scrollY;
            const textboxLeft = rect.left + globalThis.scrollX;

            const cursorPosition = Math.min(textbox.selectionStart, textbox.value.length);
            const textBeforeCursor = textbox.value.substring(0, cursorPosition);

            const lineSpan = document.createElement('span');
            lineSpan.style.position = 'absolute';
            lineSpan.style.visibility = 'hidden';
            lineSpan.style.font = globalThis.getComputedStyle(textbox).font;
            lineSpan.style.whiteSpace = 'pre-wrap';
            lineSpan.style.width = `${textboxWidth}px`;
            document.body.appendChild(lineSpan);

            const lines = [];
            let currentLine = '';
            for (const char of textBeforeCursor) {
                lineSpan.textContent = currentLine + char;
                if (lineSpan.scrollWidth > textboxWidth || char === '\n') {
                    lines.push(currentLine);
                    currentLine = char === '\n' ? '' : char;
                } else {
                    currentLine += char;
                }
            }
            if (currentLine) lines.push(currentLine);
            lineSpan.remove();

            const widthSpan = document.createElement('span');
            widthSpan.style.position = 'absolute';
            widthSpan.style.visibility = 'hidden';
            widthSpan.style.font = globalThis.getComputedStyle(textbox).font;
            widthSpan.style.whiteSpace = 'nowrap';
            widthSpan.textContent = lines.at(-1) || '';
            document.body.appendChild(widthSpan);
            const cursorOffset = widthSpan.offsetWidth;
            widthSpan.remove();

            suggestionBox.style.display = 'block';
            const suggestionWidth = suggestionBox.offsetWidth || 200;
            const suggestionHeight = suggestionBox.offsetHeight || 100;
            if (!suggestionBox.innerHTML) suggestionBox.style.display = 'none';

            let newLeft = textboxLeft + cursorOffset;
            let newTop = textboxBottom;
            const windowWidth = globalThis.innerWidth;
            const windowHeight = globalThis.innerHeight;
            const paddingX = 24;
            const paddingY = 12;

            if (newLeft + suggestionWidth > windowWidth - paddingX) {
                newLeft = Math.max(0, windowWidth - suggestionWidth - paddingX);
            }
            if (newLeft < textboxLeft) newLeft = textboxLeft;

            if (newTop + suggestionHeight > windowHeight + globalThis.scrollY - paddingY) {
                newTop = textboxTop - suggestionHeight - paddingY;
                if (newTop < globalThis.scrollY) newTop = textboxBottom;
            }

            suggestionBox.style.left = `${newLeft}px`;
            suggestionBox.style.top = `${newTop}px`;
            suggestionBox.style.zIndex = '10002';
            suggestionBox.style.transform = 'translateZ(0)';
        }

        textbox.dataset.suggestionSetup = 'true';
    }
}