// filepath: src/components/ChartConfigPanel.tsx
import { Settings2 } from "lucide-react";
import {
    CHART_TYPES,
    DUAL_AXIS_COMPATIBLE,
    PALETTES,
    type ChartState,
    type ChartType,
    type DsfrPalette
} from "../types";

interface Props {
    state: ChartState;
    onPatch: (patch: Partial<ChartState>) => void;
}

export function ChartConfigPanel({ state, onPatch }: Props): JSX.Element {
    const isScatter = state.chartType === "scatter";
    const isGauge = state.chartType === "gauge";

    const hasRightSeries = state.columns.some(
        c => !c.isLabel && c.axis === "right"
    );
    const dualAxisAvailable = (DUAL_AXIS_COMPATIBLE as readonly string[]).includes(
        state.chartType
    );

    return (
        <section className="gb-card" aria-labelledby="config-title">
            <div className="gb-card__header">
                <Settings2 className="gb-card__icon" size={24} aria-hidden="true" />
                <h2 id="config-title">Configuration du graphique</h2>
            </div>

            <div className="gb-config-grid">
                <div className="fr-input-group" style={{ gridColumn: "1 / -1" }}>
                    <label className="fr-label" htmlFor="cfg-title">
                        Titre
                        <span className="fr-hint-text">
                            Le titre affiché au-dessus du graphique
                        </span>
                    </label>
                    <input
                        className="fr-input"
                        id="cfg-title"
                        type="text"
                        value={state.title}
                        onChange={e => onPatch({ title: e.target.value })}
                        placeholder="Ex : Évolution des recettes douanières"
                    />
                </div>

                <div className="fr-input-group" style={{ gridColumn: "1 / -1" }}>
                    <label className="fr-label" htmlFor="cfg-description">
                        Description <span className="fr-hint-text">(optionnel)</span>
                        <span className="fr-hint-text">
                            Affichée entre le titre et le graphique uniquement si renseignée.
                        </span>
                    </label>
                    <textarea
                        className="fr-input"
                        id="cfg-description"
                        rows={2}
                        value={state.description}
                        onChange={e => onPatch({ description: e.target.value })}
                        placeholder="Ex : Données provisoires — mise à jour trimestrielle."
                    />
                </div>

                <div className="fr-input-group">
                    <label className="fr-label" htmlFor="cfg-unit">
                        Unité — axe gauche
                        <span className="fr-hint-text">
                            Unité principale, infobulles. Ex : M€, t, kWh…
                        </span>
                    </label>
                    <input
                        className="fr-input"
                        id="cfg-unit"
                        type="text"
                        value={state.unit}
                        onChange={e => onPatch({ unit: e.target.value })}
                        placeholder="M€"
                    />
                </div>

                <div className="fr-input-group">
                    <label className="fr-label" htmlFor="cfg-unit-secondary">
                        Unité — axe droit (secondaire)
                        <span className="fr-hint-text">
                            Activé dès qu'une série est routée vers l'axe Y droit. Ex : %, °C, pts.
                        </span>
                    </label>
                    <input
                        className="fr-input"
                        id="cfg-unit-secondary"
                        type="text"
                        value={state.unitSecondary}
                        onChange={e => onPatch({ unitSecondary: e.target.value })}
                        placeholder="%"
                        disabled={isGauge}
                        aria-describedby={
                            !dualAxisAvailable && hasRightSeries
                                ? "cfg-unit-secondary-warning"
                                : undefined
                        }
                    />
                    {!dualAxisAvailable && hasRightSeries && (
                        <p
                            id="cfg-unit-secondary-warning"
                            className="fr-hint-text"
                            style={{ color: "var(--text-default-warning)" }}
                        >
                            Le type courant ne supporte pas le double axe.
                        </p>
                    )}
                </div>

                <div className="fr-input-group" style={{ gridColumn: "1 / -1" }}>
                    <label className="fr-label" htmlFor="cfg-source">
                        Source des données
                        <span className="fr-hint-text">
                            Affichée en bas du graphique pour la traçabilité
                        </span>
                    </label>
                    <input
                        className="fr-input"
                        id="cfg-source"
                        type="text"
                        value={state.source}
                        onChange={e => onPatch({ source: e.target.value })}
                        placeholder="Ex : DGDDI, Bilan annuel 2025"
                    />
                </div>

                <div className="fr-select-group">
                    <label className="fr-label" htmlFor="cfg-type">
                        Type de graphique
                    </label>
                    <select
                        className="fr-select"
                        id="cfg-type"
                        value={state.chartType}
                        onChange={e =>
                            onPatch({ chartType: e.target.value as ChartType })
                        }
                    >
                        {CHART_TYPES.map(t => (
                            <option key={t.value} value={t.value}>
                                {t.label} — {t.description}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="fr-select-group">
                    <label className="fr-label" htmlFor="cfg-palette">
                        Palette DSFR
                    </label>
                    <select
                        className="fr-select"
                        id="cfg-palette"
                        value={state.palette}
                        onChange={e =>
                            onPatch({ palette: e.target.value as DsfrPalette })
                        }
                        disabled={isGauge}
                        aria-describedby={isGauge ? "cfg-palette-hint" : undefined}
                    >
                        {PALETTES.map(p => (
                            <option key={p.value} value={p.value}>
                                {p.label}
                            </option>
                        ))}
                    </select>
                    {isGauge && (
                        <p id="cfg-palette-hint" className="fr-hint-text">
                            La jauge utilise la palette DSFR officielle dédiée aux indicateurs.
                        </p>
                    )}
                </div>

                {isScatter && (
                    <div
                        className="fr-fieldset__element"
                        style={{ gridColumn: "1 / -1" }}
                    >
                        <div className="fr-checkbox-group">
                            <input
                                type="checkbox"
                                id="cfg-show-line"
                                checked={state.showLine}
                                onChange={e => onPatch({ showLine: e.target.checked })}
                            />
                            <label className="fr-label" htmlFor="cfg-show-line">
                                Relier les points (option <code>show-line</code>)
                            </label>
                        </div>
                    </div>
                )}

                {isGauge && (
                    <>
                        <div className="fr-input-group">
                            <label className="fr-label" htmlFor="cfg-gauge-init">
                                Valeur de départ (init)
                                <span className="fr-hint-text">Borne basse de la jauge</span>
                            </label>
                            <input
                                className="fr-input"
                                id="cfg-gauge-init"
                                type="number"
                                inputMode="decimal"
                                value={state.gaugeInit}
                                onChange={e =>
                                    onPatch({ gaugeInit: Number(e.target.value || 0) })
                                }
                            />
                        </div>

                        <div className="fr-input-group">
                            <label className="fr-label" htmlFor="cfg-gauge-target">
                                Valeur cible (target)
                                <span className="fr-hint-text">Borne haute de la jauge</span>
                            </label>
                            <input
                                className="fr-input"
                                id="cfg-gauge-target"
                                type="number"
                                inputMode="decimal"
                                value={state.gaugeTarget}
                                onChange={e =>
                                    onPatch({ gaugeTarget: Number(e.target.value || 0) })
                                }
                            />
                        </div>

                        <p
                            className="fr-text--sm fr-mb-0"
                            style={{
                                gridColumn: "1 / -1",
                                color: "var(--text-mention-grey)"
                            }}
                        >
                            La <strong>valeur courante</strong> de la jauge est lue dans la
                            première cellule numérique de votre tableau (1<sup>re</sup> ligne,
                            1<sup>re</sup> série).
                        </p>
                    </>
                )}
            </div>
        </section>
    );
}
