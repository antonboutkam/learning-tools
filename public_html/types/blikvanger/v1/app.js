(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  let dataUrl = new URL(params.get('data') || 'example.json', location.href).href;
  let config, steps, current = 0, correct = 0, locked = false, completion;
  const text = (value) => typeof value === 'string' && value.trim().length > 0;
  function safeUrl(value) {
    const url = new URL(value, dataUrl);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Gebruik een http- of https-URL voor afbeeldingen en bronnen.');
    return url.href;
  }
  function validate(raw) {
    if (!raw || !Array.isArray(raw.slides) || !raw.slides.length) throw new Error('Voeg minimaal één slide toe.');
    if (raw.slaaggrens !== undefined && (!Number.isInteger(raw.slaaggrens) || raw.slaaggrens < 0 || raw.slaaggrens > 100)) throw new Error('De slaaggrens moet een geheel percentage tussen 0 en 100 zijn.');
    raw.slides.forEach((s, i) => {
      const label = `Slide ${i + 1}`;
      if (!s || !['breed', 'split'].includes(s.indeling) || (!text(s.afbeelding) && !text(s.bericht))) throw new Error(`${label}: kies een indeling en voeg een afbeelding of bericht toe.`);
      if (s.indeling === 'split' && (!text(s.afbeelding) || !text(s.bericht))) throw new Error(`${label}: een gesplitste slide heeft een afbeelding én bericht nodig.`);
      if (text(s.afbeelding)) { safeUrl(s.afbeelding); if (!text(s.alt)) throw new Error(`${label}: beschrijf de afbeelding in de alt-tekst.`); }
      if (text(s.bronUrl)) safeUrl(s.bronUrl);
      if (!Array.isArray(s.vragen) || !s.vragen.length) throw new Error(`${label}: voeg minimaal één vraag toe.`);
      s.vragen.forEach((q, j) => {
        const name = `${label}, vraag ${j + 1}`;
        if (!q || !text(q.vraag) || !['enkel', 'meerdere', 'waar-onwaar'].includes(q.type)) throw new Error(`${name}: vul de vraag en een geldig vraagtype in.`);
        if (q.type === 'waar-onwaar') {
          if (typeof q.waar !== 'boolean') throw new Error(`${name}: geef aan of de stelling waar is.`);
        } else {
          if (!Array.isArray(q.antwoorden) || q.antwoorden.length < 2 || q.antwoorden.some(a => !a || !text(a.tekst) || typeof a.juist !== 'boolean')) throw new Error(`${name}: voeg minimaal twee antwoorden met tekst en juist/onjuist toe.`);
          const count = q.antwoorden.filter(a => a.juist).length;
          if (!count || (q.type === 'enkel' && count !== 1)) throw new Error(`${name}: kies ${q.type === 'enkel' ? 'precies één juist antwoord' : 'minimaal één juist antwoord'}.`);
        }
      });
    });
    return raw;
  }
  function options(q) {
    return q.type === 'waar-onwaar' ? [{ tekst: 'Waar', juist: q.waar }, { tekst: 'Onwaar', juist: !q.waar }] : q.antwoorden;
  }
  function render(focus = true) {
    locked = false;
    const { slide, question, slideIndex, questionIndex } = steps[current];
    $('quiz').hidden = false;
    $('result').hidden = true;
    $('source').className = `source ${slide.indeling}`;
    $('figure').hidden = !text(slide.afbeelding);
    $('image').removeAttribute('src');
    if (text(slide.afbeelding)) $('image').src = safeUrl(slide.afbeelding);
    $('image').alt = slide.alt || '';
    $('caption').textContent = slide.bijschrift || '';
    $('caption').hidden = !slide.bijschrift;
    $('article').hidden = !text(slide.bericht);
    $('headline').textContent = slide.kop || '';
    $('article-text').textContent = slide.bericht || '';
    $('source-link').hidden = !text(slide.bronUrl);
    $('source-link').removeAttribute('href');
    if (text(slide.bronUrl)) $('source-link').href = safeUrl(slide.bronUrl);
    $('progress').textContent = `Vraag ${current + 1} van ${steps.length}`;
    $('meter').value = current;
    $('question-count').textContent = `Slide ${slideIndex + 1} · Vraag ${questionIndex + 1} van ${slide.vragen.length}`;
    $('question').textContent = question.vraag;
    $('hint').textContent = question.type === 'meerdere' ? 'Kies alle juiste antwoorden.' : 'Kies één antwoord.';
    $('answers').replaceChildren();
    options(question).forEach((a, index) => {
      const label = document.createElement('label'); label.className = 'answer';
      const input = document.createElement('input'); input.type = question.type === 'meerdere' ? 'checkbox' : 'radio'; input.name = 'antwoord'; input.value = index;
      const span = document.createElement('span'); span.textContent = a.tekst;
      label.append(input, span); $('answers').append(label);
    });
    $('feedback').textContent = '';
    $('check').hidden = false; $('check').disabled = true; $('next').hidden = true;
    if (focus) $('question').focus({ preventScroll: true });
  }
  function restart() {
    current = 0; correct = 0;
    render();
  }
  $('answers').addEventListener('change', () => { $('check').disabled = locked || !$('answers').querySelector('input:checked'); });
  $('question-form').addEventListener('submit', (event) => {
    event.preventDefault();
    if (locked || completion?.cooldownActive || !$('answers').querySelector('input:checked')) return;
    locked = true;
    const q = steps[current].question;
    const choices = options(q);
    const inputs = [...$('answers').querySelectorAll('input')];
    const good = inputs.every((input, i) => input.checked === choices[i].juist);
    if (good) correct++;
    inputs.forEach((input, i) => {
      input.disabled = true;
      if (choices[i].juist || input.checked) {
        input.parentElement.classList.add(choices[i].juist ? 'correct' : 'wrong');
        const marker = document.createElement('small'); marker.textContent = choices[i].juist ? 'Juist' : 'Onjuist'; input.parentElement.append(marker);
      }
    });
    $('feedback').textContent = `${good ? 'Goed gezien!' : 'Nog niet helemaal. Bekijk de juiste antwoorden.'}${q.uitleg ? ` ${q.uitleg}` : ''}`;
    $('check').hidden = true;
    $('next').hidden = false;
    $('next').textContent = current === steps.length - 1 ? 'Bekijk resultaat →' : 'Volgende vraag →';
    $('next').focus({ preventScroll: true });
  });
  $('next').addEventListener('click', () => {
    if (!locked) return;
    current++;
    if (current < steps.length) return render();
    completion?.startCooldown();
    $('quiz').hidden = true; $('result').hidden = false;
    $('meter').value = steps.length;
    $('progress').textContent = 'Afgerond';
    const percentage = Math.round(correct / steps.length * 100);
    const passed = correct / steps.length * 100 >= (config.slaaggrens ?? 70);
    $('score').textContent = `${percentage}%`;
    $('score-detail').textContent = `${correct} van de ${steps.length} vragen goed. ${passed ? 'Je hebt de oefening behaald.' : 'Oefen nog een keer: je hebt minimaal ' + (config.slaaggrens ?? 70) + '% nodig.'}`;
    if (passed) completion?.markCompleted({ score: { correct, total: steps.length } });
    $('result-title').focus();
  });
  $('restart').addEventListener('click', () => { if (completion) completion.reset(); else restart(); });
  $('image').addEventListener('error', () => { $('caption').hidden = false; $('caption').textContent = 'De afbeelding kon niet worden geladen. ' + ($('image').alt || ''); });
  async function init() {
    try {
      const response = await fetch(dataUrl, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Configuratie laden mislukt (${response.status}).`);
      dataUrl = response.url || dataUrl;
      config = validate(await response.json());
      steps = config.slides.flatMap((slide, slideIndex) => slide.vragen.map((question, questionIndex) => ({ slide, question, slideIndex, questionIndex })));
      $('title').textContent = config.titel || 'Blikvanger';
      $('intro').textContent = config.introductie || 'Bekijk de bron en beantwoord de vragen.';
      $('meter').max = steps.length;
      const uniqueId = params.get('unique_id');
      if (uniqueId || config.cooldownSeconds > 0) completion = window.LearningToolsCompletion?.create({ toolId: 'blikvanger', version: 'v1', dataUrl, uniqueId: uniqueId || `blikvanger:${dataUrl}`, cooldownSeconds: config.cooldownSeconds, title: config.titel || 'Blikvanger', containerEl: document.querySelector('.shell'), onReset: restart });
      render(false);
    } catch (error) {
      $('quiz').hidden = true; $('error').hidden = false; $('error-message').textContent = error.message;
    }
  }
  init();
})();
