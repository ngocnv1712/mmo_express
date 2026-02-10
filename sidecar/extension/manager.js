/**
 * Extension Manager Module
 * Manages browser extensions for Chromium-based browsers
 *
 * Note: Playwright supports extensions only in Chromium with persistent context
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');
const https = require('https');
const http = require('http');

// Extension storage directory
let extensionsDir = null;

// Metadata file name
const METADATA_FILE = '.extension-meta.json';

/**
 * Get metadata file path for extension
 */
function getMetadataPath(extId) {
  return path.join(getExtensionPath(), extId, METADATA_FILE);
}

/**
 * Load extension metadata
 */
function loadMetadata(extId) {
  const metaPath = getMetadataPath(extId);
  if (fs.existsSync(metaPath)) {
    try {
      return JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    } catch (e) {
      return {};
    }
  }
  return {};
}

/**
 * Save extension metadata
 */
function saveMetadata(extId, metadata) {
  const metaPath = getMetadataPath(extId);
  fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2));
}

/**
 * Update extension metadata (merge)
 */
function updateMetadata(extId, updates) {
  const current = loadMetadata(extId);
  const updated = { ...current, ...updates };
  saveMetadata(extId, updated);
  return updated;
}

/**
 * Initialize extension storage directory
 * @param {string} basePath - Base path for extension storage
 */
function initExtensionStorage(basePath) {
  extensionsDir = basePath || path.join(process.cwd(), 'data', 'extensions');
  if (!fs.existsSync(extensionsDir)) {
    fs.mkdirSync(extensionsDir, { recursive: true });
  }
  return extensionsDir;
}

/**
 * Get extension storage path
 */
function getExtensionPath() {
  if (!extensionsDir) {
    initExtensionStorage();
  }
  return extensionsDir;
}

/**
 * Resolve i18n message from _locales
 * @param {string} msg - Message key like "__MSG_name__"
 * @param {string} extPath - Extension path
 * @returns {string} Resolved message or original
 */
function resolveI18nMessage(msg, extPath) {
  if (!msg || !msg.startsWith('__MSG_') || !msg.endsWith('__')) {
    return msg;
  }

  const key = msg.slice(6, -2); // Remove __MSG_ and __
  const locales = ['en', 'en_US', 'en_GB', 'vi'];

  for (const locale of locales) {
    const messagesPath = path.join(extPath, '_locales', locale, 'messages.json');
    if (fs.existsSync(messagesPath)) {
      try {
        const messages = JSON.parse(fs.readFileSync(messagesPath, 'utf8'));
        if (messages[key]?.message) {
          return messages[key].message;
        }
      } catch (e) {
        // Ignore
      }
    }
  }

  return msg;
}

/**
 * Clean up temp folders from failed installations
 */
