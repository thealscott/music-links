(function () {
  "use strict";

  const MODE = "__MODE__";
  const SERVICE = "__SERVICE__";
  const TEST_MODE = __TEST__;

  /**
   * Return trimmed text from the first matching element.
   *
   * @param {string} selector
   * @returns {string|null}
   */
  function text(selector) {
    const element = document.querySelector(selector);
    const value = element && element.textContent.trim();
    return value || null;
  }

  /**
   * Return a meta tag's trimmed content.
   *
   * @param {string} selector
   * @returns {string|null}
   */
  function meta(selector) {
    const element = document.querySelector(selector);
    const value = element && element.getAttribute("content");
    return value ? value.trim() : null;
  }

  /**
   * Join the useful parts of a music credit into one search term.
   *
   * @param {...(string|null|undefined)} parts
   * @returns {string|null}
   */
  function joinParts(...parts) {
    const value = parts.filter(Boolean).join(" ").trim();
    return value || null;
  }

  /**
   * Extract the current track and artist from YouTube Music.
   *
   * @returns {string|null}
   */
  function extractYouTubeMusic() {
    const title = text("ytmusic-player-bar .title");
    const byline = text("ytmusic-player-bar .byline");
    const artist = byline && byline.split(/\s*[•·]\s*/)[0];
    return joinParts(title, artist);
  }

  /**
   * Extract the video title and channel name from YouTube.
   *
   * @returns {string|null}
   */
  function extractYouTube() {
    const title =
      text("h1.ytd-watch-metadata yt-formatted-string") ||
      text("h1.ytd-watch-metadata");
    const channel = text("ytd-channel-name a");
    const artist = channel && channel.replace(/\s*-\s*Topic\s*$/i, "");
    return joinParts(title, artist);
  }

  /**
   * Extract the track or album title and artist from Bandcamp.
   *
   * @returns {string|null}
   */
  function extractBandcamp() {
    const title = text("#name-section .trackTitle");
    const artistText = text("#name-section h3");
    const artist =
      text("#name-section h3 a") ||
      (artistText && artistText.replace(/^\s*by\s+/i, ""));
    return joinParts(title, artist);
  }

  /**
   * Extract a music subject from a Wikipedia heading.
   *
   * @returns {string|null}
   */
  function extractWikipedia() {
    const heading = text("#firstHeading");
    return (
      heading &&
      heading.replace(
        /\s+\((?:album|song|band|musician|singer|rapper|group)\)\s*$/i,
        "",
      )
    );
  }

  /**
   * Extract an Apple Music title and artist from Open Graph metadata.
   *
   * @returns {string|null}
   */
  function extractAppleMusic() {
    const title = meta('meta[property="og:title"]');
    return (
      title &&
      title
        .replace(/\s+(?:on|in)\s+Apple Music\s*$/i, "")
        .replace(/^(.+?)\s+by\s+(.+)$/i, "$1 $2")
    );
  }

  /**
   * Extract a track, album, or artist from a Spotify page.
   *
   * @returns {string|null}
   */
  function extractSpotify() {
    const structuredTerm = extractJsonLd();
    if (structuredTerm) return structuredTerm;

    const pageTitle = document.title.trim();
    const creditedTitle = pageTitle.match(
      /^(.+?)\s*-\s*(?:song(?:\s+and\s+lyrics)?|album)\s+by\s+(.+?)\s*\|\s*Spotify$/i,
    );
    if (creditedTitle) {
      return joinParts(creditedTitle[1], creditedTitle[2]);
    }

    const title = meta('meta[property="og:title"]') || text("h1");
    const creator =
      text('[data-testid="creator-link"]') ||
      text('a[href*="/artist/"]');
    if (title && creator) {
      return joinParts(title, creator);
    }

    const artistTitle = pageTitle.match(/^(.+?)\s*\|\s*Spotify$/i);
    return joinParts(title || (artistTitle && artistTitle[1]));
  }

  /**
   * Extract an artist with a track or album from a Last.fm URL.
   *
   * @returns {string|null}
   */
  function extractLastFm() {
    const segments = location.pathname
      .split("/")
      .filter(Boolean)
      .map((segment) => decodeURIComponent(segment.replace(/\+/g, " ")));

    if (segments[0] !== "music" || !segments[1]) {
      return null;
    }

    if (segments[2] === "_" && segments[3]) {
      return joinParts(segments[3], segments[1]);
    }

    return joinParts(segments[2], segments[1]);
  }

  /**
   * Extract and de-brand a title from an Open Graph tag or heading.
   *
   * @returns {string|null}
   */
  function extractBrandedTitle() {
    const title =
      meta('meta[property="og:title"]') ||
      text("h1") ||
      document.title.trim();

    return (
      title &&
      title
        .replace(/\s*[\-|–—]\s*(?:SoundCloud|Genius(?: Lyrics)?|Discogs)\s*$/i, "")
        .replace(/\s*\|\s*(?:SoundCloud|Genius(?: Lyrics)?|Discogs)\s*$/i, "")
    );
  }

  /**
   * Find the first music entity within arbitrary JSON-LD data.
   *
   * @param {unknown} value
   * @returns {Record<string, unknown>|null}
   */
  function findMusicEntity(value) {
    if (Array.isArray(value)) {
      for (const item of value) {
        const entity = findMusicEntity(item);
        if (entity) return entity;
      }
      return null;
    }

    if (!value || typeof value !== "object") {
      return null;
    }

    const object = /** @type {Record<string, unknown>} */ (value);
    const types = Array.isArray(object["@type"])
      ? object["@type"]
      : [object["@type"]];
    if (
      types.some((type) =>
        ["MusicRecording", "MusicAlbum", "MusicGroup"].includes(
          /** @type {string} */ (type),
        ),
      )
    ) {
      return object;
    }

    return findMusicEntity(object["@graph"]);
  }

  /**
   * Read a name from a JSON-LD value.
   *
   * @param {unknown} value
   * @returns {string|null}
   */
  function jsonLdName(value) {
    if (Array.isArray(value)) {
      return value.map(jsonLdName).filter(Boolean).join(" ") || null;
    }
    if (typeof value === "string") {
      return value;
    }
    if (value && typeof value === "object" && "name" in value) {
      const name = /** @type {{name?: unknown}} */ (value).name;
      return typeof name === "string" ? name : null;
    }
    return null;
  }

  /**
   * Extract a music title and artist from JSON-LD scripts.
   *
   * @returns {string|null}
   */
  function extractJsonLd() {
    const scripts = document.querySelectorAll(
      'script[type="application/ld+json"]',
    );
    for (const script of scripts) {
      try {
        const entity = findMusicEntity(JSON.parse(script.textContent || ""));
        if (entity) {
          return joinParts(
            jsonLdName(entity.name),
            jsonLdName(entity.byArtist),
          );
        }
      } catch {
        // Ignore malformed third-party metadata and try the next script.
      }
    }
    return null;
  }

  /**
   * Extract a likely search term from common page metadata.
   *
   * @returns {string|null}
   */
  function extractGeneric() {
    return (
      extractJsonLd() ||
      meta('meta[property="og:title"]') ||
      meta('meta[name="twitter:title"]') ||
      document.title.replace(/\s+(?:[-–—]|\|)\s+[^-|–—]+$/, "").trim() ||
      null
    );
  }

  /**
   * Select the best site-specific extractor for the current hostname.
   *
   * @returns {string|null}
   */
  function extractSiteSpecific() {
    const host = location.hostname.replace(/^www\./, "").toLowerCase();

    if (host === "music.youtube.com") return extractYouTubeMusic();
    if (host === "youtube.com" || host.endsWith(".youtube.com")) {
      return extractYouTube();
    }
    if (host === "bandcamp.com" || host.endsWith(".bandcamp.com")) {
      return extractBandcamp();
    }
    if (host === "en.wikipedia.org") return extractWikipedia();
    if (host === "music.apple.com") return extractAppleMusic();
    if (host === "open.spotify.com" || host === "spotify.com") {
      return extractSpotify();
    }
    if (host === "last.fm" || host.endsWith(".last.fm")) return extractLastFm();
    if (
      ["soundcloud.com", "genius.com", "discogs.com"].some(
        (site) => host === site || host.endsWith(`.${site}`),
      )
    ) {
      return extractBrandedTitle();
    }
    return null;
  }

  /**
   * Remove video labels, release notes, and separators from a search term.
   *
   * @param {string} value
   * @returns {string}
   */
  function cleanTerm(value) {
    return value
      .replace(
        /\s*[\[(](?:official\s+)?(?:music\s+)?(?:video|audio|lyrics?|visuali[sz]er|hd|4k|remaster(?:ed)?(?:\s+\d{4})?)[\])]/gi,
        " ",
      )
      .replace(/\s+(?:[-–—|]|\bby\b)\s+/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * Extract and clean the best available music search term.
   *
   * @returns {string}
   */
  function extractTerm() {
    return cleanTerm(extractSiteSpecific() || extractGeneric() || "");
  }

  /**
   * Build a search URL for the configured music service and opening mode.
   *
   * @param {string} term
   * @returns {string}
   */
  function buildSearchUrl(term) {
    const encodedTerm = encodeURIComponent(term);
    if (SERVICE === "youtube-music") {
      return `https://music.youtube.com/search?q=${encodedTerm}`;
    }
    if (SERVICE === "tidal") {
      return `https://listen.tidal.com/search?q=${encodedTerm}`;
    }
    if (SERVICE === "apple") {
      const scheme = MODE === "app" ? "music" : "https";
      return `${scheme}://music.apple.com/search?term=${encodedTerm}`;
    }
    if (MODE === "app") {
      return `spotify:search:${encodedTerm}`;
    }
    return `https://open.spotify.com/search/${encodedTerm}`;
  }

  /**
   * Open the configured music service using the configured mode.
   *
   * @param {string} term
   * @returns {void}
   */
  function openMusicService(term) {
    const url = buildSearchUrl(term);
    if (MODE === "app") {
      location.href = url;
      return;
    }
    window.open(url, "_blank");
  }

  if (TEST_MODE) {
    globalThis.__spotifyBookmarklet = {
      buildSearchUrl,
      cleanTerm,
      extractAppleMusic,
      extractBandcamp,
      extractBrandedTitle,
      extractGeneric,
      extractJsonLd,
      extractLastFm,
      extractSiteSpecific,
      extractSpotify,
      extractTerm,
      extractWikipedia,
      extractYouTube,
      extractYouTubeMusic,
    };
    return;
  }

  const term = extractTerm();
  if (!term) {
    alert("Music Search could not find a song, album, or artist on this page.");
    return;
  }
  openMusicService(term);
})();
