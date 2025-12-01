import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    // Try multiple sources for the API key:
    // 1. Vercel env vars (available at build time)
    // 2. VITE_ prefixed env vars
    // 3. .env file loaded by loadEnv
    const geminiApiKey = process.env.GEMINI_API_KEY ||
                         process.env.VITE_GEMINI_API_KEY ||
                         env.GEMINI_API_KEY ||
                         env.VITE_GEMINI_API_KEY ||
                         '';

    console.log('Building with API key:', geminiApiKey ? 'Key found' : 'No key found');

    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(geminiApiKey),
        'process.env.GEMINI_API_KEY': JSON.stringify(geminiApiKey)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
