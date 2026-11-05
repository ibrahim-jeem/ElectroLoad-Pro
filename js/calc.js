/* ElectroLoad Pro | calc.js
 * Core calculation engine: schedule, totals, KPIs, busbar bars and auto-balance.
 * Classic script: shares one global scope with the other files, so keep the load order from index.html.
 */

// Core Calculation Engine
function recalculateAll() {
    let totalConnectedWatts = 0;
    let totalDemandWatts = 0;
    let phaseKw = { R: 0, Y: 0, B: 0 };
    let phaseAmps = { R: 0, Y: 0, B: 0 };

    const calcBody = document.getElementById('calculatedScheduleBody');
    calcBody.innerHTML = '';

    const wireTable = config.wireUnit === 'Metric' ? METRIC_WIRE_TABLE : AWG_WIRE_TABLE;
    const validationError = validateProjectInputs();
    if (validationError) {
        calcBody.innerHTML = '<tr><td colspan="10" class="p-4 text-red-400">Calculation blocked: ' + escapeHTML(validationError) + '</td></tr>';
        ['totalKwVal','demandKwVal','totalKvaVal','designAmpsVal','mainMccbVal','imbalanceVal','neutralCurrentVal','phaseDeviationVal'].forEach(id => { const el=document.getElementById(id); if(el) el.innerText='—'; });
        return;
    }

    // Connected & demand totals (per fixture)
    fixtures.forEach((item) => {
        const itemWatts = item.qty * item.watts;
        totalConnectedWatts += itemWatts;

        // Do not invent category-wide diversity factors. Use an explicit per-load factor;
        // the default is 1.00 until an engineer enters a documented demand/diversity basis.
        const demandFactor = Number(item.demandFactor ?? 1);
        totalDemandWatts += itemWatts * demandFactor;
    });

    // Group fixtures into circuits (auto or manual); re-render table if CKT / phase assignments changed
    const sigBefore = fixtures.map(f => f.phase + '|' + f.ckt + '|' + f.board + '|' + f.sup).join(',');
    buildCircuits();
    if (sigBefore !== fixtures.map(f => f.phase + '|' + f.ckt + '|' + f.board + '|' + f.sup).join(',')) renderFixtureTable();

    // Phase totals come from the board roll-up (3-phase circuits split across R-Y-B)
    const rootS = boards[0].s;
    phaseKw = { ...rootS.K };
    phaseAmps = { ...rootS.A };

    circuits.forEach((ckt) => {
        const itemWatts = ckt.watts;
        const circuitCurrent = ckt.current;

        // Breaker sizing (safety factor x circuit current)
        const requiredBreakerRating = circuitCurrent * config.safetyFactor;
        const mcbRating = selectBreakerRating(requiredBreakerRating);
        ckt.mcb = mcbRating;

        // Trip Curve Suggestion
        let curve = 'Type C';
        if ([...ckt.categories].every(c => c === 'Lighting')) curve = 'Type B';
        if (ckt.categories.has('Motors') || ckt.categories.has('HVAC')) curve = 'Type D';

        // Cable selection now uses the V2 reference-table engine; the legacy generic ampacity table is not used.
        const circuitPf = ckt.items.reduce((sum,item)=>sum + Number(item.qty)*Number(item.watts),0) /
            Math.max(ckt.items.reduce((sum,item)=>sum + Number(item.qty)*Number(item.watts)/Math.max(Number(item.pf)||0.01,0.01),0),0.01);
        const cableResult = mcbRating === null ? {valid:false,message:'Protective device is not sized.'} : calculateCableChecks({
            designCurrent:circuitCurrent, breakerRating:mcbRating, lengthM:ckt.distance, wireUnit:config.wireUnit,
            voltage:ckt.sup===3?config.voltageLL:config.voltageLN, phases:ckt.sup===3?3:1,
            maxVdrop:Number(engineering.cableMaxVdrop ?? (config.projectType==='Residential'?2.5:3)),
            installationMethod:engineering.cableMethod||'B2', loadedConductors:ckt.sup===3?3:2,
            material:engineering.cableMaterial||'Cu', insulation:engineering.cableInsulation||'PVC',
            ambientFactor:Number(engineering.cableAmbientFactor ?? engineering.ambientFactor ?? 1),
            groupingFactor:Number(engineering.cableGroupingFactor ?? engineering.groupingFactor ?? 1),
            conductorTempC:Number(engineering.cableTemp ?? 70), powerFactor:Number(engineering.cablePowerFactor||circuitPf),
            reactanceOhmKm:Number(engineering.cableReactance ?? 0.08),
            faultCurrentKA:(engineering.cableFaultInputs||{})[ckt.board+'|'+ckt.id] ?? '',
            faultCurrentAtPointKA:engineering.cableFaultLevel, breakingCapacityKA:engineering.cableBreakingCapacity,
            tripTime:Number(engineering.cableTripTime ?? 0.4),
            localPeMinimum:config.standard==='BNBC'&&config.projectType==='Residential'?4:0,
            minimumSizeMm2:config.standard==='BNBC'&&config.projectType==='Residential'?(mcbRating>=20?6:mcbRating>=15?4:mcbRating>=10?2.5:1.5):0
        });
        ckt.cableV2 = cableResult;
        const recommendedWire = cableResult.valid ? {
            size:cableResult.cable.size+' mm²', pe:cableResult.peMm2+' mm²',
            ampacity:cableResult.Iz, resistance:cableResult.R
        } : null;
        ckt.wire = recommendedWire;
        if (mcbRating === null || !recommendedWire) {
            const row = document.createElement('tr');
            row.innerHTML = '<td colspan="10" class="py-3 px-3 text-amber-300">' + escapeHTML(boardOf(ckt.board).name) + ' · ' + escapeHTML(ckt.id) + ': CABLE SELECTION BLOCKED — ' + escapeHTML(cableResult.message || 'Unsupported reference-table configuration.') + '</td>';
            calcBody.appendChild(row);
            ckt.vDropPct = null;
            return;
        }

        const vDropPct = cableResult.vDropPct;
        const vDropLimit = Number(engineering.cableMaxVdrop ?? (config.projectType==='Residential'?2.5:3));
        const isVdropWarning = !cableResult.voltageDropPass;
        ckt.vDropPct = vDropPct;

        // Add to calculated UI schedule table
        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-800/40 transition";
        tr.innerHTML = `
            <td class="py-2.5 px-3 text-slate-200 font-sans font-semibold">${escapeHTML(boardOf(ckt.board).name)} &middot; ${escapeHTML(ckt.id)}${ckt.sup === 3 ? ' <span class="text-[10px] font-bold text-slate-300">3&Phi;</span>' : ''} <span class="text-[10px] font-normal text-slate-400">${escapeHTML(ckt.rooms.join(', '))}</span><span class="block text-[10px] font-normal text-slate-500 truncate max-w-[240px]">${escapeHTML(ckt.items.map(f => f.name).join(' + '))}</span></td>
            <td class="py-2.5 px-3 text-slate-300">${itemWatts.toFixed(0)} W</td>
            <td class="py-2.5 px-3 text-amber-400 font-bold">${circuitCurrent.toFixed(1)} A</td>
            <td class="py-2.5 px-3 text-sky-400 font-bold">${mcbRating}A ${ckt.sup === 3 ? '3P ' : ''}MCB</td>
            <td class="py-2.5 px-3 text-slate-400">${curve}</td>
            <td class="py-2.5 px-3 text-emerald-400 font-bold">${recommendedWire.size}</td>
            <td class="py-2.5 px-3 text-slate-400">${recommendedWire.pe}</td>
            <td class="py-2.5 px-3 text-slate-400">${'IEC 60364-5-52 PVC / Cu'}</td>
            <td class="py-2.5 px-3 ${isVdropWarning ? 'text-red-400 font-bold' : 'text-slate-300'}">${vDropPct.toFixed(2)}%</td>
            <td class="py-2.5 px-3 text-center">
                ${isVdropWarning 
                    ? '<span class="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 text-[10px] border border-red-500/30">V-DROP &gt; 3%</span>' 
                    : '<span class="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px]">PASS</span>'}
            </td>
        `;
        calcBody.appendChild(tr);
    });

    // Total Apparent Power kVA
    const kvaSum = fixtures.reduce((sum, f) => sum + (f.qty * f.watts) / f.pf, 0);
    const avgPf = kvaSum > 0 ? totalConnectedWatts / kvaSum : 0.90;   // weighted from the editable PF values
    const totalKva = (totalConnectedWatts / 1000) / avgPf;

    // Total Main Line Current
    let totalMainAmps = 0;
    if (config.phase.includes('3P')) {
        totalMainAmps = Math.max(phaseAmps.R, phaseAmps.Y, phaseAmps.B);
    } else {
        totalMainAmps = totalConnectedWatts / (config.voltageLN * avgPf);
    }

    // Main MCCB Rating
    const requiredMainMccb = totalMainAmps * config.safetyFactor;
    // Main MCCB covers both the balanced-load estimate and the highest single-phase current of the root board
    const mainMccb = selectBreakerRating(requiredMainMccb);
    boards[0].s.cb = mainMccb;

    // Phase Unbalance Calculation
    const currents = [phaseAmps.R, phaseAmps.Y, phaseAmps.B];
    const maxI = Math.max(...currents);
    const minI = Math.min(...currents);
    const avgI = (phaseAmps.R + phaseAmps.Y + phaseAmps.B) / 3 || 1;
    const pctUnbalance = (avgI > 0 && is3PSystem()) ? ((maxI - minI) / avgI) * 100 : 0;

    // Neutral Current Estimate: sqrt(Ir^2 + Iy^2 + Ib^2 - Ir*Iy - Iy*Ib - Ib*Ir)
    const Ir = phaseAmps.R, Iy = phaseAmps.Y, Ib = phaseAmps.B;
    const approxNeutralI = Math.sqrt(Math.pow(Ir, 2) + Math.pow(Iy, 2) + Math.pow(Ib, 2) - (Ir*Iy + Iy*Ib + Ib*Ir));

    // Update KPI Displays
    document.getElementById('totalKwVal').innerText = (totalConnectedWatts / 1000).toFixed(2);
    document.getElementById('demandKwVal').innerText = (totalDemandWatts / 1000).toFixed(2);
    document.getElementById('totalKvaVal').innerText = totalKva.toFixed(2);
    document.getElementById('designAmpsVal').innerText = totalMainAmps.toFixed(1);
    document.getElementById('mainMccbVal').innerText = mainMccb === null ? 'NOT SIZED' : mainMccb + 'A';
    document.getElementById('imbalanceVal').innerText = pctUnbalance.toFixed(1) + '%';

    const badge = document.getElementById('imbalanceBadge');
    if (pctUnbalance <= 5.0) {
        badge.className = "text-xs font-semibold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400";
        badge.innerText = "BALANCED";
    } else if (pctUnbalance <= 12.0) {
        badge.className = "text-xs font-semibold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400";
        badge.innerText = "MODERATE";
    } else {
        badge.className = "text-xs font-semibold px-1.5 py-0.5 rounded bg-red-500/20 text-red-400";
        badge.innerText = "HIGH UNBALANCE";
    }

    // Update Busbar Visuals
    updateBusbarVisuals(phaseKw, phaseAmps);

    // Neutral & Deviation metric
    document.getElementById('neutralCurrentVal').innerText = approxNeutralI.toFixed(2) + ' A';
    document.getElementById('phaseDeviationVal').innerText = (maxI - minI).toFixed(2) + ' A';

    renderBoardTable();
    renderEngineeringStatus(mainMccb);

    // Keep the cable verification module synchronized with calculated circuits.
    if (typeof renderCableSizing === 'function') renderCableSizing();

    // Re-render Dynamic Single-Line Diagram
    renderSLD(mainMccb, totalMainAmps);
    if (typeof saveProject === 'function') saveProject();
}

