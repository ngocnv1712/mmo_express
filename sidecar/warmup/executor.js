/**
 * Warm-up Executor
 * Executes daily warm-up actions for profiles
 * Uses hybrid login: cookies first, then credentials
 */

const { getCurrentPhase, getRandomActionCount, createDailyLog } = require('./schema');
const WarmupLoginHandler = require('./login');

/**
 * Platform-specific action handlers
 * Each platform has its own URL and selectors
 */
const PLATFORM_CONFIG = {
  facebook: {
    url: 'https://www.facebook.com',
    loginUrl: 'https://www.facebook.com/login',
    selectors: {
      feed: '[role="feed"]',
      postBox: '[aria-label*="What\'s on your mind"]',
      likeButton: '[aria-label*="Like"]',
      commentInput: '[contenteditable="true"][role="textbox"]',
      friendRequest: '[aria-label*="Add friend"]',
      searchInput: 'input[type="search"]'
    }
  },
  tiktok: {
    url: 'https://www.tiktok.com',
    loginUrl: 'https://www.tiktok.com/login',
    selectors: {
      feed: '[class*="video-feed"]',
      likeButton: '[class*="like-button"]',
      commentInput: '[class*="comment-input"]',
      followButton: '[class*="follow-button"]',
      video: 'video'
    }
  },
  instagram: {
    url: 'https://www.instagram.com',
    loginUrl: 'https://www.instagram.com/accounts/login',
    selectors: {
      feed: 'article',
      likeButton: 'svg[aria-label*="Like"]',
      commentInput: 'textarea[aria-label*="comment"]',
      followButton: 'button:has-text("Follow")',
      reelsTab: 'a[href*="/reels"]'
    }
  },
  google: {
    url: 'https://www.google.com',
    loginUrl: 'https://accounts.google.com/signin',
    selectors: {
      searchInput: 'input[name="q"]',
      searchResults: '#search',
      youtubePlayer: 'video.html5-main-video',
      gmailInbox: 'div[role="main"]'
    }
  },
  twitter: {
    url: 'https://twitter.com',
    loginUrl: 'https://twitter.com/i/flow/login',
    selectors: {
      feed: '[data-testid="primaryColumn"]',
      likeButton: '[data-testid="like"]',
      retweetButton: '[data-testid="retweet"]',
      tweetButton: '[data-testid="tweetButton"]',
      tweetInput: '[data-testid="tweetTextarea_0"]'
    }
  },
  youtube: {
    url: 'https://www.youtube.com',
    loginUrl: 'https://accounts.google.com/signin',
    selectors: {
      searchInput: 'input#search',
      videoPlayer: 'video.html5-main-video',
      likeButton: 'button.ytp-watch-later-button',
      subscribeButton: '#subscribe-button button',
      commentInput: '#simplebox-placeholder'
    }
  },
  linkedin: {
    url: 'https://www.linkedin.com',
    loginUrl: 'https://www.linkedin.com/login',
    selectors: {
      feed: '.feed-shared-update-v2',
      likeButton: 'button[aria-label*="Like"]',
      commentInput: '.comments-comment-box__form textarea',
      connectButton: 'button:has-text("Connect")',
      searchInput: 'input.search-global-typeahead__input'
    }
  },
  telegram: {
    url: 'https://web.telegram.org',
    loginUrl: 'https://web.telegram.org/k/',
    selectors: {
      chatList: '.chat-list',
      messageInput: '.input-message-input',
      sendButton: '.btn-send',
      channelLink: 'a[href*="t.me"]'
    }
  }
};

/**
 * WarmupExecutor class
 */
class WarmupExecutor {
  constructor(options = {}) {
    this.options = {
      verbose: options.verbose || false,
      screenshotOnError: options.screenshotOnError || false,
      maxActionTime: options.maxActionTime || 300000, // 5 minutes per action
      ...options
    };

    // Initialize login handler
    this.loginHandler = new WarmupLoginHandler({
      verbose: options.verbose
    });
  }

