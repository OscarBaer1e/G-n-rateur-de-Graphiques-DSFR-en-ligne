// filepath: src/utils/echartsExport.ts
// Export HTML pour Sites Faciles : ECharts (CDN) + style dataviz proche DSFR
// + tableau fr-table fr-sr-only (RGAA). L’aperçu dans l’app reste sur @gouvfr/dsfr-chart.

import type { ChartState, DsfrPalette } from "../types";
import {
    buildSrOnlyTable,
    decorateSeriesName,
    type ChartAttributes
} from "./chartGenerator";

const ECHARTS_CDN = "https://cdn.jsdelivr.net/npm/echarts@5.5.0/dist/echarts.min.js";

/** Couleurs type dataviz DSFR (Bleu France, Vert Émeraude, etc.) */
const COLORS_DEFAULT = [
    "#000091",
    "#009081",
    "#E10110",
    "#FF9940",
    "#A3696F",
    "#6A6A6A",
    "#696AF0",
    "#3B1F2B"
];

function paletteColors(p: DsfrPalette): string[] {
    switch (p) {
        case "neutral":
            return ["#3A3A3A", "#6A6A6A", "#929292", "#BBBBBB", "#161616"];
        case "sequentialAscending":
            return ["#F5F5FE", "#CACAFB", "#9898F8", "#6666F4", "#000091"];
        case "sequentialDescending":
            return ["#000091", "#6666F4", "#9898F8", "#CACAFB", "#F5F5FE"];
        case "divergentAscending":
            return ["#000091", "#CACAFB", "#FFFFFF", "#B8FECF", "#009081"];
        case "divergentDescending":
            return ["#009081", "#B8FECF", "#FFFFFF", "#CACAFB", "#000091"];
        case "categorical":
        case "default":
        default:
            return COLORS_DEFAULT;
    }
}

