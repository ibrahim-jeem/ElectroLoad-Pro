const { test, expect } = require('@playwright/test');

async function boardRow(page, name) {
  const rows = page.locator('#boardTableBody tr');
  for (let i = 0; i < await rows.count(); i++) {
    const row = rows.nth(i);
    if (await row.locator('input').first().inputValue() === name) return row;
  }
  throw new Error('Board row not found: ' + name);
}

test.beforeEach(async ({ page }) => {
  page.on('pageerror', error => console.log('BROWSER_PAGE_ERROR', error.stack || error.message));
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('#boardTableBody tr')).toHaveCount(3);
  await page.locator('#advancedToggle').check();
});

test('one-phase bathroom board can be parented to one-phase bedroom switchboard', async ({ page }) => {
  let bedroom = await boardRow(page, 'SDB-1');
  await bedroom.locator('input').first().fill('Bedroom Main Switchboard');
  await bedroom.locator('input').first().press('Tab');
  bedroom = await boardRow(page, 'Bedroom Main Switchboard');
  await bedroom.locator('select').nth(2).selectOption('1');
  let bathroom = await boardRow(page, 'SB-1');
  await bathroom.locator('input').first().fill('Bedroom Bathroom Switchboard');
  await bathroom.locator('input').first().press('Tab');
  bathroom = await boardRow(page, 'Bedroom Bathroom Switchboard');
  await bathroom.locator('select').nth(1).selectOption('b1');
  await expect(bathroom.locator('select').nth(1)).toHaveValue('b1');
  const hierarchy = await page.evaluate(() => boards.map(b => ({ id: b.id, parent: b.par, supply: bSup(b) })));
  expect(hierarchy.find(b => b.id === 'b2')).toMatchObject({ parent: 'b1', supply: 1 });
  const titles = await page.locator('#sldSvg [data-tip]').evaluateAll(nodes => nodes.map(n => n.dataset.tip));
  expect(titles.some(t => t.includes('From: Bedroom Main Switchboard') && t.includes('To: Bedroom Bathroom Switchboard'))).toBeTruthy();
  expect(titles.some(t => t.includes('From: MDB') && t.includes('To: Bedroom Bathroom Switchboard'))).toBeFalsy();
});

test('SLD board nodes expose hover details and toolbar zoom works', async ({ page }) => {
  const boardNode = page.locator('#sldSvg g.sld-node[data-tip]').filter({ hasText: 'MDB' }).first();
  await expect(boardNode).toHaveCount(1);
  await expect.poll(() => boardNode.getAttribute('data-tip')).toContain('Parent:');
  const before = await page.locator('#sldSvg').getAttribute('viewBox');
  await page.locator('[data-sld-toolbar] [data-zoom="in"]').click();
  expect(await page.locator('#sldSvg').getAttribute('viewBox')).not.toBe(before);
  await page.locator('[data-sld-toolbar] [data-zoom="fit"]').click();
  await expect(page.locator('#sldSvg')).toHaveAttribute('viewBox', before);
});


test('SLD supports cursor-centred mouse-wheel zoom and drag panning', async ({ page }) => {
  const svg = page.locator('#sldSvg');
  const viewport = page.locator('#sldViewport');
  const before = await svg.getAttribute('viewBox');
  await viewport.hover();
  const box = await viewport.boundingBox();
  await page.mouse.wheel(0, -420);
  await expect.poll(() => svg.getAttribute('viewBox')).not.toBe(before);
  const zoomed = await svg.getAttribute('viewBox');
  const values = zoomed.split(' ').map(Number);
  await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.55);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.42, box.y + box.height * 0.48, { steps: 5 });
  await page.mouse.up();
  const panned = (await svg.getAttribute('viewBox')).split(' ').map(Number);
  expect(panned[0] !== values[0] || panned[1] !== values[1]).toBeTruthy();
  await page.locator('[data-sld-toolbar] [data-zoom="fit"]').click();
  await expect(svg).toHaveAttribute('viewBox', before);
  await expect(viewport.locator('[data-sld-tooltip]')).toBeAttached();
});

