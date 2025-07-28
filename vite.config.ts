import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks
          'react-vendor': ['react', 'react-dom'],
          'ui-vendor': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-select',
            '@radix-ui/react-tabs',
            '@radix-ui/react-tooltip',
            '@radix-ui/react-popover',
            '@radix-ui/react-scroll-area'
          ],
          'router-vendor': ['react-router-dom'],
          'utils-vendor': ['clsx', 'class-variance-authority', 'tailwind-merge'],

          // Feature chunks
          'chat-core': [
            './components/ChatApp.tsx',
            './components/ChatMessages.tsx',
            './components/ChatInput.tsx'
          ],
          'chat-ui': [
            './components/ChatSidebar.tsx',
            './components/ChatHeader.tsx',
            './components/SettingsPanel.tsx'
          ],
          'services': [
            './services/openrouter.ts',
            './services/stream-processor.ts'
          ],
          'utils': [
            './utils/storage.ts',
            './utils/cache-manager.ts',
            './utils/debounce.ts',
            './utils/conversation-utils.ts'
          ]
        }
      }
    },
    // Enable source maps for better debugging
    sourcemap: true,
    // Optimize chunk size
    chunkSizeWarningLimit: 1000,
    // Enable minification
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
  },
})