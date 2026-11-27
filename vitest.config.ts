import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Unit tests (TR-29). Tests sit beside the code they test as `*.test.ts` and run in Node, with
 * no browser and no network. Fixtures live in `src/features/translator/__fixtures__/`. App code
 * never imports a test or a fixture, so neither reaches the Next.js build. `vitest.setup.ts` runs
 * before every test file and makes importing the real OpenAI SDK fail (TR-53).
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` throws outside a React Server environment. Tests run in plain Node, so it
      // resolves to an empty module here; the Next.js build still uses the real one.
      "server-only": fileURLToPath(new URL("./src/features/translator/__fixtures__/empty.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Fails any test that imports the real OpenAI SDK (TR-53).
    setupFiles: ["./vitest.setup.ts"],
  },
});
