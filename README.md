[![Support on Ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/invarix)

# Socialnamer (Chromium, MV3)

Right-click an image on X/Twitter or Bluesky → **Download with Socialnamer**.
It opens a save dialog with an editable filename field, pre-filled from the
post — poster, handle, artist credit, tags, caption keywords — and can convert
the file out of webp on the way down. No more `HLTeLjZWsAAe9LF.jpg`.

## Filename

All parts are joined by underscores into a flat filename:
`poster_handle_artist_tags_keywords`.

1. Poster name, then handle, then any artist shout-out from the caption
   (`art by @x`, `src: @y`, @mentions), then hashtags.
2. Up to four keywords from the post text itself — a caption of "electric eel"
   becomes `electric_eel` in the filename. Links, @mentions, #tags (captured
   separately), and filler words are skipped.
3. If the poster wrote an image description (alt text), up to four keywords
   from it are appended too. Placeholder values like X's `alt="Image"` are
   ignored, and words already present aren't repeated. (This is the
   description written on the post — social sites strip EXIF metadata on
   upload, so there's nothing usable inside the image file itself.)
4. Multi-image posts get a position suffix in display order — the first of
   four saves as `…01.jpg`, the fourth as `…04.jpg`. Single-image posts have
   no suffix.
5. Nothing found → falls back to the site's random string (e.g. the media id),
   so you never get a worse name than the default.

Character safety: accented and non-Latin letters are kept (`Māui`, `José`,
`大盛り`). `@` and `#` are dropped, and anything illegal on Windows or Linux
(`\ / : * ? " < > |`, control chars, emoji, other symbols) becomes an
underscore, so the name is always safe to write to disk. Windows reserved
device names (`CON`, `PRN`, …) are guarded. On Bluesky the `.bsky.social`
suffix is trimmed and a handle that just repeats the display name is dropped
(`alice` + `alice.bsky.social` → `alice`, not `alice_alice_bsky_social`).

Example: a post by *Kalani o Māui* (@MauiBoyMacro) →
`Kalani_o_Māui_MauiBoyMacro.jpg`. The field stays editable, so you can add
keywords before saving.

Note: the extension reads the text as rendered — if X has auto-translated the
post, the translated caption is what lands in the filename. Tap "show
original" first to keep the source language.

## Where it works

- **Feed / timeline** — right-click any post image.
- **Post pages and the image lightbox** — both X's `/photo/N` viewer and
  Bluesky's expanded-image view are supported (the post is located via the
  URL, the item's testid, or the image's blob CID as needed).
- **Direct CDN image URLs** (`cdn.bsky.app`, `pbs.twimg.com` opened in their
  own tab) — the menu still appears. On Bluesky the author's DID in the URL is
  resolved to a handle via the public PLC directory, so the file is named
  after the author; post text can't be recovered from a bare blob URL, so
  save from the post to get the full name.

## Format conversion (the webp fix)

The submenu gives three choices — picked **before** the save dialog, because
an extension can't add controls inside the OS Save As window:

| Item | Behavior |
|------|----------|
| **Keep original format** | saved byte-for-byte, with a corrected extension |
| **Force JPG** | re-encode to JPEG (transparency flattened onto white, q=0.95) |
| **Force PNG** | re-encode to PNG (lossless) |

To pull a Bluesky webp down as a PNG, pick **Force PNG** — the byte-sniffing
below means it converts even when the URL claims the file is a jpeg.

Format is detected by **sniffing the file's magic bytes**, not the URL —
Bluesky serves webp under a `…@jpeg` URL via content negotiation, so the
extension would lie. Conversion uses `OffscreenCanvas` in the service worker.
Re-encoding a webp recovers the pixels, not the photographer's original file —
there's no original hiding behind the webp to get back to.

> Converted files are handed to the download as a base64 data URL (service
> workers can't mint blob URLs). That's fine for normal social images; a very
> large PNG re-encode could bump a size ceiling, in which case use **Keep
> original** or switch the convert path to the `chrome.offscreen` API.

## Install & permissions

From the Chrome Web Store, or unpacked: `chrome://extensions` →
**Developer mode** → **Load unpacked** → pick this folder.

Host permissions cover the page sites, the image CDNs (`*.twimg.com`,
`*.bsky.app` — reading the bytes is what enables conversion and format
sniffing), and `plc.directory` (read-only DID→handle lookup, used only when
saving from a direct CDN URL where no post is on screen; the request contains
the DID and nothing else). No analytics, no remote code, nothing leaves your
machine otherwise.

## Maintenance

Site scraping lives in the extractor section at the top of `content.js`
(`User-Name`/`tweetText` for X, `feedItem-by-`/`postThreadItem-by-` testids
and `postText` for Bluesky) — that's the place to patch when a site reshuffles
its DOM. To add a site, insert an extractor before `GENERIC_EXTRACTOR` and add
the URL to `matches` (manifest) + `SITE_PATTERNS` (background.js); add its CDN
to `host_permissions` if conversion is needed there.

## Files

```
manifest.json          MV3; permissions: contextMenus + downloads (+ CDN hosts)
background.js          menu, format sniffing, conversion, DID lookup, save
content.js             per-site extractors (top of file) + filename assembly
icon16/32/48/128.png   toolbar + store icons
```

[![Support on Ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/invarix)
