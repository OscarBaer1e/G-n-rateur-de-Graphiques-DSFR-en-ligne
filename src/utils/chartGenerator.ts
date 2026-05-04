// filepath: src/utils/chartGenerator.ts
// Sérialisation du state vers les attributs des web components @gouvfr/dsfr-chart
// + génération du code d'export Sites Faciles : HTML + table fr-sr-only RGAA +
//   Chart.js sur <canvas> (les web components DSFR ne sont pas chargés dans le CMS).
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
    type ChartType,
    type ChartTypeMeta,
    type DataColumn
} from "../types";
import {
    EXPORT_CHART_HOST_MAX_HEIGHT_PX,
    EXPORT_CHART_HOST_MIN_HEIGHT_PX,
    EXPORT_CHART_MAX_WIDTH_PX,
    exportChartLayout,
    exportLegendOptions,
    exportPaletteColors,
    exportTooltipOptions
} from "./exportChartStyle";

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
    const seriesColsAll = state.columns.filter(c => !c.isLabel);
    /** Camembert / donut : une seule série de valeurs (parts d'un même tout). */
    const isSectorChart = state.chartType === "pie" || state.chartType === "donut";
    const seriesCols = isSectorChart ? seriesColsAll.slice(0, 1) : seriesColsAll;

    const labels = isSectorChart
        ? state.rows.map(r => (labelCol ? (r.cells[labelCol.id] ?? "").trim() : ""))
        : state.rows.map(r => rowCategoryLabel(r, labelCol));

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
        if (meta.tagName === "pie-chart") {
            /**
             * Camembert / donut : la légende DSFR suit l'attribut `name`, qui doit
             * lister un libellé par secteur (comme la doc officielle), pas le nom de
             * la colonne « valeur » — sinon on obtient « Série 1 », « Série 2 », etc.
             * @see https://gouvernementfr.github.io/dsfr-chart/
             */
            const sectorLegend = xLabels.map((lab, i) => {
                const t = lab.trim();
                if (t.length > 0) return t;
                return `Secteur ${i + 1}`;
            });
            attrs.name = JSON.stringify(sectorLegend);
        } else {
            attrs.name = JSON.stringify(series.map(s => decorateName(s.name, state.unit)));
        }
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

function slugifyCanvasIdPart(title: string): string {
    return title
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") || "graph";
}

function parseJsonNumberArray(raw: string | undefined): number[] {
    if (!raw) return [];
    try {
        const v = JSON.parse(raw) as unknown;
        return Array.isArray(v) ? v.map(x => (typeof x === "number" && Number.isFinite(x) ? x : Number(x) || 0)) : [];
    } catch {
        return [];
    }
}

/** Libellés X alignés sur `attrs.x` (ligne = années / nombres sérialisés comme dans le preview DSFR). */
function chartLabelsJsonFromAttrs(computed: ChartAttributes, fallbackLabelsJson: string): string {
    const raw = computed.attrs.x;
    if (!raw) return fallbackLabelsJson;
    try {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed) && parsed.length > 0) {
            const first = parsed[0];
            if (Array.isArray(first)) return JSON.stringify(first);
        }
    } catch {
        /* ignore */
    }
    return fallbackLabelsJson;
}

/** Libellés secteurs camembert / donut (alignés sur `attrs.name` du preview). */
function pieLabelsJsonFromAttrs(computed: ChartAttributes, fallbackLabelsJson: string): string {
    const raw = computed.attrs.name;
    if (!raw) return fallbackLabelsJson;
    try {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed) && parsed.length > 0 && parsed.every(x => typeof x === "string")) {
            return JSON.stringify(parsed);
        }
    } catch {
        /* ignore */
    }
    return fallbackLabelsJson;
}

/**
 * Bloc d'intégration **Sites Faciles** : conteneur + canvas + Chart.js (CDN),
 * même principe que les snippets qui fonctionnent dans le CMS.
 * Les web components @gouvfr/dsfr-chart ne sont en général pas disponibles sur
 * la page d'article (chemins /static/ inexistants, pas de bundle Vue).
 */
