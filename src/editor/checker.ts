// The code checker: TypeScript diagnostics, completions and hover info for a learner's solution,
// checked against the problem's contract (entry name, parameter types, return type).
//
// Pure: no DOM or worker APIs, so the same code runs in Node (verifier, tests) and in a browser worker.
// It uses the JavaScript-hosted TypeScript 6 ("typescript-js"): the repo's TypeScript 7 is native and
// can't run in a browser.
import ts from "typescript-js";
import { signatureOf, type Contract } from "../runtime/types.ts";

export type Category = "syntax" | "type" | "contract";

export interface Diagnostic {
  /** Offsets into the learner's source. */
  from: number;
  to: number;
  /** 1-based line and column of `from`. */
  line: number;
  column: number;
  message: string;
  severity: "error" | "warning";
  category: Category;
}

export interface Completion {
  label: string;
  /** TypeScript's element kind: "function", "method", "property", "parameter", "let", "keyword", ... */
  kind: string;
  sortText: string;
}

export interface Completions {
  /** Where the word being completed starts. */
  from: number;
  items: Completion[];
}

export interface HoverInfo {
  from: number;
  to: number;
  /** e.g. "(parameter) nums: number[]" */
  text: string;
  docs: string;
}

/** What the editor needs from a checker. Sync in-process; the async version is in transport.ts. */
export interface Checker {
  diagnostics(source: string): Diagnostic[];
  completions(source: string, offset: number): Completions | null;
  hover(source: string, offset: number): HoverInfo | null;
  /** The source as JavaScript (types removed), as a CommonJS function body. See the judge's compile step. */
  transpile(source: string): string;
}

/** The options that matter for what a solution may contain; they mirror the repo's tsconfig. */
export const COMPILER_OPTIONS: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2023,
  module: ts.ModuleKind.ESNext,
  lib: ["lib.es2023.d.ts"],
  types: [],
  strict: true,
  erasableSyntaxOnly: true,
  noEmit: true,
  skipLibCheck: true,
  moduleDetection: ts.ModuleDetectionKind.Force,
};

const FILE = "/solution.ts";
const LIB_DIR = "/lib/";
const CHECK = "__contract__";

/**
 * Appended (unseen) to the learner's code. It assigns the entry function to the expected function type,
 * so a missing function, a renamed one or a mismatched signature becomes an error inside this suffix.
 */
function contractSuffix(c: Contract) {
  const params = c.params.map(p => `${p.name}: ${p.type}`).join(", ");
  return `\n;const ${CHECK}: (${params}) => ${c.returns} = ${c.entry};\nexport {};\n`;
}

// TypeScript's hints about compiler options don't apply on the page, where the options are fixed.
const flatten = (m: string | ts.DiagnosticMessageChain) => ts.flattenDiagnosticMessageText(m, "\n")
  .replace(/ Do you need to change your target library\?.*$/gm, "")
  .replace(/ Try changing the '\w+' compiler option.*$/gm, "");

