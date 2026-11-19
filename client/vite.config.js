import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');

export default defineConfig(({ mode }) => {
  // Read the repo-root .env so BRAND_FILE / LD_CLIENT_SIDE_ID live in one place.
  const env = { ...loadEnv(mode, repoRoot, ''), ...process.env };
  const brandFile = path.resolve(repoRoot, env.BRAND_FILE || 'brand.json');

  return {
    plugins: [react()],
    envDir: repoRoot,
    resolve: {
      // All customer-facing naming/palette/copy comes from this one file.
      // Swap brands with BRAND_FILE=brands/kestrel.json — no code change.
      alias: { '@brand': brandFile },
    },
    server: {
      port: 5173,
      fs: { allow: [repoRoot] },
      proxy: { '/api': `http://localhost:${env.SERVER_PORT || 4100}` },
    },
  };
});
