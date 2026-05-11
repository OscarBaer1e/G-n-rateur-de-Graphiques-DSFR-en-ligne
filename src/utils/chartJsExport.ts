// filepath: src/utils/chartJsExport.ts
// Export HTML Chart.js (mode test) avec style proche DSFR.
// Sert à comparer l'intégration CMS avec un moteur alternatif.

import type { ChartState, ChartType, DsfrPalette } from "../types";
import { buildSrOnlyTable, type ChartAttributes } from "./chartGenerator";

const CHARTJS_CDN = "https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js";

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

function parseJsonAttr<T>(raw: string | undefined, fallback: T): T {
    if (!raw) return fallback;
    try {
        return JSON.parse(raw) as T;
    } catch {
        return fallback;
    }
}

function normalizeCategoryX(raw: unknown): string[] {
    if (!Array.isArray(raw) || raw.length === 0) return [""];
    const first = raw[0];
    if (Array.isArray(first)) return (first as unknown[]).map(v => String(v ?? ""));
    return (raw as unknown[]).map(v => String(v ?? ""));
}

function normalizeSeriesY(raw: unknown): (number | null)[][] {
    if (!Array.isArray(raw) || raw.length === 0) return [[0]];
    return (raw as unknown[]).map(row =>
        Array.isArray(row)
            ? row.map(v => {
                  if (v === null || v === undefined || v === "") return null;
                  const n = Number(v);
                  return Number.isFinite(n) ? n : null;
              })
            : [0]
    );
}

interface ChartJsUnitsMeta {
    unit: string;
    unitSecondary: string;
    dualAxis: boolean;
    kind: ChartType;
}

function buildChartJsUnitsMeta(state: ChartState, computed: ChartAttributes): ChartJsUnitsMeta {
    return {
        unit: state.unit.trim(),
        unitSecondary: state.unitSecondary.trim(),
        dualAxis: computed.dualAxisActive,
        kind: state.chartType
    };
}

function chartDomId(state: ChartState): string {
    const base =
        (state.title || "graphique")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)/g, "") || "graphique";
    const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    return `dsfr-cj-${base}-${suffix}`.slice(0, 96);
}

function buildChartJsConfig(state: ChartState, computed: ChartAttributes): Record<string, unknown> {
    const colors = paletteColors(state.palette);
    const labels = normalizeCategoryX(parseJsonAttr(computed.attrs.x, [computed.labels]));
    const names = parseJsonAttr<string[]>(computed.attrs.name, []);
    const y = normalizeSeriesY(parseJsonAttr(computed.attrs.y, [[0]]));

    if (computed.dualAxisActive) {
        const yBar = parseJsonAttr<(number | null)[]>(computed.attrs["y-bar"], labels.map(() => 0));
        const yLine = parseJsonAttr<(number | null)[]>(computed.attrs["y-line"], labels.map(() => 0));
        return {
            type: "bar",
            data: {
                labels,
                datasets: [
                    {
                        label: names[0] ?? "Série axe gauche",
                        data: yBar,
                        yAxisID: "y",
                        backgroundColor: colors[0]
                    },
                    {
                        label: names[1] ?? "Série axe droit",
                        data: yLine,
                        yAxisID: "y1",
                        type: "line",
                        borderColor: colors[1] ?? colors[0],
                        backgroundColor: colors[1] ?? colors[0],
                        tension: 0
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: "bottom" },
                    tooltip: { mode: "index", intersect: false }
                },
                scales: {
                    y: { position: "left", title: { display: !!state.unit, text: state.unit } },
                    y1: {
                        position: "right",
                        grid: { drawOnChartArea: false },
                        title: { display: !!state.unitSecondary, text: state.unitSecondary }
                    }
                }
            }
        };
    }

    if (state.chartType === "pie" || state.chartType === "donut") {
        const values = (y[0] ?? []).map(v => (v === null ? 0 : v));
        const sectorCount = values.length;
        const lab = Array.from({ length: sectorCount }, (_, i) => {
            const t = (names[i] ?? labels[i] ?? `Secteur ${i + 1}`).trim();
            return t.length > 0 ? t : `Secteur ${i + 1}`;
        });
        const bg = lab.map((_, i) => colors[i % colors.length]!);
        return {
            type: state.chartType === "donut" ? "doughnut" : "pie",
            data: {
                labels: lab,
                datasets: [{ data: values, backgroundColor: bg }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: "bottom" } }
            }
        };
    }

    if (state.chartType === "radar") {
        return {
            type: "radar",
            data: {
                labels,
                datasets: y.map((vals, i) => ({
                    label: names[i] ?? `Série ${i + 1}`,
                    data: vals.map(v => (v === null ? 0 : v)),
                    borderColor: colors[i % colors.length],
                    backgroundColor: `${colors[i % colors.length]}33`
                }))
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: "bottom" } }
            }
        };
    }

    if (state.chartType === "scatter") {
        // Chart.js : axe catégoriel = type "line" avec points (showLine optionnel).
        return {
            type: "line",
            data: {
                labels,
                datasets: y.map((vals, i) => ({
                    label: names[i] ?? `Série ${i + 1}`,
                    data: vals,
                    borderColor: colors[i % colors.length],
                    backgroundColor: colors[i % colors.length],
                    tension: 0,
                    showLine: state.showLine,
                    spanGaps: false,
                    fill: false,
                    pointRadius: state.showLine ? 3 : 6,
                    pointHoverRadius: state.showLine ? 4 : 8
                }))
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: "bottom" } },
                scales: {
                    y: { title: { display: !!state.unit, text: state.unit } }
                }
            }
        };
    }

    if (state.chartType === "gauge") {
        const value = Number(computed.attrs.value ?? state.gaugeInit);
        const target = Math.max(state.gaugeTarget, value, 1);
        const rest = Math.max(target - value, 0);
        return {
            type: "doughnut",
            data: {
                labels: [names[0] ?? "Valeur", "Reste"],
                datasets: [{ data: [value, rest], backgroundColor: [colors[0], "#E5E5E5"] }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: "75%",
                rotation: -90,
                circumference: 180,
                plugins: { legend: { position: "bottom" } }
            }
        };
    }

    const isLine = state.chartType === "line";
    const isHorizontal = state.chartType === "bar-horizontal";
    const isStacked = state.chartType === "bar-stacked";

    return {
        type: isLine ? "line" : "bar",
        data: {
            labels,
            datasets: y.map((vals, i) => ({
                label: names[i] ?? `Série ${i + 1}`,
                data: vals,
                borderColor: colors[i % colors.length],
                backgroundColor: colors[i % colors.length],
                tension: 0,
                stack: isStacked ? "total" : undefined
            }))
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: isHorizontal ? "y" : "x",
            plugins: { legend: { position: "bottom" } },
            scales: {
                x: { stacked: isStacked },
                y: {
                    stacked: isStacked,
                    title: { display: !!state.unit, text: state.unit }
                }
            }
        }
    };
}

