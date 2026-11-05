# Cable Sizing Engine V2 — Engineering Basis

## What the engine calculates

For each circuit and board feeder, V2 follows this order:

1. Determine design current from the circuit's entered watts, power factor, supply voltage and phase configuration. Residential loads covered by the Bangladesh Power Division guideline (fans, fluorescent lamps and small inductive loads up to 1 kW) receive the guideline's 1.65 current multiplier by default. The factor is visible and editable per fixture.
2. Select the protective-device rating from the existing project breaker-selection logic. The default extra design margin is now 1.00; a 1.25 multiplier is not silently assumed as a universal IEC / BNBC rule. Select a margin only where the applicable code or equipment instruction requires it.
3. Select the smallest supported conductor whose corrected reference ampacity satisfies the coordination relationship:
   - (I_b \le I_n \le I_z)
   - (I_z = I_t \times C_a \times C_g)
4. Check steady-state voltage drop:
   - Single phase: \(\Delta U = 2 I L (R\cos\phi + X\sin\phi)\)
   - Balanced three phase: \(\Delta U = \sqrt{3} I L (R\cos\phi + X\sin\phi)\)
   - \(L\) is one-way cable length in km; \(R\) and \(X\) are in Ω/km. The reactance default is 0.08 Ω/km as a screening assumption; replace it with cable-manufacturer data for the actual construction.
   - Copper resistance uses IEC 60228 Class 2 maximum DC resistance at 20°C (not ideal copper resistivity), then adjusts using \(R_\theta=R_{20}[1+0.00393(\theta-20)]\). Replace the reference values with actual cable manufacturer data when available.
5. Select a simplified PE size using the IEC 60364-5-54 cross-section relationship, with the Bangladesh residential guideline's 4 mm² ECC minimum applied in the BNBC/Residential profile. This remains a simplified table method and must be confirmed against the earthing system and fault-disconnection design.
6. Where a fault current and disconnection time are entered per circuit, screen short-circuit thermal withstand with \(S \ge I\sqrt{t}/k\). The enabled Cu/PVC screening coefficient is \(k=115\).
7. Compare the entered breaker breaking capacity with the entered prospective fault current at the same check point. This is only a simple entered-value comparison, not a downstream short-circuit study.

## Project type and diversity

Residential, Commercial and Industrial are project-context selections, not automatic multipliers. The Power Division guideline says diversity should be considered at circuit / floor / building / complex levels but does not prescribe one universal factor for every load category. V2 therefore removes the former undocumented automatic 0.90 / 0.70 / 0.85 factors. Each fixture now has an explicit, editable demand factor, defaulting to 1.00. The old category-wide 0.90 / 0.70 / 0.85 values have been removed. Demand factors are applied to board-feeder and main-incomer demand current / demand kW; branch-circuit cable and protective-device sizing still use the connected circuit load. The engineer must document the basis of any diversity factor entered.

For Residential projects, the Bangladesh guideline's 1.65 current factor is applied by default to fixture names containing fan or fluorescent and to motor-category loads up to 1 kW. It remains editable per load. Do not apply it blindly to all loads.

## Ampacity data and limitations

The enabled ampacity dataset uses IEC 60364-5-52 Annex B Table B.52.2 (PVC, two loaded conductors) and Table B.52.4 (PVC, three loaded conductors), for copper conductors at 70°C and reference ambient 30°C in air. It supports reference methods A1, A2, B1, B2 and C. The reference methods and values are taken from the IEC table structure, not a single universal ampacity list. Accordingly:

- 2 and 3 loaded conductors, copper, PVC: enabled for methods A1, A2, B1, B2 and C.
- XLPE and aluminium: blocked pending verified compatible tables and corresponding temperature coefficients.
- AWG/NEC mode: blocked in this IEC metric engine; a separate NEC ampacity profile is required.
- Buried D1/D2 and free-air E/F/G methods: blocked pending the separate tables and corresponding soil / installation / grouping correction factors.
- Ambient and grouping correction factors remain explicit engineer inputs. V2 does not pretend to infer them from incomplete site information.
- Thermal insulation, solar heating, harmonics, parallel conductors and IEC 60287 detailed thermal calculations are not implemented.

