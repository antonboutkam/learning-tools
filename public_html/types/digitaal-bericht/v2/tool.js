(function () {
    'use strict';

    const screen = document.getElementById('screen');
    const cursor = document.getElementById('cursor');
    const terminal = document.getElementById('terminal');
    const hint = document.getElementById('hint');
    const accessibleText = document.getElementById('accessibleText');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let timer = null;
    let complete = null;

    // A single pipe deletes the preceding character; a double pipe prints a pipe.
    function tokenize(text) {
        const characters = Array.from(text);
        const tokens = [];
        for (let i = 0; i < characters.length; i++) {
            if (characters[i] === '|') {
                if (characters[i + 1] === '|') {
                    tokens.push('|');
                    i++;
                } else {
                    tokens.push(null);
                }
            } else {
                tokens.push(characters[i]);
            }
        }
        return tokens;
    }

    function finalText(tokens) {
        const result = [];
        tokens.forEach((token) => token === null ? result.pop() : result.push(token));
        return result.join('');
    }

    function numberInRange(value, fallback, min, max) {
        const number = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
        return Math.max(min, Math.min(max, number));
    }

    function show(config) {
        if (!config || typeof config !== 'object' || typeof config.text !== 'string' || !config.text.trim()) {
            throw new Error('Dit bericht bevat geen tekst.');
        }
        document.title = config.title || 'Bericht';
        hint.hidden = true;
        const tokens = tokenize(config.text);
        const fullText = finalText(tokens);
        // Half the previous typing rate, including correction and hesitation pauses.
        const speed = numberInRange(config.speed, 1, 0.2, 3) * 0.5;
        const mistakeRate = numberInRange(config.mistake_rate, 0.035, 0, 0.25);
        let position = 0;
        let output = [];
        let finished = false;
        // Screen readers receive the whole message once, without character-by-character announcements.
        accessibleText.textContent = fullText;

        let visibleText = '';
        const measure = document.createElement('canvas').getContext('2d');
        function render(text, follow = true) {
            const atBottom = terminal.scrollHeight - terminal.scrollTop - terminal.clientHeight < 48;
            visibleText = text;
            const style = getComputedStyle(terminal);
            measure.font = `${style.fontSize} ${style.fontFamily}`;
            const width = terminal.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
            // Reserve two characters for the prompt and one for the cursor.
            const columns = Math.max(1, Math.floor(width / measure.measureText('M').width) - 3);
            const lines = [];
            let paragraphBreak = false;
            text.split('\n').forEach((paragraph) => {
                if (!paragraph.trim()) {
                    paragraphBreak = lines.length > 0;
                    return;
                }
                if (paragraphBreak) lines.push('');
                paragraphBreak = false;
                let chars = Array.from(paragraph);
                while (chars.length > columns) {
                    const space = chars.slice(0, columns).lastIndexOf(' ');
                    const end = space > columns / 2 ? space + 1 : columns;
                    lines.push('$ ' + chars.splice(0, end).join(''));
                }
                if (chars.length) lines.push('$ ' + chars.join(''));
            });
            screen.textContent = lines.join('\n');
            // Let the reader scroll back without being pulled down by typing.
            if (follow && atBottom) terminal.scrollTop = terminal.scrollHeight;
        }
        window.addEventListener('resize', () => render(visibleText, false));
        complete = () => {
            if (finished) return;
            finished = true;
            clearTimeout(timer);
            render(fullText);
            cursor.hidden = true;
        };

        function delay(character) {
            const base = character === '\n' ? 180 : /[.,;:!?]/.test(character || '') ? 120 : character === ' ' ? 14 : 55;
            return Math.max(8, Math.round(base * (0.55 + Math.random() * 0.9) / speed));
        }

        function next() {
            if (finished) return;
            if (position >= tokens.length) {
                complete();
                return;
            }
            const token = tokens[position++];
            const write = () => {
                if (finished) return;
                if (token === null) output.pop();
                else output.push(token);
                render(output.join(''));
                if (token === '.' && config.mistakes !== false && Math.random() < 0.3) {
                    // Hesitate with four dots, then backspace to the original full stop.
                    const extras = ['.', '..', '...', '..', '.', ''];
                    let step = 0;
                    const hesitate = () => {
                        if (finished) return;
                        render(output.join('') + extras[step++]);
                        timer = setTimeout(step < extras.length ? hesitate : next,
                            step === 3 ? 450 / speed : 150 / speed);
                    };
                    timer = setTimeout(hesitate, delay(token));
                } else {
                    timer = setTimeout(next, delay(token));
                }
            };
            if (token !== null && config.mistakes !== false && /^[a-z]$/i.test(token) && Math.random() < mistakeRate) {
                const letters = 'abcdefghijklmnopqrstuvwxyz'.replace(token.toLowerCase(), '');
                render(output.join('') + letters[Math.floor(Math.random() * letters.length)]);
                timer = setTimeout(() => {
                    if (finished) return;
                    render(output.join(''));
                    timer = setTimeout(write, Math.max(18, delay('x') * 0.7));
                }, delay(token));
            } else {
                write();
            }
        }

        if (reducedMotion.matches) {
            complete();
        } else {
            cursor.hidden = config.cursor === false;
            next();
        }
    }

    reducedMotion.addEventListener('change', (event) => { if (event.matches && complete) complete(); });

    async function load() {
        try {
            const data = new URLSearchParams(window.location.search).get('data');
            if (!data) throw new Error('Geen bericht gekozen. Geef de URL van het JSON-bestand mee via ?data=.');
            const url = new URL(data, window.location.href);
            if (!['http:', 'https:'].includes(url.protocol)) throw new Error('De bericht-URL moet HTTP of HTTPS gebruiken.');
            const response = await fetch(url.href, {cache: 'no-store'});
            if (!response.ok) throw new Error(`Het bericht is niet beschikbaar (HTTP ${response.status}).`);
            show(await response.json());
        } catch (error) {
            hint.hidden = false;
            hint.textContent = `$ Het bericht kon niet worden geladen. ${error.message}`;
            hint.classList.add('error');
        }
    }

    load();
})();
