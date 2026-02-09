/**
 * Country Locale and Timezone Mappings
 * Maps ISO country codes to locale settings
 */

const COUNTRY_LOCALES = {
  // North America
  US: {
    country: 'United States',
    locale: 'en-US',
    language: 'en-US,en',
    timezones: ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles'],
    defaultTimezone: 'America/New_York',
  },
  CA: {
    country: 'Canada',
    locale: 'en-CA',
    language: 'en-CA,en,fr-CA,fr',
    timezones: ['America/Toronto', 'America/Vancouver', 'America/Edmonton'],
    defaultTimezone: 'America/Toronto',
  },
  MX: {
    country: 'Mexico',
    locale: 'es-MX',
    language: 'es-MX,es,en',
    timezones: ['America/Mexico_City', 'America/Tijuana'],
    defaultTimezone: 'America/Mexico_City',
  },

  // Europe
  GB: {
    country: 'United Kingdom',
    locale: 'en-GB',
    language: 'en-GB,en',
    timezones: ['Europe/London'],
    defaultTimezone: 'Europe/London',
  },
  DE: {
    country: 'Germany',
    locale: 'de-DE',
    language: 'de-DE,de,en',
    timezones: ['Europe/Berlin'],
    defaultTimezone: 'Europe/Berlin',
  },
  FR: {
    country: 'France',
    locale: 'fr-FR',
    language: 'fr-FR,fr,en',
    timezones: ['Europe/Paris'],
    defaultTimezone: 'Europe/Paris',
  },
  IT: {
    country: 'Italy',
    locale: 'it-IT',
    language: 'it-IT,it,en',
    timezones: ['Europe/Rome'],
    defaultTimezone: 'Europe/Rome',
  },
  ES: {
    country: 'Spain',
    locale: 'es-ES',
    language: 'es-ES,es,en',
    timezones: ['Europe/Madrid'],
    defaultTimezone: 'Europe/Madrid',
  },
  PT: {
    country: 'Portugal',
    locale: 'pt-PT',
    language: 'pt-PT,pt,en',
    timezones: ['Europe/Lisbon'],
    defaultTimezone: 'Europe/Lisbon',
  },
  NL: {
    country: 'Netherlands',
    locale: 'nl-NL',
    language: 'nl-NL,nl,en',
    timezones: ['Europe/Amsterdam'],
    defaultTimezone: 'Europe/Amsterdam',
  },
  BE: {
    country: 'Belgium',
    locale: 'nl-BE',
    language: 'nl-BE,nl,fr-BE,fr,en',
    timezones: ['Europe/Brussels'],
    defaultTimezone: 'Europe/Brussels',
  },
  CH: {
    country: 'Switzerland',
    locale: 'de-CH',
    language: 'de-CH,de,fr-CH,fr,it-CH,it,en',
    timezones: ['Europe/Zurich'],
    defaultTimezone: 'Europe/Zurich',
  },
  AT: {
    country: 'Austria',
    locale: 'de-AT',
    language: 'de-AT,de,en',
    timezones: ['Europe/Vienna'],
    defaultTimezone: 'Europe/Vienna',
  },
  PL: {
    country: 'Poland',
    locale: 'pl-PL',
    language: 'pl-PL,pl,en',
    timezones: ['Europe/Warsaw'],
    defaultTimezone: 'Europe/Warsaw',
  },
  SE: {
    country: 'Sweden',
    locale: 'sv-SE',
    language: 'sv-SE,sv,en',
    timezones: ['Europe/Stockholm'],
    defaultTimezone: 'Europe/Stockholm',
  },
  NO: {
    country: 'Norway',
    locale: 'nb-NO',
    language: 'nb-NO,no,en',
    timezones: ['Europe/Oslo'],
    defaultTimezone: 'Europe/Oslo',
  },
  DK: {
    country: 'Denmark',
    locale: 'da-DK',
    language: 'da-DK,da,en',
    timezones: ['Europe/Copenhagen'],
    defaultTimezone: 'Europe/Copenhagen',
  },
  FI: {
    country: 'Finland',
    locale: 'fi-FI',
    language: 'fi-FI,fi,sv,en',
    timezones: ['Europe/Helsinki'],
    defaultTimezone: 'Europe/Helsinki',
  },
  IE: {
    country: 'Ireland',
    locale: 'en-IE',
    language: 'en-IE,en,ga',
    timezones: ['Europe/Dublin'],
    defaultTimezone: 'Europe/Dublin',
  },
  CZ: {
    country: 'Czech Republic',
    locale: 'cs-CZ',
    language: 'cs-CZ,cs,en',
    timezones: ['Europe/Prague'],
    defaultTimezone: 'Europe/Prague',
  },
  RO: {
    country: 'Romania',
    locale: 'ro-RO',
    language: 'ro-RO,ro,en',
    timezones: ['Europe/Bucharest'],
    defaultTimezone: 'Europe/Bucharest',
  },
  HU: {
    country: 'Hungary',
    locale: 'hu-HU',
    language: 'hu-HU,hu,en',
    timezones: ['Europe/Budapest'],
    defaultTimezone: 'Europe/Budapest',
  },
  GR: {
    country: 'Greece',
    locale: 'el-GR',
    language: 'el-GR,el,en',
    timezones: ['Europe/Athens'],
    defaultTimezone: 'Europe/Athens',
  },
  UA: {
    country: 'Ukraine',
    locale: 'uk-UA',
    language: 'uk-UA,uk,ru,en',
    timezones: ['Europe/Kyiv'],
    defaultTimezone: 'Europe/Kyiv',
  },
  RU: {
    country: 'Russia',
    locale: 'ru-RU',
    language: 'ru-RU,ru,en',
    timezones: ['Europe/Moscow', 'Asia/Vladivostok'],
    defaultTimezone: 'Europe/Moscow',
  },
  TR: {
    country: 'Turkey',
    locale: 'tr-TR',
    language: 'tr-TR,tr,en',
    timezones: ['Europe/Istanbul'],
    defaultTimezone: 'Europe/Istanbul',
  },

  // Asia
  JP: {
    country: 'Japan',
    locale: 'ja-JP',
    language: 'ja-JP,ja,en',
    timezones: ['Asia/Tokyo'],
    defaultTimezone: 'Asia/Tokyo',
  },
  KR: {
    country: 'South Korea',
    locale: 'ko-KR',
    language: 'ko-KR,ko,en',
    timezones: ['Asia/Seoul'],
    defaultTimezone: 'Asia/Seoul',
  },
  CN: {
    country: 'China',
    locale: 'zh-CN',
    language: 'zh-CN,zh,en',
    timezones: ['Asia/Shanghai'],
    defaultTimezone: 'Asia/Shanghai',
  },
  TW: {
    country: 'Taiwan',
    locale: 'zh-TW',
    language: 'zh-TW,zh,en',
    timezones: ['Asia/Taipei'],
    defaultTimezone: 'Asia/Taipei',
  },
  HK: {
    country: 'Hong Kong',
    locale: 'zh-HK',
    language: 'zh-HK,zh,en',
    timezones: ['Asia/Hong_Kong'],
    defaultTimezone: 'Asia/Hong_Kong',
  },
  SG: {
    country: 'Singapore',
    locale: 'en-SG',
    language: 'en-SG,en,zh,ms,ta',
    timezones: ['Asia/Singapore'],
    defaultTimezone: 'Asia/Singapore',
  },
  MY: {
    country: 'Malaysia',
    locale: 'ms-MY',
    language: 'ms-MY,ms,en,zh',
    timezones: ['Asia/Kuala_Lumpur'],
    defaultTimezone: 'Asia/Kuala_Lumpur',
  },
  TH: {
    country: 'Thailand',
    locale: 'th-TH',
    language: 'th-TH,th,en',
    timezones: ['Asia/Bangkok'],
    defaultTimezone: 'Asia/Bangkok',
  },
  VN: {
    country: 'Vietnam',
    locale: 'vi-VN',
    language: 'vi-VN,vi,en',
    timezones: ['Asia/Ho_Chi_Minh'],
    defaultTimezone: 'Asia/Ho_Chi_Minh',
  },
  ID: {
    country: 'Indonesia',
    locale: 'id-ID',
    language: 'id-ID,id,en',
    timezones: ['Asia/Jakarta'],
    defaultTimezone: 'Asia/Jakarta',
  },
  PH: {
    country: 'Philippines',
    locale: 'en-PH',
    language: 'en-PH,en,tl',
    timezones: ['Asia/Manila'],
    defaultTimezone: 'Asia/Manila',
  },
  IN: {
    country: 'India',
    locale: 'en-IN',
    language: 'en-IN,en,hi',
    timezones: ['Asia/Kolkata'],
    defaultTimezone: 'Asia/Kolkata',
  },
  PK: {
    country: 'Pakistan',
    locale: 'ur-PK',
    language: 'ur-PK,ur,en',
    timezones: ['Asia/Karachi'],
    defaultTimezone: 'Asia/Karachi',
  },
  BD: {
    country: 'Bangladesh',
    locale: 'bn-BD',
    language: 'bn-BD,bn,en',
    timezones: ['Asia/Dhaka'],
    defaultTimezone: 'Asia/Dhaka',
  },
  AE: {
    country: 'United Arab Emirates',
    locale: 'ar-AE',
    language: 'ar-AE,ar,en',
    timezones: ['Asia/Dubai'],
    defaultTimezone: 'Asia/Dubai',
  },
  SA: {
    country: 'Saudi Arabia',
    locale: 'ar-SA',
    language: 'ar-SA,ar,en',
    timezones: ['Asia/Riyadh'],
    defaultTimezone: 'Asia/Riyadh',
  },
  IL: {
    country: 'Israel',
    locale: 'he-IL',
    language: 'he-IL,he,en,ar',
    timezones: ['Asia/Jerusalem'],
    defaultTimezone: 'Asia/Jerusalem',
  },

  // Oceania
  AU: {
    country: 'Australia',
    locale: 'en-AU',
    language: 'en-AU,en',
    timezones: ['Australia/Sydney', 'Australia/Melbourne', 'Australia/Perth'],
    defaultTimezone: 'Australia/Sydney',
  },
  NZ: {
    country: 'New Zealand',
    locale: 'en-NZ',
    language: 'en-NZ,en,mi',
    timezones: ['Pacific/Auckland'],
    defaultTimezone: 'Pacific/Auckland',
  },

  // South America
  BR: {
    country: 'Brazil',
    locale: 'pt-BR',
    language: 'pt-BR,pt,en',
    timezones: ['America/Sao_Paulo'],
    defaultTimezone: 'America/Sao_Paulo',
  },
  AR: {
    country: 'Argentina',
    locale: 'es-AR',
    language: 'es-AR,es,en',
    timezones: ['America/Argentina/Buenos_Aires'],
    defaultTimezone: 'America/Argentina/Buenos_Aires',
  },
  CL: {
    country: 'Chile',
    locale: 'es-CL',
    language: 'es-CL,es,en',
    timezones: ['America/Santiago'],
    defaultTimezone: 'America/Santiago',
  },
  CO: {
    country: 'Colombia',
    locale: 'es-CO',
    language: 'es-CO,es,en',
    timezones: ['America/Bogota'],
    defaultTimezone: 'America/Bogota',
  },
  PE: {
    country: 'Peru',
    locale: 'es-PE',
    language: 'es-PE,es,en',
    timezones: ['America/Lima'],
    defaultTimezone: 'America/Lima',
  },

  // Africa
  ZA: {
    country: 'South Africa',
    locale: 'en-ZA',
    language: 'en-ZA,en,af,zu',
    timezones: ['Africa/Johannesburg'],
    defaultTimezone: 'Africa/Johannesburg',
  },
  EG: {
    country: 'Egypt',
    locale: 'ar-EG',
    language: 'ar-EG,ar,en',
    timezones: ['Africa/Cairo'],
    defaultTimezone: 'Africa/Cairo',
  },
  NG: {
    country: 'Nigeria',
    locale: 'en-NG',
    language: 'en-NG,en',
    timezones: ['Africa/Lagos'],
    defaultTimezone: 'Africa/Lagos',
  },
  KE: {
    country: 'Kenya',
    locale: 'en-KE',
    language: 'en-KE,en,sw',
    timezones: ['Africa/Nairobi'],
    defaultTimezone: 'Africa/Nairobi',
  },
  MA: {
    country: 'Morocco',
    locale: 'ar-MA',
    language: 'ar-MA,ar,fr,en',
    timezones: ['Africa/Casablanca'],
    defaultTimezone: 'Africa/Casablanca',
  },
};

/**
 * Get locale info for country code
 * @param {string} countryCode - ISO country code
 * @returns {Object} Locale info
 */
function getCountryLocale(countryCode) {
  return COUNTRY_LOCALES[countryCode.toUpperCase()] || COUNTRY_LOCALES['US'];
}

/**
 * Get all country codes
 * @returns {Array} Country codes
 */
function getCountryCodes() {
  return Object.keys(COUNTRY_LOCALES);
}

/**
 * Get countries list for UI
 * @returns {Array} Countries with details
 */
function getCountriesList() {
  return Object.entries(COUNTRY_LOCALES).map(([code, data]) => ({
    code,
    name: data.country,
    locale: data.locale,
    timezone: data.defaultTimezone,
  }));
}

module.exports = {
  COUNTRY_LOCALES,
  getCountryLocale,
  getCountryCodes,
  getCountriesList,
};