A blocked result is intentional: it is safer than presenting an unsupported conductor size as an engineering recommendation.

## Bangladesh residential rules represented

The Bangladesh Power Division's approved *Electrical Wiring in Residential Buildings & Specification of Electrical Cable, Fittings and Accessories* guideline states, within its residential scope:

- 230 V single-phase and 400 V three-phase nominal supply, 50 Hz.
- Current multiplier 1.65 for fluorescent lamps, fans and small inductive loads up to 1 kW; higher motor loads need a higher factor determined from equipment data.
- Minimum copper conductor sizes by protective-device rating: 5 A → 1.5 mm²; 10 A → 2.5 mm²; 15 A → 4 mm²; 20 A → 6 mm².
- Voltage drop not exceeding 2.5% from a distribution point to the farthest load point.
- Phase and neutral conductors of the same size.
- Minimum 4 mm² copper ECC.

For non-tabulated breaker ratings, the app applies a conservative threshold mapping to the next lower listed rating (e.g. 16 A uses the 15 A / 4 mm² floor). This is an explicit application policy and must be checked against the actual design authority / adopted requirements.

## Distribution board hierarchy

The board type list now includes MDB, FDB, DB, SDB, BDB, SB and RDB. The Power Division guideline identifies FDB, DB, SDB, BDB and MDB in its distribution-board sections and symbols. Board hierarchy validation still checks parent links, phase compatibility and cycles.

## Not a compliance certificate

V2 is a transparent design-assistance and screening engine. It does not certify BNBC, BDS IEC, IEC, BS 7671 or NEC compliance. Before construction, an electrical engineer must verify the actual equipment nameplates, cable manufacturer's datasheets, installation conditions, protective-device curves, maximum/minimum fault levels, ADS / earth-fault loop impedance, disconnection times, selectivity, thermal withstand and all authority-specific requirements.

## Primary references

1. Bangladesh Power Division, *Electrical Wiring in Residential Buildings & Specification of Electrical Cable, Fittings and Accessories*, approved by circular dated 15 December 2021. [Official PDF](https://objectstorage.ap-dcc-gazipur-1.oraclecloud15.com/n/axvjbnqprylg/b/V2Ministry/o/office-powerdivision/2024/12/21a05b2a89f94341bd7a9f0f68d28604.pdf) Relevant sections include 3.2.2.1–3.2.3, 3.5.2–3.5.4, 3.5.7, and the cable capacity appendix.
2. Bangladesh National Building Code 2020, published in the Bangladesh Gazette, S.R.O. No. 55-Law/2020. [HBRI official BNBC page](https://hbri.gov.bd/pages/static-pages/6922e02d933eb65569e25da9)
3. IEC 60364-5-52 Annex B Tables B.52.2 and B.52.4 (PVC copper, two / three loaded conductors), reference methods A1/A2/B1/B2/C. [IEC official Webstore — consolidated edition 3.1 (2009 + AMD1:2024)](https://webstore.iec.ch/en/publication/103734).
4. Schneider Electric, *Electrical Installation Guide*, [“Recommended simplified approach for cable sizing”](https://www.electrical-installation.org/enwiki/Recommended_simplified_approach_for_cable_sizing) and [“Calculation of voltage drop in steady load conditions”](https://www.electrical-installation.org/enwiki/Calculation_of_voltage_drop_in_steady_load_conditions).
5. IEC 60364-4-43, protection against overcurrent and short-circuit thermal withstand; IEC 60364-5-54, protective conductor sizing.
6. IEC 60228:2023, Tables 3 and 4, maximum conductor DC resistance at 20°C for copper Class 1 / Class 2 conductors. [IEC 60228 overview and table extract](https://webstore.iec.ch/en/publication/71891).
7. IEC 60287-1-1:2023, detailed steady-state cable current-rating calculations. V2 does not implement the full IEC 60287 thermal model.
