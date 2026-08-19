/**
 * Rolling in-memory image budget for the storefront.
 *
 * The browser owns the HTTP cache — we never try to purge it. What we *can* control is
 * how many image resources this app keeps referenced (mounted <img> elements and
 * preloaded Image objects). This module accounts for the decoded footprint of those
 * references and, once the rolling budget is exceeded, drops the least-recently-used
 * offscreen ones and stops preloading.
 */

/** ~50 MB of decoded image footprint for storefront imagery. */
export const IMAGE_BUDGET_BYTES = 50 * 1024 * 1024;
/** Preloading pauses above this fraction of the budget. */
const PRELOAD_CEILING = 0.8;

interface Entry {
  url: string;
  /** Estimated decoded bytes (w * h * 4). Falls back to a conservative guess. */
  bytes: number;
  /** Mounted <img> elements referencing this URL. */
  refs: number;
  /** Whether any referencing element is currently near/inside the viewport. */
  visible: number;
  lastUsed: number;
  /** Held only for preloaded (not yet mounted) images so the decode survives. */
  preloaded?: HTMLImageElement;
}

const entries = new Map<string, Entry>();
let usage = 0;
let clock = 0;

const DEFAULT_BYTES = 400 * 500 * 4; // ~800 KB decoded guess for a card image

function entryFor(url: string): Entry {
  let e = entries.get(url);
  if (!e) {
    e = { url, bytes: 0, refs: 0, visible: 0, lastUsed: ++clock };
    entries.set(url, e);
  }
  e.lastUsed = ++clock;
  return e;
}

function account(e: Entry, bytes: number) {
  usage += bytes - e.bytes;
  e.bytes = bytes;
}

function drop(e: Entry) {
  if (e.preloaded) {
    e.preloaded.src = "";
    e.preloaded = undefined;
  }
  usage -= e.bytes;
  entries.delete(e.url);
}

/** Evict least-recently-used entries that nothing visible depends on. */
function enforceBudget() {
  if (usage <= IMAGE_BUDGET_BYTES) return;
  const candidates = [...entries.values()]
    .filter((e) => e.visible === 0)
    .sort((a, b) => a.lastUsed - b.lastUsed);
  for (const e of candidates) {
    if (usage <= IMAGE_BUDGET_BYTES * 0.9) break;
    // Mounted-but-offscreen entries only lose their preload handle; the element stays
    // valid and the browser may re-fetch from its own cache if it scrolls back.
    if (e.refs > 0) {
      if (!e.preloaded) continue;
      e.preloaded.src = "";
      e.preloaded = undefined;
      usage -= e.bytes;
      e.bytes = 0;
      continue;
    }
    drop(e);
  }
}

export const imageBudget = {
  /** A mounted element now references this URL. */
  retain(url: string) {
    if (!url) return;
    const e = entryFor(url);
    e.refs += 1;
    // A mounted element supersedes the preload handle.
    if (e.preloaded) {
      e.preloaded.src = "";
      e.preloaded = undefined;
    }
    if (e.bytes === 0) account(e, DEFAULT_BYTES);
  },

  /** The element unmounted (navigating away, virtualization, gallery teardown). */
  release(url: string) {
    if (!url) return;
    const e = entries.get(url);
    if (!e) return;
    e.refs = Math.max(0, e.refs - 1);
    if (e.refs === 0) {
      e.visible = 0;
      e.lastUsed = ++clock;
      if (usage > IMAGE_BUDGET_BYTES) enforceBudget();
    }
  },

  /** Record the real decoded size once the image reports its natural dimensions. */
  measured(url: string, width: number, height: number) {
    if (!url || !width || !height) return;
    const e = entryFor(url);
    account(e, Math.min(width * height * 4, 24 * 1024 * 1024));
    enforceBudget();
  },

  setVisible(url: string, visible: boolean) {
    if (!url) return;
    const e = entries.get(url);
    if (!e) return;
    e.visible = visible ? e.visible + 1 : Math.max(0, e.visible - 1);
    e.lastUsed = ++clock;
    if (!visible && usage > IMAGE_BUDGET_BYTES) enforceBudget();
  },

  /** True when there is room for speculative work. */
  canPreload() {
    return usage < IMAGE_BUDGET_BYTES * PRELOAD_CEILING;
  },

  /**
   * Warm a small window of upcoming images. No-ops when already known or over budget,
   * so rapid scrolling cannot pile up requests.
   */
  preload(urls: readonly string[]) {
    for (const url of urls) {
      if (!url) continue;
      if (entries.has(url)) {
        entries.get(url)!.lastUsed = ++clock;
        continue;
      }
      if (!this.canPreload()) return;
      const e = entryFor(url);
      const img = new Image();
      img.decoding = "async";
      img.loading = "eager";
      img.onload = () => {
        account(e, Math.min(img.naturalWidth * img.naturalHeight * 4, 24 * 1024 * 1024));
        enforceBudget();
      };
      img.onerror = () => {
        const cur = entries.get(url);
        if (cur && cur.refs === 0) drop(cur);
      };
      img.src = url;
      e.preloaded = img;
      account(e, DEFAULT_BYTES);
    }
  },

  /** Diagnostics only. */
  stats() {
    return { usage, budget: IMAGE_BUDGET_BYTES, tracked: entries.size };
  },
};
