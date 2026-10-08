import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative asset paths let the build work under any GitHub Pages subpath
  // (https://<user>.github.io/<repo>/) without hard-coding the repo name.
  base: './',
  test: { include: ['src/**/*.test.ts'] },
});