export function buildExportSnippet(state: ChartState, computed: ChartAttributes): string {
    const canvasId = `sfchart_${slugifyCanvasIdPart(state.title || "graph")}_${Date.now().toString(36)}`;

    const titleBlock = state.title.trim()
        ? `\n      <h3 class="fr-h5 fr-mb-1w">${escapeHtml(state.title.trim())}</h3>`
        : "";

    const descriptionBlock =
        state.description.trim().length > 0
            ? `\n      <p class="fr-text--sm fr-mb-2w" style="color:#666;white-space:pre-wrap;">${escapeHtml(state.description.trim())}</p>`
            : "";

    const sourceBlock = state.source.trim()
        ? `\n      <p class="fr-text--sm fr-mt-2w" style="color:#666;">Source : ${escapeHtml(state.source.trim())}</p>`
        : "";

    const srTable = buildSrOnlyTable(state, computed);
    const srTableIndented = indent(srTable, 6);

    const labelsJson = JSON.stringify(computed.labels);
    const chartScriptBody = buildSitesFacilesChartJsBody(state, computed, canvasId, labelsJson);

    return `<!-- Générateur de Graphiques DSFR en ligne — bloc Sites Faciles (Chart.js + canvas, compatible CMS) -->
<div class="fr-container" style="background: #fff; padding: 20px; border: 1px solid #e5e5e5; font-family: 'Marianne', arial, sans-serif; box-sizing: border-box;">
  <figure role="group" aria-label="${escapeHtml(state.title || "Graphique")}">${titleBlock}${descriptionBlock}
    <div style="background: #f6f6f6; border-radius: 4px; padding: 1.5rem; max-width: ${EXPORT_CHART_MAX_WIDTH_PX}px; margin: 0 auto; box-sizing: border-box;">
      <div style="position: relative; width: 100%; min-height: ${EXPORT_CHART_HOST_MIN_HEIGHT_PX}px; height: clamp(${EXPORT_CHART_HOST_MIN_HEIGHT_PX}px, 42vh, ${EXPORT_CHART_HOST_MAX_HEIGHT_PX}px);">
        <canvas id="${escapeHtml(canvasId)}" aria-label="${escapeHtml(state.title || "Graphique")}"></canvas>
      </div>
    </div>${sourceBlock}
${srTableIndented}
  </figure>
</div>

<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<script>
${chartScriptBody}
</script>
`;
}

/** Scatter : une série par colonne, points alignés sur `attrs.x` / `attrs.y`. */
function buildScatterSitesFacilesScript(
    state: ChartState,
    computed: ChartAttributes,
    canvasId: string,
    unit: string
): string {
    const series = computed.series;
    const colors = exportPaletteColors(state.palette, Math.max(series.length, 1));
    let xPer: unknown[][] = [];
    let yPer: unknown[][] = [];
    try {
        xPer = JSON.parse(computed.attrs.x ?? "[]") as unknown[][];
        yPer = JSON.parse(computed.attrs.y ?? "[]") as unknown[][];
    } catch {
        xPer = [];
        yPer = [];
    }

    const datasets = series.map((s, i) => {
        const xs = (Array.isArray(xPer[i]) ? xPer[i] : xPer[0]) ?? [];
        const ys = (Array.isArray(yPer[i]) ? yPer[i] : []) as unknown[];
        const pts = (xs as unknown[]).map((x, j) => {
            let xv: number;
            const n = toNumber(typeof x === "string" ? x : String(x));
            if (n !== null) xv = n;
            else if (typeof x === "number" && Number.isFinite(x)) xv = x;
            else xv = j;
            const rawY = (ys as unknown[])[j];
            const yv =
                typeof rawY === "number" && Number.isFinite(rawY) ? rawY : Number(rawY) || 0;
            return { x: xv, y: yv };
        });
        const c = colors[i % colors.length]!;
        return {
            label: decorateName(s.name, unit),
            data: pts,
            backgroundColor: c,
            borderColor: c,
            pointRadius: 5,
            showLine: state.showLine
        };
    });

    const showLegend = series.length > 1;
    const scatterOptions: Record<string, unknown> = {
        responsive: true,
        maintainAspectRatio: false,
        layout: exportChartLayout(showLegend),
        plugins: {
            legend: exportLegendOptions(showLegend),
            tooltip: exportTooltipOptions()
        },
        scales: {
            x: {
                type: "linear" as const,
                ticks: { font: { family: "Marianne" } },
                grid: { color: "#e5e5e5" }
            },
            y: {
                beginAtZero: true,
                title: unit
                    ? {
                          display: true,
                          text: unit,
                          font: { weight: "bold" as const, family: "Marianne" }
                      }
                    : { display: false },
                ticks: { font: { family: "Marianne" } },
                grid: { color: "#e5e5e5" }
            }
        }
    };

    const scatterData = { datasets };

    return `(function() {
  var initChart = function() {
    var canvas = document.getElementById(${JSON.stringify(canvasId)});
    if (!canvas || typeof Chart === "undefined") return;
    new Chart(canvas, {
      type: "scatter",
      data: ${JSON.stringify(scatterData)},
      options: ${JSON.stringify(scatterOptions)}
    });
  };
  if (document.readyState === "complete") initChart();
  else window.addEventListener("load", initChart);
})();`;
}

