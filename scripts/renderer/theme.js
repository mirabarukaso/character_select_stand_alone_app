export function setupThemeToggle() {
    const themeToggleButton = document.getElementById('global-settings-theme-toggle');
    if (!themeToggleButton) {
        console.error(CAT, '[applyTheme] Theme button or icon not found');
        return null;
    }

    const savedTheme = globalThis.globalSettings.css_style || 'dark';
    applyTheme(savedTheme);

    themeToggleButton.addEventListener('click', () => {
        const currentTheme = globalThis.globalSettings.css_style;
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        applyTheme(newTheme);
        globalThis.globalSettings.css_style = newTheme;
    });

    return themeToggleButton;
}

export function applyTheme(theme) {
    const themeIcon = document.getElementById('global-settings-theme-icon');
    if (!themeIcon) {
        console.error(CAT, '[applyTheme] Theme button or icon not found');
        return null;
    }
    const next = theme === 'light' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    themeIcon.src = next === 'dark' ? 'scripts/svg/sun.svg' : 'scripts/svg/moon.svg';
}