// Phase Busbar Visual Bars Update
function updateBusbarVisuals(phaseKw, phaseAmps) {
    const maxKw = Math.max(phaseKw.R, phaseKw.Y, phaseKw.B, 1.0);

    document.getElementById('phaseR_stats').innerText = `${phaseKw.R.toFixed(2)} kW | ${phaseAmps.R.toFixed(1)} A`;
    document.getElementById('phaseY_stats').innerText = `${phaseKw.Y.toFixed(2)} kW | ${phaseAmps.Y.toFixed(1)} A`;
    document.getElementById('phaseB_stats').innerText = `${phaseKw.B.toFixed(2)} kW | ${phaseAmps.B.toFixed(1)} A`;

    document.getElementById('phaseR_bar').style.width = `${(phaseKw.R / maxKw) * 100}%`;
    document.getElementById('phaseY_bar').style.width = `${(phaseKw.Y / maxKw) * 100}%`;
    document.getElementById('phaseB_bar').style.width = `${(phaseKw.B / maxKw) * 100}%`;
}

// Automatic Phase Load Balancing Algorithm
function autoBalancePhases() {
    // With Auto Circuit Grouping ON the grouping engine already balances circuits across phases
    if (grouping.auto) { recalculateAll(); return; }

    // Manual mode: balance whole circuits (heaviest first onto the least-loaded phase)
    const load = { R: 0, Y: 0, B: 0 };
    [...circuits].sort((a, b) => b.current - a.current).forEach(c => {
        let minPhase = 'R';
        if (load.Y < load[minPhase]) minPhase = 'Y';
        if (load.B < load[minPhase]) minPhase = 'B';
        if (c.sup === 3) { ['R','Y','B'].forEach(p => load[p] += c.current); c.phase = '3'; c.items.forEach(f => f.phase = '3'); return; }
        load[minPhase] += c.current;
        c.items.forEach(f => f.phase = minPhase);
    });

    renderFixtureTable();
    recalculateAll();
}

