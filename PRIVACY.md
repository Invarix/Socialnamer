# Privacy Policy - Socialnamer

**Last updated:** July 11, 2026

Socialnamer is a browser extension that renames images you save from X/Twitter
and Bluesky using information visible in the post (poster, handle, artist
credit, tags, caption keywords) and can convert the image format on the way
down.

The short version: **Socialnamer collects nothing, stores nothing, and sends
nothing about you anywhere.** There are no accounts, no analytics, no ads, no
trackers, and no remote code. Everything happens locally in your browser, only
at the moment you invoke the extension.

## What the extension does with data

When you right-click an image and choose **Download with Socialnamer**, the
extension:

1. **Reads the visible content of the page you're on** (the post's author,
   handle, caption text, hashtags, and image alt text) - in your browser,
   locally - solely to build the filename. This information is placed into
   the save dialog's filename field and is not retained, logged, or
   transmitted by the extension.
2. **Fetches the image file itself** from the site's image CDN
   (`pbs.twimg.com` for X, `cdn.bsky.app` for Bluesky). This is the same
   download your browser performs when you save any image; the extension
   reads the file's first bytes to identify its true format and, if you chose
   a conversion option, re-encodes it locally before saving. The image is
   never sent anywhere other than to your own disk.
3. **In one specific case, makes read-only public lookups:** if you save
   from a direct media URL (an image opened in its own tab, with no post on
   screen), the extension recovers the post details from the platform's own
   public, unauthenticated endpoints: on Bluesky it queries the public
   AppView API (`public.api.bsky.app`) with the author's public DID from the
   image URL; on Pixiv it queries the public artwork endpoint on
   `www.pixiv.net` with the artwork id from the image URL. These requests
   identify the artwork or author being saved, never you or your browsing.
   If a lookup fails, the extension simply falls back to the default
   filename.

That is the complete list of network activity. The extension makes no other
requests of any kind.

## What the extension does NOT do

- **No collection or storage.** Socialnamer does not collect, store, or
  process personal information, browsing history, or usage data. It has no
  database, no local storage of user data, and no memory of past saves.
- **No transmission.** Nothing you do - pages visited, images saved,
  filenames generated - is sent to the developer or to any third party.
- **No analytics or telemetry.** There is no tracking, crash reporting,
  fingerprinting, or usage measurement of any kind.
- **No remote code.** All code ships inside the extension package and is
  reviewed by the Chrome Web Store. Nothing is downloaded or executed at
  runtime.
- **No sale or sharing of data.** There is no data to sell or share.
- **No background activity.** The extension does nothing until you invoke it
  from the right-click menu, and finishes when the save dialog closes.

## Permissions, explained

| Permission | Why it's needed |
|---|---|
| `contextMenus` | To add the **Download with Socialnamer** item to the right-click menu. |
| `downloads` | To open the save dialog pre-filled with the generated filename. |
| Host access: `x.com`, `twitter.com`, `bsky.app`, supported Mastodon instances | To read the post content (author, caption, tags, alt text) on the page you invoked the extension on, so the filename can be built. |
| Host access: `*.twimg.com`, `*.bsky.app` | To fetch the image bytes for format detection and optional JPG/PNG conversion. |
| Host access: `www.pixiv.net`, `i.pximg.net` | Reads the artwork page for the filename; fetches image bytes for saving and conversion (with the Referer header the site requires); read-only artwork lookup for direct image URLs (see above). |

The extension reads pages only on the sites listed above, and only in service
of the save you initiated.

## Children's privacy

Socialnamer does not collect information from anyone, including children.

## Changes to this policy

If a future version changes what data the extension touches (for example,
adding support for a new site adds a new host permission), this document will
be updated and the change noted in the version's release notes. Because the
extension collects nothing, there is no mechanism by which previously
collected data could exist or be affected.

## Contact

Questions about this policy or the extension:
- Ko-fi: https://ko-fi.com/invarix
- Or open an issue on the extension's GitHub repository.