export function buildChartJsExportSnippet(state: ChartState, computed: ChartAttributes): string {
    const domId = chartDomId(state);
    const configId = `${domId}-config`;
    const unitsId = `${domId}-units`;
    const unitsMeta = buildChartJsUnitsMeta(state, computed);
    const config = buildChartJsConfig(state, computed);
    const configJson = safeJsonForScript(config);
    const unitsJson = safeJsonForScript(unitsMeta);

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

    return `<!-- Export test Chart.js (fidélité DSFR approximative) -->
<figure class="fr-content-media" role="group" aria-label="${escapeHtml(state.title || "Graphique")}">
${heading}${descriptionBlock}
  <div style="width:100%;height:450px;margin-bottom:2rem">
    <canvas id="${escapeHtml(domId)}" aria-hidden="true"></canvas>
  </div>
${indent(srTable, 2)}${figcaption}
</figure>

<script defer src="${CHARTJS_CDN}"></script>
<script type="application/json" id="${escapeHtml(configId)}">${configJson}</script>
<script type="application/json" id="${escapeHtml(unitsId)}">${unitsJson}</script>
<script>
document.addEventListener("DOMContentLoaded", function () {
  var canvas = document.getElementById("${escapeHtml(domId)}");
  var cfgNode = document.getElementById("${escapeHtml(configId)}");
  var metaNode = document.getElementById("${escapeHtml(unitsId)}");
  if (!canvas || !cfgNode || typeof Chart === "undefined") return;
  var cfg = JSON.parse(cfgNode.textContent || "{}");
  var meta = metaNode ? JSON.parse(metaNode.textContent || "{}") : {};
  var u0 = meta.unit || "";
  var u1 = meta.unitSecondary || "";
  var dual = !!meta.dualAxis;
  var kind = meta.kind || "";

  cfg.options = cfg.options || {};
  cfg.options.plugins = cfg.options.plugins || {};
  var tt = cfg.options.plugins.tooltip || {};
  cfg.options.plugins.tooltip = tt;
  tt.callbacks = tt.callbacks || {};

  tt.callbacks.label = function (ctx) {
    var chartType = ctx.chart.config.type;
    var lbl = typeof ctx.dataset.label === "string" ? ctx.dataset.label : "";

    if (chartType === "pie" || chartType === "doughnut") {
      var sliceName = ctx.label != null ? String(ctx.label) : "";
      var rawV =
        typeof ctx.raw === "number"
          ? ctx.raw
          : typeof ctx.parsed === "number"
          ? ctx.parsed
          : null;
      var line = sliceName ? sliceName + ": " : "";
      line += rawV != null ? String(rawV) : "";
      var applyUnit = !(kind === "gauge" && ctx.dataIndex !== 0);
      if (applyUnit && rawV != null && u0) line += " " + u0;
      return line;
    }

    if (chartType === "radar") {
      var rVal =
        typeof ctx.parsed === "object" && ctx.parsed && "r" in ctx.parsed
          ? ctx.parsed.r
          : null;
      var rr = lbl ? lbl + ": " : "";
      rr += rVal != null ? rVal : "";
      if (u0 && rVal != null) rr += " " + u0;
      return rr;
    }

    var y = typeof ctx.parsed === "object" && ctx.parsed && ctx.parsed.y != null ? ctx.parsed.y : null;
    var x = typeof ctx.parsed === "object" && ctx.parsed && ctx.parsed.x != null ? ctx.parsed.x : null;
    var num = y != null ? y : x;
    var out = lbl ? lbl + ": " : "";
    out += num != null ? num : "";
    var u = dual && ctx.dataset.yAxisID === "y1" ? u1 : u0;
    if (u && num != null) out += " " + u;
    return out;
  };

  new Chart(canvas, cfg);
});
</script>`;
}
