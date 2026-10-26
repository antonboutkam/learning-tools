const { chromium } = require(process.env.LT_PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const port = 28000 + Math.floor(Math.random() * 10000), base = `http://127.0.0.1:${port}`;
const server = spawn('php', ['-S', `127.0.0.1:${port}`, '-t', 'public_html'], { cwd:root, stdio:'ignore' });
const tools = JSON.parse(fs.readFileSync(path.join(root,'public_html/types/registry.json'))).types.filter(t => t.supportsCompletion);
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
  let browser;
  try {
    for (let i=0;i<50;i++) { try { await fetch(base); break; } catch {} await pause(100); }
    browser = await chromium.launch({headless:true});
    for (const tool of tools) {
      const page = await browser.newPage(); const errors=[]; page.on('pageerror', e=>errors.push(e.message));
      let config = JSON.parse(fs.readFileSync(path.join(root,'public_html',tool.exampleDataUrl)));
      config.cooldownSeconds=3;
      if (tool.id==='blikvanger') { config.slides=config.slides.slice(0,1);config.slides[0].vragen=config.slides[0].vragen.slice(0,1); }
      if (tool.id==='goed-of-fout') { config.aantalVragen=1;config.minimaalGoed=1;config.vragenRandomiseren=false; }
      if (tool.id==='pubquiz-yes-no') {config.questionsToAsk=1;config.minCorrectToPass=1;config.rollerSeconds=1;config.questions.forEach(q=>q.answer=true);}
      if (tool.id==='kies-de-juiste-afbeelding') config.pauzeSeconden=0;
      if (tool.id==='escaperoom-futureme') config={cooldownSeconds:3,unique_id:'cooldown-future',title:'Wachttijd',theme:'midnight-terminal',persistProgress:true,showReset:true,rooms:[{id:'r',title:'Kamer',tasks:[{id:'t',type:'text',prompt:'Wat doe je?',expected:['veilig'],minLength:6}]}]};
      await page.route(url=>url.pathname==='/cooldown-fixture.json', route=>route.fulfill({json:config}));
      await page.goto(`${base}${tool.launchUrl}?unique_id=cooldown-${tool.id}&data=/cooldown-fixture.json`);
      let button='#check';
      if (tool.id==='feed-algoritme-handmatig') button='#checkScore';
      if (tool.id==='escaperoom-futureme') {await page.locator('textarea').fill('nee');button='[data-cooldown-attempt]';}
      if (tool.id==='bin-hex-dec-reken') await page.getByRole('button',{name:'Toets 1',exact:true}).click();
      if (tool.id==='blikvanger') { await page.locator('#answers input').first().check();await page.locator('#check').click();await page.locator('#next').click();button='#restart'; }
      else if (tool.id==='goed-of-fout') { await page.locator('#good-button').click();button='#restart-button'; }
      else if (tool.id==='pubquiz-yes-no') { await page.locator('#start').click();await page.locator('#yes').click();button='#start'; }
      else await page.locator(button).click();
      await page.locator('.lt-cooldown').waitFor();
      assert.match(await page.locator('.lt-cooldown').innerText(),/Nieuwe poging mogelijk over [123] seconden?\./);
      assert.equal(await page.locator(button).getAttribute('aria-disabled'),'true',tool.id);
      const key = await page.evaluate(()=>Object.keys(localStorage).find(k=>k.startsWith('learning-tools:cooldown:')));
      const deadline = await page.evaluate(k=>localStorage.getItem(k),key);
      // Dispatch a click even though the control is aria-disabled: it must not restart the timer or retry.
      await page.locator(button).dispatchEvent('click');
      assert.equal(await page.evaluate(k=>localStorage.getItem(k),key),deadline,tool.id);
      if(tool.id==='goed-of-fout') {
        await page.reload(); await page.locator('.lt-cooldown').waitFor();
        await page.locator('#good-button').dispatchEvent('click');
        assert.equal(await page.locator('#good-button').getAttribute('aria-disabled'),'true');
        assert.equal(await page.evaluate(k=>localStorage.getItem(k),key),deadline);
      }
      if(tool.id==='juiste-volgorde') {
        await page.reload();await page.locator('.lt-cooldown').waitFor();
        assert.equal(await page.evaluate(k=>localStorage.getItem(k),key),deadline);
        await page.screenshot({path:'/tmp/learning-tools-cooldown.png',fullPage:true});
      }
      await page.locator('.lt-cooldown').waitFor({state:'hidden',timeout:6500});
      assert.equal(await page.locator(button).getAttribute('aria-disabled'),null);
      assert.equal(await page.evaluate(k=>localStorage.getItem(k),key),null);
      assert.deepEqual(errors,[],tool.id);
      console.log(`PASS ${tool.id}: visible countdown, blocked retry, expiration`);
      await page.close();
    }
    // Disabled-by-default and denied storage: the helper remains usable in memory.
    const page = await browser.newPage(); await page.goto(`${base}/types/juiste-volgorde/v1/?unique_id=default&data=example.json`);
    await page.locator('#check').click(); assert.equal(await page.locator('.lt-cooldown').count(),0);
    await page.evaluate(() => {
      Object.defineProperty(window,'localStorage',{get(){throw Error('denied');}});
      const box=document.createElement('div'); box.id='testbox';box.innerHTML='<button id="reset">Reset</button>';document.body.append(box);
      window.testCompletion=LearningToolsCompletion.create({toolId:'test',version:'v1',uniqueId:'denied',containerEl:box,cooldownSeconds:1,onReset(){window.didReset=true;}});
      testCompletion.beginAttempt(); testCompletion.reset();
    });
    assert.equal(await page.evaluate(()=>window.didReset),undefined);
    await page.locator('#testbox .lt-cooldown').waitFor({state:'hidden'});
    await page.locator('#testbox #reset').evaluate(()=>window.testCompletion.reset());
    assert.equal(await page.evaluate(()=>window.didReset),true);
    console.log('PASS default zero, persisted deadline after reload, and blocked storage fallback');
  } finally {await browser?.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
