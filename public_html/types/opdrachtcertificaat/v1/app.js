(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const sdk = window.LearningToolsCertificate;
  const endpoint = new URL('./api.php', location.href);
  let config, attemptId, storageKey, coordinator, progress, issued = null, pending = null, busy = false;
  function error(message) { $('error').textContent = message; $('error').hidden = !message; }
  async function api(body) {
    const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store' });
    const value = await response.json();
    if (!response.ok) { const failure = Error(value.error || 'De certificaatdienst is niet bereikbaar.'); failure.status = response.status; throw failure; }
    return value;
  }
  function save() { return sdk.write(storageKey, { attemptId, issued, pending }); }
  function payload(envelope) { return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(envelope.payload), c => c.charCodeAt(0)))); }
  function render() {
    if (!progress) return;
    const done = progress.results.length - progress.remaining;
    $('progress').max = progress.results.length; $('progress').value = done;
    $('progressText').textContent = `${done} van ${progress.results.length} opdrachten afgerond`;
    $('tasks').replaceChildren();
    for (const task of progress.results) {
      const li = document.createElement('li'), icon = document.createElement('span'), text = document.createElement('div'), hint = document.createElement('small');
      icon.textContent = task.result ? '✓' : '○'; icon.setAttribute('aria-hidden', 'true');
      text.textContent = task.title;
      hint.textContent = task.result ? 'Goed gemaakt' : task.connected ? 'Nog afronden' : 'Wacht op deze opdracht. Scroll zo nodig naar de oefening.';
      text.append(hint); li.append(icon, text); $('tasks').append(li);
    }
    const ready = progress.remaining === 0;
    $('earned').hidden = !ready && !issued; $('identity').hidden = !ready && !issued && !pending;
    $('certificate').classList.toggle('celebrate', ready || Boolean(issued));
    $('download').disabled = busy || (!ready && !issued && !pending);
    $('download').textContent = busy ? 'Certificaat ophalen…' : issued ? 'Download mijn certificaat opnieuw' : pending ? 'Certificaat opnieuw ophalen' : 'Download mijn certificaat';
    $('studentName').disabled = Boolean(issued || pending || busy); $('studentClass').disabled = Boolean(issued || pending || busy);
    $('newAttempt').hidden = !issued;
    if (issued) {
      const data = payload(issued);
      $('studentName').value = data.studentName; $('studentClass').value = data.studentClass;
      $('receipt').textContent = `Uitgegeven aan ${data.studentName}, ${data.studentClass}, op ${new Date(data.issuedAt).toLocaleString('nl-NL')}.`;
    }
    $('receipt').hidden = !issued;
  }
  function connect() {
    coordinator?.close();
    coordinator = sdk.coordinator(config, attemptId, state => { progress = state; render(); });
  }
  async function start() {
    $('retry').hidden = true; error('');
    try {
      const url = new URL(new URL(location.href).searchParams.get('data') || './example.json', location.href);
      if (!['https:', 'http:'].includes(url.protocol)) throw Error('Gebruik een HTTP(S) configuratie-URL.');
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw Error('De configuratie kon niet worden geladen.');
      const requested = await response.json();
      // The server owns the required list; a client cannot shorten it to obtain a certificate.
      config = await api({ action: 'manifest', groupId: requested.groupId, revision: requested.revision });
      if (!Array.isArray(requested.requiredTools) || requested.requiredTools.length !== config.requiredTools.length || !requested.requiredTools.every((t, i) => t && t.id === config.requiredTools[i].id && t.title === config.requiredTools[i].title)) throw Error('De opdrachtenlijst wijkt af van de serverconfiguratie. Laat de docent de configuratie bijwerken.');
      $('title').textContent = config.title; document.title = config.title;
      $('intro').textContent = requested.description || 'Maak alle opdrachten op deze pagina en download jouw certificaat.';
      storageKey = `learning-tools:certificate-attempt:v1:${JSON.stringify([config.groupId, config.revision])}`;
      const stored = sdk.read(storageKey);
      attemptId = stored?.attemptId || crypto.randomUUID(); issued = stored?.issued || null; pending = stored?.pending || null;
      if (pending) { $('studentName').value = pending.studentName; $('studentClass').value = pending.studentClass; }
      if (!save()) error('Je browser bewaart de voortgang niet. Houd dit tabblad open tot je het certificaat hebt gedownload.');
      connect();
    } catch (e) { error(e.message); $('retry').hidden = false; }
  }
  $('identity').addEventListener('submit', async event => {
    event.preventDefault(); if (busy) return;
    if (!issued && !pending && progress?.remaining !== 0) return;
    busy = true; error(''); render();
    try {
      if (!issued) {
        pending ||= { action: 'issue', groupId: config.groupId, revision: config.revision, attemptId, studentName: $('studentName').value.trim(), studentClass: $('studentClass').value.trim(), results: progress.results.map(t => ({ id: t.id, completed: true, score: t.result.score, completedAt: t.result.completedAt })) };
        save();
        issued = await api(pending); pending = null; save();
      }
      const blob = new Blob([JSON.stringify(issued, null, 2) + '\n'], { type: 'application/json' });
      const a = document.createElement('a'); const url = URL.createObjectURL(blob);
      a.href = url; a.download = `certificaat-${config.groupId}-${payload(issued).certificateId}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (e) {
      if (e.status === 400) { pending = null; save(); error(`${e.message} Controleer je gegevens en probeer opnieuw.`); }
      else error(`${e.message} Gebruik opnieuw ophalen voor dezelfde aanvraag; je naam en klas blijven vaststaan.`);
    }
    finally { busy = false; render(); }
  });
  $('newAttempt').addEventListener('click', () => {
    if (!confirm('Een nieuwe poging begint zonder afgeronde opdrachten. Het eerder uitgegeven certificaat blijft geldig. Doorgaan?')) return;
    attemptId = crypto.randomUUID(); issued = null; pending = null; save();
    $('studentName').value = ''; $('studentClass').value = ''; error(''); connect();
  });
  $('retry').addEventListener('click', start);
  start();
})();
