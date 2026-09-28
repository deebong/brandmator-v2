# Brandmator

Brandmator is a browser-based startup naming tool built as a Vite + React + TypeScript single-page application.

## Live site

https://deebong.github.io/brandmator-v2/

## Developer documentation

The project includes a detailed developer reference at:

https://deebong.github.io/brandmator-v2/tech.html

The documentation covers the feature set, naming models, scoring architecture, data layer, brand-brief flow, analytics extension point, domain-availability roadmap and how to add future models.

## Current architecture

- `src/data/` - word library, source pools, categories and TLD metadata
- `src/models/` - naming model contract, registry, independent model generators and model-specific scorers
- `src/lib/` - shared generation orchestration, brief relevance, style preferences, quality primitives and result sorting
- `src/components/` - result cards, custom dropdowns and accessible pointer-driven sliders
- `src/analytics/` - pluggable event interface; storage is intentionally not connected yet
- `public/tech.html` - developer documentation

## Naming models

1. Model 0 - Blend All
2. Model 1 - Inventive Fusion
3. Model 2 - Brand Spelling
4. Model 3 - Prefix & Initial
5. Model 4 - Semantic Wordform
6. Model 5 - Experimental

Dictionary generation is provided separately for pure one-word and pure two-word candidates. Two-word dictionary candidates are displayed in CamelCase while the domain string remains lowercase.

## User controls

- Naming model
- Generation mode
- Naming style
- Brand brief
- Vibes / categories
- Word intelligence sources
- Seed words
- Prefix / suffix
- Name-length range
- Result count
- TLD selection and custom TLDs
- Generated-name filter
- Result sorting
- Shortlist
- CSV and TXT export
- Light/dark theme

## Deployment

GitHub Actions installs dependencies, runs the Vite production build and deploys the `dist` artifact to GitHub Pages. Local Node installation is therefore not required for the intended deployment workflow.

## Future roadmap

- Fully model-owned quality gates
- Advanced pronunciation analysis
- Name-family grouping
- Rich AI-assisted brand-brief interpretation
- Domain availability cache/service
- TLD-by-TLD availability comparison
- Trademark/conflict signals
- Scheduled domain-sales data ingestion
- Optional aggregate user-behavior analytics through Google Apps Script + Google Sheets
- Additional naming models
