/* ElectroLoad Pro | cable.js
 * Circuit-linked cable sizing screening engine.
 * Tables are generic project screening data, not a verified IEC/NEC/BNBC ampacity library.
 */
function calculateCableChecks(input) {
    const fail = message => ({ valid: false, message });
    const Ib = Number(input.designCurrent), In = Number(input.breakerRating);
    const Ca = Number(input.ambientFactor), Cg = Number(input.groupingFactor);
    const L = Number(input.lengthM), V = Number(input.voltage), limit = Number(input.maxVdrop);
    if (![Ib, In, Ca, Cg, L, V, limit].every(Number.isFinite) || Ib < 0 || In <= 0 || Ca <= 0 || Cg <= 0 || L < 0 || V <= 0 || limit <= 0) return fail('Invalid or incomplete circuit inputs.');
    const correction = Ca * Cg;
    if (correction <= 0 || correction > 2.25) return fail('Combined correction factor is outside the supported range.');
    const table = Array.isArray(input.wireTable) ? input.wireTable : [];
    const cable = table.find(row => Number(row.ampacity) * correction >= In) || null;
    if (!cable) return { valid: true, cable: null, Ib, In, correction, coordination: false, message: 'No cable in the available reference table can carry the selected protective-device rating.' };
    const Iz = Number(cable.ampacity) * correction;
    const coordination = Ib <= In && In <= Iz;
    const multiplier = input.phases === 3 ? Math.sqrt(3) : 2;
    const vDropV = multiplier * (L / 1000) * Ib * Number(cable.resistance) / (input.phases === 3 ? Number(input.voltageLL || V) : V);
    const vDropPct = vDropV * 100;
    const voltageDropPass = vDropPct <= limit;
    const faultKA = input.faultCurrentKA === '' || input.faultCurrentKA == null ? null : Number(input.faultCurrentKA);
    const tripTime = Number(input.tripTime);
    let thermal = { status: 'NOT ENTERED', requiredMm2: null, phasePass: null, pePass: null };
    if (faultKA !== null && Number.isFinite(faultKA) && faultKA > 0 && Number.isFinite(tripTime) && tripTime > 0) {
        const k = input.insulation === 'XLPE' ? 143 : 115;
        const requiredMm2 = (faultKA * 1000 * Math.sqrt(tripTime)) / k;
        const phaseMm2 = Number(String(cable.size).replace(/[^0-9.]/g, ''));
        const peMm2 = Number(String(cable.pe || '').replace(/[^0-9.]/g, ''));
        if (input.metric) {
            const phasePass = Number.isFinite(phaseMm2) && phaseMm2 >= requiredMm2;
            const pePass = Number.isFinite(peMm2) && peMm2 >= requiredMm2;
            thermal = { status: phasePass && pePass ? 'PASS' : 'FAIL', requiredMm2, phasePass, pePass };
        } else {
            thermal = { status: 'NOT AVAILABLE FOR AWG', requiredMm2, phasePass: null, pePass: null };
        }
    } else if (faultKA !== null) {
        thermal = { status: 'INVALID INPUT', requiredMm2: null, phasePass: false, pePass: false };
    }
    const overall = !coordination || !voltageDropPass || thermal.status === 'FAIL' || thermal.status === 'INVALID INPUT'
        ? 'REVIEW / FAIL'
        : thermal.status === 'PASS' ? 'PASS — SCREENING' : 'INCOMPLETE';
    return { valid: true, cable, Ib, In, Iz, correction, coordination, vDropV, vDropPct, voltageDropPass, thermal, overall };
}

