import { describe, expect, it } from 'vitest';

import { deduceFeedUrl, discoverFeedUrl } from './feed-discovery';

describe('deduceFeedUrl', () => {
  it('handles Reddit', () => {
    expect(deduceFeedUrl('https://www.reddit.com/r/angular/')).toBe('https://www.reddit.com/r/angular/.rss');
  });

  it('handles YouTube channels and playlists', () => {
    expect(deduceFeedUrl('https://www.youtube.com/channel/UC123')).toBe('https://www.youtube.com/feeds/videos.xml?channel_id=UC123');
    expect(deduceFeedUrl('https://www.youtube.com/playlist?list=PL1')).toBe('https://www.youtube.com/feeds/videos.xml?playlist_id=PL1');
  });

  it('handles Mastodon profiles', () => {
    expect(deduceFeedUrl('https://mastodon.social/@user')).toBe('https://mastodon.social/@user.rss');
  });

  it('returns null for other or invalid addresses', () => {
    expect(deduceFeedUrl('https://example.com/blog')).toBeNull();
    expect(deduceFeedUrl('not a url')).toBeNull();
  });
});

describe('discoverFeedUrl', () => {
  it('finds the advertised feed and resolves relative links', () => {
    const html = '<head><link rel="alternate" type="application/rss+xml" href="/feed.xml"></head>';
    expect(discoverFeedUrl(html, 'https://example.com/blog/')).toBe('https://example.com/feed.xml');
  });

  it('returns null when none is advertised', () => {
    expect(discoverFeedUrl('<head></head>', 'https://example.com')).toBeNull();
  });

  it('skips advertised links with an unusable href', () => {
    const html = '<link rel="alternate" type="application/rss+xml" href="http://[bad"><link rel="alternate" type="application/atom+xml" href="/ok">';
    expect(discoverFeedUrl(html, 'https://example.com')).toBe('https://example.com/ok');
  });
});
