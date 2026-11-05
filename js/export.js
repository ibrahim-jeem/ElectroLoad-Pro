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
            "Current Multiplier": item.currentFactor ?? defaultCurrentFactor(item),
            "Demand Factor": item.demandFactor ?? 1,
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
    const dbScheduleRows = [];
    boards.forEach((board, index) => {
        const outgoing = circuits.filter(c => c.board === board.id);
        outgoing.forEach(c => dbScheduleRows.push({
            Board: board.name, Type: board.type, Way: c.id,
            'Load Description': c.items.map(item => item.name).join(' + '),
            Phase: c.sup === 3 ? '3-phase' : c.phase,
            'Connected Load (W)': c.watts,
            'Design Current Ib (A)': Number(c.current.toFixed(2)),
            'Protective Device In (A)': c.mcb == null ? 'NOT SIZED' : c.mcb,
            'Phase / Neutral Cable': c.wire ? c.wire.size : 'NOT SIZED',
            'PE Cable': c.wire ? c.wire.pe : 'NOT SIZED',
            'Voltage Drop (%)': Number.isFinite(c.vDropPct) ? Number(c.vDropPct.toFixed(2)) : 'NOT CALCULATED',
            'Cable Verification': c.cableV2?.valid ? c.cableV2.status : 'BLOCKED'
        }));
        const st=board.s||{};
        dbScheduleRows.push({
            Board: board.name, Type: 'FEEDER', Way: index===0?'UTILITY':'FROM '+(boards.find(x=>x.id===board.par)?.name||'INVALID'),
            'Load Description': 'Board feeder / incomer',
            Phase: bSup(board)+'-phase',
            'Connected Load (W)': Number(st.kw||0)*1000,
            'Design Current Ib (A)': Number(st.mx||0).toFixed(2),
            'Protective Device In (A)': st.cb==null?'NOT SIZED':st.cb,
            'Phase / Neutral Cable': st.feederWire?.size||'NOT SIZED',
            'PE Cable': st.feederWire?.pe||'NOT SIZED',
            'Voltage Drop (%)': Number.isFinite(st.feederVdropPct)?Number(st.feederVdropPct.toFixed(2)):'NOT CALCULATED',
            'Cable Verification': 'FEEDER SCREENING — ENGINEER REVIEW REQUIRED'
        });
    });
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(dbScheduleRows), "DB Schedule");
    const projectInfo = [
        { Field: 'Project', Value: document.getElementById('projectName')?.value || 'Untitled Project' },
        { Field: 'Client', Value: document.getElementById('projectClient')?.value || '' },
        { Field: 'Site', Value: document.getElementById('projectLocation')?.value || '' },
        { Field: 'Prepared by', Value: document.getElementById('projectDesigner')?.value || '' },
        { Field: 'Drawing No.', Value: document.getElementById('projectDrawingNo')?.value || '' },
        { Field: 'Revision', Value: document.getElementById('projectRevision')?.value || 'A' },
        { Field: 'Project type', Value: config.projectType },
        { Field: 'Supply', Value: config.phase + ' / ' + config.voltageLL + 'V LL / ' + config.voltageLN + 'V LN' },
        { Field: 'Design warning', Value: 'Preliminary estimates only. Verify all source data, standards and manufacturer instructions before construction.' }
    ];
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(projectInfo), "Project Info");
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
            designCurrent: ckt.current, breakerRating: ckt.mcb, lengthM: ckt.distance, wireUnit: config.wireUnit,
            voltage: phases === 3 ? config.voltageLL : config.voltageLN, phases,
            maxVdrop: cableMaxDrop, faultCurrentKA: fault, tripTime: cableTripTime,
            insulation: engineering.cableInsulation || 'PVC',
            installationMethod: engineering.cableMethod || 'B2',
            loadedConductors: phases === 3 ? 3 : 2,
            material: engineering.cableMaterial || 'Cu',
            ambientFactor: Number(engineering.cableAmbientFactor ?? 1),
            groupingFactor: Number(engineering.cableGroupingFactor ?? 1),
            conductorTempC: Number(engineering.cableTemp ?? 70),
            powerFactor: Number(engineering.cablePowerFactor || pf),
            reactanceOhmKm: Number(engineering.cableReactance ?? 0.08),
            faultCurrentAtPointKA: engineering.cableFaultLevel,
            breakingCapacityKA: engineering.cableBreakingCapacity,
            localPeMinimum: config.standard === 'BNBC' && config.projectType === 'Residential' ? 4 : 0,
            minimumSizeMm2: config.standard === 'BNBC' && config.projectType === 'Residential' ? (ckt.mcb >= 20 ? 6 : ckt.mcb >= 15 ? 4 : ckt.mcb >= 10 ? 2.5 : 1.5) : 0
        });
        return {
            Board: boardOf(ckt.board).name, Circuit: ckt.id, Supply: phases + '-phase',
            'Design Current Ib (A)': Number(ckt.current.toFixed(2)),
            'Breaker Rating In (A)': ckt.mcb == null ? 'NOT SIZED' : ckt.mcb,
            'Selected Phase Cable': result.valid ? result.phaseMm2 + ' mm² Cu' : 'BLOCKED',
            'Neutral Cable': result.valid ? result.neutralMm2 + ' mm² Cu (same as phase)' : 'NOT CALCULATED',
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
        { Check: "Project category", Input: config.projectType || "Residential", Result: "Occupancy context only; no unsupported category-wide demand multipliers are assumed" },
        { Check: "Current multiplier basis", Input: "Per-load", Result: "Bangladesh residential guideline: 1.65 for fluorescent lamps, fans and small inductive loads up to 1 kW; editable per load" },
        { Check: "Demand/diversity factor basis", Input: "Engineer-entered per-load factor", Result: "No universal category-wide diversity percentage is assumed; document the project study / authority basis" },
        { Check: "Drawing convention", Input: engineering.sldConvention, Result: "Illustrative symbol convention; not a certified standards library" },
        { Check: "Cable installation reference", Input: engineering.cableMethod || "B2", Result: "IEC 60364-5-52 simplified unburied copper/PVC 2-loaded-conductor profile" },
        { Check: "Ambient correction factor", Input: engineering.cableAmbientFactor ?? 1, Result: "Engineer-entered Ca applied to the IEC reference ampacity" },
        { Check: "Grouping correction factor", Input: engineering.cableGroupingFactor ?? 1, Result: "Engineer-entered Cg applied to the IEC reference ampacity" },
        { Check: "MDB prospective fault current (kA)", Input: faultKnown ? Number(engineering.sourceFaultKA) : "DATA REQUIRED", Result: "Utility / short-circuit study input" },
        { Check: "Main breaker Icu/Icn (kA)", Input: icuKnown ? Number(engineering.mainBreakerIcuKA) : "DATA REQUIRED", Result: faultKnown && icuKnown ? (Number(engineering.mainBreakerIcuKA) >= Number(engineering.sourceFaultKA) ? "Entered values pass simple MDB comparison" : "FAIL — breaker rating below entered fault level") : "Cannot compare until both values are entered" },
        { Check: "Downstream fault levels", Input: "DATA REQUIRED", Result: "Not calculated — source and feeder R/X impedances, lengths and fault assumptions required" },
        { Check: "Protection selectivity", Input: "NOT VERIFIED", Result: "Manufacturer time-current curves / selectivity tables required" },
        { Check: "Earthing / ADS", Input: "NOT VERIFIED", Result: "Earthing arrangement, loop impedance, disconnection time and protective-device data required" },
        { Check: "Voltage drop model", Input: "IEC-style R/X model", Result: "PF, reactance and conductor operating temperature included; harmonics and transient effects are not modelled" }
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
