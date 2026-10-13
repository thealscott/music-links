# Music Search Bookmarklets

This bookmarklet extracts a likely song, album, or artist from the current page
and searches for it on Spotify, Apple Music, YouTube Music, or TIDAL. It
supports dedicated extraction for YouTube, YouTube Music, Bandcamp, Wikipedia,
Spotify, Apple Music, Last.fm, SoundCloud, Genius, and Discogs, with structured
metadata and page-title fallbacks for other sites.

## Install

1. Install dependencies and build the bookmarklets:

   ```sh
   npm install
   npm run build
   ```

2. Open `dist/install.html` in a browser.
3. Drag either **Search Spotify (Web)** or **Search Spotify (App)** to the
   bookmarks bar.

Alternatively, copy the full contents of one of these files in `dist/` into the
URL field of a new bookmark:

- `spotify-search-web.txt` opens Spotify's web search in a new tab.
- `spotify-search-app.txt` opens the search in the Spotify desktop app.
- `apple-music-search-web.txt` opens Apple Music's web search in a new tab.
- `apple-music-search-app.txt` opens the search in the Music app.
- `youtube-music-search.txt` opens YouTube Music's web search in a new tab.
- `tidal-search.txt` opens TIDAL's web search in a new tab.

## Use

Open a page about a song, album, or artist and click the bookmarklet. The
search term is detected automatically. If the page has no useful music
metadata or title, the bookmarklet displays an error.

## Develop

Edit `src/bookmarklet.js`, then rebuild and run the tests:

```sh
npm run build
npm test
```