test('SLD breaker symbols show compact hover details', async ({ page }) => {
  const feeder = page.locator('#sldSvg rect.sld-node[data-tip*="From: MDB"]').first();
  await expect(feeder).toHaveCount(1);
  await feeder.hover();
  await expect(page.locator('[data-sld-tooltip]')).toBeVisible();
  await expect(page.locator('[data-sld-tooltip]')).toContainText('From: MDB');
  await expect(page.locator('[data-sld-tooltip]')).toContainText('To:');
  await expect(page.locator('[data-sld-tooltip]')).not.toContainText('Parent:');
});

test('project data survives a full browser reload', async ({ page }) => {
  let bedroom = await boardRow(page, 'SDB-1');
  await bedroom.locator('input').first().fill('Persistent Bedroom Board');
  await bedroom.locator('input').first().press('Tab');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('elpro_project_v2') || '{}').boards?.[1]?.name)).toBe('Persistent Bedroom Board');
  await page.reload();
  bedroom = await boardRow(page, 'Persistent Bedroom Board');
  await expect(bedroom.locator('input').first()).toHaveValue('Persistent Bedroom Board');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('elpro_project_v2')));
  expect(saved.boards).toHaveLength(3);
});

test('automatic CKT references are unique across different boards', async ({ page }) => {
  const rows = page.locator('#calculatedScheduleBody tr');
  const circuitIds = [];
  for (let i = 0; i < await rows.count(); i++) {
    const value = (await rows.nth(i).locator('td').first().innerText()).trim();
    const matches = value.match(/CKT-\d+/ig) || [];
    circuitIds.push(...matches);
  }
  expect(circuitIds.length).toBeGreaterThan(1);
  expect(new Set(circuitIds).size).toBe(circuitIds.length);
});

test('loads beyond the supported breaker and cable tables are marked NOT SIZED', async ({ page }) => {
  const row = page.locator('#fixtureTableBody tr').first();
  const watts = row.locator('input[type="number"]').nth(1);
  await watts.fill('100000000');
  await watts.press('Tab');
  await expect(page.locator('#mainMccbVal')).toHaveText('NOT SIZED');
  await expect(page.locator('#calculatedScheduleBody')).toContainText('NO VALID BREAKER/CABLE SIZE');
});

test('invalid power factor blocks calculations instead of silently calculating', async ({ page }) => {
  const row = page.locator('#fixtureTableBody tr').first();
  const pf = row.locator('input[type="number"]').nth(2);
  await pf.fill('1.5');
  await pf.press('Tab');
  await expect(page.locator('#calculatedScheduleBody')).toContainText('Calculation blocked');
  await expect(page.locator('#designAmpsVal')).toHaveText('—');
});

test('SLD uses navy drafting sheet and phase-specific feeder taps with separate N and PE', async ({ page }) => {
  const svg = page.locator('#sldSvg');
  await expect(svg.locator('rect').first()).toHaveAttribute('fill', '#071426');
  const tips = await svg.locator('[data-tip]').evaluateAll(nodes => nodes.map(n => n.dataset.tip));
  expect(tips.some(t => t.includes('Phase R feeder conductor from MDB busbar to SDB-1'))).toBeTruthy();
  expect(tips.some(t => t.includes('Neutral (N) feeder conductor from neutral busbar to SDB-1'))).toBeTruthy();
  expect(tips.some(t => t.includes('Protective earth (PE) conductor from PE bar to SDB-1'))).toBeTruthy();
  expect(tips.some(t => t.includes('Phase R conductor physically tapped from matching busbar'))).toBeTruthy();
});

