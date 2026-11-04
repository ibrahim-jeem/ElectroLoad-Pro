const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'..','js','engine.js'),'utf8');
function ctx(boardList,fixtureList=[],auto=true){
 const c={config:{phase:'3P',safetyFactor:1.25,voltageLN:230,voltageLL:400},boards:boardList,fixtures:fixtureList,circuits:[],grouping:{auto,rooms:true,strategy:'combine'},STANDARD_BREAKER_RATINGS:[6,10,16,20,25,32,40,50,63,80,100,125,160,200,250,315,400],COMBINED_MAX_MCB:16,LOW_POWER_W:500,Math,Number,Set,Map};
 vm.createContext(c);vm.runInContext(source,c);return c;
}
const tree=()=>[{id:'mdb',name:'MDB',par:'',sup:3},{id:'bed',name:'Bedroom Main Switchboard',par:'mdb',sup:3},{id:'bath',name:'Bedroom Bathroom Switchboard',par:'bed',sup:1}];
test('one-phase child board remains one-phase in a three-phase project',()=>{const c=ctx(tree());assert.equal(vm.runInContext('bSup(boards[2])',c),1);assert.equal(vm.runInContext('validateBoardHierarchy()',c),null);});
test('one-phase parent cannot feed a three-phase child',()=>{const b=tree();b[1].sup=1;b[2].sup=3;const c=ctx(b);assert.match(vm.runInContext('validateBoardHierarchy()',c),/more phases/);});
test('SLD parent relationships remain explicit for nested boards',()=>{const c=ctx(tree());assert.equal(c.boards[2].par,'bed');assert.equal(vm.runInContext('isDescendant(boards[2],boards[1])',c),true);});
test('auto circuit numbering is unique across boards',()=>{const f=[{id:1,name:'Light A',room:'A',board:'mdb',sup:1,qty:1,watts:50,pf:1,distance:5,phase:'R',category:'Lighting'},{id:2,name:'Light B',room:'B',board:'bath',sup:1,qty:1,watts:50,pf:1,distance:5,phase:'R',category:'Lighting'}];const c=ctx(tree(),f);vm.runInContext('buildCircuits()',c);const ids=c.circuits.map(x=>x.id);assert.equal(new Set(ids).size,ids.length);assert.deepEqual(ids,['CKT-001','CKT-002']);});
test('manual next circuit number is monotonic and does not reuse a gap',()=>{const f=[{board:'mdb',ckt:'CKT-001'},{board:'bath',ckt:'CKT-003'}];const c=ctx(tree(),f,false);assert.equal(vm.runInContext("nextCktName('bath')",c),'CKT-004');});
test('invalid breaker request returns NOT SIZED sentinel',()=>{const c=ctx(tree());assert.equal(vm.runInContext('selectBreakerRating(400.01)',c),null);});
test('project persistence is connected to actual user interactions',()=>{const app=fs.readFileSync(path.join(__dirname,'..','js','app.js'),'utf8');assert.match(app,/localStorage\.setItem\('elpro_project_v2'/);assert.match(app,/document\.addEventListener\('change'/);});
test('SLD exposes hover details and zoom controls',()=>{const sld=fs.readFileSync(path.join(__dirname,'..','js','sld.js'),'utf8');assert.match(sld,/<title>|createElementNS\(NS,'title'\)/);assert.match(sld,/changeSldZoom/);assert.match(sld,/data-zoom/);});
