/**
 * Warm-up Login Handler
 * Hybrid login approach: Cookies first, then credentials
 */

const fs = require('fs');
const path = require('path');
const { autoImport, exportJSON } = require('../cookie/manager');

// Cookie storage directory
const COOKIE_DIR = path.join(__dirname, '..', 'data', 'cookies');

// Platform login configurations
const PLATFORM_LOGIN = {
  facebook: {
    url: 'https://www.facebook.com',
    loginUrl: 'https://www.facebook.com/login',
    cookieDomain: '.facebook.com',
    selectors: {
      emailInput: '#email',
      passwordInput: '#pass',
      loginButton: 'button[name="login"]',
      twoFaInput: '#approvals_code',
      twoFaSubmit: '#checkpointSubmitButton',
      loggedInIndicator: '[aria-label="Your profile"], [aria-label="Account"], [data-pagelet="ProfileTilesFeed"]'
    },
    checkLoggedIn: async (page) => {
      try {
        await page.waitForSelector('[aria-label="Your profile"], [aria-label="Account"]', { timeout: 5000 });
        return true;
      } catch {
        return false;
      }
    }
  },
  tiktok: {
    url: 'https://www.tiktok.com',
    loginUrl: 'https://www.tiktok.com/login/phone-or-email/email',
    cookieDomain: '.tiktok.com',
    selectors: {
      emailInput: 'input[name="username"]',
      passwordInput: 'input[type="password"]',
      loginButton: 'button[type="submit"]',
      loggedInIndicator: '[data-e2e="profile-icon"]'
    },
    checkLoggedIn: async (page) => {
      try {
        await page.waitForSelector('[data-e2e="profile-icon"]', { timeout: 5000 });
        return true;
      } catch {
        return false;
      }
    }
  },
  instagram: {
    url: 'https://www.instagram.com',
    loginUrl: 'https://www.instagram.com/accounts/login',
    cookieDomain: '.instagram.com',
    selectors: {
      emailInput: 'input[name="username"]',
      passwordInput: 'input[name="password"]',
      loginButton: 'button[type="submit"]',
      loggedInIndicator: 'a[href*="/direct/inbox"]'
    },
    checkLoggedIn: async (page) => {
      try {
        await page.waitForSelector('a[href*="/direct/inbox"], svg[aria-label="Home"]', { timeout: 5000 });
        return true;
      } catch {
        return false;
      }
    }
  },
  google: {
    url: 'https://www.google.com',
    loginUrl: 'https://accounts.google.com/signin',
    cookieDomain: '.google.com',
    selectors: {
      emailInput: 'input[type="email"]',
      emailNext: '#identifierNext',
      passwordInput: 'input[type="password"]',
      passwordNext: '#passwordNext',
      loggedInIndicator: '[data-ogsr-up], a[href*="SignOutOptions"]'
    },
    checkLoggedIn: async (page) => {
      try {
        await page.waitForSelector('[data-ogsr-up], a[href*="SignOutOptions"]', { timeout: 5000 });
        return true;
      } catch {
        return false;
      }
    }
  },
  twitter: {
    url: 'https://twitter.com',
    loginUrl: 'https://twitter.com/i/flow/login',
    cookieDomain: '.twitter.com',
    selectors: {
      emailInput: 'input[autocomplete="username"]',
      nextButton: '[role="button"]:has-text("Next")',
      passwordInput: 'input[type="password"]',
      loginButton: '[data-testid="LoginForm_Login_Button"]',
      loggedInIndicator: '[data-testid="AppTabBar_Profile_Link"]'
    },
    checkLoggedIn: async (page) => {
      try {
        await page.waitForSelector('[data-testid="AppTabBar_Profile_Link"]', { timeout: 5000 });
        return true;
      } catch {
        return false;
      }
    }
  },
  youtube: {
    url: 'https://www.youtube.com',
    loginUrl: 'https://accounts.google.com/signin',
    cookieDomain: '.youtube.com',
    selectors: {
      loggedInIndicator: '#avatar-btn'
    },
    checkLoggedIn: async (page) => {
      try {
        await page.waitForSelector('#avatar-btn', { timeout: 5000 });
        return true;
      } catch {
        return false;
      }
    }
  },
  linkedin: {
    url: 'https://www.linkedin.com',
    loginUrl: 'https://www.linkedin.com/login',
    cookieDomain: '.linkedin.com',
    selectors: {
      emailInput: '#username',
      passwordInput: '#password',
      loginButton: 'button[type="submit"]',
      loggedInIndicator: '.global-nav__me-photo'
    },
    checkLoggedIn: async (page) => {
      try {
        await page.waitForSelector('.global-nav__me-photo', { timeout: 5000 });
        return true;
      } catch {
        return false;
      }
    }
  },
  telegram: {
    url: 'https://web.telegram.org/k/',
    loginUrl: 'https://web.telegram.org/k/',
    cookieDomain: '.telegram.org',
    selectors: {
      loggedInIndicator: '.chat-list'
    },
    checkLoggedIn: async (page) => {
      try {
        await page.waitForSelector('.chat-list', { timeout: 10000 });
        return true;
      } catch {
        return false;
      }
    }
  }
};

