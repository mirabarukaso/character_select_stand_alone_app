export function hiresCalculate() {
    const hr_width = Math.round((globalThis.globalSettings.width * globalThis.globalSettings.api_hf_scale)/8)*8;
    const hr_height = Math.round((globalThis.globalSettings.height * globalThis.globalSettings.api_hf_scale)/8)*8;

    const mega_pixel = (Number.parseFloat(hr_width * hr_height / 1024) / 1024).toFixed(2); 

    const resolution = document.querySelector('.hires-fix-resolution');
    if(resolution) {
        const SETTINGS = globalThis.globalSettings;
        const FILES = globalThis.cachedFiles;
        const LANG = FILES.language[SETTINGS.language];

        const message = LANG.api_hf_message.replace('{0}', globalThis.globalSettings.width)
                                    .replace('{1}', globalThis.globalSettings.height)
                                    .replace('{2}', globalThis.globalSettings.api_hf_scale)
                                    .replace('{3}', hr_width).replace('{4}', hr_height).replace('{5}', mega_pixel);

        resolution.innerHTML = message;
    }
}