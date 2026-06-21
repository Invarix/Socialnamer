/* =============================================================================
 * extractors.js  —  content-script world
 *
 * One extractor per site family. Given the right-clicked <img>, returns the
 * pieces of a filename: poster name, @handle, artist shout-outs, hashtags, plus
 * a fallback (the site's random string) and the file extension to keep.
 *
 * The DOM selectors are the fragile part — X and Bluesky ship obfuscated,
 * shifting markup, so we lean on data-testid / href shapes and fail soft
 * (omit a field rather than throw). This file is where you patch when a site
 * reshuffles its layout. Add a site by inserting an extractor before GENERIC.
 * ========================================================================== */

(function () {
  "use strict";

  const MENTION_RE = /@([A-Za-z0-9_]{1,30})/g;
  const HASHTAG_RE = /#([\p{L}\p{N}_]{1,40})/gu;
  const CREDIT_HINT_RE =
    /\b(art(?:work)?\s*(?:by|:)|by|cr(?:edit)?s?\s*:?|source|src|via|drawn by|illust(?:ration)?\s*(?:by|:)|🎨|✒️|🖌️)\b/i;

  const uniq = (a) => [...new Set(a.filter(Boolean))];

  function matchesAll(re, text) {
    if (!text) return [];
    const out = [];
    let m;
    re.lastIndex = 0;
    while ((m = re.exec(text)) !== null) out.push(m[1]);
    return out;
  }

  // Artist-ish handles from caption text, credited ones first. No leading @.
  function findArtistHandles(text, posterHandle) {
    if (!text) return [];
    const poster = (posterHandle || "").replace(/^@/, "").toLowerCase();
    const mentions = matchesAll(MENTION_RE, text).filter(
      (h) => h.toLowerCase() !== poster
    );
    const credited = [];
    const re = new RegExp(
      CREDIT_HINT_RE.source + "[^@#]{0,20}@([A-Za-z0-9_]{1,30})",
      "giu"
    );
    let m;
    while ((m = re.exec(text)) !== null) {
      if (m[1] && m[1].toLowerCase() !== poster) credited.push(m[1]);
    }
    return uniq([...credited, ...mentions]);
  }

  function extFromUrl(url) {
    try {
      const u = new URL(url, location.href);
      const q = (u.searchParams.get("format") || "").toLowerCase();
      if (q) return q === "jpeg" ? "jpg" : q;
      // bsky: …/<cid>@jpeg  → jpeg
      const at = u.pathname.split("@").pop().toLowerCase();
      if (["jpg", "jpeg", "png", "webp", "gif"].includes(at))
        return at === "jpeg" ? "jpg" : at;
      const ext = u.pathname.split(".").pop().toLowerCase();
      if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext))
        return ext === "jpeg" ? "jpg" : ext;
    } catch (_) {}
    return "jpg";
  }

  function basenameFromUrl(url) {
    try {
      const u = new URL(url, location.href);
      return (u.pathname.split("/").pop() || "")
        .split("@")[0]
        .replace(/\.(jpe?g|png|webp|gif)$/i, "");
    } catch (_) {
      return "";
    }
  }

  // ---- X / TWITTER ----------------------------------------------------------
  const X_EXTRACTOR = {
    id: "x",
    test(loc) {
      return /(^|\.)x\.com$/.test(loc.hostname) || /(^|\.)twitter\.com$/.test(loc.hostname);
    },
    extract(img) {
      const article = img.closest("article") || document;

      let poster = "";
      let handle = "";
      const userName = article.querySelector('[data-testid="User-Name"]');
      if (userName) {
        const handleEl = [...userName.querySelectorAll("span")].find((s) =>
          s.textContent.trim().startsWith("@")
        );
        handle = handleEl ? handleEl.textContent.trim() : "";
        poster = userName.textContent.split("@")[0].trim();
      }
      if (!handle) {
        const a = article.querySelector('a[role="link"][href^="/"]');
        const seg = a && a.getAttribute("href").split("/").filter(Boolean)[0];
        if (seg && !["i", "home", "search", "explore"].includes(seg)) handle = "@" + seg;
      }

      const textEl = article.querySelector('[data-testid="tweetText"]');
      const caption = textEl ? textEl.textContent : "";

      const src = img.currentSrc || img.src || "";
      const idMatch = src.match(/\/media\/([A-Za-z0-9_-]+)/);

      return {
        poster,
        handle,
        artists: findArtistHandles(caption, handle).map((h) => "@" + h),
        tags: uniq(matchesAll(HASHTAG_RE, caption)),
        fallbackBase: idMatch ? idMatch[1] : basenameFromUrl(src),
        ext: extFromUrl(src),
      };
    },
  };

  // ---- BLUESKY --------------------------------------------------------------
  const BLUESKY_EXTRACTOR = {
    id: "bluesky",
    test(loc) {
      return /(^|\.)bsky\.app$/.test(loc.hostname);
    },
    extract(img) {
      const container =
        img.closest('[data-testid^="postThreadItem"]') ||
        img.closest('[role="link"]') ||
        img.closest("div[tabindex]") ||
        document;

      let poster = "";
      let handle = "";
      const profileLink = container.querySelector('a[href^="/profile/"]');
      if (profileLink) {
        const seg = profileLink.getAttribute("href").split("/").filter(Boolean);
        // Drop the ".bsky.social" suffix; keep custom-domain handles intact.
        if (seg[1]) handle = "@" + seg[1].replace(/\.bsky\.social$/i, "");
        poster = (profileLink.textContent || "").trim();
      }

      const textEl =
        container.querySelector('[data-testid="postText"]') ||
        container.querySelector('div[dir="auto"]');
      const caption = textEl ? textEl.textContent : "";

      const src = img.currentSrc || img.src || "";
      const cidMatch = src.match(/\/plain\/[^/]+\/([^/@?]+)@/);

      return {
        poster,
        handle,
        artists: findArtistHandles(caption, handle).map((h) => "@" + h),
        tags: uniq(matchesAll(HASHTAG_RE, caption)),
        fallbackBase: cidMatch ? cidMatch[1] : basenameFromUrl(src),
        ext: extFromUrl(src),
      };
    },
  };

  // ---- GENERIC (only reached if matched-site selectors above miss) ----------
  const GENERIC_EXTRACTOR = {
    id: "generic",
    test() {
      return true;
    },
    extract(img) {
      const src = img.currentSrc || img.src || "";
      const fig = img.closest("figure");
      const cap =
        (img.getAttribute("alt") || "").trim() ||
        (fig && fig.querySelector("figcaption")
          ? fig.querySelector("figcaption").textContent.trim()
          : "");
      return {
        poster: "",
        handle: "",
        artists: [],
        tags: uniq(matchesAll(HASHTAG_RE, cap)),
        fallbackBase: basenameFromUrl(src),
        ext: extFromUrl(src),
      };
    },
  };

  window.SIS_EXTRACTORS = [X_EXTRACTOR, BLUESKY_EXTRACTOR, GENERIC_EXTRACTOR];
})();
