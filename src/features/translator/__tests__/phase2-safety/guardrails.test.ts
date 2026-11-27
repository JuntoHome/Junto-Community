import { readFileSync } from "node:fs";
import { afterEach, expect, it, vi } from "vitest";
import { toArrayBuffer } from "../../__fixtures__/build-workbook";
import { importRows, importWorkbook } from "../../__fixtures__/import-pipeline";
import { RS_SAMPLE_PATH, SAMPLE_PATH, syntheticRow, syntheticSheet } from "../../__fixtures__/records";
import { EXAMPLE_SUMMARY } from "../../__fixtures__/summary";
import { MAX_SUMMARY_VALUE_CHARS } from "../../ai/guardrails";
import { buildIntroInstructions, buildInterviewInstructions } from "../../ai/instructions";
import { MAX_INTRO_VALUE_CHARS, pickIntroFields } from "../../ai/intro";
import { AI_SESSION_LIMIT, canUseAi, limitNotice, SESSION_LIMIT_TEXT, SHOW_REMAINING_FROM } from "../../ai/session-limit";
import { buildFileSummary } from "../../ai/summary";
import { BUSINESS_OWNER_BRIEF } from "../../criteria/examples";
import type { GroupedRecord } from "../../normalize/duplicates";
import {
  callArguments,
  isTestOrFixture,
  lineOf,
  listFiles,
  readSource,
  repoPath,
  stripComments,
  translatorSources,
} from "../source-files";

/**
 * Phase 2 safety evidence: guardrails (TR-54). The limits and static checks that keep the AI
 * safe and cheap: the session limit, the value caps, no content logging, no storage, and the
 * OpenAI key on the server only. Most of these were written in TR-51 and moved here with
 * `guardrail:` names: `__tests__/no-content-logging.test.ts`, `__tests__/key-safety.test.ts`,
 * `ai/value-cleaning.test.ts`, two tests of `ai/session-limit.test.ts` and the secrets test of
 * `ai/injection.test.ts`. The static checks read the Translator's app code with `fs` (tests and
 * fixtures skipped) through `../source-files.ts`.
 *
 * Do not skip or loosen these without the project lead's OK (docs/WAY-OF-WORKING.md, "Testing").
 */

afterEach(() => {
  vi.unstubAllEnvs();
});

// ---------------------------------------------------------------------------------------------
// Session limit (TR-51)
// ---------------------------------------------------------------------------------------------

it("guardrail: session limit after 40 requests", () => {
  expect(AI_SESSION_LIMIT).toBe(40);
  expect(canUseAi(0)).toBe(true);
  expect(canUseAi(39)).toBe(true);
  expect(canUseAi(40)).toBe(false);
  expect(canUseAi(41)).toBe(false);
  expect(limitNotice(40)).toBe("You've reached the AI limit for this session. Use the form, or start over to reset.");
  expect(limitNotice(41)).toBe(SESSION_LIMIT_TEXT.reached);
});

it("guardrail: session limit: nothing shown until 5 or fewer are left, then the count", () => {
  expect(SHOW_REMAINING_FROM).toBe(5);
  expect(limitNotice(0)).toBeNull();
  expect(limitNotice(34)).toBeNull();
  expect(limitNotice(35)).toBe("5 AI requests left in this session.");
  expect(limitNotice(39)).toBe("1 AI request left in this session.");
});

// ---------------------------------------------------------------------------------------------
// Value length caps (TR-40, TR-48; checked in TR-51, not changed)
// ---------------------------------------------------------------------------------------------

const CONTROL_OR_LINE_BREAK = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/;

/** Invented rows with line breaks, tabs, control characters and long values in every text field. */
const DIRTY_ROWS = [
  syntheticRow(1, { Title: "Head\nof\tSales\u0000Team", Company: `Long\r\nCompany ${"x".repeat(300)}` }),
  syntheticRow(2, { City: `Phoenix ${"y".repeat(150)}`, Industry: "Fab\u0007rication\u2028Shop", Name: "Demo\u0085Person" }),
  syntheticRow(3, { State: "A\u000bZ", Title: `Owner ${"z".repeat(200)}` }),
];

