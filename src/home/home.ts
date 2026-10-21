// Home page: a card per algorithm package, with search and tag filters.
import "../styles/base.css";
import "./home.css";
import algorithms from "virtual:algorithms";
import { esc } from "../runtime/player.ts";

export function mountHome(doc: Document = document) {
  const byId = (id: string) => doc.getElementById(id)!;
  const list = [...algorithms].sort((a, b) => a.title.localeCompare(b.title));
  const tags = [...new Set(list.flatMap(a => a.tags))].sort();
  let active = "All";

  const chips = byId("chips");
  chips.innerHTML = ["All", ...tags].map(t =>
    `<button type="button" class="chip" data-tag="${esc(t)}" aria-pressed="${t === active}">${esc(t)}</button>`).join("");
  chips.onclick = e => {
    const b = (e.target as HTMLElement).closest("button");
    if (!b) return;
    active = b.dataset.tag!;
    chips.querySelectorAll("button").forEach(c => c.setAttribute("aria-pressed", String(c === b)));
    draw();
  };

  const q = byId("q") as HTMLInputElement;
  q.oninput = draw;

  function draw() {
    const term = q.value.trim().toLowerCase();
    const shown = list.filter(a =>
      (active === "All" || a.tags.includes(active)) &&
      (!term || [a.title, a.summary, ...a.tags].join(" ").toLowerCase().includes(term)));
    byId("count").textContent = `${shown.length} of ${list.length} algorithms`;
    byId("cards").innerHTML = shown.length ? shown.map(a => `
      <a class="panel card" href="algorithms/${esc(a.slug)}/">
        <h2>${esc(a.title)}</h2>
        <p>${esc(a.summary)}</p>
        <div class="meta">${a.tags.map(t => `<span class="tag">${esc(t)}</span>`).join("")}
          <span class="tag mono">${esc(a.complexity.time)}</span></div>
      </a>`).join("") : `<p class="empty">No algorithms match that search.</p>`;
  }
  draw();
}

if (document.getElementById("cards")) mountHome();