function cleanupTempFolders() {
  const extPath = getExtensionPath();
  if (!fs.existsSync(extPath)) return;

  const dirs = fs.readdirSync(extPath, { withFileTypes: true });
  for (const dir of dirs) {
    if (dir.isDirectory() && dir.name.startsWith('.temp_')) {
      const tempPath = path.join(extPath, dir.name);
      try {
        fs.rmSync(tempPath, { recursive: true, force: true });
        console.error(`[EXTENSION] Cleaned up temp folder: ${dir.name}`);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }
}

/**
 * List all installed extensions
 * @returns {Array} List of extensions
 */
function listExtensions() {
  const extPath = getExtensionPath();

  // Clean up any temp folders first
  cleanupTempFolders();
  const extensions = [];

  if (!fs.existsSync(extPath)) {
    return extensions;
  }

  const dirs = fs.readdirSync(extPath, { withFileTypes: true });
  for (const dir of dirs) {
    if (dir.isDirectory() && !dir.name.startsWith('.')) {
      const manifestPath = path.join(extPath, dir.name, 'manifest.json');
      if (fs.existsSync(manifestPath)) {
        try {
          const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
          const fullPath = path.join(extPath, dir.name);

          // Validate extension has required files
          if (manifest.default_locale) {
            const localesPath = path.join(fullPath, '_locales');
            if (!fs.existsSync(localesPath)) {
              console.error(`[EXTENSION] Skipping incomplete extension: ${dir.name} (missing _locales)`);
              continue;
            }
          }

          // Resolve i18n names
          let name = manifest.name || dir.name;
          let description = manifest.description || '';

          if (name.startsWith('__MSG_')) {
            name = resolveI18nMessage(name, fullPath);
          }
          if (description.startsWith('__MSG_')) {
            description = resolveI18nMessage(description, fullPath);
          }

          // If name still has __MSG_ prefix, extension is incomplete
          if (name.startsWith('__MSG_')) {
            console.error(`[EXTENSION] Skipping extension with unresolved i18n: ${dir.name}`);
            continue;
          }

          // Load metadata
          const metadata = loadMetadata(dir.name);

          extensions.push({
            id: dir.name,
            name: name,
            version: manifest.version || '0.0.0',
            description: description,
            path: fullPath,
            manifest,
            storeId: metadata.storeId || null,
            enabled: metadata.enabled !== false, // Default to enabled
          });
        } catch (e) {
          console.error(`[EXTENSION] Failed to read manifest for ${dir.name}:`, e.message);
        }
      }
    }
  }

  return extensions;
}

/**
 * Import extension from unpacked folder
 * @param {string} sourcePath - Path to unpacked extension
 * @param {string} customId - Custom ID (optional)
 * @returns {Object} Extension info
 */
function importUnpacked(sourcePath, customId = null) {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Extension path not found: ${sourcePath}`);
  }

  const manifestPath = path.join(sourcePath, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error('manifest.json not found in extension folder');
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const extId = customId || generateExtensionId(manifest.name || sourcePath);
  const destPath = path.join(getExtensionPath(), extId);

  // Copy extension folder
  copyFolderSync(sourcePath, destPath);

  console.error(`[EXTENSION] Imported: ${manifest.name} (${extId})`);

  return {
    id: extId,
    name: manifest.name,
    version: manifest.version,
    path: destPath,
  };
}

/**
 * Import extension from CRX file
 * @param {string} crxPath - Path to .crx file
 * @returns {Object} Extension info
 */
function importCRX(crxPath) {
  if (!fs.existsSync(crxPath)) {
    throw new Error(`CRX file not found: ${crxPath}`);
  }

  const extId = generateExtensionId(crxPath);
  const destPath = path.join(getExtensionPath(), extId);

  // Create temp directory for extraction
  const tempDir = path.join(getExtensionPath(), `.temp_${extId}`);
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    // CRX files are ZIP files with a header
    // We need to find the ZIP start and extract
    const crxBuffer = fs.readFileSync(crxPath);

    // CRX3 format: magic (4) + version (4) + header_length (4) + header + zip
    // CRX2 format: magic (4) + version (4) + pubkey_length (4) + sig_length (4) + pubkey + sig + zip

    let zipStart = 0;
    const magic = crxBuffer.toString('ascii', 0, 4);

    if (magic === 'Cr24') {
      const version = crxBuffer.readUInt32LE(4);
      if (version === 3) {
        // CRX3
        const headerLength = crxBuffer.readUInt32LE(8);
        zipStart = 12 + headerLength;
      } else if (version === 2) {
        // CRX2
        const pubkeyLength = crxBuffer.readUInt32LE(8);
        const sigLength = crxBuffer.readUInt32LE(12);
        zipStart = 16 + pubkeyLength + sigLength;
      }
    }

    // Write ZIP portion to temp file
    const zipPath = path.join(tempDir, 'extension.zip');
    fs.writeFileSync(zipPath, crxBuffer.slice(zipStart));

    // Extract ZIP
    try {
      execSync(`unzip -o "${zipPath}" -d "${destPath}"`, { stdio: 'pipe' });
    } catch (e) {
      // Clean up failed extraction
      if (fs.existsSync(destPath)) {
        fs.rmSync(destPath, { recursive: true, force: true });
      }
      throw new Error('unzip command failed. Please install unzip or extract manually.');
    }

    // Read manifest
    const manifestPath = path.join(destPath, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      // Clean up invalid extension
      if (fs.existsSync(destPath)) {
        fs.rmSync(destPath, { recursive: true, force: true });
      }
      throw new Error('Invalid extension: missing manifest.json');
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    // Validate extension has required files
    if (manifest.default_locale) {
      const localesPath = path.join(destPath, '_locales');
      if (!fs.existsSync(localesPath)) {
        // Clean up incomplete extension
        if (fs.existsSync(destPath)) {
          fs.rmSync(destPath, { recursive: true, force: true });
        }
        throw new Error('Extension incomplete: missing _locales folder');
      }
    }

    console.error(`[EXTENSION] Imported CRX: ${manifest.name} (${extId})`);

    return {
      id: extId,
      name: manifest.name,
      version: manifest.version,
      path: destPath,
    };
  } catch (e) {
    // Clean up on any error
    if (fs.existsSync(destPath)) {
      fs.rmSync(destPath, { recursive: true, force: true });
    }
    throw e;
  } finally {
    // Cleanup temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
}

/**
 * Remove extension
 * @param {string} extId - Extension ID
 */
function removeExtension(extId) {
  const extPath = path.join(getExtensionPath(), extId);
  if (fs.existsSync(extPath)) {
    fs.rmSync(extPath, { recursive: true, force: true });
    console.error(`[EXTENSION] Removed: ${extId}`);
    return true;
  }
  return false;
}

/**
 * Get extension paths for browser launch
 * @param {Array} extensionIds - List of extension IDs to load
 * @returns {Array} List of extension paths
 */
function getExtensionPaths(extensionIds, includeDisabled = false) {
  const paths = [];
  for (const id of extensionIds) {
    const extPath = path.join(getExtensionPath(), id);
    if (fs.existsSync(extPath)) {
      // Check if extension is enabled (unless includeDisabled is true)
      if (!includeDisabled) {
        const metadata = loadMetadata(id);
        if (metadata.enabled === false) {
          continue; // Skip disabled extensions
        }
      }
      paths.push(extPath);
    }
  }
  return paths;
}

/**
 * Build Chromium args for extensions
 * @param {Array} extensionIds - List of extension IDs
 * @returns {Array} Chromium launch args
 */
function buildExtensionArgs(extensionIds) {
  const paths = getExtensionPaths(extensionIds);
  if (paths.length === 0) {
    return [];
  }

  return [
    `--disable-extensions-except=${paths.join(',')}`,
    `--load-extension=${paths.join(',')}`,
  ];
}

/**
 * Generate extension ID from name/path
 * @param {string} input - Name or path
 * @returns {string} Extension ID
 */
function generateExtensionId(input) {
  const hash = crypto.createHash('sha256').update(input).digest('hex');
  return hash.substring(0, 32);
}

/**
 * Copy folder recursively
 */
function copyFolderSync(source, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(source, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(source, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyFolderSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Download and install extension from Chrome Web Store
 * @param {string} webstoreId - Chrome Web Store extension ID
 * @returns {Promise<Object>} Extension info
 */
async function downloadAndInstall(webstoreId) {
  console.error(`[EXTENSION] Downloading extension: ${webstoreId}`);

  const tempDir = path.join(getExtensionPath(), `.temp_download_${webstoreId}`);
  const crxPath = path.join(tempDir, `${webstoreId}.crx`);

  fs.mkdirSync(tempDir, { recursive: true });

  try {
    // Try multiple download methods
    let downloaded = false;
    const errors = [];

    // Multiple download sources to try
    const urls = [
      // CRX download services (more reliable than direct Google API)
      `https://crxextractor.com/download.php?ext=${webstoreId}`,
      // Edge Add-ons API (works for many Chrome extensions)
      `https://edge.microsoft.com/extensionwebstorebase/v1/crx?response=redirect&x=id%3D${webstoreId}%26installsource%3Dondemand%26uc`,
      // Chrome Web Store direct (often blocked but worth trying)
      `https://clients2.google.com/service/update2/crx?response=redirect&os=linux&arch=x86-64&nacl_arch=x86-64&prod=chromiumcrx&prodchannel=stable&prodversion=125.0.6422.141&acceptformat=crx3&x=id%3D${webstoreId}%26uc`,
      `https://clients2.google.com/service/update2/crx?response=redirect&prodversion=120.0.0.0&acceptformat=crx2,crx3&x=id%3D${webstoreId}%26installsource%3Dondemand%26uc`,
    ];

    for (const url of urls) {
      try {
        // Clean up previous attempt
        if (fs.existsSync(crxPath)) {
          fs.unlinkSync(crxPath);
        }

        console.error(`[EXTENSION] Trying: ${url.substring(0, 60)}...`);
        await downloadFile(url, crxPath);

        // Verify the file was downloaded and is a valid CRX
        if (fs.existsSync(crxPath)) {
          const stats = fs.statSync(crxPath);
          console.error(`[EXTENSION] Downloaded file size: ${stats.size} bytes`);

          if (stats.size > 1000) {
            // Check for valid CRX magic bytes or ZIP (some services return ZIP)
            const buffer = Buffer.alloc(4);
            const fd = fs.openSync(crxPath, 'r');
            fs.readSync(fd, buffer, 0, 4, 0);
            fs.closeSync(fd);

            const magic = buffer.toString('ascii', 0, 4);
            if (magic === 'Cr24') {
              downloaded = true;
              console.error(`[EXTENSION] Valid CRX downloaded: ${stats.size} bytes`);
              break;
            } else if (magic === 'PK\x03\x04' || buffer[0] === 0x50 && buffer[1] === 0x4B) {
              // It's a ZIP file, rename and extract directly
              console.error(`[EXTENSION] Downloaded as ZIP, extracting...`);
              const extId = generateExtensionId(webstoreId);
              const destPath = path.join(getExtensionPath(), extId);
              try {
                execSync(`unzip -o "${crxPath}" -d "${destPath}"`, { stdio: 'pipe' });
                const manifestPath = path.join(destPath, 'manifest.json');
                if (fs.existsSync(manifestPath)) {
                  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

                  // Validate extension has required files
                  const hasLocales = !manifest.default_locale || fs.existsSync(path.join(destPath, '_locales'));
                  if (!hasLocales) {
                    throw new Error('Extension incomplete: missing _locales folder');
                  }

                  // Save metadata with storeId
                  saveMetadata(extId, { storeId: webstoreId, enabled: true });
                  console.error(`[EXTENSION] Installed from ZIP: ${manifest.name}`);
                  return {
                    id: extId,
                    name: manifest.name,
                    version: manifest.version,
                    path: destPath,
                    storeId: webstoreId,
                    enabled: true,
                  };
                } else {
                  throw new Error('Invalid extension: missing manifest.json');
                }
              } catch (e) {
                // Clean up failed extraction
                if (fs.existsSync(destPath)) {
                  fs.rmSync(destPath, { recursive: true, force: true });
                }
                errors.push('ZIP extraction failed: ' + e.message);
              }
            } else {
              errors.push(`Invalid file format (magic: ${magic})`);
            }
          } else {
            errors.push(`File too small: ${stats.size} bytes`);
          }
        }
      } catch (e) {
        errors.push(e.message);
        console.error(`[EXTENSION] Attempt failed: ${e.message}`);
      }
    }

    if (!downloaded) {
      throw new Error(`Chrome Web Store blocked download. Please install manually:\n1. Visit: https://chrome.google.com/webstore/detail/${webstoreId}\n2. Use CRX Extractor: https://crxextractor.com/`);
    }

    // Import the CRX
    const result = importCRX(crxPath);
    result.storeId = webstoreId;
    result.enabled = true;

    // Save metadata with storeId
    saveMetadata(result.id, { storeId: webstoreId, enabled: true });

    console.error(`[EXTENSION] Installed from store: ${result.name}`);
    return result;
  } finally {
    // Cleanup temp
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
}

/**
 * Download file from URL with redirect support
 * @param {string} url - URL to download
 * @param {string} destPath - Destination path
 * @returns {Promise<void>}
 */
function downloadFile(url, destPath, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 10) {
      reject(new Error('Too many redirects'));
      return;
    }

    const protocol = url.startsWith('https') ? https : http;

    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/x-chrome-extension,*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
      },
      timeout: 60000, // 60 second timeout
    };

    const req = protocol.get(url, options, (response) => {
      // Handle redirects
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        let redirectUrl = response.headers.location;
        // Handle relative redirects
        if (!redirectUrl.startsWith('http')) {
          const urlObj = new URL(url);
          redirectUrl = `${urlObj.protocol}//${urlObj.host}${redirectUrl}`;
        }
        console.error(`[EXTENSION] Redirect ${response.statusCode} -> ${redirectUrl.substring(0, 60)}...`);
        downloadFile(redirectUrl, destPath, redirectCount + 1)
          .then(resolve)
          .catch(reject);
        return;
      }

      if (response.statusCode === 204) {
        reject(new Error('Extension not available (204 No Content - may be restricted or removed)'));
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Download failed with status ${response.statusCode}: ${response.statusMessage}`));
        return;
      }

      // Check content type
      const contentType = response.headers['content-type'] || '';
      if (contentType.includes('text/html')) {
        reject(new Error('Received HTML instead of CRX - extension may not exist or is restricted'));
        return;
      }

      const file = fs.createWriteStream(destPath);
      response.pipe(file);

      file.on('finish', () => {
        file.close();
        resolve();
      });

      file.on('error', (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
    });

    req.on('error', (err) => {
      reject(new Error(`Network error: ${err.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Download timed out after 60 seconds'));
    });
  });
}

