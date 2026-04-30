// filepath: src/utils/theme.ts
// Configuration centralisée des thèmes DSFR + jetons sémantiques de couleurs
// pour la dataviz. Source : Système de Design de l'État Français.

import type { DsfrPalette } from "../types";

/* -------------------------------------------------------------------------- */
/* Thèmes DSFR : préférence utilisateur (scheme) vs thème résolu (theme)      */
/* -------------------------------------------------------------------------- */

/** Préférence enregistrée par l'utilisateur. */
export type DsfrScheme = "system" | "light" | "dark";

/** Thème effectivement appliqué au DOM (résolu depuis le scheme). */
export type DsfrTheme = "light" | "dark";

const STORAGE_KEY = "gb-scheme";

const isBrowser = typeof window !== "undefined" && typeof document !== "undefined";

function readStoredScheme(): DsfrScheme {
    if (!isBrowser) return "system";
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
    return "system";
}

export function getStoredScheme(): DsfrScheme {
    return readStoredScheme();
}

/** Résout un scheme en thème effectif en interrogeant `prefers-color-scheme` si besoin. */
export function resolveTheme(scheme: DsfrScheme): DsfrTheme {
    if (scheme !== "system") return scheme;
    if (!isBrowser) return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * Applique le scheme choisi : pose `data-fr-scheme` ET `data-fr-theme` sur <html>,
 * persiste dans localStorage. DSFR Chart écoute `data-fr-theme` pour basculer
 * automatiquement les graphiques en mode clair / sombre.
 */
export function applyScheme(scheme: DsfrScheme): DsfrTheme {
    const theme = resolveTheme(scheme);
    if (isBrowser) {
        const html = document.documentElement;
        html.setAttribute("data-fr-scheme", scheme);
        html.setAttribute("data-fr-theme", theme);
        window.localStorage.setItem(STORAGE_KEY, scheme);
    }
    return theme;
}

/**
 * S'abonne aux changements de `prefers-color-scheme` au niveau OS.
 * À utiliser uniquement quand le scheme courant est "system".
 */
export function subscribeSystemTheme(callback: (theme: DsfrTheme) => void): () => void {
    if (!isBrowser) return () => undefined;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (): void => callback(mq.matches ? "dark" : "light");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
}

/* -------------------------------------------------------------------------- */
/* Palette DSFR pour la dataviz                                               */
/* -------------------------------------------------------------------------- */

/**
 * Palette recommandée par défaut : "categorical" du DSFR.
 * Elle s'appuie sur les couleurs complémentaires (Blue France, Red Marianne,
 * Green Émeraude, Purple Glycine…) avec des nuances douces, et respecte
 * automatiquement les contrastes en thème clair ET en thème sombre via les
 * jetons internes du package @gouvfr/dsfr-chart.
 */
export const DEFAULT_DATAVIZ_PALETTE: DsfrPalette = "categorical";

/**
 * Documentation des jetons sémantiques DSFR utilisés par la palette catégorielle.
 * Ces variables CSS sont définies par @gouvfr/dsfr/dist/dsfr.min.css et
 * basculent automatiquement leurs valeurs en mode sombre.
 */
export const DSFR_DATAVIZ_TOKENS = {
    blueFranceSun: "var(--blue-france-sun-113-625)",
    blueFranceMoon: "var(--blue-france-moon-625-113)",
    blueEcumeSun: "var(--blue-ecume-sun-247-407)",
    blueCumulusSun: "var(--blue-cumulus-sun-368-732)",
    greenEmeraudeSun: "var(--green-emeraude-sun-425-625)",
    greenBourgeonSun: "var(--green-bourgeon-sun-425-909)",
    purpleGlycineSun: "var(--purple-glycine-sun-319-619)",
    pinkMacaronSun: "var(--pink-macaron-sun-689-200)",
    pinkTuileSun: "var(--pink-tuile-sun-425-625)",
    yellowTournesolSun: "var(--yellow-tournesol-sun-407-732)",
    orangeTerreBattueSun: "var(--orange-terre-battue-sun-370-907)",
    brownCafeCremeSun: "var(--brown-cafe-creme-sun-383-885)",
    redMarianneSun: "var(--red-marianne-sun-425-625)"
} as const;

/* -------------------------------------------------------------------------- */
/* Métadonnées d'affichage des choix dans le ThemeSwitcher                    */
/* -------------------------------------------------------------------------- */

export interface SchemeChoice {
    value: DsfrScheme;
    label: string;
    icon: "sun" | "moon" | "system";
}

export const SCHEME_CHOICES: readonly SchemeChoice[] = [
    { value: "system", label: "Système", icon: "system" },
    { value: "light", label: "Clair", icon: "sun" },
    { value: "dark", label: "Sombre", icon: "moon" }
] as const;
