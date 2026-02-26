/**
 * Pre-built Warm-up Templates
 * Ready-to-use templates for popular social platforms
 */

const { createWarmupTemplate } = require('./schema');

/**
 * Facebook Warm-up Template (21 days)
 * Progressive engagement: Login → Like → Comment → Post → Add friends
 */
const FACEBOOK_TEMPLATE = createWarmupTemplate({
  id: 'template-facebook-21d',
  name: 'Facebook Warm-up 21 days',
  description: 'Warm-up Facebook account in 21 days with progressive engagement',
  platform: 'facebook',
  totalDays: 21,
  isDefault: true,
  phases: [
    {
      name: 'Phase 1 - Getting Started',
      days: [1, 7],
      dailyActions: {
        login: true,
        scrollFeed: { min: 5, max: 10 },      // minutes
        like: { min: 2, max: 5 },
        comment: { min: 0, max: 1 },
        post: { min: 0, max: 0 },
        addFriend: { min: 0, max: 0 },
        joinGroup: { min: 0, max: 0 },
        watchVideo: { min: 1, max: 3 }
      }
    },
    {
      name: 'Phase 2 - Light Engagement',
      days: [8, 14],
      dailyActions: {
        login: true,
        scrollFeed: { min: 10, max: 15 },
        like: { min: 5, max: 10 },
        comment: { min: 1, max: 3 },
        post: { min: 0, max: 1 },
        addFriend: { min: 2, max: 5 },
        joinGroup: { min: 0, max: 1 },
        watchVideo: { min: 2, max: 5 },
        reactStory: { min: 0, max: 2 }
      }
    },
    {
      name: 'Phase 3 - Normal Activity',
      days: [15, 21],
      dailyActions: {
        login: true,
        scrollFeed: { min: 15, max: 20 },
        like: { min: 10, max: 20 },
        comment: { min: 3, max: 5 },
        post: { min: 1, max: 2 },
        addFriend: { min: 3, max: 5 },
        joinGroup: { min: 1, max: 2 },
        sharePost: { min: 0, max: 1 },
        watchVideo: { min: 3, max: 7 },
        reactStory: { min: 1, max: 3 }
      }
    }
  ],
  schedule: {
    timezone: 'Asia/Ho_Chi_Minh',
    runAt: ['09:00', '14:00', '20:00'],
    randomDelay: 30
  }
});

/**
 * TikTok Warm-up Template (14 days)
 * Watch → Like → Comment → Follow → Post
 */
const TIKTOK_TEMPLATE = createWarmupTemplate({
  id: 'template-tiktok-14d',
  name: 'TikTok Warm-up 14 days',
  description: 'Warm-up TikTok account in 14 days with video engagement',
  platform: 'tiktok',
  totalDays: 14,
  isDefault: true,
  phases: [
    {
      name: 'Phase 1 - Watch & Like',
      days: [1, 7],
      dailyActions: {
        login: true,
        scrollFeed: { min: 10, max: 20 },     // minutes of watching
        watchVideo: { min: 20, max: 40 },      // number of videos
        like: { min: 5, max: 15 },
        comment: { min: 0, max: 2 },
        follow: { min: 1, max: 3 },
        post: { min: 0, max: 0 }
      }
    },
    {
      name: 'Phase 2 - Engage & Create',
      days: [8, 14],
      dailyActions: {
        login: true,
        scrollFeed: { min: 15, max: 30 },
        watchVideo: { min: 30, max: 50 },
        like: { min: 15, max: 30 },
        comment: { min: 3, max: 8 },
        follow: { min: 3, max: 10 },
        post: { min: 0, max: 1 },
        shareVideo: { min: 0, max: 2 }
      }
    }
  ],
  schedule: {
    timezone: 'Asia/Ho_Chi_Minh',
    runAt: ['10:00', '15:00', '21:00'],
    randomDelay: 25
  }
});

/**
 * Instagram Warm-up Template (21 days)
 * Browse → Like → Comment → Follow → Post
 */
