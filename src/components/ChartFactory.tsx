// filepath: src/components/ChartFactory.tsx
// Fabrique unique de rendu pour tous les web components @gouvfr/dsfr-chart.
// Centralise le mapping tagName -> JSX et garantit que tout nouveau type de
// graphique est ajouté à un seul endroit.
//
// Le composant prend en entrée un ChartAttributes déjà construit par
// buildChartAttributes() et le projette sur la balise web component appropriée.
//
// Important : React réserve la prop `name` (formulaires). Sur les custom elements,
// elle peut ne pas être posée comme attribut HTML alors que dsfr-chart lit
// `getAttribute("name")` pour la légende. On retire `name` du spread et on fait
// `setAttribute("name", …)` après le montage / mise à jour.

import { memo, useLayoutEffect, useMemo, useRef } from "react";
import type { ChartAttributes } from "../utils/chartGenerator";

interface Props {
    computed: ChartAttributes;
}

function ChartFactoryComponent({ computed }: Props): JSX.Element {
    const { tagName, attrs } = computed;
    const nameJson = attrs.name;
    const attrsSansName = useMemo(() => {
        const { name: _omit, ...rest } = attrs;
        return rest;
    }, [attrs]);

    const ref = useRef<HTMLElement | null>(null);

    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;
        if (nameJson !== undefined) el.setAttribute("name", nameJson);
        else el.removeAttribute("name");
    }, [nameJson, tagName]);

    const setHostRef = (el: HTMLElement | null): void => {
        ref.current = el;
    };

    switch (tagName) {
        case "bar-chart":
            return <bar-chart ref={setHostRef} {...attrsSansName} />;
        case "line-chart":
            return <line-chart ref={setHostRef} {...attrsSansName} />;
        case "pie-chart":
            return <pie-chart ref={setHostRef} {...attrsSansName} />;
        case "scatter-chart":
            return <scatter-chart ref={setHostRef} {...attrsSansName} />;
        case "radar-chart":
            return <radar-chart ref={setHostRef} {...attrsSansName} />;
        case "gauge-chart":
            return <gauge-chart ref={setHostRef} {...attrsSansName} />;
        case "bar-line-chart":
            return <bar-line-chart ref={setHostRef} {...attrsSansName} />;
        default: {
            const _exhaustive: never = tagName;
            void _exhaustive;
            return <></>;
        }
    }
}

export const ChartFactory = memo(ChartFactoryComponent);