/**
 * Corps du script : init Chart.js après chargement du canvas.
 * Généré en chaîne pour éviter toute dépendance runtime côté outil.
 */
function buildSitesFacilesChartJsBody(
    state: ChartState,
    computed: ChartAttributes,
    canvasId: string,
    labelsJson: string
): string {
    const unit = state.unit.trim();
    const unitSec = state.unitSecondary.trim();
    const type = state.chartType;

    if (computed.tagName === "gauge-chart") {
        const val = Number(computed.attrs.value) || 0;
        const init = Number(computed.attrs.init) || 0;
        const target = Number(computed.attrs.target) || 100;
        const maxY = Math.max(target, val, init, 1);
        const labelGauge = state.title.trim() || "Indicateur";
        const barHue = exportPaletteColors(state.palette, 1)[0] ?? "#000091";
        const gaugeData = {
            labels: [labelGauge],
            datasets: [
                {
                    label: unit ? `Valeur (${unit})` : "Valeur",
                    data: [val],
                    backgroundColor: barHue,
                    hoverBackgroundColor: "#1212ff",
                    barThickness: 48
                }
            ]
        };
        const gaugeOptions = {
            responsive: true,
            maintainAspectRatio: false,
            layout: exportChartLayout(false),
            plugins: {
                legend: exportLegendOptions(false),
                tooltip: exportTooltipOptions()
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { font: { family: "Marianne", size: 12 }, color: "#161616" }
                },
                y: {
                    beginAtZero: true,
                    max: maxY,
                    ticks: { font: { family: "Marianne" } },
                    grid: { color: "#e5e5e5" }
                }
            }
        };
        return `(function() {
  var initChart = function() {
    var canvas = document.getElementById(${JSON.stringify(canvasId)});
    if (!canvas || typeof Chart === "undefined") return;
    new Chart(canvas, {
      type: "bar",
      data: ${JSON.stringify(gaugeData)},
      options: ${JSON.stringify(gaugeOptions)}
    });
  };
  if (document.readyState === "complete") initChart();
  else window.addEventListener("load", initChart);
})();`;
    }

    if (computed.dualAxisActive) {
        const yBar = parseJsonNumberArray(computed.attrs["y-bar"]);
        const yLine = parseJsonNumberArray(computed.attrs["y-line"]);
        let xLabels: unknown[];
        try {
            const xLabelsParsed = JSON.parse(computed.attrs.x ?? labelsJson) as unknown;
            if (Array.isArray(xLabelsParsed) && xLabelsParsed.length > 0 && !Array.isArray(xLabelsParsed[0])) {
                xLabels = xLabelsParsed;
            } else if (
                Array.isArray(xLabelsParsed) &&
                xLabelsParsed.length > 0 &&
                Array.isArray((xLabelsParsed as unknown[])[0])
            ) {
                xLabels = (xLabelsParsed as unknown[][])[0]!;
            } else {
                xLabels = JSON.parse(labelsJson) as unknown[];
            }
        } catch {
            xLabels = JSON.parse(labelsJson) as unknown[];
        }
        const dsBar = computed.series.find(s => s.axis === "left");
        const dsLine = computed.series.find(s => s.axis === "right");
        const nameBar = dsBar ? decorateName(dsBar.name, unit) : "Barres";
        const nameLine = dsLine ? decorateName(dsLine.name, unitSec || unit) : "Ligne";
        const cols = exportPaletteColors(state.palette, 2);
        const barColor = cols[0] ?? "#000091";
        const lineColor = "#E1000F";
        const dualData = {
            labels: xLabels,
            datasets: [
                {
                    type: "bar" as const,
                    label: nameBar,
                    data: yBar,
                    backgroundColor: barColor,
                    hoverBackgroundColor: "#1212ff",
                    yAxisID: "y",
                    order: 2
                },
                {
                    type: "line" as const,
                    label: nameLine,
                    data: yLine,
                    borderColor: lineColor,
                    backgroundColor: "rgba(225, 0, 15, 0.12)",
                    yAxisID: "y1",
                    tension: 0.2,
                    order: 1,
                    fill: false
                }
            ]
        };
        const dualOptions = {
            responsive: true,
            maintainAspectRatio: false,
            layout: exportChartLayout(true),
            interaction: { mode: "index" as const, intersect: false },
            plugins: {
                legend: exportLegendOptions(true),
                tooltip: exportTooltipOptions()
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { font: { family: "Marianne", size: 12 }, color: "#161616" }
                },
                y: {
                    type: "linear" as const,
                    position: "left" as const,
                    title: {
                        display: true,
                        text: unit || "Axe gauche",
                        font: { family: "Marianne", weight: "bold" as const }
                    },
                    grid: { color: "#e5e5e5" },
                    beginAtZero: true
                },
                y1: {
                    type: "linear" as const,
                    position: "right" as const,
                    title: {
                        display: true,
                        text: unitSec || "Axe droit",
                        font: { family: "Marianne", weight: "bold" as const }
                    },
                    grid: { drawOnChartArea: false },
                    beginAtZero: true
                }
            }
        };
        return `(function() {
  var initChart = function() {
    var canvas = document.getElementById(${JSON.stringify(canvasId)});
    if (!canvas || typeof Chart === "undefined") return;
    new Chart(canvas, {
      type: "bar",
      data: ${JSON.stringify(dualData)},
      options: ${JSON.stringify(dualOptions)}
    });
  };
  if (document.readyState === "complete") initChart();
  else window.addEventListener("load", initChart);
})();`;
    }

    if (type === "pie" || type === "donut") {
        const vals = (computed.series[0]?.values ?? []).map(v => (v === null ? 0 : v));
        const sectorLabelsJson = pieLabelsJsonFromAttrs(computed, labelsJson);
        let sectorLabels: string[] = [];
        try {
            const p = JSON.parse(sectorLabelsJson) as unknown;
            if (Array.isArray(p) && p.every(x => typeof x === "string")) sectorLabels = p as string[];
        } catch {
            sectorLabels = [];
        }
        if (sectorLabels.length === 0) {
            try {
                const p = JSON.parse(labelsJson) as unknown;
                if (Array.isArray(p) && p.every(x => typeof x === "string")) sectorLabels = p as string[];
            } catch {
                sectorLabels = [];
            }
        }
        const n = Math.max(vals.length, sectorLabels.length, 1);
        const sliceColors = exportPaletteColors(state.palette, n);
        while (sectorLabels.length < vals.length) {
            sectorLabels.push(`Secteur ${sectorLabels.length + 1}`);
        }
        const pieLabel =
            computed.series[0] != null
                ? decorateName(computed.series[0].name, state.unit.trim())
                : state.unit
                  ? `Valeur (${state.unit})`
                  : "Valeur";
        const pieData = {
            labels: sectorLabels.slice(0, vals.length),
            datasets: [
                {
                    label: pieLabel,
                    data: vals,
                    backgroundColor: sliceColors.slice(0, vals.length),
                    hoverOffset: 6
                }
            ]
        };
        const pieOptions = {
            responsive: true,
            maintainAspectRatio: false,
            cutout: type === "donut" ? "55%" : 0,
            layout: exportChartLayout(vals.length > 1),
            plugins: {
                legend: exportLegendOptions(vals.length > 1),
                tooltip: exportTooltipOptions()
            }
        };
        return `(function() {
  var initChart = function() {
    var canvas = document.getElementById(${JSON.stringify(canvasId)});
    if (!canvas || typeof Chart === "undefined") return;
    new Chart(canvas, {
      type: "doughnut",
      data: ${JSON.stringify(pieData)},
      options: ${JSON.stringify(pieOptions)}
    });
  };
  if (document.readyState === "complete") initChart();
  else window.addEventListener("load", initChart);
})();`;
    }

    if (type === "scatter") {
        return buildScatterSitesFacilesScript(state, computed, canvasId, unit);
    }

    if (type === "radar") {
        const vals = (computed.series[0]?.values ?? []).map(v => (v === null ? 0 : v));
        const lab = computed.series[0]
            ? decorateName(computed.series[0].name, unit)
            : "Série";
        const c0 = exportPaletteColors(state.palette, 1)[0] ?? "#000091";
        const border = c0;
        const fill =
            c0.startsWith("#") && c0.length === 7
                ? `${c0}33`
                : c0.startsWith("#") && c0.length === 9
                  ? c0
                  : "rgba(0,0,145,0.2)";
        let radarLabs: string[];
        try {
            radarLabs = JSON.parse(labelsJson) as string[];
        } catch {
            radarLabs = computed.labels;
        }
        const radarData = {
            labels: radarLabs,
            datasets: [{ label: lab, data: vals, borderColor: border, backgroundColor: fill }]
        };
        const radarOptions = {
            responsive: true,
            maintainAspectRatio: false,
            layout: exportChartLayout(false),
            plugins: {
                legend: exportLegendOptions(false),
                tooltip: exportTooltipOptions()
            },
            scales: {
                r: {
                    beginAtZero: true,
                    ticks: { font: { family: "Marianne" } },
                    grid: { color: "#e5e5e5" },
                    pointLabels: { font: { family: "Marianne", size: 11 } }
                }
            }
        };
        return `(function() {
  var initChart = function() {
    var canvas = document.getElementById(${JSON.stringify(canvasId)});
    if (!canvas || typeof Chart === "undefined") return;
    new Chart(canvas, {
      type: "radar",
      data: ${JSON.stringify(radarData)},
      options: ${JSON.stringify(radarOptions)}
    });
  };
  if (document.readyState === "complete") initChart();
  else window.addEventListener("load", initChart);
})();`;
    }

    const barLineLabelsJson = chartLabelsJsonFromAttrs(computed, labelsJson);
    return buildBarLineExportScript(state, type, computed, canvasId, barLineLabelsJson, unit);
}

