import {defineConfig} from 'vite';
// Keep cookies and CSRF on the frontend origin; never put credentials in VITE_ values.
const target=process.env.JIBRO_DEV_API_TARGET||'http://127.0.0.1:8080';
const proxy={'/api':{target,changeOrigin:false}};
export default defineConfig({server:{host:'127.0.0.1',port:5173,strictPort:true,proxy},preview:{host:'127.0.0.1',port:4173,strictPort:true,proxy}});
