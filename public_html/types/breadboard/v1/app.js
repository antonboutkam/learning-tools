(() => {
  'use strict';
  const params = new URLSearchParams(location.search);
  const editing = params.get('mode') === 'config';
  const parentOrigin = (() => { try { return new URL(params.get('parentOrigin') || document.referrer).origin; } catch (_) { return ''; } })();
  const app = document.querySelector('#app');
  const credit = document.querySelector('#credit');
  setTimeout(() => { credit.classList.add('done'); setTimeout(() => credit.remove(), 400); }, 5000);
  const initial = { canvasWidth: 1000, canvasHeight: 620, components: [{id:'breadboard-1',kind:'breadboard',name:'Breadboard',x:36,y:48,locked:false},{id:'arduino-1',kind:'arduino',name:'Arduino Uno',x:555,y:100,locked:false},{id:'led-1',kind:'component',name:'LED',x:320,y:210,locked:false}], wires:[] };
  let library = null, libraryPromise = null, libraryQuery = '', libraryCategory = '', libraryLimit = 36;
  let stageExpanded = true, libraryExpanded = true;
  let stageZoom = 1, stageScrollX = 0, stageScrollY = 0, stagePan = null, suppressStageClick = false;
  const collapsedComponents = new Set();
  const libraryUrl = path => path.split('/').map(encodeURIComponent).join('/');
  const safeImage = path => typeof path === 'string' && /^fritzing\/parts\/svg\/(core|contrib|user|obsolete)\/(breadboard|icon)\/[^/]+\.svg$/i.test(path) ? path : '';
  function loadLibrary() {
    if (!libraryPromise) libraryPromise = fetch('library.json').then(response => {
      if (!response.ok) throw Error('Library niet beschikbaar');
      return response.json();
    }).then(items => { library = items; renderLibrary(); return items; }).catch(error => {
      libraryPromise = null;
      const results = document.querySelector('#library-results');
      if (results) results.textContent = error.message;
      throw error;
    });
    return libraryPromise;
  }
  function renderLibrary() {
    const category = document.querySelector('#library-category'), results = document.querySelector('#library-results');
    if (!category || !results) return;
    if (!library) { results.textContent = 'Library laden…'; loadLibrary().catch(() => {}); return; }
    const categories = [...new Set(library.map(item => item.category))].sort((a,b) => a.localeCompare(b, 'nl'));
    category.innerHTML = '<option value="">Alle categorieën</option>' + categories.map(name => `<option value="${esc(name)}" ${name===libraryCategory?'selected':''}>${esc(name)}</option>`).join('');
    const query = libraryQuery.trim().toLocaleLowerCase('nl');
    const matches = library.filter(item => (!libraryCategory || item.category === libraryCategory) && (!query || [item.title, item.category, ...item.tags].some(text => text.toLocaleLowerCase('nl').includes(query))));
    const visible = matches.slice(0, libraryLimit);
    results.innerHTML = `<p class="library-count">${matches.length} onderdelen${matches.some(item => !item.image) ? ' · zonder afbeelding niet plaatsbaar' : ''}</p>` + visible.map(item => `<button class="library-part" data-part="${esc(item.id)}" ${item.image?'':'disabled title="Geen breadboard-afbeelding beschikbaar"'}>${item.icon?`<img loading="lazy" src="${safeImage(item.icon)}" alt="">`:'<span class="library-icon">◇</span>'}<span>${esc(item.title)}<small>${esc(item.category)}${item.image?'':' · geen afbeelding'}</small></span></button>`).join('') + (matches.length > visible.length ? '<button id="library-more">Meer tonen</button>' : '');
    results.querySelectorAll('[data-part]').forEach(button => button.onclick = () => addLibraryPart(library.find(item => item.id === button.dataset.part), button));
    const more = results.querySelector('#library-more');
    if (more) more.onclick = () => { libraryLimit += 36; renderLibrary(); };
  }
  async function addLibraryPart(item, button) {
    if (!item?.image || button.disabled) return;
    button.disabled = true;
    const label = button.querySelector('span:not(.library-icon)');
    const previous = label?.firstChild.textContent;
    if (label) label.firstChild.textContent = 'Laden…';
    try {
      const [partResponse, imageResponse] = await Promise.all([
        fetch('fritzing/parts/' + libraryUrl(item.id)), fetch(libraryUrl(item.image))
      ]);
      if (!partResponse.ok || !imageResponse.ok) throw Error('Bestanden van dit onderdeel ontbreken.');
      const [partXml, svgXml] = await Promise.all([partResponse.text(), imageResponse.text()]);
      const parser = new DOMParser(), part = parser.parseFromString(partXml, 'application/xml'), svgDocument = parser.parseFromString(svgXml, 'image/svg+xml');
      if (part.querySelector('parsererror') || svgDocument.querySelector('parsererror')) throw Error('Dit onderdeel bevat ongeldige XML.');
      const svg = document.importNode(svgDocument.documentElement, true);
      const viewBox = svg.viewBox.baseVal;
      const rawWidth = svg.width.baseVal.value || 100;
      const rawHeight = svg.height.baseVal.value || 100;
      const aspect = viewBox.width > 0 && viewBox.height > 0 ? viewBox.width / viewBox.height : rawWidth / rawHeight;
      const longest = Math.max(90, Math.min(250, rawWidth * 2));
      let width = Math.round(longest), height = Math.round(longest / aspect);
      if (height > 180) { width = Math.round(width * 180 / height); height = 180; }
      width = Math.max(24, width); height = Math.max(24, height);
      const measure = document.createElement('div');
      measure.className = 'svg-measure';
      svg.style.width = width + 'px'; svg.style.height = height + 'px';
      measure.append(svg); document.body.append(measure);
      const origin = svg.getBoundingClientRect();
      const pins = [];
      part.querySelectorAll('connectors > connector').forEach(connector => {
        const point = connector.querySelector('views > breadboardView > p');
        if (!point) return;
        const terminalId = point.getAttribute('terminalId');
        const svgId = point.getAttribute('svgId');
        const terminal = terminalId ? svg.querySelector('#' + CSS.escape(terminalId)) : null;
        const pin = svgId ? svg.querySelector('#' + CSS.escape(svgId)) : null;
        const target = [terminal, pin].find(element => element && (element.getBoundingClientRect().width || element.getBoundingClientRect().height));
        if (!target) return;
        const rect = target.getBoundingClientRect();
        pins.push({id:connector.getAttribute('id'), label:connector.getAttribute('name') || connector.querySelector('description')?.textContent || connector.getAttribute('id'), x:Math.round((rect.left + rect.width / 2 - origin.left) * 100) / 100, y:Math.round((rect.top + rect.height / 2 - origin.top) * 100) / 100});
      });
      measure.remove();
      const id = availableId('fritzing-' + Date.now(), data.components);
      data.components.push({id, kind:'fritzing', partId:item.id, image:item.image, name:item.title, width, height, pins, x:80 + data.components.length * 12, y:90 + data.components.length * 12, locked:false});
      selectedComponentId = id; selectedWire = null; activeSelection = 'component'; changed();
    } catch (error) {
      const results = document.querySelector('#library-results');
      if (results) results.insertAdjacentHTML('afterbegin', `<p class="library-error">${esc(error.message)}</p>`);
    } finally { button.disabled = false; if (label && previous) label.firstChild.textContent = previous; }
  }
  const SNAP_RADIUS = 10;
  let data = structuredClone(initial), pendingPin = null, wirePointer = null, snapPin = null, selectedWire = null, selectedComponentId = null, activeSelection = null, drag = null;
  window.addEventListener('pointermove', event => {
    const stage = document.querySelector('#stage');
    const inside = stage && event.target instanceof Node && stage.contains(event.target);
    const hoveredPin = inside ? event.target.closest?.('.pin') : null;
    if (pendingPin) {
      wirePointer = {x:event.clientX, y:event.clientY};
      setSnapPin(inside ? nearestPin(event.clientX, event.clientY) : null);
      updateWirePreview();
    }
    showPinStatus(snapPin || hoveredPin);
  });
  window.addEventListener('scroll', updateWirePreview, true);
  document.addEventListener('pointerleave', () => { setSnapPin(null); showPinStatus(null); updateWirePreview(); });
  function nearestPin(x, y) {
    const stage = document.querySelector('#stage');
    if (!stage) return null;
    let nearest = null, shortest = SNAP_RADIUS * SNAP_RADIUS;
    stage.querySelectorAll('.pin').forEach(pin => {
      const bounds = pin.getBoundingClientRect();
      const dx = x - (bounds.left + bounds.width / 2);
      const dy = y - (bounds.top + bounds.height / 2);
      const distance = dx * dx + dy * dy;
      if (distance <= shortest) { nearest = pin; shortest = distance; }
    });
    return nearest;
  }
  function setSnapPin(pin) {
    if (pin?.dataset.pin === pendingPin) pin = null;
    if (snapPin === pin) return;
    snapPin?.classList.remove('snap-target');
    snapPin = pin;
    snapPin?.classList.add('snap-target');
  }
  function showPinStatus(pin) {
    const status = document.querySelector('#pin-status');
    if (!status) return;
    const label = pin?.getAttribute('aria-label') || '';
    if (status.textContent === label && status.hidden === !label) return;
    status.textContent = label;
    status.hidden = !label;
  }
  function updateWirePreview() {
    const stage = document.querySelector('#stage'), preview = document.querySelector('#wire-preview');
    if (!stage || !preview || !wirePointer) return;
    const bounds = stage.getBoundingClientRect();
    const target = snapPin?.getBoundingClientRect();
    preview.setAttribute('x2', target ? (target.left + target.width / 2 - bounds.left) / stageZoom : Math.max(0, Math.min(bounds.width, wirePointer.x - bounds.left)) / stageZoom);
    preview.setAttribute('y2', target ? (target.top + target.height / 2 - bounds.top) / stageZoom : Math.max(0, Math.min(bounds.height, wirePointer.y - bounds.top)) / stageZoom);
  }
  function connectToPin(pin) {
    if (!pendingPin || !pin || pin.dataset.pin === pendingPin) return;
    data.wires.push({id:`wire-${Date.now()}`,from:pendingPin,to:pin.dataset.pin,color:'#e53935',points:[]});
    pendingPin = null;
    wirePointer = null;
    setSnapPin(null);
    changed();
  }
  function insertWirePoint(wire, start, end, point) {
    const path = [start, ...wire.points, end];
    let segment = 0, shortest = Infinity;
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i], b = path[i + 1];
      const dx = b.x - a.x, dy = b.y - a.y;
      const lengthSquared = dx * dx + dy * dy;
      const t = lengthSquared ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared)) : 0;
      const distance = (point.x - a.x - t * dx) ** 2 + (point.y - a.y - t * dy) ** 2;
      if (distance < shortest) { shortest = distance; segment = i; }
    }
    wire.points.splice(segment, 0, point);
  }
  const clone = value => JSON.parse(JSON.stringify(value));
  const HISTORY_LIMIT = 100;
  let history = [clone(data)], historyIndex = 0, clipboard = null;
  function restoreHistory(direction) {
    const next = historyIndex + direction;
    if (next < 0 || next >= history.length) return;
    historyIndex = next;
    const wireId = selectedWire?.id;
    data = clone(history[historyIndex]);
    selectedWire = data.wires.find(w => w.id === wireId) || null;
    if (!data.components.some(c => c.id === selectedComponentId)) selectedComponentId = null;
    if ((activeSelection === 'wire' && !selectedWire) || (activeSelection === 'component' && !selectedComponentId)) activeSelection = null;
    pendingPin = null;
    wirePointer = null;
    drag = null;
    setSnapPin(null);
    render();
    send();
  }
  function editableTarget(target) {
    return target instanceof Element && !!target.closest('input, textarea, select, [contenteditable="true"]');
  }
  document.addEventListener('keydown', event => {
    if (!editing || !(event.ctrlKey || event.metaKey) || event.altKey || editableTarget(event.target)) return;
    const key = event.key.toLowerCase();
    if (key === 'z') { event.preventDefault(); restoreHistory(event.shiftKey ? 1 : -1); }
    else if (key === 'y') { event.preventDefault(); restoreHistory(1); }
    else if (key === 'x' && cutSelection()) event.preventDefault();
    else if (key === 'v' && pasteClipboard()) event.preventDefault();
  });
  const send = () => { if (editing && parent !== window && parentOrigin && parentOrigin !== 'null') parent.postMessage({type:'learning-tool:config-change', value:clone(data)}, parentOrigin); };
  const load = value => {
    if (!value || typeof value !== 'object') return;
    const wireId = selectedWire?.id;
    value = value.configuratie || value;
    data = {...clone(initial), ...clone(value)};
    data.components = Array.isArray(data.components) ? data.components.filter(c => c && typeof c === 'object') : [];
    data.wires = Array.isArray(data.wires) ? data.wires.filter(w => w && typeof w === 'object').map(w => ({...w, points:Array.isArray(w.points) ? w.points : []})) : [];
    selectedWire = data.wires.find(w => w.id === wireId) || null;
    if (JSON.stringify(data) !== JSON.stringify(history[historyIndex])) {
      history = [clone(data)];
      historyIndex = 0;
      selectedWire = null;
      selectedComponentId = null;
      activeSelection = null;
    }
    render();
  };
  function removeComponent(component) {
    data.components = data.components.filter(c => c !== component);
    data.wires = data.wires.filter(w => !w.from.startsWith(component.id + ':') && !w.to.startsWith(component.id + ':'));
    if (selectedComponentId === component.id) { selectedComponentId = null; activeSelection = null; }
    if (pendingPin?.startsWith(component.id + ':')) { pendingPin = null; wirePointer = null; }
    if (selectedWire && !data.wires.includes(selectedWire)) { selectedWire = null; activeSelection = null; }
    changed();
  }
  function removeWire(wire) {
    data.wires = data.wires.filter(w => w !== wire);
    if (selectedWire === wire) { selectedWire = null; activeSelection = null; }
    changed();
  }
  function cutSelection() {
    if (activeSelection === 'component') {
      const component = data.components.find(c => c.id === selectedComponentId);
      if (!component) return false;
      clipboard = {kind:'component', component:clone(component), wires:clone(data.wires.filter(w => w.from.startsWith(component.id + ':') || w.to.startsWith(component.id + ':'))), uses:0};
      removeComponent(component);
      return true;
    }
    if (activeSelection === 'wire' && selectedWire) {
      clipboard = {kind:'wire', wire:clone(selectedWire), uses:0};
      removeWire(selectedWire);
      return true;
    }
    return false;
  }
  function availableId(base, items) {
    let id = base, number = 2;
    while (items.some(item => item.id === id)) id = `${base}-copy-${number++}`;
    return id;
  }
  function pasteClipboard() {
    if (!clipboard) return false;
    if (clipboard.kind === 'component') {
      const component = clone(clipboard.component);
      const originalId = component.id;
      component.id = availableId(originalId, data.components);
      component.x += clipboard.uses * 24;
      component.y += clipboard.uses * 24;
      data.components.push(component);
      const pastedWires = [];
      clipboard.wires.forEach(source => {
        const wire = clone(source);
        for (const end of ['from', 'to']) if (wire[end].startsWith(originalId + ':')) wire[end] = component.id + wire[end].slice(originalId.length);
        const endpointExists = id => data.components.some(c => id.startsWith(c.id + ':'));
        if (!endpointExists(wire.from) || !endpointExists(wire.to)) return;
        wire.id = availableId(wire.id, [...data.wires, ...pastedWires]);
        pastedWires.push(wire);
      });
      data.wires.push(...pastedWires);
      selectedComponentId = component.id;
      selectedWire = null;
      activeSelection = 'component';
    } else {
      const wire = clone(clipboard.wire);
      if (!data.components.some(c => wire.from.startsWith(c.id + ':')) || !data.components.some(c => wire.to.startsWith(c.id + ':'))) return false;
      wire.id = availableId(wire.id, data.wires);
      data.wires.push(wire);
      selectedWire = wire;
      selectedComponentId = null;
      activeSelection = 'wire';
    }
    clipboard.uses++;
    changed();
    return true;
  }
  window.addEventListener('message', event => { if (event.source !== parent || (parentOrigin && event.origin !== parentOrigin) || !event.data || event.data.type !== 'learning-tool:config-init') return; load(event.data.value); send(); });
  if (editing) {
    if (location.hash.length > 1) { try { load(JSON.parse(decodeURIComponent(escape(atob(location.hash.slice(1)))))); } catch (_) {} }
    else render();
  } else {
    const paramsData = new URLSearchParams(location.search).get('data');
    if (paramsData) { try { load(JSON.parse(paramsData)); } catch (_) { fetch(paramsData).then(r=>{if(!r.ok)throw Error('data niet beschikbaar');return r.json();}).then(load).catch(renderMissing); } }
    else renderMissing();
  }
  function renderMissing() { app.innerHTML = '<section class="no-data"><h1>Breadboard</h1><p>Er is nog geen breadboard-configuratie meegegeven.</p></section>'; }
  function componentSize(component) {
    if (component.kind === 'breadboard') return [317, 216];
    if (component.kind === 'arduino') return [250, 178];
    if (component.kind === 'fritzing') return [Number(component.width) || 90, Number(component.height) || 70];
    return [90, 70];
  }
  function stagePoint(stage, clientX, clientY) {
    const rect=stage.getBoundingClientRect();
    return {x:(clientX-rect.left)/stageZoom,y:(clientY-rect.top)/stageZoom};
  }
  function render() {
    setSnapPin(null);
    showPinStatus(null);
    const width = Math.max(480, Number(data.canvasWidth) || 1000), height = Math.max(320, Number(data.canvasHeight) || 620);
    app.innerHTML = `<div class="layout ${editing?'':'readonly'}" style="--stage-width:${width}px"><div class="toolbar" ${editing?'':'hidden'}><label>Breedte <input data-size="canvasWidth" type="number" min="480" max="2400" value="${width}"></label><label>Hoogte <input data-size="canvasHeight" type="number" min="320" max="1800" value="${height}"></label><button id="wire-mode">${pendingPin?'Kies tweede contactpunt':'Draad verbinden'}</button><button id="delete-wire" ${selectedWire?'':'disabled'}>Verwijder geselecteerde draad</button><button id="undo" title="Ctrl+Z" ${historyIndex===0?'disabled':''}>↶ Ongedaan</button><button id="redo" title="Ctrl+Y / Ctrl+Shift+Z" ${historyIndex===history.length-1?'disabled':''}>↷ Opnieuw</button></div><section class="stage-column"><div class="stage-viewport"><div class="stage-wrap"><div class="stage-canvas" style="width:${width*stageZoom}px;height:${height*stageZoom}px"><div class="stage ${pendingPin?'wiring':''}" id="stage" style="width:${width}px;height:${height}px;transform:scale(${stageZoom})"><svg id="wires" width="${width}" height="${height}" style="position:absolute;inset:0;overflow:visible"></svg><div id="parts"></div><svg id="wire-overlay" width="${width}" height="${height}" style="position:absolute;inset:0;overflow:visible" aria-hidden="true"></svg></div></div></div><div class="zoom-controls" aria-label="Zoom"><button id="zoom-in" type="button" aria-label="Inzoomen" title="Inzoomen">+</button><output id="zoom-level">${Math.round(stageZoom*100)}%</output><button id="zoom-out" type="button" aria-label="Uitzoomen" title="Uitzoomen">−</button></div></div><div class="diagnostics" id="diagnostics" aria-live="polite"></div><div class="notice" id="notice">${editing?'Klik twee contactpunten om een draad te verbinden. Sleep lege ruimte om de stage te verplaatsen.':'Sleep lege ruimte om de stage te verplaatsen.'}</div></section><aside class="panel" ${editing?'':'hidden'}><details id="stage-section" ${stageExpanded?'open':''}><summary>Stage</summary><div id="list"></div><h3>Geselecteerde draad</h3><div id="wire-settings">${selectedWire?`<label>Kleur <input id="wire-color" type="color" value="${selectedWire.color}"></label>`:'Selecteer een draad om de kleur te wijzigen.'}</div></details><details class="library" id="library-section" ${libraryExpanded?'open':''}><summary>Library</summary><label class="library-filter">Zoeken <input id="library-search" type="search" value="${esc(libraryQuery)}" placeholder="Zoek onderdeel"></label><label class="library-filter">Categorie <select id="library-category"></select></label><div id="library-results" aria-live="polite"></div></details></aside></div>`;
    const stage = document.querySelector('#stage'), stageWrap=document.querySelector('.stage-wrap'), stageCanvas=document.querySelector('.stage-canvas'), parts = document.querySelector('#parts'), svg = document.querySelector('#wires'), overlay = document.querySelector('#wire-overlay');
    stageWrap.scrollLeft=stageScrollX;stageWrap.scrollTop=stageScrollY;
    const setZoom=(next,clientX,clientY)=>{
      next=Math.max(.35,Math.min(2.5,Math.round(next*20)/20));
      if(next===stageZoom)return;
      const rect=stageWrap.getBoundingClientRect(),focusX=clientX??rect.left+rect.width/2,focusY=clientY??rect.top+rect.height/2;
      const contentX=(stageWrap.scrollLeft+focusX-rect.left)/stageZoom,contentY=(stageWrap.scrollTop+focusY-rect.top)/stageZoom;
      stageZoom=next;stage.style.transform=`scale(${stageZoom})`;stageCanvas.style.width=`${width*stageZoom}px`;stageCanvas.style.height=`${height*stageZoom}px`;
      stageWrap.scrollLeft=contentX*stageZoom-(focusX-rect.left);stageWrap.scrollTop=contentY*stageZoom-(focusY-rect.top);
      stageScrollX=stageWrap.scrollLeft;stageScrollY=stageWrap.scrollTop;document.querySelector('#zoom-level').value=`${Math.round(stageZoom*100)}%`;drawWires();
    };
    document.querySelector('#zoom-in').onclick=()=>setZoom(stageZoom+.1);
    document.querySelector('#zoom-out').onclick=()=>setZoom(stageZoom-.1);
    stageWrap.onwheel=e=>{if(!e.ctrlKey&&!e.metaKey)return;e.preventDefault();setZoom(stageZoom*Math.exp(-e.deltaY*.01),e.clientX,e.clientY);};
    stageWrap.onscroll=()=>{stageScrollX=stageWrap.scrollLeft;stageScrollY=stageWrap.scrollTop;};
    stage.onpointerdown=e=>{if(e.button!==0||e.target.closest('.part,.pin,.wire,.kink')||pendingPin)return;stagePan={x:e.clientX,y:e.clientY,left:stageWrap.scrollLeft,top:stageWrap.scrollTop};stage.setPointerCapture(e.pointerId);stage.classList.add('panning');};
    stage.addEventListener('pointermove',e=>{if(!stagePan)return;const dx=e.clientX-stagePan.x,dy=e.clientY-stagePan.y;if(Math.abs(dx)+Math.abs(dy)>4)suppressStageClick=true;stageWrap.scrollLeft=stagePan.left-dx;stageWrap.scrollTop=stagePan.top-dy;});
    stage.addEventListener('pointerup',()=>{stagePan=null;stage.classList.remove('panning');});
    stage.addEventListener('pointercancel',()=>{stagePan=null;stage.classList.remove('panning');});
    if (editing) {
      document.querySelector('#stage-section').ontoggle = event => { stageExpanded = event.target.open; };
      document.querySelector('#library-section').ontoggle = event => { libraryExpanded = event.target.open; };
      document.querySelectorAll('[data-size]').forEach(i => i.onchange = () => { data[i.dataset.size]=Number(i.value); changed(); });
      document.querySelector('#wire-mode').onclick = () => { pendingPin=null; wirePointer=null; setSnapPin(null); stage.classList.remove('wiring'); stage.querySelector('.pin.pending')?.classList.remove('pending'); overlay.querySelector('#wire-preview')?.remove(); document.querySelector('#wire-mode').textContent='Draad verbinden'; document.querySelector('#notice').textContent='Klik een begincontactpunt en daarna een eindcontactpunt.'; };
      document.querySelector('#delete-wire').onclick = () => { if(selectedWire)removeWire(selectedWire); };
      document.querySelector('#undo').onclick = () => restoreHistory(-1);
      document.querySelector('#redo').onclick = () => restoreHistory(1);
      document.querySelector('#library-search').oninput = event => { libraryQuery = event.target.value; libraryLimit = 36; renderLibrary(); };
      document.querySelector('#library-category').onchange = event => { libraryCategory = event.target.value; libraryLimit = 36; renderLibrary(); };
      renderList();
      renderLibrary();
    }
    data.components.forEach(c => {
      const dims = componentSize(c);
      const el=document.createElement('div'); el.className=`part ${c.locked?'locked':''} ${c.id===selectedComponentId?'selected':''}`; el.dataset.id=c.id; el.style.cssText=`left:${c.x}px;top:${c.y}px;width:${dims[0]}px;height:${dims[1]}px`;
      const img=c.kind==='breadboard'?'assets/fritzing-tiny-breadboard.svg':c.kind==='arduino'?'assets/fritzing-arduino-uno.svg':c.kind==='fritzing'?safeImage(c.image):'';
      el.innerHTML=img?`<img draggable="false" src="${img}" alt="${esc(c.name)}">`:`<svg viewBox="0 0 90 70" width="100%" height="100%"><rect x="16" y="15" width="58" height="38" rx="8" fill="#2f4858" stroke="#132531"/><path d="M18 35H3m71 0h13" stroke="#d8ad30" stroke-width="5"/><circle cx="3" cy="35" r="4" fill="#ffdc62"/><circle cx="87" cy="35" r="4" fill="#ffdc62"/></svg>`;
      parts.append(el); addPins(el,c,dims);
      if (editing) {
        el.onpointerenter=()=>highlightComponentRow(c.id,true);
        el.onpointerleave=()=>highlightComponentRow(c.id,false);
      }
      if (editing) el.onpointerdown=e=>{ if(e.button!==0||e.target.classList.contains('pin')||(pendingPin&&nearestPin(e.clientX,e.clientY)))return; selectComponent(c.id); if(c.locked)return; const bounds=el.getBoundingClientRect(); drag={component:c,el,dx:(e.clientX-bounds.left)/stageZoom,dy:(e.clientY-bounds.top)/stageZoom,startX:c.x,startY:c.y}; el.setPointerCapture(e.pointerId); };
      if (editing) el.onpointermove=e=>{ if(!drag||drag.el!==el)return; const point=stagePoint(stage,e.clientX,e.clientY); c.x=Math.round(point.x-drag.dx); c.y=Math.round(point.y-drag.dy); el.style.left=`${c.x}px`;el.style.top=`${c.y}px`;drawWires(); };
      if (editing) el.onpointerup=()=>{ if(drag?.el===el){const moved=c.x!==drag.startX||c.y!==drag.startY;drag=null;if(moved)changed();} };
    });
    drawWires();
    function addPins(el,c,dims){
      const pins=[];
      if(c.kind==='breadboard') { for(let row=0;row<10;row++) for(let col=0;col<20;col++){const letter='ABCDEFGHIJ'[row];const boardY=row<5?14.4+row*7.2:64.8+(row-5)*7.2;const y=boardY*(dims[1]/108);const x=(10.92+col*7.2)*(dims[0]/158.64); pins.push({id:`${c.id}:${letter}${col+1}`,x,y,label:`${letter}${col+1}`});} }
      else if(c.kind==='arduino') { const uno=[['A0',161.972,144],['A1',169.172,144],['A2',176.372,144],['A3',183.573,144],['A4/SDA',190.772,144],['A5/SCL',197.972,144],['ICSP MISO',198.333,64.8],['5V',205.532,64.8],['ICSP SCK',198.333,72],['ICSP MOSI',205.532,72],['RESET',198.333,79.2],['GND',205.532,79.2],['ICSP2 MISO',77.012,16.56],['5V',77.012,23.76],['ICSP2 SCK',69.812,16.56],['ICSP2 MOSI',69.812,23.76],['RESET2',62.611,16.56],['GND',62.611,23.76],['D8',136.051,7.2],['D9 PWM',128.852,7.2],['D10 PWM/SS',121.652,7.2],['D11 PWM/MOSI',114.452,7.2],['D12/MISO',107.252,7.2],['D13/SCK',100.052,7.2],['GND',92.852,7.2],['AREF',85.652,7.2],['A4/SDA',78.452,7.2],['A5/SCL',71.251,7.2],['D0/RX',197.972,7.2],['D1/TX',190.772,7.2],['D2',183.573,7.2],['D3 PWM',176.372,7.2],['D4',169.172,7.2],['D5 PWM',161.972,7.2],['D6 PWM',154.772,7.2],['D7',147.573,7.2],['ioref',104.372,144],['N/C',97.172,144],['RESET',111.573,144],['3V3',118.772,144],['5V',125.972,144],['GND',133.172,144],['GND',140.372,144],['VIN',147.573,144]]; uno.forEach(([label,x,y],i)=>pins.push({id:`${c.id}:${label}-${i}`,x:x*dims[0]/212.372,y:y*dims[1]/151.2,label})); }
      else if(c.kind==='fritzing') { (Array.isArray(c.pins)?c.pins:[]).forEach(p=>pins.push({id:`${c.id}:${p.id}`,x:p.x,y:p.y,label:p.label})); }
      else {pins.push({id:`${c.id}:anode`,x:3,y:35,label:'+'},{id:`${c.id}:kathode`,x:87,y:35,label:'−'});}
      pins.forEach(p=>{const point=document.createElement('button');point.type='button';point.className='pin';if(p.id===pendingPin)point.classList.add('pending');point.setAttribute('aria-label',`${c.name} ${p.label}`);point.dataset.pin=p.id;point.style.left=`${p.x}px`;point.style.top=`${p.y}px`;el.append(point);});
    }
    function drawWires() {
      svg.replaceChildren();
      overlay.replaceChildren();
      const lookup = id => {
        if (typeof id !== 'string') return null;
        const [cid] = id.split(':');
        if (!data.components.some(c => c.id === cid)) return null;
        const target = parts.querySelector(`[data-id="${CSS.escape(cid)}"] [data-pin="${CSS.escape(id)}"]`);
        if (!target) return null;
        const stageRect = stage.getBoundingClientRect(), rect = target.getBoundingClientRect();
        return {x:(rect.left + rect.width / 2 - stageRect.left)/stageZoom, y:(rect.top + rect.height / 2 - stageRect.top)/stageZoom};
      };
      data.wires.forEach(w => {
        const a = lookup(w.from), b = lookup(w.to);
        if (!a || !b) return;
        const points = [a, ...(w.points || []), b].map(p => `${p.x},${p.y}`).join(' ');
        const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        poly.dataset.wire = w.id;
        poly.setAttribute('points', points);
        poly.setAttribute('stroke', w.color);
        poly.setAttribute('class', 'wire');
        const visual = poly.cloneNode(false);
        visual.removeAttribute('data-wire');
        visual.dataset.wireVisual = w.id;
        visual.setAttribute('class', 'wire-visual');
        overlay.append(visual);
        if (editing) {
          poly.onpointerenter = () => visual.classList.add('hover');
          poly.onpointerleave = () => visual.classList.remove('hover');
          poly.onclick = e => {
            if (pendingPin) return;
            selectedWire = w;
            selectedComponentId = null;
            activeSelection = 'wire';
            const point=stagePoint(stage,e.clientX,e.clientY);
            insertWirePoint(w, a, b, {x:Math.round(point.x), y:Math.round(point.y)});
            changed();
          };
        }
        svg.append(poly);
        if (editing) (w.points || []).forEach(p => {
          const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          dot.setAttribute('cx', p.x);
          dot.setAttribute('cy', p.y);
          dot.setAttribute('r', 6);
          dot.setAttribute('class', 'kink');
          dot.onpointerdown = e => {
            e.stopPropagation();
            if (pendingPin) return;
            dot.setPointerCapture(e.pointerId);
            dot.onpointermove = ev => {
              const point=stagePoint(stage,ev.clientX,ev.clientY);
              p.x = Math.round(point.x);
              p.y = Math.round(point.y);
              const updated = [a, ...w.points, b].map(q => `${q.x},${q.y}`).join(' ');
              poly.setAttribute('points', updated);
              visual.setAttribute('points', updated);
            };
            dot.onpointerup = () => { selectedWire = null; activeSelection = null; changed(); };
          };
          svg.append(dot);
        });
      });
      if (editing && pendingPin) {
        const start = lookup(pendingPin);
        if (start) {
          const preview = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          preview.id = 'wire-preview';
          preview.setAttribute('class', 'wire-preview');
          preview.setAttribute('x1', start.x);
          preview.setAttribute('y1', start.y);
          preview.setAttribute('x2', start.x);
          preview.setAttribute('y2', start.y);
          overlay.append(preview);
          updateWirePreview();
        }
      }
    }
    stage.querySelectorAll('.pin').forEach(pin=>pin.onclick=e=>{if(!editing)return;e.stopPropagation();if(!pendingPin){pendingPin=pin.dataset.pin;wirePointer={x:e.clientX,y:e.clientY};pin.classList.add('pending');stage.classList.add('wiring');drawWires();document.querySelector('#wire-mode').textContent='Kies tweede contactpunt';document.querySelector('#notice').textContent='Beginpunt gekozen. Klik nu het tweede contactpunt.';}else connectToPin(pin); });
    stage.onclick=e=>{if(suppressStageClick){suppressStageClick=false;return;}if(pendingPin){connectToPin(nearestPin(e.clientX,e.clientY));return;}if((e.target===stage||e.target===svg||e.target===parts)&&selectedWire){selectedWire=null;activeSelection=null;render();}};
    const color=document.querySelector('#wire-color'); if(color){color.oninput=()=>{selectedWire.color=color.value;const id=CSS.escape(selectedWire.id);[svg.querySelector(`[data-wire="${id}"]`),overlay.querySelector(`[data-wire-visual="${id}"]`)].forEach(line=>line?.setAttribute('stroke',color.value));send();};color.onchange=()=>changed();}
    showDiagnostics(validateConfiguration(width,height));
  }
  function validateConfiguration(width,height){
    const out=[], add=(level,message)=>out.push({level,message});
    const components=Array.isArray(data.components)?data.components:[], wires=Array.isArray(data.wires)?data.wires:[];
    const seenComponents=new Set(), seenWires=new Set(), pins=new Map();
    document.querySelectorAll('.pin[data-pin]').forEach(pin=>pins.set(pin.dataset.pin,pin.dataset.pin));
    if(!Number.isFinite(Number(data.canvasWidth))||Number(data.canvasWidth)<480||Number(data.canvasWidth)>2400)add('error','De canvasbreedte moet tussen 480 en 2400 pixels liggen.');
    if(!Number.isFinite(Number(data.canvasHeight))||Number(data.canvasHeight)<320||Number(data.canvasHeight)>1800)add('error','De canvashoogte moet tussen 320 en 1800 pixels liggen.');
    components.forEach(c=>{
      if(typeof c.id!=='string'||!c.id||seenComponents.has(c.id))add('error',`Element-ID ontbreekt, is ongeldig of komt dubbel voor: ${c.name||c.id||'(naamloos)'}.`);else seenComponents.add(c.id);
      if(!['breadboard','arduino','component','fritzing'].includes(c.kind))add('error',`Element ${c.name||c.id} heeft een onbekend type.`);
      if(!Number.isFinite(Number(c.x))||!Number.isFinite(Number(c.y)))add('error',`Element ${c.name||c.id} heeft geen geldige positie.`);
      const size=componentSize(c);
      if(Number(c.x)<0||Number(c.y)<0||Number(c.x)+size[0]>width||Number(c.y)+size[1]>height)add('warning',`${c.name||c.id} valt geheel of gedeeltelijk buiten het canvas.`);
    });
    const parent=new Map([...pins.keys()].map(id=>[id,id]));
    const find=id=>{let root=id;while(parent.has(root)&&parent.get(root)!==root)root=parent.get(root);let cur=id;while(parent.has(cur)&&parent.get(cur)!==cur){const next=parent.get(cur);parent.set(cur,root);cur=next;}return root;};
    const join=(a,b)=>{if(parent.has(a)&&parent.has(b))parent.set(find(a),find(b));};
    components.forEach(c=>{
      if(c.kind==='breadboard'){
        for(let column=1;column<=20;column++){for(const row of ['A','B','C','D','E'].slice(1))join(`${c.id}:${'A'}${column}`,`${c.id}:${row}${column}`);for(const row of ['G','H','I','J'])join(`${c.id}:F${column}`,`${c.id}:${row}${column}`);}
      }
      if(c.kind==='arduino'){
        const groups=[[7,13,40],[11,17,24,41,42],[9,21],[6,22],[8,23],[4,26],[5,27],[10,38]];
        groups.forEach(group=>group.slice(1).forEach(i=>join(`${c.id}:${unoPinLabel(i)}`,`${c.id}:${unoPinLabel(group[0])}`)));
      }
    });
    const connectedPins=new Set();
    wires.forEach((wire,i)=>{
      const label=wire.name||`Draad ${i+1}`;
      if(typeof wire.id!=='string'||!wire.id||seenWires.has(wire.id))add('error',`${label} heeft een ontbrekende, ongeldige of dubbele ID.`);else seenWires.add(wire.id);
      if(!pins.has(wire.from)||!pins.has(wire.to))add('error',`${label} verwijst naar een onbekend contactpunt. Controleer de componenten en maak de verbinding opnieuw.`);
      else {connectedPins.add(wire.from);connectedPins.add(wire.to);if(wire.from===wire.to)add('warning',`${label} begint en eindigt op hetzelfde contactpunt.`);else join(wire.from,wire.to);}
      if(!/^#[0-9a-f]{6}$/i.test(wire.color||''))add('error',`${label} heeft geen geldige kleurcode.`);
      (Array.isArray(wire.points)?wire.points:[]).forEach(point=>{if(!Number.isFinite(Number(point.x))||!Number.isFinite(Number(point.y)))add('error',`${label} bevat een ongeldig knikpunt.`);else if(point.x<0||point.y<0||point.x>width||point.y>height)add('warning',`${label} heeft een knikpunt buiten het canvas.`);});
    });
    components.forEach(c=>{
      if(c.kind==='component'){
        const a=`${c.id}:anode`,b=`${c.id}:kathode`;
        if(!connectedPins.has(a)||!connectedPins.has(b))add('info',`${c.name||'Component'} heeft nog een niet-aangesloten contactpunt.`);
        if(parent.has(a)&&parent.has(b)&&find(a)===find(b))add('warning',`${c.name||'Component'} is met beide aansluitingen aan dezelfde verbinding gekoppeld; de component wordt zo overbrugd.`);
      }
      if(c.kind==='arduino'){
        const five=`${c.id}:${unoPinLabel(7)}`,ground=`${c.id}:${unoPinLabel(11)}`;
        if(parent.has(five)&&parent.has(ground)&&find(five)===find(ground))add('error',`${c.name||'Arduino Uno'} heeft een verbinding tussen 5V en GND. Controleer op kortsluiting.`);
      }
    });
    return out;
  }
  function unoPinLabel(index){return [['A0',0],['A1',1],['A2',2],['A3',3],['A4/SDA',4],['A5/SCL',5],['ICSP MISO',6],['5V',7],['ICSP SCK',8],['ICSP MOSI',9],['RESET',10],['GND',11],['ICSP2 MISO',12],['5V',13],['ICSP2 SCK',14],['ICSP2 MOSI',15],['RESET2',16],['GND',17],['D8',18],['D9 PWM',19],['D10 PWM/SS',20],['D11 PWM/MOSI',21],['D12/MISO',22],['D13/SCK',23],['GND',24],['AREF',25],['A4/SDA',26],['A5/SCL',27],['D0/RX',28],['D1/TX',29],['D2',30],['D3 PWM',31],['D4',32],['D5 PWM',33],['D6 PWM',34],['D7',35],['ioref',36],['N/C',37],['RESET',38],['3V3',39],['5V',40],['GND',41],['GND',42],['VIN',43]][index]?.join('-');}
  function showDiagnostics(items){const box=document.querySelector('#diagnostics');if(!box)return;if(!editing)items=items.filter(x=>x.level==='error');box.innerHTML=items.length?`<ul>${items.map(x=>`<li class="${x.level}">${esc(x.message)}</li>`).join('')}</ul>`:'';}
  function selectComponent(id) {
    selectedComponentId=id;
    selectedWire=null;
    activeSelection='component';
    document.querySelectorAll('.part').forEach(part=>part.classList.toggle('selected',part.dataset.id===id));
    document.querySelector('#delete-wire').disabled=true;
    document.querySelector('#wire-settings').textContent='Selecteer een draad om de kleur te wijzigen.';
    renderList();
  }
  function renderList() {
    const list=document.querySelector('#list');
    const selected=data.components.find(c=>c.id===selectedComponentId);
    const ordered=selected?[selected,...data.components.filter(c=>c!==selected)]:data.components;
    list.innerHTML=ordered.map(c=>`<div class="item ${c.id===selectedComponentId?'selected':''} ${collapsedComponents.has(c.id)?'collapsed':''}" data-row="${esc(c.id)}"><div class="item-heading"><button class="collapse-button" data-collapse type="button" aria-expanded="${collapsedComponents.has(c.id)?'false':'true'}" title="${collapsedComponents.has(c.id)?'Uitklappen':'Inklappen'}">⌄</button><button class="component-name" data-edit-name type="button" title="Naam wijzigen">${esc(c.name)||'<em>Naamloos component</em>'}</button><button class="remove-button" data-remove type="button" aria-label="${esc(c.name)} verwijderen" title="Verwijderen">×</button></div><div class="item-body"><small class="component-kind">${esc(c.kind)}</small><div class="name-editor" hidden><input type="text" data-name value="${esc(c.name)}" aria-label="Naam element"></div><div class="item-controls"><label>X <input data-x type="number" value="${c.x}"></label><label>Y <input data-y type="number" value="${c.y}"></label><button class="lock-button ${c.locked?'is-locked':''}" data-lock type="button" aria-label="${c.locked?'Ontgrendel':'Vergrendel'} ${esc(c.name)}" title="${c.locked?'Ontgrendelen':'Vergrendelen'}">${c.locked?'🔒':'🔓'}</button></div></div></div>`).join('')||'<p class="empty-list">Nog geen elementen.</p>';
    list.querySelectorAll('[data-row]').forEach(row=>{
      const c=data.components.find(x=>x.id===row.dataset.row);
      const nameButton=row.querySelector('[data-edit-name]'), nameEditor=row.querySelector('.name-editor'), nameInput=row.querySelector('[data-name]');
      nameButton.onclick=()=>{nameButton.hidden=true;nameEditor.hidden=false;nameInput.focus();nameInput.select();};
      nameInput.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();nameInput.blur();}if(e.key==='Escape'){nameInput.value=c.name;nameEditor.hidden=true;nameButton.hidden=false;nameButton.focus();}};
      nameInput.onchange=e=>{c.name=e.target.value.trim()||c.name;changed();};
      nameInput.onblur=()=>{if(document.body.contains(row)){nameEditor.hidden=true;nameButton.hidden=false;}};
      ['x','y'].forEach(k=>row.querySelector(`[data-${k}]`).onchange=e=>{c[k]=Number(e.target.value);changed();});
      row.querySelector('[data-lock]').onclick=()=>{c.locked=!c.locked;changed();};
      row.querySelector('[data-remove]').onclick=()=>removeComponent(c);
      row.querySelector('[data-collapse]').onclick=()=>{collapsedComponents.has(c.id)?collapsedComponents.delete(c.id):collapsedComponents.add(c.id);renderList();};
    });
  }
  function highlightComponentRow(id,active){
    const row=document.querySelector(`[data-row="${CSS.escape(id)}"]`);
    if(!row)return;
    row.classList.toggle('stage-hover',active);
  }
  function changed(){
    const snapshot=clone(data);
    if(JSON.stringify(snapshot)!==JSON.stringify(history[historyIndex])){
      history.splice(historyIndex+1);
      history.push(snapshot);
      if(history.length>HISTORY_LIMIT)history.shift();
      historyIndex=history.length-1;
    }
    render();
    send();
  }
  function esc(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
})();
