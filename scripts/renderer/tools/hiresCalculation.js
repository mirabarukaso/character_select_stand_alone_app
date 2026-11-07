export function hiresCalculate() {
    const SETTINGS = globalThis.globalSettings;
    const landscape = Boolean(
        globalThis.generate?.landscape?.getValue?.()
        ?? SETTINGS?.api_image_landscape
    );
    const baseWidth = Number(SETTINGS.width) || 0;
    const baseHeight = Number(SETTINGS.height) || 0;
    const width = landscape ? baseHeight : baseWidth;
    const height = landscape ? baseWidth : baseHeight;
    const scale = Number(SETTINGS.api_hf_scale) || 1;

    const hr_width = Math.round((width * scale) / 8) * 8;
    const hr_height = Math.round((height * scale) / 8) * 8;

    const mega_pixel = (Number.parseFloat(hr_width * hr_height / 1024) / 1024).toFixed(2);

    const resolutions = document.querySelectorAll('.hires-fix-resolution');
    for (const resolution of resolutions) {
        const FILES = globalThis.cachedFiles;
        const LANG = FILES.language[SETTINGS.language];

        const message = LANG.api_hf_message.replace('{0}', width)
            .replace('{1}', height)
            .replace('{2}', scale)
            .replace('{3}', hr_width)
            .replace('{4}', hr_height)
            .replace('{5}', mega_pixel);

        resolution.innerHTML = message;
    }
}