function checkSummary(records: readonly GroupedRecord[]) {
  const summary = buildFileSummary(records, "synthetic");
  const values = [...summary.cities, ...summary.states, ...summary.industries, ...summary.titles].map((item) => item.value);
  expect(values.length).toBeGreaterThan(0);
  for (const value of values) {
    expect(value).not.toMatch(CONTROL_OR_LINE_BREAK);
    expect(value.length).toBeLessThanOrEqual(MAX_SUMMARY_VALUE_CHARS);
  }
}

function checkIntros(records: readonly GroupedRecord[]) {
  let checked = 0;
  for (const record of records) {
    const picked = pickIntroFields({ record });
    if (!picked.ok) continue;
    for (const value of Object.values(picked.intro)) {
      if (value === null) continue;
      expect(value).not.toMatch(CONTROL_OR_LINE_BREAK);
      expect(value.length).toBeLessThanOrEqual(MAX_INTRO_VALUE_CHARS);
      checked += 1;
    }
  }
  expect(checked).toBeGreaterThan(0);
}

it("guardrail: value length caps stay 80 for the summary and 120 for intro fields", () => {
  expect(MAX_SUMMARY_VALUE_CHARS).toBe(80);
  expect(MAX_INTRO_VALUE_CHARS).toBe(120);
});

it("guardrail: value length caps: invented dirty values are cleaned and capped in the summary and the intro fields", async () => {
  const { grouping } = await importRows(syntheticSheet(DIRTY_ROWS));
  checkSummary(grouping.records);
  checkIntros(grouping.records);
});

it.each([
  ["the synthetic sample", SAMPLE_PATH],
  ["the Reference Solutions sample", RS_SAMPLE_PATH],
])("guardrail: value length caps: every value from %s is cleaned and capped", async (_, path) => {
  const { grouping } = await importWorkbook(toArrayBuffer(readFileSync(path)));
  checkSummary(grouping.records);
  checkIntros(grouping.records);
});

// ---------------------------------------------------------------------------------------------
// No content logging, no storage (TR-51)
// ---------------------------------------------------------------------------------------------

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

it("guardrail: no content logging: the check reads the Translator's code and the route", () => {
  expect(sources.length).toBeGreaterThan(50);
  expect(sources.some((path) => repoPath(path) === "src/app/api/translator/ai/route.ts")).toBe(true);
  expect(sources.some((path) => repoPath(path) === "src/features/translator/ai/handle-request.ts")).toBe(true);
});

it("guardrail: no content logging: only console.error with one fixed code", () => {
  const problems = sources.flatMap((path) => consoleProblems(path, readSource(path)));
  expect(problems).toEqual([]);
});

