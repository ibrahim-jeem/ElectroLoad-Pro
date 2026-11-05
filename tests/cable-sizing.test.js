const assert = require('node:assert/strict');
const { calculateCableChecks } = require('../js/cable.js');
const metric = [
  { size: '1.5 mm²', ampacity: 15.5, resistance: 12.1, pe: '1.5 mm²' },
  { size: '2.5 mm²', ampacity: 21, resistance: 7.41, pe: '2.5 mm²' },
  { size: '4.0 mm²', ampacity: 28, resistance: 4.61, pe: '4.0 mm²' },
  { size: '6.0 mm²', ampacity: 36, resistance: 3.08, pe: '6.0 mm²' },
  { size: '10.0 mm²', ampacity: 50, resistance: 1.83, pe: '10.0 mm²' }
];
const base = { designCurrent: 10, breakerRating: 16, ambientFactor: 1, groupingFactor: 1, lengthM: 20, voltage: 230, voltageLL: 400, phases: 1, maxVdrop: 3, wireTable: metric, faultCurrentKA: '', tripTime: 0.4, insulation: 'PVC', metric: true };
const normal = calculateCableChecks(base);
assert.equal(normal.cable.size, '2.5 mm²');
assert.equal(normal.coordination, true);
assert.ok(Math.abs(normal.vDropPct - 1.2887) < 0.002);
assert.equal(normal.voltageDropPass, true);
const derated = calculateCableChecks({ ...base, ambientFactor: 0.7, groupingFactor: 0.8 });
assert.equal(derated.cable.size, '4.0 mm²');
const overload = calculateCableChecks({ ...base, designCurrent: 20 });
assert.equal(overload.coordination, false);
const thermalFail = calculateCableChecks({ ...base, faultCurrentKA: 1 });
assert.equal(thermalFail.thermal.status, 'FAIL');
const thermalPass = calculateCableChecks({ ...base, breakerRating: 40, designCurrent: 20, faultCurrentKA: 1 });
assert.equal(thermalPass.thermal.status, 'PASS');
const threePhase = calculateCableChecks({ ...base, phases: 3, voltage: 400, voltageLL: 400 });
assert.ok(threePhase.vDropPct < normal.vDropPct);
assert.equal(calculateCableChecks({ ...base, lengthM: -1 }).valid, false);
console.log('Cable sizing engine tests: 8 assertions passed.');
