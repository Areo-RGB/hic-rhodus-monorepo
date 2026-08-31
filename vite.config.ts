import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
export default defineConfig(()=>({base:'./',build:{outDir:'app/src/main/assets',emptyOutDir:true},plugins:[react(),tailwindcss()],resolve:{alias:{'@':path.resolve(__dirname,'.')}}}));
