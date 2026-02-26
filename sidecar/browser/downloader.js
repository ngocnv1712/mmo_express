/**
 * Browser Downloader Module
 * Downloads Chromium from Playwright CDN for packaged apps
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// Playwright CDN and version info
const PLAYWRIGHT_CDN = 'https://playwright.azureedge.net/builds/chromium';
const CHROMIUM_REVISION = '1208'; // Match playwright version

/**
 * Get platform-specific download info
 */
function getPlatformInfo() {
  const platform = os.platform();
  const arch = os.arch();

  if (platform === 'linux') {
    return {
      name: 'chromium-linux',
      zip: `chromium-linux.zip`,
      execPath: 'chrome-linux64/chrome'
    };
  } else if (platform === 'darwin') {
    return {
      name: 'chromium-mac',
      zip: arch === 'arm64' ? 'chromium-mac-arm64.zip' : 'chromium-mac.zip',
      execPath: 'chrome-mac/Chromium.app/Contents/MacOS/Chromium'
    };
  } else if (platform === 'win32') {
    return {
      name: 'chromium-win64',
      zip: 'chromium-win64.zip',
      execPath: 'chrome-win/chrome.exe'
    };
  }

  throw new Error(`Unsupported platform: ${platform}`);
}

/**
 * Get Chromium install directory
 */
function getChromiumDir() {
  const homeDir = process.env.HOME || os.homedir();
  return path.join(homeDir, '.cache', 'ms-playwright', `chromium-${CHROMIUM_REVISION}`);
}

/**
 * Check if Chromium is installed
 */
function isChromiumInstalled() {
  const chromiumDir = getChromiumDir();
  const platformInfo = getPlatformInfo();
  const execPath = path.join(chromiumDir, platformInfo.execPath);
  return fs.existsSync(execPath);
}

/**
 * Get Chromium executable path
 */
function getChromiumPath() {
  const chromiumDir = getChromiumDir();
  const platformInfo = getPlatformInfo();
  return path.join(chromiumDir, platformInfo.execPath);
}

/**
 * Download file from URL
 */
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    console.error(`[DOWNLOAD] Downloading from ${url}`);

    const file = fs.createWriteStream(destPath);
    let totalBytes = 0;
    let downloadedBytes = 0;

    const request = https.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        file.close();
        fs.unlinkSync(destPath);
        return downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
      }

      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(destPath);
        return reject(new Error(`Download failed: ${response.statusCode}`));
      }

      totalBytes = parseInt(response.headers['content-length'], 10) || 0;

      response.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        if (totalBytes > 0) {
          const percent = Math.round((downloadedBytes / totalBytes) * 100);
          process.stderr.write(`\r[DOWNLOAD] Progress: ${percent}% (${Math.round(downloadedBytes / 1024 / 1024)}MB)`);
        }
      });

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        console.error(''); // New line after progress
        resolve();
      });
    });

    request.on('error', (err) => {
      file.close();
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

/**
 * Extract zip file
 */
function extractZip(zipPath, destDir) {
  console.error(`[DOWNLOAD] Extracting to ${destDir}`);

  // Create destination directory
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  // Use system unzip command
  try {
    if (os.platform() === 'win32') {
      execSync(`powershell -command "Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force"`, {
        stdio: 'inherit'
      });
    } else {
      execSync(`unzip -q -o "${zipPath}" -d "${destDir}"`, {
        stdio: 'inherit'
      });
    }
  } catch (e) {
    throw new Error(`Failed to extract: ${e.message}`);
  }
}

/**
 * Download and install Chromium
 */
async function downloadChromium() {
  if (isChromiumInstalled()) {
    console.error('[DOWNLOAD] Chromium already installed');
    return getChromiumPath();
  }

  const platformInfo = getPlatformInfo();
  const chromiumDir = getChromiumDir();
  const downloadUrl = `${PLAYWRIGHT_CDN}/${CHROMIUM_REVISION}/${platformInfo.zip}`;
  const tempDir = path.join(os.tmpdir(), 'mmo-chromium-download');
  const zipPath = path.join(tempDir, 'chromium.zip');

  console.error('[DOWNLOAD] Chromium not found, downloading...');
  console.error(`[DOWNLOAD] Platform: ${platformInfo.name}`);

  // Create temp directory
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  try {
    // Download
    await downloadFile(downloadUrl, zipPath);

    // Extract
    extractZip(zipPath, chromiumDir);

    // Make executable on Unix
    if (os.platform() !== 'win32') {
      const execPath = getChromiumPath();
      fs.chmodSync(execPath, '755');
    }

    // Cleanup
    fs.unlinkSync(zipPath);
    fs.rmdirSync(tempDir, { recursive: true });

    console.error('[DOWNLOAD] Chromium installed successfully');
    return getChromiumPath();

  } catch (e) {
    console.error('[DOWNLOAD] Failed:', e.message);
    throw e;
  }
}

module.exports = {
  isChromiumInstalled,
  getChromiumPath,
  getChromiumDir,
  downloadChromium,
  CHROMIUM_REVISION
};
