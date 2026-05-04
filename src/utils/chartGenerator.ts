// filepath: src/utils/chartGenerator.ts
// Sérialisation du state vers les attributs des web components @gouvfr/dsfr-chart
// + génération du code d'export (HTML + table fr-sr-only RGAA + script).
//
// Trois sujets clés sont traités ici :
//   1. Bascule automatique vers <bar-line-chart> dès qu'au moins une série est
//      assignée à l'axe Y secondaire (axis === "right").
//   2. Détection des libellés "Année" pour empêcher l'interpolation décimale
//      ("2024,5") et tout séparateur de milliers ("2 024").
//   3. Génération d'un tableau RGAA fr-sr-only synchronisé avec la config réelle.

import {
    CHART_TYPES,
    DUAL_AXIS_COMPATIBLE,
    type ChartState,
    type ChartTypeMeta,
    type DataColumn
} from "../types";

/* -------------------------------------------------------------------------- */
/* Helpers numériques + détection années                                       */
/* -------------------------------------------------------------------------- */

function toNumber(value: string | undefined): number | null {
    if (value === undefined) return null;
    const trimmed = value.trim();
    if (trimmed === "") return null;
    const normalized = trimmed.replace(",", ".");
    const n = Number(normalized);
    return Number.isFinite(n) ? n : null;
}

/** Renvoie vrai si le libellé ressemble à une année simple (1700–2300). */
export function isYearLabel(label: string): boolean {
    const trimmed = label.trim();
    if (!/^-?\d{4}$/.test(trimmed)) return false;
    const n = Number(trimmed);
    return n >= 1700 && n <= 2300;
}

/**
 * Vrai si on peut considérer la colonne X comme "années" :
 * au moins 2 entrées non vides ET toutes ressemblent à une année.
 */
export function looksLikeYearAxis(labels: string[]): boolean {
    const filled = labels.filter(l => l.trim().length > 0);
    if (filled.length < 2) return false;
    return filled.every(isYearLabel);
}

/* -------------------------------------------------------------------------- */
/* Type de retour                                                              */
/* -------------------------------------------------------------------------- */

export type GaugeWarning =
    | "multiple-rows"
    | "no-numeric-value"
    | "invalid-bounds";

export type DualAxisWarning =
    | "incompatible-chart-type"
    | "horizontal-not-supported"
    | "multiple-left-series"
    | "multiple-right-series"
    | "missing-left-series"
    | "missing-secondary-unit";

export interface ProjectedSeries {
    name: string;
    /** "left" pour les colonnes par défaut, "right" si l'utilisateur a basculé. */
    axis: "left" | "right";
    values: (number | null)[];
}

export interface ChartAttributes {
    tagName: ChartTypeMeta["tagName"];
    /** attributs prêts à être posés sur le web component */
    attrs: Record<string, string>;
    /** vrai si on a au moins une cellule numérique exploitable */
    hasData: boolean;
    /** données projetées pour l'export <table> RGAA */
    labels: string[];
    series: ProjectedSeries[];
    /** Nombre de lignes de données fournies. */
    rowCount: number;
    /** Vrai si l'axe X a été détecté comme "années" et passé en mode catégoriel string. */
    yearAxisDetected: boolean;
    /** Vrai si on a basculé sur <bar-line-chart> (double axe). */
    dualAxisActive: boolean;
    /** Avertissements gauge. */
    gaugeWarnings: GaugeWarning[];
    /** Avertissements double-axe (incompatibilités, manques de configuration). */
    dualAxisWarnings: DualAxisWarning[];
}

/* -------------------------------------------------------------------------- */
/* Méta + helpers                                                              */
/* -------------------------------------------------------------------------- */

export function getChartMeta(state: ChartState): ChartTypeMeta {
    return CHART_TYPES.find(c => c.value === state.chartType) ?? CHART_TYPES[0]!;
}

function columnAxis(col: DataColumn): "left" | "right" {
    return col.axis === "right" ? "right" : "left";
}

/**
 * Libellé de catégorie effectif pour une ligne : la colonne de gauche éditable
 * (`rowLead`) prime sur la colonne « catégorie » du tableur. Permet d'ajuster
 * les secteurs camembert / donut sans dupliquer la colonne principale.
 */
export function rowCategoryLabel(
    row: { rowLead?: string; cells: Record<string, string> },
    labelCol: DataColumn | undefined
): string {
    const lead = (row.rowLead ?? "").trim();
    if (lead.length > 0) return lead;
    return labelCol ? (row.cells[labelCol.id] ?? "").trim() : "";
}

/**
 * Sérialise une liste de libellés. Si ils ressemblent à des années, on
 * conserve la chaîne brute (catégoriel) — pas de nombre, pas d'interpolation.
 */
