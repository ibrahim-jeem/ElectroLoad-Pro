/* ElectroLoad Pro | engine.js */
const is3PSystem = () => String(config.phase || '').includes('3P');
function boardOf(id) { return boards.find(b => b.id === id) || boards[0]; }
function selectBreakerRating(requiredCurrent) {
    if (!Number.isFinite(requiredCurrent) || requiredCurrent < 0) return null;
    return STANDARD_BREAKER_RATINGS.find(r => r >= requiredCurrent) ?? null;
}
function escapeHTML(value) {
    return String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
}
function bSup(board) {
    if (!board) return 1;
    // Board supply is an attribute of that board, not of the project incomer.
    return is3PSystem() ? (Number(board.sup) === 3 ? 3 : 1) : 1;
}
function validateBoardHierarchy() {
    const root = boards[0];
    if (!root || root.par) return 'A root MDB is required.';
    const ids = new Set(boards.map(b => b.id));
    if (ids.size !== boards.length) return 'Board IDs must be unique.';
    for (const board of boards.slice(1)) {
        if (!board.par || !ids.has(board.par)) return 'Every downstream board must have a valid parent.';
        let current = board;
        const seen = new Set();
        while (current && current.par) {
            if (seen.has(current.id)) return 'Board hierarchy contains a cycle.';
            seen.add(current.id);
            current = boards.find(x => x.id === current.par);
        }
        if (current !== root) return 'Every downstream board must trace to the root MDB.';
        const parent = boards.find(x => x.id === board.par);
        if (!parent) return 'A downstream board has no valid parent.';
        if (bSup(parent) < bSup(board)) return 'A downstream board cannot have more phases than its parent supply.';
    }
    return null;
}
function validateProjectInputs() {
    const bad = fixtures.find(f => ![+f.qty,+f.watts,+f.pf,+f.distance].every(Number.isFinite) || +f.qty <= 0 || +f.watts <= 0 || +f.pf <= 0 || +f.pf > 1 || +f.distance < 0);
    if (bad) return 'Invalid quantity, watts, power factor or distance in ' + (bad.name || 'a load') + '.';
    if (!Number.isFinite(+config.safetyFactor) || +config.safetyFactor <= 0) return 'Safety factor must be positive.';
    if (!Number.isFinite(+config.voltageLN) || +config.voltageLN <= 0 || !Number.isFinite(+config.voltageLL) || +config.voltageLL <= 0) return 'System voltage must be a valid positive number.';
    return validateBoardHierarchy();
}
function eSup(f) {
    const board = boardOf(f.board);
    return (is3PSystem() && Number(f.sup || 1) === 3 && bSup(board) === 3) ? 3 : 1;
}
function defaultCurrentFactor(f) {
    if (config.projectType !== 'Residential') return 1;
    const name = String(f.name || '').toLowerCase();
    const fanOrFluorescent = /fan|fluorescent/.test(name);
    const smallInductive = f.category === 'Motors' && Number(f.watts) <= 1000;
    return fanOrFluorescent || smallInductive ? 1.65 : 1;
}
function itemCurrent(f) {
    const w = Number(f.qty) * Number(f.watts);
    const currentFactor = Number(f.currentFactor ?? defaultCurrentFactor(f));
    const base = eSup(f) === 3 ? w / (Math.sqrt(3) * config.voltageLL * f.pf) : w / (config.voltageLN * f.pf);
    return base * currentFactor;
}
function isLowPower(f) { return f.watts <= LOW_POWER_W && f.category !== 'HVAC' && f.category !== 'Motors'; }
function nextCktName(boardId, skip) {
    const nums = fixtures.filter(f => f !== skip).map(f => Number((String(f.ckt || '').match(/^CKT-(\d+)$/i) || [])[1])).filter(Number.isFinite);
    return 'CKT-' + String(Math.max(0, ...nums) + 1).padStart(3, '0');
}
function isDescendant(board, ancestor) {
    let current = board, guard = 0;
    while (current && guard++ <= boards.length) {
        if (current.par === ancestor.id) return true;
        current = boards.find(x => x.id === current.par);
    }
    return false;
}
function buildCircuits() {
    if (!boards.length) throw new Error('Project must contain an MDB.');
    fixtures.forEach(f => { if (!boards.some(b => b.id === f.board)) f.board = boards[0].id; });
    fixtures.forEach(f => { if (eSup(f) === 3) f.phase = '3'; else if (f.phase === '3') f.phase = 'R'; });
    let groups = [];
    if (grouping.auto) {
        const cap = COMBINED_MAX_MCB / config.safetyFactor;
        boards.forEach(b => {
            const boardFixtures = fixtures.filter(f => f.board === b.id);
            const boardGroups = [];
            if (grouping.rooms && grouping.strategy === 'separate') {
                boardFixtures.forEach(f => boardGroups.push([f]));
            } else {
                const buckets = new Map();
                boardFixtures.forEach(f => {
                    const key = grouping.rooms ? (f.room || 'General') : 'ALL';
                    if (!buckets.has(key)) buckets.set(key, []);
                    buckets.get(key).push(f);
                });
                buckets.forEach(list => {
                    const bins = [];
                    list.filter(f => isLowPower(f) && eSup(f) === 1)
                        .sort((a,b) => itemCurrent(b)-itemCurrent(a)).forEach(f => {
                            const current = itemCurrent(f);
                            let bin = bins.find(x => x.sum + current <= cap);
                            if (!bin) { bin = {sum:0,items:[]}; bins.push(bin); }
                            bin.sum += current; bin.items.push(f);
                        });
                    bins.forEach(bin => boardGroups.push(bin.items));
                    list.filter(f => !(isLowPower(f) && eSup(f) === 1)).forEach(f => boardGroups.push([f]));
                });
            }
            groups.push(...boardGroups);
        });
        // Number once across the entire project. Circuit identity is globally unambiguous.
        groups.forEach((group, index) => group.forEach(f => f.ckt = 'CKT-' + String(index + 1).padStart(3, '0')));
    } else {
        fixtures.forEach(f => { if (!f.ckt) f.ckt = nextCktName(f.board, f); });
        const map = new Map();
        fixtures.forEach(f => {
            const key = f.board + '|' + String(f.ckt).trim();
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(f);
        });
        map.forEach(group => {
            if (eSup(group[0]) === 1) group.forEach(f => f.phase = group[0].phase);
        });
        groups = [...map.values()].sort((a,b) => {
            const boardOrder = boards.findIndex(x => x.id === a[0].board) - boards.findIndex(x => x.id === b[0].board);
            return boardOrder || a[0].ckt.localeCompare(b[0].ckt, undefined, {numeric:true});
        });
    }
    circuits = groups.map(group => ({
        id: group[0].ckt, board: group[0].board, sup: eSup(group[0]), items: group,
        phase: group[0].phase, watts: group.reduce((s,f)=>s+f.qty*f.watts,0),
        current: group.reduce((s,f)=>s+itemCurrent(f),0), qty: group.reduce((s,f)=>s+f.qty,0),
        distance: Math.max(...group.map(f=>Number(f.distance)||0)),
        rooms: [...new Set(group.map(f=>f.room||'General'))],
        categories: new Set(group.map(f=>f.category)), mcb: 0
    }));
    rollUp();
}
function rollUp() {
    const root = boards[0];
    function assignPhase(target, phase, isBoard) {
        if (isBoard) {
            target.e = phase;
            circuits.filter(c=>c.board===target.id).forEach(c=>{c.phase=phase;c.items.forEach(f=>f.phase=phase);});
        } else { target.phase=phase; target.items.forEach(f=>f.phase=phase); }
    }
    function calculate(board, path = new Set()) {
        if (path.has(board.id)) throw new Error('Board hierarchy cycle detected during roll-up.');
        const nextPath = new Set(path); nextPath.add(board.id);
        const supply = bSup(board), own = circuits.filter(c=>c.board===board.id);
        const children = boards.filter(child=>child.par===board.id && child!==board);
        const amps = {R:0,Y:0,B:0}, kw = {R:0,Y:0,B:0};
        let singlePhaseAmps = 0, totalKw = 0;
        const floating = [];
        own.forEach(c=>{
            const loadKw=c.watts/1000; totalKw+=loadKw;
            if(supply===1){singlePhaseAmps+=c.current;return;}
            if(c.sup===3){['R','Y','B'].forEach(p=>{amps[p]+=c.current;kw[p]+=loadKw/3;});c.phase='3';}
            else if(!grouping.auto && ['R','Y','B'].includes(c.phase)){amps[c.phase]+=c.current;kw[c.phase]+=loadKw;}
            else floating.push({item:c,amps:c.current,kw:loadKw,isBoard:false});
        });
        children.forEach(child=>{
            const summary=calculate(child,nextPath); totalKw+=summary.kw;
            if(supply===1){singlePhaseAmps+=summary.a1;return;}
            if(bSup(child)===3){['R','Y','B'].forEach(p=>{amps[p]+=summary.A[p];kw[p]+=summary.K[p];});}
            else floating.push({item:child,amps:summary.a1,kw:summary.kw,isBoard:true});
        });
        floating.sort((a,b)=>b.amps-a.amps).forEach(entry=>{
            const phase=['R','Y','B'].reduce((best,p)=>amps[p]<amps[best]?p:best,'R');
            amps[phase]+=entry.amps; kw[phase]+=entry.kw; assignPhase(entry.item,phase,entry.isBoard);
        });
        const maximum=supply===3?Math.max(amps.R,amps.Y,amps.B):singlePhaseAmps;
        board.s={A:supply===3?amps:null,K:supply===3?kw:null,a1:singlePhaseAmps,kw:totalKw,mx:maximum,cb:selectBreakerRating(maximum*config.safetyFactor)};
        return board.s;
    }
    calculate(root);
    if(!is3PSystem()){
        boards.forEach(b=>b.e='R');
        circuits.forEach(c=>{c.phase='R';c.items.forEach(f=>f.phase='R');});
    }
}
