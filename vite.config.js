import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          ui: ['@mui/material', '@mui/icons-material', 'framer-motion'],
          charts: ['chart.js', 'react-chartjs-2'],
          utils: ['axios', 'date-fns', 'lodash', 'crypto-js']
        }
      }
    }
  }
})
