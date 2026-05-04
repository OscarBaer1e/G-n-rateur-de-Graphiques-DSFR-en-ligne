// filepath: src/jsx-dsfr-chart.d.ts
// Déclarations JSX pour les web components officiels @gouvfr/dsfr-chart.
// Sans ce fichier, TypeScript refuserait <bar-chart>, <line-chart>, <gauge-chart>, etc.

import type { DetailedHTMLProps, HTMLAttributes } from "react";

type DsfrChartBaseAttrs = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
    "selected-palette"?: string;
    "unit-tooltip"?: string;
    "x-min"?: string | number;
    "x-max"?: string | number;
    "y-min"?: string | number;
    "y-max"?: string | number;
};

type BarChartAttrs = DsfrChartBaseAttrs & {
    x?: string;
    y?: string;
    name?: string;
    horizontal?: string;
    stacked?: string;
    "highlight-index"?: string;
};

type LineChartAttrs = DsfrChartBaseAttrs & {
    x?: string;
    y?: string;
    name?: string;
};

type PieChartAttrs = DsfrChartBaseAttrs & {
    x?: string;
    y?: string;
    name?: string;
    fill?: string;
};

type ScatterChartAttrs = DsfrChartBaseAttrs & {
    x?: string;
    y?: string;
    name?: string;
    "show-line"?: string;
};

type RadarChartAttrs = DsfrChartBaseAttrs & {
    x?: string;
    y?: string;
    name?: string;
};

type GaugeChartAttrs = DsfrChartBaseAttrs & {
    /** Valeur courante de la jauge (obligatoire). */
    value?: string | number;
    /** Valeur de départ de la jauge (obligatoire). */
    init?: string | number;
    /** Valeur cible de la jauge (obligatoire). */
    target?: string | number;
    /** Libellé légende / infobulle (JSON tableau d’un libellé), aligné sur les autres graphiques. */
    name?: string;
};

/**
 * <bar-line-chart> — combo officiel DSFR pour double axe Y :
 * barres sur l'axe gauche, ligne sur l'axe droit.
 */
type BarLineChartAttrs = Omit<DsfrChartBaseAttrs, "y-min" | "y-max"> & {
    x?: string;
    "y-bar"?: string;
    "y-line"?: string;
    name?: string;
    "unit-tooltip-bar"?: string;
    "unit-tooltip-line"?: string;
    "y-bar-min"?: string | number;
    "y-bar-max"?: string | number;
    "y-line-min"?: string | number;
    "y-line-max"?: string | number;
};

declare global {
    namespace JSX {
        interface IntrinsicElements {
            "bar-chart": BarChartAttrs;
            "line-chart": LineChartAttrs;
            "pie-chart": PieChartAttrs;
            "scatter-chart": ScatterChartAttrs;
            "radar-chart": RadarChartAttrs;
            "gauge-chart": GaugeChartAttrs;
            "bar-line-chart": BarLineChartAttrs;
        }
    }
}

export {};
