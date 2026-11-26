import { describe, expect, it } from "vitest";
import { isTestOrFixture, lineOf, listFiles, readSource, repoPath, stripComments, translatorSources } from "./source-files";

/**
 * The OpenAI key stays on the server (TR-51, CLAUDE.md rule 7). Static checks:
 * - no client module (`"use client"`) and nothing in `src/features/translator/ui/` touches the key,
 *   the environment, the `openai` package or `ai/client`;
 * - no file in the repository has a public OpenAI variable;
 * - inside the Translator, only `ai/client.ts` reads `process.env`.
 *
 * Do not skip or loosen these without the project lead's OK (docs/WAY-OF-WORKING.md, "Testing").
 */

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

describe("the OpenAI key stays on the server (TR-51)", () => {
  it("no client module and nothing in translator/ui references the key, the environment, openai or ai/client", () => {
    const browserFiles = listFiles("src", CODE_EXTENSIONS).filter((path) => {
      if (isTestOrFixture(path)) return false;
      return repoPath(path).startsWith("src/features/translator/ui/") || isClientModule(readSource(path));
    });
    // The check really covers the client modules and the Translator's UI.
    expect(browserFiles.length).toBeGreaterThan(20);
    expect(browserFiles.some((path) => repoPath(path) === "src/features/translator/ui/chat/chat-panel.tsx")).toBe(true);
    expect(browserFiles.flatMap((path) => serverOnlyProblems(path, readSource(path)))).toEqual([]);
  });

  it("no file in the repository has a public OpenAI variable", () => {
    const files = listFiles(".", [...CODE_EXTENSIONS, ".json", ".md", ".yml", ".yaml", ".txt", ".example", ".local", ".env"]);
    expect(files.length).toBeGreaterThan(100);
    const found = files.filter((path) => readSource(path).includes(PUBLIC_OPENAI)).map(repoPath);
    expect(found).toEqual([]);
  });

  it("inside the Translator, only ai/client.ts reads process.env", () => {
    const readers = translatorSources()
      .filter((path) => /\bprocess\s*\.\s*env\b/.test(stripComments(readSource(path))))
      .map(repoPath);
    expect(readers).toEqual(["src/features/translator/ai/client.ts"]);
  });

  it.each([
    ['"use client";\nconst key = process.env.OPENAI_API_KEY;', 2],
    ['"use client";\nimport OpenAI from "openai";', 1],
    ['"use client";\nimport { aiEnabled } from "../ai/client";', 1],
    ['"use client";\n// process.env is read on the server only\nexport const a = 1;', 0],
  ])("catches %s", (code, count) => {
    expect(isClientModule(code)).toBe(true);
    expect(serverOnlyProblems("src/features/translator/ui/example.tsx", code)).toHaveLength(count);
  });

  it("knows a server file from a client module", () => {
    expect(isClientModule('import "server-only";\nexport const a = 1;')).toBe(false);
    expect(isClientModule('// A comment first\n"use client";\nexport const a = 1;')).toBe(true);
  });
});
