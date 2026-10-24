import { defineConfig } from 'vite';
import { resolve } from 'node:path';
export default defineConfig({
  base: './',
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        email: resolve(__dirname, 'email.html'),
        login: resolve(__dirname, 'login.html'),
        onboarding: resolve(__dirname, 'onboarding.html'),
      },
    },
  },
});