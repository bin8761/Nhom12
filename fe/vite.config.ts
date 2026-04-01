import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    open: true, // Tự động mở browser khi chạy npm run dev
    port: 5173,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // React core libraries
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // UI libraries
          'ui-vendor': ['lucide-react'],
          // HTTP clients
          'http-vendor': ['axios', 'socket.io-client'],
          // State management
          'store-vendor': ['zustand'],
        },
      },
    },
    chunkSizeWarningLimit: 600, // Tăng limit lên 600 kB
  },
})