test('engineering inputs persist and MDB Icu is compared with entered fault level', async ({ page }) => {
  await page.locator('#cableAmbientFactor').fill('0.85');
  await page.locator('#cableAmbientFactor').press('Tab');
  await expect(page.locator('#sldEngineeringStatus')).toContainText('Ca × Cg = 0.850');
  await page.locator('#sourceFaultKA').fill('20');
  await page.locator('#sourceFaultKA').press('Tab');
  await page.locator('#mainBreakerIcuKA').fill('10');
  await page.locator('#mainBreakerIcuKA').press('Tab');
  await expect(page.locator('#sldEngineeringStatus')).toContainText('FAIL — breaker breaking capacity');
  await page.locator('#mainBreakerIcuKA').fill('25');
  await page.locator('#mainBreakerIcuKA').press('Tab');
  await expect(page.locator('#sldEngineeringStatus')).toContainText('PASS — entered MDB Icu/Icn');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('elpro_project_v2')));
  expect(saved.engineering.cableAmbientFactor).toBe(0.85);
  expect(saved.engineering.sourceFaultKA).toBe('20');
  expect(saved.engineering.mainBreakerIcuKA).toBe('25');
});

test('cable sizing engine renders circuit-linked cable verification rows', async ({ page }) => {
  await expect(page.locator('#cableSizingSection')).toBeVisible();
  await expect(page.locator('#cableSizingBody tr').first()).toBeVisible();
  await expect(page.locator('#cableSizingSummary')).toContainText('Circuits analysed');
  await expect(page.locator('#cableTableMode')).toContainText('Metric copper');
});

test('per-circuit fault current triggers the adiabatic thermal check', async ({ page }) => {
  const fault = page.locator('#cableSizingBody [data-cable-fault]').first();
  await expect(fault).toBeVisible();
  await fault.fill('1');
  await fault.press('Tab');
  const firstRow = page.locator('#cableSizingBody tr').first();
  await expect(firstRow.locator('td').nth(7)).toContainText('FAIL');
  await expect(firstRow.locator('td').nth(8)).toContainText('REVIEW / FAIL');
});

test('cable sizing settings and circuit fault inputs persist after reload', async ({ page }) => {
  await page.locator('#cableMaxVdrop').fill('2.5');
  await page.locator('#cableMaxVdrop').press('Tab');
  await page.locator('#cableInsulation').selectOption('PVC');
  await page.locator('#cableTripTime').fill('0.2');
  await page.locator('#cableTripTime').press('Tab');
  const fault = page.locator('#cableSizingBody [data-cable-fault]').first();
  const key = await fault.getAttribute('data-cable-fault');
  await fault.fill('0.25');
  await fault.press('Tab');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('elpro_project_v2')));
  expect(saved.engineering.cableMaxVdrop).toBe(2.5);
  expect(saved.engineering.cableInsulation).toBe('PVC');
  expect(saved.engineering.cableTripTime).toBe(0.2);
  expect(saved.engineering.cableFaultInputs[key]).toBe('0.25');
  await page.reload();
  await expect(page.locator('#cableMaxVdrop')).toHaveValue('2.5');
  await expect(page.locator('#cableInsulation')).toHaveValue('PVC');
  await expect(page.locator('#cableTripTime')).toHaveValue('0.2');
  await expect(page.locator('#cableSizingBody [data-cable-fault]').first()).toHaveValue('0.25');
});

test('project category and additional distribution board types are available and persist', async ({ page }) => {
  await page.locator('#projectTypeSelect').selectOption('Industrial');
  await expect(page.locator('#projectTypeNote')).toContainText('motor starting');
  await page.locator('#projectTypeSelect').selectOption('Commercial');
  await page.reload();
  await expect(page.locator('#projectTypeSelect')).toHaveValue('Commercial');
  await page.locator('#boardTableBody tr').nth(1).locator('select').first().selectOption({ label: 'FDB' });
  await expect(page.locator('#boardTableBody tr').nth(1).locator('select').first()).toHaveValue('FDB');
  await page.locator('#boardTableBody tr').nth(2).locator('select').first().selectOption({ label: 'DB' });
  await expect(page.locator('#boardTableBody tr').nth(2).locator('select').first()).toHaveValue('DB');
  const types = await page.locator('#boardTableBody tr').nth(1).locator('select').first().locator('option').allTextContents();
  expect(types).toContain('BDB');
});

