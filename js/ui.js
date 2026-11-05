/* ElectroLoad Pro | ui.js
 * Screen updates: grouping toggles, system config, fixture / board / library tables and edit handlers.
 * Classic script: shares one global scope with the other files, so keep the load order from index.html.
 */

function updateGrouping() {
    grouping.auto = document.getElementById('autoGroupToggle').checked;
    grouping.rooms = document.getElementById('roomConsolidateToggle').checked;
    grouping.strategy = document.getElementById('roomStrategySelect').value;
    const manual = !grouping.auto;
    document.getElementById('roomConsolidateToggle').disabled = manual;
    document.getElementById('roomToggleWrap').classList.toggle('opacity-50', manual);
    document.getElementById('roomStrategySelect').disabled = manual || !grouping.rooms;
    document.getElementById('strategyWrap').classList.toggle('opacity-50', manual || !grouping.rooms);
    document.getElementById('groupModeLabel').innerText = manual
        ? 'OFF: assign circuits manually in the CKT column'
        : 'ON: CKT-1, CKT-2... allocated by breaker capacity';
    renderFixtureTable();
    recalculateAll();
}

// System Configuration Updates
function updateConfig() {
    config.standard = document.getElementById('standardSelect').value;
    config.projectType = document.getElementById('projectTypeSelect')?.value || config.projectType || 'Residential';
    const projectNote = document.getElementById('projectTypeNote');
    if(projectNote) projectNote.textContent = config.projectType==='Residential' ? 'Residential profile: Bangladesh Power Division residential wiring guideline is a relevant local reference. Its stated scope is residential; verify project-specific requirements.' : config.projectType==='Commercial' ? 'Commercial profile: apply BNBC occupancy provisions and the adopted IEC/BS/NFPA design basis. No blanket commercial diversity multiplier is assumed.' : 'Industrial profile: use equipment nameplate data, motor starting, process duty, harmonics, fault level and industrial installation conditions. Residential defaults are not applied.';
    const systemPhase = document.getElementById('systemPhaseSelect').value;
    config.phase = systemPhase;

    if (systemPhase === '3P') {
        config.voltageLN = 230;
        config.voltageLL = 400;
    } else if (systemPhase === '3P-208') {
        config.voltageLN = 120;
        config.voltageLL = 208;
    } else if (systemPhase === '1P') {
        config.voltageLN = 230;
        config.voltageLL = 230;
    } else if (systemPhase === '1P-120') {
        config.voltageLN = 120;
        config.voltageLL = 120;
    }

    config.frequency = parseInt(document.getElementById('freqSelect').value);
    config.wireUnit = document.getElementById('wireUnitSelect').value;
    config.safetyFactor = parseFloat(document.getElementById('safetyFactorSelect').value);

    document.getElementById('configSummaryText').innerText = 
        `${config.phase.includes('3P') ? '3-Phase ' + config.voltageLL + 'V' : '1-Phase ' + config.voltageLN + 'V'} ${config.frequency}Hz | Reference: ${config.standard} (not applied)`;

    recalculateAll();
}

