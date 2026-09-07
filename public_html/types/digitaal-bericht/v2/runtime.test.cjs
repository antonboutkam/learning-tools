const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const code = fs.readFileSync(require('node:path').join(__dirname, 'tool.js'), 'utf8');

async function run({text = 'A😀|B || C', reduced = false, search = '?data=./example.json', ok = true, mistakes = false, random = 0.1} = {}) {
    const elements = new Map();
    for (const id of ['screen', 'cursor', 'terminal', 'hint', 'accessibleText']) {
        elements.set(id, {textContent: '', hidden: true, clientWidth: 600, clientHeight: 400, scrollHeight: 400, scrollTop: 0, listeners: {}, attributes: {}, classList: {add() {}},
            addEventListener(event, callback) { this.listeners[event] = callback; },
            setAttribute(name, value) { this.attributes[name] = value; }});
    }
    const timers = new Map();
    const delays = [];
    let index = 0;
    const motion = {matches: reduced, addEventListener(event, callback) { this.change = callback; }};
    const document = {getElementById(id) { return elements.get(id); }, createElement() { return {getContext() { return {measureText() { return {width: 10}; }}; }}; }};
    vm.runInNewContext(code, {
        getComputedStyle: () => ({fontSize: '16px', fontFamily: 'monospace', paddingLeft: '20px', paddingRight: '20px'}),
        Math: Object.assign(Object.create(Math), {random: () => random}),
        document, window: {location: {search, href: 'https://tools.example/types/digitaal-bericht/v2/index.html'}, addEventListener() {}, matchMedia() { return motion; }},
        URLSearchParams, URL, fetch: async () => ({ok, status: 404, json: async () => ({text, mistakes})}),
        setTimeout(callback, delay) { delays.push(delay); timers.set(++index, callback); return index; }, clearTimeout(id) { timers.delete(id); }
    });
    await new Promise(setImmediate);
    return {elements, timers, motion, delays};
}

(async () => {
    let app = await run({reduced: true});
    assert.equal(app.elements.get('screen').textContent, '$ AB | C');
    assert.equal(app.elements.get('accessibleText').textContent, 'AB | C');
    assert.equal(app.timers.size, 0);
    assert.equal(app.elements.get('cursor').hidden, true);

    app = await run();
    assert.equal(app.elements.get('screen').textContent, '$ A');
    assert.equal(app.delays[0], 70, 'half-speed typing: 70 ms instead of 35 ms');
    const pending = [...app.timers.values()][0];
    app.motion.change({matches: true});
    assert.equal(app.elements.get('screen').textContent, '$ AB | C');
    assert.equal(app.timers.size, 0);
    pending();
    assert.equal(app.elements.get('screen').textContent, '$ AB | C');

    app = await run();
    app.motion.change({matches: true});
    assert.equal(app.elements.get('screen').textContent, '$ AB | C');
    assert.equal(app.timers.size, 0);

    app = await run({reduced: true, text: '<img src=x onerror=alert(1)>'});
    assert.equal(app.elements.get('screen').textContent, '$ <img src=x onerror=alert(1)>');
    app = await run({search: '?data=javascript:alert(1)'});
    assert.match(app.elements.get('hint').textContent, /HTTP of HTTPS/);
    app = await run({ok: false});
    assert.match(app.elements.get('hint').textContent, /HTTP 404/);
    app = await run({search: ''});
    assert.match(app.elements.get('hint').textContent, /Geen bericht gekozen/);
    app = await run({text: '  '});
    assert.match(app.elements.get('hint').textContent, /geen tekst/);
    app = await run({text: 'Hallo. Tweede zin.', mistakes: true, random: 0});
    const frames = [];
    while (app.timers.size) {
        const [id, callback] = app.timers.entries().next().value;
        app.timers.delete(id);
        callback();
        frames.push(app.elements.get('screen').textContent);
        assert.ok(frames.length < 1000, 'animation terminates');
    }
    assert.equal(app.elements.get('screen').textContent, '$ Hallo. Tweede zin.');
    assert.ok(frames.some(frame => frame.includes('....')), 'temporary dots appear');
    assert.ok(frames.some((frame, i) => i && frame.length < frames[i - 1].length), 'backspaces appear');
    assert.equal(app.elements.get('accessibleText').textContent, 'Hallo. Tweede zin.');
    app = await run({reduced: true, text: 'woord '.repeat(40) + '\nNieuw'});
    assert.ok(app.elements.get('screen').textContent.split('\n').every(line => line.startsWith('$ ') && line.length <= 55));
    app = await run({reduced: true, text: 'Eerste regel\n\n  \nTweede regel\n\n'});
    assert.equal(app.elements.get('screen').textContent, '$ Eerste regel\n\n$ Tweede regel');
    app = await run({text: 'Lang bericht'});
    const terminal = app.elements.get('terminal');
    terminal.scrollHeight = 2000;
    terminal.scrollTop = 0;
    const tick = app.timers.values().next().value;
    tick();
    assert.equal(terminal.scrollTop, 0, 'reading older text stops auto-scroll');
    console.log('PASS: pipe/backspace, Unicode, reduced motion, cancelled timer, safe text, fetch/config errors, corrections, dots, wrapping, scroll');
})().catch((error) => { console.error(error); process.exitCode = 1; });
