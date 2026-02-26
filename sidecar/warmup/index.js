/**
 * Warm-up Module
 * Account warm-up system for gradual activity increase
 */

const {
  PLATFORMS,
  PLATFORM_ACTIONS,
  createWarmupTemplate,
  createWarmupProgress,
  createDailyLog,
  getCurrentPhase,
  getRandomActionCount,
  calculateNextRun,
  canTransitionTo
} = require('./schema');

const {
  DEFAULT_TEMPLATES,
  getTemplateByPlatform,
  getTemplateById,
  getAllTemplates,
  FACEBOOK_TEMPLATE,
  TIKTOK_TEMPLATE,
  INSTAGRAM_TEMPLATE,
  GOOGLE_TEMPLATE,
  TWITTER_TEMPLATE,
  YOUTUBE_TEMPLATE,
  LINKEDIN_TEMPLATE,
  TELEGRAM_TEMPLATE
} = require('./templates');

const WarmupExecutor = require('./executor');
const WarmupScheduler = require('./scheduler');
const WarmupLoginHandler = require('./login');

module.exports = {
  // Schema
  PLATFORMS,
  PLATFORM_ACTIONS,
  createWarmupTemplate,
  createWarmupProgress,
  createDailyLog,
  getCurrentPhase,
  getRandomActionCount,
  calculateNextRun,
  canTransitionTo,

  // Templates
  DEFAULT_TEMPLATES,
  getTemplateByPlatform,
  getTemplateById,
  getAllTemplates,
  FACEBOOK_TEMPLATE,
  TIKTOK_TEMPLATE,
  INSTAGRAM_TEMPLATE,
  GOOGLE_TEMPLATE,
  TWITTER_TEMPLATE,
  YOUTUBE_TEMPLATE,
  LINKEDIN_TEMPLATE,
  TELEGRAM_TEMPLATE,

  // Classes
  WarmupExecutor,
  WarmupScheduler,
  WarmupLoginHandler
};
