// filepath: src/utils/echartsExport.ts
// Export HTML pour Sites Faciles : ECharts (CDN) + style dataviz proche DSFR
// + tableau fr-table fr-sr-only (RGAA). L’aperçu dans l’app reste sur @gouvfr/dsfr-chart.

import type { ChartState, ChartType, DsfrPalette } from "../types";
import { buildSrOnlyTable, type ChartAttributes } from "./chartGenerator";

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

function decorateName(name: string, unit: string): string {
    const u = unit.trim();
    if (u.length === 0) return name;
    if (name.includes(u)) return name;
    return `${name} (${u})`;
}

function safeJsonForScript(obj: unknown): string {
    return JSON.stringify(obj).replace(/</g, "\\u003c");
}

/** Métadonnées sérialisables : les formatters d’infobulle ne passent pas par JSON.stringify. */
interface EChartsUnitsMeta {
    unit: string;
    unitSecondary: string;
    dualAxis: boolean;
    kind: ChartType;
}

function buildUnitsMeta(state: ChartState, computed: ChartAttributes): EChartsUnitsMeta {
    return {
        unit: state.unit.trim(),
        unitSecondary: state.unitSecondary.trim(),
        dualAxis: computed.dualAxisActive,
        kind: state.chartType
    };
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
    // IMPORTANT : ID volontairement unique à chaque export copié.
    // En CMS, des IDs déterministes peuvent entrer en collision entre blocs
    // et faire lire la mauvaise configuration (impression de "toujours le même graphe").
    const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
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

function parseJsonAttr<T>(raw: string | undefined, fallback: T): T {
    if (!raw) return fallback;
    try {
        return JSON.parse(raw) as T;
    } catch {
        return fallback;
    }
}

function uniqueLegend(items: string[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const it of items) {
        const name = it.trim();
        if (name.length === 0) continue;
        if (seen.has(name)) continue;
        seen.add(name);
        out.push(name);
    }
    return out;
}

function colorAt(colors: string[], index: number): string {
    if (colors.length === 0) return "#000091";
    return colors[index % colors.length] ?? "#000091";
}

function normalizeCategoryX(raw: unknown): string[] {
    if (!Array.isArray(raw)) return [""];
    if (raw.length === 0) return [""];
    const first = raw[0];
    if (Array.isArray(first)) {
        const inner = first as unknown[];
        return inner.map(v => String(v ?? ""));
    }
    return (raw as unknown[]).map(v => String(v ?? ""));
}

function normalizeSeriesY(raw: unknown): (number | null)[][] {
    if (!Array.isArray(raw) || raw.length === 0) return [[0]];
    return (raw as unknown[]).map(line => {
        if (!Array.isArray(line)) return [0];
        return line.map(v => {
            if (v === null || v === undefined || v === "") return null;
            const n = Number(v);
            return Number.isFinite(n) ? n : null;
        });
    });
}

function buildOption(state: ChartState, computed: ChartAttributes): Record<string, unknown> {
    const colors = paletteColors(state.palette);
    const labels = computed.labels.map(l => (l.trim() === "" ? " " : l.trim()));
    const names = parseJsonAttr<string[]>(computed.attrs.name, []);

    if (computed.tagName === "gauge-chart") {
        const v = Number(computed.attrs.value ?? state.gaugeInit);
        const min = state.gaugeInit;
        const max = state.gaugeTarget;
        const name =
            names[0] ??
            (computed.series[0]?.name
                ? decorateName(computed.series[0].name, state.unit)
                : state.unit.trim()
                ? `Valeur (${state.unit.trim()})`
                : "Valeur");
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
            legend: { ...baseLegend, data: uniqueLegend([name]) },
            series: [
                {
                    type: "gauge",
                    itemStyle: { color: colorAt(colors, 0) },
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
        const x = normalizeCategoryX(parseJsonAttr<unknown[]>(computed.attrs.x, []));
        const yBar = parseJsonAttr<(number | null)[]>(computed.attrs["y-bar"], x.map(() => 0));
        const yLine = parseJsonAttr<(number | null)[]>(computed.attrs["y-line"], x.map(() => 0));
        const barName = names[0] ?? "Série 1";
        const lineName = names[1] ?? "Série 2";
        const legendData = [barName, lineName];
        return {
            color: colors,
            tooltip: { ...baseTooltipAxis, trigger: "axis" },
            legend: { ...baseLegend, data: legendData.length > 0 ? legendData : ["Série 1", "Série 2"] },
            grid: baseGrid,
            xAxis: {
                type: "category",
                data: x.length > 0 ? x : labels,
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
                    itemStyle: { color: colorAt(colors, 0) },
                    yAxisIndex: 0,
                    barGap: "15%",
                    data: yBar
                },
                {
                    name: lineName,
                    type: "line",
                    itemStyle: { color: colorAt(colors, 1) },
                    lineStyle: { color: colorAt(colors, 1), width: 2 },
                    yAxisIndex: 1,
                    smooth: false,
                    data: yLine
                }
            ]
        };
    }

    if (state.chartType === "pie" || state.chartType === "donut") {
        const x = normalizeCategoryX(parseJsonAttr<unknown[]>(computed.attrs.x, [labels]));
        const y = normalizeSeriesY(parseJsonAttr<unknown[]>(computed.attrs.y, [[0]]));
        const values = y[0] ?? [];
        const data = x.map((name, i) => ({
            name: (names[i] ?? name).trim() || `Secteur ${i + 1}`,
            value: values[i] ?? 0
        }));
        const radius =
            state.chartType === "donut" ? (["45%", "70%"] as const) : ("70%" as const);
        const legendNames = uniqueLegend(data.map(d => d.name));
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
                data: legendNames.length > 0 ? legendNames : ["Secteur"]
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
        const x = normalizeCategoryX(parseJsonAttr<unknown[]>(computed.attrs.x, [labels]));
        const y = normalizeSeriesY(parseJsonAttr<unknown[]>(computed.attrs.y, [[0]]));
        const labs = x.length > 0 ? x : [""];
        const rSeries = y.map((vals, i) => ({
            name: names[i] ?? `Série ${i + 1}`,
            values: vals
        }));
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
        const legendData = uniqueLegend(rSeries.map(s => s.name));
        return {
            color: colors,
            tooltip: {},
            legend: { ...baseLegend, data: legendData.length > 0 ? legendData : ["Série"] },
            radar: {
                indicator: indicators,
                axisName: { fontFamily: "Marianne, sans-serif", color: "#666666" }
            },
            series: [
                {
                    type: "radar",
                    data: rSeries.map((s, i) => ({
                        value: s.values.map(v => (v === null ? 0 : v)),
                        name: s.name.trim().length > 0 ? s.name : "Série",
                        itemStyle: { color: colorAt(colors, i) }
                    }))
                }
            ]
        };
    }

    if (state.chartType === "scatter") {
        const xRaw = parseJsonAttr<unknown[]>(computed.attrs.x, []);
        const yRaw = normalizeSeriesY(parseJsonAttr<unknown[]>(computed.attrs.y, [[0]]));
        const xPerSeries = Array.isArray(xRaw) ? xRaw : [];
        const x = normalizeCategoryX(xRaw);

        const seriesList = yRaw.map((vals, i) => ({
            name: names[i] ?? `Série ${i + 1}`,
            type: (state.showLine ? "line" : "scatter") as "line" | "scatter",
            data: vals.map((v, idx) => {
                const xs = Array.isArray(xPerSeries[i]) ? (xPerSeries[i] as unknown[]) : x;
                const xv = xs[idx];
                const xLabel = xv === undefined ? String(idx) : String(xv);
                return [xLabel, v] as [string, number | null];
            }),
            symbolSize: state.showLine ? 8 : 10,
            showSymbol: true,
            smooth: false,
            itemStyle: { color: colorAt(colors, i) },
            lineStyle: state.showLine
                ? { color: colorAt(colors, i), width: 2 }
                : undefined
        }));
        const legendData = uniqueLegend(seriesList.map(s => s.name));
        return {
            color: colors,
            tooltip: { ...baseTooltipAxis },
            legend: {
                ...baseLegend,
                data: legendData.length > 0 ? legendData : ["Série"]
            },
            grid: baseGrid,
            xAxis: {
                type: "category",
                data: x.length > 0 ? x : [""],
                axisLabel: { ...textStyleAxis, rotate: x.some(l => l.length > 8) ? 30 : 0 },
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
        const x = normalizeCategoryX(parseJsonAttr<unknown[]>(computed.attrs.x, [labels]));
        const y = normalizeSeriesY(parseJsonAttr<unknown[]>(computed.attrs.y, [[0]]));
        const seriesList = y.map((vals, i) => ({
            name: names[i] ?? `Série ${i + 1}`,
            type: "bar" as const,
            itemStyle: { color: colorAt(colors, i) },
            data: vals
        }));
        const legendData = uniqueLegend(seriesList.map(s => s.name));
        return {
            color: colors,
            tooltip: baseTooltipAxis,
            legend: {
                ...baseLegend,
                data: legendData.length > 0 ? legendData : ["Série"]
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
                data: x.length > 0 ? x : [""],
                axisLabel: textStyleAxis,
                axisLine: { lineStyle: { color: "#DDDDDD" } },
                axisTick: { show: false }
            },
            series: seriesList
        };
    }

    const isLine = state.chartType === "line";
    const stacked = state.chartType === "bar-stacked";
    const xRaw = parseJsonAttr<unknown[]>(computed.attrs.x, [labels]);
    const yRaw = normalizeSeriesY(parseJsonAttr<unknown[]>(computed.attrs.y, [[0]]));
    const x = normalizeCategoryX(xRaw);

    const seriesList = yRaw.map((vals, i) => ({
        name: names[i] ?? `Série ${i + 1}`,
        type: (isLine ? "line" : "bar") as "line" | "bar",
        stack: stacked ? "total" : undefined,
        barGap: isLine ? undefined : "15%",
        smooth: false,
        itemStyle: { color: colorAt(colors, i) },
        lineStyle: isLine ? { color: colorAt(colors, i), width: 2 } : undefined,
        data: vals
    }));

    const longXLabels = x.some(l => l.length > 10);
    const manySeries = seriesList.length >= 3;
    const gridBottom = longXLabels || manySeries ? "20%" : "16%";

    const legendData = uniqueLegend(seriesList.map(s => s.name));
    return {
        color: colors,
        tooltip: baseTooltipAxis,
        legend: {
            ...baseLegend,
            type: "scroll",
            left: "center",
            data: legendData.length > 0 ? legendData : ["Série"]
        },
        grid: { ...baseGrid, bottom: gridBottom },
        xAxis: {
            type: "category",
            data: x,
            axisLabel: {
                ...textStyleAxis,
                rotate: x.some(l => l.length > 10) ? 35 : 0
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
    const unitsId = `${domId}-units`;
    const option = buildOption(state, computed);
    const optionJson = safeJsonForScript(option);
    const unitsJson = safeJsonForScript(buildUnitsMeta(state, computed));

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
<script type="application/json" id="${escapeHtml(unitsId)}">${unitsJson}</script>
<!-- 4. Initialisation (infobulles avec unités M€ / % : définies ici car JSON.stringify supprime les fonctions) -->
<script>
(function () {
  function suffix(v, u) {
    if (v === null || v === undefined || v === "") return "";
    return u ? String(v) + " " + u : String(v);
  }
  /** Valeur scalaire exploitable depuis params.value (scatter [x,y], etc.). */
  function scalarFromTooltipParam(p) {
    var val = p.value;
    if (Array.isArray(val)) {
      var last = val[val.length - 1];
      if (typeof last === "number") return last;
      var num = Number(last);
      return isNaN(num) ? last : num;
    }
    return val;
  }
  function applyDsfrEchartUnits(option, meta) {
    if (!option || !meta) return;
    var u0 = meta.unit || "";
    var u1 = meta.unitSecondary || "";
    var kind = meta.kind;
    var dual = !!meta.dualAxis;
    var tt = option.tooltip || (option.tooltip = {});

    if (kind === "gauge") {
      var gs = option.series && option.series[0];
      if (gs && gs.type === "gauge") {
        if (gs.detail) gs.detail.formatter = u0 ? "{value} " + u0 : "{value}";
        tt.formatter = function (p) {
          var name = (p.seriesName || "").trim();
          var vs = suffix(p.value, u0);
          return name ? p.marker + name + "<br/>" + vs : p.marker + vs;
        };
      }
      return;
    }

    if (kind === "pie" || kind === "donut") {
      tt.formatter = function (p) {
        return p.marker + p.name + ": " + suffix(p.value, u0);
      };
      return;
    }

    if (kind === "radar") {
      tt.trigger = "item";
      tt.formatter = function (params) {
        var ind = (option.radar && option.radar.indicator) || [];
        var vals = params.value || [];
        var lines = [(params.marker || "") + (params.seriesName || "")];
        for (var i = 0; i < vals.length; i++) {
          var nm = ind[i] && ind[i].name ? ind[i].name : "—";
          lines.push(nm + ": " + suffix(vals[i], u0));
        }
        return lines.join("<br/>");
      };
      return;
    }

    if (dual && tt.trigger === "axis") {
      tt.formatter = function (params) {
        if (!Array.isArray(params)) return "";
        return params
          .map(function (p) {
            var unit = p.seriesType === "bar" ? u0 : u1;
            return p.marker + p.seriesName + ": " + suffix(p.value, unit);
          })
          .join("<br/>");
      };
      return;
    }

    if (tt.trigger === "axis") {
      tt.formatter = function (params) {
        if (!Array.isArray(params)) return "";
        return params
          .map(function (p) {
            var v = scalarFromTooltipParam(p);
            var num = typeof v === "number" ? v : Number(v);
            var display = typeof num === "number" && !isNaN(num) ? num : v;
            return p.marker + p.seriesName + ": " + suffix(display, u0);
          })
          .join("<br/>");
      };
    }
  }
  function bootDsfrEchart() {
    var chartDom = document.getElementById("${escapeHtml(domId)}");
    var optNode = document.getElementById("${escapeHtml(optionId)}");
    var unitsNode = document.getElementById("${escapeHtml(unitsId)}");
    if (!chartDom || typeof echarts === "undefined" || !optNode) return;
    var myChart = echarts.init(chartDom);
    var option = JSON.parse(optNode.textContent || "{}");
    var meta = unitsNode ? JSON.parse(unitsNode.textContent || "{}") : {};
    applyDsfrEchartUnits(option, meta);
    if (option) myChart.setOption(option);
    window.addEventListener("resize", function () {
      myChart.resize();
    });
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootDsfrEchart, { once: true });
  } else {
    bootDsfrEchart();
  }
})();
</script>`;

    return figureBlock;
}
