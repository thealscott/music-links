import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { JSDOM } from "jsdom";

const sourceTemplate = await readFile(
  new URL("../src/bookmarklet.js", import.meta.url),
  "utf8",
);

/**
 * Load the bookmarklet's test API into a page fixture.
 *
 * @param {string} html
 * @param {string} url
 * @param {object} [options]
 * @param {"spotify"|"apple"|"youtube-music"|"tidal"} [options.service]
 * @param {"web"|"app"} [options.mode]
 * @returns {{api: Record<string, Function>, dom: JSDOM}}
 */
function loadFixture(
  html,
  url,
  { service = "spotify", mode = "web" } = {},
) {
  const source = sourceTemplate
    .replace('"__MODE__"', JSON.stringify(mode))
    .replace('"__SERVICE__"', JSON.stringify(service))
    .replace("__TEST__", "true");
  const dom = new JSDOM(html, {
    runScripts: "dangerously",
    url,
  });
  dom.window.eval(source);
  return {
    api: dom.window.__spotifyBookmarklet,
    dom,
  };
}

test("extracts a YouTube Music track and artist", () => {
  const { api, dom } = loadFixture(
    `<ytmusic-player-bar>
      <span class="title">Hyperballad</span>
      <span class="byline">Björk • Post • 1995</span>
    </ytmusic-player-bar>`,
    "https://music.youtube.com/watch?v=123",
  );
  assert.equal(api.extractTerm(), "Hyperballad Björk");
  dom.window.close();
});

test("extracts a YouTube video title and de-topics the channel", () => {
  const { api, dom } = loadFixture(
    `<h1 class="ytd-watch-metadata"><yt-formatted-string>Teardrop (Official Video)</yt-formatted-string></h1>
     <ytd-channel-name><a>Massive Attack - Topic</a></ytd-channel-name>`,
    "https://www.youtube.com/watch?v=123",
  );
  assert.equal(api.extractTerm(), "Teardrop Massive Attack");
  dom.window.close();
});

test("extracts a Bandcamp track and artist", () => {
  const { api, dom } = loadFixture(
    `<section id="name-section">
      <h2 class="trackTitle">Archangel</h2>
      <h3>by <a>Burial</a></h3>
    </section>`,
    "https://burial.bandcamp.com/track/archangel",
  );
  assert.equal(api.extractTerm(), "Archangel Burial");
  dom.window.close();
});

test("extracts and de-disambiguates a Wikipedia heading", () => {
  const { api, dom } = loadFixture(
    `<h1 id="firstHeading">Blue Monday (song)</h1>`,
    "https://en.wikipedia.org/wiki/Blue_Monday_(song)",
  );
  assert.equal(api.extractTerm(), "Blue Monday");
  dom.window.close();
});

test("extracts an Apple Music title and artist", () => {
  const { api, dom } = loadFixture(
    `<meta property="og:title" content="Blue by Joni Mitchell on Apple Music">`,
    "https://music.apple.com/us/album/blue/123",
  );
  assert.equal(api.extractTerm(), "Blue Joni Mitchell");
  dom.window.close();
});

test("extracts a Spotify track and artist from the page title", () => {
  const { api, dom } = loadFixture(
    `<title>Teardrop - song and lyrics by Massive Attack | Spotify</title>`,
    "https://open.spotify.com/track/123",
  );
  assert.equal(api.extractTerm(), "Teardrop Massive Attack");
  dom.window.close();
});

test("extracts a Spotify album and artist from the page title", () => {
  const { api, dom } = loadFixture(
    `<title>Blue - Album by Joni Mitchell | Spotify</title>`,
    "https://open.spotify.com/album/123",
  );
  assert.equal(api.extractTerm(), "Blue Joni Mitchell");
  dom.window.close();
});

test("extracts a Spotify artist from Open Graph metadata", () => {
  const { api, dom } = loadFixture(
    `<title>Björk | Spotify</title>
     <meta property="og:title" content="Björk">`,
    "https://open.spotify.com/artist/123",
  );
  assert.equal(api.extractTerm(), "Björk");
  dom.window.close();
});

