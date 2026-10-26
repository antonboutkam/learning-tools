// Run with LT_PLAYWRIGHT_MODULE=/path/to/playwright and installed Chromium.
const { chromium } = require(process.env.LT_PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'lt-certificate-browser-'));
const privateDir = path.join(work, 'private');
const setup = spawnSync('php', ['scripts/certificate-setup.php', privateDir], { cwd: root, encoding: 'utf8' });
assert.equal(setup.status, 0, setup.stderr);
const port = 18000 + Math.floor(Math.random() * 10000), base = `http://127.0.0.1:${port}`;
fs.writeFileSync(path.join(work, 'router.php'), `<?php if (parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) === '/cross-origin-host') { header('Content-Type: text/html'); readfile(__DIR__ . '/host.html'); return true; } return false;`);
const server = spawn('php', ['-S', `0.0.0.0:${port}`, '-t', 'public_html', path.join(work, 'router.php')], { cwd: root, env: { ...process.env, LT_CERTIFICATE_CONFIG: path.join(privateDir, 'config.json') }, stdio: ['ignore', 'ignore', 'pipe'] });
let serverLog = ''; server.stderr.on('data', data => { serverLog += data; });
const wait = ms => new Promise(r => setTimeout(r, ms));
const certificateFrame = page => page.frames().find(f => /opdrachtcertificaat\/v1\/\?/.test(f.url()));
async function count(frame, expected) { try { await frame.waitForFunction(x => document.getElementById('progressText').textContent.startsWith(x), expected, { timeout: 12000, polling: 100 }); } catch(e) { console.error('Expected', expected, 'Actual', await frame.locator('body').innerText()); throw e; } }
async function solveOrder(frame) {
  await frame.locator('#list li').first().waitFor();
  for (const id of ['1','2','3','4']) {
    while (await frame.locator(`#list li[data-id="${id}"]`).evaluate(el => [...el.parentElement.children].indexOf(el)) > Number(id) - 1) await frame.locator(`#list li[data-id="${id}"] [data-dir="up"]`).click();
  }
  await frame.locator('#check').click();
}
async function solveMatch(frame) {
  for (const [left,right] of [['Willem van Oranje','Vader des Vaderlands'],['Rembrandt','De Nachtwacht'],['Erasmus','Humanist'],['Michiel de Ruyter','Admiraal']]) {
    await frame.getByRole('button', { name: `Koppel: ${left}`, exact: true }).click();
    await frame.getByRole('button', { name: `Koppel: ${right}`, exact: true }).click();
  }
  await frame.locator('#check').click();
}
(async () => {
  let browser;
  try {
    for (let i=0;i<50;i++) { try { if ((await fetch(base)).ok) break; } catch {} await wait(100); }
    assert.ok((await fetch(base)).ok, serverLog);
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ acceptDownloads: true });
    const page = await context.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('requestfailed', r => console.error('Request failed:', r.url(), r.failure()));
    // Top page has a different origin, as it does in Canvas. No parent JS bridge.
    const demo = fs.readFileSync(path.join(root, 'public_html/types/opdrachtcertificaat/v1/demo.html'), 'utf8').replaceAll('src="/types/', `src="${base}/types/`).replace('src="./?data=example.json"', `src="${base}/types/opdrachtcertificaat/v1/?data=example.json"`);
    fs.writeFileSync(path.join(work, 'host.html'), demo);
    await page.goto(`http://localhost:${port}/cross-origin-host`);
    await page.waitForFunction(() => document.querySelectorAll('iframe').length === 3);
    await wait(300);
    let cert; for (let i=0;i<50 && !cert;i++) { cert = certificateFrame(page); if (!cert) await wait(100); } assert.ok(cert, JSON.stringify(page.frames().map(f => f.url())));
    await count(cert, '0 van 2');
    let order = page.frames().find(f => f.url().includes('/juiste-volgorde/'));
    let match = page.frames().find(f => f.url().includes('/wat-hoort-bij-wat/'));
    await cert.waitForFunction(() => !document.getElementById('tasks').textContent.includes('Wacht op'), null, { polling: 100 });
    assert.equal(await cert.locator('#identity').isVisible(), false);
    await solveOrder(order); await count(cert, '1 van 2');
    assert.match(await order.locator('.lt-completion').innerText(), /overige 1 opdracht/);
    // A standalone tool in another tab must never join this coordinator.
    const other = await context.newPage(); await other.goto(`${base}/types/juiste-volgorde/v1/?unique_id=cert-demo-volgorde&data=example.json`);
    await solveOrder(other); await wait(2200);
    assert.match(await other.locator('.lt-completion').innerText(), /Certificaat behaald/);
    assert.doesNotMatch(await other.locator('.lt-completion').innerText(), /overige/);
    await page.bringToFront();
    await solveMatch(match); await count(cert, '2 van 2');
    // Reset revokes this exercise's current completion.
    await order.getByRole('button', { name: 'Opnieuw doen', exact: true }).click();
    await count(cert, '1 van 2'); await solveOrder(order); await count(cert, '2 van 2');
    await page.reload(); await wait(300); cert = certificateFrame(page); await count(cert, '2 van 2');
    await cert.locator('#studentName').fill('Zoë Voorbeeld'); await cert.locator('#studentClass').fill('SD4');
    const downloadPromise = page.waitForEvent('download'); await cert.locator('#download').click();
    const download = await downloadPromise; const file = path.join(work, 'certificate.json'); await download.saveAs(file);
    const envelope = JSON.parse(fs.readFileSync(file));
    const payload = JSON.parse(Buffer.from(envelope.payload, 'base64').toString('utf8'));
    assert.equal(payload.studentName, 'Zoë Voorbeeld'); assert.equal(payload.results.length, 2);
    const expected = path.join(work, 'expected.json'); fs.writeFileSync(expected, JSON.stringify({ groupId: 'demo-certificaat', revision: '1', studentName: 'Zoë Voorbeeld', studentClass: 'SD4', requiredToolIds: ['cert-demo-volgorde','cert-demo-koppelen'] }));
    let checked = spawnSync('php', ['scripts/certificate-verify.php', file, path.join(privateDir, 'public-keys.json'), expected], { cwd: root, encoding: 'utf8' });
    assert.equal(checked.status, 0, checked.stdout); assert.equal(JSON.parse(checked.stdout).status, 'voldaan');
    const againPromise = page.waitForEvent('download'); await cert.locator('#download').click(); const again = await againPromise;
    assert.deepEqual(JSON.parse(fs.readFileSync(await again.path())), envelope);
    const conflict = await fetch(`${base}/types/opdrachtcertificaat/v1/api.php`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ action:'issue', groupId:'demo-certificaat', revision:'1', attemptId:payload.attemptId, studentName:'Other', studentClass:'SD4' }) }); assert.equal(conflict.status, 409);
    const height = await cert.evaluate(() => document.body.scrollHeight + 40);
    await page.locator('iframe[title="Opdrachtcertificaat"]').evaluate((el, h) => el.style.height = `${h}px`, height);
    await cert.evaluate(() => window.scrollTo(0, 0));
    await cert.locator('#certificate').screenshot({ path: path.join(work, 'certificate-earned.png') });
    await page.setViewportSize({ width: 390, height: 900 });
    const mobileHeight = await cert.evaluate(() => document.body.scrollHeight + 40);
    await page.locator('iframe[title="Opdrachtcertificaat"]').evaluate((el, h) => el.style.height = `${h}px`, mobileHeight);
    assert.ok(await cert.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await cert.locator('#certificate').screenshot({ path: path.join(work, 'certificate-mobile.png') });
    await page.setViewportSize({ width: 1280, height: 900 });
    // An existing certificate stays downloadable, even after the exercises reload.
    await page.reload(); await wait(300); cert = certificateFrame(page); await cert.locator('#receipt').waitFor();
    assert.equal(await cert.locator('#studentName').isDisabled(), true);
    page.once('dialog', d => d.accept()); await cert.locator('#newAttempt').click(); await count(cert, '0 van 2');
    assert.equal(await cert.locator('#identity').isVisible(), false);
    // The two tools without the old shared certificate now participate as well.
    const extra = { groupId: 'extra-tools', revision: '1', title: 'Extra oefeningen', requiredTools: [{id:'extra-feed',title:'Handmatige feed'}, {id:'extra-future',title:'FutureMe'}] };
    fs.writeFileSync(path.join(privateDir, 'manifests/extra-tools--1.json'), JSON.stringify(extra));
    const feedConfig = JSON.parse(fs.readFileSync(path.join(root, 'public_html/types/feed-algoritme-handmatig/v1/example.json'))); feedConfig.target = {comparison:'more_than',score:66};
    const futureConfig = { unique_id:'extra-future', title:'Testkamer', theme:'midnight-terminal', persistProgress:true, showReset:true, rooms:[{id:'room',title:'Kamer',instruction:'Schrijf veilig',tasks:[{id:'answer',type:'text',prompt:'Wat doe je?',expected:['veilig'],minLength:6}]}], successMessage:'Gelukt' };
    await page.route(url => url.pathname === '/fixture-certificate.json', r => r.fulfill({json:extra}));
    await page.route(url => url.pathname === '/fixture-feed.json', r => r.fulfill({json:feedConfig}));
    await page.route(url => url.pathname === '/fixture-future.json', r => r.fulfill({json:futureConfig}));
    fs.writeFileSync(path.join(work, 'host.html'), `<!doctype html><html><body>
      <iframe title="Feed" style="width:100%;height:900px" src="${base}/types/feed-algoritme-handmatig/v1/?unique_id=extra-feed&data=/fixture-feed.json"></iframe>
      <iframe title="FutureMe" style="width:100%;height:700px" src="${base}/types/escaperoom-futureme/v1/?unique_id=extra-future&data=/fixture-future.json"></iframe>
      <iframe title="Opdrachtcertificaat" style="width:100%;height:1000px" src="${base}/types/opdrachtcertificaat/v1/?data=/fixture-certificate.json"></iframe>
      </body></html>`);
    await page.reload(); await wait(300); cert = certificateFrame(page); await count(cert, '0 van 2');
    await cert.waitForFunction(() => !document.getElementById('tasks').textContent.includes('Wacht op'), null, {polling:100});
    const feed = page.frames().find(f => f.url().includes('/feed-algoritme-handmatig/'));
    const future = page.frames().find(f => f.url().includes('/escaperoom-futureme/'));
    await feed.locator('#checkScore').click(); await count(cert, '0 van 2');
    await feed.locator('.post:not(.is-hidden) > label').first().click();
    await feed.locator('#checkScore').click(); await count(cert, '1 van 2');
    assert.match(await feed.locator('.lt-completion').innerText(), /135 punten/);
    assert.match(await feed.locator('#result').innerText(), /Je hebt deze opdracht goed gemaakt/);
    await future.locator('textarea').fill('nee'); await future.getByRole('button', {name:'Controleer antwoord',exact:true}).click(); await count(cert, '1 van 2');
    await future.locator('textarea').fill('veilig'); await future.getByRole('button', {name:'Controleer antwoord',exact:true}).click(); await count(cert, '2 van 2');
    await future.locator('#reset').click(); await count(cert, '1 van 2');
    await future.locator('textarea').fill('veilig'); await future.getByRole('button', {name:'Controleer antwoord',exact:true}).click(); await count(cert, '2 van 2');
    await cert.locator('#studentName').fill('Test Student'); await cert.locator('#studentClass').fill('SD4');
    // Simulate response loss after the server has already issued the certificate.
    let lost = false;
    await page.route('**/opdrachtcertificaat/v1/api.php', async route => {
      if (!lost && route.request().postDataJSON()?.action === 'issue') { lost = true; await route.fetch(); await route.abort('failed'); }
      else await route.continue();
    });
    await cert.locator('#download').click(); await cert.locator('#error').waitFor();
    assert.equal(await cert.locator('#studentName').isDisabled(), true);
    const retryDownload = page.waitForEvent('download'); await cert.locator('#download').click(); const recovered = await retryDownload;
    const recoveredPayload = JSON.parse(Buffer.from(JSON.parse(fs.readFileSync(await recovered.path())).payload,'base64'));
    assert.equal(recoveredPayload.studentName,'Test Student');
    assert.equal(recoveredPayload.results[0].score.value,135);
    assert.equal(fs.readdirSync(path.join(privateDir, 'records')).filter(f => f.endsWith('.json')).length,2);
    assert.equal(errors.length, 0, errors.join('\n'));
    await other.close();
    console.log('PASS: cross-origin parent, genuine exercise interactions, remaining count, reset, reload, tab isolation, signed download, identity lock, new attempt, Feedalgoritme, FutureMe, narrow viewport and lost-response recovery');
    console.log(`Visual artifact: ${work}/certificate-earned.png`);
    console.log(`Verification artifacts: ${work}`);
  } finally { await browser?.close(); server.kill(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
