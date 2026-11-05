# ElectroLoad Pro

Electrical design-assistance workspace for preliminary load schedules, circuit grouping, distribution-board hierarchy, cable screening, phase balancing, and conceptual single-line diagrams.

> **Engineering boundary:** ElectroLoad Pro is not a compliance certificate or a substitute for an electrical design engineer. Every result depends on the entered project data and the explicitly supported calculation scope.

## Run the application

This is a static web application. No backend or build step is required to run it locally:

1. Download or clone the repository.
2. Keep the existing folder structure.
3. Open `index.html` in a modern browser.

For a hosted version, configure GitHub Pages under **Settings → Pages → Deploy from a branch → main → /(root)** after the reviewed changes are merged.

Font Awesome, Google Fonts and SheetJS (Excel export) are loaded from external CDNs, so those features require an internet connection.

## Main workflow

1. **Project Workspace** — set the Project Design Basis (Residential, Commercial or Industrial), enter project/client/site/drawing metadata, create and save named projects in this browser, reopen them, or import/export portable `.elpro.json` files.
2. **System Parameters** — set adopted reference standard, supply phase/voltage, frequency and conductor unit.
3. **Load Schedule** — add fixtures or presets, edit quantities, watts, PF, distance, board, phase, current multiplier and demand factor.
4. **Live Phase Monitor** — review R/Y/B loading and run auto-balancing.
5. **Calculated Circuit Schedule** — review preliminary circuit current, breaker, cable, PE and voltage-drop screening.
6. **Distribution Board Schedule** — review board-wise outgoing circuits and feeder summaries; export the DB schedule and project metadata to Excel.
7. **Single-Line Diagram** — inspect the navy drafting canvas, pan/zoom, use the delegated hover details, print A3 or export SVG.

## Advanced Engineering toggle

Advanced controls are collapsed by default. Open **Advanced Engineering** to access:

- Auto circuit grouping, room consolidation and room strategy.
- Additional breaker margin.
- Distribution-board hierarchy (MDB, FDB, DB, BDB, SDB, SB and RDB).
- Detailed cable-sizing settings and per-circuit fault-current / breaker breaking-capacity inputs.
- SLD drawing convention and MDB fault-current inputs.

The advanced panel does not change the underlying project data merely by being opened or closed.

## Cable screening scope

The enabled reference profile is intentionally narrow:

- IEC 60364-5-52 Annex B Tables B.52.2 and B.52.4.
- Copper, PVC, 70°C conductor, reference ambient 30°C in air.
- 2 loaded conductors for single-phase and 3 loaded conductors for three-phase.
- Installation reference methods A1, A2, B1, B2 and C.
- Engineer-entered ambient/grouping correction factors.
- (I_b \le I_n \le I_z), PF-aware R/X voltage-drop screening, phase/neutral equality, simplified PE sizing and entered-data adiabatic / breaker-capacity checks.
- Copper voltage-drop resistance uses IEC 60228 Class 2 maximum DC resistance at 20°C, adjusted to the entered conductor temperature.

Unsupported combinations are blocked rather than guessed. XLPE, aluminium, AWG/NEC ampacity, buried D1/D2 and free-air E/F/G are not enabled in this profile.

The Bangladesh Power Division residential wiring guideline is applied only in the BNBC / Residential profile and only within its stated residential scope. Its 1.65 current multiplier is scoped to relevant fluorescent lamps, fans and small inductive loads up to 1 kW; per-load demand factors remain explicit engineer inputs. The residential 2.5% voltage-drop guideline and minimum conductor / ECC rules are not automatically generalized to commercial or industrial projects.

## Explicit limitations — engineer verification required

The application does **not** calculate or certify:

- Full BNBC / BDS IEC / IEC / NEC compliance.
- Downstream minimum/maximum short-circuit current or complete fault-level studies.
- Earth-fault loop impedance, ADS, touch voltage, electrode performance or disconnection time.
- Manufacturer time-current curves, selectivity/discrimination, backup protection or arc-flash.
- Harmonic neutral loading, motor starting/transients, parallel cables, solar/soil thermal effects or complete IEC 60287 thermal calculations.
- Manufacturer-specific cable construction, terminal temperature limits or installation correction factors unless supplied and verified by the engineer.

The breaker curve is intentionally not guessed from broad load categories. Select it using actual inrush, minimum fault current, disconnection-time requirements and the selected device manufacturer's data.

## Project data and privacy

Named projects and autosave are stored in the current browser's `localStorage`; they are not synchronized to a server. Export a project backup before clearing browser data or changing devices. Imported project files are validated for the supported project structure and board hierarchy.

## Development and QA

- `npm test` — Node regression tests for the cable engine.
- GitHub Actions — JavaScript quality checks, Node regression tests and Playwright browser E2E tests.
- Keep classic-script load order in `index.html`; the application scripts share a global scope.

## Key files

| File | Responsibility |
|---|---|
| `index.html` | Main UI, schedules, modals and SLD layout |
| `css/style.css` | Custom visual styling, responsive layout and print rules |
| `js/data.js` | Defaults, fixture library, breaker / wire tables |
| `js/engine.js` | Input validation, circuit grouping, board roll-up and phase allocation |
| `js/ui.js` | Fixture / board controls and table rendering |
| `js/calc.js` | Core calculations, KPIs, phase monitor and engineering status |
| `js/cable.js` | Cable reference tables and verification screening |
| `js/sld.js` | Interactive SVG single-line diagram and navigation |
| `js/export.js` | Excel workbook and SVG export |
| `js/project-workspace.js` | Project management, DB schedule, readiness checks and SLD title block |
| `docs/CABLE_SIZING_V2.md` | Cable sizing basis, references and limitations |

## Primary references

1. Bangladesh Power Division, *Electrical Wiring in Residential Buildings & Specification of Electrical Cable, Fittings and Accessories* — [official PDF](https://objectstorage.ap-dcc-gazipur-1.oraclecloud15.com/n/axvjbnqprylg/b/V2Ministry/o/office-powerdivision/2024/12/21a05b2a89f94341bd7a9f0f68d28604.pdf).
2. Bangladesh National Building Code 2020 — [HBRI official page](https://hbri.gov.bd/pages/static-pages/6922e02d933eb65569e25da9).
3. IEC 60364-5-52, Annex B — [IEC Webstore publication](https://webstore.iec.ch/en/publication/103734).
4. IEC 60228:2023 — [IEC Webstore publication](https://webstore.iec.ch/en/publication/71891).
5. Schneider Electric, *Electrical Installation Guide* — [cable sizing](https://www.electrical-installation.org/enwiki/Recommended_simplified_approach_for_cable_sizing) and [voltage drop](https://www.electrical-installation.org/enwiki/Calculation_of_voltage_drop_in_steady_load_conditions).

Always verify the adopted edition, actual installation conditions, manufacturer data and authority requirements before construction.
