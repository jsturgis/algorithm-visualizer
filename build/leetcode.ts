// Imports a LeetCode problem as the start of a package spec: `npm run new -- --leetcode <url>`.
//
// fetchLeetCode() is the only part that talks to leetcode.com, through its GraphQL API. Without a login it reads the
// problem (statement, examples, constraints, signature, tags), free editorials, and playgrounds. With a session
// (LEETCODE_SESSION) it also reads premium editorials and explore cards, whose articles hold the JavaScript solutions.
// fromLeetCode() turns the response into a spec, and is pure so it can be tested on recorded responses.
import { PARAM_TYPES, tsType, type Input, type Param, type ParamType, type ReturnType } from "../src/runtime/types.ts";
import type { PackageSpec } from "./scaffold.ts";

export interface LeetCodeQuestion {
  questionFrontendId: string;
  title: string;
  titleSlug: string;
  content: string | null;
  isPaidOnly: boolean;
  metaData: string;
  topicTags: { name: string }[];
  solution: { content: string | null; paidOnly: boolean } | null;
}

/** Everything fromLeetCode() needs. */
export interface LeetCodeData {
  question: LeetCodeQuestion;
  /** Code of every playground below, by UUID. */
  playgrounds: Record<string, { langSlug: string; code: string }[]>;
  /** Explore-card articles (or single playgrounds) to look for solutions in, besides the editorial. */
  articles?: { title: string; playgrounds: string[] }[];
}

export type LeetCodeUrl =
  | { kind: "problem"; slug: string }
  | { kind: "explore"; card: string; chapter: string; item: string }
  | { kind: "playground"; uuid: string };

/** What a LeetCode link points at: a problem, a page of an explore card, or a playground. A bare slug is a problem. */
export function parseLeetCodeUrl(url: string): LeetCodeUrl {
  const u = url.trim();
  const host = String.raw`^(?:https?:\/\/)?(?:www\.)?leetcode\.com\/`;
  let m = u.match(new RegExp(host + String.raw`problems\/([a-z0-9-]+)`)) ?? u.match(/^([a-z0-9]+(?:-[a-z0-9]+)*)$/);
  if (m) return { kind: "problem", slug: m[1] };
  m = u.match(new RegExp(host + String.raw`explore\/[\w-]+\/card\/([\w-]+)\/(\d+)\/(?:[\w-]+\/)?(\d+)`));
  if (m) return { kind: "explore", card: m[1], chapter: m[2], item: m[3] };
  m = u.match(new RegExp(host + String.raw`playground\/(\w+)`));
  if (m) return { kind: "playground", uuid: m[1] };
  throw new Error(`${url} isn't a LeetCode problem, explore card or playground link`);
}

/** UUIDs of the playgrounds a page embeds (`<iframe src="https://leetcode.com/playground/<uuid>/shared">`). */
export const playgroundIds = (html: string) => [...new Set([...html.matchAll(/playground\/(\w+)\/shared/g)].map(m => m[1]))];

const API = "https://leetcode.com/graphql";
const QUESTION = `query q($titleSlug: String!) {
  question(titleSlug: $titleSlug) {
    questionFrontendId title titleSlug content isPaidOnly metaData topicTags { name }
    solution { content paidOnly }
  }
}`;
const PLAYGROUND = `query q($uuid: String!) { allPlaygroundCodes(uuid: $uuid) { langSlug code } }`;
const ITEM = `query q($id: String!) { item(id: $id) { id title type question { titleSlug } article { body } } }`;
const CARD = `query q($slug: String!) { card(cardSlug: $slug) { chapters { id items { id title type } } } }`;

interface Item { id: string; title: string; type: number; question: { titleSlug: string } | null; article: { body: string } | null }

export interface LeetCodeOptions {
  /** The LEETCODE_SESSION cookie from a signed-in browser: unlocks premium editorials and explore cards. */
  session?: string;
}

