const assert = require('node:assert/strict');
const { calculateCableChecks } = require('../js/cable.js');
const base = {
  designCurrent:10, breakerRating:16, ambientFactor:1, groupingFactor:1,
  lengthM:20, voltage:230, phases:1, maxVdrop:2.5, faultCurrentKA:'',
  tripTime:0.4, insulation:'PVC', metric:true, installationMethod:'B2',
  loadedConductors:2, material:'Cu', powerFactor:1, conductorTempC:20,
  reactanceOhmKm:0, faultCurrentAtPointKA:'', breakingCapacityKA:''
};
const normal=calculateCableChecks(base);
assert.equal(normal.valid,true);
assert.equal(normal.cable.size,1.5);
assert.equal(normal.phaseMm2,normal.neutralMm2);
const localMinimum=calculateCableChecks({...base,minimumSizeMm2:4});
assert.equal(localMinimum.cable.size,4);
assert.equal(calculateCableChecks({...base,loadedConductors:3}).valid,false);
assert.equal(normal.coordination,true);
assert.equal(normal.R,12.1);\nassert.ok(Math.abs(normal.vDropPct-2.104) < 0.01);
assert.equal(normal.voltageDropPass,true);
const derated=calculateCableChecks({...base,ambientFactor:0.7,groupingFactor:0.8});
assert.equal(derated.cable.size,4);
const overload=calculateCableChecks({...base,designCurrent:20});
assert.equal(overload.coordination,false);
const thermalFail=calculateCableChecks({...base,faultCurrentKA:1});
assert.equal(thermalFail.thermal.status,'FAIL — ADIABATIC SCREEN');
const thermalPass=calculateCableChecks({...base,designCurrent:20,breakerRating:40,faultCurrentKA:1});
assert.equal(thermalPass.thermal.status,'PASS — ADIABATIC SCREEN');
const threePhase=calculateCableChecks({...base,phases:3,loadedConductors:3,voltage:400});
assert.equal(threePhase.valid,true);
assert.ok(threePhase.vDropPct<normal.vDropPct);
assert.equal(calculateCableChecks({...base,lengthM:-1}).valid,false);
const longRun=calculateCableChecks({...base,lengthM:100});
assert.equal(longRun.voltageDropPass,false);
assert.equal(calculateCableChecks({...base,breakerRating:500}).valid,false);
assert.equal(calculateCableChecks({...base,material:'Al'}).valid,false);
assert.equal(calculateCableChecks({...base,insulation:'XLPE'}).valid,false);
assert.equal(calculateCableChecks({...base,installationMethod:'F',loadedConductors:3}).valid,false);
const breakingFail=calculateCableChecks({...base,faultCurrentAtPointKA:20,breakingCapacityKA:10});
assert.equal(breakingFail.breakingCheck.status,'FAIL — BREAKING CAPACITY');
const breakingPass=calculateCableChecks({...base,faultCurrentAtPointKA:10,breakingCapacityKA:20});
assert.equal(breakingPass.breakingCheck.status,'PASS — BREAKING CAPACITY');
assert.equal(calculateCableChecks({...base,powerFactor:1.2}).valid,false);
assert.equal(calculateCableChecks({...base,ambientFactor:0}).valid,false);
console.log('Cable sizing engine v2 tests: 20+ assertions passed.');
