/* =============================================================================
 * background.js  —  Chromium MV3 service worker
 *
 * Right-click an image on a supported site → "Save Image w Custom Filename"
 * submenu. Picks a smart filename from the post (poster/handle/artist/tags,
 * symbols stripped) and saves via downloads.download({ saveAs:true }), which
 * shows an editable filename field pre-filled with that name.
 *
 * Format handling (the webp problem): the served URL can LIE about the format
 * (Bluesky serves webp under a "...@jpeg" URL via content negotiation), so we
 * fetch the bytes and sniff the magic number instead of trusting the extension.
 *   - Auto:  webp → PNG, everything else kept as-is.
 *   - Force PNG / Force JPEG: re-encode via OffscreenCanvas.
 *   - Keep original: saved untouched, with a corrected extension.
 * Conversion needs read access to the image CDNs (see host_permissions).
 * ========================================================================== */

"use strict";

const ext = globalThis.browser ?? globalThis.chrome;

const MENU = {
  parent: "sis_parent",
  keep: "sis_keep",
  jpg: "sis_jpg",
  png: "sis_png",
};

const SITE_PATTERNS = [
  "https://x.com/*",
  "https://twitter.com/*",
  "https://bsky.app/*",
];

// ---- menu ------------------------------------------------------------------

function buildMenu() {
  ext.contextMenus.removeAll(() => {
    ext.contextMenus.create({
      id: MENU.parent,
      title: "Save Image w Custom Filename",
      contexts: ["image"],
      documentUrlPatterns: SITE_PATTERNS,
    });
    const child = (id, title) =>
      ext.contextMenus.create({
        id,
        parentId: MENU.parent,
        title,
        contexts: ["image"],
        documentUrlPatterns: SITE_PATTERNS,
      });
    child(MENU.keep, "Keep original format");
    child(MENU.jpg, "Force JPG");
    child(MENU.png, "Force PNG");
  });
}

ext.runtime.onInstalled.addListener(buildMenu);
ext.runtime.onStartup && ext.runtime.onStartup.addListener(buildMenu);

// ---- click -----------------------------------------------------------------

ext.contextMenus.onClicked.addListener(async (info, tab) => {
  if (![MENU.keep, MENU.jpg, MENU.png].includes(info.menuItemId)) return;
  const srcUrl = info.srcUrl;
  if (!srcUrl || !tab) return;

  // Smart filename base from the content script (no extension yet).
  let base = "image";
  let urlExt = "jpg";
  try {
    const resp = await ext.tabs.sendMessage(
      tab.id,
      { type: "SIS_EXTRACT", srcUrl },
      info.frameId != null ? { frameId: info.frameId } : undefined
    );
    if (resp && resp.ok) {
      base = resp.base || base;
      urlExt = resp.urlExt || urlExt;
    }
  } catch (_) {
    base = basenameFromUrl(srcUrl) || base;
    urlExt = extFromUrl(srcUrl) || urlExt;
  }

  // Fetch the bytes once so we can sniff the REAL format (and convert if asked).
  let blob = null;
  let served = urlExt;
  try {
    blob = await (await fetch(srcUrl)).blob();
    served = (await sniffFormat(blob)) || extFromUrl(srcUrl) || urlExt;
  } catch (_) {
    /* couldn't read bytes (no CDN permission / network) — fall back below */
  }

  // Decide target format from the chosen menu item.
  let target;
  if (info.menuItemId === MENU.png) target = "png";
  else if (info.menuItemId === MENU.jpg) target = "jpg";
  else target = served; // keep original

  const canConvert =
    !!blob &&
    typeof OffscreenCanvas !== "undefined" &&
    typeof createImageBitmap === "function";
  const wantConvert = (target === "png" || target === "jpg") && target !== served;

  try {
    if (canConvert && wantConvert) {
      await saveConverted(blob, target, `${base}.${target}`, srcUrl);
    } else {
      // No conversion: keep the original bytes; name with the real format.
      await ext.downloads.download({
        url: srcUrl,
        filename: `${base}.${served}`,
        saveAs: true,
      });
    }
  } catch (err) {
    console.error("[Smart Image Saver] save failed:", err);
    try {
      await ext.downloads.download({ url: srcUrl, saveAs: true });
    } catch (_) {}
  }
});

// ---- conversion ------------------------------------------------------------

async function saveConverted(blob, fmt, filename, srcFallbackUrl) {
  try {
    const bmp = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(bmp.width, bmp.height);
    const ctx = canvas.getContext("2d");
    if (fmt === "jpg") {
      // JPEG has no alpha; flatten transparency onto white instead of black.
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(bmp, 0, 0);
    const mime = fmt === "png" ? "image/png" : "image/jpeg";
    const out = await canvas.convertToBlob(
      fmt === "png" ? { type: mime } : { type: mime, quality: 0.95 }
    );
    const dataUrl = await blobToDataURL(out);
    await ext.downloads.download({ url: dataUrl, filename, saveAs: true });
  } catch (err) {
    console.error("[Smart Image Saver] convert failed, saving original:", err);
    await ext.downloads.download({ url: srcFallbackUrl, saveAs: true });
  }
}

// ---- helpers ---------------------------------------------------------------

// Read the first bytes and identify the real format. Beats trusting the URL,
// which Bluesky mislabels (webp served under "...@jpeg").
async function sniffFormat(blob) {
  const b = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
  if (b.length < 12) return null;
  // RIFF????WEBP
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "webp";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return "gif";
  return null;
}

function extFromUrl(url) {
  try {
    const u = new URL(url);
    const q = (u.searchParams.get("format") || "").toLowerCase();
    if (q) return q === "jpeg" ? "jpg" : q;
    const at = u.pathname.split("@").pop().toLowerCase();
    if (["jpg", "jpeg", "png", "webp", "gif"].includes(at)) return at === "jpeg" ? "jpg" : at;
    const ex = u.pathname.split(".").pop().toLowerCase();
    if (["jpg", "jpeg", "png", "webp", "gif"].includes(ex)) return ex === "jpeg" ? "jpg" : ex;
  } catch (_) {}
  return "jpg";
}

function basenameFromUrl(url) {
  try {
    return (new URL(url).pathname.split("/").pop() || "")
      .split("@")[0]
      .replace(/\.(jpe?g|png|webp|gif)$/i, "")
      .replace(/[\\/:*?"<>|\u0000-\u001f@#]/g, "");
  } catch (_) {
    return "";
  }
}

// arrayBuffer → base64 data URL (service workers have no URL.createObjectURL).
async function blobToDataURL(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return `data:${blob.type};base64,${btoa(binary)}`;
}
