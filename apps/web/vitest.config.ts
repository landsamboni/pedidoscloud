import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Tests run in Node (the critical logic under test is server-side / pure).
// The "@/..." path alias mirrors tsconfig so tests import modules the same way
// the app does.
export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
});
