import { defineConfig } from 'vitest/config';

// Anchored to this folder: a `**/.worktrees/**` glob would also match a worktree's own path.
const WORKTREES = decodeURIComponent(new URL('./.worktrees', import.meta.url).pathname);

export default defineConfig({
  // Relative base so the built site works from any static host / subpath.
  base: './',
  build: {
    target: 'es2022',
    outDir: 'dist',
  },
  // Agent worktrees live under .worktrees/; keep them out of the dev server and tests.
  server: { watch: { ignored: [`${WORKTREES}/**`] } },
  test: { exclude: ['node_modules/**', '.worktrees/**', 'dist/**'] },
});
