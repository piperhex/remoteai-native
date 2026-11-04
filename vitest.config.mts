import { configDefaults, defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({ test: {
  setupFiles: ['./vendor/shared/localization/testLocale.ts'],
  exclude: [...configDefaults.exclude, 'vendor/**', '.codex-tmp*/**'],
}, resolve: { alias: {
  // Shared hooks must use the same React instance as the native renderer and its test mocks.
  react: fileURLToPath(new URL('./node_modules/react', import.meta.url)),
} } });
