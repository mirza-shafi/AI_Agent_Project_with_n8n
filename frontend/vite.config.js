import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite configuration — uses the React plugin and the default dev port 5173.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
})