test('per-load current and demand factors are editable and affect calculated current and demand', async ({ page }) => {
  const base = await page.evaluate(() => itemCurrent(fixtures[0]));
  await page.locator('#fixtureTableBody tr').first().locator('input[type="number"]').nth(3).fill('1.65');
  await page.locator('#fixtureTableBody tr').first().locator('input[type="number"]').nth(3).press('Tab');
  await expect.poll(() => page.evaluate(() => itemCurrent(fixtures[0]))).toBeCloseTo(base * 1.65, 2);
  await page.locator('#fixtureTableBody tr').first().locator('input[type="number"]').nth(4).fill('0.5');
  await page.locator('#fixtureTableBody tr').first().locator('input[type="number"]').nth(4).press('Tab');
  await expect(page.locator('#demandKwVal')).not.toHaveText(await page.locator('#totalKwVal').innerText());
  const feederCurrent = await page.evaluate(() => { const c=circuits.find(c=>c.items.includes(fixtures[0])); return {connected:c.current,demand:c.demandCurrent}; });
  expect(feederCurrent.demand).toBeLessThan(feederCurrent.connected);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('elpro_project_v2')));
  expect(saved.fixtures[0].currentFactor).toBe(1.65);
  expect(saved.fixtures[0].demandFactor).toBe(0.5);
});

test('residential 2-ton AC sizing respects Bangladesh 15A circuit minimum cable rule', async ({ page }) => {
  await page.evaluate(() => {
    fixtures.push({id:Math.max(...fixtures.map(f=>f.id))+1,name:'2 Ton Split AC',room:'Test',board:'b0',sup:1,category:'HVAC',qty:1,watts:2400,pf:0.85,currentFactor:1,demandFactor:1,distance:25,phase:'R'});
    recalculateAll();
  });
  const result = await page.evaluate(() => {
    const c = circuits.find(x => x.items.some(i => i.name === '2 Ton Split AC'));
    return { current:c.current, breaker:c.mcb, cable:c.cableV2?.cable?.size, valid:c.cableV2?.valid };
  });
  expect(result.current).toBeCloseTo(2400/(230*0.85), 2);
  expect(result.breaker).toBe(16);
  expect(result.valid).toBeTruthy();
  expect(result.cable).toBe(4);
});


test('advanced engineering tools are collapsed by default and expand on demand', async ({ page }) => {
  await page.reload();
  await expect(page.locator('#advancedToggle')).not.toBeChecked();
  await expect(page.locator('#advancedPanel')).toBeHidden();
  await page.locator('#advancedToggle').check();
  await expect(page.locator('#advancedPanel')).toBeVisible();
  await expect(page.locator('#cableSizingSection')).toBeVisible();
  await expect(page.locator('#boardHierarchySection')).toBeVisible();
});

test('distribution board schedule mirrors board and circuit calculations', async ({ page }) => {
  await expect(page.locator('#dbScheduleBody tr').first()).toBeVisible();
  await expect(page.locator('#dbScheduleCount')).toContainText('boards');
  await expect(page.locator('#dbScheduleBody')).toContainText('MDB');
  await expect(page.locator('#dbScheduleBody')).toContainText('CKT-');
});

test('project management saves, reloads and exports named project data', async ({ page }) => {
  await page.locator('#projectName').fill('QA Demo Project');
  await page.locator('#projectClient').fill('ElectroLoad QA');
  await page.locator('#projectLocation').fill('Dhaka');
  await page.locator('#projectSaveBtn').click();
  await expect(page.locator('#projectPicker')).toContainText('QA Demo Project');
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('elpro_projects_v1')||'[]'));
  expect(saved[0].meta.name).toBe('QA Demo Project');
  expect(saved[0].project.fixtures.length).toBeGreaterThan(0);
  const downloadPromise=page.waitForEvent('download');
  await page.locator('#projectExportBtn').click();
  const download=await downloadPromise;
  expect(download.suggestedFilename()).toContain('.elpro.json');
});

test('SLD contains a project drawing title block', async ({ page }) => {
  await page.locator('#projectName').fill('Title Block QA');
  await page.locator('#projectName').press('Tab');
  await expect(page.locator('#sldSvg [data-sld-title-block]')).toHaveCount(1);
  await expect(page.locator('#sldSvg [data-sld-title-block]')).toContainText('Title Block QA');
});
