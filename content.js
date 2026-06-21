/* =============================================================================
 * content.js  —  content-script world (loaded after extractors.js)
 *
 * Tracks the element under the most recent right-click (the contextMenus API
 * gives us the image URL but not the DOM node), then on request builds the
 * final filename: poster (@handle) - @artist #tags.ext, or the site's random
 * string if nothing useful was found.
 * ========================================================================== */

(function () {
  "use strict";

  const ext = globalThis.browser ?? globalThis.chrome;

  let lastTarget = null;
  document.addEventListener(
    "contextmenu",
    (e) => {
      lastTarget = e.target;
    },
    true // capture, so we still see it if the page stops propagation
  );

  const pickExtractor = () =>
    (window.SIS_EXTRACTORS || []).find((x) => x.test(location)) || null;

  function resolveImage(srcUrl) {
    if (lastTarget) {
      if (lastTarget.tagName === "IMG") return lastTarget;
      const inner = lastTarget.querySelector && lastTarget.querySelector("img");
      if (inner) return inner;
      const up = lastTarget.closest && lastTarget.closest("img");
      if (up) return up;
    }
    if (srcUrl) {
      const imgs = [...document.images];
      return (
        imgs.find((i) => i.currentSrc === srcUrl || i.src === srcUrl) || null
      );
    }
    return null;
  }

  // ---- filename assembly ----------------------------------------------------

  // Per-token cleaner. Keeps Unicode letters/numbers so accents survive
  // (Māui stays Māui), drops @ and #, and turns EVERY other character —
  // including everything illegal on Windows or Linux (\ / : * ? " < > |, control
  // chars, etc.) — into a single underscore separator.
  function safeToken(s) {
    return (s || "")
      .normalize("NFC")
      .replace(/[@#]/g, "")
      .replace(/[^\p{L}\p{N}]+/gu, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  // Flat underscore format: poster_handle_artist_tag (accents preserved).
  function buildBase(d) {
    const poster = safeToken(d.poster);
    const handle = safeToken(d.handle);

    const parts = [];
    if (poster) parts.push(poster);
    // Skip the handle when it just repeats the poster name (common on Bluesky).
    if (handle && handle.toLowerCase() !== poster.toLowerCase()) parts.push(handle);
    for (const a of d.artists || []) {
      const t = safeToken(a);
      if (t) parts.push(t);
    }
    for (const t of d.tags || []) {
      const k = safeToken(t);
      if (k) parts.push(k);
    }
    return parts.join("_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
  }

  // Windows reserved device names — a file named exactly these won't save.
  const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

  // Composed name WITHOUT extension. The background script appends the right
  // extension after it decides the output format (it may convert webp→png).
  function baseName(d) {
    let base = buildBase(d);
    if (!base) base = safeToken(d.fallbackBase); // fall back to the random string
    base = (base || "image").slice(0, 180).replace(/^_+|_+$/g, "") || "image";
    if (RESERVED.test(base)) base += "_";
    return base;
  }

  // ---- respond to the background script -------------------------------------

  ext.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || msg.type !== "SIS_EXTRACT") return false;
    try {
      const img = resolveImage(msg.srcUrl);
      const extractor = pickExtractor();
      if (!img || !extractor) {
        sendResponse({ ok: false });
        return true;
      }
      const data = extractor.extract(img);
      sendResponse({ ok: true, base: baseName(data), urlExt: data.ext });
    } catch (err) {
      sendResponse({ ok: false, reason: String(err && err.message) });
    }
    return true;
  });
})();
