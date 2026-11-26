import { describe, expect, it } from "vitest";
import { callArguments, lineOf, readSource, repoPath, stripComments, translatorSources } from "./source-files";

/**
 * No content logging, and no browser storage (TR-51). Static checks over the Translator's app
 * code (`src/features/translator/` and `src/app/api/translator/`, tests and fixtures skipped).
 *
 * Do not skip or loosen these without the project lead's OK (docs/WAY-OF-WORKING.md, "Testing").
 */

/** The only lines the Translator may write: the route's codes (TR-39) and the UI's codes (TR-28). */
const ALLOWED_LINES = [/^translator_ai_[a-z_]+$/, /^\[translator\] [a-z-]+$/];

/** One plain string literal, `"..."` or `'...'`, with nothing else: no template, no second argument. */
const SINGLE_LITERAL = /^\s*(?:"([^"\\\n]*)"|'([^'\\\n]*)')\s*$/;

/** Every problem with the console in `source`, as "path:line: what". */
function consoleProblems(path: string, source: string): string[] {
  const code = stripComments(source);
  const problems: string[] = [];
  for (const match of code.matchAll(/\bconsole\b/g)) {
    const at = match.index;
    const where = `${repoPath(path)}:${lineOf(code, at)}`;
    const call = /^console\s*\.\s*([A-Za-z]+)\s*\(/.exec(code.slice(at));
    if (!call) {
      problems.push(`${where}: console used other than as console.error("...")`);
      continue;
    }
    if (call[1] !== "error") {
      problems.push(`${where}: console.${call[1]} (only console.error with a fixed code is allowed)`);
      continue;
    }
    const args = callArguments(code, at + call[0].length - 1);
    const literal = args === null ? null : SINGLE_LITERAL.exec(args);
    const text = literal ? (literal[1] ?? literal[2]) : null;
    if (text === null || !ALLOWED_LINES.some((allowed) => allowed.test(text))) {
      problems.push(`${where}: console.error(${args ?? "..."}) (needs exactly one fixed code string)`);
    }
  }
  return problems;
}

/** What may never appear in the Translator's code: browser storage and the database. */
const STORAGE = [
  { name: "localStorage", pattern: /\blocalStorage\b/ },
  { name: "sessionStorage", pattern: /\bsessionStorage\b/ },
  { name: "indexedDB", pattern: /\bindexedDB\b/ },
  { name: "document.cookie", pattern: /\bdocument\s*\.\s*cookie\b/ },
  { name: "caches.", pattern: /\bcaches\s*\./ },
  { name: "a Supabase import", pattern: /(?:from\s*|import\s*\(\s*|require\s*\(\s*)["'][^"']*supabase[^"']*["']/i },
];

function storageProblems(path: string, source: string): string[] {
  const code = stripComments(source);
  return STORAGE.flatMap(({ name, pattern }) => {
    const found = pattern.exec(code);
    return found ? [`${repoPath(path)}:${lineOf(code, found.index)}: ${name}`] : [];
  });
}

const sources = translatorSources();

describe("no content logging (TR-51)", () => {
  it("reads the Translator's code", () => {
    expect(sources.length).toBeGreaterThan(50);
    expect(sources.some((path) => repoPath(path) === "src/app/api/translator/ai/route.ts")).toBe(true);
    expect(sources.some((path) => repoPath(path) === "src/features/translator/ai/handle-request.ts")).toBe(true);
  });

  it("writes to the console only with console.error and one fixed code", () => {
    const problems = sources.flatMap((path) => consoleProblems(path, readSource(path)));
    expect(problems).toEqual([]);
  });

  it("still logs its codes, so the check above is looking at real calls", () => {
    const calls = sources.flatMap((path) => [...stripComments(readSource(path)).matchAll(/console\.error\(/g)]);
    expect(calls.length).toBeGreaterThanOrEqual(11);
  });

  it.each([
    ['console.log(messages);', 1],
    ['console.error("x", body);', 1],
    ["console.error(`translator_ai_${code}`);", 1],
    ["console.error(code);", 1],
    ['console.warn("translator_ai_timeout");', 1],
    ["const { log } = console;", 1],
    ['console.error("translator_ai_timeout");', 0],
    ['console.error("[translator] export-failed");', 0],
    ['// console.log(rows) in a comment\nconst a = 1;', 0],
  ])("catches %s", (code, count) => {
    expect(consoleProblems("src/features/translator/example.ts", code)).toHaveLength(count);
  });
});

describe("no browser storage (TR-51)", () => {
  it("never uses localStorage, sessionStorage, indexedDB, cookies, the Cache API or Supabase", () => {
    const problems = sources.flatMap((path) => storageProblems(path, readSource(path)));
    expect(problems).toEqual([]);
  });

  it.each([
    ['localStorage.setItem("x", "y");', 1],
    ["window.sessionStorage.clear();", 1],
    ["indexedDB.open('x');", 1],
    ['document.cookie = "a=b";', 1],
    ['await caches.open("x");', 1],
    ['import { createClient } from "@/lib/supabase/server";', 1],
    ["// nothing is written to localStorage\nconst a = 1;", 0],
  ])("catches %s", (code, count) => {
    expect(storageProblems("src/features/translator/example.ts", code)).toHaveLength(count);
  });
});
