# Supercharge — The Perplexity Computer 3D Vintage Card Shop & Skill Emporium

**Supercharge Emporium** is an interactive 3D Vintage Trading Card Store & Collector's Emporium for exploring, ripping open booster packs, inspecting under custom GLSL holographic shaders, and launching **72 verified Perplexity Computer Skills, Plugin Bundles, and Connectors** across 6 collectible series.

## Highlights

1. **Three.js WebGL2 3D Foil Booster Pack Ripping Table (`three-stage.js`)**
   - Select any of the **6 Collectible 1st Edition Booster Packs** from the engraved brass-and-mahogany counter dispenser.
   - Drag across the glowing top crimp seam (or click **`✦ Rip Open Pack (5 Cards)`**) to physically slice and peel back the top foil strip with 3D mesh curl, 140 holographic foil confetti particles, and synthesized Web Audio foil crinkle, tear, and rarity chime effects.
   - **5-Card 3D Fan & Custom GLSL Rainbow Diffraction / Cosmos Holographic Shaders**: Pulled cards fan out in 3D space with real-time rainbow diffraction bands and cosmos starfield parallax that respond to pointer tilt.

2. **Four Emporium Rooms (`index.html`, `app.js`, `card-renderer.js`)**
   - **01 · Pack Counter (`3D RIP`)**: Interactive 3D booster pack stage, live seam progress indicator, 5-card pulled tray, and counter magnifier.
   - **02 · Illuminated Glass Display Cases (`6 CASES`)**: Mahogany and brass museum cabinets showcasing flagship cards across all 6 series and 4 foil rarity tiers (`★ Mythic Holo Plugin Bundles`, `◆ 1st Edition Gold Connectors`, `✦ Prismatic Foil Skills`, `● Vintage Collector Rares`).
   - **03 · Complete 72-Card Collector Binder (`72 CARDS`)**: Instant search and multi-facet filtering across all 72 verified skills, plugins, and connectors, with one-click JSON and CSV catalog export.
   - **04 · Build My Computer Stack (`6 / 6 Loadout Builder`)**: Assemble up to 6 cards (or load curated presets like *Wall Street Deal Team*, *Auteur Design & Video Studio*, *Principal Red-Team Architect*, and *Enterprise Legal & GTM Desk*) to compute stack synergy metrics (`ALPHA`, `DEPTH`, `VELOCITY`) and synthesize a chained Perplexity Computer master prompt.

3. **Direct Routing Back to Perplexity Computer**
   - Every card in the 3D Holographic Card Inspector Modal and Collector Binder routes directly to its live Perplexity Computer destination (`https://www.perplexity.ai/computer/skills/<slug>?skillId=<id>`, `https://www.perplexity.ai/computer/skills?pluginId=<id>`, or `https://www.perplexity.ai/computer/connectors`), with one-click **`Copy Trigger Command`** (`load_skill(name="...")`) and **`Try This Skill in Computer ↗`**.

## 6 Collectible Booster Series (72 Verified Cards)

| Pack # | Booster Pack Name | Focus Area | Card Count |
| :--- | :--- | :--- | :---: |
| **PACK 01** | **Wall Street & Alpha Pack** | Public-market filings, institutional equity comps, alternative transaction panels (`FactSet`, `Daloopa`, `Carbon Arc`, `Morningstar`, `Plaid`, `Carta`, `Robinhood`, `QuickBooks`, `Crunchbase`) | 14 |
| **PACK 02** | **Auteur & 3D Studio Pack** | Code-directed short films (`lemo-opuscar`), narrated 1080p30 science documentaries (`science-explainer-video`), 3D LEGO compilers (`brickify`), `hairline`, `hyperframes`, `teardown`, `scan-to-bim` | 11 |
| **PACK 03** | **Design Craft & Web Atelier Pack** | Full-stack web apps (`website-building`), ecommerce & scrollytelling (`build-landing-pages`), art direction (`taste-skill`), frontend QA (`impeccable`), `pplx-design`, `pplx-brand`, `pplx-document` | 11 |
| **PACK 04** | **Systems, Silicon & Red-Team Pack** | Codebase security audits (`security-audit`), CVE checks (`php2shell-exposure-check`), architecture knowledge graphs (`graphify`), autonomous PR shipping (`advance-pr`), `GitHub`, `Linear`, `Datadog`, `Supabase`, `Snowflake` | 12 |
| **PACK 05** | **Deal Desk, Legal & Enterprise GTM Pack** | Playbook contract redlining (`contract-review`), litigation defense (`litigation-prep`), regulatory watches (`compliance-monitor`), supplier concentration scans (`supplier-risk-concentration-scan`), `demo-org-setup`, `Dun & Bradstreet`, `Ramp` | 11 |
| **PACK 06** | **Core Superpowers & Daily Driver Pack** | Multi-source deep research (`search`), live browser/desktop control (`browser-use`, `desktop-use`, `personal-computer`), recurring `automations`, `office`, `file-citations`, `unbroker`, `streaming-ad-skipper`, `automatiq-tickets`, `opticodds`, `polymarket`, `sportradar` | 13 |

## Verification & Reproducibility

Run the catalog builder and verification suite:

```bash
python3 scripts/build_and_verify_catalog.py
```

Outputs:
- `data/perplexity_supercharge_card_catalog.json`
- `data/perplexity_supercharge_card_catalog.csv`
- `data/verification_report.json` (`status: "PASS"`, 72/72 cards verified, zero missing art plates or broken deep links)

---

Created with [Perplexity](https://www.perplexity.ai/computer/tasks/83cb1a85-35b9-4343-a0d1-4066fb273ff0)