function escapeHtml(input: string): string {
    return input
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function safeJsonForScript(obj: unknown): string {
    return JSON.stringify(obj).replace(/</g, "\\u003c");
}

function indent(text: string, count: number): string {
    const pad = " ".repeat(count);
    return text
        .split("\n")
        .map(l => (l.length > 0 ? pad + l : l))
        .join("\n");
}

function chartDomId(state: ChartState): string {
    let slug = (state.title || "graphique")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") || "graphique";
    if (!/^[a-z]/i.test(slug)) slug = "g-" + slug;
    let h = 0;
    const seed = `${state.title}|${state.rows.length}|${state.chartType}`;
    for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
    const suffix = Math.abs(h).toString(36).slice(0, 8);
    const id = `dsfr-ec-${slug}-${suffix}`.replace(/[^a-zA-Z0-9-]/g, "");
    return id.length > 90 ? id.slice(0, 90) : id;
}

const textStyleAxis = {
    fontFamily: "Marianne, sans-serif",
    color: "#666666"
};

const baseTooltipAxis = {
    trigger: "axis" as const,
    axisPointer: { type: "shadow" as const },
    backgroundColor: "#1E1E1E",
    textStyle: {
        color: "#FFFFFF",
        fontFamily: "Marianne, sans-serif",
        fontSize: 14
    },
    borderWidth: 0,
    padding: [10, 15]
};

const baseLegend = {
    show: true,
    bottom: 0,
    textStyle: {
        fontFamily: "Marianne, sans-serif",
        fontSize: 14,
        color: "#161616"
    },
    itemGap: 20
};

const baseGrid = {
    left: "3%",
    right: "4%",
    bottom: "12%",
    containLabel: true
};

function buildOption(state: ChartState, computed: ChartAttributes): Record<string, unknown> {
    const colors = paletteColors(state.palette);
    const labels = computed.labels.map(l => (l.trim() === "" ? " " : l.trim()));

    if (computed.tagName === "gauge-chart") {
        const v = Number(computed.attrs.value ?? state.gaugeInit);
        const min = state.gaugeInit;
        const max = state.gaugeTarget;
        const name = computed.series[0]?.name
            ? decorateSeriesName(computed.series[0].name, state.unit)
            : state.unit.trim()
            ? `Valeur (${state.unit.trim()})`
            : "Valeur";
        return {
            color: colors,
            tooltip: {
                trigger: "item",
                backgroundColor: "#1E1E1E",
                textStyle: {
                    color: "#FFFFFF",
                    fontFamily: "Marianne, sans-serif",
                    fontSize: 14
                },
                borderWidth: 0
            },
            legend: { ...baseLegend, data: [name] },
            series: [
                {
                    type: "gauge",
                    min,
                    max,
                    detail: {
                        formatter: "{value}",
                        fontFamily: "Marianne, sans-serif",
                        color: "#161616"
                    },
                    data: [{ value: v, name }]
                }
            ]
        };
    }

    if (computed.dualAxisActive) {
        const left = computed.series.find(s => s.axis === "left");
        const right = computed.series.find(s => s.axis === "right");
        const yBar = (left?.values ?? []).map(v => (v === null ? null : v));
        const yLine = (right?.values ?? []).map(v => (v === null ? null : v));
        const barName = left ? decorateSeriesName(left.name, state.unit) : "Série 1";
        const lineName = right ? decorateSeriesName(right.name, state.unitSecondary) : "Série 2";
        return {
            color: colors,
            tooltip: { ...baseTooltipAxis, trigger: "axis" },
            legend: { ...baseLegend, data: [barName, lineName] },
            grid: baseGrid,
            xAxis: {
                type: "category",
                data: labels,
                axisLabel: { ...textStyleAxis },
                axisLine: { lineStyle: { color: "#DDDDDD" } },
                axisTick: { show: false }
            },
            yAxis: [
                {
                    type: "value",
                    name: state.unit.trim() || undefined,
                    position: "left",
                    nameTextStyle: { ...textStyleAxis, padding: [0, 0, 10, 0] },
                    axisLabel: textStyleAxis,
                    splitLine: {
                        lineStyle: { color: "#EEEEEE", type: "dashed" as const }
                    }
                },
                {
                    type: "value",
                    name: state.unitSecondary.trim() || undefined,
                    position: "right",
                    nameTextStyle: { ...textStyleAxis, padding: [0, 0, 10, 0] },
                    axisLabel: textStyleAxis,
                    splitLine: { show: false }
                }
            ],
            series: [
                {
                    name: barName,
                    type: "bar",
                    yAxisIndex: 0,
                    barGap: "15%",
                    data: yBar
                },
                {
                    name: lineName,
                    type: "line",
                    yAxisIndex: 1,
                    smooth: false,
                    data: yLine
                }
            ]
        };
    }

    if (state.chartType === "pie" || state.chartType === "donut") {
        const s0 = computed.series[0];
        const data = labels.map((name, i) => ({
            name,
            value: s0 ? (s0.values[i] ?? 0) : 0
        }));
        const radius =
            state.chartType === "donut" ? (["45%", "70%"] as const) : ("70%" as const);
        const legendNames = data.map(d => d.name);
        return {
            color: colors,
            tooltip: {
                trigger: "item",
                backgroundColor: "#1E1E1E",
                textStyle: {
                    color: "#FFFFFF",
                    fontFamily: "Marianne, sans-serif",
                    fontSize: 14
                },
                borderWidth: 0
            },
            legend: {
                ...baseLegend,
                orient: "horizontal",
                data: legendNames.length > 0 ? legendNames : [""]
            },
            series: [
                {
                    type: "pie",
                    radius,
                    data,
                    label: { fontFamily: "Marianne, sans-serif", color: "#161616" }
                }
            ]
        };
    }

    if (state.chartType === "radar") {
        const labs = labels.length > 0 ? labels : [""];
        const rSeries =
            computed.series.length > 0
                ? computed.series
                : [{ name: "—", axis: "left" as const, values: labs.map(() => null) }];
        const valsPerInd = labs.map((_, i) =>
            Math.max(
                1,
                ...rSeries.map(s => (s.values[i] === null ? 0 : (s.values[i] as number)))
            )
        );
        const indicators = labs.map((name, i) => ({
            name,
            max: Math.ceil((valsPerInd[i] ?? 1) * 1.15)
        }));
        return {
            color: colors,
            tooltip: {},
            legend: { ...baseLegend, data: rSeries.map(s => decorateSeriesName(s.name, state.unit)) },
            radar: {
                indicator: indicators,
                axisName: { fontFamily: "Marianne, sans-serif", color: "#666666" }
            },
            series: [
                {
                    type: "radar",
                    data: rSeries.map(s => ({
                        value: s.values.map(v => (v === null ? 0 : v)),
                        name: decorateSeriesName(s.name, state.unit)
                    }))
                }
            ]
        };
    }

    if (state.chartType === "scatter") {
        const scSeries =
            computed.series.length > 0
                ? computed.series
                : [{ name: "—", axis: "left" as const, values: labels.map(() => null) }];
        const seriesList = scSeries.map(s => ({
            name: decorateSeriesName(s.name, state.unit),
            type: (state.showLine ? "line" : "scatter") as "line" | "scatter",
            data: s.values.map(v => (v === null ? null : v)),
            symbolSize: state.showLine ? 8 : 10,
            showSymbol: true,
            smooth: false,
            lineStyle: state.showLine ? { width: 2 } : undefined
        }));
        return {
            color: colors,
            tooltip: { ...baseTooltipAxis },
            legend: {
                ...baseLegend,
                data: scSeries.map(s => decorateSeriesName(s.name, state.unit))
            },
            grid: baseGrid,
            xAxis: {
                type: "category",
                data: labels.length > 0 ? labels : [""],
                axisLabel: { ...textStyleAxis, rotate: labels.some(l => l.length > 8) ? 30 : 0 },
                axisLine: { lineStyle: { color: "#DDDDDD" } },
                axisTick: { show: false }
            },
            yAxis: {
                type: "value",
                name: state.unit.trim() || undefined,
                nameTextStyle: { ...textStyleAxis, padding: [0, 0, 10, 0] },
                axisLabel: textStyleAxis,
                splitLine: { lineStyle: { color: "#EEEEEE", type: "dashed" as const } }
            },
            series: seriesList
        };
    }

    if (state.chartType === "bar-horizontal") {
        const hSeries =
            computed.series.length > 0
                ? computed.series
                : [{ name: "—", axis: "left" as const, values: labels.map(() => null) }];
        const seriesList = hSeries.map(s => ({
            name: decorateSeriesName(s.name, state.unit),
            type: "bar" as const,
            data: s.values.map(v => (v === null ? null : v))
        }));
        return {
            color: colors,
            tooltip: baseTooltipAxis,
            legend: {
                ...baseLegend,
                data: hSeries.map(s => decorateSeriesName(s.name, state.unit))
            },
            grid: { ...baseGrid, left: "8%" },
            xAxis: {
                type: "value",
                name: state.unit.trim() || undefined,
                nameTextStyle: { ...textStyleAxis, padding: [0, 0, 10, 0] },
                axisLabel: textStyleAxis,
                splitLine: { lineStyle: { color: "#EEEEEE", type: "dashed" as const } }
            },
            yAxis: {
                type: "category",
                data: labels.length > 0 ? labels : [""],
                axisLabel: textStyleAxis,
                axisLine: { lineStyle: { color: "#DDDDDD" } },
                axisTick: { show: false }
            },
            series: seriesList
        };
    }

    const isLine = state.chartType === "line";
    const stacked = state.chartType === "bar-stacked";
    const seriesSrc =
        computed.series.length > 0
            ? computed.series
            : [{ name: "—", axis: "left" as const, values: labels.map(() => null) }];
    const seriesList = seriesSrc.map(s => ({
        name: decorateSeriesName(s.name, state.unit),
        type: (isLine ? "line" : "bar") as "line" | "bar",
        stack: stacked ? "total" : undefined,
        barGap: isLine ? undefined : "15%",
        smooth: false,
        data: s.values.map(v => (v === null ? null : v))
    }));

    return {
        color: colors,
        tooltip: baseTooltipAxis,
        legend: {
            ...baseLegend,
            data: seriesSrc.map(s => decorateSeriesName(s.name, state.unit))
        },
        grid: baseGrid,
        xAxis: {
            type: "category",
            data: labels,
            axisLabel: {
                ...textStyleAxis,
                rotate: labels.some(l => l.length > 10) ? 35 : 0
            },
            axisLine: { lineStyle: { color: "#DDDDDD" } },
            axisTick: { show: false }
        },
        yAxis: {
            type: "value",
            name: state.unit.trim() || undefined,
            nameTextStyle: { ...textStyleAxis, padding: [0, 0, 10, 0] },
            axisLabel: textStyleAxis,
            splitLine: { lineStyle: { color: "#EEEEEE", type: "dashed" as const } }
        },
        series: seriesList
    };
}

export function buildEChartsExportSnippet(state: ChartState, computed: ChartAttributes): string {
    const domId = chartDomId(state);
    const optionId = `${domId}-option`;
    const option = buildOption(state, computed);
    const optionJson = safeJsonForScript(option);

    const heading = state.title
        ? `\n  <h3 class="fr-h5">${escapeHtml(state.title)}</h3>`
        : "";
    const descriptionBlock =
        state.description.trim().length > 0
            ? `\n  <p class="fr-text--sm fr-mb-2w">${escapeHtml(state.description.trim())}</p>`
            : "";
    const figcaption = state.source
        ? `\n  <figcaption class="fr-text--sm fr-mt-2w">Source : ${escapeHtml(state.source)}</figcaption>`
        : "";

    const srTable = buildSrOnlyTable(state, computed);
    const ariaLabel = escapeHtml(state.title || "Graphique");

    const guide = `<!--
  Export Sites Faciles — ECharts 5 (CDN jsDelivr) + tableau d’accessibilité RGAA.
  Prérequis typographique : charger Marianne (ex. thème DSFR ou CSS utility officiel).
  Aucun web component : le rendu suit la configuration courante du générateur (données, double axe, secteurs, etc.).
-->`;

    const figureBlock = `${guide}
<figure class="fr-content-media" role="group" aria-label="${ariaLabel}">
${heading}${descriptionBlock}
  <!-- 1. Conteneur du graphique -->
  <div id="${escapeHtml(domId)}" style="width:100%;height:450px;margin-bottom:2rem" role="img" aria-hidden="true"></div>
  <!-- 2. Tableau d’accessibilité (RGAA — invisible à l’écran) -->
${indent(srTable, 2)}${figcaption}
</figure>

<!-- 3. Moteur ECharts (CDN jsDelivr) -->
<script src="${ECHARTS_CDN}"></script>
<script type="application/json" id="${escapeHtml(optionId)}">${optionJson}</script>
<!-- 4. Initialisation (style dataviz DSFR dans l’objet option JSON ci-dessus) -->
<script>
document.addEventListener("DOMContentLoaded", function () {
  var chartDom = document.getElementById("${escapeHtml(domId)}");
  var optNode = document.getElementById("${escapeHtml(optionId)}");
  if (!chartDom || typeof echarts === "undefined" || !optNode) return;
  var myChart = echarts.init(chartDom);
  var option = JSON.parse(optNode.textContent || "{}");
  if (option) myChart.setOption(option);
  window.addEventListener("resize", function () { myChart.resize(); });
});
</script>`;

    return figureBlock;
}
