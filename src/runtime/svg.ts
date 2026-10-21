const NS = "http://www.w3.org/2000/svg";

/** Create an SVG element with attributes (and optional text) and append it to `parent`. */
export function svgEl<K extends keyof SVGElementTagNameMap>(
  tag: K, attrs: Record<string, string | number>, parent?: Element, text?: string | number,
): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, String(attrs[k]));
  if (text != null) e.textContent = String(text);
  parent?.appendChild(e);
  return e;
}