/**
 * WarmupLoginHandler class
 */
class WarmupLoginHandler {
  constructor(options = {}) {
    this.options = {
      cookieDir: options.cookieDir || COOKIE_DIR,
      timeout: options.timeout || 30000,
      verbose: options.verbose || false,
      ...options
    };

    // Ensure cookie directory exists
    if (!fs.existsSync(this.options.cookieDir)) {
      fs.mkdirSync(this.options.cookieDir, { recursive: true });
    }
  }

  /**
   * Perform hybrid login for a platform
   * @param {Object} params - Login parameters
   * @param {Object} params.page - Playwright page
   * @param {Object} params.context - Browser context
   * @param {string} params.platform - Platform name
   * @param {string} params.profileId - Profile ID
   * @param {Object} params.resource - Resource with credentials
   * @returns {Object} Login result
   */
  async login({ page, context, platform, profileId, resource }) {
    const platformConfig = PLATFORM_LOGIN[platform];
    if (!platformConfig) {
      throw new Error(`Unsupported platform: ${platform}`);
    }

    const result = {
      success: false,
      method: null,
      message: ''
    };

    // Step 1: Try cookies from resource
    if (resource?.cookies) {
      this._log(`[${platform}] Trying cookies from resource...`);
      try {
        const cookieResult = await this._loginWithCookies(page, context, platform, resource.cookies);
        if (cookieResult.success) {
          result.success = true;
          result.method = 'cookies_resource';
          result.message = 'Logged in with resource cookies';
          return result;
        }
      } catch (e) {
        this._log(`[${platform}] Resource cookies failed: ${e.message}`);
      }
    }

    // Step 2: Try saved cookies from file
    const savedCookies = await this._loadCookiesFromFile(profileId, platform);
    if (savedCookies) {
      this._log(`[${platform}] Trying saved cookies from file...`);
      try {
        const cookieResult = await this._loginWithCookies(page, context, platform, savedCookies);
        if (cookieResult.success) {
          result.success = true;
          result.method = 'cookies_file';
          result.message = 'Logged in with saved cookies';
          return result;
        }
      } catch (e) {
        this._log(`[${platform}] Saved cookies failed: ${e.message}`);
      }
    }

    // Step 3: Try credentials login
    if (resource && this._hasCredentials(resource)) {
      this._log(`[${platform}] Trying credentials login...`);
      try {
        const credResult = await this._loginWithCredentials(page, context, platform, resource);
        if (credResult.success) {
          // Save new cookies after successful login
          await this._saveCookiesAfterLogin(page, context, profileId, platform);
          result.success = true;
          result.method = 'credentials';
          result.message = 'Logged in with credentials';
          return result;
        }
      } catch (e) {
        this._log(`[${platform}] Credentials login failed: ${e.message}`);
        result.message = `Login failed: ${e.message}`;
      }
    }

    // All methods failed
    if (!result.message) {
      result.message = 'No valid login method available (no cookies or credentials)';
    }
    return result;
  }

  /**
   * Check if user is logged in
   */
  async checkLoggedIn(page, platform) {
    const platformConfig = PLATFORM_LOGIN[platform];
    if (!platformConfig) return false;

    try {
      return await platformConfig.checkLoggedIn(page);
    } catch {
      return false;
    }
  }