function serializeLabelsForX(labels: string[], yearAxis: boolean): (string | number)[] {
    if (yearAxis) {
        return labels.map(l => l.trim());
    }
    return labels.map(l => {
        const n = toNumber(l);
        return n === null ? l : n;
    });
}

/* -------------------------------------------------------------------------- */
/* Construction principale                                                     */
/* -------------------------------------------------------------------------- */

export function buildChartAttributes(state: ChartState): ChartAttributes {
    const meta = getChartMeta(state);

    const labelCol = state.columns.find(c => c.isLabel) ?? state.columns[0];
    const seriesCols = state.columns.filter(c => !c.isLabel);

    const labels = state.rows.map(r => rowCategoryLabel(r, labelCol));

    const yearAxisDetected = looksLikeYearAxis(labels);

    const series: ProjectedSeries[] = seriesCols.map(col => ({
        name: col.name,
        axis: columnAxis(col),
        values: state.rows.map(r => toNumber(r.cells[col.id]))
    }));

    const attrs: Record<string, string> = {};
    const gaugeWarnings: GaugeWarning[] = [];
    const dualAxisWarnings: DualAxisWarning[] = [];

    /* ---------------------------------------------------------------------- */
    /* CAS 1 : Jauge                                                           */
    /* ---------------------------------------------------------------------- */
    if (meta.tagName === "gauge-chart") {
        const firstSeries = series[0];
        const firstValue = firstSeries?.values[0] ?? null;

        if (firstValue === null) gaugeWarnings.push("no-numeric-value");
        if (state.rows.length > 1) gaugeWarnings.push("multiple-rows");
        if (state.gaugeTarget <= state.gaugeInit) gaugeWarnings.push("invalid-bounds");

        const safeValue = firstValue ?? state.gaugeInit;
        attrs.value = String(safeValue);
        attrs.init = String(state.gaugeInit);
        attrs.target = String(state.gaugeTarget);

        return {
            tagName: "gauge-chart",
            attrs,
            hasData: firstValue !== null,
            labels,
            series,
            rowCount: state.rows.length,
            yearAxisDetected: false,
            dualAxisActive: false,
            gaugeWarnings,
            dualAxisWarnings
        };
    }

    /* ---------------------------------------------------------------------- */
    /* CAS 2 : Détection double axe (au moins une série en "right")            */
    /* ---------------------------------------------------------------------- */
    const leftSeries = series.filter(s => s.axis === "left");
    const rightSeries = series.filter(s => s.axis === "right");
    const hasRightSeries = rightSeries.length > 0;

    const compatibleForDualAxis = (DUAL_AXIS_COMPATIBLE as readonly string[]).includes(
        state.chartType
    );

    if (hasRightSeries && !compatibleForDualAxis) {
        dualAxisWarnings.push("incompatible-chart-type");
    }
    if (hasRightSeries && state.chartType === "bar-horizontal") {
        // bar-horizontal ne supporte pas le double axe
        dualAxisWarnings.push("horizontal-not-supported");
    }

    const useDualAxis = hasRightSeries && compatibleForDualAxis;

    if (useDualAxis) {
        if (leftSeries.length === 0) dualAxisWarnings.push("missing-left-series");
        if (leftSeries.length > 1) dualAxisWarnings.push("multiple-left-series");
        if (rightSeries.length > 1) dualAxisWarnings.push("multiple-right-series");
        if (state.unitSecondary.trim().length === 0) dualAxisWarnings.push("missing-secondary-unit");

        const xLabelsSerialized = serializeLabelsForX(
            labels.length > 0 ? labels : [""],
            yearAxisDetected
        );

        const yBar = (leftSeries[0]?.values ?? []).map(v => (v === null ? 0 : v));
        const yLine = (rightSeries[0]?.values ?? []).map(v => (v === null ? 0 : v));

        attrs.x = JSON.stringify(xLabelsSerialized);
        attrs["y-bar"] = JSON.stringify(yBar);
        attrs["y-line"] = JSON.stringify(yLine);

        // Légende : suffixe de l'unité pour distinguer visuellement les axes.
        const decoratedNames: string[] = [];
        if (leftSeries[0]) {
            decoratedNames.push(decorateName(leftSeries[0].name, state.unit));
        }
        if (rightSeries[0]) {
            decoratedNames.push(decorateName(rightSeries[0].name, state.unitSecondary));
        }
        if (decoratedNames.length > 0) attrs.name = JSON.stringify(decoratedNames);

        if (state.unit.trim()) attrs["unit-tooltip-bar"] = state.unit.trim();
        if (state.unitSecondary.trim()) attrs["unit-tooltip-line"] = state.unitSecondary.trim();
        if (state.palette) attrs["selected-palette"] = state.palette;

        const hasData =
            labels.some(l => l.length > 0) &&
            (yBar.some(v => v !== 0) || yLine.some(v => v !== 0));

        return {
            tagName: "bar-line-chart",
            attrs,
            hasData,
            labels,
            series,
            rowCount: state.rows.length,
            yearAxisDetected,
            dualAxisActive: true,
            gaugeWarnings,
            dualAxisWarnings
        };
    }

    /* ---------------------------------------------------------------------- */
    /* CAS 3 : Standard (bar / line / pie / scatter / radar) — axe unique      */
    /* ---------------------------------------------------------------------- */

    const hasData =
        labels.some(l => l.length > 0) &&
        series.length > 0 &&
        series.some(s => s.values.some(v => v !== null));

    const xLabels = labels.length > 0 ? labels : [""];
    const ySeries =
        series.length > 0
            ? series.map(s => s.values.map(v => (v === null ? 0 : v)))
            : [xLabels.map(() => 0)];

    if (meta.tagName === "scatter-chart") {
        // scatter : x doit être numérique. Si les libellés sont des années,
        // on les garde en string pour préserver le rendu sans interpolation.
        if (yearAxisDetected) {
            const xPerSerie = series.length > 0 ? series.map(() => xLabels) : [xLabels];
            attrs.x = JSON.stringify(xPerSerie);
        } else {
            const numericLabels = xLabels.map((l, i) => {
                const n = toNumber(l);
                return n === null ? i : n;
            });
            const xPerSerie = series.length > 0 ? series.map(() => numericLabels) : [numericLabels];
            attrs.x = JSON.stringify(xPerSerie);
        }
        attrs.y = JSON.stringify(ySeries);
    } else if (meta.tagName === "line-chart") {
        const xVals = serializeLabelsForX(xLabels, yearAxisDetected);
        const xPerSerie = series.length > 0 ? series.map(() => xVals) : [xVals];
        attrs.x = JSON.stringify(xPerSerie);
        attrs.y = JSON.stringify(ySeries);
    } else {
        // bar / pie / radar : un seul tableau d'étiquettes (catégoriel) pour toutes les séries.
        attrs.x = JSON.stringify([xLabels]);
        attrs.y = JSON.stringify(ySeries);
    }

    if (series.length > 0) {
        attrs.name = JSON.stringify(series.map(s => decorateName(s.name, state.unit)));
    }

    if (state.chartType === "bar-horizontal") attrs.horizontal = "true";
    if (state.chartType === "bar-stacked") attrs.stacked = "true";
    if (state.chartType === "pie") attrs.fill = "true";
    if (state.chartType === "scatter" && state.showLine) attrs["show-line"] = "true";

    if (state.palette) attrs["selected-palette"] = state.palette;
    if (state.unit.trim().length > 0) attrs["unit-tooltip"] = state.unit.trim();

    return {
        tagName: meta.tagName,
        attrs,
        hasData,
        labels,
        series,
        rowCount: state.rows.length,
        yearAxisDetected,
        dualAxisActive: false,
        gaugeWarnings,
        dualAxisWarnings
    };
}

