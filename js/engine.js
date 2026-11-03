/* ElectroLoad Pro | engine.js
 * Calculation helpers: effective phase supply, circuit grouping (auto/manual) and the board roll-up with phase balancing.
 * Classic script: shares one global scope with the other files, so keep the load order from index.html.
 */

const is3PSystem = () => config.phase.includes('3P');
function boardOf(id) { return boards.find(b => b.id === id) || boards[0]; }
function selectBreakerRating(requiredCurrent) {
    if (!Number.isFinite(requiredCurrent) || requiredCurrent < 0) return null;
    return STANDARD_BREAKER_RATINGS.find(r => r >= requiredCurrent) ?? null;
}
function escapeHTML(value) {
    return String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
}
function validateBoardHierarchy() {
    const root = boards[0];
    if (!root || root.par) return 'A root MDB is required.';
    for (const board of boards) {
        if (board === root) continue;
        let current = board; const seen = new Set([board.id]);
        while (current && current.par) {
            if (seen.has(current.par)) return 'Board hierarchy contains a cycle.';
            seen.add(current.par); current = boards.find(x => x.id === current.par);
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
    return validateBoardHierarchy();
}
function bSup(b) { return is3PSystem() ? Number(b.sup) : 1; }
// Effective supply of a load: 3-phase only on a 3-phase board in a 3-phase system
function eSup(f) { return (is3PSystem() && Number(f.sup || 1) === 3 && bSup(boardOf(f.board)) === 3) ? 3 : 1; }
function itemCurrent(f) {
    const w = f.qty * f.watts;
    return eSup(f) === 3 ? w / (Math.sqrt(3) * config.voltageLL * f.pf) : w / (config.voltageLN * f.pf);
}
function isLowPower(f) { return f.watts <= LOW_POWER_W && f.category !== 'HVAC' && f.category !== 'Motors'; }
function nextCktName(boardId, skip) {
    const used = new Set(fixtures.filter(f => f !== skip && f.board === boardId).map(f => f.ckt));
    let n = 1; while (used.has('CKT-' + n)) n++;
    return 'CKT-' + n;
}
function isDescendant(b, ancestor) {
    let cur = b, guard = 0;
    while (cur && guard++ < 50) { if (cur.par === ancestor.id) return true; cur = boards.find(x => x.id === cur.par); }
    return false;
}

// Allocate fixtures to circuits (auto, per board) or honour manual CKT names
function buildCircuits() {
    fixtures.forEach(f => { if (!boards.some(b => b.id === f.board)) f.board = boards[0].id; });
    fixtures.forEach(f => { if (eSup(f) === 3) f.phase = '3'; else if (f.phase === '3') f.phase = 'R'; });
    let groups = [];
    if (grouping.auto) {
        const cap = COMBINED_MAX_MCB / config.safetyFactor;
        boards.forEach(b => {
            const bf = fixtures.filter(f => f.board === b.id);
            const bg = [];
            if (grouping.rooms && grouping.strategy === 'separate') {
                bf.forEach(f => bg.push([f]));
            } else {
                const buckets = new Map();
                bf.forEach(f => {
                    const k = grouping.rooms ? (f.room || 'General') : 'ALL';
                    if (!buckets.has(k)) buckets.set(k, []);
                    buckets.get(k).push(f);
                });
                buckets.forEach(list => {
                    const bins = [];
                    list.filter(f => isLowPower(f) && eSup(f) === 1).sort((x, y) => itemCurrent(y) - itemCurrent(x)).forEach(f => {
                        const c = itemCurrent(f);
                        let bin = bins.find(bn => bn.sum + c <= cap);
                        if (!bin) { bin = { sum: 0, items: [] }; bins.push(bin); }
                        bin.sum += c; bin.items.push(f);
                    });
                    bins.forEach(bn => bg.push(bn.items));
                    list.filter(f => !(isLowPower(f) && eSup(f) === 1)).forEach(f => bg.push([f]));
                });
            }
            bg.forEach((g, i) => g.forEach(f => f.ckt = 'CKT-' + (i + 1)));
            groups.push(...bg);
        });
    } else {
        fixtures.forEach(f => { if (!f.ckt) f.ckt = nextCktName(f.board, f); });
        const map = new Map();
        fixtures.forEach(f => { const k = f.board + '|' + f.ckt; if (!map.has(k)) map.set(k, []); map.get(k).push(f); });
        map.forEach(g => { if (eSup(g[0]) === 1) g.forEach(f => f.phase = g[0].phase); });
        groups = [...map.values()].sort((a, b) => {
            const d = boards.findIndex(x => x.id === a[0].board) - boards.findIndex(x => x.id === b[0].board);
            return d || a[0].ckt.localeCompare(b[0].ckt, undefined, { numeric: true });
        });
    }
    circuits = groups.map(g => ({
        id: g[0].ckt,
        board: g[0].board,
        sup: eSup(g[0]),
        items: g,
        phase: g[0].phase,
        watts: g.reduce((s, f) => s + f.qty * f.watts, 0),
        current: g.reduce((s, f) => s + itemCurrent(f), 0),
        qty: g.reduce((s, f) => s + f.qty, 0),
        distance: Math.max(...g.map(f => f.distance)),
        rooms: [...new Set(g.map(f => f.room || 'General'))],
        categories: new Set(g.map(f => f.category)),
        mcb: 0
    }));
    rollUp();
}

// Roll loads up the board tree, balancing 1-phase circuits / boards across R-Y-B inside each 3-phase board
function rollUp() {
    const root = boards[0];
    boards.forEach(b => { if (b !== root && !boards.some(p => p !== b && p.id === b.par)) b.par = root.id; });

    function setPhase(o, p, isBoard) {
        if (isBoard) {
            o.e = p;
            circuits.filter(c => c.board === o.id).forEach(c => { c.phase = p; c.items.forEach(f => f.phase = p); });
        } else {
            o.phase = p; o.items.forEach(f => f.phase = p);
        }
    }

    function calc(b) {
        const bs = bSup(b);
        const own = circuits.filter(c => c.board === b.id);
        const kids = boards.filter(k => k !== b && k.par === b.id);
        const A = { R: 0, Y: 0, B: 0 }, K = { R: 0, Y: 0, B: 0 };
        let a1 = 0, kwT = 0;
        const floats = [];

        own.forEach(c => {
            const kw = c.watts / 1000;
            kwT += kw;
            if (bs === 1) { a1 += c.current; return; }
            if (c.sup === 3) { for (const p in A) { A[p] += c.current; K[p] += kw / 3; } c.phase = '3'; }
            else if (!grouping.auto && 'RYB'.includes(c.phase)) { A[c.phase] += c.current; K[c.phase] += kw; }
            else floats.push({ o: c, a: c.current, kw, isBoard: false });
        });
        kids.forEach(k => {
            const s = calc(k);
            kwT += s.kw;
            if (bs !== 3) { a1 += s.a1 || 0; return; }
            if (bSup(k) === 3) { for (const p in A) { A[p] += s.A[p]; K[p] += s.K[p]; } }
            else floats.push({ o: k, a: s.a1, kw: s.kw, isBoard: true });
        });
        floats.sort((x, y) => y.a - x.a).forEach(f => {
            let p = 'R';
            if (A.Y < A[p]) p = 'Y';
            if (A.B < A[p]) p = 'B';
            A[p] += f.a; K[p] += f.kw;
            setPhase(f.o, p, f.isBoard);
        });

        const mx = bs === 3 ? Math.max(A.R, A.Y, A.B) : a1;
        b.s = { A: bs === 3 ? A : null, K: bs === 3 ? K : null, a1, kw: kwT, mx,
                cb: selectBreakerRating(mx * config.safetyFactor) };
        return b.s;
    }

    const rs = calc(root);
    if (bSup(root) === 1) {
        root.e = 'R';
        circuits.filter(c => c.board === root.id).forEach(c => { c.phase = 'R'; c.items.forEach(f => f.phase = 'R'); });
        rs.A = { R: rs.a1, Y: 0, B: 0 };
        rs.K = { R: rs.kw, Y: 0, B: 0 };
    }
    if (!is3PSystem()) {
        // single-phase system: everything sits on the one phase
        boards.forEach(b => b.e = 'R');
        circuits.forEach(c => { c.phase = 'R'; c.items.forEach(f => f.phase = 'R'); });
    }
}
