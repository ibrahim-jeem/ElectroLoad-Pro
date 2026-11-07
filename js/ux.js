/* ElectroLoad Pro — compact hierarchy and room-based editing UX */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const safe = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function enableRoomBlocks() {
    const oldRender = window.renderFixtureTable;
    if (typeof oldRender !== 'function' || oldRender.__roomBlocks) return;
    const wrapped = function () {
      oldRender.apply(this, arguments);
      const source = $('fixtureTableBody');
      const host = $('fixtureRoomGroups');
      if (!source || !host) return;
      const rows = Array.from(source.querySelectorAll('tr'));
      const groups = new Map();
      fixtures.forEach((fixture, index) => {
        const room = String(fixture.room || 'General').trim() || 'General';
        const key = fixture.board + '|' + room;
        if (!groups.has(key)) groups.set(key, { room: room, board: fixture.board, rows: [], watts: 0 });
        groups.get(key).rows.push(rows[index]);
        groups.get(key).watts += Number(fixture.qty || 0) * Number(fixture.watts || 0);
      });
      host.innerHTML = '';
      if (!groups.size) {
        host.innerHTML = '<div class="fixture-empty">No fixtures yet. Add an item or choose a preset to start a room schedule.</div>';
        return;
      }
      Array.from(groups.values()).forEach((group, index) => {
        const board = boards.find(b => b.id === group.board);
        const details = document.createElement('details');
        details.className = 'fixture-room-card';
        if (index === 0) details.open = true;
        const summary = document.createElement('summary');
        summary.className = 'fixture-room-summary';
        summary.innerHTML = '<span><strong>' + safe(group.room) + '</strong><small>' + safe(board ? board.name : 'Unassigned board') + ' · ' + group.rows.length + ' fixture line(s)</small></span><span class="fixture-room-total">' + (group.watts / 1000).toFixed(2) + ' kW <i class="fa-solid fa-chevron-down"></i></span>';
        details.appendChild(summary);
        const tableWrap = document.createElement('div');
        tableWrap.className = 'overflow-x-auto fixture-room-table-wrap';
        const table = document.createElement('table');
        table.className = 'w-full min-w-[1180px] text-left border-collapse text-xs';
        const originalTable = source.closest('table');
        table.appendChild(originalTable.querySelector('thead').cloneNode(true));
        const body = document.createElement('tbody');
        body.className = 'divide-y divide-slate-800/60 font-sans';
        group.rows.forEach(row => { if (row) body.appendChild(row); });
        table.appendChild(body);
        tableWrap.appendChild(table);
        details.appendChild(tableWrap);
        host.appendChild(details);
      });
      source.closest('.overflow-x-auto').hidden = true;
    };
    wrapped.__roomBlocks = true;
    window.renderFixtureTable = wrapped;
  }

  function drawTree() {
    const host = $('boardHierarchyTree');
    if (!host || !Array.isArray(boards) || !boards.length) return;
    const children = id => boards.filter(b => b.par === id);
    const node = (b, path) => {
      if (path.has(b.id)) return '';
      const next = new Set(path); next.add(b.id);
      const s = b.s || {};
      const parent = boards.find(x => x.id === b.par);
      const phase = bSup(b) === 3 && s.A ? 'R ' + s.A.R.toFixed(1) + ' · Y ' + s.A.Y.toFixed(1) + ' · B ' + s.A.B.toFixed(1) + ' A' : Number(s.mx || 0).toFixed(1) + ' A';
      const info = [b.name, 'Type: ' + b.type, 'Fed from: ' + (parent ? parent.name : 'Utility / Transformer'), 'Supply: ' + (bSup(b) === 3 ? '3-phase' : '1-phase'), 'Area: ' + (b.room || 'General'), 'Load: ' + Number(s.kw || 0).toFixed(2) + ' kW', 'Current: ' + phase, 'Breaker: ' + (s.cb == null ? 'NOT SIZED' : s.cb + ' A'), 'Feeder cable: ' + (s.feederWire ? s.feederWire.size : 'NOT SIZED'), 'Voltage drop: ' + (Number.isFinite(s.feederVdropPct) ? s.feederVdropPct.toFixed(2) + '%' : '—')].join('\n');
      const kids = children(b.id);
      return '<li class="board-tree-item"><div class="board-tree-node" draggable="' + (b.id !== boards[0].id) + '" data-board-id="' + safe(b.id) + '" title="' + safe(info) + '" tabindex="0"><span class="board-tree-grip">⠿</span><span class="board-tree-main"><strong>' + safe(b.name) + '</strong><small>' + safe(b.type) + ' · ' + Number(s.kw || 0).toFixed(2) + ' kW · ' + safe(phase) + '</small><small class="board-tree-feed">↳ ' + safe(parent ? parent.name : 'Utility / Transformer') + '</small></span><span class="board-tree-rating">' + (s.cb == null ? '—' : s.cb + 'A') + '</span></div>' + (kids.length ? '<ul class="board-tree-children">' + kids.map(k => node(k, next)).join('') + '</ul>' : '') + '</li>';
    };
    host.innerHTML = '<div class="board-tree-hint"><span><i class="fa-solid fa-circle-info"></i> Drag a board onto its new parent to change the feeder. Hover for board details.</span><span>' + boards.length + ' boards · ' + (boards.length - 1) + ' feeder links</span></div><ul class="board-tree-root">' + node(boards[0], new Set()) + '</ul>';
  }

  function organisePage() {
    const hierarchy = $('boardHierarchySection');
    const fixture = document.querySelector('#fixtureRoomGroups')?.closest('section');
    const advanced = $('advancedPanel');
    if (!hierarchy || !advanced || !fixture) return;
    // Give the calculated branch schedule a stable hook so it lives with the other advanced schedules.
    const calculatedHeading = Array.from(document.querySelectorAll('main h2')).find(h => h.textContent.includes('Auto-Calculated Breaker'));
    if (calculatedHeading) calculatedHeading.closest('section').id = 'calculatedEngineeringSection';
    // The phase monitor becomes a compact KPI companion rather than a standalone page section.
    const phaseSection = Array.from(document.querySelectorAll('main > section')).find(s => s.querySelector('#phaseR_stats'));
    const kpiSection = Array.from(document.querySelectorAll('main > section')).find(s => s.querySelector('#totalKwVal'));
    if (phaseSection && kpiSection && !phaseSection.dataset.compacted) {
      const strip = document.createElement('div');
      strip.className = 'phase-monitor-strip col-span-2 md:col-span-4 lg:col-span-6';
      strip.dataset.compacted = '1';
      while (phaseSection.firstChild) strip.appendChild(phaseSection.firstChild);
      phaseSection.replaceWith(strip);
      kpiSection.insertBefore(strip, kpiSection.firstChild);
    }
    if (!$('boardHierarchyTree')) {
      const treeHost = document.createElement('div');
      treeHost.id = 'boardHierarchyTree';
      treeHost.className = 'board-tree-wrap';
      treeHost.setAttribute('aria-label', 'Distribution board feeding hierarchy');
      const sectionTable = hierarchy.querySelector('.overflow-x-auto');
      hierarchy.insertBefore(treeHost, sectionTable || null);
    }
    // Keep the visual hierarchy in the main flow; keep its manual table in Advanced.
    if (hierarchy.parentElement === advanced) fixture.parentElement.insertBefore(hierarchy, fixture);
    const editor = $('boardTableBody')?.closest('.overflow-x-auto');
    if (editor && editor.parentElement !== advanced) {
      editor.id = 'boardAdvancedEditor';
      editor.hidden = true;
      advanced.appendChild(editor);
    }
    const tree = $('boardHierarchyTree');
    if (tree && !tree.dataset.ready) {
      tree.dataset.ready = '1';
      const dragState = { id: null };
      tree.addEventListener('dragstart', e => {
        const el = e.target.closest('[data-board-id]');
        if (!el || el.dataset.boardId === boards[0].id) return;
        dragState.id = el.dataset.boardId;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', dragState.id);
        el.classList.add('is-dragging');
      });
      tree.addEventListener('dragend', e => {
        e.target.closest('[data-board-id]')?.classList.remove('is-dragging');
        tree.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target'));
        dragState.id = null;
      });
      tree.addEventListener('dragover', e => {
        const el = e.target.closest('[data-board-id]');
        if (!el || !dragState.id || el.dataset.boardId === dragState.id) return;
        e.preventDefault();
        tree.querySelectorAll('.drop-target').forEach(x => x.classList.remove('drop-target'));
        el.classList.add('drop-target');
        e.dataTransfer.dropEffect = 'move';
      });
      tree.addEventListener('drop', e => {
        const el = e.target.closest('[data-board-id]');
        if (!el || !dragState.id) return;
        e.preventDefault();
        const child = boards.find(b => b.id === dragState.id);
        const parent = boards.find(b => b.id === el.dataset.boardId);
        if (child && parent && child !== parent) updateBoard(child.id, 'par', parent.id);
      });
    }
    const heading = hierarchy.querySelector('h2');
    if (heading) heading.innerHTML = '<i class="fa-solid fa-sitemap text-amber-400"></i> Distribution Board Hierarchy';
    const description = hierarchy.querySelector('p');
    if (description) description.textContent = 'Visualise the power path. Drag and drop boards to change which board feeds another.';
    const buttons = hierarchy.querySelector('.flex.flex-wrap.items-center.justify-between');
    if (buttons && !buttons.querySelector('[data-board-advanced]')) {
      const advancedButton = document.createElement('button');
      advancedButton.type = 'button';
      advancedButton.dataset.boardAdvanced = '1';
      advancedButton.className = 'workspace-btn';
      advancedButton.innerHTML = '<i class="fa-solid fa-sliders mr-1"></i> Advanced';
      advancedButton.addEventListener('click', () => {
        const toggle = $('advancedToggle');
        if (toggle) { toggle.checked = true; toggle.setAttribute('aria-expanded', 'true'); }
        advanced.hidden = false;
        const edit = $('boardAdvancedEditor');
        if (edit) edit.hidden = false;
        edit?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      buttons.insertBefore(advancedButton, buttons.firstChild);
    }
    // Keep the engineering schedules together in the Advanced area.
    ['calculatedEngineeringSection','dbScheduleSection','cableSizingSection','sldEngineeringInputs','sldEngineeringStatus','groupingControls','breakerMarginControl'].forEach(id => {
      const el = $(id);
      if (el && el.parentElement !== advanced) advanced.appendChild(el);
    });
    const checklist = $('projectReviewSection') || document.querySelector('section:has(#projectReadinessChecks)');
    const advancedSection = $('advancedEngineeringSection');
    if (checklist && advancedSection) advancedSection.insertAdjacentElement('afterend', checklist);
    if (checklist) {
      checklist.classList.remove('no-print');
      checklist.id = 'projectReviewSection';
      const title = checklist.querySelector('h2');
      if (title) title.innerHTML = '<i class="fa-solid fa-clipboard-check text-amber-400 mr-2"></i>Final Engineer Check';
      const note = checklist.querySelector('p');
      if (note) note.textContent = 'Resolve missing inputs and complete independent engineering verification before issuing the design.';
    }
  }

  function install() {
    enableRoomBlocks();
    const originalUpdateFixture = window.updateFixture;
    if (typeof originalUpdateFixture === 'function' && !originalUpdateFixture.__roomRefresh) {
      const wrappedUpdate = function () {
        const result = originalUpdateFixture.apply(this, arguments);
        window.renderFixtureTable();
        return result;
      };
      wrappedUpdate.__roomRefresh = true;
      window.updateFixture = wrappedUpdate;
    }
    const oldRecalc = window.recalculateAll;
    if (typeof oldRecalc === 'function' && !oldRecalc.__uxWrapped) {
      const wrapped = function () {
        const result = oldRecalc.apply(this, arguments);
        drawTree();
        return result;
      };
      wrapped.__uxWrapped = true;
      window.recalculateAll = wrapped;
    }
    organisePage();
    if (typeof window.renderFixtureTable === 'function') window.renderFixtureTable();
    if (typeof window.renderBoardTable === 'function') window.renderBoardTable();
    drawTree();
    const toggle = $('advancedToggle');
    toggle?.addEventListener('change', () => {
      const editor = $('boardAdvancedEditor');
      if (editor) editor.hidden = !toggle.checked;
    });
    const originalRenderBoards = window.renderBoardTable;
    if (typeof originalRenderBoards === 'function' && !originalRenderBoards.__treeWrapped) {
      const wrapped = function () { const r = originalRenderBoards.apply(this, arguments); drawTree(); return r; };
      wrapped.__treeWrapped = true;
      window.renderBoardTable = wrapped;
    }
  }
  window.addEventListener('DOMContentLoaded', install);
})();
