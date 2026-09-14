import {defineConfig} from 'vite';
export default defineConfig(({command})=>({base:process.env.GITHUB_ACTIONS&&command==='build'?'/riglab/':'/',build:{rollupOptions:{output:{manualChunks(id){if(id.includes('/three/src/')||id.includes('/three/build/'))return 'three-engine';if(id.includes('/three/examples/'))return 'three-tools';if(id.includes('/lucide/'))return 'icons';}}}}}));
