/* ElectroLoad Pro | data.js
 * Default project data, fixture library, wire/breaker tables and grouping rules. Edit the tables here to change standards or defaults.
 * Classic script: shares one global scope with the other files, so keep the load order from index.html.
 */

// Default Project Data State
let engineering = { sldConvention: 'IEC', installationMethod: 'C', ambientFactor: 1, groupingFactor: 1, sourceFaultKA: '', mainBreakerIcuKA: '' };

let config = {
    standard: 'BNBC',
    phase: '3P',
    voltageLN: 230,
    voltageLL: 400,
    frequency: 50,
    wireUnit: 'Metric', // Metric or AWG
    safetyFactor: 1.25
};

let fixtures = [
    { id: 1, name: 'Master Bed Lighting', room: 'Master Bed', category: 'Lighting', qty: 6, watts: 18, pf: 0.95, distance: 15, phase: 'R' },
    { id: 2, name: 'Living Room Sockets', room: 'Living Room', category: 'Receptacles', qty: 4, watts: 180, pf: 0.90, distance: 20, phase: 'Y' },
    { id: 3, name: 'Master AC Unit 1.5T', room: 'Master Bed', category: 'HVAC', qty: 1, watts: 1800, pf: 0.85, distance: 25, phase: 'B' },
    { id: 4, name: 'Kitchen Power Socket', room: 'Kitchen', category: 'Receptacles', qty: 2, watts: 1500, pf: 0.95, distance: 12, phase: 'R' },
    { id: 5, name: 'Water Submersible Pump', room: 'Utility', category: 'Motors', qty: 1, watts: 1100, pf: 0.80, distance: 30, phase: 'Y' }
];

// Distribution Boards (index 0 is always the root MDB fed from the grid)
let boards = [
    { id: 'b0', name: 'MDB', type: 'MDB', room: 'Main', par: '', sup: 3, dist: 0 },
    { id: 'b1', name: 'SDB-1', type: 'SDB', room: 'Master Bed', par: 'b0', sup: 3, dist: 20 },
    { id: 'b2', name: 'SB-1', type: 'SB', room: 'Master Bed', par: 'b1', sup: 1, dist: 12 }
];
const SAMPLE_BOARDS = { 1: 'b2', 2: 'b1', 3: 'b1', 4: 'b0', 5: 'b0' };
fixtures.forEach(f => { f.board = SAMPLE_BOARDS[f.id] || 'b0'; f.sup = f.sup || 1; });

// Editable Fixture Library (watts, power factor, supply type) - saved in this browser
const DEFAULT_LIBRARY = [
    { name: 'LED Ceiling Light', category: 'Lighting', watts: 18, pf: 0.95, sup: 1 },
    { name: 'Duplex Socket Outlet', category: 'Receptacles', watts: 180, pf: 0.90, sup: 1 },
    { name: '1.5 Ton AC Unit', category: 'HVAC', watts: 1800, pf: 0.85, sup: 1 },
    { name: '2.0 Ton AC Unit', category: 'HVAC', watts: 2400, pf: 0.85, sup: 1 },
    { name: 'Water Heater Geyser', category: 'Appliances', watts: 2000, pf: 1.0, sup: 1 },
    { name: 'Water Submersible Pump', category: 'Motors', watts: 1100, pf: 0.80, sup: 1 },
    { name: 'Ceiling Fan', category: 'Lighting', watts: 75, pf: 0.90, sup: 1 },
    { name: 'Microwave Oven', category: 'Appliances', watts: 1200, pf: 0.95, sup: 1 },
    { name: 'Induction Cooktop', category: 'Appliances', watts: 2200, pf: 0.98, sup: 1 },
    { name: '3-Phase Motor 5.5 kW', category: 'Motors', watts: 5500, pf: 0.85, sup: 3 }
];
let library = DEFAULT_LIBRARY.map(p => ({ ...p }));
try { const saved = JSON.parse(localStorage.getItem('elpro_library')); if (Array.isArray(saved) && saved.length) library = saved; } catch (e) {}
function saveLibrary() { try { localStorage.setItem('elpro_library', JSON.stringify(library)); } catch (e) {} }

