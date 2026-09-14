import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative base so the built site works from any static host / subpath.
  base: './',
  build: {
    target: 'es2022',
    outDir: 'dist',
  },
  // Agent worktrees live under .worktrees/; keep them out of the dev server and tests.
  server: { watch: { ignored: ['**/.worktrees/**'] } },
  test: { exclude: ['node_modules/**', '.worktrees/**', 'dist/**'] },
});