  /**
   * Login with cookies
   */
  async _loginWithCookies(page, context, platform, cookiesData) {
    const platformConfig = PLATFORM_LOGIN[platform];

    // Parse cookies if string
    let cookies = cookiesData;
    if (typeof cookiesData === 'string') {
      try {
        cookies = autoImport(cookiesData);
      } catch (e) {
        throw new Error(`Invalid cookie format: ${e.message}`);
      }
    }

    if (!Array.isArray(cookies) || cookies.length === 0) {
      throw new Error('No valid cookies found');
    }

    // Add cookies to context
    await context.addCookies(cookies);

    // Navigate to platform
    await page.goto(platformConfig.url, {
      waitUntil: 'domcontentloaded',
      timeout: this.options.timeout
    });

    // Wait for page to settle
    await this._sleep(2000);

    // Check if logged in
    const isLoggedIn = await platformConfig.checkLoggedIn(page);
    if (!isLoggedIn) {
      throw new Error('Cookies expired or invalid');
    }

    return { success: true };
  }

  /**
   * Login with credentials
   */
  async _loginWithCredentials(page, context, platform, resource) {
    const platformConfig = PLATFORM_LOGIN[platform];
    const selectors = platformConfig.selectors;

    // Navigate to login page
    await page.goto(platformConfig.loginUrl, {
      waitUntil: 'domcontentloaded',
      timeout: this.options.timeout
    });

    await this._sleep(2000);

    // Get login identifier (email, phone, or username)
    const loginId = resource.email || resource.phone || resource.username;
    if (!loginId) {
      throw new Error('No login identifier (email/phone/username) found');
    }

    // Platform-specific login flows
    switch (platform) {
      case 'facebook':
        await this._loginFacebook(page, selectors, loginId, resource);
        break;
      case 'google':
      case 'youtube':
        await this._loginGoogle(page, selectors, loginId, resource);
        break;
      case 'twitter':
        await this._loginTwitter(page, selectors, loginId, resource);
        break;
      case 'instagram':
        await this._loginInstagram(page, selectors, loginId, resource);
        break;
      case 'tiktok':
        await this._loginTiktok(page, selectors, loginId, resource);
        break;
      case 'linkedin':
        await this._loginLinkedin(page, selectors, loginId, resource);
        break;
      default:
        await this._loginGeneric(page, selectors, loginId, resource);
    }

    // Wait and verify login
    await this._sleep(3000);
    const isLoggedIn = await platformConfig.checkLoggedIn(page);

    if (!isLoggedIn) {
      throw new Error('Login failed - could not verify logged in state');
    }

    return { success: true };
  }

  /**
   * Facebook-specific login
   */
  async _loginFacebook(page, selectors, loginId, resource) {
    await page.fill(selectors.emailInput, loginId);
    await this._sleep(500);
    await page.fill(selectors.passwordInput, resource.password);
    await this._sleep(500);
    await page.click(selectors.loginButton);
    await this._sleep(3000);

    // Check for 2FA
    const twoFaInput = await page.$(selectors.twoFaInput);
    if (twoFaInput && resource.twofa) {
      const code = this._generateTOTP(resource.twofa);
      await page.fill(selectors.twoFaInput, code);
      await page.click(selectors.twoFaSubmit);
      await this._sleep(3000);
    }
  }

  /**
   * Google-specific login (multi-step)
   */
  async _loginGoogle(page, selectors, loginId, resource) {
    // Enter email
    await page.fill(selectors.emailInput, loginId);
    await page.click(selectors.emailNext);
    await this._sleep(2000);

    // Enter password
    await page.waitForSelector(selectors.passwordInput, { timeout: 10000 });
    await page.fill(selectors.passwordInput, resource.password);
    await page.click(selectors.passwordNext);
    await this._sleep(3000);
  }

  /**
   * Twitter-specific login (multi-step)
   */
  async _loginTwitter(page, selectors, loginId, resource) {
    await page.waitForSelector(selectors.emailInput, { timeout: 10000 });
    await page.fill(selectors.emailInput, loginId);

    // Click Next
    const nextButtons = await page.$$('[role="button"]');
    for (const btn of nextButtons) {
      const text = await btn.textContent();
      if (text?.includes('Next')) {
        await btn.click();
        break;
      }
    }
    await this._sleep(2000);

    // Enter password
    await page.waitForSelector(selectors.passwordInput, { timeout: 10000 });
    await page.fill(selectors.passwordInput, resource.password);

    // Click Login
    const loginBtn = await page.$(selectors.loginButton);
    if (loginBtn) {
      await loginBtn.click();
    }
    await this._sleep(3000);
  }

