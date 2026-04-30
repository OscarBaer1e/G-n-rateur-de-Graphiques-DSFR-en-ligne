import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
    plugins: [
        react({
            babel: {
                plugins: []
            }
        })
    ],
    server: {
        port: 5173,
        host: true
    },
    build: {
        target: "es2020",
        sourcemap: true
    }
});
