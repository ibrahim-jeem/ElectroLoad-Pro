/* ElectroLoad Pro workspace modules: project management, DB schedules and SLD release controls. */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const safe = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const PROJECTS_KEY = 'elpro_projects_v1';
  let activeProjectId = 'default';
  let baseSaveProject = null;

  function projectMeta() {
    return {
      id: activeProjectId,
      name: $('projectName')?.value.trim() || 'Untitled Project',
      client: $('projectClient')?.value.trim() || '',
      location: $('projectLocation')?.value.trim() || '',
      designer: $('projectDesigner')?.value.trim() || '',
      drawingNo: $('projectDrawingNo')?.value.trim() || '',
      revision: $('projectRevision')?.value.trim() || 'A',
      updatedAt: new Date().toISOString()
    };
  }
  function readProjects() {
    try { const x = JSON.parse(localStorage.getItem(PROJECTS_KEY) || '[]'); return Array.isArray(x) ? x : []; }
    catch (_) { return []; }
  }
  function writeProjects(items) {
    try { localStorage.setItem(PROJECTS_KEY, JSON.stringify(items)); return true; }
    catch (e) { setStatus('Project library storage is full/unavailable. Export a backup.'); return false; }
  }
  function currentSnapshot() {
    return {
      format: 'ElectroLoadProProject', version: 1, meta: projectMeta(),
      project: {
        config, engineering, grouping, fixtures,
        boards: boards.map(b => ({id:b.id,name:b.name,type:b.type,room:b.room||'General',par:b.par,sup:b.sup,dist:b.dist}))
      }
    };
  }
  function setStatus(message, bad=false) {
    const el=$('projectManagerStatus'); if(el){el.textContent=message;el.classList.toggle('text-rose-300',bad);el.classList.toggle('text-emerald-300',!bad);}
  }
  function refreshProjectPicker() {
    const picker=$('projectPicker'); if(!picker)return;
    const projects=readProjects();
    const current=projects.find(p=>p.meta?.id==='default');
    picker.innerHTML='<option value="default">'+safe(current?.meta?.name||'Current working project')+'</option>'+projects.filter(p=>p.meta?.id!=='default').map(p=>'<option value="'+safe(p.meta?.id)+'">'+safe(p.meta?.name||'Untitled')+'</option>').join('');
    picker.value=activeProjectId;
  }
  function saveNamedProject() {
    const meta=projectMeta();
    if(!meta.name){setStatus('Enter a project name before saving.',true);return;}
    const snapshot=currentSnapshot();
    const items=readProjects().filter(p=>p.meta?.id!==activeProjectId);
    items.unshift(snapshot);
    if(!writeProjects(items))return;
    if(typeof baseSaveProject==='function')baseSaveProject();
    refreshProjectPicker();
    setStatus('Saved locally · '+new Date().toLocaleTimeString());
  }
  function applySnapshot(snapshot) {
    if(!snapshot || snapshot.format!=='ElectroLoadProProject' || snapshot.version!==1 || !snapshot.project) throw new Error('Unsupported or invalid ElectroLoad Pro project file.');
    const p=snapshot.project;
    if(!Array.isArray(p.fixtures)||!Array.isArray(p.boards)||!p.boards.length||!p.config||!p.grouping) throw new Error('Project data is incomplete.');
    const old={config,engineering,grouping,fixtures,boards};
    try {
      config={...config,...p.config}; engineering={...engineering,...(p.engineering||{})}; grouping={...grouping,...p.grouping};
      fixtures=p.fixtures.map(f=>({...f})); boards=p.boards.map(b=>({...b}));
      const error=validateBoardHierarchy(); if(error)throw new Error(error);
      const m=snapshot.meta||{};
      activeProjectId=m.id||'default';
      [['projectName',m.name],['projectClient',m.client],['projectLocation',m.location],['projectDesigner',m.designer],['projectDrawingNo',m.drawingNo],['projectRevision',m.revision]].forEach(([id,v])=>{if($(id))$(id).value=v||'';});
      const set=(id,v)=>{if($(id)&&v!==undefined)$(id).value=String(v);};
      set('projectTypeSelect',config.projectType);set('standardSelect',config.standard);set('systemPhaseSelect',config.phase);set('freqSelect',config.frequency);set('wireUnitSelect',config.wireUnit);set('safetyFactorSelect',config.safetyFactor);
      set('sldConvention',engineering.sldConvention||'IEC');set('sourceFaultKA',engineering.sourceFaultKA??'');set('mainBreakerIcuKA',engineering.mainBreakerIcuKA??'');
      renderFixtureTable();renderBoardTable();updateConfig();updateGrouping();if(typeof updateEngineering==='function')updateEngineering();
      if(typeof initCableSizingUI==='function')initCableSizingUI();
      saveProject();refreshProjectPicker();setStatus('Project loaded · '+(m.name||'Untitled'));
    } catch(e) { config=old.config;engineering=old.engineering;grouping=old.grouping;fixtures=old.fixtures;boards=old.boards;throw e; }
  }
  function loadNamedProject(id) {
    const p=readProjects().find(x=>x.meta?.id===id);
    if(!p)return;
    try{applySnapshot(p);}catch(e){setStatus('Load failed: '+e.message,true);refreshProjectPicker();}
  }
  function exportProjectJSON() {
    const blob=new Blob([JSON.stringify(currentSnapshot(),null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=(projectMeta().name||'ElectroLoad_Project').replace(/[^a-z0-9-_]+/gi,'_')+'.elpro.json';
    document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    setStatus('Project backup exported.');
  }
  function importProjectJSON(file) {
    if(!file)return;
    const reader=new FileReader();
    reader.onload=()=>{try{const snapshot=JSON.parse(reader.result);applySnapshot(snapshot);saveNamedProject();setStatus('Project imported and saved locally.');}catch(e){setStatus('Import failed: '+e.message,true);}};
    reader.onerror=()=>setStatus('Could not read the selected project file.',true);
    reader.readAsText(file);
  }
  function renderDBSchedule() {
    const body=$('dbScheduleBody'); if(!body || !Array.isArray(boards))return;
    body.innerHTML='';
    boards.forEach((board,index)=>{
      const st=board.s||{};
      const own=circuits.filter(c=>c.board===board.id);
      const rows=own.length?own:[null];
      rows.forEach(c=>{
        const tr=document.createElement('tr');
        const status=c?(c.cableV2?.valid?(c.cableV2.status||'REVIEW'):('BLOCKED · '+(c.cableV2?.message||'Sizing unavailable'))):'No outgoing circuits';
        const phase=c?(c.sup===3?'3Φ':(c.phase||c.items?.[0]?.phase||'—')):'—';
        tr.innerHTML='<td>'+safe(board.name)+'</td><td>'+safe(index===0?'SOURCE':board.type)+'</td><td>'+safe(c?.id||'—')+'</td><td>'+safe(c?.items?.map(x=>x.name).join(', ')||'—')+'</td><td>'+phase+'</td><td class="font-mono">'+(c?Number(c.watts||0).toFixed(0)+' W':'—')+'</td><td class="font-mono">'+(c?Number(c.current||0).toFixed(2)+' A':'—')+'</td><td class="font-mono">'+(c&&c.mcb!=null?c.mcb+' A':'NOT SIZED')+'</td><td class="font-mono">'+safe(c?.wire?.size||'NOT SIZED')+'</td><td class="font-mono">'+(Number.isFinite(c?.vDropPct)?c.vDropPct.toFixed(2)+'%':'—')+'</td><td><span class="text-xs '+(c?.cableV2?.valid?'text-amber-300':'text-rose-300')+'">'+safe(status)+'</span></td>';
        body.appendChild(tr);
      });
      const feeder=st.feederWire?.size||'NOT SIZED';
      const summary=document.createElement('tr');summary.className='bg-slate-800/40 font-semibold';
      summary.innerHTML='<td colspan="5">FEEDER · '+safe(board.name)+' ← '+safe(index===0?'UTILITY / TRANSFORMER':(boards.find(x=>x.id===board.par)?.name||'INVALID PARENT'))+'</td><td>'+Number(st.kw||0).toFixed(2)+' kW</td><td>'+Number(st.mx||0).toFixed(2)+' A</td><td>'+(st.cb==null?'NOT SIZED':st.cb+' A')+'</td><td>'+safe(feeder)+'</td><td>'+(Number.isFinite(st.feederVdropPct)?st.feederVdropPct.toFixed(2)+'%':'—')+'</td><td class="text-slate-400">Feeder check · verify source data</td>';
      body.appendChild(summary);
    });
    const count=$('dbScheduleCount');if(count)count.textContent=boards.length+' boards · '+circuits.length+' circuits';
  }
  function renderProjectChecks() {
    const box=$('projectReadinessChecks');if(!box)return;
    const checks=[
      ['Project name',!!$('projectName')?.value.trim(),'Add a project name'],
      ['Client / location',!!$('projectClient')?.value.trim()&&!!$('projectLocation')?.value.trim(),'Enter client and site location'],
      ['Load schedule',fixtures.length>0,'Add at least one load'],
      ['Board hierarchy',!validateBoardHierarchy(),'Fix board parent / supply / cycle errors'],
      ['Cable sizing',circuits.length>0&&circuits.every(c=>c.cableV2?.valid),'Resolve unsupported or blocked cable checks'],
      ['Source fault level & breaker Icu',Number(engineering.sourceFaultKA)>0&&Number(engineering.mainBreakerIcuKA)>0,'Enter verified short-circuit study and breaker datasheet values'],
      ['Earthing / ADS',false,'Verify loop impedance, protective device trip time and disconnection requirements externally'],
      ['Protection coordination',false,'Verify manufacturer curves and selectivity tables externally']
    ];
    box.innerHTML=checks.map(([label,ok,hint])=>'<div class="flex items-start gap-2 rounded-lg border '+(ok?'border-emerald-800 bg-emerald-950/20':'border-slate-800 bg-slate-950/60')+' p-2"><span class="'+(ok?'text-emerald-400':'text-amber-300')+'">'+(ok?'✓':'!')+'</span><span><strong class="text-slate-200">'+label+'</strong><small class="block text-slate-500">'+(ok?'Recorded / passed in app':hint)+'</small></span></div>').join('');
  }
  function hookSldTitleBlock() {
    if(typeof window.renderSLD!=='function'||window.renderSLD.__titleBlockWrapped)return;
    const original=window.renderSLD;
    const wrapped=function(){const result=original.apply(this,arguments);const svg=$('sldSvg');if(!svg)return result;
      svg.querySelector('[data-sld-title-block]')?.remove();
      const w=Number(svg.dataset.baseWidth||1000),h=Number(svg.dataset.baseHeight||800),ns='http://www.w3.org/2000/svg';
      const g=document.createElementNS(ns,'g');g.dataset.sldTitleBlock='1';
      const rect=document.createElementNS(ns,'rect');[['x',w-340],['y',h-112],['width',320],['height',94],['rx',6],['fill','#0b1b32'],['stroke','#5b789d'],['stroke-width',1.5]].forEach(([k,v])=>rect.setAttribute(k,v));g.appendChild(rect);
      const meta=projectMeta();
      const lines=[
        [meta.name||'UNTITLED PROJECT',w-326,h-87,15,'#f8fafc','700'],
        ['CLIENT: '+(meta.client||'—'),w-326,h-67,10,'#cbd5e1','500'],
        ['DRAWING: '+(meta.drawingNo||'ELP-SLD-001')+'   REV: '+(meta.revision||'A'),w-326,h-49,10,'#cbd5e1','500'],
        ['PREPARED: '+(meta.designer||'—')+'   '+new Date().toISOString().slice(0,10),w-326,h-31,9,'#94a3b8','500']
      ];
      lines.forEach(([value,x,y,size,color,weight])=>{const t=document.createElementNS(ns,'text');[['x',x],['y',y],['font-size',size],['fill',color],['font-weight',weight]].forEach(([k,v])=>t.setAttribute(k,v));t.textContent=value;g.appendChild(t);});
      svg.appendChild(g);return result;};
    wrapped.__titleBlockWrapped=true;window.renderSLD=wrapped;
  }
  function hookRecalculation() {
    if(typeof window.recalculateAll!=='function'||window.recalculateAll.__workspaceWrapped)return;
    const original=window.recalculateAll;
    const wrapped=function(){const result=original.apply(this,arguments);renderDBSchedule();renderProjectChecks();return result;};
    wrapped.__workspaceWrapped=true;window.recalculateAll=wrapped;
  }
  function buildAdvancedPanel() {
    const advanced=$('advancedPanel');if(!advanced)return;
    ['boardHierarchySection','cableSizingSection','sldEngineeringInputs','sldEngineeringStatus'].forEach(id=>{
      const el=$(id);if(el && !advanced.contains(el))advanced.appendChild(el);
    });
    const cable=$('cableSizingSection');
    if(cable){cable.classList.add('workspace-advanced-card');}
  }
  function init() {
    baseSaveProject=window.saveProject;
    if(baseSaveProject){
      window.saveProject=function(){const ok=baseSaveProject.apply(this,arguments);if(ok){const m=projectMeta();const items=readProjects();const i=items.findIndex(p=>p.meta?.id===activeProjectId);if(i>=0){items[i]=currentSnapshot();writeProjects(items);setStatus('Autosaved locally · '+new Date().toLocaleTimeString());}else if(m.name&&m.name!=='Untitled Project'){items.unshift(currentSnapshot());writeProjects(items);refreshProjectPicker();setStatus('Autosaved locally · '+new Date().toLocaleTimeString());}else{setStatus('Working copy autosaved in this browser');}}return ok;};
    }
    buildAdvancedPanel();
    hookRecalculation();
    const picker=$('projectPicker');picker?.addEventListener('change',()=>loadNamedProject(picker.value));
    $('projectSaveBtn')?.addEventListener('click',saveNamedProject);
    $('projectExportBtn')?.addEventListener('click',exportProjectJSON);
    $('projectImportInput')?.addEventListener('change',e=>{importProjectJSON(e.target.files?.[0]);e.target.value='';});
    ['projectName','projectClient','projectLocation','projectDesigner','projectDrawingNo','projectRevision'].forEach(id=>$(id)?.addEventListener('change',()=>{if(activeProjectId!=='default')saveNamedProject();if(typeof window.renderSLD==='function')recalculateAll();}));
    $('projectNewBtn')?.addEventListener('click',()=>{
      if(!confirm('Start a new blank project? Export or save the current project first.'))return;
      activeProjectId='project-'+Date.now();
      fixtures=[];boards=[{id:'b0',name:'MDB',type:'MDB',room:'Main',par:'',sup:3,dist:0}];
      ['projectName','projectClient','projectLocation','projectDrawingNo'].forEach(id=>{if($(id))$(id).value='';});
      if($('projectName'))$('projectName').value='New Project';
      renderFixtureTable();renderBoardTable();recalculateAll();saveNamedProject();
    });
    $('advancedToggle')?.addEventListener('change',e=>{
      const open=e.target.checked;const panel=$('advancedPanel');
      if(panel)panel.hidden=!open;
      e.target.setAttribute('aria-expanded',String(open));
    });
    refreshProjectPicker();
    const active=readProjects().find(p=>p.meta?.id===activeProjectId);
    if(active?.meta){[['projectName',active.meta.name],['projectClient',active.meta.client],['projectLocation',active.meta.location],['projectDesigner',active.meta.designer],['projectDrawingNo',active.meta.drawingNo],['projectRevision',active.meta.revision]].forEach(([id,v])=>{if($(id))$(id).value=v||'';});}
    if($('projectName')&&!$('projectName').value)$('projectName').value='Untitled Project';
    hookSldTitleBlock();hookRecalculation();recalculateAll();
  }
  window.addEventListener('DOMContentLoaded',init);
  window.renderDBSchedule=renderDBSchedule;
})();