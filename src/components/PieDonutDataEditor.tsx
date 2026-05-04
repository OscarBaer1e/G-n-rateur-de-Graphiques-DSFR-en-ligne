// filepath: src/components/PieDonutDataEditor.tsx
// Saisie dédiée aux graphiques en secteurs (camembert / donut) : uniquement
// « libellé du secteur » + « valeur », sans colonne Rang, sans axes multiples,
// sans séries supplémentaires visibles. Les autres colonnes restent dans le
// state si l'utilisateur repasse à un autre type de graphique.

import { memo, useCallback, useId, useRef } from "react";
import { ClipboardPaste, Eraser, PieChart, Plus, Trash2, Wand2 } from "lucide-react";
import type { ChartState, DataColumn, DataRow } from "../types";
import { parseClipboard } from "../utils/clipboard";

interface Props {
    state: ChartState;
    onColumnsChange: (cols: DataColumn[]) => void;
    onRowsChange: (rows: DataRow[]) => void;
    onReset: () => void;
}

const newId = (): string =>
    `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const makePieRow = (labelCol: DataColumn, valueCol: DataColumn, label = "", value = ""): DataRow => ({
    id: newId(),
    rowLead: "",
    cells: { [labelCol.id]: label, [valueCol.id]: value }
});

export const PieDonutDataEditor = memo(function PieDonutDataEditor({
    state,
    onColumnsChange,
    onRowsChange,
    onReset
}: Props): JSX.Element {
    const fileInputId = useId();
    const gridRef = useRef<HTMLDivElement | null>(null);

    const labelCol = state.columns.find(c => c.isLabel);
    const valueCol = state.columns.filter(c => !c.isLabel)[0];

    const ensureMinimalStructure = useCallback(() => {
        const lc: DataColumn = { id: newId(), name: "Secteur", isLabel: true };
        const vc: DataColumn = {
            id: newId(),
            name: "Valeur",
            isLabel: false,
            axis: "left"
        };
        onColumnsChange([lc, vc]);
        onRowsChange([
            makePieRow(lc, vc),
            makePieRow(lc, vc),
            makePieRow(lc, vc),
            makePieRow(lc, vc)
        ]);
    }, [onColumnsChange, onRowsChange]);

    const renameColumn = useCallback(
        (colId: string, name: string) => {
            onColumnsChange(state.columns.map(c => (c.id === colId ? { ...c, name } : c)));
        },
        [state.columns, onColumnsChange]
    );

    const updateCell = useCallback(
        (rowId: string, colId: string, value: string) => {
            onRowsChange(
                state.rows.map(r =>
                    r.id === rowId ? { ...r, cells: { ...r.cells, [colId]: value } } : r
                )
            );
        },
        [state.rows, onRowsChange]
    );

    const addRow = useCallback(() => {
        if (!labelCol || !valueCol) return;
        onRowsChange([...state.rows, makePieRow(labelCol, valueCol)]);
    }, [labelCol, valueCol, state.rows, onRowsChange]);

    const removeRow = useCallback(
        (rowId: string) => {
            onRowsChange(state.rows.filter(r => r.id !== rowId));
        },
        [state.rows, onRowsChange]
    );

    const fillSample = useCallback(() => {
        const lc: DataColumn = { id: newId(), name: "Poste budgétaire", isLabel: true };
        const vc: DataColumn = {
            id: newId(),
            name: "Montant (M€)",
            isLabel: false,
            axis: "left"
        };
        const cols = [lc, vc];
        const data: [string, string][] = [
            ["Services", "42"],
            ["Biens", "28"],
            ["Énergie", "18"],
            ["Autres", "12"]
        ];
        onColumnsChange(cols);
        onRowsChange(data.map(([a, b]) => makePieRow(lc, vc, a, b)));
    }, [onColumnsChange, onRowsChange]);

    /** Colle depuis Excel : au plus 2 colonnes (libellé + valeur), lignes étendues. */
    const handlePaste = useCallback(
        (rowId: string, colId: string, raw: string) => {
            if (!labelCol || !valueCol) return false;
            const parsed = parseClipboard(raw);
            if (parsed.height <= 1 && parsed.width <= 1) return false;

            const startRowIdx = state.rows.findIndex(r => r.id === rowId);
            if (startRowIdx < 0) return false;

            const startColIdx = colId === labelCol.id ? 0 : colId === valueCol.id ? 1 : -1;
            if (startColIdx < 0) return false;

            const newRows: DataRow[] = state.rows.map(r => ({
                ...r,
                rowLead: "",
                cells: { ...r.cells }
            }));
            const maxW = Math.min(2, parsed.width);
            const requiredRows = startRowIdx + parsed.height;
            while (newRows.length < requiredRows) {
                newRows.push(makePieRow(labelCol, valueCol));
            }

            for (let i = 0; i < parsed.height; i++) {
                const targetRow = newRows[startRowIdx + i];
                if (!targetRow) continue;
                const line = parsed.rows[i] ?? [];
                for (let j = 0; j < maxW; j++) {
                    const dest = startColIdx + j;
                    if (dest > 1) break;
                    if (dest === 0) {
                        targetRow.cells[labelCol.id] = (line[j] ?? "").trim();
                    } else {
                        targetRow.cells[valueCol.id] = (line[j] ?? "").trim();
                    }
                }
            }

            onRowsChange(newRows);
            return true;
        },
        [state.rows, labelCol, valueCol, onRowsChange]
    );

    const handleGlobalPaste = useCallback(
        (e: React.ClipboardEvent<HTMLDivElement>) => {
            const text = e.clipboardData.getData("text/plain");
            if (!text) return;
            if ((e.target as HTMLElement).tagName.toLowerCase() === "input") return;

            const parsed = parseClipboard(text);
            if (parsed.height === 0) return;
            e.preventDefault();

            const w = Math.min(2, parsed.width);
            let lcName = "Secteur";
            let vcName = "Valeur";
            let lines: string[][];

            if (w >= 2) {
                const hdr = parsed.rows[0] ?? [];
                lcName = (hdr[0] ?? "Secteur").trim() || "Secteur";
                vcName = (hdr[1] ?? "Valeur").trim() || "Valeur";
                lines = parsed.rows.slice(1);
                if (lines.length === 0) lines = parsed.rows;
            } else {
                lines = parsed.rows;
            }

            const lc: DataColumn = { id: newId(), name: lcName, isLabel: true };
            const vc: DataColumn = {
                id: newId(),
                name: vcName,
                isLabel: false,
                axis: "left"
            };
            const cols = [lc, vc];
            const rows: DataRow[] = lines.map(line =>
                makePieRow(
                    lc,
                    vc,
                    (line[0] ?? "").trim(),
                    w >= 2 ? (line[1] ?? "").trim() : ""
                )
            );
            onColumnsChange(cols);
            onRowsChange(rows.length > 0 ? rows : [makePieRow(lc, vc)]);
        },
        [onColumnsChange, onRowsChange]
    );

    /* ---------------------------------------------------------------------- */
    /* État incomplet : pas encore de colonne libellé / valeur                  */
    /* ---------------------------------------------------------------------- */

    if (!labelCol || !valueCol) {
        return (
            <section className="gb-card gb-pie-editor" aria-labelledby="data-title">
                <div className="gb-card__header">
                    <PieChart className="gb-card__icon" size={24} aria-hidden="true" />
                    <h2 id="data-title">Données — secteurs</h2>
                </div>
                <div className="fr-callout fr-callout--brown-caramel fr-my-2w">
                    <p className="fr-callout__text">
                        Pour un camembert ou un donut, il faut une colonne de libellés de secteurs
                        et une colonne de valeurs numériques.
                    </p>
                </div>
                <button type="button" className="fr-btn" onClick={ensureMinimalStructure}>
                    Créer le tableau secteurs (2 colonnes)
                </button>
            </section>
        );
    }

    const kind = state.chartType === "donut" ? "donut" : "camembert";

    return (
        <section className="gb-card gb-pie-editor" aria-labelledby="data-title">
            <div className="gb-card__header">
                <PieChart className="gb-card__icon" size={24} aria-hidden="true" />
                <h2 id="data-title">Données — {kind}</h2>
                <span className="gb-spacer" />
                <span className="fr-text--sm fr-mb-0" style={{ color: "var(--text-mention-grey)" }}>
                    {state.rows.length} secteur{state.rows.length > 1 ? "s" : ""}
                </span>
            </div>

            <div className="fr-callout fr-callout--blue-ecume fr-my-2w">
                <p className="fr-callout__text fr-mb-0">
                    Mode <strong>{kind}</strong> : une ligne = un secteur. Colonne de gauche = nom
                    affiché sur le graphique ; colonne de droite = valeur (nombre). Les séries
                    supplémentaires et le double axe sont masqués ici ; si vous repassez à un autre
                    type de graphique, vos colonnes supplémentaires restent disponibles.
                </p>
            </div>

            <div className="gb-paste-zone" role="note">
                <ClipboardPaste size={16} aria-hidden="true" style={{ verticalAlign: "-3px", marginRight: 6 }} />
                Collez depuis Excel : <strong>2 colonnes</strong> (libellé, puis valeur). Une seule
                colonne collée remplit uniquement les libellés.
            </div>

            <div className="gb-toolbar" role="toolbar" aria-label="Actions sur les secteurs">
                <button type="button" className="fr-btn fr-btn--secondary fr-btn--sm" onClick={addRow}>
                    <Plus size={16} aria-hidden="true" /> &nbsp;Ajouter un secteur
                </button>
                <button type="button" className="fr-btn fr-btn--tertiary fr-btn--sm" onClick={fillSample}>
                    <Wand2 size={16} aria-hidden="true" /> &nbsp;Exemple
                </button>
                <span className="gb-spacer" />
                <button
                    type="button"
                    className="fr-btn fr-btn--tertiary fr-btn--sm"
                    onClick={onReset}
                    aria-describedby={fileInputId}
                >
                    <Eraser size={16} aria-hidden="true" /> &nbsp;Réinitialiser tout
                </button>
            </div>

            <div
                ref={gridRef}
                className="gb-grid-wrap"
                tabIndex={0}
                role="region"
                aria-label={`Tableau des secteurs pour le graphique en ${kind}`}
                onPaste={handleGlobalPaste}
            >
                <table className="gb-data-table gb-data-table--pie">
                    <thead>
                        <tr>
                            <th scope="col" className="gb-pie-th">
                                <input
                                    className="gb-col-name"
                                    type="text"
                                    value={labelCol.name}
                                    aria-label="Nom de la colonne libellés des secteurs"
                                    onChange={e => renameColumn(labelCol.id, e.target.value)}
                                />
                            </th>
                            <th scope="col" className="gb-pie-th">
                                <input
                                    className="gb-col-name"
                                    type="text"
                                    value={valueCol.name}
                                    aria-label="Nom de la colonne valeurs"
                                    onChange={e => renameColumn(valueCol.id, e.target.value)}
                                />
                            </th>
                            <th className="gb-col-actions" scope="col" aria-label="Actions">
                                {" "}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {state.rows.map((row, rowIdx) => (
                            <tr key={row.id}>
                                <td>
                                    <input
                                        className="gb-cell-input"
                                        type="text"
                                        value={row.cells[labelCol.id] ?? ""}
                                        onChange={e =>
                                            updateCell(row.id, labelCol.id, e.target.value)
                                        }
                                        onPaste={e => {
                                            const t = e.clipboardData.getData("text/plain");
                                            if (t.includes("\t") || t.includes("\n")) {
                                                if (handlePaste(row.id, labelCol.id, t)) {
                                                    e.preventDefault();
                                                }
                                            }
                                        }}
                                        aria-label={`Libellé du secteur, ligne ${rowIdx + 1}`}
                                    />
                                </td>
                                <td>
                                    <input
                                        className="gb-cell-input"
                                        type="text"
                                        value={row.cells[valueCol.id] ?? ""}
                                        onChange={e =>
                                            updateCell(row.id, valueCol.id, e.target.value)
                                        }
                                        onPaste={e => {
                                            const t = e.clipboardData.getData("text/plain");
                                            if (t.includes("\t") || t.includes("\n")) {
                                                if (handlePaste(row.id, valueCol.id, t)) {
                                                    e.preventDefault();
                                                }
                                            }
                                        }}
                                        aria-label={`Valeur du secteur, ligne ${rowIdx + 1}`}
                                    />
                                </td>
                                <td className="gb-col-actions">
                                    <button
                                        type="button"
                                        className="gb-icon-btn"
                                        aria-label={`Supprimer le secteur ${rowIdx + 1}`}
                                        onClick={() => removeRow(row.id)}
                                    >
                                        <Trash2 size={14} aria-hidden="true" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <p id={fileInputId} className="fr-sr-only">
                Réinitialise les données et le format du tableau selon la configuration par défaut.
            </p>
        </section>
    );
});