/**
 * Suffixe l'unité dans le nom de série pour la légende :
 * "Valeur" + "M€" → "Valeur (M€)". Ne fait rien si l'unité est vide ou déjà présente.
 */
function decorateName(name: string, unit: string): string {
    const u = unit.trim();
    if (u.length === 0) return name;
    if (name.includes(u)) return name;
    return `${name} (${u})`;
}

/* -------------------------------------------------------------------------- */
/* Export HTML / RGAA / JS                                                     */
/* -------------------------------------------------------------------------- */

function escapeHtml(input: string): string {
    return input
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function renderAttr(name: string, value: string): string {
    if (value.includes("'") && !value.includes('"')) {
        return `${name}="${value}"`;
    }
    return `${name}='${value}'`;
}

function indent(text: string, count: number): string {
    const pad = " ".repeat(count);
    return text
        .split("\n")
        .map(l => (l.length > 0 ? pad + l : l))
        .join("\n");
}

function buildSrOnlyTable(state: ChartState, computed: ChartAttributes): string {
    if (computed.tagName === "gauge-chart") {
        const caption = state.title ? escapeHtml(state.title) : "Jauge";
        return `<table class="fr-sr-only">
  <caption>${caption}${state.unit ? ` (en ${escapeHtml(state.unit)})` : ""}</caption>
  <thead>
    <tr><th scope="col">Indicateur</th><th scope="col">Valeur</th></tr>
  </thead>
  <tbody>
    <tr><th scope="row">Valeur de départ</th><td>${escapeHtml(String(state.gaugeInit))}</td></tr>
    <tr><th scope="row">Valeur actuelle</th><td>${escapeHtml(String(computed.attrs.value ?? ""))}</td></tr>
    <tr><th scope="row">Valeur cible</th><td>${escapeHtml(String(state.gaugeTarget))}</td></tr>
  </tbody>
</table>`;
    }

    const labelCol = state.columns.find(c => c.isLabel) ?? state.columns[0];
    const labelHeader = labelCol ? escapeHtml(labelCol.name) : "Catégorie";

    const showRangColumn = state.rows.some(
        r => (r.rowLead ?? "").trim().length > 0
    );

    const headerCells = [
        ...(showRangColumn
            ? [
                  `<th scope="col">Libellé utilisé dans le graphique</th>`,
                  `<th scope="col">${labelHeader}</th>`
              ]
            : [`<th scope="col">${labelHeader}</th>`]),
        ...computed.series.map(s => {
            const axisHint =
                s.axis === "right"
                    ? ` (axe droit${state.unitSecondary ? `, ${escapeHtml(state.unitSecondary)}` : ""})`
                    : state.unit
                    ? ` (axe gauche, ${escapeHtml(state.unit)})`
                    : "";
            return `<th scope="col">${escapeHtml(s.name)}${axisHint}</th>`;
        })
    ].join("");

    const bodyRows = state.rows
        .map((row, i) => {
            const effective = rowCategoryLabel(row, labelCol);
            const baseOnly = labelCol ? (row.cells[labelCol.id] ?? "").trim() : "";

            const firstCells = showRangColumn
                ? [
                      `<th scope="row">${escapeHtml(effective)}</th>`,
                      `<td>${escapeHtml(baseOnly)}</td>`
                  ]
                : [`<th scope="row">${escapeHtml(effective)}</th>`];

            const cells = [
                ...firstCells,
                ...computed.series.map(s => {
                    const v = s.values[i];
                    return `<td>${v === null ? "" : escapeHtml(String(v))}</td>`;
                })
            ].join("");
            return `<tr>${cells}</tr>`;
        })
        .join("\n");

    const caption = state.title ? escapeHtml(state.title) : "Données du graphique";

    return `<table class="fr-sr-only">
  <caption>${caption}</caption>
  <thead>
    <tr>${headerCells}</tr>
  </thead>
  <tbody>
${indent(bodyRows, 4)}
  </tbody>
</table>`;
}

export function buildExportSnippet(state: ChartState, computed: ChartAttributes): string {
    const tag = computed.tagName;

    const attributesSerialized = Object.entries(computed.attrs)
        .map(([k, v]) => "  " + renderAttr(k, v))
        .join("\n");

    const figcaption = state.source
        ? `\n  <figcaption class="fr-text--sm fr-mt-2w">Source : ${escapeHtml(state.source)}</figcaption>`
        : "";

    const heading = state.title
        ? `\n<h3 class="fr-h5">${escapeHtml(state.title)}</h3>`
        : "";

    const srTable = buildSrOnlyTable(state, computed);

    const dualAxisNote = computed.dualAxisActive
        ? `\n<!--
  Configuration double axe Y (yAxis multiple) :
  - Axe gauche (y-bar) : ${escapeHtml(state.unit || "—")}
  - Axe droit  (y-line): ${escapeHtml(state.unitSecondary || "—")}
  La balise <bar-line-chart> instancie automatiquement les deux axes verticaux,
  positionne la série "y-bar" sur l'axe principal et la série "y-line" sur
  l'axe secondaire (rendu LIGNE forcé pour bien marquer la différence).
-->`
        : "";

    const yearNote = computed.yearAxisDetected
        ? `\n<!--
  Axe X détecté en "années" : les libellés sont passés en mode catégoriel
  (string), garantissant qu'aucune valeur intermédiaire (ex : 2024,5) ni
  séparateur de milliers (ex : 2 024) n'apparaisse au rendu.
-->`
        : "";

    const bootstrap = `<script>
(function () {
    if (window.customElements && window.customElements.get("${tag}")) return;
    var s = document.createElement("script");
    s.type = "module";
    s.src = "/static/dsfr-chart/DSFRChart.js";
    document.head.appendChild(s);
    var l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = "/static/dsfr-chart/DSFRChart.css";
    document.head.appendChild(l);
})();
</script>`;

    return `<!-- Générateur de Graphiques DSFR en ligne — bloc d'intégration prêt à coller -->${dualAxisNote}${yearNote}
<figure class="fr-content-media" role="group" aria-label="${escapeHtml(state.title || "Graphique")}">
${heading}
  <${tag}
${attributesSerialized}
  ></${tag}>
${indent(srTable, 2)}${figcaption}
</figure>

${bootstrap}
`;
}