test("extracts a Last.fm track from the URL", () => {
  const { api, dom } = loadFixture(
    "",
    "https://www.last.fm/music/Boards+of+Canada/_/Roygbiv",
  );
  assert.equal(api.extractTerm(), "Roygbiv Boards of Canada");
  dom.window.close();
});

for (const [host, suffix] of [
  ["soundcloud.com", "SoundCloud"],
  ["genius.com", "Genius Lyrics"],
  ["discogs.com", "Discogs"],
]) {
  test(`extracts and de-brands an Open Graph title on ${host}`, () => {
    const { api, dom } = loadFixture(
      `<meta property="og:title" content="Windowlicker - Aphex Twin | ${suffix}">`,
      `https://${host}/music-page`,
    );
    assert.equal(api.extractTerm(), "Windowlicker Aphex Twin");
    dom.window.close();
  });
}

test("prefers JSON-LD music metadata on an unknown site", () => {
  const { api, dom } = loadFixture(
    `<title>Unhelpful Site Title</title>
     <script type="application/ld+json">
       {
         "@context": "https://schema.org",
         "@type": "MusicRecording",
         "name": "Svefn-g-englar",
         "byArtist": {"@type": "MusicGroup", "name": "Sigur Rós"}
       }
     </script>`,
    "https://example.com/review",
  );
  assert.equal(api.extractTerm(), "Svefn-g-englar Sigur Rós");
  dom.window.close();
});

test("falls back from malformed JSON-LD to social metadata", () => {
  const { api, dom } = loadFixture(
    `<script type="application/ld+json">{broken</script>
     <meta name="twitter:title" content="Vespertine | Music Reviews">`,
    "https://example.com/review",
  );
  assert.equal(api.extractTerm(), "Vespertine Music Reviews");
  dom.window.close();
});

test("falls back to a de-branded document title", () => {
  const { api, dom } = loadFixture(
    `<title>Kind of Blue - Example Music Database</title>`,
    "https://example.com/album",
  );
  assert.equal(api.extractTerm(), "Kind of Blue");
  dom.window.close();
});

test("builds Apple Music web and app search URLs", () => {
  const webFixture = loadFixture("", "https://example.com/", {
    service: "apple",
    mode: "web",
  });
  assert.equal(
    webFixture.api.buildSearchUrl("Björk Jóga"),
    "https://music.apple.com/search?term=Bj%C3%B6rk%20J%C3%B3ga",
  );
  webFixture.dom.window.close();

  const appFixture = loadFixture("", "https://example.com/", {
    service: "apple",
    mode: "app",
  });
  assert.equal(
    appFixture.api.buildSearchUrl("Björk Jóga"),
    "music://music.apple.com/search?term=Bj%C3%B6rk%20J%C3%B3ga",
  );
  appFixture.dom.window.close();
});

test("builds a YouTube Music web search URL", () => {
  const { api, dom } = loadFixture("", "https://example.com/", {
    service: "youtube-music",
  });
  assert.equal(
    api.buildSearchUrl("Björk Jóga"),
    "https://music.youtube.com/search?q=Bj%C3%B6rk%20J%C3%B3ga",
  );
  dom.window.close();
});

test("builds a TIDAL web search URL", () => {
  const { api, dom } = loadFixture("", "https://example.com/", {
    service: "tidal",
  });
  assert.equal(
    api.buildSearchUrl("Björk Jóga"),
    "https://listen.tidal.com/search?q=Bj%C3%B6rk%20J%C3%B3ga",
  );
  dom.window.close();
});

test("cleans common video labels and separators", () => {
  const { api, dom } = loadFixture("", "https://example.com/");
  assert.equal(
    api.cleanTerm("  Portishead - Roads (Official Video) | Remastered  "),
    "Portishead Roads Remastered",
  );
  assert.equal(api.cleanTerm("Artist by Song [Lyrics]"), "Artist Song");
  assert.equal(api.cleanTerm("Track (Remastered 2011)"), "Track");
  dom.window.close();
});
