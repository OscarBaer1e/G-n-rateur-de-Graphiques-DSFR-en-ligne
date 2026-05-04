// filepath: src/App.tsx
import { useCallback, useState } from "react";
import { Header } from "./components/Header";
import { ChartConfigPanel } from "./components/ChartConfigPanel";
import { DataEditor } from "./components/DataEditor";
import { ChartPreview } from "./components/ChartPreview";
import { ExportPanel } from "./components/ExportPanel";
import type { ChartState, DataColumn, DataRow } from "./types";
import { DEFAULT_DATAVIZ_PALETTE } from "./utils/theme";

const newId = (): string =>
    `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

function makeInitialState(): ChartState {
    const labelCol: DataColumn = { id: newId(), name: "Produits", isLabel: true };
    const s1: DataColumn = {
        id: newId(),
        name: "Valeur",
        isLabel: false,
        axis: "left"
    };
    const s2: DataColumn = {
        id: newId(),
        name: "Variation",
        isLabel: false,
        axis: "right"
    };
    const cols = [labelCol, s1, s2];

    const sample: [string, string, string][] = [
        ["Café", "412", "5.2"],
        ["Cacao", "455", "8.1"],
        ["Thé", "298", "-2.4"],
        ["Tabac", "521", "3.7"],
        ["Sucre", "163", "-1.1"],
        ["Vanille", "92", "12.3"]
    ];

    const rows: DataRow[] = sample.map(([y, a, b]) => ({
        id: newId(),
        cells: { [labelCol.id]: y, [s1.id]: a, [s2.id]: b }
    }));

    return {
        title: "Recettes douanières par produit",
        description: "",
        unit: "M€",
        unitSecondary: "%",
        source: "DGDDI — Bilan annuel",
        chartType: "bar-vertical",
        palette: DEFAULT_DATAVIZ_PALETTE,
        showLine: false,
        gaugeInit: 0,
        gaugeTarget: 100,
        columns: cols,
        rows
    };
}

export function App(): JSX.Element {
    const [state, setState] = useState<ChartState>(() => makeInitialState());

    const patch = useCallback((p: Partial<ChartState>) => {
        setState(prev => ({ ...prev, ...p }));
    }, []);

    const setColumns = useCallback((cols: DataColumn[]) => {
        setState(prev => ({ ...prev, columns: cols }));
    }, []);

    const setRows = useCallback((rows: DataRow[]) => {
        setState(prev => ({ ...prev, rows }));
    }, []);

    const reset = useCallback(() => {
        const labelCol: DataColumn = {
            id: newId(),
            name: "Catégorie",
            isLabel: true
        };
        const s1: DataColumn = { id: newId(), name: "Série 1", isLabel: false };
        const cols = [labelCol, s1];
        setState(prev => ({
            ...prev,
            columns: cols,
            rows: [
                { id: newId(), cells: { [labelCol.id]: "", [s1.id]: "" } },
                { id: newId(), cells: { [labelCol.id]: "", [s1.id]: "" } },
                { id: newId(), cells: { [labelCol.id]: "", [s1.id]: "" } }
            ]
        }));
    }, []);

    return (
        <div className="gb-app">
            <Header />

            <main className="gb-main" id="main-content" role="main">
                <div className="gb-grid">
                    <div className="gb-stack">
                        <ChartConfigPanel state={state} onPatch={patch} />
                        <DataEditor
                            state={state}
                            onColumnsChange={setColumns}
                            onRowsChange={setRows}
                            onReset={reset}
                        />
                    </div>
                    <div className="gb-stack">
                        <ChartPreview state={state} />
                        <ExportPanel state={state} />
                    </div>
                </div>
            </main>

            <AppFooter />
        </div>
    );
}

/* -------------------------------------------------------------------------- */
/* Footer officiel DSFR                                                       */
/* -------------------------------------------------------------------------- */

function AppFooter(): JSX.Element {
    return (
        <footer className="fr-footer" role="contentinfo" id="footer">
            <div className="fr-container">
                <div className="fr-footer__body">
                    <div className="fr-footer__brand fr-enlarge-link">
                        <p className="fr-logo">
                            République
                            <br />
                            Française
                        </p>
                    </div>
                    <div className="fr-footer__content">
                        <p className="fr-footer__content-desc">
                            Générateur de Graphiques DSFR en ligne. Outil basé sur le
                            Système de Design de l'État Français et la bibliothèque
                            officielle <code>@gouvfr/dsfr-chart</code>.
                        </p>
                        <ul className="fr-footer__content-list">
                            <li className="fr-footer__content-item">
                                <a
                                    className="fr-footer__content-link"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    href="https://www.systeme-de-design.gouv.fr/"
                                >
                                    systeme-de-design.gouv.fr
                                </a>
                            </li>
                            <li className="fr-footer__content-item">
                                <a
                                    className="fr-footer__content-link"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    href="https://gouvernementfr.github.io/dsfr-chart/"
                                >
                                    dsfr-chart
                                </a>
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="fr-footer__bottom">
                    <ul className="fr-footer__bottom-list">
                        <li className="fr-footer__bottom-item">
                            <span className="fr-footer__bottom-link">
                                Accessibilité : non conformité (alternative <code>fr-sr-only</code> fournie)
                            </span>
                        </li>
                        <li className="fr-footer__bottom-item">
                            <span className="fr-footer__bottom-link">Mentions légales</span>
                        </li>
                        <li className="fr-footer__bottom-item">
                            <span className="fr-footer__bottom-link">Données personnelles</span>
                        </li>
                    </ul>
                    <div className="fr-footer__bottom-copy">
                        <p>
                            Développé par <strong>Oscar Baer</strong>. Sauf mention contraire,
                            tous les contenus de ce site sont sous{" "}
                            <a
                                href="https://github.com/codegouvfr/react-dsfr/blob/main/LICENSE"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                licence MIT
                            </a>
                            .
                        </p>
                    </div>
                </div>
            </div>
        </footer>
    );
}
