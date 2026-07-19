import { app, ipcMain, dialog } from 'electron';
import path from 'node:path';
import https from 'node:https';
import http from 'node:http';
import * as fs from 'node:fs';

const CAT = '[FileDownloader]';
const appPath = app.isPackaged ? path.join(path.dirname(app.getPath('exe')), 'resources', 'app') : app.getAppPath();

function downloadFile(url, filePath, redirectCount = 0, cookies = '') {
    return new Promise((resolve, reject) => {
        const maxRedirects = 5;
        console.log(`${CAT}: Downloading... ${url}`);

        const urlObj = new URL(url);
        const protocol = urlObj.protocol === 'https:' ? https : http;

        const headers = {
            // Chrome Windows User-Agent
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.61 Safari/537.36'
        };

        // pass Cookie
        if (cookies) {
            headers['Cookie'] = cookies;
        }

        const request = protocol.get(url, { headers }, (response) => {
            // collecting Cookie
            const setCookieHeaders = response.headers['set-cookie'];
            let newCookies = cookies;
            if (setCookieHeaders) {
                const cookieStrings = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
                newCookies = cookieStrings
                    .map(cookie => cookie.split(';')[0])
                    .concat(cookies ? [cookies] : [])
                    .join('; ');
            }
            console.log(`${CAT}: Received cookies: ${newCookies}`);
            console.log(`${CAT}: Response Status Code: ${response.statusCode}`);

            // handle redirects
            if ([301, 302, 307, 308].includes(response.statusCode)) {
                console.log(`${CAT}: Received redirect response for ${url} with status code ${response.statusCode}`);
                if (redirectCount >= maxRedirects) {
                    console.error(`${CAT}: Too many redirects for ${url}`);
                    reject(new Error('Too many redirects'));
                    return;
                }

                const redirectUrl = response.headers.location;
                if (!redirectUrl) {
                    console.error(`${CAT}: Redirect response missing location header for ${url}`);
                    reject(new Error('Redirect response missing location header'));
                    return;
                }

                console.log(`${CAT}: Redirecting to ${redirectUrl}`);
                response.resume();
                downloadFile(redirectUrl, filePath, redirectCount + 1, newCookies)
                    .then(resolve)
                    .catch(reject);
                return;
            }

            if (response.statusCode !== 200) {
                console.error(`${CAT}: Failed to download file. Status Code: ${response.statusCode}`);
                response.resume();
                reject(new Error(`Failed to download file. Status Code: ${response.statusCode}`));
                return;
            }

            const fileStream = fs.createWriteStream(filePath);
            response.pipe(fileStream);
            fileStream.on('finish', () => {
                fileStream.close();
                console.log(`${CAT}: File downloaded successfully to ${filePath}`);
                resolve();
            });
        });

        request.on('error', (err) => {
            console.error(`${CAT}: Error downloading file: ${url}\n\tname: ${err.name}\n\tmessage: ${err.message}\n\terror: ${err.errors}`);
            fs.unlink(filePath, () => {});
            reject(new Error(String(err)));
        });
    });
}

