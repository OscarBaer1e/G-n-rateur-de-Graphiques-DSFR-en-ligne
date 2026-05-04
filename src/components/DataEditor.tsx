// filepath: src/components/DataEditor.tsx
import { memo, useCallback, useId, useRef } from "react";
import {
    AlignLeft,
    AlignRight,
    ClipboardPaste,
    Eraser,
    Plus,
    Table,
    Trash2,
    Wand2
} from "lucide-react";
import type { ChartState, DataColumn, DataRow, SeriesAxis } from "../types";
import { parseClipboard } from "../utils/clipboard";
import { PieDonutDataEditor } from "./PieDonutDataEditor";

interface Props {
    state: ChartState;
    onColumnsChange: (cols: DataColumn[]) => void;
    onRowsChange: (rows: DataRow[]) => void;
    onReset: () => void;
}

const newId = (): string =>
    `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const makeRow = (cols: DataColumn[], values?: string[]): DataRow => {
    const cells: Record<string, string> = {};
    cols.forEach((c, i) => {
        cells[c.id] = values?.[i] ?? "";
    });
    return { id: newId(), rowLead: "", cells };
};

function StandardDataEditor({
    state,
    onColumnsChange,
    onRowsChange,
    onReset
}: Props): JSX.Element {
    const fileInputId = useId();
    const gridRef = useRef<HTMLDivElement | null>(null);

    /* -------------------- Mutations colonnes / lignes -------------------- */

    const renameColumn = useCallback(
        (colId: string, name: string) => {
            onColumnsChange(state.columns.map(c => (c.id === colId ? { ...c, name } : c)));
        },
        [state.columns, onColumnsChange]
    );

    const setColumnAxis = useCallback(
        (colId: string, axis: SeriesAxis) => {
            onColumnsChange(
                state.columns.map(c => (c.id === colId ? { ...c, axis } : c))
            );
        },
        [state.columns, onColumnsChange]
    );

    const removeColumn = useCallback(
        (colId: string) => {
            const target = state.columns.find(c => c.id === colId);
            if (!target || target.isLabel) return;
            const remaining = state.columns.filter(c => c.id !== colId);
            onColumnsChange(remaining);
            onRowsChange(
                state.rows.map(r => {
                    const { [colId]: _omit, ...rest } = r.cells;
                    void _omit;
                    return { ...r, cells: rest };
                })
            );
        },
        [state.columns, state.rows, onColumnsChange, onRowsChange]
    );

    const addColumn = useCallback(() => {
        const idx = state.columns.filter(c => !c.isLabel).length + 1;
        const next: DataColumn = {
            id: newId(),
            name: `Série ${idx}`,
            isLabel: false,
            axis: "left"
        };
        onColumnsChange([...state.columns, next]);
        onRowsChange(
            state.rows.map(r => ({ ...r, cells: { ...r.cells, [next.id]: "" } }))
        );
    }, [state.columns, state.rows, onColumnsChange, onRowsChange]);

    const addRow = useCallback(() => {
        onRowsChange([...state.rows, makeRow(state.columns)]);
    }, [state.columns, state.rows, onRowsChange]);

    const removeRow = useCallback(
        (rowId: string) => {
            onRowsChange(state.rows.filter(r => r.id !== rowId));
        },
        [state.rows, onRowsChange]
    );

    const updateRowLead = useCallback(
        (rowId: string, value: string) => {
            onRowsChange(
                state.rows.map(r =>
                    r.id === rowId ? { ...r, rowLead: value } : r
                )
            );
        },
        [state.rows, onRowsChange]
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

    /* -------------------- Coller depuis Excel / Sheets -------------------- */

    const handlePaste = useCallback(
        (rowId: string, colId: string, raw: string) => {
            const parsed = parseClipboard(raw);
            if (parsed.height <= 1 && parsed.width <= 1) return false;

            const startRowIdx = state.rows.findIndex(r => r.id === rowId);
            const startColIdx = state.columns.findIndex(c => c.id === colId);
            if (startRowIdx < 0 || startColIdx < 0) return false;

            const requiredCols = startColIdx + parsed.width;
            const newColumns = [...state.columns];
            let seriesCount = newColumns.filter(c => !c.isLabel).length;
            while (newColumns.length < requiredCols) {
                seriesCount += 1;
                newColumns.push({
                    id: newId(),
                    name: `Série ${seriesCount}`,
                    isLabel: false,
                    axis: "left"
                });
            }

            const newRows = state.rows.map(r => ({ ...r, cells: { ...r.cells } }));
            const requiredRows = startRowIdx + parsed.height;
            while (newRows.length < requiredRows) {
                newRows.push(makeRow(newColumns));
            }

            for (let i = 0; i < parsed.height; i++) {
                const targetRow = newRows[startRowIdx + i];
                if (!targetRow) continue;
                const lineCells = parsed.rows[i] ?? [];
                for (let j = 0; j < parsed.width; j++) {
                    const col = newColumns[startColIdx + j];
                    if (!col) continue;
                    targetRow.cells[col.id] = (lineCells[j] ?? "").trim();
                }
            }

            onColumnsChange(newColumns);
            onRowsChange(newRows);
            return true;
        },
        [state.rows, state.columns, onColumnsChange, onRowsChange]
    );

    /* -------------------- Coller "global" sur la grille -------------------- */

    const handleGlobalPaste = useCallback(
        (e: React.ClipboardEvent<HTMLDivElement>) => {
            const text = e.clipboardData.getData("text/plain");
            if (!text) return;

            const tag = (e.target as HTMLElement).tagName.toLowerCase();
            if (tag === "input") return;

            const parsed = parseClipboard(text);
            if (parsed.height === 0) return;
            e.preventDefault();

            const [header, ...dataLines] = parsed.rows;
            const labelHeader = header?.[0] ?? "Catégorie";
            const newColumns: DataColumn[] = [
                { id: newId(), name: labelHeader || "Catégorie", isLabel: true }
            ];
            for (let j = 1; j < parsed.width; j++) {
                newColumns.push({
                    id: newId(),
                    name: header?.[j] || `Série ${j}`,
                    isLabel: false,
                    axis: "left"
                });
            }
            const newRows: DataRow[] = dataLines.map(line => makeRow(newColumns, line));
            onColumnsChange(newColumns);
            onRowsChange(newRows.length > 0 ? newRows : [makeRow(newColumns)]);
        },
        [onColumnsChange, onRowsChange]
    );

    /* -------------------- Démo : remplir avec un jeu d'exemple ----------- */

    const fillSample = useCallback(() => {
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
        const data: [string, string, string][] = [
            ["Café", "412", "5.2"],
            ["Cacao", "455", "8.1"],
            ["Thé", "298", "-2.4"],
            ["Tabac", "521", "3.7"],
            ["Sucre", "163", "-1.1"],
            ["Vanille", "92", "12.3"]
        ];
        onColumnsChange(cols);
        onRowsChange(data.map(d => makeRow(cols, d)));
    }, [onColumnsChange, onRowsChange]);

    /* -------------------- Rendu -------------------- */

    return (
        <section className="gb-card" aria-labelledby="data-title">
            <div className="gb-card__header">
                <Table className="gb-card__icon" size={24} aria-hidden="true" />
                <h2 id="data-title">Données</h2>
                <span className="gb-spacer" />
                <span className="fr-text--sm fr-mb-0" style={{ color: "var(--text-mention-grey)" }}>
                    {state.rows.length} ligne{state.rows.length > 1 ? "s" : ""} ·{" "}
                    {state.columns.length} colonne{state.columns.length > 1 ? "s" : ""}
                </span>
            </div>

            <div className="gb-paste-zone" role="note">
                <ClipboardPaste size={16} aria-hidden="true" style={{ verticalAlign: "-3px", marginRight: 6 }} />
                <strong>Astuce :</strong> sélectionnez vos cellules dans Excel / Google Sheets, puis collez (Ctrl/Cmd + V) directement dans une cellule du tableau ou dans la zone vide de la grille pour importer les données en masse. Cliquez sur l'étiquette « Axe » dans l'en-tête d'une colonne pour basculer entre l'axe Y gauche (volume) et l'axe Y droit (variation/%).
            </div>

            <div className="gb-toolbar" role="toolbar" aria-label="Actions sur le tableau">
                <button type="button" className="fr-btn fr-btn--secondary fr-btn--sm" onClick={addRow}>
                    <Plus size={16} aria-hidden="true" /> &nbsp;Ajouter une ligne
                </button>
                <button type="button" className="fr-btn fr-btn--secondary fr-btn--sm" onClick={addColumn}>
                    <Plus size={16} aria-hidden="true" /> &nbsp;Ajouter une série
                </button>
                <button type="button" className="fr-btn fr-btn--tertiary fr-btn--sm" onClick={fillSample}>
                    <Wand2 size={16} aria-hidden="true" /> &nbsp;Exemple (Produits / M€ / %)
                </button>
                <span className="gb-spacer" />
                <button
                    type="button"
                    className="fr-btn fr-btn--tertiary fr-btn--sm"
                    onClick={onReset}
                    aria-describedby={fileInputId}
                >
                    <Eraser size={16} aria-hidden="true" /> &nbsp;Vider le tableau
                </button>
            </div>

            <div
                ref={gridRef}
                className="gb-grid-wrap"
                tabIndex={0}
                role="region"
                aria-label="Tableau de données du graphique"
                onPaste={handleGlobalPaste}
            >
                <table className="gb-data-table">
                    <thead>
                        <tr>
                            <th className="gb-row-header gb-row-header--lead" scope="col">
                                <span title="Libellé utilisé en priorité pour l'axe des catégories et les secteurs (camembert / donut) si renseigné.">
                                    Rang
                                </span>
                            </th>
                            {state.columns.map(col => (
                                <th key={col.id} scope="col">
                                    <div className="gb-th-content">
                                        <input
                                            className="gb-col-name"
                                            type="text"
                                            value={col.name}
                                            aria-label={`Nom de la colonne ${col.name}`}
                                            onChange={e => renameColumn(col.id, e.target.value)}
                                        />
                                        {!col.isLabel && (
                                            <>
                                                <AxisToggle
                                                    axis={col.axis ?? "left"}
                                                    columnName={col.name}
                                                    onChange={a => setColumnAxis(col.id, a)}
                                                />
                                                <button
                                                    type="button"
                                                    className="gb-icon-btn"
                                                    onClick={() => removeColumn(col.id)}
                                                    aria-label={`Supprimer la colonne ${col.name}`}
                                                >
                                                    <Trash2 size={14} aria-hidden="true" />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </th>
                            ))}
                            <th className="gb-col-actions" scope="col" aria-label="Actions">
                                {" "}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {state.rows.map((row, rowIdx) => (
                            <DataRowView
                                key={row.id}
                                row={row}
                                rowIdx={rowIdx}
                                columns={state.columns}
                                onCellChange={updateCell}
                                onRowLeadChange={updateRowLead}
                                onPasteCell={handlePaste}
                                onRemove={removeRow}
                            />
                        ))}
                    </tbody>
                </table>
            </div>

            <p className="gb-grid-info">
                La colonne <strong>Rang</strong> (à gauche) est éditable : si vous y saisissez un
                texte, il sert de libellé principal pour l'axe et les graphiques en secteurs (camembert
                et donut), en remplacement de la colonne «&nbsp;catégorie&nbsp;». Vide = numéro de ligne
                affiché en grisé et libellé pris depuis la colonne catégorie. Les autres colonnes sont
                des séries ; utilisez les pastilles «&nbsp;Axe&nbsp;G&nbsp;» / «&nbsp;Axe&nbsp;D&nbsp;» pour
                le double axe barres+ligne.
            </p>
        </section>
    );
}

/* -------------------------------------------------------------------------- */
/* Toggle Axe gauche / Axe droit                                               */
/* -------------------------------------------------------------------------- */

interface AxisToggleProps {
    axis: SeriesAxis;
    columnName: string;
    onChange: (axis: SeriesAxis) => void;
}

const AxisToggle = memo(function AxisToggle({ axis, columnName, onChange }: AxisToggleProps) {
    const isRight = axis === "right";
    return (
        <button
            type="button"
            className={`gb-axis-toggle${isRight ? " gb-axis-toggle--right" : ""}`}
            onClick={() => onChange(isRight ? "left" : "right")}
            aria-pressed={isRight}
            title={
                isRight
                    ? `« ${columnName} » est sur l'axe Y droit. Cliquez pour la repasser à gauche.`
                    : `« ${columnName} » est sur l'axe Y gauche. Cliquez pour la basculer à droite.`
            }
        >
            {isRight ? (
                <AlignRight size={12} aria-hidden="true" />
            ) : (
                <AlignLeft size={12} aria-hidden="true" />
            )}
            <span>Axe&nbsp;{isRight ? "D" : "G"}</span>
        </button>
    );
});