it("guardrail: no content logging: the codes are still logged, so the check sees real calls", () => {
  const calls = sources.flatMap((path) => [...stripComments(readSource(path)).matchAll(/console\.error\(/g)]);
  expect(calls.length).toBeGreaterThanOrEqual(11);
});

it.each([
  ["console.log(messages);", 1],
  ['console.error("x", body);', 1],
  ["console.error(`translator_ai_${code}`);", 1],
  ["console.error(code);", 1],
  ['console.warn("translator_ai_timeout");', 1],
  ["const { log } = console;", 1],
  ['console.error("translator_ai_timeout");', 0],
  ['console.error("[translator] export-failed");', 0],
  ["// console.log(rows) in a comment\nconst a = 1;", 0],
])("guardrail: no content logging: the check catches %s", (code, count) => {
  expect(consoleProblems("src/features/translator/example.ts", code)).toHaveLength(count);
});

it("guardrail: no storage: no localStorage, sessionStorage, indexedDB, cookies, Cache API or Supabase", () => {
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
])("guardrail: no storage: the check catches %s", (code, count) => {
  expect(storageProblems("src/features/translator/example.ts", code)).toHaveLength(count);
});

// ---------------------------------------------------------------------------------------------
// The OpenAI key stays on the server (TR-51, CLAUDE.md rule 7)
// ---------------------------------------------------------------------------------------------

/** True when the file's first statement is the `"use client"` directive. */
const isClientModule = (source: string) => /^\s*["']use client["']/.test(stripComments(source));

/** What a browser-side file must never reference. */
const SERVER_ONLY = [
  { name: "OPENAI_API_KEY", pattern: /OPENAI_API_KEY/ },
  { name: "process.env", pattern: /\bprocess\s*\.\s*env\b/ },
  { name: 'from "openai"', pattern: /from\s*["']openai["']|import\s*\(\s*["']openai["']\s*\)/ },
  { name: "ai/client", pattern: /["'][^"'\n]*ai\/client["']/ },
];

function serverOnlyProblems(path: string, source: string): string[] {
  const code = stripComments(source);
  return SERVER_ONLY.flatMap(({ name, pattern }) => {
    const found = pattern.exec(code);
    return found ? [`${repoPath(path)}:${lineOf(code, found.index)}: ${name}`] : [];
  });
}

/** The public variable name that must never exist, built here so this file doesn't contain it. */
const PUBLIC_OPENAI = ["NEXT", "PUBLIC", "OPENAI"].join("_");

const CODE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];

it("guardrail: key stays on the server: no client module or translator/ui file touches the key, the environment, openai or ai/client", () => {
  const browserFiles = listFiles("src", CODE_EXTENSIONS).filter((path) => {
    if (isTestOrFixture(path)) return false;
    return repoPath(path).startsWith("src/features/translator/ui/") || isClientModule(readSource(path));
  });
  // The check really covers the client modules and the Translator's UI.
  expect(browserFiles.length).toBeGreaterThan(20);
  expect(browserFiles.some((path) => repoPath(path) === "src/features/translator/ui/chat/chat-panel.tsx")).toBe(true);
  expect(browserFiles.flatMap((path) => serverOnlyProblems(path, readSource(path)))).toEqual([]);
});

it("guardrail: key stays on the server: no file in the repository has a public OpenAI variable", () => {
  const files = listFiles(".", [...CODE_EXTENSIONS, ".json", ".md", ".yml", ".yaml", ".txt", ".example", ".local", ".env"]);
  expect(files.length).toBeGreaterThan(100);
  const found = files.filter((path) => readSource(path).includes(PUBLIC_OPENAI)).map(repoPath);
  expect(found).toEqual([]);
});

it("guardrail: key stays on the server: inside the Translator, only ai/client.ts reads process.env", () => {
  const readers = translatorSources()
    .filter((path) => /\bprocess\s*\.\s*env\b/.test(stripComments(readSource(path))))
    .map(repoPath);
  expect(readers).toEqual(["src/features/translator/ai/client.ts"]);
});

it("guardrail: key stays on the server: the instructions hold neither the key nor the model setting", () => {
  vi.stubEnv("OPENAI_API_KEY", "sk-test-not-a-real-key-7Hq2");
  vi.stubEnv("OPENAI_MODEL", "gpt-test-model-setting-9Zx4");
  const texts = [
    buildInterviewInstructions(EXAMPLE_SUMMARY),
    buildInterviewInstructions(EXAMPLE_SUMMARY, BUSINESS_OWNER_BRIEF),
    buildIntroInstructions(),
  ];
  for (const text of texts) {
    expect(text).not.toContain("sk-test-not-a-real-key-7Hq2");
    expect(text).not.toContain("gpt-test-model-setting-9Zx4");
    expect(text).not.toContain("OPENAI_API_KEY");
  }
});

it.each([
  ['"use client";\nconst key = process.env.OPENAI_API_KEY;', 2],
  ['"use client";\nimport OpenAI from "openai";', 1],
  ['"use client";\nimport { aiEnabled } from "../ai/client";', 1],
  ['"use client";\n// process.env is read on the server only\nexport const a = 1;', 0],
])("guardrail: key stays on the server: the check catches %s", (code, count) => {
  expect(isClientModule(code)).toBe(true);
  expect(serverOnlyProblems("src/features/translator/ui/example.tsx", code)).toHaveLength(count);
});

it("guardrail: key stays on the server: the check knows a server file from a client module", () => {
  expect(isClientModule('import "server-only";\nexport const a = 1;')).toBe(false);
  expect(isClientModule('// A comment first\n"use client";\nexport const a = 1;')).toBe(true);
});
