// filepath: src/components/ExportPanel.tsx
import { useMemo, useState } from "react";
import { Check, Code2, Copy, Download } from "lucide-react";
import type { ChartState } from "../types";
import { buildChartAttributes, buildExportSnippet } from "../utils/chartGenerator";

interface Props {
    state: ChartState;
}

export function ExportPanel({ state }: Props): JSX.Element {
    const [copied, setCopied] = useState(false);

    const snippet = useMemo(() => {
        const computed = buildChartAttributes(state);
        return buildExportSnippet(state, computed);
    }, [state]);

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
        a.download = `${safeTitle}.html`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <section className="gb-card" aria-labelledby="export-title">
            <div className="gb-card__header">
                <Code2 className="gb-card__icon" size={24} aria-hidden="true" />
                <h2 id="export-title">Export — code prêt à intégrer (Sites Faciles)</h2>
            </div>

            <p className="fr-text--sm" style={{ color: "var(--text-mention-grey)" }}>
                Deux blocs : ressources (UMD officiel <code>DSFRChart.umd.cjs</code>, sans{" "}
                <code>type=&quot;module&quot;</code>) puis le <code>figure</code> avec le web
                component, le tableau <code>fr-sr-only</code> RGAA et les instructions pour
                remplacer <code>%%MEDIA_BASE%%</code> et héberger les fichiers npm.
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
