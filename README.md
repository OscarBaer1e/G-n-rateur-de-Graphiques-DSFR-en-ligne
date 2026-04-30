# DSFR Graph Builder Pro

Outil interne de création de graphiques conformes au **Système de Design de l'État Français (DSFR)** et au **RGAA**, prêts à intégrer dans un CMS gouvernemental (type *Sites Faciles*, Strapi, Drupal…).

## Caractéristiques

- 100 % local (aucun CDN) : DSFR, polices Marianne / Spectral et bibliothèque graphique sont importées depuis `node_modules`.
- Utilise exclusivement `@gouvfr/dsfr-chart` (web components officiels du gouvernement basés sur Vue + ECharts).
- Tous les types de graphiques DSFR : barres verticales / horizontales / empilées, ligne, secteur (pie), anneau (donut), nuage de points (scatter), radar.
- Éditeur de données type tableur, avec **Copier/Coller direct depuis Excel** (TSV) et CSV.
- Aperçu temps réel.
- Export d'un bloc HTML autonome avec :
  - Web component `<bar-chart>`, `<line-chart>`, etc.
  - Tableau alternatif `fr-sr-only` pour le RGAA.
  - Script de bootstrap optionnel.

## Démarrage

```bash
npm install
npm run dev
```

Ouvrir [http://localhost:5173](http://localhost:5173).

## Stack

- React 18 + TypeScript strict
- Vite 5
- `@gouvfr/dsfr` (CSS + JS officiel)
- `@gouvfr/dsfr-chart` (web components officiels)
- `lucide-react` (icônes)

## Structure

```
src/
├── main.tsx                 # entrée + imports CSS DSFR
├── App.tsx                  # state global + layout
├── App.css                  # styles applicatifs
├── types.ts                 # types métier (ChartType, ChartState, etc.)
├── jsx-dsfr-chart.d.ts      # déclarations JSX des web components DSFR
├── vite-env.d.ts
├── components/
│   ├── Header.tsx
│   ├── ChartConfigPanel.tsx
│   ├── DataEditor.tsx       # tableur + paste Excel
│   ├── ChartPreview.tsx     # rendu temps réel
│   └── ExportPanel.tsx      # génération du code intégrable
└── utils/
    ├── chartGenerator.ts    # serialisation x/y + génération HTML export
    └── clipboard.ts         # parser TSV/CSV
```

## Licence

Usage interne. DSFR sous licence MIT (Etalab).
