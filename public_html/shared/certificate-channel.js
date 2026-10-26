/* Same-origin peers within one top-level page. No Canvas parent script required. */
(() => {
  'use strict';
  const protocol = 'learning-tools-certificate-v1';
  const read = key => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } };
  const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } };
  const remove = key => { try { localStorage.removeItem(key); } catch {} };
  function peer(onMessage) {
    const id = crypto.randomUUID();
    const send = (target, event, payload) => {
      try { target.postMessage({ protocol, sender: id, event, payload }, location.origin); } catch {}
    };
    function announce(event, payload) {
      let budget = 150;
      function visit(frame, depth) {
        if (--budget < 0 || depth > 8) return;
        if (frame !== window) send(frame, event, payload);
        try { for (let i = 0; i < frame.length; i++) visit(frame.frames[i], depth + 1); } catch {}
      }
      visit(window.top, 0);
    }
    const listener = event => {
      const message = event.data;
      if (event.origin !== location.origin || !event.source || !message || message.protocol !== protocol || message.sender === id) return;
      try { if (event.source.top !== window.top) return; } catch { return; }
      if (typeof message.sender !== 'string' || typeof message.event !== 'string') return;
      onMessage(message, event.source, send);
    };
    window.addEventListener('message', listener);
    return { id, send, announce, close() { window.removeEventListener('message', listener); } };
  }
  function participant({ uniqueId, getState, onScope, onProgress }) {
    let host = null, hostId = null, context = null, lastSeen = 0;
    const bus = peer((message, source, send) => {
      const p = message.payload;
      if (message.event === 'certificate.hello') {
        if (!p || !Array.isArray(p.requiredTools) || !p.requiredTools.some(t => t && t.id === uniqueId) || typeof p.groupId !== 'string' || typeof p.revision !== 'string' || typeof p.attemptId !== 'string') return;
        if (host && host !== source && Date.now() - lastSeen < 7000) return;
        const changed = !context || context.groupId !== p.groupId || context.revision !== p.revision || context.attemptId !== p.attemptId;
        host = source; hostId = message.sender; context = p; lastSeen = Date.now();
        if (changed) onScope(p);
        send(host, 'tool.state', { groupId: p.groupId, revision: p.revision, attemptId: p.attemptId, uniqueId, result: getState() });
      } else if (message.event === 'certificate.progress' && source === host && message.sender === hostId && p && p.attemptId === context?.attemptId && Number.isInteger(p.remaining) && p.remaining >= 0) {
        lastSeen = Date.now(); onProgress(p);
      }
    });
    const timer = setInterval(() => {
      if (host && Date.now() - lastSeen > 7000) { host = null; hostId = null; context = null; onScope(null); }
    }, 2000);
    return {
      publish() { if (host && context) bus.send(host, 'tool.state', { groupId: context.groupId, revision: context.revision, attemptId: context.attemptId, uniqueId, result: getState() }); },
      close() { clearInterval(timer); bus.close(); },
    };
  }
  function coordinator(config, attemptId, onChange) {
    const context = { groupId: config.groupId, revision: config.revision, attemptId, requiredTools: config.requiredTools };
    const states = new Map(), sources = new Map();
    const bus = peer((message, source) => {
      const p = message.payload;
      if (message.event !== 'tool.state' || !p || p.groupId !== context.groupId || p.revision !== context.revision || p.attemptId !== attemptId || !config.requiredTools.some(t => t.id === p.uniqueId)) return;
      const result = p.result;
      if (result !== null && (!result || result.completed !== true || typeof result.completedAt !== 'string' || !Number.isFinite(Date.parse(result.completedAt)))) return;
      sources.set(p.uniqueId, source); states.set(p.uniqueId, result); update();
    });
    function update() {
      const results = config.requiredTools.map(t => ({ id: t.id, title: t.title, connected: sources.has(t.id), result: states.get(t.id) || null }));
      const remaining = results.filter(t => !t.result).length;
      for (const source of sources.values()) bus.send(source, 'certificate.progress', { attemptId, remaining });
      onChange({ results, remaining });
    }
    const hello = () => bus.announce('certificate.hello', context);
    hello(); update(); const timer = setInterval(hello, 2000);
    return { close() { clearInterval(timer); bus.close(); } };
  }
  window.LearningToolsCertificate = { peer, participant, coordinator, read, write, remove };
})();
