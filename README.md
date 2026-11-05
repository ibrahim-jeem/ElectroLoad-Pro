# ElectroLoad Pro

Electrical load calculator and single line diagram generator: fixtures, rooms, circuit grouping, distribution boards (MDB / SDB / SB / FDB / RDB), 1-phase / 3-phase loads, breaker and wire sizing, phase balancing, SLD and Excel export.

Static site: no server and no build step needed to run it. Open `index.html`, or host it on GitHub Pages.

## Host on GitHub Pages
1. Create a repository and upload everything in this folder (keep the folder structure).
2. **Settings > Pages > Build and deployment**: Source = *Deploy from a branch*, Branch = `main`, folder = `/ (root)`.
3. The site is live at `https://<username>.github.io/<repository>/` after a minute.

An internet connection is needed for three external items: Font Awesome icons, Google Fonts and the SheetJS library (Excel export).

## Files
| File | What it does |
|---|---|
| `index.html` | Page layout and modals |
| `css/tailwind.css` | Compiled Tailwind utilities (generated, do not edit by hand) |
| `css/style.css` | Your own styles: fonts, scrollbars, print rules |
| `js/data.js` | Default project, fixture library, wire and breaker tables, grouping limits |
| `js/engine.js` | Circuit grouping (auto / manual) and board roll-up with phase balancing |
| `js/ui.js` | Tables, toggles, edit handlers for fixtures, boards and the library |
| `js/calc.js` | Schedule, totals, KPIs, busbar bars, auto-balance |
| `js/sld.js` | Single line diagram (SVG) |
| `js/export.js` | Excel export and SVG download |
| `js/app.js` | Startup, modals, reset |

The JS files are classic scripts sharing one scope. Keep the order of the `<script>` tags in `index.html`.

## Changing things by hand
- **Standards and defaults**: edit `js/data.js` (`METRIC_WIRE_TABLE`, `AWG_WIRE_TABLE`, `STANDARD_BREAKER_RATINGS`, `LOW_POWER_W`, `COMBINED_MAX_MCB`, sample fixtures and boards).
- **Calculation rules**: `js/calc.js` (schedule, voltage drop, demand factors) and `js/engine.js` (grouping and balancing).
- **Diagram**: `js/sld.js`. **Excel columns**: `js/export.js`.
- **Look and feel**: use Tailwind classes in `index.html` / the JS templates. If you use a class that is not already in the project, rebuild the CSS once:
  ```
  npm install
  npm run build:css
  ```
  This regenerates `css/tailwind.css` by scanning `index.html` and `js/*.js`. Commit the new file.
- The fixture library you edit in the app is stored in your browser (localStorage), not in the repository.

## Important
Ampacity values, demand factors, power factors and fixture wattages are placeholders. Verify them against BNBC, NFPA/NEC and IEC before using results in a real design.


## SLD engineering controls (screening only)

The SLD supports a navy drafting canvas, cursor-centred wheel zoom, drag-to-pan, a single delegated hover tooltip, phase-aware R/Y/B feeder taps, separate neutral (N) and protective-earth (PE) conductors, IEC-inspired / ANSI-NEMA-inspired illustrative breaker notation, SVG export, and A3 landscape print styling.

The engineering input panel records:
- Drawing convention and IEC installation reference method (A1/A2/B1/B2/C/E/F/D1/D2).
- User-entered ambient and grouping correction factors. These multiply the generic ampacity lookup values; they do **not** replace the cable-specific ampacity tables required for the selected conductor, insulation, installation method, ambient temperature, grouping and harmonics.
- Prospective fault current at the MDB and the main breaker Icu/Icn from verified utility / study and manufacturer data. The app performs only a direct entered-value comparison at the MDB.

### Explicit engineering limitations

- Cable voltage drop is a resistance-only estimate using the embedded lookup table. It does not fully model conductor operating temperature, AC reactance, harmonics, parallel conductors or detailed cable construction.
- Downstream short-circuit levels are **not calculated**. A valid calculation needs verified source impedance, transformer data, feeder length and R/X data, network configuration and fault assumptions.
- Protection selectivity / discrimination is **not verified**. It requires actual device model numbers, trip-unit settings, time-current curves and manufacturer-tested coordination tables.
- Earthing / automatic disconnection compliance is **not verified**. The SLD depicts separate N and PE paths but does not calculate earth-fault loop impedance, touch voltage, disconnection time, electrode performance or protective-conductor thermal withstand.
- IEC-inspired and ANSI/NEMA-inspired drawing modes are illustrative conventions, not a licensed or certified reproduction of IEC 60617 / IEEE / ANSI symbol databases.
- A3 output is a print layout; it is not a certified construction drawing or a substitute for an engineer-reviewed title block, revision process and project-specific legend.

Never use the displayed estimates as construction instructions without review by a qualified electrical design engineer and verification against the adopted edition of BNBC / IEC / NEC and the actual equipment manufacturers.
