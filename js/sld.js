/* ElectroLoad Pro | Interactive single-line diagram. SVG <title> elements carry accessible native fallback descriptions. */
let sldZoom = 1;
let sldView = null;
let sldPan = null;

function sldViewport() { return document.getElementById('sldViewport') || document.getElementById('sldSvg')?.parentElement; }
function sldApplyView() {
    const svg = document.getElementById('sldSvg');
    if (svg && sldView) svg.setAttribute('viewBox', [sldView.x, sldView.y, sldView.w, sldView.h].join(' '));
}
function sldPointerToView(clientX, clientY) {
    const svg = document.getElementById('sldSvg');
    if (!svg || !sldView) return null;
    const matrix = svg.getScreenCTM();
    if (!matrix) return null;
    const point = svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    const local = point.matrixTransform(matrix.inverse());
    return { x: local.x, y: local.y, scaleX: matrix.a, scaleY: matrix.d };
}
function changeSldZoom(factor, clientX, clientY) {
    const svg = document.getElementById('sldSvg');
    if (!svg || !sldView) return;
    const rect = svg.getBoundingClientRect();
    const point = sldPointerToView(
        Number.isFinite(clientX) ? clientX : rect.left + rect.width / 2,
        Number.isFinite(clientY) ? clientY : rect.top + rect.height / 2
    );
    if (!point) return;
    const next = Math.max(0.45, Math.min(5, sldZoom * factor));
    const ratio = sldZoom / next;
    sldView = {
        x: point.x - (point.x - sldView.x) * ratio,
        y: point.y - (point.y - sldView.y) * ratio,
        w: sldView.w * ratio,
        h: sldView.h * ratio
    };
    sldZoom = next;
    sldApplyView();
}
function resetSldZoom() {
    const svg = document.getElementById('sldSvg');
    if (!svg) return;
    sldZoom = 1;
    sldView = { x: 0, y: 0, w: Number(svg.dataset.baseWidth), h: Number(svg.dataset.baseHeight) };
    sldApplyView();
}
function fitSldToView() { resetSldZoom(); }

