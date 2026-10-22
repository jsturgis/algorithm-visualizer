// The Problem / Code tabs in the left pane. The first visit to an algorithm opens on Problem; after that
// the page remembers the last tab per algorithm. ← and → are left alone: they step the player.

export type Tab = "problem" | "code";

export interface TabsOptions {
  doc: Document;
  slug: string;
  /** Where the last tab is remembered. null, or a Storage that throws, means it isn't. */
  storage: Storage | null;
}

export interface Tabs {
  show(tab: Tab): void;
  current(): Tab;
}

export function attachTabs({ doc, slug, storage }: TabsOptions): Tabs {
  const key = `algorithm-visualizer:tab:${slug}`;
  const buttons = [...doc.querySelectorAll<HTMLButtonElement>("[data-tab]")];
  const panels = [...doc.querySelectorAll<HTMLElement>("[data-tab-panel]")];
  let active: Tab = "problem";

  function show(tab: Tab, remember = true) {
    active = tab;
    for (const b of buttons) {
      const on = b.dataset.tab === tab;
      // Both tabs stay in the Tab order: arrow-key tab switching would clash with the player's ← and →.
      b.setAttribute("aria-selected", String(on));
    }
    for (const p of panels) p.hidden = p.dataset.tabPanel !== tab;
    if (remember) {
      try { storage?.setItem(key, tab); } catch { /* can't remember it; that's fine */ }
    }
  }

  for (const b of buttons) b.onclick = () => show(b.dataset.tab as Tab);

  let saved: string | null = null;
  try { saved = storage?.getItem(key) ?? null; } catch { /* first visit, as far as we can tell */ }
  show(saved === "code" ? "code" : "problem", false);

  return { show: tab => show(tab), current: () => active };
}