  /**
   * Execute daily warm-up for a profile
   * @param {Object} params - Execution parameters
   * @param {Object} params.page - Playwright page
   * @param {Object} params.context - Browser context
   * @param {Object} params.template - Warm-up template
   * @param {Object} params.progress - Progress record
   * @param {Object} params.resource - Profile resource with credentials/cookies
   * @param {Function} params.onProgress - Progress callback
   */
  async executeDailyWarmup({ page, context, template, progress, resource, onProgress }) {
    const currentDay = progress.currentDay;
    const phase = getCurrentPhase(template.phases, currentDay);

    if (!phase) {
      throw new Error(`No phase found for day ${currentDay}`);
    }

    const platform = template.platform;
    const config = PLATFORM_CONFIG[platform];

    if (!config) {
      throw new Error(`Unsupported platform: ${platform}`);
    }

    const results = {
      day: currentDay,
      phase: phase.index,
      phaseName: phase.name,
      actions: {},
      errors: [],
      loginMethod: null,
      startedAt: new Date().toISOString(),
      finishedAt: null
    };

    try {
      // Login action using hybrid approach
      if (phase.dailyActions.login) {
        onProgress?.({ action: 'login', status: 'starting' });

        const loginResult = await this.loginHandler.login({
          page,
          context,
          platform,
          profileId: progress.profileId,
          resource
        });

        if (!loginResult.success) {
          throw new Error(`Login failed: ${loginResult.message}`);
        }

        results.actions.login = 1;
        results.loginMethod = loginResult.method;
        onProgress?.({ action: 'login', status: 'completed', method: loginResult.method });

        console.log(`[WARMUP] Logged in via ${loginResult.method}`);
      }

      // Execute each action type
      for (const [actionType, range] of Object.entries(phase.dailyActions)) {
        if (actionType === 'login') continue;

        const count = getRandomActionCount(range);
        if (count === 0) continue;

        try {
          await this._executeAction(page, platform, actionType, count, onProgress);
          results.actions[actionType] = count;
        } catch (error) {
          results.errors.push({ action: actionType, error: error.message });
          console.error(`[WARMUP] Error executing ${actionType}:`, error.message);
        }
      }

      results.finishedAt = new Date().toISOString();
      return createDailyLog(currentDay, results.actions, 'completed');

    } catch (error) {
      results.finishedAt = new Date().toISOString();
      results.errors.push({ action: 'general', error: error.message });

      if (this.options.screenshotOnError) {
        try {
          await page.screenshot({ path: `warmup-error-${Date.now()}.png` });
        } catch (e) {}
      }

      const log = createDailyLog(currentDay, results.actions, 'failed');
      log.error = error.message;
      return log;
    }
  }

  /**
   * Execute specific action type
   */
  async _executeAction(page, platform, actionType, count, onProgress) {
    console.log(`[WARMUP] Executing ${actionType} x${count} on ${platform}`);

    const handler = this._getActionHandler(actionType, platform);
    if (!handler) {
      console.warn(`[WARMUP] No handler for action: ${actionType}`);
      return;
    }

    for (let i = 0; i < count; i++) {
      onProgress?.({ action: actionType, current: i + 1, total: count });
      await handler(page, i);
      await this._randomWait(1500, 4000);
    }
  }