function bindSldNavigation(svg) {
    if (svg.dataset.navigationBound) return;
    svg.dataset.navigationBound = '1';
    const viewport = sldViewport();
    viewport?.addEventListener('wheel', e => {
        e.preventDefault();
        const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * viewport.clientHeight : e.deltaY;
        const factor = Math.exp(-delta * 0.0016);
        changeSldZoom(factor, e.clientX, e.clientY);
    }, { passive: false });

    let drag = null;
    svg.addEventListener('pointerdown', e => {
        if (e.button !== 0) return;
        const rect = svg.getBoundingClientRect();
        drag = {
            pointerId: e.pointerId,
            startX: e.clientX,
            startY: e.clientY,
            viewX: sldView.x,
            viewY: sldView.y,
            scaleX: sldView.w / Math.max(1, rect.width),
            scaleY: sldView.h / Math.max(1, rect.height),
            moved: false
        };
        svg.setPointerCapture?.(e.pointerId);
        svg.classList.add('sld-panning');
    });
    svg.addEventListener('pointermove', e => {
        if (!drag || drag.pointerId !== e.pointerId) return;
        const dx = e.clientX - drag.startX;
        const dy = e.clientY - drag.startY;
        if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
        if (!drag.moved) return;
        svg.dataset.panMoveSeen = String(Number(svg.dataset.panMoveSeen || 0) + 1);
        sldView.x = drag.viewX - dx * drag.scaleX;
        sldView.y = drag.viewY - dy * drag.scaleY;
        sldApplyView();
    });
    const finishDrag = e => {
        if (!drag || (e && drag.pointerId !== e.pointerId)) return;
        drag = null;
        svg.classList.remove('sld-panning');
    };
    svg.addEventListener('pointerup', finishDrag);
    svg.addEventListener('pointercancel', finishDrag);
    svg.addEventListener('lostpointercapture', finishDrag);
}
function renderSLD(mainMccbRating, totalCurrent) {
    const svg = document.getElementById('sldSvg');
    if (!svg) return;
    svg.replaceChildren();
    const NS = 'http://www.w3.org/2000/svg';
    const root = boards[0];
    if (!root) return;
    const children = b => boards.filter(x => x.par === b.id && x !== b);
    const positions = new Map();
    let leaf = 0;
    const maxCircuits = Math.max(1, ...boards.map(b => circuits.filter(c => c.board === b.id).length));
    const step = Math.max(270, maxCircuits * 132 + 150), margin = 180;
    function place(board, depth) {
        const kids = children(board);
        let x;
        if (!kids.length) { x = margin + leaf * step; leaf++; }
        else { const xs = kids.map(k => place(k, depth + 1)); x = (Math.min(...xs) + Math.max(...xs)) / 2; }
        positions.set(board.id, { x, depth });
        return x;
    }
    place(root, 0);
    const depth = Math.max(0, ...[...positions.values()].map(p => p.depth));
    const width = Math.max(1000, margin * 2 + Math.max(0, leaf - 1) * step);
    const height = 250 + (depth + 1) * 300 + 120; // reserve a clear drawing-title-block band
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMin meet');
    svg.dataset.baseWidth = width;
    svg.dataset.baseHeight = height;
    svg.style.width = '100%';
    svg.style.height = '100%';
    sldZoom = 1;
    sldView = { x: 0, y: 0, w: width, h: height };

    const viewport = sldViewport();
    let toolbar = viewport?.querySelector('[data-sld-toolbar]');
    if (!toolbar && viewport) {
        toolbar = document.createElement('div');
        toolbar.dataset.sldToolbar = '1';
        toolbar.className = 'flex flex-wrap items-center gap-2 mb-3';
        toolbar.innerHTML = '<span class="text-xs text-slate-400 mr-auto">Scroll to zoom · drag to pan · hover symbols for details</span><button type="button" class="px-3 py-1 rounded bg-slate-800 text-slate-200 border border-slate-700" data-zoom="out" aria-label="Zoom out">−</button><button type="button" class="px-3 py-1 rounded bg-slate-800 text-slate-200 border border-slate-700" data-zoom="fit">Fit</button><button type="button" class="px-3 py-1 rounded bg-slate-800 text-slate-200 border border-slate-700" data-zoom="in" aria-label="Zoom in">+</button>';
        viewport.insertBefore(toolbar, svg);
        toolbar.addEventListener('click', e => {
            const action = e.target.closest('button')?.dataset.zoom;
            if (action === 'in') changeSldZoom(1.25);
            if (action === 'out') changeSldZoom(1 / 1.25);
            if (action === 'fit') fitSldToView();
        });
    }
    bindSldNavigation(svg);

    let tip = viewport?.querySelector('[data-sld-tooltip]');
    if (!tip && viewport) {
        tip = document.createElement('div');
        tip.dataset.sldTooltip = '1';
        tip.className = 'sld-tooltip';
        tip.setAttribute('role', 'tooltip');
        viewport.appendChild(tip);
    }
    const background = document.createElementNS(NS, 'rect');
    Object.entries({ x: 0, y: 0, width, height, fill: '#071426' }).forEach(([k,v]) => background.setAttribute(k,v));
    background.setAttribute('pointer-events','none');
    svg.appendChild(background);
    const group = document.createElementNS(NS, 'g');
    svg.appendChild(group);
    const colors = { R: '#ef4444', Y: '#fbbf24', B: '#60a5fa', N: '#cbd5e1', PE: '#22c55e' };
    // One delegated tooltip controller prevents nested SVG elements from opening
    // multiple competing cards or hiding the card while crossing child geometry.
    const appendTitle = (el, value) => {
        el.dataset.tip = value;
        el.setAttribute('aria-label', value.replaceAll('\n', ' · '));
        el.classList.add('sld-node');
        el.style.pointerEvents = 'all';
    };
    if (!svg.dataset.tooltipBound) {
        svg.dataset.tooltipBound = '1';
        let activeTipNode = null;
        const moveTip = e => {
            if (!tip || !activeTipNode) return;
            const bounds = viewport.getBoundingClientRect();
            const width = tip.offsetWidth || 290;
            const height = tip.offsetHeight || 80;
            const x = Math.max(8, Math.min(e.clientX - bounds.left + 14, bounds.width - width - 8));
            const y = Math.max(8, Math.min(e.clientY - bounds.top + 14, bounds.height - height - 8));
            tip.style.left = x + 'px';
            tip.style.top = y + 'px';
        };
        svg.addEventListener('pointerover', e => {
            const node = e.target.closest?.('[data-tip]');
            if (!node || !svg.contains(node)) return;
            activeTipNode = node;
            tip.textContent = node.dataset.tip;
            tip.style.display = 'block';
            moveTip(e);
        });
        svg.addEventListener('pointermove', e => {
            if (!activeTipNode) return;
            const node = e.target.closest?.('[data-tip]');
            if (node && svg.contains(node) && node !== activeTipNode) {
                activeTipNode = node;
                tip.textContent = node.dataset.tip;
            }
            moveTip(e);
        });
        svg.addEventListener('pointerout', e => {
            if (!activeTipNode) return;
            const next = e.relatedTarget?.closest?.('[data-tip]');
            if (next && svg.contains(next)) {
                activeTipNode = next;
                tip.textContent = next.dataset.tip;
                return;
            }
            activeTipNode = null;
            tip.style.display = 'none';
        });
    }
    const line = (x1, y1, x2, y2, color = '#64748b', widthPx = 2, dash = false, detail = '') => {
        const el = document.createElementNS(NS, 'line');
        Object.entries({ x1, y1, x2, y2, stroke: color, 'stroke-width': widthPx, 'stroke-linecap': 'round' }).forEach(([k, v]) => el.setAttribute(k, v));
        if (dash) el.setAttribute('stroke-dasharray', '6 5');
        if (detail) { el.style.pointerEvents = 'stroke'; appendTitle(el, detail); }
        group.appendChild(el);
        return el;
    };
    const label = (value, x, y, size = 12, color = '#334155', anchor = 'start', weight = '400') => {
        const el = document.createElementNS(NS, 'text');
        Object.entries({ x, y, 'font-size': size, fill: color, 'text-anchor': anchor, 'font-weight': weight }).forEach(([k, v]) => el.setAttribute(k, v));
        el.textContent = String(value ?? '');
        group.appendChild(el);
        return el;
    };
    const card = (x, y, w, h, heading, sub, detail, accent = '#2563eb') => {
        const g = document.createElementNS(NS, 'g');
        const r = document.createElementNS(NS, 'rect');
        Object.entries({ x, y, width: w, height: h, rx: 10, fill: '#0b1b32', stroke: '#355276', 'stroke-width': 1.5 }).forEach(([k, v]) => r.setAttribute(k, v));
        g.appendChild(r);
        const bar = document.createElementNS(NS, 'rect');
        Object.entries({ x: x + 3, y: y + 8, width: 4, height: h - 16, rx: 2, fill: accent }).forEach(([k, v]) => bar.setAttribute(k, v));
        g.appendChild(bar);
        const head = document.createElementNS(NS, 'text');
        Object.entries({ x: x + 17, y: y + 20, 'font-size': 12, 'font-weight': 700, fill: '#f1f5f9' }).forEach(([k, v]) => head.setAttribute(k, v));
        head.textContent = heading; g.appendChild(head);
        const second = document.createElementNS(NS, 'text');
        Object.entries({ x: x + 17, y: y + 40, 'font-size': 11, fill: '#cbd5e1' }).forEach(([k, v]) => second.setAttribute(k, v));
        second.textContent = sub; g.appendChild(second);
        appendTitle(g, detail);
        group.appendChild(g);
        return g;
    };
    const breaker = (x, y, rating, poles, detail, accent = '#d69e00', kind = 'CB') => {
        const g = document.createElementNS(NS, 'g');
        // IEC-inspired open-contact or ANSI/NEMA-inspired boxed device notation.
        const symbol = document.createElementNS(NS, engineering.sldConvention === 'ANSI' ? 'rect' : 'path');
        if (engineering.sldConvention === 'ANSI') {
            Object.entries({ x: x - 9, y: y - 13, width: 18, height: 26, rx: 2 }).forEach(([k, v]) => symbol.setAttribute(k, v));
        } else {
            symbol.setAttribute('d', `M ${x} ${y - 13} L ${x} ${y - 4} M ${x} ${y + 4} L ${x} ${y + 13} M ${x + 1} ${y - 4} L ${x + 9} ${y - 12} M ${x + 11} ${y - 15} l 5 5 m 0 -5 l -5 5`);
        }
        symbol.setAttribute('stroke', accent); symbol.setAttribute('stroke-width', '2.2'); symbol.setAttribute('stroke-linecap', 'round'); symbol.setAttribute('stroke-linejoin', 'round'); symbol.setAttribute('fill', 'none');
        g.appendChild(symbol);
        const contact = document.createElementNS(NS, 'circle');
        Object.entries({ cx: x, cy: y - 4, r: 2, fill: '#fff', stroke: accent, 'stroke-width': 1.5 }).forEach(([k, v]) => contact.setAttribute(k, v));
        g.appendChild(contact);
        appendTitle(symbol, detail);
        appendTitle(contact, detail);
        const hitArea = document.createElementNS(NS, 'rect');
        Object.entries({ x: x - 15, y: y - 15, width: 30, height: 30, fill: 'transparent', stroke: 'none' }).forEach(([k, v]) => hitArea.setAttribute(k, v));
        hitArea.style.pointerEvents = 'all';
        g.appendChild(hitArea);
        appendTitle(hitArea, detail);
        group.appendChild(g);
        label(kind, x + 23, y - 1, 10, '#cbd5e1', 'start', '700');
        label((rating == null ? 'N/S' : rating + ' A') + ' · ' + (poles === '?' ? 'poles TBD' : poles + 'P'), x + 23, y + 12, 10, '#cbd5e1');
        return g;
    };

    const rootX = positions.get(root.id).x;
    card(rootX - 108, 14, 216, 46, 'Incoming supply', (is3PSystem() ? '3-phase · ' + config.voltageLL : '1-phase · ' + config.voltageLN) + ' V', 'Incoming supply: ' + config.phase + ', ' + (is3PSystem() ? config.voltageLL : config.voltageLN) + ' V', '#2563eb');
    line(rootX, 60, rootX, 78, '#64748b', 2);
    breaker(rootX, 92, mainMccbRating, '?', 'Main incoming circuit breaker · preliminary rating ' + (mainMccbRating == null ? 'not sized' : mainMccbRating + ' A') + ' · estimated incoming current ' + Number(totalCurrent || 0).toFixed(2) + ' A. Confirm actual device type, poles and breaking capacity.', '#0f172a', 'MAIN CB');
    line(rootX, 105, rootX, 138, '#64748b', 2);
    const top = b => 138 + positions.get(b.id).depth * 300;
    const busY = b => top(b) + 105;

    for (const board of boards) {
        const p = positions.get(board.id);
        if (!p) continue;
        const x = p.x, y = top(board), bus = busY(board), three = bSup(board) === 3;
        const own = circuits.filter(c => c.board === board.id), kids = children(board);
        const area = board.room || 'Area not assigned';
        const parentName = board.par ? (boardOf(board.par)?.name || board.par) : 'Incoming supply';
        const boardLoad = Number(board.s?.kw || 0).toFixed(2);
        card(x - 105, y, 210, 58, board.name, (board.type || 'DB') + ' · ' + (three ? '3-phase' : '1-phase') + ' · ' + area,
            'Distribution board: ' + board.name + '\nParent: ' + parentName + '\nSystem: ' + (three ? '3-phase' : '1-phase') + '\nLoad: ' + boardLoad + ' kW\nMaximum current: ' + Number(board.s?.mx || 0).toFixed(2) + ' A\nMain protection estimate: ' + (board.s?.cb == null ? 'NOT SIZED' : board.s.cb + ' A'), '#2563eb');
        line(x, y + 58, x, bus, '#64748b', 2);
        const childXs = kids.map(k => positions.get(k.id).x);
        const circuitStart = kids.length ? Math.min(...childXs) - own.length * 128 - 80 : x - ((own.length - 1) / 2) * 128;
        const taps = own.map((c, i) => circuitStart + i * 128);
        const all = [...taps, ...childXs];
        const left = all.length ? Math.min(x, ...all) - 34 : x - 100;
        const right = all.length ? Math.max(x, ...all) + 34 : x + 100;
        const busDetail = board.name + ' busbar · ' + (three ? 'R/Y/B/N 3-phase' : 'single-phase and neutral') + ' · outgoing circuits: ' + own.length + ' · downstream boards: ' + kids.length;
        if (three) {
            line(left, bus, right, bus, colors.R, 4, false, busDetail + ' · Phase R');
            line(left, bus + 7, right, bus + 7, colors.Y, 4, false, busDetail + ' · Phase Y');
            line(left, bus + 14, right, bus + 14, colors.B, 4, false, busDetail + ' · Phase B');
            line(left, bus + 21, right, bus + 21, colors.N, 1.8, true, busDetail + ' · Neutral (N)');
            line(left, bus + 29, right, bus + 29, colors.PE, 2.2, false, busDetail + ' · Protective earth (PE)');
            line(left, bus + 29, right, bus + 29, '#facc15', 1, true, 'Protective earth (PE) · green/yellow identification');
        } else {
            line(left, bus, right, bus, colors[board.e] || colors.R, 4, false, busDetail + ' · Line');
            line(left, bus + 9, right, bus + 9, colors.N, 1.8, true, busDetail + ' · Neutral (N)');
            line(left, bus + 17, right, bus + 17, colors.PE, 2.2, false, busDetail + ' · Protective earth (PE)');
            line(left, bus + 17, right, bus + 17, '#facc15', 1, true, 'Protective earth (PE) · green/yellow identification');
        }
        label(board.name + ' · ' + (three ? '3Φ' : '1Φ') + ' bus', right + 16, bus + 12, 12, '#cbd5e1');
        // PE bar termination marker (protective-earth terminal, not a claim about the site electrode).
        line(left + 8, bus + (three ? 29 : 17), left + 8, bus + (three ? 38 : 26), colors.PE, 1.8, false, board.name + ' protective-earth (PE) terminal');
        line(left + 2, bus + (three ? 38 : 26), left + 14, bus + (three ? 38 : 26), '#facc15', 1.4, false, 'PE terminal identification');
        line(left + 4, bus + (three ? 41 : 29), left + 12, bus + (three ? 41 : 29), colors.PE, 1.4, false, 'PE terminal identification');
        line(left + 6, bus + (three ? 44 : 32), left + 10, bus + (three ? 44 : 32), '#facc15', 1.4, false, 'PE terminal identification');
        own.forEach((c, i) => {
            const cx = taps[i], current = Number(c.current || 0).toFixed(2);
            const phaseName = c.sup === 3 ? 'R/Y/B' : (['R','Y','B'].includes(c.phase) ? c.phase : (board.e || 'R'));
            if (three && c.sup === 3) {
                [['R',bus],['Y',bus+7],['B',bus+14]].forEach(([ph,sy],idx) => line(cx+(idx-1)*6,sy,cx+(idx-1)*6,bus+42,colors[ph],2.2,false,'Phase '+ph+' conductor from matching busbar to '+c.id));
                line(cx-6,bus+42,cx+6,bus+42,'#e2e8f0',1.4,false,'Three-phase circuit take-off');
            } else {
                const phaseY = three ? bus + ({R:0,Y:7,B:14}[phaseName]) : bus;
                line(cx,phaseY,cx,bus+42,colors[phaseName] || colors.R,2.4,false,'Phase '+phaseName+' conductor physically tapped from matching busbar to '+c.id);
            }
            const neutralY = three ? bus+21 : bus+9, peY = three ? bus+29 : bus+17;
            line(cx+15,neutralY,cx+15,bus+82,colors.N,1.5,true,'Neutral (N) conductor from neutral busbar to '+c.id);
            line(cx+22,peY,cx+22,bus+82,colors.PE,2,false,'Protective earth (PE) conductor from PE bar to '+c.id);
            line(cx+22,peY,cx+22,bus+82,'#facc15',1,true,'Protective earth green/yellow identification');
            const cable = c.wire ? c.wire.size : 'NOT SIZED';
            const vd = Number.isFinite(c.vDropPct) ? c.vDropPct.toFixed(2)+'%' : 'not calculated';
            breaker(cx, bus + 56, c.mcb, c.sup === 3 ? 3 : 1, 'Outgoing final circuit ' + c.id + '\nBoard: ' + board.name + '\nLoads: ' + c.items.map(f => f.name).join(', ') + '\nRooms: ' + c.rooms.join(', ') + '\nLoad: ' + Number(c.watts).toFixed(0) + ' W\nDesign current: ' + current + ' A\nBreaker estimate: ' + (c.mcb == null ? 'NOT SIZED' : c.mcb + ' A') + '\nPhase: ' + phaseName + '\nCable: ' + cable + '\nInstallation reference: ' + (engineering.installationMethod || 'not set') + '\nVoltage-drop estimate: ' + vd + '\nN and PE shown as separate conductors.', '#60a5fa', 'MCB');
            line(cx, bus + 69, cx, bus + 82, '#cbd5e1', 1.5);
            label(c.id, cx, bus + 98, 12, '#e2e8f0', 'middle', '700');
            label(Number(c.watts).toFixed(0) + ' W', cx, bus + 113, 10, '#94a3b8');
        });
        kids.forEach(child => {
            const cx = positions.get(child.id).x, childTop = top(child);
            const feederY = bus + (three ? 29 : 17);
            const isThreePhaseFeeder = bSup(child) === 3;
            const phasePick = ['R','Y','B'].includes(child.e) ? child.e : 'R';
            if (three && isThreePhaseFeeder) {
                // Three distinct phase take-offs touch their matching R/Y/B busbars.
                [['R', bus], ['Y', bus + 7], ['B', bus + 14]].forEach(([ph, sy], idx) => {
                    const px = cx + (idx - 1) * 7;
                    line(px, sy, px, bus + 42, colors[ph], 2.4, false, 'Phase ' + ph + ' feeder conductor from ' + board.name + ' busbar to ' + child.name);
                });
                line(cx - 7, bus + 42, cx + 7, bus + 42, '#e2e8f0', 1.5, false, 'Three-phase feeder take-off to 3-pole protective device');
            } else {
                const sourceY = three ? bus + ({R:0,Y:7,B:14}[phasePick]) : bus;
                const sourceColor = three ? colors[phasePick] : (colors[board.e] || colors.R);
                line(cx, sourceY, cx, bus + 42, sourceColor, 2.6, false, 'Phase ' + phasePick + ' feeder conductor physically tapped from matching busbar');
            }
            const nSourceY = three ? bus + 21 : bus + 9;
            const peSourceY = three ? bus + 29 : bus + 17;
            line(cx + 17, nSourceY, cx + 17, childTop + 4, colors.N, 1.8, true, 'Neutral (N) feeder conductor from neutral busbar to ' + child.name);
            line(cx + 25, peSourceY, cx + 25, childTop + 4, colors.PE, 2.2, false, 'Protective earth (PE) conductor from PE bar to ' + child.name);
            line(cx + 25, peSourceY, cx + 25, childTop + 4, '#facc15', 1, true, 'Protective earth (PE) green/yellow identification');
            breaker(cx, bus + 54, child.s?.cb, isThreePhaseFeeder ? 3 : 1,
                'Outgoing feeder circuit-breaker · preliminary estimate\nFrom: ' + board.name + '\nTo: ' + child.name + '\nSource phase: ' + (isThreePhaseFeeder ? 'R/Y/B' : phasePick) + '\nNeutral: separate N conductor\nProtective earth: separate PE conductor\nDownstream system: ' + (isThreePhaseFeeder ? '3-phase' : '1-phase') + '\nDesign current: ' + Number(child.s?.mx || 0).toFixed(2) + ' A\nPreliminary rating: ' + (child.s?.cb == null ? 'NOT SIZED' : child.s.cb + ' A') + '\nCable data, fault level, device breaking capacity and selectivity require project design verification.',
                '#f59e0b', 'FEEDER CB');
            line(cx, bus + 67, cx, childTop, '#cbd5e1', 2.2, false, 'Feeder cable route from ' + board.name + ' to ' + child.name + ' · phase conductors shown separately at source');
        });
    }
    label('CONCEPTUAL SLD · VERIFY CABLE ROUTING, PROTECTION, FAULT LEVEL AND CODE COMPLIANCE BEFORE CONSTRUCTION', 16, height - 16, 10, '#fbbf24');
    const tbx=width-320, tby=height-86;
    const titleBlock=document.createElementNS(NS,'rect');
    Object.entries({x:tbx,y:tby,width:300,height:64,rx:4,fill:'#0b1b32',stroke:'#64748b','stroke-width':1}).forEach(([k,v])=>titleBlock.setAttribute(k,v)); group.appendChild(titleBlock);
    label('ELECTROLOAD PRO · SINGLE-LINE DIAGRAM',tbx+10,tby+17,10,'#f8fafc','start','700');
    label('System: '+config.phase+' · '+(is3PSystem()?config.voltageLL:config.voltageLN)+' V · '+config.frequency+' Hz',tbx+10,tby+33,9,'#cbd5e1');
    label('Convention: '+(engineering.sldConvention==='ANSI'?'ANSI/NEMA-inspired':'IEC-inspired')+' · Rev 0 · '+new Date().toISOString().slice(0,10),tbx+10,tby+49,9,'#cbd5e1');
    sldApplyView();
}
