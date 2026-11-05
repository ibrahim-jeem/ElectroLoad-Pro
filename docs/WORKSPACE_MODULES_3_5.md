# ElectroLoad Pro — Workspace Modules 3–5

## Module 3 — Professional Single-Line Diagram

- SLD remains on the navy drafting canvas.
- The drawing title block uses project name, client, drawing number, revision, preparer and generation date.
- The SLD remains generated from the current board hierarchy and calculated feeders.
- Existing SVG export / print workflows remain available.
- The title block is presentation metadata, not a design approval or revision-control signature.

## Module 4 — Distribution Board Schedule

- The main workspace shows a live board-wise schedule.
- Each outgoing circuit row displays board, board type, circuit ID, load description, phase, connected watts, design current, protective-device rating, selected phase/neutral cable, voltage drop and cable-engine review status.
- Each board has a feeder summary row.
- Excel export adds dedicated `DB Schedule` and `Project Info` worksheets.
- A schedule row marked incomplete or review is not a compliance pass.

## Module 5 — Project Management

- Project metadata: project name, client, site, prepared by, drawing number and revision.
- Save named projects in the current browser; switch between saved projects from the project picker.
- Export/import a portable `.elpro.json` backup.
- Project files include calculation settings, engineering settings, grouping, fixtures and board hierarchy. Derived schedules are recalculated when a project is loaded.
- Local project library is browser-local storage, not cloud sync. Export backups before clearing browser data or changing browsers.

## Simplified workspace

- Project Design Basis uses a single-column layout.
- R/Y/B phase indicators appear side-by-side on desktop and stack on small screens.
- Board hierarchy, detailed cable verification and SLD engineering inputs are moved under the Advanced Engineering toggle.
- The main workflow retains the load schedule, calculated results, SLD and DB schedule.

## Safety and verification boundary

The application provides preliminary calculations and a review workflow. It does not perform a complete short-circuit study, earth-fault loop / ADS verification, harmonics or neutral thermal study, breaker curve/selectivity coordination, arc-flash analysis, or full project compliance assessment. Enter prospective fault current and breaker Icu/Icn per circuit from a documented study and the selected manufacturer's data. Check the fault current and breaking capacity at the same circuit point.

The cable voltage-drop calculation uses IEC 60228 Class 2 maximum copper resistance at 20°C, adjusted for conductor temperature. Actual cable construction and manufacturer data take precedence. PVC conductor temperature input is limited to 70°C. The enabled ampacity tables remain limited to the explicitly documented IEC 60364-5-52 Cu/PVC reference methods.

**Release is not a compliance certificate.** A qualified electrical engineer must verify source data, adopted standards, local authority requirements, installation conditions, protection, earthing and equipment data before construction.