  /**
   * Get action handler for platform
   */
  _getActionHandler(actionType, platform) {
    const handlers = {
      // Common actions
      scrollFeed: async (page, iteration) => {
        const scrollAmount = Math.floor(Math.random() * 500) + 300;
        await page.evaluate((amount) => {
          window.scrollBy({ top: amount, behavior: 'smooth' });
        }, scrollAmount);
        await this._randomWait(2000, 5000);
      },

      like: async (page, iteration) => {
        const config = PLATFORM_CONFIG[platform];
        const likeSelector = config.selectors.likeButton;
        try {
          const likeButtons = await page.$$(likeSelector);
          if (likeButtons.length > iteration) {
            await likeButtons[iteration].click();
          }
        } catch (e) {
          console.log(`[WARMUP] Like action failed: ${e.message}`);
        }
      },

      comment: async (page, iteration) => {
        // Comments require more complex handling with text input
        // For safety, we'll just open the comment box without posting
        const config = PLATFORM_CONFIG[platform];
        try {
          const commentInput = await page.$(config.selectors.commentInput);
          if (commentInput) {
            await commentInput.click();
            await this._randomWait(500, 1000);
          }
        } catch (e) {
          console.log(`[WARMUP] Comment action failed: ${e.message}`);
        }
      },

      follow: async (page, iteration) => {
        const config = PLATFORM_CONFIG[platform];
        const followSelector = config.selectors.followButton;
        try {
          const followButtons = await page.$$(followSelector);
          if (followButtons.length > iteration) {
            await followButtons[iteration].click();
          }
        } catch (e) {
          console.log(`[WARMUP] Follow action failed: ${e.message}`);
        }
      },

      watchVideo: async (page, iteration) => {
        // Scroll to find a video and watch for a bit
        await page.evaluate(() => {
          const video = document.querySelector('video');
          if (video) {
            video.play();
          }
        });
        // Watch for 30-60 seconds
        await this._randomWait(30000, 60000);
      },

      watchReels: async (page, iteration) => {
        await this._randomWait(15000, 30000);
      },

      watchStory: async (page, iteration) => {
        await this._randomWait(5000, 10000);
      },

      search: async (page, iteration) => {
        const config = PLATFORM_CONFIG[platform];
        const searchInput = await page.$(config.selectors.searchInput);
        if (searchInput) {
          const searchTerms = ['news', 'technology', 'sports', 'music', 'food', 'travel'];
          const term = searchTerms[Math.floor(Math.random() * searchTerms.length)];
          await searchInput.click();
          await searchInput.fill(term);
          await page.keyboard.press('Enter');
          await this._randomWait(2000, 4000);
        }
      },

      browseResults: async (page, iteration) => {
        // Click on random search result
        await this._randomWait(2000, 5000);
      },

      addFriend: async (page, iteration) => {
        // Find and click add friend button
        const config = PLATFORM_CONFIG[platform];
        try {
          const buttons = await page.$$(config.selectors.friendRequest || 'button:has-text("Add")');
          if (buttons.length > 0) {
            const idx = Math.floor(Math.random() * Math.min(buttons.length, 3));
            await buttons[idx].click();
          }
        } catch (e) {
          console.log(`[WARMUP] Add friend failed: ${e.message}`);
        }
      },

      connect: async (page, iteration) => {
        // LinkedIn connect
        const config = PLATFORM_CONFIG[platform];
        try {
          const buttons = await page.$$(config.selectors.connectButton);
          if (buttons.length > iteration) {
            await buttons[iteration].click();
          }
        } catch (e) {
          console.log(`[WARMUP] Connect failed: ${e.message}`);
        }
      },

      retweet: async (page, iteration) => {
        const config = PLATFORM_CONFIG[platform];
        try {
          const buttons = await page.$$(config.selectors.retweetButton);
          if (buttons.length > iteration) {
            await buttons[iteration].click();
            await this._randomWait(500, 1000);
            // Confirm retweet
            const confirmBtn = await page.$('[data-testid="retweetConfirm"]');
            if (confirmBtn) await confirmBtn.click();
          }
        } catch (e) {
          console.log(`[WARMUP] Retweet failed: ${e.message}`);
        }
      },

      subscribe: async (page, iteration) => {
        // YouTube subscribe
        const config = PLATFORM_CONFIG[platform];
        try {
          const subscribeBtn = await page.$(config.selectors.subscribeButton);
          if (subscribeBtn) {
            await subscribeBtn.click();
          }
        } catch (e) {
          console.log(`[WARMUP] Subscribe failed: ${e.message}`);
        }
      },

      viewProfile: async (page, iteration) => {
        // Click on a profile link
        try {
          const profileLinks = await page.$$('a[href*="/in/"], a[href*="/profile"]');
          if (profileLinks.length > iteration) {
            await profileLinks[iteration].click();
            await this._randomWait(2000, 4000);
            await page.goBack();
          }
        } catch (e) {
          console.log(`[WARMUP] View profile failed: ${e.message}`);
        }
      },

      readMessages: async (page, iteration) => {
        await this._randomWait(10000, 20000);
      },

      sendMessage: async (page, iteration) => {
        // Would require actual message content
        console.log('[WARMUP] sendMessage - skipped (requires content)');
      },

      joinChannel: async (page, iteration) => {
        console.log('[WARMUP] joinChannel - skipped (requires URL)');
      },

      joinGroup: async (page, iteration) => {
        console.log('[WARMUP] joinGroup - skipped (requires URL)');
      },

      reactMessage: async (page, iteration) => {
        await this._randomWait(500, 1500);
      },

      reactStory: async (page, iteration) => {
        await this._randomWait(500, 1500);
      },

      bookmark: async (page, iteration) => {
        try {
          const bookmarkBtn = await page.$('[data-testid="bookmark"]');
          if (bookmarkBtn) {
            await bookmarkBtn.click();
          }
        } catch (e) {}
      },

      checkGmail: async (page, iteration) => {
        await page.goto('https://mail.google.com', { waitUntil: 'domcontentloaded' });
        await this._randomWait(5000, 10000);
      },

      useDrive: async (page, iteration) => {
        await page.goto('https://drive.google.com', { waitUntil: 'domcontentloaded' });
        await this._randomWait(5000, 10000);
      },

      useMaps: async (page, iteration) => {
        await page.goto('https://maps.google.com', { waitUntil: 'domcontentloaded' });
        await this._randomWait(5000, 10000);
      },

      watchYoutube: async (page, iteration) => {
        await page.goto('https://www.youtube.com', { waitUntil: 'domcontentloaded' });
        const videos = await page.$$('a#video-title');
        if (videos.length > 0) {
          const idx = Math.floor(Math.random() * Math.min(videos.length, 5));
          await videos[idx].click();
          await this._randomWait(60000, 120000); // Watch 1-2 minutes
        }
      },

      searchVideo: async (page, iteration) => {
        const searchTerms = ['music', 'news', 'how to', 'tutorial', 'funny'];
        const term = searchTerms[Math.floor(Math.random() * searchTerms.length)];
        const searchInput = await page.$('input#search');
        if (searchInput) {
          await searchInput.fill(term);
          await page.keyboard.press('Enter');
          await this._randomWait(2000, 4000);
        }
      },

      addPlaylist: async (page, iteration) => {
        console.log('[WARMUP] addPlaylist - skipped');
      },

      post: async (page, iteration) => {
        console.log('[WARMUP] post - skipped (requires content)');
      },

      tweet: async (page, iteration) => {
        console.log('[WARMUP] tweet - skipped (requires content)');
      },

      reply: async (page, iteration) => {
        console.log('[WARMUP] reply - skipped (requires content)');
      },

      sharePost: async (page, iteration) => {
        console.log('[WARMUP] sharePost - skipped');
      },

      shareVideo: async (page, iteration) => {
        console.log('[WARMUP] shareVideo - skipped');
      },

      duet: async (page, iteration) => {
        console.log('[WARMUP] duet - skipped');
      },

      sendDM: async (page, iteration) => {
        console.log('[WARMUP] sendDM - skipped (requires recipient)');
      }
    };

    return handlers[actionType] || null;
  }

  /**
   * Random wait between actions
   */
  async _randomWait(min, max) {
    const wait = Math.floor(Math.random() * (max - min)) + min;
    return new Promise(resolve => setTimeout(resolve, wait));
  }
}

module.exports = WarmupExecutor;
