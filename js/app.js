/* ElectroLoad Pro | app.js */
function saveProject() {
    try {
        const snapshot={version:2,savedAt:new Date().toISOString(),config,grouping,fixtures,boards:boards.map(b=>({id:b.id,name:b.name,type:b.type,room:b.room||'General',par:b.par,sup:b.sup,dist:b.dist}))};
        localStorage.setItem('elpro_project_v2',JSON.stringify(snapshot));
        localStorage.setItem('elpro_project_v1',JSON.stringify(snapshot));
        const status=document.getElementById('projectSaveStatus');
        if(status)status.textContent='Saved locally';
        return true;
    } catch(error) {
        console.error('Project save failed:',error);
        const status=document.getElementById('projectSaveStatus');
        if(status)status.textContent='Save failed — browser storage unavailable/full';
        return false;
    }
}
function loadProject() {
    try {
        const raw=localStorage.getItem('elpro_project_v2')||localStorage.getItem('elpro_project_v1');
        if(!raw)return false;
        const saved=JSON.parse(raw);
        if(!saved||![1,2].includes(saved.version)||!Array.isArray(saved.fixtures)||!Array.isArray(saved.boards)||!saved.boards.length||!saved.config||!saved.grouping||saved.boards[0].par)throw new Error('Saved project format is invalid.');
        if(new Set(saved.boards.map(b=>b.id)).size!==saved.boards.length)throw new Error('Saved project has duplicate board IDs.');
        config={...config,...saved.config};grouping={...grouping,...saved.grouping};
        fixtures=saved.fixtures.map(f=>({...f,room:f.room||'General'}));
        boards=saved.boards.map(b=>({...b,room:b.room||'General'}));
        const error=validateBoardHierarchy();
        if(error)throw new Error(error);
        return true;
    } catch(error) {
        console.error('Project restore failed:',error);
        const status=document.getElementById('projectSaveStatus');
        if(status)status.textContent='Saved project could not be restored: '+error.message;
        return false;
    }
}
window.addEventListener('DOMContentLoaded',()=>{
    loadProject();
    const setValue=(id,value)=>{const el=document.getElementById(id);if(el)el.value=String(value);};
    setValue('standardSelect',config.standard);setValue('systemPhaseSelect',config.phase);
    setValue('freqSelect',config.frequency);setValue('wireUnitSelect',config.wireUnit);setValue('safetyFactorSelect',config.safetyFactor);
    document.getElementById('autoGroupToggle').checked=!!grouping.auto;
    document.getElementById('roomConsolidateToggle').checked=!!grouping.rooms;
    setValue('roomStrategySelect',grouping.strategy);
    updateConfig();updateGrouping();renderBoardTable();saveProject();
    // Inline handlers update the data before the bubbling event reaches this listener.
    document.addEventListener('change',()=>saveProject());
    document.addEventListener('click',event=>{
        if(event.target.closest('button'))saveProject();
    });
});
function openPresetModal(){renderPresetModal();document.getElementById('presetModal').classList.remove('hidden');}
function closePresetModal(){document.getElementById('presetModal').classList.add('hidden');}
function toggleFormulaModal(){document.getElementById('formulaModal').classList.toggle('hidden');}
function resetProject(){
    if(confirm('Reset all load entries to default template?')){
        boards=[{id:'b0',name:'MDB',type:'MDB',room:'Main',par:'',sup:3,dist:0}];
        fixtures=[
            {id:1,name:'Main Office Lighting',room:'Office',board:'b0',sup:1,category:'Lighting',qty:10,watts:18,pf:0.95,distance:15,phase:'R'},
            {id:2,name:'Workstation Sockets',room:'Office',board:'b0',sup:1,category:'Receptacles',qty:6,watts:180,pf:0.90,distance:20,phase:'Y'}
        ];
        renderFixtureTable();renderBoardTable();recalculateAll();saveProject();
    }
}
