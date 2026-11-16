import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Unit tests (TR-29). Tests sit beside the code they test as `*.test.ts` and run in Node, with
 * no browser and no network. Fixtures live in `src/features/translator/__fixtures__/`. App code
 * never imports a test or a fixture, so neither reaches the Next.js build.
 */
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