export function createChecker(contract: Contract, libs: Record<string, string>): Checker {
  const suffix = contractSuffix(contract);
  let source = "";
  let version = 0;
  const text = () => source + suffix;

  const host: ts.LanguageServiceHost = {
    getCompilationSettings: () => COMPILER_OPTIONS,
    getScriptFileNames: () => [FILE],
    getScriptVersion: f => (f === FILE ? String(version) : "1"),
    getScriptSnapshot: f => {
      if (f === FILE) return ts.ScriptSnapshot.fromString(text());
      const lib = f.startsWith(LIB_DIR) && libs[f.slice(LIB_DIR.length)];
      return lib ? ts.ScriptSnapshot.fromString(lib) : undefined;
    },
    getCurrentDirectory: () => "/",
    getDefaultLibFileName: o => LIB_DIR + ts.getDefaultLibFileName(o),
    fileExists: f => f === FILE || (f.startsWith(LIB_DIR) && f.slice(LIB_DIR.length) in libs),
    readFile: f => (f === FILE ? text() : f.startsWith(LIB_DIR) ? libs[f.slice(LIB_DIR.length)] : undefined),
  };
  const service = ts.createLanguageService(host, ts.createDocumentRegistry());

  const update = (s: string) => {
    if (s !== source) { source = s; version++; }
  };

  // The line where the entry function is declared (a function or a const), for contract errors.
  function entryOffset(): number | null {
    const sf = service.getProgram()?.getSourceFile(FILE);
    let found: number | null = null;
    sf?.forEachChild(node => {
      if (found !== null || node.pos >= source.length) return;
      if (ts.isFunctionDeclaration(node) && node.name?.text === contract.entry) found = node.name.getStart(sf);
      if (ts.isVariableStatement(node)) {
        for (const d of node.declarationList.declarations) {
          if (ts.isIdentifier(d.name) && d.name.text === contract.entry) found = d.name.getStart(sf);
        }
      }
    });
    return found;
  }

  function position(offset: number) {
    const before = source.slice(0, offset).split("\n");
    return { line: before.length, column: before[before.length - 1].length + 1 };
  }

  function toDiagnostic(d: ts.Diagnostic, category: Category): Diagnostic {
    // TypeScript numbers its grammar errors 1000–1999 but reports some of them (e.g. a declaration where a
    // statement is expected, or non-erasable syntax) from the type-checking pass. They're syntax problems.
    if (category === "type" && d.code >= 1000 && d.code < 2000) category = "syntax";
    let from = d.start ?? 0, to = from + (d.length ?? 0);
    let message = flatten(d.messageText);
    if (from >= source.length && category === "syntax") {
      // A syntax error at the very end (e.g. a missing "}"): TypeScript notices it in the hidden contract that
      // follows the learner's code. It's still a syntax error; report it at the end of their code.
      from = to = source.length;
    } else if (from >= source.length) {
      // The error is in the hidden contract: report it on the learner's code instead.
      category = "contract";
      const at = entryOffset();
      const detail = message.split("\n").filter(l => !l.includes(CHECK)).join("\n");
      message = at === null
        ? `Define a function named ${contract.entry}: ${signatureOf(contract)}.`
        : `${contract.entry} must accept (${contract.params.map(p => `${p.name}: ${p.type}`).join(", ")}) and return ${contract.returns}.` +
          (detail ? `\n${detail}` : "");
      const firstLineEnd = source.indexOf("\n");
      from = at ?? 0;
      to = at === null ? (firstLineEnd < 0 ? source.length : firstLineEnd) : from + contract.entry.length;
    }
    to = Math.min(Math.max(to, from), source.length);
    return {
      from, to, ...position(from), message, category,
      severity: d.category === ts.DiagnosticCategory.Warning ? "warning" : "error",
    };
  }

  return {
    diagnostics(s) {
      update(s);
      const syntax = service.getSyntacticDiagnostics(FILE).map(d => toDiagnostic(d, "syntax"));
      // Type errors are only meaningful once the code parses.
      if (syntax.length) return syntax;
      return service.getSemanticDiagnostics(FILE).map(d => toDiagnostic(d, "type"))
        .sort((a, b) => a.from - b.from);
    },

    completions(s, offset) {
      update(s);
      const info = service.getCompletionsAtPosition(FILE, offset, { includeCompletionsWithInsertText: false });
      if (!info) return null;
      let from = offset;
      while (from > 0 && /[\w$]/.test(source[from - 1])) from--;
      return {
        from,
        items: info.entries
          .filter(e => e.name !== CHECK)
          .map(e => ({ label: e.name, kind: e.kind, sortText: e.sortText })),
      };
    },

    transpile(s) {
      return ts.transpileModule(s, {
        compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.CommonJS, strict: true, removeComments: false },
        reportDiagnostics: false,
      }).outputText;
    },

    hover(s, offset) {
      update(s);
      if (offset >= source.length) return null;
      const info = service.getQuickInfoAtPosition(FILE, offset);
      if (!info) return null;
      return {
        from: info.textSpan.start,
        to: Math.min(info.textSpan.start + info.textSpan.length, source.length),
        text: ts.displayPartsToString(info.displayParts),
        docs: ts.displayPartsToString(info.documentation),
      };
    },
  };
}
