/**
 * Écrit src/constants/embedCdnVersions.ts à partir de package-lock.json
 * pour que les URLs jsDelivr de l’export correspondent aux paquets installés.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const lockPath = resolve(root, "package-lock.json");
const lock = JSON.parse(readFileSync(lockPath, "utf8"));
const dsfr = lock.packages["node_modules/@gouvfr/dsfr"]?.version;
const chart = lock.packages["node_modules/@gouvfr/dsfr-chart"]?.version;

if (!dsfr || !chart) {
    throw new Error(
        "sync-embed-cdn-versions : entrées manquantes dans package-lock.json pour @gouvfr/dsfr ou @gouvfr/dsfr-chart."
    );
}

const outPath = resolve(root, "src/constants/embedCdnVersions.ts");
const content = `// Généré par scripts/sync-embed-cdn-versions.mjs — ne pas modifier à la main.
export const EMBED_CDN_DSFR_VERSION = ${JSON.stringify(dsfr)};
export const EMBED_CDN_DSFR_CHART_VERSION = ${JSON.stringify(chart)};
`;

writeFileSync(outPath, content, "utf8");
console.log("embedCdnVersions.ts synchronisé :", { dsfr, chart });
