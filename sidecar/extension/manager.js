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

// Extension storage directory
let extensionsDir = null;

/**
 * Initialize extension storage directory
 * @param {string} basePath - Base path for extension storage
 */
function initExtensionStorage(basePath) {
  extensionsDir = basePath || path.join(process.cwd(), 'extensions');
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
 * List all installed extensions
 * @returns {Array} List of extensions
 */
function listExtensions() {
  const extPath = getExtensionPath();
  const extensions = [];

  if (!fs.existsSync(extPath)) {
    return extensions;
  }

  const dirs = fs.readdirSync(extPath, { withFileTypes: true });
  for (const dir of dirs) {
    if (dir.isDirectory()) {
      const manifestPath = path.join(extPath, dir.name, 'manifest.json');
      if (fs.existsSync(manifestPath)) {
        try {
          const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
          extensions.push({
            id: dir.name,
            name: manifest.name || dir.name,
            version: manifest.version || '0.0.0',
            description: manifest.description || '',
            path: path.join(extPath, dir.name),
            manifest,
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
      // Try with node if unzip not available
      throw new Error('unzip command failed. Please install unzip or extract manually.');
    }

    // Read manifest
    const manifestPath = path.join(destPath, 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    console.error(`[EXTENSION] Imported CRX: ${manifest.name} (${extId})`);

    return {
      id: extId,
      name: manifest.name,
      version: manifest.version,
      path: destPath,
    };
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
function getExtensionPaths(extensionIds) {
  const paths = [];
  for (const id of extensionIds) {
    const extPath = path.join(getExtensionPath(), id);
    if (fs.existsSync(extPath)) {
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

module.exports = {
  initExtensionStorage,
  getExtensionPath,
  listExtensions,
  importUnpacked,
  importCRX,
  removeExtension,
  getExtensionPaths,
  buildExtensionArgs,
  generateExtensionId,
  EXTENSION_PRESETS,
};