const INSTAGRAM_TEMPLATE = createWarmupTemplate({
  id: 'template-instagram-21d',
  name: 'Instagram Warm-up 21 days',
  description: 'Warm-up Instagram account in 21 days with photo engagement',
  platform: 'instagram',
  totalDays: 21,
  isDefault: true,
  phases: [
    {
      name: 'Phase 1 - Browse & Discover',
      days: [1, 7],
      dailyActions: {
        login: true,
        scrollFeed: { min: 5, max: 10 },
        like: { min: 3, max: 8 },
        comment: { min: 0, max: 1 },
        follow: { min: 0, max: 2 },
        watchReels: { min: 5, max: 10 },
        watchStory: { min: 3, max: 8 },
        post: { min: 0, max: 0 }
      }
    },
    {
      name: 'Phase 2 - Light Engagement',
      days: [8, 14],
      dailyActions: {
        login: true,
        scrollFeed: { min: 10, max: 15 },
        like: { min: 8, max: 15 },
        comment: { min: 1, max: 3 },
        follow: { min: 2, max: 5 },
        watchReels: { min: 10, max: 20 },
        watchStory: { min: 5, max: 12 },
        post: { min: 0, max: 1 }
      }
    },
    {
      name: 'Phase 3 - Active Engagement',
      days: [15, 21],
      dailyActions: {
        login: true,
        scrollFeed: { min: 15, max: 20 },
        like: { min: 15, max: 25 },
        comment: { min: 3, max: 6 },
        follow: { min: 5, max: 10 },
        watchReels: { min: 15, max: 30 },
        watchStory: { min: 8, max: 15 },
        post: { min: 1, max: 2 },
        sharePost: { min: 0, max: 1 }
      }
    }
  ],
  schedule: {
    timezone: 'Asia/Ho_Chi_Minh',
    runAt: ['08:00', '13:00', '19:00'],
    randomDelay: 30
  }
});

/**
 * Google Warm-up Template (7 days)
 * Search → Browse → Watch YouTube
 */
const GOOGLE_TEMPLATE = createWarmupTemplate({
  id: 'template-google-7d',
  name: 'Google Warm-up 7 days',
  description: 'Warm-up Google account in 7 days with search and YouTube',
  platform: 'google',
  totalDays: 7,
  isDefault: true,
  phases: [
    {
      name: 'Phase 1 - Basic Activity',
      days: [1, 3],
      dailyActions: {
        login: true,
        search: { min: 3, max: 8 },
        browseResults: { min: 5, max: 10 },   // click on search results
        watchYoutube: { min: 5, max: 10 },    // minutes
        checkGmail: { min: 1, max: 2 }
      }
    },
    {
      name: 'Phase 2 - Extended Activity',
      days: [4, 7],
      dailyActions: {
        login: true,
        search: { min: 5, max: 15 },
        browseResults: { min: 8, max: 15 },
        watchYoutube: { min: 10, max: 20 },
        checkGmail: { min: 2, max: 3 },
        useDrive: { min: 0, max: 1 },
        useMaps: { min: 0, max: 2 }
      }
    }
  ],
  schedule: {
    timezone: 'Asia/Ho_Chi_Minh',
    runAt: ['09:00', '15:00'],
    randomDelay: 20
  }
});

/**
 * Twitter/X Warm-up Template (14 days)
 * Browse → Like → Retweet → Tweet
 */
const TWITTER_TEMPLATE = createWarmupTemplate({
  id: 'template-twitter-14d',
  name: 'Twitter/X Warm-up 14 days',
  description: 'Warm-up Twitter/X account in 14 days with engagement',
  platform: 'twitter',
  totalDays: 14,
  isDefault: true,
  phases: [
    {
      name: 'Phase 1 - Read & Like',
      days: [1, 7],
      dailyActions: {
        login: true,
        scrollFeed: { min: 10, max: 15 },
        like: { min: 5, max: 12 },
        retweet: { min: 0, max: 2 },
        tweet: { min: 0, max: 0 },
        follow: { min: 1, max: 3 },
        bookmark: { min: 1, max: 3 }
      }
    },
    {
      name: 'Phase 2 - Engage & Post',
      days: [8, 14],
      dailyActions: {
        login: true,
        scrollFeed: { min: 15, max: 25 },
        like: { min: 10, max: 20 },
        retweet: { min: 2, max: 5 },
        tweet: { min: 1, max: 3 },
        follow: { min: 3, max: 8 },
        reply: { min: 1, max: 4 },
        bookmark: { min: 2, max: 5 }
      }
    }
  ],
  schedule: {
    timezone: 'Asia/Ho_Chi_Minh',
    runAt: ['08:00', '12:00', '18:00', '22:00'],
    randomDelay: 20
  }
});

/**
 * YouTube Warm-up Template (14 days)
 * Watch → Like → Subscribe → Comment
 */
const YOUTUBE_TEMPLATE = createWarmupTemplate({
  id: 'template-youtube-14d',
  name: 'YouTube Warm-up 14 days',
  description: 'Warm-up YouTube account in 14 days with video watching',
  platform: 'youtube',
  totalDays: 14,
  isDefault: true,
  phases: [
    {
      name: 'Phase 1 - Watch & Browse',
      days: [1, 7],
      dailyActions: {
        login: true,
        watchVideo: { min: 10, max: 20 },     // minutes
        like: { min: 2, max: 5 },
        subscribe: { min: 0, max: 2 },
        comment: { min: 0, max: 1 },
        searchVideo: { min: 2, max: 5 }
      }
    },
    {
      name: 'Phase 2 - Engage Actively',
      days: [8, 14],
      dailyActions: {
        login: true,
        watchVideo: { min: 20, max: 40 },
        like: { min: 5, max: 10 },
        subscribe: { min: 2, max: 5 },
        comment: { min: 1, max: 3 },
        searchVideo: { min: 3, max: 8 },
        addPlaylist: { min: 0, max: 2 }
      }
    }
  ],
  schedule: {
    timezone: 'Asia/Ho_Chi_Minh',
    runAt: ['10:00', '16:00', '21:00'],
    randomDelay: 25
  }
});

