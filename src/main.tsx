// filepath: src/main.tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// --- DSFR : CSS officiel + icônes (chargés depuis node_modules, AUCUN CDN). ---
import "@gouvfr/dsfr/dist/dsfr.min.css";
import "@gouvfr/dsfr/dist/utility/icons/icons.min.css";

// --- Polices officielles Marianne + Spectral fournies dans le package DSFR. ---
import "@gouvfr/dsfr/dist/utility/utility.min.css";

// --- Module JS officiel du DSFR (composants interactifs). ---
import "@gouvfr/dsfr/dist/dsfr.module.min.js";

// --- DSFR Chart : web components <bar-chart>, <line-chart>, ... + leur CSS. ---
import "@gouvfr/dsfr-chart";
import "@gouvfr/dsfr-chart/css";

// --- Styles applicatifs de DSFR Graph Builder Pro. ---
import "./App.css";

import { App } from "./App";

const rootElement = document.getElementById("root");
if (!rootElement) {
    throw new Error("Élément racine #root introuvable dans index.html.");
}

createRoot(rootElement).render(
    <StrictMode>
        <App />
    </StrictMode>
);
