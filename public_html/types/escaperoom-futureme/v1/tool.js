(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(window.location.search);
  const roomNav = $('roomNav'), roomEl = $('room'), statusEl = $('status'), successEl = $('success');
  const toolbar = $('toolbar'), progressWrap = $('progressWrap'), progress = $('progress'), progressText = $('progressText'), resetButton = $('reset');
  let config = null, current = 0, state = { answers: {}, marks: {}, hints: {} };
  let instanceId = params.get('unique_id') || 'escaperoom-futureme';
  const storageKey = () => `learning-tools:escaperoom-futureme:v1:${instanceId}`;
  const esc = (v) => String(v ?? '');
  const setStatus = (message, error) => { statusEl.textContent = message || ''; statusEl.className = error ? 'status error' : 'status'; };
  const THEMES = {
    'future-message': { backgroundColor: '#eef3f7', surfaceColor: '#ffffff', mutedSurfaceColor: '#f2f6f9', textColor: '#172033', mutedTextColor: '#40506b', primaryColor: '#14213d', primaryTextColor: '#ffffff', secondaryColor: '#ffffff', secondaryTextColor: '#14213d', accentColor: '#ffb703', borderColor: '#d8e0e8', progressColor: '#236b47', successColor: '#236b47', errorColor: '#9f2d20', hintColor: '#7a5c00', radius: '12px' },
    'midnight-terminal': { backgroundColor: '#0d1424', surfaceColor: '#17233d', mutedSurfaceColor: '#203052', textColor: '#e7f0ff', mutedTextColor: '#a9bad6', primaryColor: '#70e1f5', primaryTextColor: '#07111e', secondaryColor: '#243758', secondaryTextColor: '#e7f0ff', accentColor: '#f8d477', borderColor: '#385071', progressColor: '#70e1f5', successColor: '#85e0a5', errorColor: '#ff9c99', hintColor: '#f8d477', radius: '8px' },
    'paper-case': { backgroundColor: '#f4efe5', surfaceColor: '#fffdf8', mutedSurfaceColor: '#f0eadc', textColor: '#342b25', mutedTextColor: '#6e6258', primaryColor: '#6b3f2a', primaryTextColor: '#fffdf8', secondaryColor: '#f0eadc', secondaryTextColor: '#342b25', accentColor: '#d7953e', borderColor: '#d8cbb8', progressColor: '#5d8063', successColor: '#47704f', errorColor: '#9b443d', hintColor: '#866329', radius: '4px' },
    'signal-green': { backgroundColor: '#08130f', surfaceColor: '#10231b', mutedSurfaceColor: '#173427', textColor: '#d9ffe9', mutedTextColor: '#a3c9b1', primaryColor: '#7cf29a', primaryTextColor: '#07110b', secondaryColor: '#1d4431', secondaryTextColor: '#d9ffe9', accentColor: '#f3dd65', borderColor: '#2b6044', progressColor: '#7cf29a', successColor: '#7cf29a', errorColor: '#ffaaa2', hintColor: '#f3dd65', radius: '10px' },
    'sunset-arcade': { backgroundColor: '#281c3c', surfaceColor: '#3a2854', mutedSurfaceColor: '#4a3261', textColor: '#fff4e6', mutedTextColor: '#e4cce4', primaryColor: '#ff6f91', primaryTextColor: '#29152f', secondaryColor: '#563b6d', secondaryTextColor: '#fff4e6', accentColor: '#ffd166', borderColor: '#78517d', progressColor: '#78dcca', successColor: '#78dcca', errorColor: '#ffb0a8', hintColor: '#ffd166', radius: '16px' }
  };
  const THEME_KEYS = { backgroundColor: '--background-color', surfaceColor: '--surface-color', mutedSurfaceColor: '--muted-surface-color', textColor: '--text-color', mutedTextColor: '--muted-text-color', primaryColor: '--primary-color', primaryTextColor: '--primary-text-color', secondaryColor: '--secondary-color', secondaryTextColor: '--secondary-text-color', accentColor: '--accent-color', borderColor: '--border-color', progressColor: '--progress-color', successColor: '--success-color', errorColor: '--error-color', hintColor: '--hint-color', radius: '--radius' };
  function safeThemeValue(value) { return typeof value === 'string' && value.length <= 80 && !/[;{}<>]/.test(value) && (/^#[0-9a-f]{3,8}$/i.test(value) || /^(?:rgb|hsl)a?\([^)]*\)$/i.test(value) || /^[a-z]+$/i.test(value)); }
  function applyTheme(themeValue) { const custom = typeof themeValue === 'object' && themeValue ? themeValue : {}; const presetName = typeof themeValue === 'string' ? themeValue : custom.preset || 'future-message'; const theme = Object.assign({}, THEMES[presetName] || THEMES['future-message'], custom); Object.entries(THEME_KEYS).forEach(([key, variable]) => { if (safeThemeValue(theme[key])) document.documentElement.style.setProperty(variable, theme[key]); }); document.documentElement.dataset.theme = THEMES[presetName] ? presetName : 'future-message'; }
  const save = () => { if (!config?.persistProgress) return; try { localStorage.setItem(storageKey(), JSON.stringify(state)); } catch (_) {} };
  const load = () => { if (!config?.persistProgress) return; try { const saved = JSON.parse(localStorage.getItem(storageKey()) || 'null'); if (saved && typeof saved === 'object') state = Object.assign(state, saved); } catch (_) {} };
  const room = () => config.rooms[current];
  const answerKey = (roomId, taskId) => `${roomId}:${taskId}`;
  function taskDone(r, task) { return state.answers[answerKey(r.id, task.id)]?.correct === true; }
  function openAsset(asset) {
    const overlay = document.createElement('div'); overlay.className = 'media-modal'; overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true'); overlay.setAttribute('aria-label', asset.caption || 'Bronstuk bekijken');
    const panel = document.createElement('div'); panel.className = 'media-modal__panel';
    const close = document.createElement('button'); close.type = 'button'; close.className = 'media-modal__close'; close.textContent = 'Sluiten';
    const title = document.createElement('h2'); title.className = 'media-modal__title'; title.textContent = asset.caption || 'Bronstuk';
    panel.append(close, title);
    let media;
    if (asset.type === 'image') media = document.createElement('img');
    else if (asset.type === 'video') { media = document.createElement('video'); media.controls = true; }
    else { media = document.createElement('audio'); media.controls = true; }
    media.src = asset.src; media.className = 'media-modal__content';
    if (asset.type === 'image') media.alt = asset.assetAlt || '';
    panel.appendChild(media);
    if (asset.assetAlt) { const alternative = document.createElement('details'); const summary = document.createElement('summary'); summary.textContent = 'Tekstalternatief'; const text = document.createElement('p'); text.textContent = asset.assetAlt; alternative.append(summary, text); panel.appendChild(alternative); }
    overlay.appendChild(panel); document.body.appendChild(overlay);
    const previousFocus = document.activeElement;
    const closeModal = () => { document.removeEventListener('keydown', onKeyDown); overlay.remove(); if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus(); };
    const onKeyDown = (event) => { if (event.key === 'Escape') closeModal(); };
    close.onclick = closeModal;
    overlay.onclick = (event) => { if (event.target === overlay) closeModal(); };
    document.addEventListener('keydown', onKeyDown);
    close.focus();
  }
  function accessibleAsset(asset) {
    const figure = document.createElement('figure'); figure.className = 'asset';
    if (asset.type === 'text') { const p = document.createElement('p'); p.textContent = asset.text || asset.assetAlt; figure.appendChild(p); }
    else if (asset.src) {
      const media = document.createElement(asset.type === 'image' ? 'img' : asset.type); media.src = asset.src;
      if (asset.type === 'image' || asset.type === 'video') media.alt = asset.assetAlt || '';
      if (asset.type === 'video') media.controls = true;
      if (asset.type === 'audio' || asset.type === 'video') media.controls = true;
      if (asset.type === 'image') {
        const preview = document.createElement('a'); preview.className = 'asset-preview'; preview.href = asset.src; preview.target = '_blank'; preview.rel = 'noopener noreferrer'; preview.setAttribute('aria-label', `${asset.caption || 'Afbeelding'} openen in een nieuw tabblad`); preview.appendChild(media); figure.appendChild(preview);
      } else {
        figure.appendChild(media);
        const preview = document.createElement('button'); preview.type = 'button'; preview.className = 'secondary small asset-open'; preview.textContent = 'Bekijk groter'; preview.onclick = () => openAsset(asset); figure.appendChild(preview);
      }
    }
    else { const p = document.createElement('p'); p.textContent = asset.assetAlt || 'Geen lokaal bronbestand opgegeven.'; figure.appendChild(p); }
    if (asset.caption) { const c = document.createElement('figcaption'); c.textContent = asset.caption; figure.appendChild(c); }
    if (asset.type !== 'text' && asset.assetAlt) { const alt = document.createElement('details'); alt.innerHTML = '<summary>Tekstalternatief</summary>'; const p = document.createElement('p'); p.textContent = asset.assetAlt; alt.appendChild(p); figure.appendChild(alt); }
    return figure;
  }
  function terminalBlock(terminalConfig) {
    const box = document.createElement('section'); box.className = 'asset'; box.setAttribute('aria-label', 'Toekomstbericht');
    const output = document.createElement('pre'); output.textContent = '$ verbinding maken…'; output.setAttribute('aria-live', 'off'); box.appendChild(output);
    const alternative = document.createElement('details'); const summary = document.createElement('summary'); summary.textContent = 'Bericht herlezen'; alternative.appendChild(summary); const text = document.createElement('p'); text.textContent = terminalConfig.textAlternative; alternative.appendChild(text); box.appendChild(alternative);
    const play = document.createElement('button'); play.type = 'button'; play.className = 'secondary small'; play.textContent = 'Bericht opnieuw afspelen'; box.appendChild(play);
    let timer = null;
    const playMessage = () => { if (timer) window.clearTimeout(timer); const message = String(terminalConfig.text || terminalConfig.textAlternative || ''); output.textContent = '$ '; let i = 0; const tick = () => { if (i >= message.length) { timer = null; return; } const character = message[i++]; const typo = terminalConfig.mistakes !== false && /[a-z]/i.test(character) && i % 19 === 0; if (typo) { output.textContent += 'x'; timer = window.setTimeout(() => { output.textContent = output.textContent.slice(0, -1) + character; timer = window.setTimeout(tick, 80); }, 100); } else { output.textContent += character; timer = window.setTimeout(tick, 22); } }; tick(); };
    play.onclick = playMessage;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) output.textContent = `$ ${terminalConfig.textAlternative}`; else playMessage();
    return box;
  }
  function optionText(task, id) { return [...(task.items || []), ...(task.options || [])].find((i) => i.id === id)?.text || id; }
  function checkAnswer(r, task, value) {
    let correct = false;
    if (task.type === 'order') correct = JSON.stringify(value) === JSON.stringify(task.expected || (task.items || []).map((i) => i.id));
    if (task.type === 'match' || task.type === 'classify') { const expected = task.expected || {}; const same = (actual, wanted) => Array.isArray(wanted) ? Array.isArray(actual) && actual.length === wanted.length && actual.every((id) => wanted.includes(id)) : actual === wanted; correct = Object.keys(expected).every((key) => same(value[key], expected[key])); }
    if (task.type === 'checklist') { const expected = Array.isArray(task.expected) ? task.expected : []; correct = expected.every((id) => value.includes(id)); }
    if (task.type === 'text') { const text = String(value || '').trim().toLowerCase(); const criteria = Array.isArray(task.expected) ? task.expected : []; correct = text.length >= (task.minLength || 1) && criteria.every((c) => text.includes(String(c).toLowerCase())); }
    state.answers[answerKey(r.id, task.id)] = { value, correct }; save();
    const feedback = task.feedbackCorrect || 'Goed verwerkt. Je kunt verder.';
    const recovery = task.feedbackIncorrect || 'Nog niet compleet. Lees de bron nog eens en probeer opnieuw; je voortgang blijft bewaard.';
    setStatus(correct ? feedback : recovery, !correct); render();
  }
  function taskBlock(r, task) {
    const wrap = document.createElement('fieldset'); wrap.className = 'task';
    const legend = document.createElement('legend'); legend.textContent = task.prompt; wrap.appendChild(legend);
    const key = answerKey(r.id, task.id), previous = state.answers[key]?.value;
    const list = document.createElement('div'); list.className = 'task-items';
    if (task.type === 'order') {
      const ids = Array.isArray(previous) && previous.length ? previous : (task.items || []).map((i) => i.id);
      ids.forEach((id, index) => { const row = document.createElement('div'); row.className = 'choice'; const label = document.createElement('span'); label.textContent = `${index + 1}. ${optionText(task, id)}`; row.appendChild(label); const controls = document.createElement('span'); controls.className = 'controls'; [['omhoog', -1], ['omlaag', 1]].forEach(([labelText, delta]) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'small'; b.textContent = labelText; b.disabled = (delta < 0 && index === 0) || (delta > 0 && index === ids.length - 1); b.onclick = () => { const next = ids.slice(); [next[index], next[index + delta]] = [next[index + delta], next[index]]; state.answers[key] = { value: next, correct: false }; save(); render(); }; controls.appendChild(b); }); row.appendChild(controls); list.appendChild(row); });
      wrap.appendChild(list); addCheck(wrap, r, task, ids);
    } else if (task.type === 'match' || task.type === 'classify') {
      (task.items || r.clues || []).forEach((item) => { const label = document.createElement('div'); label.className = 'choice'; const span = document.createElement('span'); span.textContent = item.text; label.appendChild(span); if (task.type === 'classify' && task.allowMultiple) { const options = document.createElement('span'); options.className = 'task-items'; (task.categories || []).forEach((category) => { const option = document.createElement('label'); option.className = 'choice'; const input = document.createElement('input'); input.type = 'checkbox'; input.dataset.item = item.id; input.value = category; input.checked = Array.isArray(previous?.[item.id]) && previous[item.id].includes(category); option.append(input, document.createTextNode(category)); options.appendChild(option); }); label.appendChild(options); } else { const select = document.createElement('select'); select.dataset.item = item.id; const blank = document.createElement('option'); blank.value = ''; blank.textContent = 'Kies…'; select.appendChild(blank); (task.type === 'match' ? task.options : task.categories || []).forEach((option) => { const o = document.createElement('option'); o.value = option.id || option; o.textContent = option.text || option; select.appendChild(o); }); if (previous?.[item.id]) select.value = previous[item.id]; label.appendChild(select); } list.appendChild(label); }); wrap.appendChild(list); addCheck(wrap, r, task, () => task.type === 'classify' && task.allowMultiple ? Object.fromEntries([...list.querySelectorAll('input[data-item]')].reduce((groups, input) => { (groups[input.dataset.item] ||= []).push(input.value); return groups; }, {})) : Object.fromEntries([...list.querySelectorAll('select')].map((s) => [s.dataset.item, s.value])));
    } else if (task.type === 'checklist') {
      (task.items || []).forEach((item) => { const label = document.createElement('label'); label.className = 'choice'; const input = document.createElement('input'); input.type = 'checkbox'; input.value = item.id; input.checked = Array.isArray(previous) && previous.includes(item.id); label.append(input, document.createTextNode(item.text)); list.appendChild(label); }); wrap.appendChild(list); addCheck(wrap, r, task, () => [...list.querySelectorAll('input:checked')].map((i) => i.value));
    } else {
      const textarea = document.createElement('textarea'); textarea.value = typeof previous === 'string' ? previous : ''; textarea.placeholder = 'Schrijf je antwoord hier…'; textarea.setAttribute('aria-label', task.prompt); wrap.appendChild(textarea); addCheck(wrap, r, task, () => textarea.value); const download = document.createElement('button'); download.type = 'button'; download.className = 'secondary small'; download.textContent = 'Download mijn tekst'; download.onclick = () => { const blob = new Blob([textarea.value], { type: 'text/plain;charset=utf-8' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'futureme-briefing.txt'; a.click(); URL.revokeObjectURL(a.href); setStatus('Je download is gestart. Controleer zelf waar je browser het bestand heeft opgeslagen.'); }; wrap.appendChild(download);
    }
    const saved = state.answers[key]; if (saved) { const p = document.createElement('p'); p.className = saved.correct ? 'feedback' : 'feedback error'; p.textContent = saved.correct ? (task.feedbackCorrect || 'Voltooid.') : (task.feedbackIncorrect || 'Nog niet compleet; je kunt opnieuw proberen.'); wrap.appendChild(p); }
    if (config.allowHints && (r.hints || []).length) { const hintIndex = state.hints[key] || 0; const b = document.createElement('button'); b.type = 'button'; b.className = 'secondary small'; b.textContent = hintIndex < r.hints.length ? `Hint tonen (${hintIndex + 1}/${r.hints.length})` : 'Alle hints getoond'; b.disabled = hintIndex >= r.hints.length; b.onclick = () => { state.hints[key] = hintIndex + 1; save(); render(); }; wrap.appendChild(b); if (hintIndex) { const p = document.createElement('p'); p.className = 'hint'; p.textContent = r.hints[hintIndex - 1]; wrap.appendChild(p); } }
    return wrap;
  }
  function addCheck(wrap, r, task, getValue) { const b = document.createElement('button'); b.type = 'button'; b.className = 'primary'; b.textContent = 'Controleer antwoord'; b.onclick = () => checkAnswer(r, task, typeof getValue === 'function' ? getValue() : getValue); wrap.appendChild(b); }
  function canOpen(index) { const r = config.rooms[index]; return !(r.unlock?.taskIds || []).some((id) => !config.rooms.slice(0, index).some((prior) => (prior.tasks || []).some((t) => t.id === id && taskDone(prior, t)))); }
  function roomDone(r) { return (r.tasks || []).length === 0 || r.tasks.every((t) => taskDone(r, t)); }
  function updateToolbar() { const showProgress = config.showProgress === true && config.rooms.length > 1; const showReset = config.showReset === true; toolbar.hidden = !showProgress && !showReset; progressWrap.hidden = !showProgress; resetButton.hidden = !showReset; toolbar.classList.toggle('bottom', showProgress && config.progressPosition === 'bottom'); if (showProgress) { const completed = config.rooms.filter(roomDone).length; progress.max = Math.max(1, config.rooms.length); progress.value = completed; progressText.textContent = `${completed} van ${config.rooms.length} kamers`; } }
  function renderNav() { roomNav.innerHTML = ''; config.rooms.forEach((r, index) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'room-tab'; b.textContent = `${index + 1}. ${r.title}`; b.setAttribute('aria-current', String(index === current)); b.disabled = !canOpen(index); b.onclick = () => { current = index; setStatus(''); render(); }; roomNav.appendChild(b); }); }
  function render() { if (!config || !config.rooms.length) { roomEl.innerHTML = '<div class="room-card"><p>Geen kamers geconfigureerd.</p></div>'; roomNav.innerHTML = ''; updateToolbar(); return; } const r = room(); roomEl.innerHTML = ''; const card = document.createElement('article'); card.className = 'room-card'; const h = document.createElement('h2'); h.id = 'roomTitle'; h.textContent = r.title; const p = document.createElement('p'); p.className = 'instruction'; p.textContent = r.instruction; card.append(h, p); if (r.terminal) card.appendChild(terminalBlock(r.terminal)); if (r.assets?.length) { const grid = document.createElement('div'); grid.className = 'asset-grid'; r.assets.forEach((a) => grid.appendChild(accessibleAsset(a))); card.appendChild(grid); } if (r.clues?.length) { const details = document.createElement('details'); const summary = document.createElement('summary'); summary.textContent = 'Aanwijzingen markeren'; details.appendChild(summary); r.clues.forEach((clue) => { const label = document.createElement('label'); label.className = 'choice'; const select = document.createElement('select'); select.innerHTML = '<option value="">Nog niet gemarkeerd</option><option value="zeker">Zeker</option><option value="vermoeden">Vermoeden</option><option value="navragen">Nog navragen</option>'; select.value = state.marks[`${r.id}:${clue.id}`] || ''; select.onchange = () => { state.marks[`${r.id}:${clue.id}`] = select.value; save(); }; label.append(document.createTextNode(clue.text), select); details.appendChild(label); }); card.appendChild(details); } (r.tasks || []).forEach((task) => card.appendChild(taskBlock(r, task))); if (r.teacherChecklist?.length) { const box = document.createElement('aside'); box.className = 'teacher-check'; box.innerHTML = '<h3>Docentchecklist</h3><p>Dit zijn bespreekpunten voor de docent; ze vormen geen verborgen automatische beoordeling.</p>'; const ul = document.createElement('ul'); r.teacherChecklist.forEach((item) => { const li = document.createElement('li'); li.textContent = item; ul.appendChild(li); }); box.appendChild(ul); card.appendChild(box); } const done = roomDone(r); if (done && current < config.rooms.length - 1) { const next = document.createElement('button'); next.type = 'button'; next.className = 'primary'; next.textContent = 'Volgende kamer'; next.onclick = () => { current += 1; render(); window.scrollTo(0, 0); }; card.appendChild(next); } roomEl.appendChild(card); renderNav(); const finished = config.rooms.length > 0 && config.rooms.every(roomDone); successEl.hidden = !finished; $('successMessage').textContent = config.successMessage || ''; updateToolbar(); }
  async function start() { try { const dataUrl = params.get('data'); if (!dataUrl) throw new Error('Geen configuratie gekozen.'); const url = new URL(dataUrl, window.location.href); if (!['http:', 'https:'].includes(url.protocol)) throw new Error('De configuratie moet via HTTP of HTTPS worden geladen.'); const response = await fetch(url.href); if (!response.ok) throw new Error(`Configuratie laden mislukt (HTTP ${response.status}).`); config = await response.json(); if (!config || !Array.isArray(config.rooms)) throw new Error('Ongeldige configuratie: rooms ontbreekt.'); instanceId = params.get('unique_id') || config.unique_id || instanceId; document.title = config.title || 'FutureMe'; applyTheme(config.theme); load(); render(); } catch (error) { setStatus(error.message || 'Configuratie laden mislukt.', true); roomEl.innerHTML = '<div class="room-card"><p>Controleer de data-URL en probeer daarna opnieuw.</p></div>'; } }
  $('reset').onclick = () => { try { localStorage.removeItem(storageKey()); } catch (_) {} state = { answers: {}, marks: {}, hints: {} }; current = 0; setStatus('Alleen de lokale voortgang van deze instantie is gewist.'); render(); };
  start();
}());
