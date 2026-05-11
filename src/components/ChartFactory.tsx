// filepath: src/components/ChartFactory.tsx
// Fabrique unique de rendu pour tous les web components @gouvfr/dsfr-chart.
// Centralise le mapping tagName -> JSX et garantit que tout nouveau type de
// graphique est ajouté à un seul endroit.
//
// Le composant prend en entrée un ChartAttributes déjà construit par
// buildChartAttributes() et le projette sur la balise web component appropriée.

import { memo } from "react";
import type { ChartAttributes } from "../utils/chartGenerator";

interface Props {
    computed: ChartAttributes;
}

function ChartFactoryComponent({ computed }: Props): JSX.Element {
    const { tagName, attrs } = computed;

    switch (tagName) {
        case "bar-chart":
            return <bar-chart {...attrs} />;
        case "line-chart":
            return <line-chart {...attrs} />;
        case "pie-chart":
            return <pie-chart {...attrs} />;
        case "scatter-chart":
            return <scatter-chart {...attrs} />;
        case "radar-chart":
            return <radar-chart {...attrs} />;
        case "gauge-chart":
            return <gauge-chart {...attrs} />;
        case "bar-line-chart":
            return <bar-line-chart {...attrs} />;
        default: {
            const _exhaustive: never = tagName;
            void _exhaustive;
            return <></>;
        }
    }
}

export const ChartFactory = memo(ChartFactoryComponent);
