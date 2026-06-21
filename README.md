[![Support on Ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/invarix)

# Smart Image Saver (Chromium, MV3)

Right-click an image on X/Twitter or Bluesky → **Save Image w Custom Filename**.
It opens a save dialog with an editable filename field, pre-filled with the
poster, handle, any artist credit, and tags from the post — and can convert the
file out of webp on the way down.

## Filename

All parts are joined by underscores into a flat, ASCII filename:
`poster_handle_artist_tag`.

1. Poster name, then handle, then any artist shout-out from the caption
   (`art by @x`, `src: @y`, @mentions), then hashtags.
2. Accented letters are kept (`Māui`, `José`, `Müller`). `@` and `#` are
   dropped, and any character that's illegal on Windows or Linux
   (`\ / : * ? " < > |`, control chars, etc.) becomes an underscore — so the
   name is always safe to write to disk.
3. On Bluesky the `.bsky.social` suffix is trimmed, and a handle that just
   repeats the display name is dropped (so `alice` + `alice.bsky.social` →
   `alice`, not `alice_alice_bsky_social`).
4. Nothing found → falls back to the site's random string (e.g. the media id).

Example: a post by *Kalani o Māui* (@MauiBoyMacro) →
`Kalani_o_Māui_MauiBoyMacro.jpg`. The field stays editable, so you can add
keywords before saving.

## Format conversion (the webp fix)

The submenu gives four choices — picked **before** the save dialog, because an
extension can't add controls inside the OS Save As window:

| Item | Behavior |
|------|----------|
| **Keep original format** | saved byte-for-byte, with a corrected extension |
| **Force JPG** | re-encode to JPEG (transparency flattened onto white, q=0.95) |
| **Force PNG** | re-encode to PNG (lossless) |

To pull a Bluesky webp down as a PNG, pick **Force PNG** — the byte-sniffing
below means it converts even when the URL claims the file is a jpeg.

Format is detected by **sniffing the file's magic bytes**, not the URL — Bluesky
serves webp under a `…@jpeg` URL via content negotiation, so the extension would
lie. Conversion uses `OffscreenCanvas` in the background (same approach as
"Save Image as Any Type"). Re-encoding a webp recovers the pixels, not the
photographer's original file — there's no original hiding behind the webp to get
back to.

> Converted files are handed to the download as a base64 data URL (service
> workers can't mint blob URLs). That's fine for normal social images; a very
> large PNG re-encode could bump a size ceiling, in which case use **Keep
> original** or switch the convert path to the `chrome.offscreen` API.

## Install & permissions

`chrome://extensions` → **Developer mode** → **Load unpacked** → pick this folder.

Host permissions cover the page sites **and** the image CDNs
(`*.twimg.com`, `*.bsky.app`) — the CDN access is what lets the background read
the bytes to convert them. Without it, conversion silently falls back to saving
the original.

## Maintenance

Site scraping lives in `extractors.js` (`User-Name`/`tweetText` for X,
`a[href^="/profile/"]`/`postText` for Bluesky) — the file to patch when a site
reshuffles its DOM. To add a site, add an extractor before `GENERIC_EXTRACTOR`
and add the URL to `matches` (manifest) + `SITE_PATTERNS` (background.js); add
its CDN to `host_permissions` if conversion is needed there.

## Files

```
manifest.json          MV3; permissions: contextMenus + downloads (+ CDN hosts)
background.js          submenu, format sniffing, conversion, save
extractors.js  per-site DOM extractors (patch here)
content.js     tracks the right-clicked image, builds the filename base
```
[![Support on Ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/invarix)