// Render Table Rows for Fixtures
function renderFixtureTable() {
    const tbody = document.getElementById('fixtureTableBody');
    document.getElementById('roomList').innerHTML = [...new Set(fixtures.map(f => f.room || 'General'))].map(r => `<option value="${escapeHTML(r)}">`).join('');
    document.getElementById('cktList').innerHTML = [...new Set(fixtures.map(f => f.ckt).filter(Boolean))].map(c => `<option value="${c}">`).join('');
    tbody.innerHTML = '';

    fixtures.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-800/40 transition";
        tr.innerHTML = `
            <td class="py-2 px-2">
                <input type="text" value="${escapeHTML(item.name)}" onchange="updateFixture(${item.id}, 'name', this.value)" class="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 focus:border-sky-500 focus:outline-none">
            </td>
            <td class="py-2 px-2">
                <input type="text" list="roomList" value="${escapeHTML(item.room || 'General')}" onchange="updateFixture(${item.id}, 'room', this.value.trim() || 'General')" class="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 focus:border-sky-500 focus:outline-none">
            </td>
            <td class="py-2 px-2">
                <select onchange="updateFixture(${item.id}, 'board', this.value)" class="w-full bg-slate-950 border border-slate-800 rounded px-1.5 py-1 text-slate-300 focus:outline-none">
                    ${boards.map(b => `<option value="${b.id}" ${item.board === b.id ? 'selected' : ''}>${escapeHTML(b.name)}</option>`).join('')}
                </select>
            </td>
            <td class="py-2 px-2">
                <select onchange="updateFixture(${item.id}, 'category', this.value)" class="w-full bg-slate-950 border border-slate-800 rounded px-1.5 py-1 text-slate-300 focus:outline-none">
                    <option value="Lighting" ${item.category === 'Lighting' ? 'selected' : ''}>Lighting</option>
                    <option value="Receptacles" ${item.category === 'Receptacles' ? 'selected' : ''}>Receptacles</option>
                    <option value="HVAC" ${item.category === 'HVAC' ? 'selected' : ''}>HVAC</option>
                    <option value="Motors" ${item.category === 'Motors' ? 'selected' : ''}>Motors</option>
                    <option value="Appliances" ${item.category === 'Appliances' ? 'selected' : ''}>Appliances</option>
                </select>
            </td>
            <td class="py-2 px-2">
                <input type="number" min="1" value="${item.qty}" onchange="updateFixture(${item.id}, 'qty', parseInt(this.value))" class="w-full bg-slate-950 border border-slate-800 rounded px-1.5 py-1 text-center text-slate-200 focus:outline-none">
            </td>
            <td class="py-2 px-2">
                <input type="number" min="1" value="${item.watts}" onchange="updateFixture(${item.id}, 'watts', parseFloat(this.value))" class="w-full bg-slate-950 border border-slate-800 rounded px-1.5 py-1 text-slate-200 focus:outline-none">
            </td>
            <td class="py-2 px-2">
                <input type="number" step="0.01" min="0.5" max="1.0" value="${item.pf}" onchange="updateFixture(${item.id}, 'pf', parseFloat(this.value))" class="w-full bg-slate-950 border border-slate-800 rounded px-1.5 py-1 text-slate-200 focus:outline-none">
            </td>
            <td class="py-2 px-2">
                <input type="number" step="0.05" min="0.1" max="3" value="${item.currentFactor ?? defaultCurrentFactor(item)}" title="Residential guideline uses 1.65 for fans, fluorescent lamps and small inductive loads up to 1 kW. Editable engineer input." onchange="updateFixture(${item.id}, 'currentFactor', parseFloat(this.value))" class="w-16 bg-slate-950 border border-slate-800 rounded px-1.5 py-1 text-slate-200 focus:outline-none">
            </td>
            <td class="py-2 px-2">
                <input type="number" step="0.05" min="0" max="1" value="${item.demandFactor ?? 1}" title="Engineer-entered demand factor; default 1.00 until a documented diversity study is applied." onchange="updateFixture(${item.id}, 'demandFactor', parseFloat(this.value))" class="w-16 bg-slate-950 border border-slate-800 rounded px-1.5 py-1 text-slate-200 focus:outline-none">
            </td>
            <td class="py-2 px-2">
                <input type="number" min="1" value="${item.distance}" onchange="updateFixture(${item.id}, 'distance', parseFloat(this.value))" class="w-full bg-slate-950 border border-slate-800 rounded px-1.5 py-1 text-slate-200 focus:outline-none">
            </td>
            <td class="py-2 px-2">
                <select ${is3PSystem() ? '' : 'disabled'} onchange="updateFixture(${item.id}, 'sup', parseInt(this.value))" title="${eSup(item) !== Number(item.sup || 1) ? '3-phase load needs a 3-phase board: calculated as 1-phase here' : 'Supply type of this load'}" class="w-full bg-slate-950 border border-slate-800 rounded px-1.5 py-1 font-bold ${eSup(item) !== Number(item.sup || 1) ? 'text-amber-400' : 'text-slate-300'} focus:outline-none">
                    <option value="1" ${Number(item.sup || 1) === 1 ? 'selected' : ''}>1&Phi;</option>
                    <option value="3" ${Number(item.sup || 1) === 3 ? 'selected' : ''}>3&Phi;</option>
                </select>
            </td>
            <td class="py-2 px-2">
                <input type="text" list="cktList" value="${(item.ckt || '').replace(/"/g, '&quot;')}" ${grouping.auto ? 'disabled title="Assigned automatically (turn off Auto Circuit Grouping to edit)"' : ''} onchange="updateFixture(${item.id}, 'ckt', this.value.trim())" class="w-full bg-slate-950 border border-slate-800 rounded px-1.5 py-1 font-mono text-sky-300 ${grouping.auto ? 'opacity-60' : ''} focus:outline-none">
            </td>
            <td class="py-2 px-2">
                <select ${(grouping.auto || item.phase === '3') ? 'disabled title="Phase is assigned automatically"' : ''} onchange="updateFixture(${item.id}, 'phase', this.value)" class="w-full bg-slate-950 border border-slate-800 rounded px-1.5 py-1 font-bold ${item.phase === 'R' ? 'text-red-400' : item.phase === 'Y' ? 'text-amber-400' : item.phase === 'B' ? 'text-blue-400' : 'text-slate-300'} focus:outline-none">
                    <option value="R" ${item.phase === 'R' ? 'selected' : ''}>Phase R</option>
                    <option value="Y" ${item.phase === 'Y' ? 'selected' : ''}>Phase Y</option>
                    <option value="B" ${item.phase === 'B' ? 'selected' : ''}>Phase B</option>
                    <option value="3" ${item.phase === '3' ? 'selected' : ''}>3&Phi; (RYB)</option>
                </select>
            </td>
            <td class="py-2 px-2 text-right">
                <button onclick="removeFixture(${item.id})" class="text-slate-500 hover:text-red-400 p-1 transition"><i class="fa-solid fa-trash-can"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Add/Remove/Update Helpers
function addNewFixtureRow() {
    const newId = fixtures.length > 0 ? Math.max(...fixtures.map(f => f.id)) + 1 : 1;
    const board = boards[0].id;
    fixtures.push({ id: newId, name: 'New Circuit Load', room: 'General', board: board, sup: 1, ckt: grouping.auto ? '' : nextCktName(board), category: 'Lighting', qty: 1, watts: 100, pf: 0.95, demandFactor:1, distance: 15, phase: 'R' });
    renderFixtureTable();
    recalculateAll();
}

function removeFixture(id) {
    fixtures = fixtures.filter(f => f.id !== id);
    renderFixtureTable();
    recalculateAll();
}

function updateFixture(id, key, value) {
    const item = fixtures.find(f => f.id === id);
    if (!item) return;
    item[key] = value;
    const peersOf = f => fixtures.filter(x => x !== f && x.board === f.board && x.ckt === f.ckt);
    if (!grouping.auto) {
        if (key === 'phase') {
            fixtures.forEach(f => { if (f.ckt === item.ckt && f.board === item.board) f.phase = value; });
        }
        if (key === 'board') item.ckt = nextCktName(item.board, item);
        if (key === 'sup' && peersOf(item).length) item.ckt = nextCktName(item.board, item);
        if (key === 'ckt') {
            if (!value) item.ckt = nextCktName(item.board, item);
            const peer = peersOf(item)[0];
            if (peer && eSup(peer) !== eSup(item)) {
                alert('A circuit cannot mix 1-phase and 3-phase loads. A new circuit was created instead.');
                item.ckt = nextCktName(item.board, item);
            } else if (peer) {
                item.phase = peer.phase;
            }
        }
    }
    recalculateAll();
    if (['phase', 'ckt', 'board', 'sup'].includes(key)) renderFixtureTable();
}

function addPresetItem(name, category, watts, pf, sup = 1) {
    const newId = fixtures.length > 0 ? Math.max(...fixtures.map(f => f.id)) + 1 : 1;
    const sel = document.getElementById('presetBoard');
    const board = (sel && sel.value && boards.some(b => b.id === sel.value)) ? sel.value : boards[0].id;
    // Round-robin phase assignment
    const phases = ['R', 'Y', 'B'];
    const assignedPhase = phases[fixtures.length % 3];

    fixtures.push({ id: newId, name: name, room: 'General', board: board, sup: sup, ckt: grouping.auto ? '' : nextCktName(board), category: category, qty: 1, watts: watts, pf: pf, demandFactor:1, distance: 20, phase: assignedPhase });
    closePresetModal();
    renderFixtureTable();
    recalculateAll();
}

// Board management
function addBoard() {
    const nid = 'b' + (Math.max(...boards.map(b => parseInt(b.id.slice(1)) || 0)) + 1);
    boards.push({ id: nid, name: 'SDB-' + (boards.filter(b => b.type === 'SDB').length + 1), type: 'SDB', room: 'General', par: boards[0].id, sup: 3, dist: 20 });
    renderFixtureTable();
    recalculateAll();
}

function updateBoard(id, key, value) {
    const b = boards.find(x => x.id === id);
    if (!b) return;
    const previous = b[key];
    b[key] = (key === 'dist' || key === 'sup') ? Number(value) : value;
    if (key === 'par' || key === 'sup') { const issue = validateBoardHierarchy(); if (issue) { b[key] = previous; alert(issue); renderBoardTable(); return; } }
    if (key === 'sup' && Number(value) === 1) {
        boards.forEach(k => { if (k !== b && k.par === b.id) k.par = b.par || boards[0].id; });
    }
    renderFixtureTable();
    recalculateAll();
}

function removeBoard(id) {
    const b = boards.find(x => x.id === id);
    if (!b || b === boards[0]) return;
    if (!confirm('Delete board ' + b.name + '? Its sub-boards are removed and its loads move to the parent board.')) return;
    const gone = new Set([b.id]);
    let grew = true;
    while (grew) { grew = false; boards.forEach(x => { if (!gone.has(x.id) && gone.has(x.par)) { gone.add(x.id); grew = true; } }); }
    fixtures.forEach(f => { if (gone.has(f.board)) { f.board = b.par || boards[0].id; if (!grouping.auto) f.ckt = ''; } });
    boards = boards.filter(x => !gone.has(x.id));
    renderFixtureTable();
    recalculateAll();
}

function renderBoardTable() {
    const tb = document.getElementById('boardTableBody');
    tb.innerHTML = '';
    boards.forEach((b, idx) => {
        const s = b.s || { kw: 0, mx: 0, cb: 6 };
        const isRoot = idx === 0, bs = bSup(b);
        const phases = bs === 3 ? 3 : 1;
        const cableResult = isRoot ? null : calculateCableChecks({
            wireUnit:config.wireUnit, designCurrent:Number(s.mx||0), breakerRating:Number(s.cb||0),
            lengthM:Number(b.dist||0), voltage:phases===3?config.voltageLL:config.voltageLN, phases,
            maxVdrop:Number(engineering.cableMaxVdrop ?? (config.projectType==='Residential'?2.5:3)),
            installationMethod:engineering.cableMethod||'B2', loadedConductors:phases===3?3:2,
            material:engineering.cableMaterial||'Cu', insulation:engineering.cableInsulation||'PVC',
            ambientFactor:Number(engineering.cableAmbientFactor ?? engineering.ambientFactor ?? 1),
            groupingFactor:Number(engineering.cableGroupingFactor ?? engineering.groupingFactor ?? 1),
            conductorTempC:Number(engineering.cableTemp??70), powerFactor:Number(engineering.cablePowerFactor||0.9),
            reactanceOhmKm:Number(engineering.cableReactance??0.08),
            localPeMinimum:config.standard==='BNBC'&&config.projectType==='Residential'?4:0,
            minimumSizeMm2:config.standard==='BNBC'&&config.projectType==='Residential'?(Number(s.cb)>=20?6:Number(s.cb)>=15?4:Number(s.cb)>=10?2.5:1.5):0
        });
        const wire = cableResult && cableResult.valid ? {size:cableResult.cable.size+' mm²',pe:cableResult.peMm2+' mm²'} : null;
        let vd = isRoot ? '&mdash;' : 'BLOCKED', vdWarn = false;
        if (!isRoot && cableResult && cableResult.valid) {
            s.feederWire=wire; s.feederVdropPct=cableResult.vDropPct;
            vdWarn=!cableResult.voltageDropPass; vd=cableResult.vDropPct.toFixed(2)+'%';
        } else if(!isRoot) { s.feederWire=null; s.feederVdropPct=null; }
        const cur = bs === 3 && s.A ? `R ${s.A.R.toFixed(1)} &middot; Y ${s.A.Y.toFixed(1)} &middot; B ${s.A.B.toFixed(1)}` : `${(s.mx || 0).toFixed(1)} A (${b.e || 'R'})`;
        const parents = boards.filter(k => k !== b && bSup(k) >= bSup(b) && !isDescendant(k, b));
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-800/40 transition';
        tr.innerHTML = `
            <td class="py-2 px-2"><input type="text" value="${escapeHTML(b.name)}" onchange="updateBoard('${b.id}', 'name', this.value.trim() || this.defaultValue)" class="w-28 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 font-sans focus:border-sky-500 focus:outline-none"><input type="text" aria-label="Board area" placeholder="Area" value="${escapeHTML(b.room || '')}" onchange="updateBoard('${b.id}', 'room', this.value.trim())" class="w-24 mt-1 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-400"></td>
            <td class="py-2 px-2">${isRoot ? '<span class="text-slate-300">MDB</span>' : `<select onchange="updateBoard('${b.id}', 'type', this.value)" class="bg-slate-950 border border-slate-800 rounded px-1.5 py-1 text-slate-300 focus:outline-none">${['MDB', 'FDB', 'DB', 'BDB', 'SDB', 'SB', 'RDB'].map(t => `<option ${b.type === t ? 'selected' : ''}>${t}</option>`).join('')}</select>`}</td>
            <td class="py-2 px-2">${isRoot ? '<span class="text-slate-400">Grid Supply</span>' : `<select onchange="updateBoard('${b.id}', 'par', this.value)" class="bg-slate-950 border border-slate-800 rounded px-1.5 py-1 text-slate-300 focus:outline-none">${parents.map(k => `<option value="${k.id}" ${b.par === k.id ? 'selected' : ''}>${escapeHTML(k.name)}</option>`).join('')}</select>`}</td>
            <td class="py-2 px-2"><select ${is3PSystem() ? '' : 'disabled'} onchange="updateBoard('${b.id}', 'sup', this.value)" class="bg-slate-950 border border-slate-800 rounded px-1.5 py-1 text-slate-300 focus:outline-none"><option value="3" ${Number(b.sup) === 3 ? 'selected' : ''}>3&Phi;</option><option value="1" ${Number(b.sup) === 1 ? 'selected' : ''}>1&Phi;</option></select></td>
            <td class="py-2 px-2">${isRoot ? '&mdash;' : `<input type="number" min="1" value="${b.dist}" onchange="updateBoard('${b.id}', 'dist', parseFloat(this.value) || 1)" class="w-16 bg-slate-950 border border-slate-800 rounded px-1.5 py-1 text-slate-200 focus:outline-none">`}</td>
            <td class="py-2 px-2 text-slate-300">${(s.kw || 0).toFixed(2)}</td>
            <td class="py-2 px-2 text-amber-400 font-bold">${cur}</td>
            <td class="py-2 px-2 text-sky-400 font-bold">${s.cb == null ? 'NOT SIZED' : s.cb + 'A'} ${bs === 3 ? '3P' : '1P'} ${isRoot ? 'MCCB' : 'MCB'}</td>
            <td class="py-2 px-2 text-emerald-400 font-bold">${isRoot ? '&mdash;' : wire ? wire.size : 'NOT SIZED'}</td>
            <td class="py-2 px-2 ${vdWarn ? 'text-red-400 font-bold' : 'text-slate-300'}">${vd}</td>
            <td class="py-2 px-2 text-right no-print">${isRoot ? '' : `<button onclick="removeBoard('${b.id}')" class="text-slate-500 hover:text-red-400 p-1 transition"><i class="fa-solid fa-trash-can"></i></button>`}</td>
        `;
        tb.appendChild(tr);
    });
}

// Fixture library (Fast Presets)
function renderPresetModal() {
    const sel = document.getElementById('presetBoard');
    const keep = sel.value;
    sel.innerHTML = boards.map(b => `<option value="${b.id}">${b.name} (${b.type})</option>`).join('');
    if (boards.some(b => b.id === keep)) sel.value = keep;
    renderPresetGrid();
    document.getElementById('libTableBody').innerHTML = library.map((p, i) => `
        <tr>
            <td class="py-1.5 px-2"><input type="text" value="${String(p.name).replace(/"/g, '&quot;')}" onchange="updateLib(${i}, 'name', this.value.trim() || 'Fixture')" class="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 focus:outline-none"></td>
            <td class="py-1.5 px-2"><select onchange="updateLib(${i}, 'category', this.value)" class="w-full bg-slate-950 border border-slate-800 rounded px-1.5 py-1 text-slate-300 focus:outline-none">${['Lighting', 'Receptacles', 'HVAC', 'Motors', 'Appliances'].map(c => `<option ${p.category === c ? 'selected' : ''}>${c}</option>`).join('')}</select></td>
            <td class="py-1.5 px-2"><input type="number" min="1" value="${p.watts}" onchange="updateLib(${i}, 'watts', parseFloat(this.value) || 1)" class="w-full bg-slate-950 border border-slate-800 rounded px-1.5 py-1 text-slate-200 focus:outline-none"></td>
            <td class="py-1.5 px-2"><input type="number" step="0.01" min="0.5" max="1" value="${p.pf}" onchange="updateLib(${i}, 'pf', parseFloat(this.value) || 0.9)" class="w-full bg-slate-950 border border-slate-800 rounded px-1.5 py-1 text-slate-200 focus:outline-none"></td>
            <td class="py-1.5 px-2"><select onchange="updateLib(${i}, 'sup', parseInt(this.value))" class="w-full bg-slate-950 border border-slate-800 rounded px-1.5 py-1 text-slate-300 focus:outline-none"><option value="1" ${p.sup !== 3 ? 'selected' : ''}>1&Phi;</option><option value="3" ${p.sup === 3 ? 'selected' : ''}>3&Phi;</option></select></td>
            <td class="py-1.5 px-2 text-right"><button onclick="removeLibItem(${i})" class="text-slate-500 hover:text-red-400 p-1 transition"><i class="fa-solid fa-trash-can"></i></button></td>
        </tr>`).join('');
}
function renderPresetGrid() {
    document.getElementById('presetGrid').innerHTML = library.map((p, i) => `
        <button onclick="addPresetFromLib(${i})" class="p-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-left transition space-y-1">
            <span class="text-xs font-bold text-slate-200 block">${escapeHTML(p.name)}</span>
            <span class="text-[11px] text-slate-400 block">${p.watts} Watts &bull; PF ${p.pf} &bull; ${p.sup === 3 ? '3&Phi;' : '1&Phi;'}</span>
        </button>`).join('');
}
function addPresetFromLib(i) { const p = library[i]; addPresetItem(p.name, p.category, p.watts, p.pf, p.sup || 1); }
function updateLib(i, key, value) { library[i][key] = value; saveLibrary(); renderPresetGrid(); }
function addLibItem() { library.push({ name: 'New fixture', category: 'Appliances', watts: 100, pf: 0.90, sup: 1 }); saveLibrary(); renderPresetModal(); }
function removeLibItem(i) { library.splice(i, 1); saveLibrary(); renderPresetModal(); }
function resetLibrary() { library = DEFAULT_LIBRARY.map(p => ({ ...p })); saveLibrary(); renderPresetModal(); }