/**
 * LinkedIn Warm-up Template (14 days)
 * Browse → Like → Connect → Post
 */
const LINKEDIN_TEMPLATE = createWarmupTemplate({
  id: 'template-linkedin-14d',
  name: 'LinkedIn Warm-up 14 days',
  description: 'Warm-up LinkedIn account in 14 days professionally',
  platform: 'linkedin',
  totalDays: 14,
  isDefault: true,
  phases: [
    {
      name: 'Phase 1 - Browse & Network',
      days: [1, 7],
      dailyActions: {
        login: true,
        scrollFeed: { min: 5, max: 10 },
        like: { min: 3, max: 8 },
        comment: { min: 0, max: 1 },
        connect: { min: 2, max: 5 },
        viewProfile: { min: 3, max: 8 },
        post: { min: 0, max: 0 }
      }
    },
    {
      name: 'Phase 2 - Engage & Share',
      days: [8, 14],
      dailyActions: {
        login: true,
        scrollFeed: { min: 10, max: 15 },
        like: { min: 8, max: 15 },
        comment: { min: 1, max: 3 },
        connect: { min: 5, max: 10 },
        viewProfile: { min: 5, max: 12 },
        post: { min: 0, max: 1 },
        sendMessage: { min: 0, max: 2 }
      }
    }
  ],
  schedule: {
    timezone: 'Asia/Ho_Chi_Minh',
    runAt: ['08:00', '12:00', '17:00'],
    randomDelay: 15
  }
});

/**
 * Telegram Warm-up Template (7 days)
 * Read → Chat → Join Groups
 */
const TELEGRAM_TEMPLATE = createWarmupTemplate({
  id: 'template-telegram-7d',
  name: 'Telegram Warm-up 7 days',
  description: 'Warm-up Telegram account in 7 days with messaging',
  platform: 'telegram',
  totalDays: 7,
  isDefault: true,
  phases: [
    {
      name: 'Phase 1 - Basic Activity',
      days: [1, 3],
      dailyActions: {
        login: true,
        readMessages: { min: 5, max: 10 },    // minutes
        sendMessage: { min: 1, max: 3 },
        joinChannel: { min: 1, max: 2 },
        joinGroup: { min: 0, max: 1 },
        reactMessage: { min: 2, max: 5 }
      }
    },
    {
      name: 'Phase 2 - Active Messaging',
      days: [4, 7],
      dailyActions: {
        login: true,
        readMessages: { min: 10, max: 20 },
        sendMessage: { min: 3, max: 8 },
        joinChannel: { min: 1, max: 3 },
        joinGroup: { min: 1, max: 2 },
        reactMessage: { min: 5, max: 10 }
      }
    }
  ],
  schedule: {
    timezone: 'Asia/Ho_Chi_Minh',
    runAt: ['09:00', '13:00', '19:00'],
    randomDelay: 20
  }
});

// All default templates
const DEFAULT_TEMPLATES = [
  FACEBOOK_TEMPLATE,
  TIKTOK_TEMPLATE,
  INSTAGRAM_TEMPLATE,
  GOOGLE_TEMPLATE,
  TWITTER_TEMPLATE,
  YOUTUBE_TEMPLATE,
  LINKEDIN_TEMPLATE,
  TELEGRAM_TEMPLATE
];

/**
 * Get template by platform
 */
function getTemplateByPlatform(platform) {
  return DEFAULT_TEMPLATES.find(t => t.platform === platform) || null;
}

/**
 * Get template by ID
 */
function getTemplateById(id) {
  return DEFAULT_TEMPLATES.find(t => t.id === id) || null;
}

/**
 * Get all default templates
 */
function getAllTemplates() {
  return [...DEFAULT_TEMPLATES];
}

module.exports = {
  FACEBOOK_TEMPLATE,
  TIKTOK_TEMPLATE,
  INSTAGRAM_TEMPLATE,
  GOOGLE_TEMPLATE,
  TWITTER_TEMPLATE,
  YOUTUBE_TEMPLATE,
  LINKEDIN_TEMPLATE,
  TELEGRAM_TEMPLATE,
  DEFAULT_TEMPLATES,
  getTemplateByPlatform,
  getTemplateById,
  getAllTemplates
};
