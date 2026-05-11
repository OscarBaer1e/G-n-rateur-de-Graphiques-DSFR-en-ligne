// filepath: src/components/ChartPreview.tsx
import { useEffect, useMemo, useState } from "react";
import { Calendar, Info, LineChart as LineChartIcon, Split } from "lucide-react";
import type { ChartState } from "../types";
import {
    buildChartAttributes,
    type DualAxisWarning,
    type GaugeWarning
} from "../utils/chartGenerator";
import { ChartFactory } from "./ChartFactory";

interface Props {
    state: ChartState;
}

const GAUGE_WARNING_MESSAGES: Record<GaugeWarning, string> = {
    "multiple-rows":
        "La jauge n'utilise qu'une seule valeur. Seule la première ligne du tableau sera affichée — les autres lignes sont conservées et seront réutilisées si vous changez de type de graphique.",
    "no-numeric-value":
        "Aucune valeur numérique n'a été détectée dans la première ligne. Saisissez un nombre dans la première colonne de série pour alimenter la jauge.",
    "invalid-bounds":
        "La valeur cible doit être strictement supérieure à la valeur de départ pour que la jauge soit lisible."
};

const DUAL_AXIS_WARNING_MESSAGES: Record<DualAxisWarning, string> = {
    "incompatible-chart-type":
        "Le type de graphique courant ne supporte pas le double axe Y. Choisissez « Barres verticales », « Barres empilées » ou « Lignes » pour activer le rendu mixte.",
    "horizontal-not-supported":
        "Les barres horizontales ne supportent pas l'axe Y secondaire dans DSFR Chart. Bascule en barres verticales pour conserver les deux axes.",
    "multiple-left-series":
        "Plusieurs séries sont sur l'axe gauche : seule la première sera affichée en barres (limitation officielle de <bar-line-chart>). Pensez à fusionner ou retirer les colonnes en trop.",
    "multiple-right-series":
        "Plusieurs séries sont sur l'axe droit : seule la première sera affichée en ligne. Retirez les colonnes en trop ou utilisez deux graphiques distincts.",
    "missing-left-series":
        "Aucune série n'est assignée à l'axe gauche : ajoutez au moins une colonne en « Axe G » pour afficher les barres.",
    "missing-secondary-unit":
        "Pensez à renseigner l'unité de l'axe droit dans la configuration (ex : %)."
};

export function ChartPreview({ state }: Props): JSX.Element {
    const computed = useMemo(() => buildChartAttributes(state), [state]);

    const theme = useDsfrTheme();

    const remountKey = [
        computed.tagName,
        state.chartType,
        state.palette,
        theme,
        state.unit,
        state.unitSecondary,
        computed.attrs["unit-tooltip"] ?? "",
        computed.attrs["unit-tooltip-bar"] ?? "",
        computed.attrs["unit-tooltip-line"] ?? "",
        computed.attrs.x ?? "",
        computed.attrs.y ?? "",
        computed.attrs["y-bar"] ?? "",
        computed.attrs["y-line"] ?? "",
        computed.attrs.value ?? "",
        computed.attrs.init ?? "",
        computed.attrs.target ?? "",
        computed.attrs.name ?? ""
    ].join("|");

    const isGauge = computed.tagName === "gauge-chart";
    const hasGaugeWarnings = isGauge && computed.gaugeWarnings.length > 0;
    const hasDualAxisWarnings = computed.dualAxisWarnings.length > 0;

    return (
        <section className="gb-card" aria-labelledby="preview-title">
            <div className="gb-card__header">
                <LineChartIcon className="gb-card__icon" size={24} aria-hidden="true" />
                <h2 id="preview-title">Aperçu du graphique</h2>
            </div>

            {state.title && <h3 className="fr-h5 fr-mb-2w">{state.title}</h3>}

            {state.description.trim().length > 0 && (
                <p className="fr-text--sm gb-chart-description fr-mb-2w">
                    {state.description.trim()}
                </p>
            )}

            <div className="gb-preview-flags">
                {computed.dualAxisActive && (
                    <span className="gb-flag gb-flag--info">
                        <Split size={12} aria-hidden="true" /> &nbsp;Double axe Y :{" "}
                        <strong>
                            {state.unit || "—"} (G) / {state.unitSecondary || "—"} (D)
                        </strong>
                    </span>
                )}
                {computed.yearAxisDetected && (
                    <span className="gb-flag gb-flag--info">
                        <Calendar size={12} aria-hidden="true" /> &nbsp;Axe X « années »
                        détecté — pas de décimales, pas de séparateur de milliers
                    </span>
                )}
            </div>

            {hasGaugeWarnings && (
                <div
                    className="fr-alert fr-alert--info fr-alert--sm fr-mb-2w"
                    role="status"
                >
                    <h3 className="fr-alert__title">
                        <Info
                            size={16}
                            aria-hidden="true"
                            style={{ verticalAlign: "-3px", marginRight: 6 }}
                        />
                        Données et type de graphique
                    </h3>
                    <ul className="fr-mb-0" style={{ paddingLeft: "1.25rem" }}>
                        {computed.gaugeWarnings.map(w => (
                            <li key={w}>{GAUGE_WARNING_MESSAGES[w]}</li>
                        ))}
                    </ul>
                </div>
            )}

            {hasDualAxisWarnings && (
                <div
                    className="fr-alert fr-alert--info fr-alert--sm fr-mb-2w"
                    role="status"
                >
                    <h3 className="fr-alert__title">
                        <Split
                            size={16}
                            aria-hidden="true"
                            style={{ verticalAlign: "-3px", marginRight: 6 }}
                        />
                        Configuration du double axe Y
                    </h3>
                    <ul className="fr-mb-0" style={{ paddingLeft: "1.25rem" }}>
                        {computed.dualAxisWarnings.map(w => (
                            <li key={w}>{DUAL_AXIS_WARNING_MESSAGES[w]}</li>
                        ))}
                    </ul>
                </div>
            )}

            <div className="gb-preview-host" data-chart-type={state.chartType}>
                {!computed.hasData ? (
                    <p className="gb-preview-empty">
                        {isGauge
                            ? "Renseignez au moins une valeur numérique pour afficher la jauge."
                            : "Renseignez au moins une catégorie et une valeur dans le tableau pour afficher l'aperçu."}
                    </p>
                ) : (
                    <ChartFactory key={remountKey} computed={computed} />
                )}
            </div>

            {state.source && (
                <p
                    className="fr-text--sm fr-mt-2w"
                    style={{ color: "var(--text-mention-grey)" }}
                >
                    Source : {state.source}
                </p>
            )}
        </section>
    );
}

/**
 * Lit `data-fr-theme` sur <html> et observe ses changements.
 * Utilisé pour invalider la `key` du chart à chaque bascule de thème.
 */
function useDsfrTheme(): "light" | "dark" {
    const read = (): "light" | "dark" =>
        document.documentElement.getAttribute("data-fr-theme") === "dark"
            ? "dark"
            : "light";

    const [theme, setTheme] = useState<"light" | "dark">(() => read());

    useEffect(() => {
        const observer = new MutationObserver(() => setTheme(read()));
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["data-fr-theme"]
        });
        return () => observer.disconnect();
    }, []);

    return theme;
}
