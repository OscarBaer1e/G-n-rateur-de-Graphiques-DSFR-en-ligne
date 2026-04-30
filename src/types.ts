// filepath: src/types.ts
// Types métier pour le Générateur de Graphiques DSFR en ligne.
// Aligné avec l'API officielle des web components @gouvfr/dsfr-chart.

export type ChartType =
    | "bar-vertical"
    | "bar-horizontal"
    | "bar-stacked"
    | "line"
    | "pie"
    | "donut"
    | "scatter"
    | "radar"
    | "gauge";

export type DsfrPalette =
    | "default"
    | "neutral"
    | "categorical"
    | "sequentialAscending"
    | "sequentialDescending"
    | "divergentAscending"
    | "divergentDescending";

/** Côté d'axe Y assigné à une série. */
export type SeriesAxis = "left" | "right";

/**
 * Une colonne du tableur. La première colonne (id "label") fournit
 * les libellés de l'axe X / catégories. Les colonnes suivantes sont des séries.
 *
 * `axis` n'est utilisé que pour les colonnes de série (isLabel === false) :
 *   - "left"  : axe Y principal (volume, M€…)
 *   - "right" : axe Y secondaire (variation, %…) — déclenche l'usage de
 *               <bar-line-chart> et force un rendu en LIGNE pour cette série.
 */
export interface DataColumn {
    id: string;
    name: string;
    isLabel: boolean;
    axis?: SeriesAxis;
}

/**
 * Une ligne du tableur. Les valeurs sont indexées par id de colonne.
 * Les valeurs numériques sont stockées en string pour permettre la saisie libre,
 * et reparsées au moment de la sérialisation pour le graphique.
 */
export interface DataRow {
    id: string;
    cells: Record<string, string>;
}

export interface ChartState {
    title: string;
    /** Unité de l'axe Y principal (gauche). Ex : M€, t, kWh… */
    unit: string;
    /** Unité de l'axe Y secondaire (droite). Ex : %, °C… */
    unitSecondary: string;
    source: string;
    chartType: ChartType;
    palette: DsfrPalette;
    /** Pour scatter : relier les points par une ligne (option `show-line`). */
    showLine: boolean;
    /** Pour gauge : valeur de départ (init) — par défaut 0. */
    gaugeInit: number;
    /** Pour gauge : valeur cible (target) — borne supérieure. */
    gaugeTarget: number;
    columns: DataColumn[];
    rows: DataRow[];
}

/**
 * Métadonnées affichables d'un type de graphique (UI du sélecteur).
 */
export interface ChartTypeMeta {
    value: ChartType;
    label: string;
    description: string;
    /** nom de la balise web component finale */
    tagName:
        | "bar-chart"
        | "line-chart"
        | "pie-chart"
        | "scatter-chart"
        | "radar-chart"
        | "gauge-chart"
        | "bar-line-chart";
}

export const CHART_TYPES: readonly ChartTypeMeta[] = [
    {
        value: "bar-vertical",
        label: "Barres verticales",
        description: "Comparaison de catégories",
        tagName: "bar-chart"
    },
    {
        value: "bar-horizontal",
        label: "Barres horizontales",
        description: "Idéal pour les libellés longs",
        tagName: "bar-chart"
    },
    {
        value: "bar-stacked",
        label: "Barres empilées",
        description: "Composition d'un total",
        tagName: "bar-chart"
    },
    {
        value: "line",
        label: "Lignes",
        description: "Évolution dans le temps",
        tagName: "line-chart"
    },
    {
        value: "pie",
        label: "Secteurs (camembert)",
        description: "Répartition d'un tout",
        tagName: "pie-chart"
    },
    {
        value: "donut",
        label: "Anneau (donut)",
        description: "Répartition d'un tout, version creuse",
        tagName: "pie-chart"
    },
    {
        value: "scatter",
        label: "Nuage de points",
        description: "Corrélation entre deux variables",
        tagName: "scatter-chart"
    },
    {
        value: "radar",
        label: "Radar (étoile)",
        description: "Comparaison multicritères",
        tagName: "radar-chart"
    },
    {
        value: "gauge",
        label: "Jauge",
        description: "Indicateur unique vs cible",
        tagName: "gauge-chart"
    }
] as const;

export const PALETTES: readonly { value: DsfrPalette; label: string }[] = [
    { value: "default", label: "Par défaut" },
    { value: "neutral", label: "Neutre" },
    { value: "categorical", label: "Catégorielle (recommandée)" },
    { value: "sequentialAscending", label: "Séquentielle ascendante" },
    { value: "sequentialDescending", label: "Séquentielle descendante" },
    { value: "divergentAscending", label: "Divergente ascendante" },
    { value: "divergentDescending", label: "Divergente descendante" }
] as const;

/** Types de graphique compatibles avec l'axe Y secondaire. */
export const DUAL_AXIS_COMPATIBLE: readonly ChartType[] = [
    "bar-vertical",
    "bar-stacked",
    "line"
] as const;