  /**
   * Instagram-specific login
   */
  async _loginInstagram(page, selectors, loginId, resource) {
    await page.fill(selectors.emailInput, loginId);
    await this._sleep(500);
    await page.fill(selectors.passwordInput, resource.password);
    await this._sleep(500);
    await page.click(selectors.loginButton);
    await this._sleep(3000);
  }

  /**
   * TikTok-specific login
   */
  async _loginTiktok(page, selectors, loginId, resource) {
    await page.fill(selectors.emailInput, loginId);
    await this._sleep(500);
    await page.fill(selectors.passwordInput, resource.password);
    await this._sleep(500);
    await page.click(selectors.loginButton);
    await this._sleep(3000);
  }

  /**
   * LinkedIn-specific login
   */
  async _loginLinkedin(page, selectors, loginId, resource) {
    await page.fill(selectors.emailInput, loginId);
    await this._sleep(500);
    await page.fill(selectors.passwordInput, resource.password);
    await this._sleep(500);
    await page.click(selectors.loginButton);
    await this._sleep(3000);
  }

  /**
   * Generic login flow
   */
  async _loginGeneric(page, selectors, loginId, resource) {
    if (selectors.emailInput) {
      await page.fill(selectors.emailInput, loginId);
    }
    if (selectors.passwordInput) {
      await page.fill(selectors.passwordInput, resource.password);
    }
    if (selectors.loginButton) {
      await page.click(selectors.loginButton);
    }
    await this._sleep(3000);
  }

  /**
   * Save cookies after successful login
   */
  async _saveCookiesAfterLogin(page, context, profileId, platform) {
    try {
      const cookies = await context.cookies();
      const platformConfig = PLATFORM_LOGIN[platform];

      // Filter cookies for this platform's domain
      const platformCookies = cookies.filter(c =>
        c.domain.includes(platformConfig.cookieDomain.replace(/^\./, ''))
      );

      if (platformCookies.length > 0) {
        await this._saveCookiesToFile(profileId, platform, platformCookies);
        this._log(`[${platform}] Saved ${platformCookies.length} cookies`);
      }
    } catch (e) {
      this._log(`[${platform}] Failed to save cookies: ${e.message}`);
    }
  }

  /**
   * Load cookies from file
   */
  async _loadCookiesFromFile(profileId, platform) {
    const cookiePath = this._getCookiePath(profileId, platform);
    if (!fs.existsSync(cookiePath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(cookiePath, 'utf8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  /**
   * Save cookies to file
   */
  async _saveCookiesToFile(profileId, platform, cookies) {
    const profileDir = path.join(this.options.cookieDir, profileId);
    if (!fs.existsSync(profileDir)) {
      fs.mkdirSync(profileDir, { recursive: true });
    }

    const cookiePath = this._getCookiePath(profileId, platform);
    fs.writeFileSync(cookiePath, JSON.stringify(cookies, null, 2));
  }

  /**
   * Get cookie file path
   */
  _getCookiePath(profileId, platform) {
    return path.join(this.options.cookieDir, profileId, `${platform}.json`);
  }

  /**
   * Check if resource has credentials
   */
  _hasCredentials(resource) {
    return resource.password && (resource.email || resource.phone || resource.username);
  }

  /**
   * Generate TOTP code from secret
   * Simplified implementation - in production, use a proper TOTP library
   */
  _generateTOTP(secret) {
    // This is a placeholder - you should use a proper TOTP library like 'otpauth'
    // For now, return empty (user would need to enter manually)
    console.warn('[WARMUP] TOTP generation not implemented - please use a TOTP library');
    return '';
  }

  /**
   * Sleep helper
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Log helper
   */
  _log(message) {
    if (this.options.verbose) {
      console.log(`[WARMUP-LOGIN] ${message}`);
    }
  }
}

module.exports = WarmupLoginHandler;