function renderEngineeringStatus(mainMccb) {
 const host=document.getElementById('sldEngineeringStatus'); if(!host) return;
 const source=Number(engineering.sourceFaultKA), icu=Number(engineering.mainBreakerIcuKA);
 const hasSource=engineering.sourceFaultKA!=='' && Number.isFinite(source) && source>0;
 const hasIcu=engineering.mainBreakerIcuKA!=='' && Number.isFinite(icu) && icu>0;
 const faultStatus=hasSource&&hasIcu ? (icu>=source ? '<span class="text-emerald-400 font-semibold">Entered MDB breaking capacity is not below entered prospective fault current</span>' : '<span class="text-red-400 font-semibold">FAIL — breaker breaking capacity is below entered MDB fault current</span>') : '<span class="text-amber-300 font-semibold">DATA REQUIRED — enter utility / study fault current and breaker Icu/Icn</span>';
 const ca=Number(engineering.cableAmbientFactor??1), cg=Number(engineering.cableGroupingFactor??1);
 const method=escapeHTML(engineering.cableMethod||'B2');
 host.innerHTML='<div class="rounded-lg border border-slate-700 bg-slate-950/70 p-3"><div class="text-slate-400 mb-1">Cable sizing V2 reference profile</div><div class="text-slate-100 font-semibold">'+method+' · Ca × Cg = '+(ca*cg).toFixed(3)+'</div><div class="text-slate-500 mt-1">IEC 60364-5-52 simplified unburied copper/PVC table; only verified 2-loaded-conductor columns enabled. Unsupported combinations are blocked.</div></div>'+
 '<div class="rounded-lg border border-slate-700 bg-slate-950/70 p-3"><div class="text-slate-400 mb-1">MDB short-circuit breaking capacity</div><div>'+faultStatus+'</div><div class="text-slate-500 mt-1">Entered-value comparison only; downstream fault current requires a short-circuit study.</div></div>'+
 '<div class="rounded-lg border border-slate-700 bg-slate-950/70 p-3"><div class="text-slate-400 mb-1">Protection coordination / earthing</div><div class="text-amber-300 font-semibold">NOT VERIFIED — ADS/loop impedance, manufacturer TCC and selectivity remain engineer checks</div><div class="text-slate-500 mt-1">Project category: '+escapeHTML(config.projectType||'Residential')+'. Residential local minimum conductor / ECC rules are applied only in the stated local profile.</div></div>';
}
