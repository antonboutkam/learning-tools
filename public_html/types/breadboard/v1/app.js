(() => {
  'use strict';
  const params = new URLSearchParams(location.search);
  const editing = params.get('mode') === 'config';
  const parentOrigin = (() => { try { return new URL(params.get('parentOrigin') || document.referrer).origin; } catch (_) { return ''; } })();
  const app = document.querySelector('#app');
  const credit = document.querySelector('#credit');
  setTimeout(() => { credit.classList.add('done'); setTimeout(() => credit.remove(), 400); }, 5000);
  const initial = { canvasWidth: 1000, canvasHeight: 620, caption:'', showPinsInResult:true, showExportButtonInResult:false, components: [{id:'breadboard-1',kind:'breadboard',name:'Breadboard',x:36,y:48,rotation:0,locked:false,showLabel:false},{id:'arduino-1',kind:'arduino',name:'Arduino Uno',x:555,y:100,rotation:0,locked:false,showLabel:false},{id:'led-1',kind:'component',name:'LED',x:320,y:210,rotation:0,locked:false,showLabel:false}], wires:[], annotations:[], mounts:[] };
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
  function fritzingLengthToPixels(value) {
    const match = String(value || '').trim().match(/^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s*(in|mm|cm|pt|pc|px)?$/i);
    if (!match) return 0;
    const number = Number(match[1]), unit = (match[2] || 'px').toLowerCase();
    const factors = {in:144,mm:144/25.4,cm:144/2.54,pt:2,pc:24,px:2};
    return number * factors[unit];
  }
  function fritzingDisplaySize(svg) {
    const viewBox = svg.getAttribute('viewBox')?.trim().split(/[\s,]+/).map(Number) || [];
    const viewWidth = viewBox.length === 4 && viewBox.every(Number.isFinite) ? viewBox[2] : 0;
    const viewHeight = viewBox.length === 4 && viewBox.every(Number.isFinite) ? viewBox[3] : 0;
    const aspect = viewWidth > 0 && viewHeight > 0 ? viewWidth / viewHeight : 1;
    let width = fritzingLengthToPixels(svg.getAttribute('width'));
    let height = fritzingLengthToPixels(svg.getAttribute('height'));
    if (!width && height) width = height * aspect;
    if (!height && width) height = width / aspect;
    if (!width || !height) { width = viewWidth ? viewWidth * 2 : 100; height = viewHeight ? viewHeight * 2 : width / aspect; }
    const longest = Math.max(width, height);
    const scale = longest > 350 ? 350 / longest : longest < 12 ? 12 / longest : 1;
    return [Math.max(4, Math.round(width * scale)), Math.max(4, Math.round(height * scale))];
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
      const [width, height] = fritzingDisplaySize(svg);
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
      data.components.push({id, kind:'fritzing', partId:item.id, image:item.image, name:item.title, width, height, pins, x:80 + data.components.length * 12, y:90 + data.components.length * 12, rotation:0, locked:false, showLabel:false});
      selectedComponentId = id; selectedWire = null; selectedKink = null; activeSelection = 'component'; changed();
    } catch (error) {
      const results = document.querySelector('#library-results');
      if (results) results.insertAdjacentHTML('afterbegin', `<p class="library-error">${esc(error.message)}</p>`);
    } finally { button.disabled = false; if (label && previous) label.firstChild.textContent = previous; }
  }
  const SNAP_RADIUS = 10;
  const MOUNT_MATCH_RADIUS = 5;
  const KINK_SNAP_RADIUS = 8;
  const WIRE_COLORS = [
    ['#e53935', 'Rood'], ['#f57c00', 'Oranje'], ['#fbc02d', 'Geel'],
    ['#43a047', 'Groen'], ['#00acc1', 'Cyaan'], ['#1e88e5', 'Blauw'],
    ['#8e24aa', 'Paars'], ['#6d4c41', 'Bruin'], ['#37474f', 'Zwart'],
    ['#b0bec5', 'Grijs'], ['#ffffff', 'Wit']
  ];
  let data = structuredClone(initial), pendingPin = null, wirePointer = null, snapPin = null, selectedWire = null, selectedKink = null, selectedComponentId = null, selectedAnnotationId = null, activeSelection = null, drag = null, contextMenu = null;
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
    data.wires.push({id:`wire-${Date.now()}`,name:`Draad ${data.wires.length+1}`,from:pendingPin,to:pin.dataset.pin,color:'#e53935',points:[],showLabel:false});
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
    const annotationId = selectedAnnotationId;
    data = clone(history[historyIndex]);
    selectedWire = data.wires.find(w => w.id === wireId) || null;
    selectedAnnotationId = data.annotations?.some(annotation => annotation.id === annotationId) ? annotationId : null;
    if (!getSelectedKink()) selectedKink = null;
    if (!data.components.some(c => c.id === selectedComponentId)) selectedComponentId = null;
    if ((activeSelection === 'wire' && !selectedWire) || (activeSelection === 'kink' && !getSelectedKink()) || (activeSelection === 'component' && !selectedComponentId) || (activeSelection === 'annotation' && !selectedAnnotationId)) activeSelection = null;
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
    data.annotations = Array.isArray(data.annotations) ? data.annotations.filter(annotation => annotation && ['label','arrow'].includes(annotation.type)) : [];
    data.mounts = Array.isArray(data.mounts) ? data.mounts.filter(m => m && typeof m.componentPin === 'string' && typeof m.breadboardPin === 'string') : [];
    selectedWire = data.wires.find(w => w.id === wireId) || null;
    if (!getSelectedKink()) selectedKink = null;
    if (JSON.stringify(data) !== JSON.stringify(history[historyIndex])) {
      history = [clone(data)];
      historyIndex = 0;
      selectedWire = null;
      selectedKink = null;
      selectedComponentId = null;
      selectedAnnotationId = null;
      activeSelection = null;
    }
    render();
  };
  function removeComponent(component) {
    data.components = data.components.filter(c => c !== component);
    data.wires = data.wires.filter(w => !w.from.startsWith(component.id + ':') && !w.to.startsWith(component.id + ':'));
    data.mounts = data.mounts.filter(m => !m.componentPin.startsWith(component.id + ':') && !m.breadboardPin.startsWith(component.id + ':'));
    if (selectedComponentId === component.id) { selectedComponentId = null; activeSelection = null; }
    if (pendingPin?.startsWith(component.id + ':')) { pendingPin = null; wirePointer = null; }
    if (selectedWire && !data.wires.includes(selectedWire)) { selectedWire = null; selectedKink = null; activeSelection = null; }
    changed();
  }
  function removeWire(wire) {
    data.wires = data.wires.filter(w => w !== wire);
    if (selectedWire === wire) { selectedWire = null; selectedKink = null; activeSelection = null; }
    changed();
  }
  function removeAnnotation(annotation) {
    data.annotations = data.annotations.filter(item => item !== annotation);
    if (selectedAnnotationId === annotation.id) { selectedAnnotationId = null; activeSelection = null; }
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
    if (activeSelection === 'annotation') {
      const annotation = data.annotations.find(item => item.id === selectedAnnotationId);
      if (!annotation) return false;
      clipboard = {kind:'annotation', annotation:clone(annotation), uses:0};
      removeAnnotation(annotation);
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
    } else if (clipboard.kind === 'wire') {
      const wire = clone(clipboard.wire);
      if (!data.components.some(c => wire.from.startsWith(c.id + ':')) || !data.components.some(c => wire.to.startsWith(c.id + ':'))) return false;
      wire.id = availableId(wire.id, data.wires);
      data.wires.push(wire);
      selectedWire = wire;
      selectedComponentId = null;
      activeSelection = 'wire';
    } else {
      const annotation = clone(clipboard.annotation);
      annotation.id = availableId(annotation.id, data.annotations);
      const offset = clipboard.uses * 24;
      annotation.x += offset; annotation.y += offset;
      if (annotation.type === 'arrow') { annotation.x2 += offset; annotation.y2 += offset; }
      data.annotations.push(annotation);
      selectedAnnotationId = annotation.id;
      selectedComponentId = null; selectedWire = null; selectedKink = null;
      activeSelection = 'annotation';
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
  function componentBaseSize(component) {
    if (component.kind === 'breadboard') return [317, 216];
    if (component.kind === 'arduino') return [250, 178];
    if (component.kind === 'fritzing') return [Number(component.width) || 90, Number(component.height) || 70];
    return [90, 70];
  }
  function componentRotation(component) {
    const rotation = Number(component.rotation) || 0;
    return ((rotation % 360) + 360) % 360;
  }
  function componentSize(component) {
    const size = componentBaseSize(component);
    return componentRotation(component) % 180 ? [size[1], size[0]] : size;
  }
  function componentLayer(component) {
    return Number.isFinite(Number(component.layer)) ? Number(component.layer) : component.kind === 'breadboard' ? 0 : 10;
  }
  function contentTransform(rotation, width, height) {
    if (rotation === 90) return `translate(${height}px,0) rotate(90deg)`;
    if (rotation === 180) return `translate(${width}px,${height}px) rotate(180deg)`;
    if (rotation === 270) return `translate(0,${width}px) rotate(270deg)`;
    return 'none';
  }
  function closeContextMenu() {
    contextMenu?.remove();
    contextMenu = null;
  }
  function closeWireColorMenus() {
    document.querySelectorAll('[data-wire-color-menu]').forEach(menu=>menu.hidden=true);
    document.querySelectorAll('[data-wire-colors]').forEach(button=>button.setAttribute('aria-expanded','false'));
  }
  function rotateComponent(component, step) {
    if (component.locked) return;
    const before = componentSize(component);
    component.rotation = (componentRotation(component) + step + 360) % 360;
    const after = componentSize(component);
    component.x = Math.round(Number(component.x) + (before[0] - after[0]) / 2);
    component.y = Math.round(Number(component.y) + (before[1] - after[1]) / 2);
    data.mounts = data.mounts.filter(m => !m.componentPin.startsWith(component.id + ':') && !m.breadboardPin.startsWith(component.id + ':'));
    closeContextMenu();
    changed();
  }
  function openComponentMenu(event, component) {
    event.preventDefault();
    event.stopPropagation();
    closeContextMenu();
    selectComponent(component.id);
    contextMenu = document.createElement('div');
    contextMenu.className = 'component-context-menu';
    contextMenu.setAttribute('role', 'menu');
    contextMenu.setAttribute('aria-label', `Acties voor ${component.name}`);
    contextMenu.innerHTML = `<button type="button" role="menuitem" data-bring-front>⇧ Bovenaan plaatsen</button><button type="button" role="menuitem" data-rotate="-90" ${component.locked?'disabled':''}>↶ 90° linksom</button><button type="button" role="menuitem" data-rotate="90" ${component.locked?'disabled':''}>↷ 90° rechtsom</button>${component.locked?'<small>Ontgrendel dit component om het te draaien.</small>':''}<button class="danger separated" type="button" role="menuitem" data-remove-component>Component verwijderen</button>`;
    document.body.append(contextMenu);
    const bounds = contextMenu.getBoundingClientRect();
    contextMenu.style.left = `${Math.max(6, Math.min(event.clientX, innerWidth - bounds.width - 6))}px`;
    contextMenu.style.top = `${Math.max(6, Math.min(event.clientY, innerHeight - bounds.height - 6))}px`;
    contextMenu.querySelectorAll('[data-rotate]').forEach(button => button.onclick = () => rotateComponent(component, Number(button.dataset.rotate)));
    contextMenu.querySelector('[data-bring-front]').onclick = () => { component.layer=Math.max(...data.components.map(componentLayer),0)+1;closeContextMenu();changed(); };
    contextMenu.querySelector('[data-remove-component]').onclick = () => { closeContextMenu(); removeComponent(component); };
    contextMenu.querySelector('button:not(:disabled)')?.focus();
  }
  function openKinkMenu(event, wire, point) {
    event.preventDefault();
    event.stopPropagation();
    closeContextMenu();
    selectedWire = wire;
    selectedComponentId = null;
    activeSelection = 'wire';
    contextMenu = document.createElement('div');
    contextMenu.className = 'component-context-menu';
    contextMenu.setAttribute('role', 'menu');
    contextMenu.setAttribute('aria-label', 'Knikpunt');
    contextMenu.innerHTML = '<button class="danger" type="button" role="menuitem">Knikpunt verwijderen</button>';
    document.body.append(contextMenu);
    const bounds = contextMenu.getBoundingClientRect();
    contextMenu.style.left = `${Math.max(6, Math.min(event.clientX, innerWidth - bounds.width - 6))}px`;
    contextMenu.style.top = `${Math.max(6, Math.min(event.clientY, innerHeight - bounds.height - 6))}px`;
    const button = contextMenu.querySelector('button');
    button.onclick = () => {
      const index = wire.points.indexOf(point);
      if (index !== -1) wire.points.splice(index, 1);
      selectedKink = null;
      closeContextMenu();
      changed();
    };
    button.focus();
  }
  document.addEventListener('pointerdown', event => {
    if (contextMenu && !contextMenu.contains(event.target)) closeContextMenu();
    if (!(event.target instanceof Element) || !event.target.closest('[data-wire-colors], [data-wire-color-menu]')) closeWireColorMenus();
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') { closeContextMenu(); closeWireColorMenus(); } });
  window.addEventListener('blur', closeContextMenu);
  window.addEventListener('resize', closeContextMenu);
  function stagePoint(stage, clientX, clientY) {
    const rect=stage.getBoundingClientRect();
    return {x:(clientX-rect.left)/stageZoom,y:(clientY-rect.top)/stageZoom};
  }
  function snapKinkPoint(wire, movingPoint, point) {
    const threshold=KINK_SNAP_RADIUS/stageZoom;
    let x=point.x,y=point.y,closestX=threshold+1,closestY=threshold+1;
    (wire.points||[]).forEach(other=>{
      if(other===movingPoint)return;
      const dx=Math.abs(point.x-other.x),dy=Math.abs(point.y-other.y);
      if(dx<=threshold&&dx<closestX){x=other.x;closestX=dx;}
      if(dy<=threshold&&dy<closestY){y=other.y;closestY=dy;}
    });
    const stage=document.querySelector('#stage');
    if(stage){
      const stageRect=stage.getBoundingClientRect();
      stage.querySelectorAll('.part .pin').forEach(pin=>{
        const pinRect=pin.getBoundingClientRect();
        const pinX=(pinRect.left+pinRect.width/2-stageRect.left)/stageZoom;
        const pinY=(pinRect.top+pinRect.height/2-stageRect.top)/stageZoom;
        const dx=Math.abs(point.x-pinX),dy=Math.abs(point.y-pinY);
        if(dx<=threshold&&dx<closestX){x=pinX;closestX=dx;}
        if(dy<=threshold&&dy<closestY){y=pinY;closestY=dy;}
      });
    }
    return {x:Math.round(x),y:Math.round(y)};
  }
  function pinPolarity(pin) {
    const label=String(pin.label||'').trim().toUpperCase(),id=String(pin.id||'').toUpperCase();
    if(label==='+'||id.endsWith(':ANODE')||/(^|[\s/_-])(5V|3V3|3\.3V|VCC|VDD|VIN|VBAT|POWER\+)(?=$|[\s/_-])/.test(label))return 'positive';
    if(label==='-'||label==='−'||id.endsWith(':KATHODE')||/(^|[\s/_-])(GND|GROUND|VSS|NEGATIVE|CATHODE|KATHODE)(?=$|[\s/_-])/.test(label))return 'negative';
    return '';
  }
  const blobAsDataUrl = blob => new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob);});
  async function exportStageImage(button) {
    const stage=document.querySelector('#stage'),notice=document.querySelector('#notice');
    if(!stage||button.disabled)return;
    const previous=button.textContent;button.disabled=true;button.textContent='Afbeelding maken…';
    try {
      const width=Math.max(480,Number(data.canvasWidth)||1000),height=Math.max(320,Number(data.canvasHeight)||620),clone=stage.cloneNode(true);
      clone.style.transform='none';clone.style.width=`${width}px`;clone.style.height=`${height}px`;clone.classList.remove('wiring','panning');
      clone.querySelectorAll('.selected,.pending,.snap-target,.mount-target,.dragging').forEach(element=>element.classList.remove('selected','pending','snap-target','mount-target','dragging'));
      clone.querySelector('#kink-overlay')?.remove();clone.querySelectorAll('.wire-visual,#wire-preview').forEach(element=>element.remove());
      if(data.showPinsInResult===false)clone.querySelectorAll('.pin').forEach(pin=>pin.remove());
      await Promise.all([...clone.querySelectorAll('img')].map(async image=>{const response=await fetch(new URL(image.getAttribute('src'),location.href));if(!response.ok)throw Error(`Afbeelding kon niet worden geladen: ${image.getAttribute('src')}`);image.setAttribute('src',await blobAsDataUrl(await response.blob()));}));
      let css='';for(const sheet of document.styleSheets){try{css+=[...sheet.cssRules].map(rule=>rule.cssText).join('\n')+'\n';}catch(_) {}}css=css.replace(/cursor:\s*url\([^;]+;?/gi,'cursor:default;');
      const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('xmlns','http://www.w3.org/2000/svg');svg.setAttribute('width',width);svg.setAttribute('height',height);svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
      const foreign=document.createElementNS('http://www.w3.org/2000/svg','foreignObject');foreign.setAttribute('width','100%');foreign.setAttribute('height','100%');
      const wrapper=document.createElementNS('http://www.w3.org/1999/xhtml','div'),style=document.createElementNS('http://www.w3.org/1999/xhtml','style');style.textContent=css+'\n.stage{transform:none!important}.part{cursor:default!important}.pin{cursor:default!important}';wrapper.append(style,clone);foreign.append(wrapper);svg.append(foreign);
      const source=new Blob([new XMLSerializer().serializeToString(svg)],{type:'image/svg+xml;charset=utf-8'}),sourceUrl=URL.createObjectURL(source),image=new Image();
      await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error('De afbeelding kon niet worden opgebouwd.'));image.src=sourceUrl;});
      const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const context=canvas.getContext('2d');context.drawImage(image,0,0,width,height);URL.revokeObjectURL(sourceUrl);
      const png=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!png)throw Error('De PNG kon niet worden gemaakt.');
      const url=URL.createObjectURL(png),link=document.createElement('a');link.href=url;link.download='breadboard-schakeling.png';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);if(notice)notice.textContent='De afbeelding is opgeslagen als breadboard-schakeling.png.';
    } catch(error) { if(notice)notice.textContent=`Exporteren mislukt: ${error.message}`; }
    finally {button.disabled=false;button.textContent=previous;}
  }
  function addAnnotation(type) {
    const width=Math.max(480,Number(data.canvasWidth)||1000),height=Math.max(320,Number(data.canvasHeight)||620);
    const id=availableId(`${type}-${Date.now()}`,data.annotations);
    const annotation=type==='label'
      ? {id,type,text:'Nieuw label',x:Math.round(width/2),y:Math.round(height/2),color:'#203c4e'}
      : {id,type,x:Math.round(width/2-60),y:Math.round(height/2),x2:Math.round(width/2+60),y2:Math.round(height/2),color:'#203c4e'};
    data.annotations.push(annotation);
    selectedAnnotationId=id;selectedComponentId=null;selectedWire=null;selectedKink=null;activeSelection='annotation';
    changed();
  }
  function render() {
    closeContextMenu();
    setSnapPin(null);
    showPinStatus(null);
    const width = Math.max(480, Number(data.canvasWidth) || 1000), height = Math.max(320, Number(data.canvasHeight) || 620);
    app.innerHTML = `<div class="layout ${editing?'':'readonly'} ${!editing&&data.showPinsInResult===false?'hide-result-pins':''}" style="--stage-width:${width}px"><div class="toolbar" ${editing?'':'hidden'}><label>Breedte <input data-size="canvasWidth" type="number" min="480" max="2400" value="${width}"></label><label>Hoogte <input data-size="canvasHeight" type="number" min="320" max="1800" value="${height}"></label><button id="wire-mode">${pendingPin?'Kies tweede contactpunt':'Draad verbinden'}</button><button id="add-label">+ Label</button><button id="add-arrow">+ Pijl</button><button id="delete-wire" ${selectedWire?'':'disabled'}>Verwijder geselecteerde draad</button><button id="undo" title="Ctrl+Z" ${historyIndex===0?'disabled':''}>↶ Ongedaan</button><button id="redo" title="Ctrl+Y / Ctrl+Shift+Z" ${historyIndex===history.length-1?'disabled':''}>↷ Opnieuw</button><button type="button" data-export-image>Opslaan als afbeelding</button></div><section class="stage-column"><div class="stage-viewport">${!editing&&data.showExportButtonInResult===true?'<button class="result-export" type="button" data-export-image>Opslaan als afbeelding</button>':''}<div class="stage-wrap"><div class="stage-canvas" style="width:${width*stageZoom}px;height:${height*stageZoom}px"><div class="stage ${pendingPin?'wiring':''}" id="stage" style="width:${width}px;height:${height}px;transform:scale(${stageZoom})"><svg id="wires" width="${width}" height="${height}" style="position:absolute;inset:0;overflow:visible"></svg><div id="parts"></div><svg id="wire-overlay" width="${width}" height="${height}" style="position:absolute;inset:0;overflow:visible" aria-hidden="true"></svg><svg id="kink-overlay" width="${width}" height="${height}" style="position:absolute;inset:0;overflow:visible"></svg><svg id="annotation-arrows" width="${width}" height="${height}" style="position:absolute;inset:0;overflow:visible"><defs><marker id="arrowhead" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L8,4 L0,8 Z" fill="context-stroke"></path></marker></defs></svg><div id="annotation-labels"></div></div></div></div><div class="zoom-controls" aria-label="Zoom"><button id="zoom-in" type="button" aria-label="Inzoomen" title="Inzoomen">+</button><output id="zoom-level">${Math.round(stageZoom*100)}%</output><button id="zoom-out" type="button" aria-label="Uitzoomen" title="Uitzoomen">−</button></div></div>${data.caption?.trim()?`<p class="tool-caption">${esc(data.caption.trim())}</p>`:''}<div class="diagnostics" id="diagnostics" aria-live="polite"></div><div class="notice" id="notice">${editing?'Klik twee contactpunten om een draad te verbinden. Sleep lege ruimte om de stage te verplaatsen.':'Sleep lege ruimte om de stage te verplaatsen.'}</div></section><aside class="panel" ${editing?'':'hidden'}><details id="stage-section" ${stageExpanded?'open':''}><summary>Stage</summary><label class="global-setting"><input id="show-pins-in-result" type="checkbox" ${data.showPinsInResult!==false?'checked':''}> Contactpinnen tonen in eindresultaat</label><label class="global-setting"><input id="show-export-in-result" type="checkbox" ${data.showExportButtonInResult===true?'checked':''}> Knop ‘Opslaan als afbeelding’ tonen in eindresultaat</label><label class="caption-setting">Caption<textarea id="caption" maxlength="240" placeholder="Korte toelichting onder de learn-tool">${esc(data.caption||'')}</textarea></label><div id="list"></div><h3>Draden</h3><div id="wire-list"></div><h3>Annotaties</h3><div id="annotation-list"></div><h3>Geselecteerd knikpunt</h3><div id="kink-settings"></div></details><details class="library" id="library-section" ${libraryExpanded?'open':''}><summary>Library</summary><label class="library-filter">Zoeken <input id="library-search" type="search" value="${esc(libraryQuery)}" placeholder="Zoek onderdeel"></label><label class="library-filter">Categorie <select id="library-category"></select></label><div id="library-results" aria-live="polite"></div></details></aside></div>`;
    const stage = document.querySelector('#stage'), stageWrap=document.querySelector('.stage-wrap'), stageCanvas=document.querySelector('.stage-canvas'), parts = document.querySelector('#parts'), svg = document.querySelector('#wires'), overlay = document.querySelector('#wire-overlay'), kinkOverlay=document.querySelector('#kink-overlay'), annotationArrows=document.querySelector('#annotation-arrows'), annotationLabels=document.querySelector('#annotation-labels');
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
    document.querySelectorAll('[data-export-image]').forEach(button=>button.onclick=()=>exportStageImage(button));
    stageWrap.onwheel=e=>{if(!e.ctrlKey&&!e.metaKey)return;e.preventDefault();setZoom(stageZoom*Math.exp(-e.deltaY*.01),e.clientX,e.clientY);};
    stageWrap.onscroll=()=>{stageScrollX=stageWrap.scrollLeft;stageScrollY=stageWrap.scrollTop;};
    stage.onpointerdown=e=>{if(e.button!==0||e.target.closest('.part,.pin,.wire,.kink,.annotation')||pendingPin)return;stagePan={x:e.clientX,y:e.clientY,left:stageWrap.scrollLeft,top:stageWrap.scrollTop};stage.setPointerCapture(e.pointerId);stage.classList.add('panning');};
    stage.addEventListener('pointermove',e=>{if(!stagePan)return;const dx=e.clientX-stagePan.x,dy=e.clientY-stagePan.y;if(Math.abs(dx)+Math.abs(dy)>4)suppressStageClick=true;stageWrap.scrollLeft=stagePan.left-dx;stageWrap.scrollTop=stagePan.top-dy;});
    stage.addEventListener('pointerup',()=>{stagePan=null;stage.classList.remove('panning');});
    stage.addEventListener('pointercancel',()=>{stagePan=null;stage.classList.remove('panning');});
    const pinCenter = pin => {
      const stageRect=stage.getBoundingClientRect(),rect=pin.getBoundingClientRect();
      return {x:(rect.left+rect.width/2-stageRect.left)/stageZoom,y:(rect.top+rect.height/2-stageRect.top)/stageZoom};
    };
    const clearMountPreview = () => stage.querySelectorAll('.mount-target').forEach(pin=>pin.classList.remove('mount-target'));
    const mountedPairsAtCurrentPosition = (component, boardId) => {
      const sourcePins=[...parts.querySelectorAll(`[data-id="${CSS.escape(component.id)}"] .pin`)];
      const occupied=new Set(data.mounts.filter(m=>!m.componentPin.startsWith(component.id+':')).map(m=>m.breadboardPin));
      const boardPins=[...parts.querySelectorAll(`[data-id="${CSS.escape(boardId)}"] .pin`)].filter(pin=>!occupied.has(pin.dataset.pin));
      const threshold=MOUNT_MATCH_RADIUS/stageZoom,used=new Set(),pairs=[];
      sourcePins.forEach(source=>{
        const a=pinCenter(source);let best=null,distance=threshold*threshold;
        boardPins.forEach(target=>{if(used.has(target.dataset.pin))return;const b=pinCenter(target),next=(a.x-b.x)**2+(a.y-b.y)**2;if(next<=distance){best=target;distance=next;}});
        if(best){used.add(best.dataset.pin);pairs.push({componentPin:source.dataset.pin,breadboardPin:best.dataset.pin});}
      });
      return pairs;
    };
    const snapComponentToBreadboard = (component, el) => {
      clearMountPreview();
      if(component.kind==='breadboard'||component.kind==='arduino')return [];
      const occupied=new Set(data.mounts.filter(m=>!m.componentPin.startsWith(component.id+':')).map(m=>m.breadboardPin));
      const sourcePins=[...el.querySelectorAll('.pin')],boardPins=[...parts.querySelectorAll('.part')].filter(part=>data.components.find(item=>item.id===part.dataset.id)?.kind==='breadboard').flatMap(part=>[...part.querySelectorAll('.pin')]).filter(pin=>!occupied.has(pin.dataset.pin));
      const threshold=SNAP_RADIUS/stageZoom;let match=null,distance=threshold*threshold;
      sourcePins.forEach(source=>{const a=pinCenter(source);boardPins.forEach(target=>{const b=pinCenter(target),next=(a.x-b.x)**2+(a.y-b.y)**2;if(next<=distance){match={source,target,dx:b.x-a.x,dy:b.y-a.y,boardId:target.dataset.pin.split(':')[0]};distance=next;}});});
      if(!match)return [];
      component.x=Math.round(component.x+match.dx);component.y=Math.round(component.y+match.dy);
      el.style.left=`${component.x}px`;el.style.top=`${component.y}px`;
      const pairs=mountedPairsAtCurrentPosition(component,match.boardId);
      pairs.forEach(pair=>{parts.querySelector(`[data-pin="${CSS.escape(pair.componentPin)}"]`)?.classList.add('mount-target');parts.querySelector(`[data-pin="${CSS.escape(pair.breadboardPin)}"]`)?.classList.add('mount-target');});
      return pairs;
    };
    if (editing) {
      document.querySelector('#stage-section').ontoggle = event => { stageExpanded = event.target.open; };
      document.querySelector('#library-section').ontoggle = event => { libraryExpanded = event.target.open; };
      document.querySelectorAll('[data-size]').forEach(i => i.onchange = () => { data[i.dataset.size]=Number(i.value); changed(); });
      document.querySelector('#wire-mode').onclick = () => { pendingPin=null; wirePointer=null; setSnapPin(null); stage.classList.remove('wiring'); stage.querySelector('.pin.pending')?.classList.remove('pending'); overlay.querySelector('#wire-preview')?.remove(); document.querySelector('#wire-mode').textContent='Draad verbinden'; document.querySelector('#notice').textContent='Klik een begincontactpunt en daarna een eindcontactpunt.'; };
      document.querySelector('#add-label').onclick = () => addAnnotation('label');
      document.querySelector('#add-arrow').onclick = () => addAnnotation('arrow');
      document.querySelector('#delete-wire').onclick = () => { if(selectedWire)removeWire(selectedWire); };
      document.querySelector('#undo').onclick = () => restoreHistory(-1);
      document.querySelector('#redo').onclick = () => restoreHistory(1);
      document.querySelector('#show-pins-in-result').onchange = event => { data.showPinsInResult=event.target.checked; changed(); };
      document.querySelector('#show-export-in-result').onchange = event => { data.showExportButtonInResult=event.target.checked; changed(); };
      document.querySelector('#caption').onchange = event => { data.caption=event.target.value.trim(); changed(); };
      document.querySelector('#library-search').oninput = event => { libraryQuery = event.target.value; libraryLimit = 36; renderLibrary(); };
      document.querySelector('#library-category').onchange = event => { libraryCategory = event.target.value; libraryLimit = 36; renderLibrary(); };
      renderList();
      renderWirePanel();
      renderAnnotationPanel();
      renderKinkPanel();
      renderLibrary();
    }
    const physicallyConnectedPins=new Set();
    data.wires.forEach(wire=>{physicallyConnectedPins.add(wire.from);physicallyConnectedPins.add(wire.to);});
    data.mounts.forEach(mount=>{physicallyConnectedPins.add(mount.componentPin);physicallyConnectedPins.add(mount.breadboardPin);});
    data.components.forEach(c => {
      const baseDims = componentBaseSize(c), dims = componentSize(c), rotation = componentRotation(c);
      const el=document.createElement('div'); el.className=`part ${c.locked?'locked':''} ${c.id===selectedComponentId?'selected':''}`; el.dataset.id=c.id; el.style.cssText=`left:${c.x}px;top:${c.y}px;width:${dims[0]}px;height:${dims[1]}px;z-index:${componentLayer(c)}`;
      const img=c.kind==='breadboard'?'assets/fritzing-tiny-breadboard.svg':c.kind==='arduino'?'assets/fritzing-arduino-uno.svg':c.kind==='fritzing'?safeImage(c.image):'';
      const content=document.createElement('div'); content.className='part-content'; content.style.cssText=`width:${baseDims[0]}px;height:${baseDims[1]}px;transform:${contentTransform(rotation,baseDims[0],baseDims[1])}`;
      content.innerHTML=img?`<img draggable="false" src="${img}" alt="${esc(c.name)}">`:`<svg viewBox="0 0 90 70" width="100%" height="100%"><rect x="16" y="15" width="58" height="38" rx="8" fill="#2f4858" stroke="#132531"/><path d="M18 35H3m71 0h13" stroke="#d8ad30" stroke-width="5"/><circle cx="3" cy="35" r="4" fill="#ffdc62"/><circle cx="87" cy="35" r="4" fill="#ffdc62"/></svg>`;
      el.append(content);
      if(c.showLabel){const label=document.createElement('span');label.className='part-label';label.textContent=c.name||c.id;el.append(label);}
      parts.append(el); addPins(content,c,baseDims);
      if (editing) {
        el.onpointerenter=()=>highlightComponentRow(c.id,true);
        el.onpointerleave=()=>highlightComponentRow(c.id,false);
        el.oncontextmenu=e=>openComponentMenu(e,c);
      }
      if (editing) el.onpointerdown=e=>{ if(e.button!==0||e.target.classList.contains('pin')||(pendingPin&&nearestPin(e.clientX,e.clientY)))return; selectComponent(c.id); if(c.locked)return; const bounds=el.getBoundingClientRect(); drag={component:c,el,dx:(e.clientX-bounds.left)/stageZoom,dy:(e.clientY-bounds.top)/stageZoom,startX:c.x,startY:c.y,mounts:[]};el.classList.add('dragging');el.setPointerCapture(e.pointerId); };
      if (editing) el.onpointermove=e=>{ if(!drag||drag.el!==el)return; const point=stagePoint(stage,e.clientX,e.clientY); c.x=Math.round(point.x-drag.dx); c.y=Math.round(point.y-drag.dy); el.style.left=`${c.x}px`;el.style.top=`${c.y}px`;drag.mounts=snapComponentToBreadboard(c,el); const row=document.querySelector(`[data-row="${CSS.escape(c.id)}"]`); if(row){row.querySelector('[data-x]').value=c.x;row.querySelector('[data-y]').value=c.y;} drawWires(); };
      if (editing) el.onpointerup=()=>{ if(drag?.el===el){const moved=c.x!==drag.startX||c.y!==drag.startY;if(moved){data.mounts=data.mounts.filter(m=>!m.componentPin.startsWith(c.id+':')&&!m.breadboardPin.startsWith(c.id+':'));data.mounts.push(...drag.mounts);}drag=null;el.classList.remove('dragging');clearMountPreview();if(moved)changed();} };
      if (editing) el.onpointercancel=el.onpointerup;
    });
    data.mounts.forEach(mount=>{parts.querySelector(`[data-pin="${CSS.escape(mount.componentPin)}"]`)?.classList.add('mounted');parts.querySelector(`[data-pin="${CSS.escape(mount.breadboardPin)}"]`)?.classList.add('mounted');});
    drawWires();
    function addPins(el,c,dims){
      const pins=[];
      if(c.kind==='breadboard') { for(let row=0;row<10;row++) for(let col=0;col<20;col++){const letter='ABCDEFGHIJ'[row];const boardY=row<5?14.4+row*7.2:64.8+(row-5)*7.2;const y=boardY*(dims[1]/108);const x=(10.92+col*7.2)*(dims[0]/158.64); pins.push({id:`${c.id}:${letter}${col+1}`,x,y,label:`${letter}${col+1}`});} }
      else if(c.kind==='arduino') { const uno=[['A0',161.972,144],['A1',169.172,144],['A2',176.372,144],['A3',183.573,144],['A4/SDA',190.772,144],['A5/SCL',197.972,144],['ICSP MISO',198.333,64.8],['5V',205.532,64.8],['ICSP SCK',198.333,72],['ICSP MOSI',205.532,72],['RESET',198.333,79.2],['GND',205.532,79.2],['ICSP2 MISO',77.012,16.56],['5V',77.012,23.76],['ICSP2 SCK',69.812,16.56],['ICSP2 MOSI',69.812,23.76],['RESET2',62.611,16.56],['GND',62.611,23.76],['D8',136.051,7.2],['D9 PWM',128.852,7.2],['D10 PWM/SS',121.652,7.2],['D11 PWM/MOSI',114.452,7.2],['D12/MISO',107.252,7.2],['D13/SCK',100.052,7.2],['GND',92.852,7.2],['AREF',85.652,7.2],['A4/SDA',78.452,7.2],['A5/SCL',71.251,7.2],['D0/RX',197.972,7.2],['D1/TX',190.772,7.2],['D2',183.573,7.2],['D3 PWM',176.372,7.2],['D4',169.172,7.2],['D5 PWM',161.972,7.2],['D6 PWM',154.772,7.2],['D7',147.573,7.2],['ioref',104.372,144],['N/C',97.172,144],['RESET',111.573,144],['3V3',118.772,144],['5V',125.972,144],['GND',133.172,144],['GND',140.372,144],['VIN',147.573,144]]; uno.forEach(([label,x,y],i)=>pins.push({id:`${c.id}:${label}-${i}`,x:x*dims[0]/212.372,y:y*dims[1]/151.2,label})); }
      else if(c.kind==='fritzing') { (Array.isArray(c.pins)?c.pins:[]).forEach(p=>pins.push({id:`${c.id}:${p.id}`,x:p.x,y:p.y,label:p.label})); }
      else {pins.push({id:`${c.id}:anode`,x:3,y:35,label:'+'},{id:`${c.id}:kathode`,x:87,y:35,label:'−'});}
      pins.forEach(p=>{const point=document.createElement('button');point.type='button';point.className='pin';const polarity=pinPolarity(p);if(polarity)point.classList.add(`pin-${polarity}`,physicallyConnectedPins.has(p.id)?'pin-connected':'pin-unconnected');if(p.id===pendingPin)point.classList.add('pending');point.setAttribute('aria-label',`${c.name} ${p.label}`);point.dataset.pin=p.id;point.style.left=`${p.x}px`;point.style.top=`${p.y}px`;el.append(point);});
    }
    function drawWires() {
      svg.replaceChildren();
      overlay.replaceChildren();
      kinkOverlay.replaceChildren();
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
        poly.setAttribute('class', `wire ${w===selectedWire?'selected':''}`);
        const visual = poly.cloneNode(false);
        visual.removeAttribute('data-wire');
        visual.dataset.wireVisual = w.id;
        visual.setAttribute('class', `wire-visual ${w===selectedWire?'selected':''}`);
        overlay.append(visual);
        if(w.showLabel){
          const path=[a,...(w.points||[]),b];
          const middle=path[Math.floor((path.length-1)/2)], next=path[Math.ceil((path.length-1)/2)];
          const label=document.createElementNS('http://www.w3.org/2000/svg','text');
          label.setAttribute('x',(middle.x+next.x)/2);label.setAttribute('y',(middle.y+next.y)/2-7);
          label.setAttribute('class','wire-label');label.textContent=w.name||`Draad ${data.wires.indexOf(w)+1}`;
          overlay.append(label);
        }
        if (editing) {
          poly.onpointerenter = () => visual.classList.add('hover');
          poly.onpointerleave = () => visual.classList.remove('hover');
          poly.onclick = () => {
            if (pendingPin) return;
            selectedWire = w;
            selectedKink = null;
            selectedComponentId = null;
            selectedAnnotationId = null;
            activeSelection = 'wire';
            svg.querySelectorAll('.wire').forEach(line=>line.classList.toggle('selected',line.dataset.wire===w.id));
            overlay.querySelectorAll('.wire-visual').forEach(line=>line.classList.toggle('selected',line.dataset.wireVisual===w.id));
            document.querySelectorAll('.part').forEach(part=>part.classList.remove('selected'));
            document.querySelector('#delete-wire').disabled=false;
            renderList();
            renderWirePanel();
            renderKinkPanel();
          };
          poly.ondblclick = e => {
            if (pendingPin) return;
            const point=stagePoint(stage,e.clientX,e.clientY);
            insertWirePoint(w, a, b, {x:Math.round(point.x), y:Math.round(point.y)});
            changed();
          };
        }
        svg.append(poly);
        if (editing) (w.points || []).forEach((p,pointIndex) => {
          const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          dot.setAttribute('cx', p.x);
          dot.setAttribute('cy', p.y);
          dot.setAttribute('r', 6);
          dot.setAttribute('class', `kink ${selectedKink?.wireId===w.id&&selectedKink.index===pointIndex?'selected':''}`);
          dot.onpointerdown = e => {
            e.stopPropagation();
            if (e.button !== 0 || pendingPin) return;
            const startX=p.x,startY=p.y;
            dot.setPointerCapture(e.pointerId);
            dot.onpointermove = ev => {
              const point=snapKinkPoint(w,p,stagePoint(stage,ev.clientX,ev.clientY));
              p.x = point.x;
              p.y = point.y;
              dot.setAttribute('cx',p.x);
              dot.setAttribute('cy',p.y);
              const updated = [a, ...w.points, b].map(q => `${q.x},${q.y}`).join(' ');
              poly.setAttribute('points', updated);
              visual.setAttribute('points', updated);
            };
            dot.onpointerup = () => {
              selectedWire=w;
              selectedKink={wireId:w.id,index:pointIndex};
              selectedComponentId=null;
              activeSelection='kink';
              if(p.x!==startX||p.y!==startY)changed();else render();
            };
          };
          dot.oncontextmenu = event => openKinkMenu(event, w, p);
          kinkOverlay.append(dot);
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
    data.annotations.forEach(annotation=>{
      let element;
      if(annotation.type==='label'){
        element=document.createElement('div');element.className=`annotation annotation-label ${annotation.id===selectedAnnotationId?'selected':''}`;element.dataset.annotation=annotation.id;element.textContent=annotation.text||'Label';element.style.left=`${annotation.x}px`;element.style.top=`${annotation.y}px`;element.style.color=annotation.color||'#203c4e';annotationLabels.append(element);
      }else{
        element=document.createElementNS('http://www.w3.org/2000/svg','line');element.setAttribute('class',`annotation annotation-arrow ${annotation.id===selectedAnnotationId?'selected':''}`);element.dataset.annotation=annotation.id;for(const [key,value] of Object.entries({x1:annotation.x,y1:annotation.y,x2:annotation.x2,y2:annotation.y2}))element.setAttribute(key,value);element.setAttribute('stroke',annotation.color||'#203c4e');element.setAttribute('marker-end','url(#arrowhead)');annotationArrows.append(element);
      }
      if(!editing)return;
      element.onpointerdown=event=>{
        if(event.button!==0)return;event.preventDefault();event.stopPropagation();selectedAnnotationId=annotation.id;selectedComponentId=null;selectedWire=null;selectedKink=null;activeSelection='annotation';
        const start=stagePoint(stage,event.clientX,event.clientY),original={x:annotation.x,y:annotation.y,x2:annotation.x2,y2:annotation.y2};element.setPointerCapture(event.pointerId);
        element.onpointermove=move=>{const point=stagePoint(stage,move.clientX,move.clientY),dx=Math.round(point.x-start.x),dy=Math.round(point.y-start.y);annotation.x=original.x+dx;annotation.y=original.y+dy;if(annotation.type==='arrow'){annotation.x2=original.x2+dx;annotation.y2=original.y2+dy;element.setAttribute('x1',annotation.x);element.setAttribute('y1',annotation.y);element.setAttribute('x2',annotation.x2);element.setAttribute('y2',annotation.y2);}else{element.style.left=`${annotation.x}px`;element.style.top=`${annotation.y}px`;}};
        element.onpointerup=()=>changed();
      };
      element.onclick=event=>{event.stopPropagation();selectedAnnotationId=annotation.id;selectedComponentId=null;selectedWire=null;selectedKink=null;activeSelection='annotation';render();};
    });
    stage.querySelectorAll('.pin').forEach(pin=>pin.onclick=e=>{if(!editing)return;e.stopPropagation();if(!pendingPin){pendingPin=pin.dataset.pin;wirePointer={x:e.clientX,y:e.clientY};pin.classList.add('pending');stage.classList.add('wiring');drawWires();document.querySelector('#wire-mode').textContent='Kies tweede contactpunt';document.querySelector('#notice').textContent='Beginpunt gekozen. Klik nu het tweede contactpunt.';}else connectToPin(pin); });
    stage.onclick=e=>{if(suppressStageClick){suppressStageClick=false;return;}if(pendingPin){connectToPin(nearestPin(e.clientX,e.clientY));return;}if((e.target===stage||e.target===svg||e.target===parts||e.target===kinkOverlay||e.target===annotationArrows||e.target===annotationLabels)&&(selectedWire||selectedAnnotationId)){selectedWire=null;selectedKink=null;selectedAnnotationId=null;activeSelection=null;render();}};
    showDiagnostics(validateConfiguration(width,height));
  }
  function validateConfiguration(width,height){
    const out=[], add=(level,message)=>out.push({level,message});
    const components=Array.isArray(data.components)?data.components:[], wires=Array.isArray(data.wires)?data.wires:[], mounts=Array.isArray(data.mounts)?data.mounts:[];
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
    const connectedPins=new Set(),seenMounts=new Set(),mountedComponentPins=new Set(),occupiedBreadboardPins=new Set();
    mounts.forEach(mount=>{
      const key=`${mount.componentPin}|${mount.breadboardPin}`;
      if(seenMounts.has(key))add('warning','Dezelfde componentmontage komt meerdere keren voor.');else seenMounts.add(key);
      if(mountedComponentPins.has(mount.componentPin))add('error','Een componentpin is aan meerdere breadboardgaten gekoppeld. Plaats het component opnieuw.');else mountedComponentPins.add(mount.componentPin);
      if(occupiedBreadboardPins.has(mount.breadboardPin))add('error','Meerdere componentpinnen gebruiken hetzelfde breadboardgat. Plaats de componenten opnieuw.');else occupiedBreadboardPins.add(mount.breadboardPin);
      if(!pins.has(mount.componentPin)||!pins.has(mount.breadboardPin))add('error','Een componentmontage verwijst naar een onbekend contactpunt. Plaats het component opnieuw op het breadboard.');
      else {connectedPins.add(mount.componentPin);connectedPins.add(mount.breadboardPin);join(mount.componentPin,mount.breadboardPin);}
    });
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
    selectedKink=null;
    selectedAnnotationId=null;
    activeSelection='component';
    document.querySelectorAll('.part').forEach(part=>part.classList.toggle('selected',part.dataset.id===id));
    document.querySelector('#delete-wire').disabled=true;
    renderWirePanel();
    renderKinkPanel();
    renderList();
  }
  function getSelectedKink() {
    if(!selectedKink)return null;
    const wire=data.wires.find(item=>item.id===selectedKink.wireId);
    const point=wire?.points?.[selectedKink.index];
    return wire&&point?{wire,point}:null;
  }
  function renderKinkPanel() {
    const settings=document.querySelector('#kink-settings');
    if(!settings)return;
    const selected=getSelectedKink();
    if(!selected){settings.textContent='Selecteer een knikpunt om de positie te wijzigen.';return;}
    settings.innerHTML=`<div class="kink-controls"><label>X <input data-kink-x type="number" value="${selected.point.x}"></label><label>Y <input data-kink-y type="number" value="${selected.point.y}"></label></div>`;
    [['x','[data-kink-x]'],['y','[data-kink-y]']].forEach(([key,selector])=>{
      const input=settings.querySelector(selector);
      input.onchange=()=>{const value=Number(input.value);if(!Number.isFinite(value)){input.value=selected.point[key];return;}selected.point[key]=value;changed();};
    });
  }
  function renderWirePanel() {
    const list=document.querySelector('#wire-list');
    if(!list)return;
    list.innerHTML=data.wires.map((wire,index)=>{const label=wire.name?.trim()||`Draad ${index+1}`;return `<div class="wire-item ${wire===selectedWire?'selected':''}" data-wire-row="${esc(wire.id)}"><div class="wire-item-heading"><button class="wire-color-trigger" type="button" data-wire-colors aria-label="Kleur van ${esc(label)} wijzigen" aria-expanded="false"><span class="wire-swatch" style="background:${esc(wire.color)}"></span></button><div class="wire-name"><button type="button" data-edit-wire-name title="Naam wijzigen">${esc(label)}</button><input type="text" data-wire-name value="${esc(wire.name||'')}" placeholder="Draad ${index+1}" aria-label="Naam van ${esc(label)}" hidden></div><div class="wire-actions"><input class="label-toggle" type="checkbox" data-wire-show-label ${wire.showLabel?'checked':''} aria-label="Label op stage tonen" title="Label op stage tonen"><button type="button" data-select-wire aria-label="${esc(label)} selecteren" title="Draad selecteren">◎</button><button class="wire-remove" type="button" data-remove-wire aria-label="${esc(label)} verwijderen" title="Draad verwijderen">×</button></div><div class="wire-color-menu" data-wire-color-menu role="group" aria-label="Kies een kleur voor ${esc(label)}" hidden>${WIRE_COLORS.map(([color,name])=>`<button type="button" class="wire-color-option" data-wire-color="${color}" aria-label="${name}" title="${name}" aria-pressed="${wire.color?.toLowerCase()===color?'true':'false'}" style="--wire-option-color:${color}"></button>`).join('')}</div></div></div>`;}).join('')||'<p class="empty-list">Nog geen draden.</p>';
    list.querySelectorAll('[data-wire-row]').forEach(row=>{
      const wire=data.wires.find(item=>item.id===row.dataset.wireRow);
      row.querySelector('[data-select-wire]').onclick=()=>{selectedWire=wire;selectedKink=null;selectedComponentId=null;selectedAnnotationId=null;activeSelection='wire';render();};
      row.querySelector('[data-remove-wire]').onclick=()=>removeWire(wire);
      row.querySelector('[data-wire-show-label]').onchange=event=>{wire.showLabel=event.target.checked;changed();};
      const colorTrigger=row.querySelector('[data-wire-colors]'), colorMenu=row.querySelector('[data-wire-color-menu]');
      colorTrigger.onclick=event=>{
        event.stopPropagation();
        const opening=colorMenu.hidden;
        list.querySelectorAll('[data-wire-color-menu]').forEach(menu=>menu.hidden=true);
        list.querySelectorAll('[data-wire-colors]').forEach(button=>button.setAttribute('aria-expanded','false'));
        colorMenu.hidden=!opening;
        colorTrigger.setAttribute('aria-expanded',opening?'true':'false');
        if(opening)colorMenu.querySelector('[aria-pressed="true"]')?.focus();
      };
      colorMenu.querySelectorAll('[data-wire-color]').forEach(option=>option.onclick=event=>{
        event.stopPropagation();
        wire.color=option.dataset.wireColor;
        selectedWire=wire;
        selectedKink=null;
        selectedComponentId=null;
        activeSelection='wire';
        changed();
      });
      const nameButton=row.querySelector('[data-edit-wire-name]'), input=row.querySelector('[data-wire-name]');
      nameButton.onclick=()=>{nameButton.hidden=true;input.hidden=false;input.focus();input.select();};
      input.onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();input.blur();}if(event.key==='Escape'){input.value=wire.name||'';input.hidden=true;nameButton.hidden=false;nameButton.focus();}};
      input.onblur=()=>{const name=input.value.trim();if(name)wire.name=name;else delete wire.name;changed();};
    });
  }
  function renderAnnotationPanel() {
    const list=document.querySelector('#annotation-list');
    if(!list)return;
    list.innerHTML=data.annotations.map((annotation,index)=>`<div class="annotation-item ${annotation.id===selectedAnnotationId?'selected':''}" data-annotation-row="${esc(annotation.id)}"><strong>${annotation.type==='label'?'Label':'Pijl'} ${index+1}</strong>${annotation.type==='label'?`<label>Tekst <input data-annotation-text type="text" maxlength="120" value="${esc(annotation.text||'')}"></label>`:''}<div class="annotation-coordinates"><label>X <input data-annotation-x type="number" value="${annotation.x}"></label><label>Y <input data-annotation-y type="number" value="${annotation.y}"></label>${annotation.type==='arrow'?`<label>Eind X <input data-annotation-x2 type="number" value="${annotation.x2}"></label><label>Eind Y <input data-annotation-y2 type="number" value="${annotation.y2}"></label>`:''}</div><div class="annotation-actions"><label>Kleur <input data-annotation-color type="color" value="${esc(annotation.color||'#203c4e')}"></label><button data-select-annotation type="button">Selecteer</button><button data-remove-annotation class="danger" type="button">Verwijder</button></div></div>`).join('')||'<p class="empty-list">Nog geen labels of pijlen.</p>';
    list.querySelectorAll('[data-annotation-row]').forEach(row=>{
      const annotation=data.annotations.find(item=>item.id===row.dataset.annotationRow);
      row.querySelector('[data-select-annotation]').onclick=()=>{selectedAnnotationId=annotation.id;selectedComponentId=null;selectedWire=null;selectedKink=null;activeSelection='annotation';render();};
      row.querySelector('[data-remove-annotation]').onclick=()=>removeAnnotation(annotation);
      const text=row.querySelector('[data-annotation-text]');if(text)text.onchange=()=>{annotation.text=text.value.trim()||'Label';changed();};
      for(const key of ['x','y','x2','y2']){const input=row.querySelector(`[data-annotation-${key}]`);if(input)input.onchange=()=>{const value=Number(input.value);if(Number.isFinite(value)){annotation[key]=value;changed();}};}
      row.querySelector('[data-annotation-color]').onchange=event=>{annotation.color=event.target.value;changed();};
    });
  }
  function renderList() {
    const list=document.querySelector('#list');
    const sourceIndex=new Map(data.components.map((component,index)=>[component.id,index]));
    const ordered=[...data.components].sort((a,b)=>componentLayer(b)-componentLayer(a)||(sourceIndex.get(b.id)||0)-(sourceIndex.get(a.id)||0));
    let draggedComponentId=null;
    list.innerHTML=ordered.map(c=>`<div class="item ${c.id===selectedComponentId?'selected':''} ${collapsedComponents.has(c.id)?'collapsed':''} ${c.locked?'is-locked':''}" data-row="${esc(c.id)}"><div class="item-heading"><button class="layer-drag-handle" data-layer-drag draggable="true" type="button" aria-label="${esc(c.name)} naar een andere laag slepen" title="Sleep om laagvolgorde te wijzigen"><span aria-hidden="true">⠿</span></button><button class="collapse-button" data-collapse type="button" aria-expanded="${collapsedComponents.has(c.id)?'false':'true'}" title="${collapsedComponents.has(c.id)?'Uitklappen':'Inklappen'}"><span aria-hidden="true"></span></button><div class="component-title"><button class="component-name" data-edit-name type="button" title="${c.locked?'Ontgrendel het component om de naam te wijzigen':'Naam wijzigen'}" ${c.locked?'disabled':''}>${esc(c.name)||'<em>Naamloos component</em>'}</button><div class="name-editor" hidden><input type="text" data-name value="${esc(c.name)}" aria-label="Naam element" ${c.locked?'disabled':''}></div></div><div class="item-actions"><input class="label-toggle" type="checkbox" data-show-label ${c.showLabel?'checked':''} aria-label="Label op stage tonen" title="Label op stage tonen"><button class="lock-button ${c.locked?'is-locked':''}" data-lock type="button" aria-label="${c.locked?'Ontgrendel':'Vergrendel'} ${esc(c.name)}" title="${c.locked?'Ontgrendelen':'Vergrendelen'}">${c.locked?'🔒':'🔓'}</button><button class="remove-button" data-remove type="button" aria-label="${esc(c.name)} verwijderen" title="Verwijderen">×</button></div></div><div class="item-body"><div class="item-controls"><label>X <input data-x type="number" value="${c.x}" ${c.locked?'disabled':''}></label><label>Y <input data-y type="number" value="${c.y}" ${c.locked?'disabled':''}></label></div><small class="component-kind">${esc(c.kind)}</small></div></div>`).join('')||'<p class="empty-list">Nog geen elementen.</p>';
    list.querySelectorAll('[data-row]').forEach(row=>{
      const c=data.components.find(x=>x.id===row.dataset.row);
      const handle=row.querySelector('[data-layer-drag]');
      handle.ondragstart=event=>{draggedComponentId=c.id;row.classList.add('layer-dragging');event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',c.id);};
      handle.ondragend=()=>{draggedComponentId=null;list.querySelectorAll('.layer-dragging,.drop-before,.drop-after').forEach(item=>item.classList.remove('layer-dragging','drop-before','drop-after'));};
      row.ondragover=event=>{if(!draggedComponentId||draggedComponentId===c.id)return;event.preventDefault();event.dataTransfer.dropEffect='move';const after=event.clientY>row.getBoundingClientRect().top+row.offsetHeight/2;row.classList.toggle('drop-before',!after);row.classList.toggle('drop-after',after);};
      row.ondragleave=event=>{if(!row.contains(event.relatedTarget))row.classList.remove('drop-before','drop-after');};
      row.ondrop=event=>{event.preventDefault();const draggedId=draggedComponentId||event.dataTransfer.getData('text/plain');if(!draggedId||draggedId===c.id)return;const reordered=ordered.filter(component=>component.id!==draggedId),targetIndex=reordered.findIndex(component=>component.id===c.id),after=event.clientY>row.getBoundingClientRect().top+row.offsetHeight/2,draggedComponent=data.components.find(component=>component.id===draggedId);if(!draggedComponent||targetIndex<0)return;reordered.splice(targetIndex+(after?1:0),0,draggedComponent);reordered.forEach((component,index)=>{component.layer=reordered.length-index;});draggedComponentId=null;changed();};
      const nameButton=row.querySelector('[data-edit-name]'), nameEditor=row.querySelector('.name-editor'), nameInput=row.querySelector('[data-name]');
      nameButton.onclick=()=>{if(c.locked)return;nameButton.hidden=true;nameEditor.hidden=false;nameInput.focus();nameInput.select();};
      nameInput.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();nameInput.blur();}if(e.key==='Escape'){nameInput.value=c.name;nameEditor.hidden=true;nameButton.hidden=false;nameButton.focus();}};
      nameInput.onchange=e=>{c.name=e.target.value.trim()||c.name;changed();};
      nameInput.onblur=()=>{if(document.body.contains(row)){nameEditor.hidden=true;nameButton.hidden=false;}};
      ['x','y'].forEach(k=>row.querySelector(`[data-${k}]`).onchange=e=>{if(c.locked)return;c[k]=Number(e.target.value);data.mounts=data.mounts.filter(m=>!m.componentPin.startsWith(c.id+':')&&!m.breadboardPin.startsWith(c.id+':'));changed();});
      row.querySelector('[data-lock]').onclick=()=>{c.locked=!c.locked;changed();};
      row.querySelector('[data-show-label]').onchange=event=>{c.showLabel=event.target.checked;changed();};
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
