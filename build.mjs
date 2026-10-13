import { mkdir, readFile, writeFile } from "node:fs/promises";
import { minify } from "terser";

const source = await readFile(new URL("./src/bookmarklet.js", import.meta.url), {
  encoding: "utf8",
});
const outputDirectory = new URL("./dist/", import.meta.url);

/**
 * Compile the source into a bookmarklet for one service and opening mode.
 *
 * @param {"spotify"|"apple"|"youtube-music"|"tidal"} service
 * @param {"web"|"app"} mode
 * @returns {Promise<string>}
 */
async function compile(service, mode) {
  const configuredSource = source
    .replace('"__MODE__"', JSON.stringify(mode))
    .replace('"__SERVICE__"', JSON.stringify(service))
    .replace("__TEST__", "false");
  const result = await minify(configuredSource, {
    compress: {
      passes: 2,
    },
    mangle: true,
  });

  if (!result.code) {
    throw new Error(`Terser produced no output for ${service} ${mode} mode`);
  }

  return `javascript:${result.code}`;
}

/**
 * Escape a string for use in an HTML attribute.
 *
 * @param {string} value
 * @returns {string}
 */
function escapeAttribute(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

const [
  spotifyWebBookmarklet,
  spotifyAppBookmarklet,
  appleWebBookmarklet,
  appleAppBookmarklet,
  youtubeMusicBookmarklet,
  tidalBookmarklet,
] = await Promise.all([
  compile("spotify", "web"),
  compile("spotify", "app"),
  compile("apple", "web"),
  compile("apple", "app"),
  compile("youtube-music", "web"),
  compile("tidal", "web"),
]);

const installPage = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Music Search Bookmarklets</title>
    <style>
      :root { color-scheme: light dark; font-family: system-ui, sans-serif; }
      body { max-width: 42rem; margin: 4rem auto; padding: 0 1.25rem; line-height: 1.5; }
      .bookmarklet { display: inline-block; margin: .5rem .5rem .5rem 0; padding: .65rem 1rem;
        border-radius: .4rem; background: #1db954; color: #000; font-weight: 700;
        text-decoration: none; }
    </style>
  </head>
  <body>
    <h1>Music Search Bookmarklets</h1>
    <p>Drag any link to your bookmarks bar:</p>
    <h2>Spotify</h2>
    <p>
      <a class="bookmarklet" href="${escapeAttribute(spotifyWebBookmarklet)}">Search Spotify (Web)</a>
      <a class="bookmarklet" href="${escapeAttribute(spotifyAppBookmarklet)}">Search Spotify (App)</a>
    </p>
    <h2>Apple Music</h2>
    <p>
      <a class="bookmarklet" href="${escapeAttribute(appleWebBookmarklet)}">Search Apple Music (Web)</a>
      <a class="bookmarklet" href="${escapeAttribute(appleAppBookmarklet)}">Search Apple Music (App)</a>
    </p>
    <h2>YouTube Music</h2>
    <p>
      <a class="bookmarklet" href="${escapeAttribute(youtubeMusicBookmarklet)}">Search YouTube Music</a>
    </p>
    <h2>TIDAL</h2>
    <p>
      <a class="bookmarklet" href="${escapeAttribute(tidalBookmarklet)}">Search TIDAL</a>
    </p>
    <p>Open a music-related page, then click a bookmark to search automatically.</p>
  </body>
</html>
`;

await mkdir(outputDirectory, { recursive: true });
await Promise.all([
  writeFile(
    new URL("spotify-search-web.txt", outputDirectory),
    `${spotifyWebBookmarklet}\n`,
  ),
  writeFile(
    new URL("spotify-search-app.txt", outputDirectory),
    `${spotifyAppBookmarklet}\n`,
  ),
  writeFile(
    new URL("apple-music-search-web.txt", outputDirectory),
    `${appleWebBookmarklet}\n`,
  ),
  writeFile(
    new URL("apple-music-search-app.txt", outputDirectory),
    `${appleAppBookmarklet}\n`,
  ),
  writeFile(
    new URL("youtube-music-search.txt", outputDirectory),
    `${youtubeMusicBookmarklet}\n`,
  ),
  writeFile(
    new URL("tidal-search.txt", outputDirectory),
    `${tidalBookmarklet}\n`,
  ),
  writeFile(new URL("install.html", outputDirectory), installPage),
]);

console.log("Built all music search bookmarklets in dist/");