/**
 * Common extension presets
 */
const EXTENSION_PRESETS = {
  'ublock-origin': {
    name: 'uBlock Origin',
    webstoreId: 'cjpalhdlnbpafiamejdnhcphjbkeiagm',
    description: 'Ad blocker',
  },
  'dark-reader': {
    name: 'Dark Reader',
    webstoreId: 'eimadpbcbfnmbkopoojfekhnkhdbieeh',
    description: 'Dark mode for websites',
  },
  'privacy-badger': {
    name: 'Privacy Badger',
    webstoreId: 'pkehgijcmpdhfbdbbnkijodmdjhbjlgp',
    description: 'Blocks invisible trackers',
  },
  'noscript': {
    name: 'NoScript',
    webstoreId: 'doojmbjmlfjjnbmnoijecmcbfeoakpjm',
    description: 'Script blocker',
  },
};

/**
 * Enable extension
 * @param {string} extId - Extension ID
 */
function enableExtension(extId) {
  const extPath = path.join(getExtensionPath(), extId);
  if (!fs.existsSync(extPath)) {
    throw new Error(`Extension not found: ${extId}`);
  }
  updateMetadata(extId, { enabled: true });
  console.error(`[EXTENSION] Enabled: ${extId}`);
  return { success: true, id: extId, enabled: true };
}

/**
 * Disable extension
 * @param {string} extId - Extension ID
 */
function disableExtension(extId) {
  const extPath = path.join(getExtensionPath(), extId);
  if (!fs.existsSync(extPath)) {
    throw new Error(`Extension not found: ${extId}`);
  }
  updateMetadata(extId, { enabled: false });
  console.error(`[EXTENSION] Disabled: ${extId}`);
  return { success: true, id: extId, enabled: false };
}

/**
 * Toggle extension enabled state
 * @param {string} extId - Extension ID
 */
function toggleExtension(extId) {
  const metadata = loadMetadata(extId);
  const newState = metadata.enabled === false; // If disabled (false), enable. Otherwise disable.
  if (newState) {
    return enableExtension(extId);
  } else {
    return disableExtension(extId);
  }
}

module.exports = {
  initExtensionStorage,
  getExtensionPath,
  listExtensions,
  importUnpacked,
  importCRX,
  downloadAndInstall,
  removeExtension,
  getExtensionPaths,
  buildExtensionArgs,
  generateExtensionId,
  enableExtension,
  disableExtension,
  toggleExtension,
  EXTENSION_PRESETS,
};