function cableInputValue(id, fallback) {
    const el = document.getElementById(id);
    return el ? el.value : fallback;
}
function initCableSizingUI() {
    const maxDrop = document.getElementById('cableMaxVdrop');
    const insulation = document.getElementById('cableInsulation');
    const tripTime = document.getElementById('cableTripTime');
    if (!maxDrop || !insulation || !tripTime) return;
    maxDrop.value = engineering.cableMaxVdrop ?? 3;
    insulation.value = engineering.cableInsulation || 'PVC';
    tripTime.value = engineering.cableTripTime ?? 0.4;
    [maxDrop, insulation, tripTime].forEach(el => el.addEventListener('change', () => {
        engineering.cableMaxVdrop = Number(maxDrop.value);
        engineering.cableInsulation = insulation.value;
        engineering.cableTripTime = Number(tripTime.value);
        renderCableSizing();
        if (typeof saveProject === 'function') saveProject();
    }));
    renderCableSizing();
}
function renderCableSizing() {
    const body = document.getElementById('cableSizingBody');
    const summary = document.getElementById('cableSizingSummary');
    const notes = document.getElementById('cableSizingNotes');
    if (!body || !summary || !notes || typeof circuits === 'undefined') return;
    const metric = config.wireUnit === 'Metric';
    const table = metric ? METRIC_WIRE_TABLE : AWG_WIRE_TABLE;
    const maxDrop = Number(cableInputValue('cableMaxVdrop', engineering.cableMaxVdrop ?? 3));
    const tripTime = Number(cableInputValue('cableTripTime', engineering.cableTripTime ?? 0.4));
    const insulation = cableInputValue('cableInsulation', engineering.cableInsulation || 'PVC');
    const factorsValid = Number(engineering.ambientFactor) > 0 && Number(engineering.groupingFactor) > 0;
    const tableMode = document.getElementById('cableTableMode');
    if (tableMode) tableMode.textContent = metric ? 'Metric copper · mm²' : 'AWG copper · THHN/THWN';
    if (!circuits.length) {
        body.innerHTML = '<tr><td colspan="9" class="p-4 text-slate-500">No circuits are available. Add loads and run the calculation engine.</td></tr>';
        summary.innerHTML = '';
        notes.innerHTML = '<p>Waiting for valid circuit data.</p>';
        return;
    }
    if (!factorsValid || !Number.isFinite(maxDrop) || maxDrop <= 0 || maxDrop > 10 || !Number.isFinite(tripTime) || tripTime <= 0 || tripTime > 5) {
        body.innerHTML = '<tr><td colspan="9" class="p-4 text-red-300">Invalid cable-engine settings. Check correction factors, voltage-drop limit and trip time.</td></tr>';
        summary.innerHTML = '';
        notes.innerHTML = '<p>Correct the settings before interpreting cable results.</p>';
        return;
    }
    const faultInputs = engineering.cableFaultInputs || (engineering.cableFaultInputs = {});
    const results = circuits.map(ckt => {
        const key = ckt.board + '|' + ckt.id;
        const fault = Object.prototype.hasOwnProperty.call(faultInputs, key) ? String(faultInputs[key]) : '';
        const phases = Number(ckt.sup) === 3 ? 3 : 1;
        const result = calculateCableChecks({
            designCurrent: ckt.current, breakerRating: ckt.mcb,
            ambientFactor: Number(engineering.ambientFactor || 1), groupingFactor: Number(engineering.groupingFactor || 1),
            lengthM: ckt.distance, voltage: phases === 3 ? config.voltageLL : config.voltageLN, voltageLL: config.voltageLL,
            phases, maxVdrop: maxDrop, wireTable: table, faultCurrentKA: fault,
            tripTime, insulation, metric
        });
        return { ckt, key, fault, result };
    });
    const sized = results.filter(x => x.result.valid && x.result.cable);
    const passed = results.filter(x => x.result.overall === 'PASS — SCREENING').length;
    const failed = results.filter(x => x.result.overall === 'REVIEW / FAIL').length;
    const incomplete = results.length - passed - failed;
    const tile = (label, value, tone) => '<div class="rounded-xl border border-slate-800 bg-slate-950 p-3"><div class="text-[10px] uppercase tracking-wide text-slate-500">' + label + '</div><div class="text-xl font-bold mt-1 ' + tone + '">' + value + '</div></div>';
    summary.innerHTML = tile('Circuits analysed', results.length, 'text-slate-100') + tile('Screening pass', passed, 'text-emerald-400') + tile('Review / fail', failed, 'text-rose-400') + tile('Incomplete checks', incomplete, 'text-amber-300');
    body.innerHTML = results.map(({ ckt, key, fault, result }) => {
        const name = escapeHTML(boardOf(ckt.board).name + ' · ' + ckt.id);
        if (!result.valid || !result.cable) return '<tr><td class="py-3 px-2 text-slate-200">' + name + '</td><td colspan="7" class="py-3 px-2 text-rose-300">' + escapeHTML(result.message || 'No valid cable selection') + '</td><td class="py-3 px-2 text-rose-300">BLOCKED</td></tr>';
        const thermal = result.thermal.status === 'PASS' ? '<span class="text-emerald-400">PASS</span>' : result.thermal.status === 'FAIL' ? '<span class="text-rose-400">FAIL</span>' : '<span class="text-amber-300">' + escapeHTML(result.thermal.status) + '</span>';
        const vTone = result.voltageDropPass ? 'text-emerald-400' : 'text-rose-400';
        const overallTone = result.overall.startsWith('PASS') ? 'text-emerald-400' : result.overall === 'REVIEW / FAIL' ? 'text-rose-400' : 'text-amber-300';
        return '<tr class="hover:bg-slate-800/40">' +
            '<td class="py-2.5 px-2 text-slate-200 font-semibold">' + name + '<span class="block text-[10px] text-slate-500 font-normal">' + (ckt.sup === 3 ? '3-phase' : '1-phase') + ' · ' + Number(ckt.distance).toFixed(1) + ' m</span></td>' +
            '<td class="py-2.5 px-2 font-mono text-amber-300">' + result.Ib.toFixed(2) + ' / ' + result.In.toFixed(0) + '</td>' +
            '<td class="py-2.5 px-2 text-cyan-300 font-bold">' + escapeHTML(result.cable.size) + '<span class="block text-[10px] text-slate-500 font-normal">Cu · ' + (metric ? 'metric' : 'AWG') + '</span></td>' +
            '<td class="py-2.5 px-2 font-mono text-slate-200">' + result.Iz.toFixed(1) + '</td>' +
            '<td class="py-2.5 px-2 font-mono ' + vTone + '">' + result.vDropPct.toFixed(2) + '%<span class="block text-[10px] text-slate-500 font-normal">limit ' + maxDrop.toFixed(1) + '%</span></td>' +
            '<td class="py-2.5 px-2 text-slate-300">' + escapeHTML(result.cable.pe || '—') + '</td>' +
            '<td class="py-2.5 px-2"><input type="number" min="0.01" step="0.1" placeholder="kA" aria-label="Fault current for ' + name + '" data-cable-fault="' + escapeHTML(key) + '" value="' + escapeHTML(fault) + '" class="w-20 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-100"></td>' +
            '<td class="py-2.5 px-2">' + thermal + (result.thermal.requiredMm2 ? '<span class="block text-[10px] text-slate-500">S ≥ ' + result.thermal.requiredMm2.toFixed(2) + ' mm²</span>' : '') + '</td>' +
            '<td class="py-2.5 px-2 font-semibold ' + overallTone + '">' + result.overall + '</td></tr>';
    }).join('');
    body.querySelectorAll('[data-cable-fault]').forEach(input => input.addEventListener('change', () => {
        const value = input.value.trim();
        if (value && (!Number.isFinite(Number(value)) || Number(value) <= 0)) { input.setCustomValidity('Enter a positive fault current in kA, or leave blank.'); input.reportValidity(); return; }
        input.setCustomValidity('');
        engineering.cableFaultInputs = engineering.cableFaultInputs || {};
        if (value) engineering.cableFaultInputs[input.dataset.cableFault] = value;
        else delete engineering.cableFaultInputs[input.dataset.cableFault];
        renderCableSizing();
        if (typeof saveProject === 'function') saveProject();
    }));
    notes.innerHTML =
        '<p><strong class="text-slate-300">Selection rule:</strong> cable is selected so corrected reference ampacity Iz ≥ breaker rating In, while Ib ≤ In. Iz = tabulated ampacity × ambient factor × grouping factor.</p>' +
        '<p><strong class="text-slate-300">Voltage drop:</strong> resistance-only estimate using the table resistance and longest circuit run; reactance, conductor operating temperature, harmonics and parallel conductors are not modelled.</p>' +
        '<p><strong class="text-slate-300">Short-circuit thermal check:</strong> enter the prospective fault current at each cable location. The adiabatic S ≥ I√t/k check uses the selected insulation k-value; the AWG table does not include validated mm² equivalents, so this check is unavailable in AWG mode.</p>' +
        '<p><strong class="text-slate-300">Dataset limitation:</strong> the current ampacity tables are generic screening references. Installation-method selection is not yet linked to method-specific ampacity tables; correction factors are user inputs. Aluminium conductor data, protective-device curves, disconnection-time verification, earth-fault loop/ADS and selectivity are not verified.</p>' +
        '<p class="text-amber-300">A “PASS — SCREENING” result is not proof of BNBC, IEC 60364 or NEC compliance. Confirm cable construction, installation method, manufacturer data, local adopted code and coordination with a qualified electrical engineer.</p>';
}

if (typeof module !== 'undefined' && module.exports) module.exports = { calculateCableChecks };