// Wire Ampacity Lookup Table (Metric - Copper BYA/NYY)
const METRIC_WIRE_TABLE = [
    { size: '1.5 mm²', ampacity: 15.5, resistance: 12.1, pe: '1.5 mm²' },
    { size: '2.5 mm²', ampacity: 21, resistance: 7.41, pe: '2.5 mm²' },
    { size: '4.0 mm²', ampacity: 28, resistance: 4.61, pe: '4.0 mm²' },
    { size: '6.0 mm²', ampacity: 36, resistance: 3.08, pe: '6.0 mm²' },
    { size: '10.0 mm²', ampacity: 50, resistance: 1.83, pe: '10.0 mm²' },
    { size: '16.0 mm²', ampacity: 68, resistance: 1.15, pe: '16.0 mm²' },
    { size: '25.0 mm²', ampacity: 89, resistance: 0.727, pe: '16.0 mm²' },
    { size: '35.0 mm²', ampacity: 110, resistance: 0.524, pe: '16.0 mm²' },
    { size: '50.0 mm²', ampacity: 134, resistance: 0.387, pe: '25.0 mm²' },
    { size: '70.0 mm²', ampacity: 171, resistance: 0.268, pe: '35.0 mm²' },
    { size: '95.0 mm²', ampacity: 207, resistance: 0.193, pe: '50.0 mm²' },
    { size: '120.0 mm²', ampacity: 239, resistance: 0.153, pe: '70.0 mm²' }
];

// Wire Ampacity Lookup Table (AWG - Copper THHN/THWN)
const AWG_WIRE_TABLE = [
    { size: '14 AWG', ampacity: 15, resistance: 10.1, pe: '14 AWG' },
    { size: '12 AWG', ampacity: 20, resistance: 6.36, pe: '12 AWG' },
    { size: '10 AWG', ampacity: 30, resistance: 3.99, pe: '10 AWG' },
    { size: '8 AWG', ampacity: 40, resistance: 2.52, pe: '10 AWG' },
    { size: '6 AWG', ampacity: 55, resistance: 1.58, pe: '8 AWG' },
    { size: '4 AWG', ampacity: 70, resistance: 0.99, pe: '8 AWG' },
    { size: '2 AWG', ampacity: 95, resistance: 0.62, pe: '6 AWG' },
    { size: '1/0 AWG', ampacity: 125, resistance: 0.39, pe: '6 AWG' },
    { size: '2/0 AWG', ampacity: 145, resistance: 0.31, pe: '4 AWG' },
    { size: '4/0 AWG', ampacity: 195, resistance: 0.19, pe: '2 AWG' }
];


// IEC 60364-5-52 / Schneider Electrical Installation Guide simplified unburied copper-PVC
// columns are transcribed as published; values are A at reference conditions.
// 2 loaded conductors: A1,A2,B1,B2,C,E,F; 3 loaded conductors: A1,A2,B1,B2,C,E.
// F/3-loaded and XLPE combinations are deliberately unavailable in this compact dataset.
const IEC_CABLE_REFERENCE = {
  source: 'IEC 60364-5-52 Table C.52.1 (Schneider Electric Electrical Installation Guide, Fig. G21)',
  sizes: [1.5,2.5,4,6,10,16,25,35,50,70,95,120,150,185,240],
  methods: {
    A1: {2:[13,17.5,23,29,39,52,68,null,null,null,null,null,null,null,null],3:[22,30,40,51,70,94,119,147,179,229,278,322,371,424,500]},
    A2: {2:[13.5,18,24,31,42,56,73,null,null,null,null,null,null,null,null],3:[23,31,43,54,75,100,127,158,192,246,298,346,395,450,538]},
    B1: {2:[14.5,19.5,26,34,46,61,80,null,null,null,null,null,null,null,null],3:[24,33,46,58,80,107,135,169,207,268,328,382,441,506,599]},
    B2: {2:[15.5,21,28,36,50,68,89,110,134,171,207,239,null,null,null],3:[26,36,49,63,86,115,149,185,225,289,352,410,473,542,641]},
    C:  {2:[17,23,31,40,54,73,95,117,141,179,216,249,285,324,380],3:[27,36,49,63,86,115,149,185,225,289,352,410,473,542,641]},
    E:  {2:[18.5,25,34,43,60,80,101,126,153,196,238,276,318,362,424],3:[30,40,54,70,94,127,169,200,242,310,377,437,504,575,679]},
    F:  {2:[19.5,27,36,46,63,85,110,137,167,213,258,299,344,392,461],3:null}
  }
};

const STANDARD_BREAKER_RATINGS = [6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400];
const ENGINEERING_LIMITATION_NOTICE = 'Preliminary estimate only. Verify cable derating, fault level, breaking capacity, disconnection time, earthing and applicable code before construction.';

// Circuit Grouping State & Rules
let grouping = { auto: true, rooms: true, strategy: 'combine' };
let circuits = [];
const LOW_POWER_W = 500;        // max watts per unit to count as a low-power appliance
const COMBINED_MAX_MCB = 16;    // max MCB (A) for a combined multi-load circuit
