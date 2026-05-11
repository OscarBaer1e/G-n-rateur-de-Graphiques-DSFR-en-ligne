# DSFR Graph Builder Pro

Outil interne de création de graphiques conformes au **Système de Design de l'État Français (DSFR)** et au **RGAA**, prêts à intégrer dans un CMS gouvernemental (type *Sites Faciles*, Strapi, Drupal…).

## Caractéristiques

- 100 % local (aucun CDN) : DSFR, polices Marianne / Spectral et bibliothèque graphique sont importées depuis `node_modules`.
- Utilise exclusivement `@gouvfr/dsfr-chart` (web components officiels du gouvernement basés sur Vue + ECharts).
- Tous les types de graphiques DSFR : barres verticales / horizontales / empilées, ligne, secteur (pie), anneau (donut), nuage de points (scatter), radar.
- Éditeur de données type tableur, avec **Copier/Coller direct depuis Excel** (TSV) et CSV.
- Aperçu temps réel avec `@gouvfr/dsfr-chart` (web components).
- Export d'un bloc HTML autonome (Sites Faciles / CMS) avec choix du moteur :
  - **ECharts** (CDN, option recommandée CMS) + tableau `fr-table fr-sr-only` ;
  - **Chart.js** (CDN, mode test de compatibilité) ;
  - **Web components DSFR** (`DSFRChart.umd.cjs` + `%%MEDIA_BASE%%`).

## Démarrage

```bash
npm install
npm run dev
```

Ouvrir [http://localhost:5173](http://localhost:5173) (autre port si 5173 est pris — consulter la sortie du terminal Vite).

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
│   ├── ThemeSwitcher.tsx
│   ├── ChartConfigPanel.tsx
│   ├── DataEditor.tsx       # tableur + paste Excel
│   ├── PieDonutDataEditor.tsx
│   ├── ChartPreview.tsx     # rendu temps réel
│   ├── ChartFactory.tsx
│   └── ExportPanel.tsx      # ECharts / Chart.js / web components
└── utils/
    ├── chartGenerator.ts    # projection state → attrs DSFR + export WC + tableau RGAA
    ├── echartsExport.ts     # export HTML ECharts
    ├── chartJsExport.ts     # export HTML Chart.js (test)
    ├── clipboard.ts         # parser TSV/CSV
    └── theme.ts             # thème DSFR (clair / sombre / système)
```

## Licence

Usage interne. DSFR sous licence MIT (Etalab).