function buildBarLineExportScript(
    state: ChartState,
    type: ChartType,
    computed: ChartAttributes,
    canvasId: string,
    labelsJson: string,
    unit: string
): string {
    const stacked = type === "bar-stacked";
    const horizontal = type === "bar-horizontal";
    const isLine = type === "line";
    const colors = exportPaletteColors(state.palette, Math.max(computed.series.length, 1));

    let xLabels: unknown[];
    try {
        xLabels = JSON.parse(labelsJson) as unknown[];
    } catch {
        xLabels = [];
    }

    const datasets = computed.series.map((s, i) => {
        const data = s.values.map(v => (v === null ? 0 : v));
        const color = colors[i % colors.length]!;
        const base: Record<string, unknown> = {
            label: decorateName(s.name, unit),
            data,
            backgroundColor: isLine ? "transparent" : color,
            borderColor: color,
            borderWidth: isLine ? 2 : 0,
            fill: false,
            tension: isLine ? 0.2 : 0
        };
        if (stacked) (base as { stack?: string }).stack = "s0";
        if (!isLine) {
            (base as { hoverBackgroundColor?: string }).hoverBackgroundColor = "#1212ff";
            (base as { barThickness?: number }).barThickness = 50;
        }
        return base;
    });

    const chartType = isLine ? "line" : "bar";
    const showLegend = computed.series.length > 1;

    const titleY = unit
        ? { display: true, text: unit, font: { weight: "bold" as const, family: "Marianne" } }
        : { display: false };

    let scales: Record<string, unknown>;
    if (horizontal && stacked) {
        scales = {
            x: {
                stacked: true,
                beginAtZero: true,
                title: titleY,
                grid: { color: "#e5e5e5" },
                ticks: { font: { family: "Marianne" } }
            },
            y: {
                stacked: true,
                grid: { display: false },
                ticks: { font: { family: "Marianne", size: 12 }, color: "#161616" }
            }
        };
    } else if (horizontal) {
        scales = {
            y: {
                grid: { display: false },
                ticks: { font: { family: "Marianne", size: 12 }, color: "#161616" }
            },
            x: {
                beginAtZero: true,
                title: titleY,
                grid: { color: "#e5e5e5" },
                ticks: { font: { family: "Marianne" } }
            }
        };
    } else if (stacked) {
        scales = {
            x: {
                stacked: true,
                grid: { display: false },
                ticks: { font: { family: "Marianne", size: 12 }, color: "#161616" }
            },
            y: {
                stacked: true,
                beginAtZero: true,
                title: titleY,
                grid: { color: "#e5e5e5" },
                ticks: { font: { family: "Marianne" } }
            }
        };
    } else {
        scales = {
            x: {
                grid: { display: false },
                ticks: { font: { family: "Marianne", size: 12 }, color: "#161616" }
            },
            y: {
                beginAtZero: true,
                title: titleY,
                grid: { color: "#e5e5e5" },
                ticks: { font: { family: "Marianne" } }
            }
        };
    }

    const barLineData = { labels: xLabels, datasets };
    const barLineOptions: Record<string, unknown> = {
        responsive: true,
        maintainAspectRatio: false,
        ...(horizontal ? { indexAxis: "y" } : {}),
        layout: exportChartLayout(showLegend),
        plugins: {
            legend: exportLegendOptions(showLegend),
            tooltip: exportTooltipOptions()
        },
        scales
    };

    return `(function() {
  var initChart = function() {
    var canvas = document.getElementById(${JSON.stringify(canvasId)});
    if (!canvas || typeof Chart === "undefined") return;
    new Chart(canvas, {
      type: ${JSON.stringify(chartType)},
      data: ${JSON.stringify(barLineData)},
      options: ${JSON.stringify(barLineOptions)}
    });
  };
  if (document.readyState === "complete") initChart();
  else window.addEventListener("load", initChart);
})();`;
}
