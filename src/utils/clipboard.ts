// filepath: src/utils/clipboard.ts
// Parser de presse-papier : Excel, Google Sheets et CSV.
// - Excel / Sheets utilisent le TSV (tabulations entre cellules).
// - On supporte aussi le CSV avec virgule ou point-virgule.

export interface ParsedClipboard {
    rows: string[][];
    /** nombre de colonnes (max d'une ligne) */
    width: number;
    height: number;
}

/**
 * Détecte le séparateur de colonnes dans une chaîne pastée.
 * Priorité : tabulation > point-virgule > virgule.
 */
function detectDelimiter(text: string): string {
    const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
    if (firstLine.includes("\t")) return "\t";
    if (firstLine.includes(";")) return ";";
    if (firstLine.includes(",")) return ",";
    // Aucun séparateur : on traite comme une colonne unique.
    return "\t";
}

/**
 * Parser CSV minimaliste qui respecte les guillemets simples et doubles.
 * Suffisant pour les exports Excel / Sheets standards.
 */
function parseLine(line: string, delimiter: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const ch = line[i];

        if (inQuotes) {
            if (ch === '"' && line[i + 1] === '"') {
                current += '"';
                i++;
            } else if (ch === '"') {
                inQuotes = false;
            } else {
                current += ch;
            }
        } else {
            if (ch === '"') {
                inQuotes = true;
            } else if (ch === delimiter) {
                result.push(current);
                current = "";
            } else {
                current += ch;
            }
        }
    }
    result.push(current);
    return result;
}

export function parseClipboard(text: string): ParsedClipboard {
    const normalized = text.replace(/\r\n?/g, "\n").replace(/\n+$/g, "");
    if (normalized.length === 0) {
        return { rows: [], width: 0, height: 0 };
    }

    const delimiter = detectDelimiter(normalized);
    const rows = normalized
        .split("\n")
        .map(line => parseLine(line, delimiter).map(c => c.trim()));

    const width = rows.reduce((acc, row) => Math.max(acc, row.length), 0);
    return { rows, width, height: rows.length };
}
