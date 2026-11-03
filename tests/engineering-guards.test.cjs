const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const engineSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'engine.js'), 'utf8');

function engineContext(boardList, phase = '3P') {
    const context = {
        config: { phase, safetyFactor: 1.25 },
        boards: boardList,
        fixtures: [],
        circuits: [],
        grouping: { auto: true },
        STANDARD_BREAKER_RATINGS: [6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400]
    };
    vm.createContext(context);
    vm.runInContext(engineSource, context);
    return context;
}

const validTree = () => [
    { id: 'mdb', name: 'MDB', par: '', sup: 3 },
    { id: 'bed', name: 'Bedroom Main', par: 'mdb', sup: 3 },
    { id: 'bath', name: 'Bedroom Bathroom', par: 'bed', sup: 1 }
];

test('breaker selection chooses the next available rating', () => {
    const ctx = engineContext(validTree());
    assert.equal(vm.runInContext('selectBreakerRating(15.1)', ctx), 16);
    assert.equal(vm.runInContext('selectBreakerRating(400)', ctx), 400);
});

test('breaker selection refuses values above the table instead of returning 400 A', () => {
    const ctx = engineContext(validTree());
    assert.equal(vm.runInContext('selectBreakerRating(400.01)', ctx), null);
    assert.equal(vm.runInContext('selectBreakerRating(NaN)', ctx), null);
});

test('valid nested bedroom board hierarchy is accepted', () => {
    const ctx = engineContext(validTree());
    assert.equal(vm.runInContext('validateBoardHierarchy()', ctx), null);
});

test('board hierarchy rejects missing parents', () => {
    const boards = validTree();
    boards[2].par = 'missing';
    const ctx = engineContext(boards);
    assert.match(vm.runInContext('validateBoardHierarchy()', ctx), /root MDB/);
});

test('board hierarchy rejects cycles', () => {
    const boards = validTree();
    boards[1].par = 'bath';
    const ctx = engineContext(boards);
    assert.match(vm.runInContext('validateBoardHierarchy()', ctx), /cycle/);
});

test('single-phase board cannot feed a three-phase downstream board', () => {
    const boards = validTree();
    boards[1].sup = 1;
    boards[2].sup = 3;
    const ctx = engineContext(boards);
    assert.match(vm.runInContext('validateBoardHierarchy()', ctx), /more phases/);
});
