(function () {
    const screenEl = document.getElementById('screen');
    const cursorEl = document.getElementById('cursor');
    const hintEl = document.getElementById('hint');
    const metaEl = document.getElementById('metaLine');
    if (!screenEl || !cursorEl) return;

    const params = new URLSearchParams(window.location.search);
    const dataUrl = params.get('data') || '';

    const setHint = (text, kind = '') => {
        if (!hintEl) return;
        hintEl.textContent = text || '';
        hintEl.style.color = kind === 'error' ? '#fca5a5' : 'rgba(229,231,235,0.75)';
    };

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    const parseTextToTokens = (text) => {
        const tokens = [];
        for (let i = 0; i < text.length; i++) {
            const ch = text[i];
            if (ch === '|') {
                // Support literal pipe by doubling: "||" => "|"
                if (text[i + 1] === '|') {
                    tokens.push({kind: 'char', ch: '|'});
                    i++;
                    continue;
                }
                tokens.push({kind: 'backspace'});
                continue;
            }
            tokens.push({kind: 'char', ch});
        }
        return tokens;
    };

    const isLetter = (ch) => /^[a-z]$/i.test(ch);

    const randomLetter = () => {
        const letters = 'abcdefghijklmnopqrstuvwxyz';
        return letters[Math.floor(Math.random() * letters.length)];
    };

    const delayForChar = (ch, speed = 1) => {
        const s = Math.max(0.2, Math.min(3, Number(speed) || 1));
        const base = (() => {
            if (ch === ' ') return 14;
            if (ch === '\n') return 180;
            if (/[.,;:!?]/.test(ch)) return 120;
            if (/[()\\[\\]{}]/.test(ch)) return 85;
            if (/[0-9]/.test(ch)) return 70;
            return 55;
        })();
        const jitter = (Math.random() - 0.5) * base * 0.9;
        const ms = (base + jitter) / s;
        return Math.max(8, Math.round(ms));
    };

    const positionCursor = () => {
        // We simulate cursor position by measuring the last line length in monospace.
        // This is approximate but good enough visually.
        const text = screenEl.textContent || '';
        const lines = text.split('\n');
        const last = lines[lines.length - 1] || '';

        const fontSize = parseFloat(getComputedStyle(screenEl).fontSize || '18') || 18;
        const lineHeight = parseFloat(getComputedStyle(screenEl).lineHeight || String(fontSize * 1.35)) || (fontSize * 1.35);
        const charW = fontSize * 0.62;

        const left = 16 + Math.min(last.length, 120) * charW;
        const top = 54 + (lines.length - 1) * lineHeight;

        cursorEl.style.left = `${left}px`;
        cursorEl.style.top = `${top}px`;
    };

    const render = () => {
        positionCursor();
    };

    const run = async (config) => {
        const text = String(config.text || config.message || '');
        if (!text) {
            setHint('Geen tekst gevonden in JSON (verwacht: {"text": "..."}).', 'error');
            return;
        }

        const speed = config.speed ?? 1;
        const mistakes = config.mistakes !== false;
        const mistakeRate = Math.max(0, Math.min(0.25, Number(config.mistake_rate ?? 0.035) || 0.035));
        const showCursor = config.cursor !== false;

        if (metaEl) {
            metaEl.textContent = config.title ? String(config.title) : '';
        }

        cursorEl.style.display = showCursor ? 'block' : 'none';

        const tokens = parseTextToTokens(text);
        let out = '';
        screenEl.textContent = out;
        render();

        for (let i = 0; i < tokens.length; i++) {
            const t = tokens[i];
            if (t.kind === 'backspace') {
                out = out.slice(0, -1);
                screenEl.textContent = out;
                render();
                await sleep(Math.max(18, delayForChar('x', speed) * 0.7));
                continue;
            }

            const ch = t.ch;

            if (mistakes && isLetter(ch) && Math.random() < mistakeRate) {
                const wrong = randomLetter();
                out += wrong;
                screenEl.textContent = out;
                render();
                await sleep(delayForChar(wrong, speed));
                // backspace
                out = out.slice(0, -1);
                screenEl.textContent = out;
                render();
                await sleep(Math.max(18, delayForChar('x', speed) * 0.7));
            }

            out += ch;
            screenEl.textContent = out;
            render();
            await sleep(delayForChar(ch, speed));
        }

        setHint('Klaar.');
    };

    const load = async () => {
        if (!dataUrl) {
            setHint('Geen data URL meegegeven. Gebruik ?data=https://.../learn-tool/<course>/assignment-data/<file>.json', 'error');
            return;
        }
        try {
            const res = await fetch(String(dataUrl), {cache: 'no-store'});
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            await run(json || {});
        } catch (e) {
            setHint(`Kon JSON niet laden: ${String(e.message || e)}`, 'error');
        }
    };

    load();
})();

