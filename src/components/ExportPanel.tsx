// filepath: src/components/ExportPanel.tsx
import { useMemo, useState } from "react";
import { Check, Code2, Copy, Download } from "lucide-react";
import type { ChartState } from "../types";
import { buildChartAttributes, buildExportSnippet } from "../utils/chartGenerator";
import { buildEChartsExportSnippet } from "../utils/echartsExport";
import { buildChartJsExportSnippet } from "../utils/chartJsExport";

type ExportEngine = "echarts" | "webcomponents" | "chartjs";

interface Props {
    state: ChartState;
}

export function ExportPanel({ state }: Props): JSX.Element {
    const [copied, setCopied] = useState(false);
    const [engine, setEngine] = useState<ExportEngine>("echarts");

    const snippet = useMemo(() => {
        const computed = buildChartAttributes(state);
        if (engine === "echarts") return buildEChartsExportSnippet(state, computed);
        if (engine === "chartjs") return buildChartJsExportSnippet(state, computed);
        return buildExportSnippet(state, computed);
    }, [state, engine]);

    const handleCopy = async (): Promise<void> => {
        try {
            await navigator.clipboard.writeText(snippet);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2200);
        } catch {
            // Fallback : sélectionner le textarea.
            const ta = document.getElementById("gb-export-output") as HTMLTextAreaElement | null;
            ta?.select();
            document.execCommand("copy");
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2200);
        }
    };

    const handleDownload = (): void => {
        const blob = new Blob([snippet], { type: "text/html;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const safeTitle =
            (state.title || "graphique-dsfr")
                .toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/(^-|-$)/g, "") || "graphique-dsfr";
        const suffix =
            engine === "echarts"
                ? "-echarts"
                : engine === "chartjs"
                ? "-chartjs"
                : "-dsfr-wc";
        a.download = `${safeTitle}${suffix}.html`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <section className="gb-card" aria-labelledby="export-title">
            <div className="gb-card__header">
                <Code2 className="gb-card__icon" size={24} aria-hidden="true" />
                <h2 id="export-title">Export — code prêt à intégrer (Sites Faciles)</h2>
            </div>

            <fieldset className="fr-fieldset" style={{ marginBottom: "1rem" }}>
                <legend className="fr-fieldset__legend fr-text--regular">Moteur d’export</legend>
                <div className="fr-fieldset__content">
                    <div className="fr-radio-group">
                        <input
                            type="radio"
                            id="export-engine-echarts"
                            name="export-engine"
                            checked={engine === "echarts"}
                            onChange={() => setEngine("echarts")}
                        />
                        <label className="fr-label" htmlFor="export-engine-echarts">
                            ECharts (Sites Faciles, CDN jsDelivr)
                            <span className="fr-hint-text">
                                Conteneur + tableau <code className="fr-text--xs">fr-table fr-sr-only</code>{" "}
                                + ECharts 5.5, style dataviz proche DSFR. Recommandé si les web components
                                ne se chargent pas dans le CMS.
                            </span>
                        </label>
                    </div>
                    <div className="fr-radio-group fr-mt-2w">
                        <input
                            type="radio"
                            id="export-engine-chartjs"
                            name="export-engine"
                            checked={engine === "chartjs"}
                            onChange={() => setEngine("chartjs")}
                        />
                        <label className="fr-label" htmlFor="export-engine-chartjs">
                            Chart.js (test de compatibilité CMS)
                            <span className="fr-hint-text">
                                Troisième mode pour comparer le rendu ou l&apos;interpréteur JS du CMS
                                avec une autre bibliothèque.
                            </span>
                        </label>
                    </div>
                    <div className="fr-radio-group fr-mt-2w">
                        <input
                            type="radio"
                            id="export-engine-wc"
                            name="export-engine"
                            checked={engine === "webcomponents"}
                            onChange={() => setEngine("webcomponents")}
                        />
                        <label className="fr-label" htmlFor="export-engine-wc">
                            Web components <code className="fr-text--xs">@gouvfr/dsfr-chart</code>
                            <span className="fr-hint-text">
                                Même rendu que l’aperçu : hébergement local des fichiers UMD +{" "}
                                <code className="fr-text--xs">%%MEDIA_BASE%%</code>.
                            </span>
                        </label>
                    </div>
                </div>
            </fieldset>

            <p className="fr-text--sm" style={{ color: "var(--text-mention-grey)" }}>
                {engine === "echarts" ? (
                    <>
                        Bloc autonome : figure, graphique dans une <code>div</code>, tableau
                        d’accessibilité, puis scripts (ECharts puis initialisation). Polices Marianne
                        si le thème du site ne les charge pas déjà.
                    </>
                ) : engine === "chartjs" ? (
                    <>
                        Bloc autonome test en <code>Chart.js</code> (canvas + config JSON), utile
                        pour isoler les problèmes d&apos;intégration propres à Sites Faciles.
                    </>
                ) : (
                    <>
                        Deux blocs : ressources (UMD <code>DSFRChart.umd.cjs</code>) puis{" "}
                        <code>figure</code> avec web component et tableau RGAA ; remplacer{" "}
                        <code>%%MEDIA_BASE%%</code> selon les commentaires du code généré.
                    </>
                )}
            </p>

            <label htmlFor="gb-export-output" className="fr-sr-only">
                Code d'intégration généré
            </label>
            <textarea
                id="gb-export-output"
                className="gb-export-textarea"
                readOnly
                value={snippet}
                spellCheck={false}
                aria-describedby="gb-export-help"
            />
            <p id="gb-export-help" className="fr-sr-only">
                Sélectionnez le contenu et copiez-le dans votre CMS.
            </p>

            <div className="gb-export-actions">
                <button type="button" className="fr-btn" onClick={handleCopy}>
                    {copied ? (
                        <>
                            <Check size={16} aria-hidden="true" /> &nbsp;Copié
                        </>
                    ) : (
                        <>
                            <Copy size={16} aria-hidden="true" /> &nbsp;Copier le code
                        </>
                    )}
                </button>
                <button type="button" className="fr-btn fr-btn--secondary" onClick={handleDownload}>
                    <Download size={16} aria-hidden="true" /> &nbsp;Télécharger en .html
                </button>
            </div>
        </section>
    );
}
