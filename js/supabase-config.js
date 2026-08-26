// PokerSwipe Supabase Configuration
// PUBLIC VALUES ONLY — safe to commit

window.PokerSwipeSupabase = {
  url: 'https://jtdwsnodmprueuwnlycq.supabase.co',
  publishableKey: 'sb_publishable_iLX6QkoecRtZ4X3C8ltRkA_8Rl_gbKk',

  // Derived URLs
  get authUrl() {
    return this.url + '/auth/v1';
  },
  get profilesUrl() {
    return this.url + '/rest/v1/profiles';
  },
  get realtimeUrl() {
    return this.url.replace('https://', 'wss://') + '/realtime/v1';
  }
};
