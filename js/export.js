/* ElectroLoad Pro | export.js
 * Excel export and SVG diagram download.
 * Classic script: shares one global scope with the other files, so keep the load order from index.html.
 */

// Export Schedule Data to Excel Spreadsheet
function exportToExcel() {
    const data = fixtures.map(item => {
        const itemWatts = item.qty * item.watts;
        const current = itemCurrent(item);
        const ckt = circuits.find(c => c.id === item.ckt && c.board === item.board);
        const circuitCurrent = ckt ? ckt.current : current;
        const mcb = ckt ? ckt.mcb : null;

        return {
            "Fixture Name": item.name,
            "Board": boardOf(item.board).name,
            "Room": item.room,
            "Circuit": item.ckt,
            "Supply": eSup(item) + "-Phase",
            "Category": item.category,
            "Quantity": item.qty,
            "Unit Watts": item.watts,
            "Total Power (W)": itemWatts,
            "Power Factor": item.pf,
            "Phase": item.phase,
            "Fixture Current (A)": current.toFixed(2),
            "Circuit Design Current (A)": circuitCurrent.toFixed(2),
            "Breaker Sizing": mcb == null ? 'NOT SIZED - REVIEW REQUIRED' : mcb + 'A MCB',
            "Cable Size": ckt && ckt.wire ? ckt.wire.size : 'NOT SIZED - REVIEW REQUIRED',
            "Cable Length (m)": item.distance
        };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Load Schedule");

    const boardRows = boards.map((b, i) => {
        const st = b.s || { kw: 0, mx: 0, cb: 0 };
        return {
            "Board": b.name, "Area": b.room || '', "Type": b.type, "Fed From": i === 0 ? "Grid" : boardOf(b.par).name,
            "Supply": bSup(b) + "-Phase", "Feed Distance (m)": i === 0 ? "" : b.dist,
            "Load (kW)": +st.kw.toFixed(2), "Max Current (A)": +st.mx.toFixed(1), "Feeder Breaker": st.cb == null ? 'NOT SIZED' : st.cb + "A", "Feeder Cable": st.feederWire ? st.feederWire.size : "NOT SIZED", "Feeder V-Drop Estimate (%)": Number.isFinite(st.feederVdropPct) ? +st.feederVdropPct.toFixed(2) : "NOT CALCULATED", "Installation Reference": engineering.installationMethod, "PE Conductor": st.feederWire ? st.feederWire.pe : "NOT SIZED"
        };
    });
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(boardRows), "Boards");
    const cableFaults = engineering.cableFaultInputs || {};
    const cableMaxDrop = Number(engineering.cableMaxVdrop ?? 2.5);
    const cableTripTime = Number(engineering.cableTripTime ?? 0.4);
    const cableRows = circuits.map(ckt => {
        const key = ckt.board + '|' + ckt.id;
        const fault = Object.prototype.hasOwnProperty.call(cableFaults, key) ? cableFaults[key] : '';
        const phases = Number(ckt.sup) === 3 ? 3 : 1;
        const pf = ckt.items.reduce((sum,item)=>sum+(Number(item.qty)*Number(item.watts)/Math.max(Number(item.pf)||0.01,0.01)),0) > 0
            ? ckt.watts / ckt.items.reduce((sum,item)=>sum+(Number(item.qty)*Number(item.watts)/Math.max(Number(item.pf)||0.01,0.01)),0) : 0.9;
        const result = calculateCableChecks({
            designCurrent: ckt.current, breakerRating: ckt.mcb, lengthM: ckt.distance,
            voltage: phases === 3 ? config.voltageLL : config.voltageLN, phases,
            maxVdrop: cableMaxDrop, faultCurrentKA: fault, tripTime: cableTripTime,
            insulation: engineering.cableInsulation || 'PVC',
            installationMethod: engineering.cableMethod || 'B2',
            loadedConductors: Number(engineering.cableConductors || 2),
            material: engineering.cableMaterial || 'Cu',
            ambientFactor: Number(engineering.cableAmbientFactor ?? 1),
            groupingFactor: Number(engineering.cableGroupingFactor ?? 1),
            conductorTempC: Number(engineering.cableTemp ?? 70),
            powerFactor: Number(engineering.cablePowerFactor || pf),
            reactanceOhmKm: Number(engineering.cableReactance ?? 0.08),
            faultCurrentAtPointKA: engineering.cableFaultLevel,
            breakingCapacityKA: engineering.cableBreakingCapacity,
            localPeMinimum: config.standard === 'BNBC' ? 4 : 0
        });
        return {
            Board: boardOf(ckt.board).name, Circuit: ckt.id, Supply: phases + '-phase',
            'Design Current Ib (A)': Number(ckt.current.toFixed(2)),
            'Breaker Rating In (A)': ckt.mcb == null ? 'NOT SIZED' : ckt.mcb,
            'Selected Cable': result.valid ? result.cable.size + ' mm² Cu' : 'BLOCKED',
            'Reference Ampacity (A)': result.valid ? result.cable.ampacity : result.message,
            'Corrected Ampacity Iz (A)': result.valid ? Number(result.Iz.toFixed(2)) : 'NOT CALCULATED',
            'Voltage Drop (%)': result.valid ? Number(result.vDropPct.toFixed(2)) : 'NOT CALCULATED',
            'Voltage Drop Limit (%)': cableMaxDrop,
            'PE Conductor (mm²)': result.valid ? result.peMm2 : 'NOT CALCULATED',
            'Fault Current at Circuit (kA)': fault || 'DATA REQUIRED',
            'Thermal Check': result.valid ? result.thermal.status : 'NOT CALCULATED',
            'Breaker Breaking Capacity Check': result.valid ? result.breakingCheck.status : 'DATA REQUIRED',
            'Ib ≤ In ≤ Iz': result.valid ? (result.coordination ? 'PASS' : 'FAIL') : 'BLOCKED',
            'Overall': result.valid ? result.status : 'BLOCKED — ' + result.message,
            'Installation Method': engineering.cableMethod || 'B2',
            'Source': result.valid ? result.source : 'No applicable ampacity reference column',
            'Scope': 'Engineering screening only; not a compliance certificate'
        };
    });
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(cableRows), "Cable Verification");

    const faultKnown = engineering.sourceFaultKA !== '' && Number(engineering.sourceFaultKA) > 0;
    const icuKnown = engineering.mainBreakerIcuKA !== '' && Number(engineering.mainBreakerIcuKA) > 0;
    const engineeringRows = [
        { Check: "Drawing convention", Input: engineering.sldConvention, Result: "Illustrative symbol convention; not a certified standards library" },
        { Check: "Installation reference", Input: engineering.installationMethod, Result: "Reference method selected; cable-specific table verification required" },
        { Check: "Ambient correction factor", Input: engineering.ambientFactor, Result: "User-entered factor applied to generic ampacity table" },
        { Check: "Grouping correction factor", Input: engineering.groupingFactor, Result: "User-entered factor applied to generic ampacity table" },
        { Check: "MDB prospective fault current (kA)", Input: faultKnown ? Number(engineering.sourceFaultKA) : "DATA REQUIRED", Result: "Utility / short-circuit study input" },
        { Check: "Main breaker Icu/Icn (kA)", Input: icuKnown ? Number(engineering.mainBreakerIcuKA) : "DATA REQUIRED", Result: faultKnown && icuKnown ? (Number(engineering.mainBreakerIcuKA) >= Number(engineering.sourceFaultKA) ? "Entered values pass simple MDB comparison" : "FAIL — breaker rating below entered fault level") : "Cannot compare until both values are entered" },
        { Check: "Downstream fault levels", Input: "DATA REQUIRED", Result: "Not calculated — source and feeder R/X impedances, lengths and fault assumptions required" },
        { Check: "Protection selectivity", Input: "NOT VERIFIED", Result: "Manufacturer time-current curves / selectivity tables required" },
        { Check: "Earthing / ADS", Input: "NOT VERIFIED", Result: "Earthing arrangement, loop impedance, disconnection time and protective-device data required" },
        { Check: "Voltage drop model", Input: "Preliminary", Result: "Resistance-only estimate; reactance, conductor operating temperature and harmonics not fully modelled" }
    ];
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(engineeringRows), "Engineering Checks");
    XLSX.writeFile(workbook, "Electrical_Load_Schedule.xlsx");
}

// SVG SLD File Download
function downloadSldSvg() {
    const svgData = document.getElementById("sldSvg").outerHTML;
    const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Single_Line_Diagram_SLD.svg";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}
