// filepath: src/components/ThemeSwitcher.tsx
// Sélecteur d'apparence DSFR (Système / Clair / Sombre).
// - Pose data-fr-scheme + data-fr-theme sur <html>.
// - Persiste dans localStorage.
// - S'abonne à prefers-color-scheme tant que "Système" est actif.

import { useCallback, useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import {
    applyScheme,
    getStoredScheme,
    resolveTheme,
    SCHEME_CHOICES,
    subscribeSystemTheme,
    type DsfrScheme,
    type DsfrTheme
} from "../utils/theme";

interface Props {
    onThemeChange?: (theme: DsfrTheme) => void;
}

function renderIcon(icon: "sun" | "moon" | "system", size = 14): JSX.Element {
    const props = { size, "aria-hidden": true } as const;
    if (icon === "sun") return <Sun {...props} />;
    if (icon === "moon") return <Moon {...props} />;
    return <Monitor {...props} />;
}

export function ThemeSwitcher({ onThemeChange }: Props): JSX.Element {
    const [scheme, setSchemeState] = useState<DsfrScheme>(() => getStoredScheme());

    /* Applique le scheme au DOM dès le 1er rendu et à chaque changement. */
    useEffect(() => {
        const theme = applyScheme(scheme);
        onThemeChange?.(theme);
    }, [scheme, onThemeChange]);

    /* En mode "system", suit dynamiquement les changements OS (jour/nuit). */
    useEffect(() => {
        if (scheme !== "system") return undefined;
        return subscribeSystemTheme(theme => {
            document.documentElement.setAttribute("data-fr-theme", theme);
            onThemeChange?.(theme);
        });
    }, [scheme, onThemeChange]);

    const handleChange = useCallback((next: DsfrScheme) => {
        setSchemeState(next);
    }, []);

    const currentTheme = resolveTheme(scheme);

    return (
        <div
            className="gb-theme-switcher"
            role="radiogroup"
            aria-label="Choisir le thème d'affichage"
        >
            <span className="fr-sr-only">
                Thème actuel : {currentTheme === "dark" ? "sombre" : "clair"}
            </span>
            {SCHEME_CHOICES.map(choice => {
                const active = scheme === choice.value;
                return (
                    <button
                        key={choice.value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        className={`gb-theme-switcher__btn${active ? " is-active" : ""}`}
                        onClick={() => handleChange(choice.value)}
                        title={`Apparence : ${choice.label}`}
                    >
                        {renderIcon(choice.icon)}
                        <span className="gb-theme-switcher__label">{choice.label}</span>
                    </button>
                );
            })}
        </div>
    );
}