/* -------------------------------------------------------------------------- */
/* Ligne du tableau (mémoïsée)                                                 */
/* -------------------------------------------------------------------------- */

interface RowProps {
    row: DataRow;
    rowIdx: number;
    columns: DataColumn[];
    onCellChange: (rowId: string, colId: string, value: string) => void;
    onRowLeadChange: (rowId: string, value: string) => void;
    onPasteCell: (rowId: string, colId: string, raw: string) => boolean;
    onRemove: (rowId: string) => void;
}

const DataRowView = memo(function DataRowView({
    row,
    rowIdx,
    columns,
    onCellChange,
    onRowLeadChange,
    onPasteCell,
    onRemove
}: RowProps) {
    return (
        <tr>
            <td className="gb-row-header gb-row-header--lead-cell">
                <input
                    className="gb-cell-input gb-cell-input--lead"
                    type="text"
                    value={row.rowLead ?? ""}
                    placeholder={String(rowIdx + 1)}
                    onChange={e => onRowLeadChange(row.id, e.target.value)}
                    aria-label={`Rang ou libellé prioritaire pour le graphique, ligne ${rowIdx + 1}`}
                />
            </td>
            {columns.map(col => (
                <td key={col.id}>
                    <input
                        className="gb-cell-input"
                        type="text"
                        value={row.cells[col.id] ?? ""}
                        onChange={e => onCellChange(row.id, col.id, e.target.value)}
                        onPaste={e => {
                            const text = e.clipboardData.getData("text/plain");
                            if (text.includes("\t") || text.includes("\n")) {
                                if (onPasteCell(row.id, col.id, text)) {
                                    e.preventDefault();
                                }
                            }
                        }}
                        aria-label={`${col.name}, ligne ${rowIdx + 1}`}
                    />
                </td>
            ))}
            <td className="gb-col-actions">
                <button
                    type="button"
                    className="gb-icon-btn"
                    aria-label={`Supprimer la ligne ${rowIdx + 1}`}
                    onClick={() => onRemove(row.id)}
                >
                    <Trash2 size={14} aria-hidden="true" />
                </button>
            </td>
        </tr>
    );
});

function DataEditorRouter(props: Props): JSX.Element {
    if (props.state.chartType === "pie" || props.state.chartType === "donut") {
        return <PieDonutDataEditor {...props} />;
    }
    return <StandardDataEditor {...props} />;
}

export const DataEditor = memo(DataEditorRouter);
