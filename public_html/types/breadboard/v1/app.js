(() => {
  'use strict';
  const params = new URLSearchParams(location.search);
  const editing = params.get('mode') === 'config';
  const parentOrigin = (() => { try { return new URL(params.get('parentOrigin') || document.referrer).origin; } catch (_) { return ''; } })();
  const app = document.querySelector('#app');
  const credit = document.querySelector('#credit');
  setTimeout(() => { credit.classList.add('done'); setTimeout(() => credit.remove(), 400); }, 5000);
  const initial = { canvasWidth: 1000, canvasHeight: 620, components: [{id:'breadboard-1',kind:'breadboard',name:'Breadboard',x:36,y:48,locked:false},{id:'arduino-1',kind:'arduino',name:'Arduino Uno',x:555,y:100,locked:false},{id:'led-1',kind:'component',name:'LED',x:320,y:210,locked:false}], wires:[] };
  let data = structuredClone(initial), pendingPin = null, selectedWire = null, drag = null;
  const clone = value => JSON.parse(JSON.stringify(value));
  const send = () => { if (editing && parent !== window && parentOrigin && parentOrigin !== 'null') parent.postMessage({type:'learning-tool:config-change', value:clone(data)}, parentOrigin); };
  const load = value => { if (!value || typeof value !== 'object') return; value=value.configuratie||value; data = {...clone(initial),...clone(value)}; data.components = Array.isArray(data.components) ? data.components.filter(c=>c&&typeof c==='object') : []; data.wires = Array.isArray(data.wires) ? data.wires.filter(w=>w&&typeof w==='object').map(w=>({...w,points:Array.isArray(w.points)?w.points:[]})) : []; render(); };
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
  function render() {
    const width = Math.max(480, Number(data.canvasWidth) || 1000), height = Math.max(320, Number(data.canvasHeight) || 620);
    app.innerHTML = `<div class="layout ${editing?'':'readonly'}"><section><div class="toolbar" ${editing?'':'hidden'}><button data-add="breadboard">＋ Breadboard</button><button data-add="arduino">＋ Arduino Uno</button><button data-add="component">＋ Component</button><label>Breedte <input data-size="canvasWidth" type="number" min="480" max="2400" value="${width}"></label><label>Hoogte <input data-size="canvasHeight" type="number" min="320" max="1800" value="${height}"></label><button id="wire-mode">${pendingPin?'Kies tweede contactpunt':'Draad verbinden'}</button><button id="delete-wire" ${selectedWire?'':'disabled'}>Verwijder geselecteerde draad</button></div><div class="stage-wrap"><div class="stage" id="stage" style="width:${width}px;height:${height}px"><svg id="wires" width="${width}" height="${height}" style="position:absolute;inset:0;overflow:visible"></svg><div id="parts"></div></div></div><div class="diagnostics" id="diagnostics" aria-live="polite"></div><div class="notice" id="notice">${editing?'Klik twee contactpunten om een draad te verbinden. Klik een draad om een knikpunt toe te voegen.':'Schakeling'}</div></section><aside class="panel" ${editing?'':'hidden'}><h2>Elementen</h2><div id="list"></div><h3>Geselecteerde draad</h3><div id="wire-settings">${selectedWire?`<label>Kleur <input id="wire-color" type="color" value="${selectedWire.color}"></label>`:'Selecteer een draad om de kleur te wijzigen.'}</div></aside></div>`;
    const stage = document.querySelector('#stage'), parts = document.querySelector('#parts'), svg = document.querySelector('#wires');
    if (editing) {
      document.querySelectorAll('[data-add]').forEach(b => b.onclick = () => { const kind=b.dataset.add, n=data.components.filter(c=>c.kind===kind).length+1; data.components.push({id:`${kind}-${Date.now()}`,kind,name:kind==='arduino'?'Arduino Uno':kind==='breadboard'?'Breadboard':`Component ${n}`,x:80+n*22,y:90+n*22,locked:false}); changed(); });
      document.querySelectorAll('[data-size]').forEach(i => i.onchange = () => { data[i.dataset.size]=Number(i.value); changed(); });
      document.querySelector('#wire-mode').onclick = () => { pendingPin=null; document.querySelector('#notice').textContent='Klik een begincontactpunt en daarna een eindcontactpunt.'; };
      document.querySelector('#delete-wire').onclick = () => { data.wires=data.wires.filter(w=>w.id!==selectedWire?.id); selectedWire=null; changed(); };
      renderList();
    }
    data.components.forEach(c => {
      const dims = c.kind==='breadboard'?[317,216]:c.kind==='arduino'?[250,178]:[90,70];
      const el=document.createElement('div'); el.className=`part ${c.locked?'locked':''}`; el.dataset.id=c.id; el.style.cssText=`left:${c.x}px;top:${c.y}px;width:${dims[0]}px;height:${dims[1]}px`;
      const img=c.kind==='breadboard'?'assets/fritzing-tiny-breadboard.svg':c.kind==='arduino'?'assets/fritzing-arduino-uno.svg':'';
      el.innerHTML=`<span class="part-label">${esc(c.name)}</span>${img?`<img draggable="false" src="${img}" alt="${esc(c.name)}">`:`<svg viewBox="0 0 90 70" width="100%" height="100%"><rect x="16" y="15" width="58" height="38" rx="8" fill="#2f4858" stroke="#132531"/><path d="M18 35H3m71 0h13" stroke="#d8ad30" stroke-width="5"/><circle cx="3" cy="35" r="4" fill="#ffdc62"/><circle cx="87" cy="35" r="4" fill="#ffdc62"/></svg>`}`;
      parts.append(el); addPins(el,c,dims);
      if (editing) el.onpointerdown=e=>{ if(e.target.classList.contains('pin')||c.locked)return; const bounds=el.getBoundingClientRect(); drag={component:c,el,dx:e.clientX-bounds.left,dy:e.clientY-bounds.top}; el.setPointerCapture(e.pointerId); };
      if (editing) el.onpointermove=e=>{ if(!drag||drag.el!==el)return; const r=stage.getBoundingClientRect(); c.x=Math.round(e.clientX-r.left-drag.dx); c.y=Math.round(e.clientY-r.top-drag.dy); el.style.left=`${c.x}px`;el.style.top=`${c.y}px`;drawWires(); };
      if (editing) el.onpointerup=()=>{ if(drag?.el===el){drag=null;changed(false);} };
    });
    drawWires();
    function addPins(el,c,dims){
      const pins=[];
      if(c.kind==='breadboard') { for(let row=0;row<10;row++) for(let col=0;col<20;col++){const letter='ABCDEFGHIJ'[row];const boardY=row<5?14.4+row*7.2:64.8+(row-5)*7.2;const y=boardY*(dims[1]/108);const x=(10.92+col*7.2)*(dims[0]/158.64); pins.push({id:`${c.id}:${letter}${col+1}`,x,y,label:`${letter}${col+1}`});} }
      else if(c.kind==='arduino') { const uno=[['A0',161.972,144],['A1',169.172,144],['A2',176.372,144],['A3',183.573,144],['A4/SDA',190.772,144],['A5/SCL',197.972,144],['ICSP MISO',198.333,64.8],['5V',205.532,64.8],['ICSP SCK',198.333,72],['ICSP MOSI',205.532,72],['RESET',198.333,79.2],['GND',205.532,79.2],['ICSP2 MISO',77.012,16.56],['5V',77.012,23.76],['ICSP2 SCK',69.812,16.56],['ICSP2 MOSI',69.812,23.76],['RESET2',62.611,16.56],['GND',62.611,23.76],['D8',136.051,7.2],['D9 PWM',128.852,7.2],['D10 PWM/SS',121.652,7.2],['D11 PWM/MOSI',114.452,7.2],['D12/MISO',107.252,7.2],['D13/SCK',100.052,7.2],['GND',92.852,7.2],['AREF',85.652,7.2],['A4/SDA',78.452,7.2],['A5/SCL',71.251,7.2],['D0/RX',197.972,7.2],['D1/TX',190.772,7.2],['D2',183.573,7.2],['D3 PWM',176.372,7.2],['D4',169.172,7.2],['D5 PWM',161.972,7.2],['D6 PWM',154.772,7.2],['D7',147.573,7.2],['ioref',104.372,144],['N/C',97.172,144],['RESET',111.573,144],['3V3',118.772,144],['5V',125.972,144],['GND',133.172,144],['GND',140.372,144],['VIN',147.573,144]]; uno.forEach(([label,x,y],i)=>pins.push({id:`${c.id}:${label}-${i}`,x:x*dims[0]/212.372,y:y*dims[1]/151.2,label})); }
      else {pins.push({id:`${c.id}:anode`,x:3,y:35,label:'+'},{id:`${c.id}:kathode`,x:87,y:35,label:'−'});}
      pins.forEach(p=>{const point=document.createElement('button');point.type='button';point.className='pin';point.title=p.label;point.setAttribute('aria-label',`${c.name} ${p.label}`);point.dataset.pin=p.id;point.style.left=`${p.x}px`;point.style.top=`${p.y}px`;el.append(point);});
    }
    function drawWires(){ svg.innerHTML=''; const lookup=id=>{if(typeof id!=='string')return null;const [cid]=id.split(':');const c=data.components.find(x=>x.id===cid);if(!c)return null;const target=parts.querySelector(`[data-id="${CSS.escape(cid)}"] [data-pin="${CSS.escape(id)}"]`);if(!target)return null;const stageRect=stage.getBoundingClientRect(),r=target.getBoundingClientRect();return{x:r.left+r.width/2-stageRect.left,y:r.top+r.height/2-stageRect.top};};
      data.wires.forEach(w=>{const a=lookup(w.from),b=lookup(w.to);if(!a||!b)return;const pts=[a,...(w.points||[]),b];const poly=document.createElementNS('http://www.w3.org/2000/svg','polyline');poly.dataset.wire=w.id;poly.setAttribute('points',pts.map(p=>`${p.x},${p.y}`).join(' '));poly.setAttribute('stroke',w.color);poly.setAttribute('class','wire');if(editing) poly.onclick=e=>{selectedWire=w;const r=stage.getBoundingClientRect();w.points.push({x:Math.round(e.clientX-r.left),y:Math.round(e.clientY-r.top)});render();};svg.append(poly);if(editing)(w.points||[]).forEach(p=>{const dot=document.createElementNS('http://www.w3.org/2000/svg','circle');dot.setAttribute('cx',p.x);dot.setAttribute('cy',p.y);dot.setAttribute('r',6);dot.setAttribute('class','kink');dot.onpointerdown=e=>{e.stopPropagation();dot.setPointerCapture(e.pointerId);dot.onpointermove=ev=>{const r=stage.getBoundingClientRect();p.x=Math.round(ev.clientX-r.left);p.y=Math.round(ev.clientY-r.top);dot.setAttribute('cx',p.x);dot.setAttribute('cy',p.y);poly.setAttribute('points',[a,...w.points,b].map(q=>`${q.x},${q.y}`).join(' '));};dot.onpointerup=()=>changed(false);};svg.append(dot);}); });
    }
    stage.querySelectorAll('.pin').forEach(pin=>pin.onclick=e=>{if(!editing)return;e.stopPropagation();if(!pendingPin){pendingPin=pin.dataset.pin;pin.classList.add('pending');document.querySelector('#notice').textContent='Beginpunt gekozen. Klik nu het tweede contactpunt.';}else if(pendingPin!==pin.dataset.pin){data.wires.push({id:`wire-${Date.now()}`,from:pendingPin,to:pin.dataset.pin,color:'#e53935',points:[]});pendingPin=null;changed();} });
    svg.onclick=e=>{if(e.target!==svg)return; if(selectedWire){const box=stage.getBoundingClientRect();selectedWire.points.push({x:e.clientX-box.left,y:e.clientY-box.top});changed();}};
    const color=document.querySelector('#wire-color'); if(color)color.oninput=()=>{selectedWire.color=color.value;const line=document.querySelector(`[data-wire="${CSS.escape(selectedWire.id)}"]`);if(line)line.setAttribute('stroke',color.value);send();};
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
      if(!['breadboard','arduino','component'].includes(c.kind))add('error',`Element ${c.name||c.id} heeft een onbekend type.`);
      if(!Number.isFinite(Number(c.x))||!Number.isFinite(Number(c.y)))add('error',`Element ${c.name||c.id} heeft geen geldige positie.`);
      const size=c.kind==='breadboard'?[317,216]:c.kind==='arduino'?[250,178]:[90,70];
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
  function renderList(){const list=document.querySelector('#list');list.innerHTML=data.components.map(c=>`<div class="item" data-row="${esc(c.id)}"><small>${esc(c.kind)}</small><input type="text" data-name value="${esc(c.name)}" aria-label="Naam element"><div class="item-controls"><label>X <input data-x type="number" value="${c.x}" style="width:65px"></label><label>Y <input data-y type="number" value="${c.y}" style="width:65px"></label><button data-lock>${c.locked?'Ontgrendel':'Vergrendel'}</button><button data-remove>Verwijder</button></div></div>`).join('')||'<p>Nog geen elementen.</p>';list.querySelectorAll('[data-row]').forEach(row=>{const c=data.components.find(x=>x.id===row.dataset.row);row.querySelector('[data-name]').onchange=e=>{c.name=e.target.value;changed();};['x','y'].forEach(k=>row.querySelector(`[data-${k}]`).onchange=e=>{c[k]=Number(e.target.value);changed();});row.querySelector('[data-lock]').onclick=()=>{c.locked=!c.locked;changed();};row.querySelector('[data-remove]').onclick=()=>{data.components=data.components.filter(x=>x!==c);data.wires=data.wires.filter(w=>!w.from.startsWith(c.id+':')&&!w.to.startsWith(c.id+':'));changed();};});}
  function changed(rerender=true){if(rerender)render();else{drawNow();if(editing)renderList();send();}}
  function drawNow(){render();}
  function esc(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
})();
