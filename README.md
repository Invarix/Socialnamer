[![Support on Ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/invarix)

# Socialnamer (Chromium, MV3)

Right-click an image on X/Twitter, Bluesky, Pixiv, a supported Mastodon instance, or an online gallery →
**Download with Socialnamer**. It opens a save dialog with an editable
filename field, pre-filled from the post - poster, handle, artist credit,
tags, caption keywords - and can convert the file out of webp on the way
down. No more `HiJKlMNoP.jpg`.

## Filename

All parts are joined by underscores into a flat filename:
`poster_handle_artist_tags_keywords`.

1. Poster name, then handle, then any artist shout-out from the caption
   (`art by @x`, `src: @y`, @mentions), then hashtags.
2. Up to four keywords from the post text itself - a caption of "white rabbit"
   becomes `white_rabbit` in the filename. Links, @mentions, #tags (captured
   separately), and filler words are skipped.
3. If the poster wrote an image description (alt text), up to four keywords
   from it are appended too. Placeholder values like X's `alt="Image"` are
   ignored, and words already present aren't repeated. (This is the
   description written on the post - social sites strip EXIF metadata on
   upload, so there's nothing usable inside the image file itself.)
4. Multi-image posts get a position suffix in display order - the first of
   four saves as `…01.jpg`, the fourth as `…04.jpg`. Single-image posts have
   no suffix.
5. Nothing found → falls back to the site's random string (e.g. the media id),
   so you never get a worse name than the default.

Character safety: accented and non-Latin letters are kept (`Māui`, `José`,
`日本語`). `@` and `#` are dropped, and anything illegal on Windows or Linux
(`\ / : * ? " < > |`, control chars, emoji, other symbols) becomes an
underscore, so the name is always safe to write to disk. Windows reserved
device names (`CON`, `PRN`, …) are guarded. On Bluesky the `.bsky.social`
suffix is trimmed and a handle that just repeats the display name is dropped
(`alice` + `alice.bsky.social` → `alice`, not `alice_alice_bsky_social`).

Example: a post by *Māui Person* (@MauiPerson) →
`Māui_Person_MauiPerson.jpg`. The field stays editable, so you can add
keywords before saving.

Note: the extension reads the text as rendered - if X has auto-translated the
post, the translated caption is what lands in the filename. Tap "show
original" first to keep the source language.

## Where it works

- **Feed / timeline** - right-click any post image.
- **Post pages and the image lightbox** - X's `/photo/N` viewer, Bluesky's
  expanded-image view, and Mastodon's media modal are all supported (the post
  is located via the URL, the item's testid, or the media file's identity as
  needed).
- **Mastodon instances** - one generic extractor covers the Mastodon web UI:
  author, caption, tags, alt text, and multi-image numbering all work the same
  as on X and Bluesky. Bonus: gallery thumbnails are the small rendition, so
  the extension automatically downloads the full-size original instead of the
  thumb you clicked. The supported instance list lives in the manifest.
- **Direct media URLs** (an image opened in its own tab from any supported
  site) - the menu still appears, and if the tab you came from is still open,
  the extension finds the post there by the file's rendition-stable name and
  builds the full smart filename. Without such a tab: Bluesky posts are
  recovered through the platform's public AppView API (author, text, tags,
  alt), Pixiv artworks through pixiv's public artwork endpoint (artist,
  title, tags), and other sites fall back to the file hash, since their bare
  media URLs carry no recoverable info.
- **Pixiv** - artwork pages, manga galleries (page numbering maps to the
  `_pN` index), and collection grids. Saves upgrade to the full
  `img-original` file when it exists, trying png then jpg, and the required
  Referer header is handled automatically so downloads and conversions work.
- **Online galleries** - tag-categorized image boards. Filenames are built
  from the descriptive tag categories (artist, copyright, character, species)
  in that order; the large alphabetical "general" bucket and housekeeping tags
  are omitted. Tags are read from the post's own public metadata endpoint, and
  the full-resolution file is downloaded. Supported sites live in the manifest.

## Format conversion (the webp fix)

The submenu gives three choices - picked **before** the save dialog, because
an extension can't add controls inside the OS Save As window:

| Item | Behavior |
|------|----------|
| **Keep original format** | saved byte-for-byte, with a corrected extension |
| **Force JPG** | re-encode to JPEG (transparency flattened onto white, q=0.95) |
| **Force PNG** | re-encode to PNG (lossless) |

To pull a Bluesky webp down as a PNG, pick **Force PNG** - the byte-sniffing
below means it converts even when the URL claims the file is a jpeg.

Format is detected by **sniffing the file's magic bytes**, not the URL -
Bluesky serves webp under a `…@jpeg` URL via content negotiation, so the
extension would lie. Conversion uses `OffscreenCanvas` in the background.
Re-encoding a webp recovers the pixels, not the photographer's original file -
there's no original hiding behind the webp to get back to.

> Converted files are handed to the download as a blob URL where the
> background supports it, with a base64 data URL as the fallback (Chrome's
> service worker can't mint blob URLs). Normal social images are fine either
> way; if an unusually large PNG re-encode ever fails, use **Keep original**.

## Install & permissions

From the Chrome Web Store, or unpacked: `chrome://extensions` →
**Developer mode** → **Load unpacked** → pick this folder. A Firefox build
ships from the same source with only the manifest differing.

Host permissions cover the page sites (including the supported Mastodon
instances), the image CDNs (`*.twimg.com`, `*.bsky.app`, and the instances'
media hosts - reading the bytes is what enables conversion and format
sniffing), and the platforms' public read-only endpoints for direct media URLs (Bluesky AppView, pixiv artwork lookup; requests identify the artwork or author, never you). No analytics, no remote code, nothing leaves your
machine otherwise.

## Maintenance

Site scraping lives in the extractor section at the top of `content.js`
(`User-Name`/`tweetText` for X, `feedItem-by-`/`postThreadItem-by-` testids
and `postText` for Bluesky, and a generic Mastodon extractor keyed off
`.status` / `.display-name__account` / `.status__content`) - that's the place
to patch when a site reshuffles its DOM.

To add a Mastodon instance: add its domain to `MASTODON_INSTANCES`
(content.js), `matches` (manifest.json), and `SITE_PATTERNS` (background.js)
plus `host_permissions` for its media host. To add a non-Mastodon site: insert
an extractor before `GENERIC_EXTRACTOR` and register the same three places.

## Files

```
manifest.json          MV3; permissions: contextMenus + downloads (+ CDN hosts)
background.js          menu, format sniffing, conversion, DID lookup, save
content.js             per-site extractors (top of file) + filename assembly
icon16/32/48/128.png   toolbar + store icons
```

[![Support on Ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/invarix)
