// Couleurs et options Chart.js pour l'export « Sites Faciles » (hors web components).
// Les hex correspondent au rendu **thème clair** DSFR (le CMS n'applique pas les variables CSS du preview).

import type { DsfrPalette } from "../types";

/** Hauteur du canvas : proche de `.gb-preview-host` (min-height ~380px + marge). */
export const EXPORT_CHART_HOST_MIN_HEIGHT_PX = 400;
export const EXPORT_CHART_HOST_MAX_HEIGHT_PX = 520;
/** Largeur max comme l'aperçu (`.gb-preview-host > * { max-width: 800px }`). */
export const EXPORT_CHART_MAX_WIDTH_PX = 800;

/**
 * Ordre proche de la palette **catégorielle** DSFR dataviz (clair).
 * @see https://www.systeme-de-design.gouv.fr/
 */
const CATEGORICAL_LIGHT: readonly string[] = [
    "#000091",
    "#E1000F",
    "#18753C",
    "#6E445A",
    "#465F9D",
    "#A558A0",
    "#FCC63A",
    "#E4794A",
    "#009081",
    "#1F487D"
];

const NEUTRAL_LIGHT: readonly string[] = [
    "#161616",
    "#3A3A3A",
    "#666666",
    "#929292",
    "#6A6AF4",
    "#000091"
];

const SEQUENTIAL_ASC: readonly string[] = [
    "#E8EDFF",
    "#C5D4FF",
    "#9FB8FF",
    "#6B7FD7",
    "#465F9D",
    "#2F4F9E",
    "#000091"
];

function repeatPalette(base: readonly string[], count: number): string[] {
    const out: string[] = [];
    for (let i = 0; i < count; i++) {
        out.push(base[i % base.length]!);
    }
    return out;
}

/** Couleurs de remplissage / traits selon la palette choisie dans l'outil. */
export function exportPaletteColors(palette: DsfrPalette, count: number): string[] {
    if (count <= 0) return [];
    switch (palette) {
        case "neutral":
            return repeatPalette(NEUTRAL_LIGHT, count);
        case "sequentialAscending":
            return repeatPalette(SEQUENTIAL_ASC, count);
        case "sequentialDescending":
            return repeatPalette([...SEQUENTIAL_ASC].reverse(), count);
        case "divergentAscending":
            return repeatPalette(
                ["#000091", "#929292", "#E1000F", "#465F9D", "#666666", "#E4794A"],
                count
            );
        case "divergentDescending":
            return repeatPalette(
                ["#E1000F", "#929292", "#000091", "#E4794A", "#666666", "#465F9D"],
                count
            );
        case "default":
        case "categorical":
        default:
            return repeatPalette(CATEGORICAL_LIGHT, count);
    }
}

/** Légende DSFR Chart : `.chart_legend` = rangée centrée sous le graphique. */
export function exportLegendOptions(show: boolean): Record<string, unknown> {
    if (!show) {
        return { display: false };
    }
    return {
        display: true,
        position: "bottom",
        align: "center",
        labels: {
            font: { family: "Marianne", size: 12 },
            usePointStyle: true,
            padding: 14,
            boxWidth: 10,
            boxHeight: 10
        }
    };
}

export function exportTooltipOptions(): Record<string, unknown> {
    return {
        backgroundColor: "rgba(22, 22, 22, 0.9)",
        padding: 12,
        titleFont: { size: 14, weight: "bold", family: "Marianne" },
        bodyFont: { size: 14, family: "Marianne" }
    };
}

export function exportChartLayout(showLegend: boolean): Record<string, unknown> {
    return {
        padding: {
            top: 8,
            left: 4,
            right: showLegend ? 8 : 4,
            bottom: showLegend ? 4 : 8
        }
    };
}
