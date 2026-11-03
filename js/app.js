/* ElectroLoad Pro | app.js
 * Startup (window.onload), modals and project reset. Loaded last.
 * Classic script: shares one global scope with the other files, so keep the load order from index.html.
 */

// Versioned browser persistence for the complete working project.
function saveProject() {
    try {
        const snapshot = { version: 1, config, grouping, fixtures, boards: boards.map(b => ({id:b.id,name:b.name,type:b.type,room:b.room||'General',par:b.par,sup:b.sup,dist:b.dist})) };
        localStorage.setItem('elpro_project_v1', JSON.stringify(snapshot));
    } catch (err) { console.warn('Project autosave failed:', err); }
}
function loadProject() {
    try {
        const raw = localStorage.getItem('elpro_project_v1');
        if (!raw) return;
        const saved = JSON.parse(raw);
        if (saved?.version !== 1 || !Array.isArray(saved.fixtures) || !Array.isArray(saved.boards) || !saved.boards.length || !saved.config || !saved.grouping || saved.boards[0].par) return;
        config = {...config, ...saved.config};
        grouping = {...grouping, ...saved.grouping};
        fixtures = saved.fixtures;
        boards = saved.boards;
    } catch (err) { console.warn('Project restore failed:', err); }
}

// On Application Load
window.onload = function() {
    loadProject();
    boards.forEach(b => { if (typeof b.room !== 'string') b.room = 'General'; });
    const setValue = (id, value) => { const el = document.getElementById(id); if (el) el.value = String(value); };
    setValue('standardSelect', config.standard);
    setValue('systemPhaseSelect', config.phase);
    setValue('freqSelect', config.frequency);
    setValue('wireUnitSelect', config.wireUnit);
    setValue('safetyFactorSelect', config.safetyFactor);
    document.getElementById('autoGroupToggle').checked = !!grouping.auto;
    document.getElementById('roomConsolidateToggle').checked = !!grouping.rooms;
    setValue('roomStrategySelect', grouping.strategy);
    updateConfig();
    updateGrouping();
};

// Modals & Reset
function openPresetModal() { renderPresetModal(); document.getElementById('presetModal').classList.remove('hidden'); }
function closePresetModal() { document.getElementById('presetModal').classList.add('hidden'); }
function toggleFormulaModal() { document.getElementById('formulaModal').classList.toggle('hidden'); }

function resetProject() {
    if(confirm("Reset all load entries to default template?")) {
        boards = [{ id: 'b0', name: 'MDB', type: 'MDB', room: 'Main', par: '', sup: 3, dist: 0 }];
        fixtures = [
            { id: 1, name: 'Main Office Lighting', room: 'Office', board: 'b0', sup: 1, category: 'Lighting', qty: 10, watts: 18, pf: 0.95, distance: 15, phase: 'R' },
            { id: 2, name: 'Workstation Sockets', room: 'Office', board: 'b0', sup: 1, category: 'Receptacles', qty: 6, watts: 180, pf: 0.90, distance: 20, phase: 'Y' }
        ];
        renderFixtureTable();
        recalculateAll();
    }
}
    
