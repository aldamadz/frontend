import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(), 
    mode === "development" && componentTagger()
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // --- TAMBAHKAN OPTIMASI BUILD DI BAWAH INI ---
  build: {
    chunkSizeWarningLimit: 1600, // Menaikkan limit agar tidak muncul peringatan kuning
    rollupOptions: {
      output: {
        // Fungsi untuk memecah library pihak ketiga (node_modules)
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // Memisahkan library besar ke file tersendiri agar bisa di-cache browser
            if (id.includes('@supabase')) return 'vendor-supabase';
            if (id.includes('@tanstack')) return 'vendor-query';
            if (id.includes('lucide-react')) return 'vendor-icons';
            if (id.includes('recharts')) return 'vendor-charts'; // Jika pakai chart
            
            return 'vendor-core'; // Sisanya (React, dll) masuk ke core vendor
          }
        },
      },
    },
  },
}));