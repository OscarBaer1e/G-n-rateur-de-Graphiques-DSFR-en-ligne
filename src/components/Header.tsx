// filepath: src/components/Header.tsx
import { BarChart3 } from "lucide-react";
import { ThemeSwitcher } from "./ThemeSwitcher";

export function Header(): JSX.Element {
    return (
        <header role="banner" className="fr-header">
            <div className="fr-header__body">
                <div className="fr-container">
                    <div
                        className="fr-header__body-row"
                        style={{ alignItems: "center" }}
                    >
                        <div className="fr-header__brand fr-enlarge-link">
                            <div className="fr-header__brand-top">
                                <div className="fr-header__logo">
                                    <p className="fr-logo">
                                        République
                                        <br />
                                        Française
                                    </p>
                                </div>
                            </div>
                            <div className="fr-header__service">
                                <p
                                    className="fr-header__service-title"
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "0.5rem"
                                    }}
                                >
                                    <BarChart3 size={20} aria-hidden="true" />
                                    Générateur de Graphiques DSFR en ligne
                                </p>
                                <p className="fr-header__service-tagline">
                                    Création de visualisations accessibles, conformes au DSFR & RGAA
                                </p>
                            </div>
                        </div>

                        <div className="gb-header__tools">
                            <ThemeSwitcher />
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
}
