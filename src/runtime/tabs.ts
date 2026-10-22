// The tabs in the left pane: Problem, an optional Analogy, and Code. The first visit to an algorithm opens
// on Problem; after that the page remembers the last tab per algorithm. ← and → are left alone: they step
// the player.

/** A tab's name, from its data-tab attribute: "problem", "analogy" or "code". */
export type Tab = string;

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
  const names = buttons.map(b => b.dataset.tab!);
  let active: Tab = "problem";

  function show(tab: Tab, remember = true) {
    active = tab;
    for (const b of buttons) {
      // Every tab stays in the Tab order: arrow-key tab switching would clash with the player's ← and →.
      b.setAttribute("aria-selected", String(b.dataset.tab === tab));
    }
    for (const p of panels) p.hidden = p.dataset.tabPanel !== tab;
    if (remember) {
      try { storage?.setItem(key, tab); } catch { /* can't remember it; that's fine */ }
    }
  }

  for (const b of buttons) b.onclick = () => show(b.dataset.tab!);

  let saved: string | null = null;
  try { saved = storage?.getItem(key) ?? null; } catch { /* first visit, as far as we can tell */ }
  // A saved tab this page doesn't have (e.g. an Analogy removed since) falls back to Problem.
  show(saved && names.includes(saved) ? saved : "problem", false);

  return { show: tab => show(tab), current: () => active };
}
