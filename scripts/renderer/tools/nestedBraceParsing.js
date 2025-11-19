const maximumDepth = 4;
const maxIterations = 1000; // Prevent infinite loops

// eslint-disable-next-line sonarjs/cognitive-complexity
function validateBraces(str) {
    let depth = 0;
    let inParens = 0;
    let inBrackets = 0;
    
    for (const char of str) {
        // exclude () []
        if (char === '(') inParens++;
        if (char === ')') inParens--;
        if (char === '[') inBrackets++;
        if (char === ']') inBrackets--;
        
        if (inParens === 0 && inBrackets === 0) {
            if (char === '{') {
                depth++;
                if (depth > maximumDepth) {
                    // Exceeded maximum nesting depth
                    return false;
                }
            } else if (char === '}') {
                depth--;
                if (depth < 0) {
                    // } before {
                    return false;
                }
            }
        }
    }
    
    return depth === 0;
}

/**
 * Find the matching closing brace for the opening brace at startIndex
 * @param {string} str - The input string
 * @param {number} startIndex - Index of the opening brace
 * @returns {number} Index of the matching closing brace, or -1 if not found
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
function findMatchingBrace(str, startIndex) {
    let depth = 0;
    let inParens = 0;
    let inBrackets = 0;
    
    for (let i = startIndex; i < str.length; i++) {
        const char = str[i];
        
        // Track parentheses and brackets
        if (char === '(') inParens++;
        if (char === ')') inParens--;
        if (char === '[') inBrackets++;
        if (char === ']') inBrackets--;
        
        // Only count braces outside of () and []
        if (inParens === 0 && inBrackets === 0) {
            if (char === '{') {
                depth++;
            } else if (char === '}') {
                depth--;
                if (depth === 0) {
                    return i;
                }
            }
        }
    }
    
    return -1; // No matching brace found
}

/**
 * Find the first opening brace outside of () and []
 * @param {string} str - The input string
 * @returns {number} Index of the first opening brace, or -1 if not found
 */
function findFirstBrace(str) {
    let inParens = 0;
    let inBrackets = 0;
    
    for (let i = 0; i < str.length; i++) {
        const char = str[i];
        
        if (char === '(') inParens++;
        if (char === ')') inParens--;
        if (char === '[') inBrackets++;
        if (char === ']') inBrackets--;
        
        if (inParens === 0 && inBrackets === 0 && char === '{') {
            return i;
        }
    }
    
    return -1;
}

/**
 * Check if there's a pipe separator at the top level (not inside nested braces)
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
function checkTopLevelPipe(str) {
    let depth = 0;
    let inParens = 0;
    let inBrackets = 0;
    
    for (const char of str) {
        if (char === '(') inParens++;
        if (char === ')') inParens--;
        if (char === '[') inBrackets++;
        if (char === ']') inBrackets--;
        
        if (inParens === 0 && inBrackets === 0) {
            if (char === '{') depth++;
            if (char === '}') depth--;
            if (char === '|' && depth === 0) {
                return true;
            }
        }
    }
    
    return false;
}

/**
 * Split string by top-level pipes (not inside nested braces, parentheses, or brackets)
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
function splitByTopLevelPipe(str) {
    const options = [];
    let currentOption = '';
    let depth = 0;
    let inParens = 0;
    let inBrackets = 0;
    
    for (const char of str) {
        if (char === '(') inParens++;
        if (char === ')') inParens--;
        if (char === '[') inBrackets++;
        if (char === ']') inBrackets--;
        
        if (inParens === 0 && inBrackets === 0) {
            if (char === '{') {
                depth++;
                currentOption += char;
            } else if (char === '}') {
                depth--;
                currentOption += char;
            } else if (char === '|' && depth === 0) {
                options.push(currentOption);
                currentOption = '';
            } else {
                currentOption += char;
            }
        } else {
            currentOption += char;
        }
    }
    
    // Add the last option
    if (currentOption.length > 0) {
        options.push(currentOption);
    }
    
    return options;
}

export function processRandomString(input) {
    // Check if input contains braces
    if (!String(input).includes('{')) {
        return input;
    }

    // Check if braces are properly matched
    if (!validateBraces(input)) {
        console.error('Error: Braces are not matched, in wrong order, or exceed maximum nesting depth of ', maximumDepth);
        return input;
    }

    let result = input;    
    let iterations = 0;
    
    // Process from innermost to outermost braces
    while (findFirstBrace(result) !== -1 && iterations < maxIterations) {
        iterations++;
        
        const start = findFirstBrace(result);
        const end = findMatchingBrace(result, start);
        
        if (end === -1) {
            console.error('Error: Cannot find matching closing brace');
            return input;
        }

        // Extract content within braces
        const braceContent = result.substring(start + 1, end);
        
        // Check if it contains the separator | at the current level
        // We need to check if | exists outside of nested braces
        const hasTopLevelPipe = checkTopLevelPipe(braceContent);
        
        if (!hasTopLevelPipe) {
            // No top-level separator, treat as literal and remove braces
            result = result.substring(0, start) + braceContent + result.substring(end + 1);
            continue;
        }

        // Split options by top-level |
        const options = splitByTopLevelPipe(braceContent);
        
        // Randomly select one option
        const randomIndex = Math.floor(Math.random() * options.length);
        const selected = options[randomIndex].trim();
        
        // Replace brace content with selected option
        result = result.substring(0, start) + selected + result.substring(end + 1);
    }

    if (iterations >= maxIterations) {
        console.error('Error: Maximum iterations exceeded');
        return input;
    }

    return result;
}