async function setupDownloadFiles() {
    const saveDir = path.join(appPath, 'data');
    if (!fs.existsSync(saveDir)) {
        console.log(CAT, 'Creating', saveDir);
        fs.mkdirSync(saveDir, { recursive: true });
    }

    const wai_illustrious_character_select_files = [
        // github
        { 'name': 'original_character', 'file_path': path.join(saveDir, 'original_character.json'), 'url': 'https://raw.githubusercontent.com/mirabarukaso/character_select_stand_alone_app/refs/heads/main/data/original_character.json' },
        { 'name': 'view_tags', 'file_path': path.join(saveDir, 'view_tags.json'), 'url': 'https://raw.githubusercontent.com/mirabarukaso/character_select_stand_alone_app/refs/heads/main/data/view_tags.json' },
        { 'name': 'waiIllustriousSDXL_v160_characters', 'file_path': path.join(saveDir, 'waiIllustriousSDXL_v160_characters.csv'), 'url': 'https://raw.githubusercontent.com/mirabarukaso/character_select_stand_alone_app/refs/heads/main/data/wai_characters.csv' },
        { 'name': 'waiIllustriousSDXL_v160_tag_assist', 'file_path': path.join(saveDir, 'waiIllustriousSDXL_v160_tag_assist.json'), 'url': 'https://raw.githubusercontent.com/mirabarukaso/character_select_stand_alone_app/refs/heads/main/data/wai_tag_assist.json' },
        // huggingface
        { 'name': 'waiIllustriousSDXL_v160_thumbs', 'file_path': path.join(saveDir, 'waiIllustriousSDXL_v160_thumbs.json'), 'url': 'https://huggingface.co/datasets/flagrantia/character_select_stand_alone_app/resolve/main/wai_character_thumbs_v160.json?download=true' },
        // github outside
        { 'name': 'danbooru_tag', 'file_path': path.join(saveDir, 'danbooru_e621_merged.csv'), 'url': 'https://raw.githubusercontent.com/DominikDoom/a1111-sd-webui-tagcomplete/refs/heads/main/tags/danbooru_e621_merged.csv' }
    ];
        
    try {
        // rename old files if they exist
        const oldFiles = ['wai_character_thumbs.json', 'wai_characters.csv', 'wai_tag_assist.json'];
        const newNames = ['waiIllustriousSDXL_v160_thumbs.json', 'waiIllustriousSDXL_v160_characters.csv', 'waiIllustriousSDXL_v160_tag_assist.json'];
        oldFiles.forEach((oldFileName, index) => {
            const oldFilePath = path.join(saveDir, oldFileName);
            const newFilePath = path.join(saveDir, newNames[index]);
            const oldExists = fs.existsSync(oldFilePath);
            const newExists = fs.existsSync(newFilePath);

            if (oldExists && newExists) {
                console.warn(`${CAT}: Both old file ${oldFileName} and new file ${newNames[index]} exist. Skipping rename to avoid overwrite.`);
                return;
            }

            if (oldExists) {
                try {
                    fs.renameSync(oldFilePath, newFilePath);
                    console.warn(`${CAT}: Renamed ${oldFileName} to ${newNames[index]}`);
                } catch (renameError) {
                    console.error(`${CAT}: Failed to rename ${oldFileName} to ${newNames[index]} - ${renameError.message}`);
                }
            }
        });

        // download files if they don't exist
        const downloadPromises = wai_illustrious_character_select_files.map(async (wai) => {
            if (!fs.existsSync(wai.file_path)) {
                await downloadFile(wai.url, wai.file_path);
            }
        });

        await Promise.all(downloadPromises);
        console.log(CAT, 'All files downloaded successfully');        
    } catch (error) {
        console.error(CAT, `Error in setupDownloadFiles: ${error.message}`);
        dialog.showErrorBox(CAT, `Error in setupDownloadFiles: ${error.message}`);
        return false;
    }

    ipcMain.handle('download-url', async (event, url, filePath) => {
        try {
            await downloadFile(url, filePath);
            return true;
        } catch (err) {
            console.error(CAT, `Error downloading file via IPC: ${err.message}`);
            return false;
        }
    });

    return true;
}

 async function requestDownloadOldThumbs() {
    const saveDir = path.join(appPath, 'data');
    if (!fs.existsSync(saveDir)) {
        console.log(CAT, 'Creating', saveDir);
        fs.mkdirSync(saveDir, { recursive: true });
    }

    const wai_illustrious_character_select_files = [    
        // github
        { 'name': 'waiNSFWIllustrious_v120_tag_assist', 'file_path': path.join(saveDir, 'waiNSFWIllustrious_v120_tag_assist.json'), 'url': 'https://raw.githubusercontent.com/mirabarukaso/character_select_stand_alone_app/refs/heads/main/data/wai_tag_assist.json' },
        // huggingface        
        { 'name': 'waiNSFWIllustrious_v120_thumbs', 'file_path': path.join(saveDir, 'waiNSFWIllustrious_v120_thumbs.json'), 'url': 'https://huggingface.co/datasets/flagrantia/character_select_stand_alone_app/resolve/main/wai_character_thumbs_v120.json?download=true' },
        { 'name': 'waiNSFWIllustrious_v120_characters', 'file_path': path.join(saveDir, 'waiNSFWIllustrious_v120_characters.csv'), 'url': 'https://huggingface.co/datasets/flagrantia/character_select_stand_alone_app/raw/main/wai_characters_v120.csv' }
        
    ];

    // download files if they don't exist
    const downloadPromises = wai_illustrious_character_select_files.map(async (wai) => {
        if (!fs.existsSync(wai.file_path)) {
            await downloadFile(wai.url, wai.file_path);
        }
    });

    await Promise.all(downloadPromises);
    console.log(CAT, 'All files downloaded successfully');  
}

 async function requestDownloadAnimaThumbs() {
    const saveDir = path.join(appPath, 'data');
    if (!fs.existsSync(saveDir)) {
        console.log(CAT, 'Creating', saveDir);
        fs.mkdirSync(saveDir, { recursive: true });
    }

    const wai_illustrious_character_select_files = [    
        // github
        { 'name': 'waiANIMA_v10Base10tag_assist', 'file_path': path.join(saveDir, 'waiANIMA_v10Base10_tag_assist.json'), 'url': 'https://raw.githubusercontent.com/mirabarukaso/character_select_stand_alone_app/refs/heads/main/data/waiANIMA_tag_assist.json' },
        { 'name': 'waiANIMA_v10Base10_characters', 'file_path': path.join(saveDir, 'waiANIMA_v10Base10_characters.csv'), 'url': 'https://raw.githubusercontent.com/mirabarukaso/character_select_stand_alone_app/refs/heads/main/data/waiANIMA_characters.csv' },
        // huggingface        
        { 'name': 'waiANIMA_v10Base10_thumbs', 'file_path': path.join(saveDir, 'waiANIMA_v10Base10_thumbs.json'), 'url': 'https://huggingface.co/datasets/flagrantia/character_select_stand_alone_app/resolve/main/waiANIMA_v10Base10_thumbs.json?download=true' }
    ];

    // download files if they don't exist
    const downloadPromises = wai_illustrious_character_select_files.map(async (wai) => {
        if (!fs.existsSync(wai.file_path)) {
            await downloadFile(wai.url, wai.file_path);
        }
    });

    await Promise.all(downloadPromises);
    console.log(CAT, 'All files downloaded successfully');  
}

export {
    setupDownloadFiles,
    requestDownloadOldThumbs,
    requestDownloadAnimaThumbs
};