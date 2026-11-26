import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Helpers for the static safety tests (TR-51): they read the source files and check them as text,
 * with `fs`, so they run with `npm run test` and need no extra tool. Test-only.
 */

/** The repository's root folder. */
export const REPO_ROOT = fileURLToPath(new URL("../../../../", import.meta.url));

/** Folders never read: dependencies, build output and git's own files. */
const SKIPPED_DIRS = new Set(["node_modules", ".next", ".git", ".vercel", "out", "build", "coverage"]);

/** Every file under `dir` (relative to the repo root) whose name ends with one of `extensions`. */
export function listFiles(dir: string, extensions: readonly string[]): string[] {
  const found: string[] = [];
  const walk = (folder: string) => {
    for (const name of readdirSync(folder)) {
      const path = join(folder, name);
      if (statSync(path).isDirectory()) {
        if (!SKIPPED_DIRS.has(name)) walk(path);
      } else if (extensions.some((extension) => name.endsWith(extension))) {
        found.push(path);
      }
    }
  };
  walk(join(REPO_ROOT, dir));
  return found.sort();
}

/** `path` relative to the repo root, with forward slashes, for messages and matching. */
export const repoPath = (path: string) => relative(REPO_ROOT, path).split(sep).join("/");

/** True for a test, a fixture or one of these safety tests' own files. */
export const isTestOrFixture = (path: string) => {
  const rel = repoPath(path);
  return /\.test\.tsx?$/.test(rel) || rel.includes("/__fixtures__/") || rel.includes("/__tests__/");
};

/** The app code (no tests or fixtures) in the Translator and its API route. */
export function translatorSources(): string[] {
  return [...listFiles("src/features/translator", [".ts", ".tsx"]), ...listFiles("src/app/api/translator", [".ts", ".tsx"])].filter(
    (path) => !isTestOrFixture(path),
  );
}

export const readSource = (path: string) => readFileSync(path, "utf8");

/**
 * The code with its comments blanked out (`//` and `/* *\/`), strings kept, so a comment that
 * mentions `localStorage` or `process.env` doesn't count, but code does. Line breaks are kept,
 * so positions still match lines. Template literals are kept whole, `${...}` included.
 */
export function stripComments(source: string): string {
  let out = "";
  let i = 0;
  while (i < source.length) {
    const char = source[i];
    const next = source[i + 1];
    if (char === "/" && next === "/") {
      while (i < source.length && source[i] !== "\n") i += 1;
    } else if (char === "/" && next === "*") {
      i += 2;
      while (i < source.length && !(source[i] === "*" && source[i + 1] === "/")) {
        out += source[i] === "\n" ? "\n" : "";
        i += 1;
      }
      i += 2;
    } else if (char === '"' || char === "'" || char === "`") {
      const quote = char;
      out += char;
      i += 1;
      while (i < source.length && source[i] !== quote) {
        if (source[i] === "\\") {
          out += source[i];
          i += 1;
        }
        out += source[i] ?? "";
        i += 1;
      }
      out += source[i] ?? "";
      i += 1;
    } else {
      out += char;
      i += 1;
    }
  }
  return out;
}

/** The 1-based line of `index` in `text`. */
export const lineOf = (text: string, index: number) => text.slice(0, index).split("\n").length;

/**
 * The text between the "(" at `open` and its matching ")", strings and nesting respected, or null
 * when the call isn't closed.
 */
export function callArguments(code: string, open: number): string | null {
  let depth = 0;
  for (let i = open; i < code.length; i += 1) {
    const char = code[i];
    if (char === '"' || char === "'" || char === "`") {
      const quote = char;
      i += 1;
      while (i < code.length && code[i] !== quote) i += code[i] === "\\" ? 2 : 1;
    } else if (char === "(") {
      depth += 1;
    } else if (char === ")") {
      depth -= 1;
      if (depth === 0) return code.slice(open + 1, i);
    }
  }
  return null;
}
