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
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('#boardTableBody tr')).toHaveCount(3);
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

  const hierarchy = await page.evaluate(() => boards.map(b => ({ id: b.id, name: b.name, parent: b.par, supply: bSup(b) })));
  expect(hierarchy.find(b => b.id === 'b2')).toMatchObject({ parent: 'b1', supply: 1 });
  const titles = await page.locator('#sldSvg title').allTextContents();
  expect(titles.some(t => t.includes('Feeder from Bedroom Main Switchboard to Bedroom Bathroom Switchboard'))).toBeTruthy();
  expect(titles.some(t => t.includes('Feeder from MDB to Bedroom Bathroom Switchboard'))).toBeFalsy();
});

test('SLD board nodes expose hover details and zoom controls change the viewport', async ({ page }) => {
  const boardNode = page.locator('#sldSvg g.sld-node').filter({ has: page.locator('title', { hasText: 'Board: MDB' }) }).first();
  await expect(boardNode).toHaveCount(1);
  await expect(boardNode.locator('title')).toContainText('parent');
  const before = await page.locator('#sldSvg').getAttribute('viewBox');
  await page.locator('[data-sld-toolbar] [data-zoom="in"]').click();
  const zoomed = await page.locator('#sldSvg').getAttribute('viewBox');
  expect(zoomed).not.toBe(before);
  await page.locator('[data-sld-toolbar] [data-zoom="reset"]').click();
  await expect(page.locator('#sldSvg')).toHaveAttribute('viewBox', before);
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
    if (/^CKT-\d+$/i.test(value)) circuitIds.push(value);
  }
  expect(circuitIds.length).toBeGreaterThan(1);
  expect(new Set(circuitIds).size).toBe(circuitIds.length);
});

test('invalid power factor blocks calculations instead of silently calculating', async ({ page }) => {
  const row = page.locator('#fixtureTableBody tr').first();
  const pf = row.locator('input[type="number"]').nth(2);
  await pf.fill('1.5');
  await pf.press('Tab');
  await expect(page.locator('#calculatedScheduleBody')).toContainText('Calculation blocked');
  await expect(page.locator('#designAmpsVal')).toHaveText('—');
});
