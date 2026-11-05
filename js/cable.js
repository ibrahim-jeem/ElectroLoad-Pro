function n(value){ return Number(value); }
/* ElectroLoad Pro | Cable Sizing Engine V2
 * Deterministic IEC-style sizing workflow. Never reports code compliance from incomplete inputs.
 * Ampacity data source: Schneider Electric Electrical Installation Guide, Fig. G21,
 * reproducing IEC 60364-5-52 Table C.52.1 simplified unburied conductor reference values.
 */
// IEC 60364-5-52:2009+AMD1:2024, Annex B tables B.52.2 (2 loaded PVC)
// and B.52.4 (3 loaded PVC), copper, 70°C conductor, reference ambient 30°C in air.
// Reference methods A1, A2, B1, B2 and C only. D1/D2, E/F/G, XLPE and aluminium
// are intentionally excluded because their distinct thermal / correction profiles are not enabled.
const IEC_CABLE_REFERENCE_V2 = {
  source: 'IEC 60364-5-52 Tables B.52.2 and B.52.4 (Cu/PVC, 70°C, reference ambient 30°C air)',
  sizes: [1.5,2.5,4,6,10,16,25,35,50,70,95,120,150,185,240,300],
  methods: {
    A1: {
      2:[14.5,19.5,26,34,46,61,80,99,119,151,182,210,240,273,321,367],
      3:[13.5,18,24,31,42,56,73,89,108,136,164,188,216,245,286,328]
    },
    A2: {
      2:[14,18.5,25,32,43,57,75,92,110,139,167,192,219,248,291,334],
      3:[13,17.5,23,29,39,52,68,83,99,125,150,172,196,223,261,298]
    },
    B1: {
      2:[17.5,24,32,41,57,76,101,125,151,192,232,269,300,341,400,458],
      3:[15.5,21,28,36,50,68,89,110,134,171,207,239,262,296,346,394]
    },
    B2: {
      2:[16.5,23,30,38,52,69,90,111,133,168,201,232,258,294,344,394],
      3:[15,20,27,34,46,62,80,99,118,149,179,206,225,255,297,339]
    },
    C: {
      2:[19.5,27,36,46,63,85,112,138,168,213,258,299,344,392,461,530],
      3:[17.5,24,32,41,57,76,96,119,144,184,223,259,299,341,403,464]
    }
  }
};
function calculateCableChecks(input) {
  const fail = message => ({ valid:false, status:'BLOCKED', message });
  const n = v => Number(v);
  const Ib=n(input.designCurrent), In=n(input.breakerRating), L=n(input.lengthM), V=n(input.voltage);
  const Ca=n(input.ambientFactor), Cg=n(input.groupingFactor), limit=n(input.maxVdrop);
  const pf=n(input.powerFactor ?? 0.9), temp=n(input.conductorTempC ?? (input.insulation==='XLPE'?90:70));
  const phases=n(input.phases), method=String(input.installationMethod||'');
  const conductors=n(input.loadedConductors), material=input.material||'Cu', insulation=input.insulation||'PVC';
  if (![Ib,In,L,V,Ca,Cg,limit,pf,temp,phases,conductors].every(Number.isFinite) ||
      Ib<=0 || In<=0 || L<0 || V<=0 || Ca<=0 || Ca>1.5 || Cg<=0 || Cg>1.5 || limit<=0 || pf<=0 || pf>1 || temp<20 || temp>90 ||
      ![1,3].includes(phases) || ![2,3].includes(conductors)) return fail('Invalid or incomplete design inputs.');
  if (input.wireUnit==='AWG') return fail('AWG/NEC ampacity tables are not part of this IEC metric reference profile. Switch the project wire standard to Metric.');
  if (conductors !== (phases===3?3:2)) return fail('Loaded conductor count must match the circuit phase configuration (2 for single-phase, 3 for three-phase).');
  if (material!=='Cu') return fail('This compact IEC ampacity profile currently supports copper only. Aluminium requires a separately validated dataset.');
  if (insulation!=='PVC') return fail('XLPE ampacity profile is not enabled until its reference-column mapping is independently verified. Select PVC or provide a manufacturer cable schedule.');
  const profile=IEC_CABLE_REFERENCE_V2.methods[method];
  const amps=profile && profile[conductors];
  if (!Array.isArray(amps)) return fail('No verified ampacity column is available for this installation method and number of loaded conductors.');
  const correction=Ca*Cg;
  if (correction>1.5) return fail('Combined correction factor is outside the supported screening range.');
  const minimumSize=n(input.minimumSizeMm2||0);
  const table=IEC_CABLE_REFERENCE_V2.sizes.map((size,i)=>({size,ampacity:amps[i]})).filter(x=>Number.isFinite(x.ampacity));
  const cable=table.find(x=>x.size>=minimumSize && x.ampacity*correction>=In);
  if(!cable) return fail('No cable in the selected reference table can carry the protective-device rating after correction.');
  const Iz=cable.ampacity*correction;
  const coordination=Ib<=In && In<=Iz;
  // R at conductor operating temperature. R20 = 17.241 (Cu) / S ohm-km;
  // alpha20 = 0.00393/K. X defaults to 0.08 ohm/km when no manufacturer data exists.
  const S=cable.size, R20=17.241/S, R=R20*(1+0.00393*(temp-20));
  const X=n(input.reactanceOhmKm ?? 0.08);
  if(!Number.isFinite(X)||X<0) return fail('Invalid cable reactance.');
  const sinPhi=Math.sqrt(Math.max(0,1-pf*pf));
  const impedanceTerm=R*pf+X*sinPhi;
  const deltaV=(phases===3?Math.sqrt(3):2)*Ib*impedanceTerm*(L/1000);
  const vDropPct=(deltaV/V)*100;
  const voltageDropPass=vDropPct<=limit;
  // IEC 60364-5-54 simplified PE selection for same material; local 4 mm² ECC floor
  // is applied only to BN residential-guideline profile and is labelled separately.
  let peMm2=S<=16?S:S<=35?16:S/2;
  const localPeFloor=input.localPeMinimum ? n(input.localPeMinimum) : 0;
  if(localPeFloor>0) peMm2=Math.max(peMm2,localPeFloor);
  const faultKA=input.faultCurrentKA===''||input.faultCurrentKA==null?null:n(input.faultCurrentKA);
  const trip=n(input.tripTime);
  let thermal={status:'DATA REQUIRED',requiredMm2:null,phasePass:null,pePass:null};
  if(faultKA!==null){
    if(!Number.isFinite(faultKA)||faultKA<=0||!Number.isFinite(trip)||trip<=0||trip>5) thermal={status:'INVALID INPUT',requiredMm2:null,phasePass:false,pePass:false};
    else {
      const k=insulation==='XLPE'?143:115;
      const requiredMm2=faultKA*1000*Math.sqrt(trip)/k;
      thermal={status:'SCREENING ONLY',requiredMm2,phasePass:S>=requiredMm2,pePass:peMm2>=requiredMm2};
      thermal.status=thermal.phasePass&&thermal.pePass?'PASS — ADIABATIC SCREEN':'FAIL — ADIABATIC SCREEN';
    }
  }
  const faultLevel=n(input.faultCurrentAtPointKA);
  const breaking=n(input.breakingCapacityKA);
  const breakingCheck=Number.isFinite(faultLevel)&&faultLevel>0&&Number.isFinite(breaking)&&breaking>0
    ? {status:breaking>=faultLevel?'PASS — BREAKING CAPACITY':'FAIL — BREAKING CAPACITY',faultLevel,breaking}
    : {status:'DATA REQUIRED'};
  const overall=!coordination||!voltageDropPass||thermal.status.startsWith('FAIL')||breakingCheck.status.startsWith('FAIL')
    ? 'REVIEW / FAIL' : 'INCOMPLETE — ENGINEER REVIEW REQUIRED';
  return {valid:true,status:overall,cable,phaseMm2:S,neutralMm2:S,Ib,In,Iz,correction,coordination,R,X,deltaV,vDropPct,voltageDropPass,peMm2,thermal,breakingCheck,
    source:IEC_CABLE_REFERENCE_V2.source,method,conductors,material,insulation};
}
function cableInputValue(id,fallback){const el=document.getElementById(id);return el?el.value:fallback;}
function initCableSizingUI(){
  const ids=['cableMaxVdrop','cableInsulation','cableTripTime','cableMethod','cableAmbientFactor','cableGroupingFactor','cableTemp','cablePowerFactor','cableMaterial','cableReactance','cableFaultLevel','cableBreakingCapacity'];
  const values={cableMaxVdrop:engineering.cableMaxVdrop??2.5,cableInsulation:engineering.cableInsulation||'PVC',cableTripTime:engineering.cableTripTime??0.4,
    cableMethod:engineering.cableMethod||'B2',
    cableAmbientFactor:engineering.cableAmbientFactor??1,cableGroupingFactor:engineering.cableGroupingFactor??1,
    cableTemp:engineering.cableTemp??70,cablePowerFactor:engineering.cablePowerFactor??'',cableMaterial:engineering.cableMaterial||'Cu',
    cableReactance:engineering.cableReactance??0.08,cableFaultLevel:engineering.cableFaultLevel||'',cableBreakingCapacity:engineering.cableBreakingCapacity||''};
  ids.forEach(id=>{const el=document.getElementById(id);if(el){el.value=values[id];el.addEventListener('change',()=>{engineering[id.replace(/^cable/,'cable')]=el.value;persistCableSettings();});}});
  const tableMode=document.getElementById('cableTableMode'); if(tableMode)tableMode.textContent=config.wireUnit==='Metric'?'Metric copper · mm² · 2 loaded PVC':'AWG profile unavailable';
  renderCableSizing();
}
function persistCableSettings(){
  const read=id=>document.getElementById(id)?.value;
  engineering.cableMaxVdrop=n(read('cableMaxVdrop')); engineering.cableInsulation=read('cableInsulation');
  engineering.cableTripTime=n(read('cableTripTime')); engineering.cableMethod=read('cableMethod');
 engineering.cableAmbientFactor=n(read('cableAmbientFactor'));
  engineering.cableGroupingFactor=n(read('cableGroupingFactor')); engineering.cableTemp=n(read('cableTemp'));
  engineering.cablePowerFactor=read('cablePowerFactor')===''?null:n(read('cablePowerFactor')); engineering.cableMaterial=read('cableMaterial');
  engineering.cableReactance=n(read('cableReactance')); engineering.cableFaultLevel=read('cableFaultLevel');
  engineering.cableBreakingCapacity=read('cableBreakingCapacity');
  if(typeof recalculateAll==='function')recalculateAll(); else renderCableSizing(); if(typeof saveProject==='function')saveProject();
}
function renderCableSizing(){
  const body=document.getElementById('cableSizingBody'),summary=document.getElementById('cableSizingSummary'),notes=document.getElementById('cableSizingNotes');
  if(!body||!summary||!notes||typeof circuits==='undefined')return;
  const settings={maxVdrop:n(cableInputValue('cableMaxVdrop',2.5)),insulation:cableInputValue('cableInsulation','PVC'),
    tripTime:n(cableInputValue('cableTripTime',0.4)),installationMethod:cableInputValue('cableMethod','B2'),
ambientFactor:n(cableInputValue('cableAmbientFactor',1)),
    groupingFactor:n(cableInputValue('cableGroupingFactor',1)),conductorTempC:n(cableInputValue('cableTemp',70)),
    powerFactor:cableInputValue('cablePowerFactor','')===''?null:n(cableInputValue('cablePowerFactor','')),material:cableInputValue('cableMaterial','Cu'),
    reactanceOhmKm:n(cableInputValue('cableReactance',0.08)),faultCurrentAtPointKA:cableInputValue('cableFaultLevel',''),
    breakingCapacityKA:cableInputValue('cableBreakingCapacity','')};
  if(!circuits.length){body.innerHTML='<tr><td colspan="10" class="p-4 text-slate-500">No circuits available.</td></tr>';summary.innerHTML='';notes.textContent='Add loads to begin cable verification.';return;}
  const rows=circuits.map(c=>{
    const phases=Number(c.sup)===3?3:1;
    const faultInputs=engineering.cableFaultInputs||(engineering.cableFaultInputs={});
    const key=c.board+'|'+c.id, fault=Object.prototype.hasOwnProperty.call(faultInputs,key)?faultInputs[key]:'';
    const circuitPf=c.items.reduce((sum,item)=>sum+Number(item.qty)*Number(item.watts),0)/Math.max(c.items.reduce((sum,item)=>sum+Number(item.qty)*Number(item.watts)/Math.max(Number(item.pf)||0.01,0.01),0),0.01);
    const result=calculateCableChecks({...settings,wireUnit:config.wireUnit,powerFactor:settings.powerFactor||circuitPf,designCurrent:c.current,breakerRating:c.mcb,lengthM:c.distance,
      voltage:phases===3?config.voltageLL:config.voltageLN,phases,faultCurrentKA:fault,
      localPeMinimum:config.standard==='BNBC'&&config.projectType==='Residential'?4:0,
      minimumSizeMm2:config.standard==='BNBC'&&config.projectType==='Residential'?(c.mcb>=20?6:c.mcb>=15?4:c.mcb>=10?2.5:1.5):0,
      loadedConductors:phases===3?3:2});
    return {c,key,fault,result};
  });
  const ready=rows.filter(x=>x.result.valid),pass=ready.filter(x=>x.result.status.startsWith('INCOMPLETE')).length;
  const blocked=rows.length-ready.length;
  const tile=(label,value)=>'<div class="rounded-xl border border-slate-800 bg-slate-950 p-3"><div class="text-[10px] uppercase tracking-wide text-slate-500">'+label+'</div><div class="text-xl font-bold mt-1 text-slate-100">'+value+'</div></div>';
  summary.innerHTML=tile('Circuits analysed',rows.length)+tile('Calculated',ready.length)+tile('Blocked / unsupported',blocked)+tile('Needs engineer review',ready.length);
  body.innerHTML=rows.map(({c,key,fault,result})=>{
    const label=escapeHTML(boardOf(c.board).name+' · '+c.id);
    if(!result.valid)return '<tr><td class="p-2 text-slate-200">'+label+'</td><td colspan="7" class="p-2 text-amber-300">'+escapeHTML(result.message)+'</td><td class="p-2 text-rose-300">BLOCKED</td></tr>';
    const cable=result.cable;
    const thermal=result.thermal.status;
    return '<tr><td class="p-2 text-slate-200">'+label+'<small class="block text-slate-500">'+c.distance+' m · '+(c.sup===3?'3-phase':'1-phase')+'</small></td>'+
      '<td class="p-2">'+result.Ib.toFixed(2)+' / '+result.In.toFixed(0)+'</td>'+
      '<td class="p-2 text-cyan-300 font-bold">'+cable.size+' mm² Cu (L/N)</td>'+
      '<td class="p-2">'+result.cable.ampacity.toFixed(1)+' / '+result.Iz.toFixed(1)+' A</td>'+
      '<td class="p-2">'+result.vDropPct.toFixed(2)+'% <small class="block text-slate-500">limit '+settings.maxVdrop+'%</small></td>'+
      '<td class="p-2">'+result.peMm2.toFixed(1)+' mm²</td>'+
      '<td class="p-2"><input aria-label="Fault current '+label+'" data-cable-fault="'+escapeHTML(key)+'" type="number" min="0.01" step="0.01" value="'+escapeHTML(fault)+'" placeholder="kA" class="w-20 bg-slate-950 border border-slate-700 rounded px-2 py-1"></td>'+
      '<td class="p-2">'+escapeHTML(thermal)+'<small class="block text-slate-500">Breaking: '+escapeHTML(result.breakingCheck.status)+'</small></td>'+
      '<td class="p-2 text-amber-300 font-semibold">'+escapeHTML(result.status)+'</td></tr>';
  }).join('');
  body.querySelectorAll('[data-cable-fault]').forEach(el=>el.addEventListener('change',()=>{
    const value=el.value.trim(); if(value&&(!Number.isFinite(Number(value))||Number(value)<=0)){el.setCustomValidity('Enter a positive fault current in kA.');el.reportValidity();return;}
    el.setCustomValidity(''); engineering.cableFaultInputs=engineering.cableFaultInputs||{};
    if(value)engineering.cableFaultInputs[el.dataset.cableFault]=value;else delete engineering.cableFaultInputs[el.dataset.cableFault];
    renderCableSizing();if(typeof saveProject==='function')saveProject();
  }));
  notes.innerHTML='<p><b class="text-slate-200">Bangladesh residential minimums:</b> the Power Division guideline gives 1.5 mm² for 5 A, 2.5 mm² for 10 A, 4 mm² for 15 A and 6 mm² for 20 A protected circuits. The application applies the nearest lower threshold conservatively to larger standard breaker ratings (for example, 16 A maps to the 15 A minimum); review this policy against the actual adopted requirements.</p>' +
  '<p><b class="text-slate-200">Design sequence:</b> determine Ib from verified equipment input → select protective device In from device/load requirements → choose conductor so Ib ≤ In ≤ Iz after applicable correction factors → verify voltage drop → verify short-circuit thermal withstand and protective-device breaking capacity.</p>'+
  '<p><b class="text-slate-200">Ampacity:</b> IEC 60364-5-52 Table C.52.1 simplified unburied reference dataset. Method, loaded conductor count, insulation and copper/aluminium must match the actual installation. Unsupported combinations are blocked, not guessed.</p>'+
  '<p><b class="text-slate-200">Voltage drop:</b> ΔU = (2 for 1φ, √3 for balanced 3φ) × I × L × (R cosφ + X sinφ); R is adjusted from 20°C using copper α20=0.00393/K. X defaults to 0.08 Ω/km unless manufacturer data is supplied.</p>'+
  '<p><b class="text-slate-200">Short-circuit withstand:</b> S ≥ I√t/k, with k=115 for Cu/PVC and 143 for Cu/XLPE; the selected table currently only enables PVC. Fault-current-at-cable must be entered at each circuit location. Breaking-capacity comparison is only at the entered common fault point.</p>'+
  '<p class="text-amber-300">This is a design-assistance calculation, not a compliance certificate. Ambient/grouping factors are explicit engineer inputs until complete configuration-specific correction-factor tables are verified. 2- and 3-loaded-conductor PVC copper are enabled for methods A1/A2/B1/B2/C. Buried D1/D2, free-air E/F/G, XLPE and aluminium remain blocked pending their separate correction-factor and construction profiles. ADS/loop impedance, protective-device time-current curves, selectivity, harmonics, motor starting and full IEC 60287 thermal calculations remain outside this v2 release.</p>';
}
if(typeof module!=='undefined'&&module.exports)module.exports={calculateCableChecks};