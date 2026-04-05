import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Cho phép kết nối từ bên ngoài container (Windows)
    port: 5173,
    strictPort: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': ['lucide-react'],
          'http-vendor': ['axios', 'socket.io-client'],
          'store-vendor': ['zustand'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
})