export async function fetchLeetCode(url: string, extra: string[] = [], { session }: LeetCodeOptions = {}): Promise<LeetCodeData> {
  async function graphql<T>(query: string, variables: Record<string, string>): Promise<T> {
    const res = await fetch(API, {
      method: "POST",
      headers: { "content-type": "application/json", referer: "https://leetcode.com", ...(session ? { cookie: `LEETCODE_SESSION=${session}` } : {}) },
      body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) throw new Error(`leetcode.com answered ${res.status} ${res.statusText}`);
    const body = (await res.json()) as { data?: T; errors?: { message: string }[] };
    if (body.errors?.length) throw new Error(`leetcode.com: ${body.errors.map(e => e.message).join("; ")}`);
    return body.data!;
  }
  const item = async (id: string) => {
    const { item } = await graphql<{ item: Item | null }>(ITEM, { id });
    if (!item) {
      throw new Error(session
        ? `LeetCode won't show explore item ${id} to this account`
        : "Explore cards need a login: put your leetcode.com LEETCODE_SESSION cookie in .env (see npm run new -- --help)");
    }
    return item;
  };

  const articles: NonNullable<LeetCodeData["articles"]> = [];
  const link = parseLeetCodeUrl(url);
  let slug: string;
  if (link.kind === "problem") slug = link.slug;
  else if (link.kind === "explore") {
    const it = await item(link.item);
    if (!it.question) throw new Error(`"${it.title}" is an explore article, not a problem. Give the problem's page in the card.`);
    slug = it.question.titleSlug;
    // The card teaches each problem in the chapter's articles, so look for its solutions there.
    const { card } = await graphql<{ card: { chapters: { id: string; items: { id: string; type: number }[] }[] } | null }>(CARD, { slug: link.card });
    const chapter = card?.chapters.find(c => c.id === link.chapter);
    for (const a of chapter?.items.filter(i => !i.type) ?? []) {
      const art = await item(a.id);
      articles.push({ title: art.title, playgrounds: playgroundIds(art.article?.body ?? "") });
    }
  } else throw new Error(`${url} is a playground. Give the problem's link first, and the playground after it.`);

  for (const e of extra) {
    const x = parseLeetCodeUrl(e);
    if (x.kind === "playground") articles.push({ title: `Playground ${x.uuid}`, playgrounds: [x.uuid] });
    else if (x.kind === "explore") {
      const art = await item(x.item);
      articles.push({ title: art.title, playgrounds: playgroundIds(art.article?.body ?? "") });
    } else throw new Error(`${e} is a problem link; only playgrounds and explore articles go here`);
  }

  const { question } = await graphql<{ question: LeetCodeQuestion | null }>(QUESTION, { titleSlug: slug });
  if (!question) throw new Error(`LeetCode has no problem called "${slug}"`);
  const playgrounds: LeetCodeData["playgrounds"] = {};
  for (const uuid of new Set([...playgroundIds(question.solution?.content ?? ""), ...articles.flatMap(a => a.playgrounds)])) {
    playgrounds[uuid] = (await graphql<{ allPlaygroundCodes: { langSlug: string; code: string }[] }>(PLAYGROUND, { uuid })).allPlaygroundCodes;
  }
  return { question, playgrounds, articles };
}

const TYPES: Record<string, { type: ReturnType; inner_length?: [number, number] }> = {
  integer: { type: "int" }, long: { type: "int" }, double: { type: "float" }, boolean: { type: "bool" },
  string: { type: "string" }, character: { type: "string", },
  "integer[]": { type: "int[]" }, "long[]": { type: "int[]" }, "list<integer>": { type: "int[]" },
  "integer[][]": { type: "int[][]" }, "list<list<integer>>": { type: "int[][]" },
  "string[]": { type: "string[]" }, "list<string>": { type: "string[]" },
  "character[]": { type: "string[]", inner_length: [1, 1] },
  "boolean[]": { type: "bool[]" }, "list<boolean>": { type: "bool[]" },
};

function typeOf(lc: string, what: string) {
  if (lc === "void") throw new Error(`${what} returns nothing (it changes its input in place), which packages don't support yet`);
  const t = TYPES[lc.toLowerCase()];
  if (!t) throw new Error(`${what} has type ${lc}, which packages don't support yet`);
  return t;
}

const ENTITIES: Record<string, string> = { lt: "<", gt: ">", amp: "&", quot: '"', nbsp: " ", "#39": "'", le: "≤", ge: "≥" };
const decode = (s: string) => s.replace(/&(\w+|#\d+);/g, (m, e: string) => ENTITIES[e] ?? (e.startsWith("#") ? String.fromCharCode(+e.slice(1)) : m));
/** Plain text: tags removed, `<sup>5</sup>` as `^5`, entities decoded. */
const plain = (html: string) => decode(html.replace(/<sup>(.*?)<\/sup>/g, "^$1").replace(/<[^>]+>/g, ""));

/** "10^4", "2 * 10^5", "-10^9", "100" → number. */
function num(text: string): number | undefined {
  const m = text.replace(/\s+/g, "").match(/^(-?)(?:(\d+)\*)?(\d+)(?:\^(\d+))?$/);
  if (!m) return undefined;
  const value = (m[2] ? +m[2] : 1) * (m[4] ? (+m[3]) ** +m[4] : +m[3]);
  return m[1] ? -value : value;
}

interface Limit { subject: string; range: [number, number] }

/** `1 <= nums.length <= 10^4` and `-10^4 < nums[i], target < 10^4` → one limit per subject. */
function limitsIn(text: string): Limit[] | undefined {
  const NUM = String.raw`-?\s*(?:\d+\s*\*\s*)?\d+(?:\^\d+)?`;
  const range = text.match(new RegExp(String.raw`^\s*(${NUM})\s*(<=|<|≤)\s*(.+?)\s*(<=|<|≤)\s*(${NUM})\s*\.?\s*$`));
  if (range) {
    const lo = num(range[1]), hi = num(range[5]);
    if (lo === undefined || hi === undefined) return undefined;
    const r: [number, number] = [range[2] === "<" ? lo + 1 : lo, range[4] === "<" ? hi - 1 : hi];
    return range[3].split(",").map(s => ({ subject: s.trim(), range: r }));
  }
  const eq = text.match(new RegExp(String.raw`^\s*(.+?)\s*==?\s*(${NUM})\s*\.?\s*$`));
  const n = eq ? num(eq[2]) : undefined;
  return eq && n !== undefined ? [{ subject: eq[1].trim(), range: [n, n] }] : undefined;
}

const CHAR_CLASSES: [RegExp, string][] = [
  [/lowercase and uppercase|uppercase and lowercase/i, "[a-zA-Z]"],
  [/lowercase/i, "[a-z]"],
  [/uppercase/i, "[A-Z]"],
  [/English letters/i, "[a-zA-Z]"],
  [/digits/i, "[0-9]"],
];

/** Applies the constraint list items to the params. Returns the items it couldn't read. */
function applyConstraints(items: string[], params: Param[]): string[] {
  const byName = new Map(params.map(p => [p.name, p]));
  const alias = new Map<string, string>();
  const unread: string[] = [];
  for (const item of items) {
    const text = plain(item).trim();
    const al = text.match(/^(\w+)\s*==\s*(\w+(?:\[i\])?\.length)$/);
    if (al) { alias.set(al[1], al[2]); continue; }
    const named = [...item.matchAll(/<code>(\w+)<\/code>/g)].map(m => m[1]).filter(n => byName.has(n));
    const cls = CHAR_CLASSES.find(([re]) => re.test(text));
    if (cls && /consists? (only )?of|is either|are either/.test(text) && named.length) {
      for (const n of named) if (byName.get(n)!.type.startsWith("string")) byName.get(n)!.chars = cls[1];
      continue;
    }
    const quoted = text.match(/is either '(.)' or '(.)'/);
    if (quoted && named.length) {
      for (const n of named) byName.get(n)!.chars = `[${quoted[1]}${quoted[2]}]`;
      continue;
    }
    const limits = limitsIn(text);
    if (!limits || !limits.every(l => apply(alias.get(l.subject) ?? l.subject, l.range))) unread.push(text);
  }
  return unread;

  function apply(subject: string, range: [number, number]): boolean {
    const m = subject.match(/^(\w+)((?:\[\w\])*)(\.length)?$/);
    const p = m && byName.get(m[1]);
    if (!p) return false;
    const depth = m[2] ? m[2].length / 3 : 0, isLength = !!m[3];
    const field = isLength ? (depth === 0 ? "length" : "inner_length") : "value";
    if (field === "value" && !p.type.startsWith("int")) return false;
    if (field === "inner_length" && p.type !== "int[][]" && p.type !== "string[]") return false;
    p[field] = range;
    return true;
  }
}

/** The values in "nums = [-1,0,3], target = 9", split at each parameter name. */
function parseInput(text: string, params: Param[]): Input | undefined {
  const input: Input = {};
  const starts = params.map(p => ({ p, at: text.search(new RegExp(String.raw`(^|[\s,])${p.name}\s*=`)) }));
  if (starts.some(s => s.at < 0)) return undefined;
  starts.sort((a, b) => a.at - b.at);
  try {
    starts.forEach(({ p, at }, i) => {
      const from = text.indexOf("=", at) + 1;
      input[p.name] = JSON.parse(text.slice(from, starts[i + 1]?.at ?? text.length).trim().replace(/,$/, ""));
    });
  } catch { return undefined; }
  return input;
}

function examples(content: string, params: Param[]) {
  const text = plain(content);
  const out: { input: Input; answer: unknown }[] = [];
  for (const m of text.matchAll(/Input:?\s*([\s\S]*?)\n?\s*Output:?\s*(.+)/g)) {
    const input = parseInput(m[1].trim(), params);
    let answer: unknown;
    try { answer = JSON.parse(m[2].trim()); } catch { continue; }
    if (input) out.push({ input, answer });
  }
  return out;
}

/** LeetCode's HTML statement (before the examples) as Markdown. */
function markdown(html: string) {
  return decode(html
    .replace(/<img[^>]*>/g, "")
    .replace(/<sup>(.*?)<\/sup>/g, "^$1")
    .replace(/<code>(.*?)<\/code>/g, "`$1`")
    .replace(/<(strong|b)>(.*?)<\/\1>/g, "**$2**")
    .replace(/<(em|i)>(.*?)<\/\1>/g, "*$2*")
    .replace(/<a [^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/g, "[$2]($1)")
    .replace(/<li>\s*/g, "- ")
    .replace(/<\/(p|li|ul|ol|pre)>/g, "\n")
    .replace(/<[^>]+>/g, ""))
    .replace(/\*\*\s*\*\*/g, "")
    .split("\n").map(l => l.trim()).join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^(- .*)\n\n(?=- )/gm, "$1\n")
    .trim();
}

/** One way to solve the problem: an editorial approach, or a playground's code. */
export interface Solution {
  title: string;
  /** LeetCode's language slug for `code`, e.g. "javascript" or "python3". */
  language: string;
  code: string;
  /** `code` as the package's accepted solution, when it could be converted (from JavaScript or TypeScript). */
  typescript?: string;
  complexity?: { time: string; space: string };
  /** The editorial's "Algorithm" section, as Markdown. */
  explanation?: string;
}

export interface LeetCodeImport {
  spec: PackageSpec;
  solutions: Solution[];
  /** Things the import couldn't do, and how to fix them. */
  notes: string[];
}

/** Languages to take a playground's code in, best first. JavaScript and TypeScript can be converted. */
const LANGUAGES = ["typescript", "javascript", "python3", "python", "java", "cpp"];

/** Editorial Markdown/LaTeX as plain Markdown: `$$O(\log n)$$` → `O(log n)`, images, iframes and HTML dropped. */
const tidy = (md: string) => md
  .replace(/\$\$(.*?)\$\$/g, (_, tex: string) => tex.replace(/\\(log|cdot|times|le|ge)\b/g, (_m, c: string) => ({ log: "log", cdot: "·", times: "×", le: "≤", ge: "≥" })[c]!).replace(/\\/g, ""))
  .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
  .replace(/<[^>]+>/g, "")
  .replace(/\n{3,}/g, "\n\n")
  .trim();

const section = (md: string, heading: string) => md.split(/^#### /m).find(s => s.startsWith(heading))?.slice(heading.length).trim();

/** JavaScript (or TypeScript) playground code → an exported, typed TypeScript entry function. */
function toTypeScript(code: string, language: string, entry: string, input: Param[], returns: ReturnType): string | undefined {
  if (language === "typescript") return /function\s/.test(code) ? code.trim() : undefined;
  const src = code.replace(/\r\n/g, "\n").replace(/\/\*\*[\s\S]*?\*\/\s*/g, "").trim();
  const head = src.match(/^(?:var|let|const)\s+(\w+)\s*=\s*function\s*\(([^)]*)\)\s*\{|^function\s+(\w+)\s*\(([^)]*)\)\s*\{/);
  if (!head || (head[1] ?? head[3]) !== entry) return undefined;
  const sig = `export function ${entry}(${input.map(p => `${p.name}: ${tsType(p.type)}`).join(", ")}): ${tsType(returns)} {`;
  return (sig + src.slice(head[0].length)).replace(/\};?\s*$/, "}").replace(/[ \t]+$/gm, "");
}

/** The editorial's approaches, then any other playground (e.g. one from an explore card). */
function solutionsOf({ question, playgrounds, articles }: LeetCodeData, entry: string, input: Param[], returns: ReturnType): Solution[] {
  const pick = (uuid: string) => {
    const codes = playgrounds[uuid] ?? [];
    return LANGUAGES.map(l => codes.find(c => c.langSlug === l)).find(c => c);
  };
  const out: Solution[] = [];
  const seen = new Set<string>();
  const add = (uuid: string, title: string, extra: Partial<Solution> = {}) => {
    seen.add(uuid);
    const c = pick(uuid);
    if (!c) return;
    const typescript = toTypeScript(c.code, c.langSlug, entry, input, returns);
    out.push({ title, language: c.langSlug, code: c.code, ...(typescript ? { typescript } : {}), ...extra });
  };

  for (const approach of (question.solution?.content ?? "").split(/^### /m).filter(s => /^Approach/.test(s))) {
    const title = approach.split("\n")[0].trim();
    const analysis = section(approach, "Complexity Analysis") ?? "";
    const time = analysis.match(/Time complexity\s*:\s*(.+)/i)?.[1], space = analysis.match(/Space complexity\s*:\s*(.+)/i)?.[1];
    const algorithm = section(approach, "Algorithm");
    const extra: Partial<Solution> = {
      ...(time && space ? { complexity: { time: tidy(time), space: tidy(space) } } : {}),
      ...(algorithm ? { explanation: tidy(algorithm) } : {}),
    };
    const ids = playgroundIds(approach);
    ids.forEach((uuid, i) => add(uuid, ids.length > 1 ? `${title} (${i + 1})` : title, extra));
  }
  // An explore article can teach several problems: keep its playgrounds that define this problem's function.
  const solves = (uuid: string) => (playgrounds[uuid] ?? []).some(c => new RegExp(String.raw`\b${entry}\b`).test(c.code));
  for (const article of articles ?? []) {
    const ids = article.playgrounds.filter(uuid => !seen.has(uuid));
    ids.forEach(uuid => seen.add(uuid));
    const mine = ids.filter(solves);
    mine.forEach((uuid, i) => add(uuid, mine.length > 1 ? `${article.title} (${i + 1})` : article.title));
  }
  for (const uuid of Object.keys(playgrounds)) if (!seen.has(uuid)) add(uuid, `Playground ${uuid}`);
  return out;
}

export function fromLeetCode(data: LeetCodeData): LeetCodeImport {
  const { question } = data;
  if (question.isPaidOnly || !question.content) throw new Error(`${question.title} is a premium problem, so its statement can't be read`);
  const meta = JSON.parse(question.metaData) as { name: string; params: { name: string; type: string }[]; return: { type: string } };
  const input: Param[] = meta.params.map(p => {
    const t = typeOf(p.type, `parameter ${p.name}`);
    if (!(PARAM_TYPES as readonly string[]).includes(t.type)) throw new Error(`parameter ${p.name} has type ${p.type}, which packages don't take as input`);
    return { name: p.name, type: t.type as ParamType, ...(t.inner_length ? { inner_length: t.inner_length } : {}) };
  });
  const returns = typeOf(meta.return.type, meta.name).type;

  const content = question.content;
  const exampleAt = content.search(/<strong[^>]*>Example 1/);
  const constraintsAt = content.search(/<strong[^>]*>Constraints/);
  const items = constraintsAt < 0 ? [] : [...content.slice(constraintsAt).split(/<\/ul>/)[0].matchAll(/<li>([\s\S]*?)<\/li>/g)].map(m => m[1]);
  const unread = applyConstraints(items, input);

  const notes = question.solution?.paidOnly && !question.solution.content
    ? ["The editorial is premium: put your leetcode.com LEETCODE_SESSION cookie in .env to import it (see npm run new -- --help)."]
    : [];
  return {
    notes,
    solutions: solutionsOf(data, meta.name, input, returns),
    spec: {
      slug: question.titleSlug,
      title: question.title,
      source: `LeetCode ${question.questionFrontendId}`,
      tags: question.topicTags.map(t => t.name),
      entry: meta.name,
      input,
      returns,
      statement: markdown(exampleAt < 0 ? content : content.slice(0, exampleAt)),
      samples: examples(content.slice(Math.max(exampleAt, 0), constraintsAt < 0 ? undefined : constraintsAt), input),
      constraints_note: unread,
    },
  };
}
