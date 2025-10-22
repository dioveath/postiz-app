export type ProviderCredentialField = {
  envKey: string;
  label: string;
  type: 'text' | 'password';
  required?: boolean;
  description?: string;
};

export const providerCredentialConfig: Record<string, ProviderCredentialField[]> = {
  youtube: [
    { envKey: 'YOUTUBE_CLIENT_ID', label: 'YouTube client ID', type: 'text', required: true },
    { envKey: 'YOUTUBE_CLIENT_SECRET', label: 'YouTube client secret', type: 'password', required: true },
  ],
  facebook: [
    { envKey: 'FACEBOOK_APP_ID', label: 'Facebook app ID', type: 'text', required: true },
    { envKey: 'FACEBOOK_APP_SECRET', label: 'Facebook app secret', type: 'password', required: true },
  ],
  instagram: [
    { envKey: 'FACEBOOK_APP_ID', label: 'Facebook app ID', type: 'text', required: true },
    { envKey: 'FACEBOOK_APP_SECRET', label: 'Facebook app secret', type: 'password', required: true },
  ],
  'instagram-standalone': [
    { envKey: 'INSTAGRAM_APP_ID', label: 'Instagram app ID', type: 'text', required: true },
    { envKey: 'INSTAGRAM_APP_SECRET', label: 'Instagram app secret', type: 'password', required: true },
  ],
  linkedin: [
    { envKey: 'LINKEDIN_CLIENT_ID', label: 'LinkedIn client ID', type: 'text', required: true },
    { envKey: 'LINKEDIN_CLIENT_SECRET', label: 'LinkedIn client secret', type: 'password', required: true },
  ],
  'linkedin-page': [
    { envKey: 'LINKEDIN_CLIENT_ID', label: 'LinkedIn client ID', type: 'text', required: true },
    { envKey: 'LINKEDIN_CLIENT_SECRET', label: 'LinkedIn client secret', type: 'password', required: true },
  ],
  reddit: [
    { envKey: 'REDDIT_CLIENT_ID', label: 'Reddit client ID', type: 'text', required: true },
    { envKey: 'REDDIT_CLIENT_SECRET', label: 'Reddit client secret', type: 'password', required: true },
  ],
  dribbble: [
    { envKey: 'DRIBBBLE_CLIENT_ID', label: 'Dribbble client ID', type: 'text', required: true },
    { envKey: 'DRIBBBLE_CLIENT_SECRET', label: 'Dribbble client secret', type: 'password', required: true },
  ],
  pinterest: [
    { envKey: 'PINTEREST_CLIENT_ID', label: 'Pinterest client ID', type: 'text', required: true },
    { envKey: 'PINTEREST_CLIENT_SECRET', label: 'Pinterest client secret', type: 'password', required: true },
  ],
  tiktok: [
    { envKey: 'TIKTOK_CLIENT_ID', label: 'TikTok client ID', type: 'text', required: true },
    { envKey: 'TIKTOK_CLIENT_SECRET', label: 'TikTok client secret', type: 'password', required: true },
  ],
  slack: [
    { envKey: 'SLACK_ID', label: 'Slack client ID', type: 'text', required: true },
    { envKey: 'SLACK_SECRET', label: 'Slack client secret', type: 'password', required: true },
  ],
  discord: [
    { envKey: 'DISCORD_CLIENT_ID', label: 'Discord client ID', type: 'text', required: true },
    { envKey: 'DISCORD_CLIENT_SECRET', label: 'Discord client secret', type: 'password', required: true },
    { envKey: 'DISCORD_BOT_TOKEN_ID', label: 'Discord bot token', type: 'password', required: true },
  ],
  threads: [
    { envKey: 'THREADS_APP_ID', label: 'Threads app ID', type: 'text', required: true },
    { envKey: 'THREADS_APP_SECRET', label: 'Threads app secret', type: 'password', required: true },
  ],
  x: [
    { envKey: 'X_API_KEY', label: 'X API key', type: 'text', required: true },
    { envKey: 'X_API_SECRET', label: 'X API secret', type: 'password', required: true },
  ],
  farcaster: [
    { envKey: 'NEYNAR_CLIENT_ID', label: 'Neynar client ID', type: 'text', required: true },
    { envKey: 'NEYNAR_SECRET_KEY', label: 'Neynar secret key', type: 'password', required: true },
  ],
  vk: [
    { envKey: 'VK_ID', label: 'VK app ID', type: 'text', required: true },
  ],
};

export const providersWithCredentialSupport = new Set(
  Object.keys(providerCredentialConfig).filter((key) => providerCredentialConfig[key]?.length)
);
