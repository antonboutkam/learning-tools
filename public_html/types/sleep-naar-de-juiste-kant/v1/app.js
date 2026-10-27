const params = new URLSearchParams(location.search);
const dataUrl = params.get('data') || 'example.json';
const uniqueId = params.get('unique_id');
const titleEl = document.getElementById('title');
const descriptionEl = document.getElementById('description');
const exerciseEl = document.getElementById('exercise');
const statementsEl = document.getElementById('statements');
const columnsEl = document.getElementById('columns');
const resultEl = document.getElementById('result');
const statusEl = document.getElementById('status');
const checkEl = document.getElementById('check');
const resetEl = document.getElementById('reset');
const boardEl = document.getElementById('board');
const earnedEl = document.getElementById('earned');
const earnedScoreEl = document.getElementById('earned-score');
const certificateFormEl = document.getElementById('certificate-form');
const restartEl = document.getElementById('restart');
let config;
let placements = [];
let selected = null;
let dragging = null;
let completion = null;
let resultSnapshot = null;
let resultStorageKey = null;
let placementsStorageKey = null;

function storePlacements(value = placements) {
  if (!placementsStorageKey) return;
  try {
    if (value) localStorage.setItem(placementsStorageKey, JSON.stringify(value.map((column) => [...column])));
    else localStorage.removeItem(placementsStorageKey);
  } catch {
    statusEl.textContent = 'Je browser kan je voortgang niet bewaren. Houd deze pagina open tot je klaar bent.';
  }
}

function savedPlacements() {
  if (!placementsStorageKey) return null;
  try {
    const saved = JSON.parse(localStorage.getItem(placementsStorageKey));
    if (!Array.isArray(saved) || saved.length !== config.columns.length ||
        saved.some((column) => !Array.isArray(column) || column.some((index) =>
          !Number.isInteger(index) || index < 0 || index >= config.statements.length))) return null;
    return saved.map((column) => new Set(column));
  } catch { return null; }
}

function placementCount(index) {
  return placements.reduce((count, column) => count + Number(column.has(index)), 0);
}

function storeResult(value) {
  if (!resultStorageKey) return;
  try {
    if (value) localStorage.setItem(resultStorageKey, JSON.stringify(value));
    else localStorage.removeItem(resultStorageKey);
  } catch { /* De download blijft in deze sessie beschikbaar. */ }
}

function savedResult() {
  if (!resultStorageKey) return null;
  try {
    const value = JSON.parse(localStorage.getItem(resultStorageKey));
    return value && typeof value.completedAt === 'string' && Array.isArray(value.columns) ? value : null;
  } catch { return null; }
}

function showEarned() {
  boardEl.hidden = true;
  earnedEl.hidden = false;
  earnedScoreEl.textContent = `${config.columns.length} van ${config.columns.length} kolommen goed.`;
  earnedEl.querySelector('h2').focus?.();
}

function validate(data) {
  if (!data || !Array.isArray(data.columns) || data.columns.length < 2 ||
      !Array.isArray(data.statements) || !data.statements.length) {
    throw new Error('Vul minstens twee kolommen en één stelling in.');
  }
  const names = data.columns.map((name) => typeof name === 'string' ? name.trim() : '');
  if (names.some((name) => !name) || new Set(names).size !== names.length) {
    throw new Error('Kolomopschriften moeten ingevuld en uniek zijn.');
  }
  data.statements.forEach((statement, index) => {
    if (typeof statement?.label !== 'string' || !statement.label.trim() ||
        !Array.isArray(statement.correctColumns) || !statement.correctColumns.length ||
        new Set(statement.correctColumns).size !== statement.correctColumns.length ||
        statement.correctColumns.some((name) => !names.includes(name))) {
      throw new Error(`Stelling ${index + 1} heeft geen geldig opschrift of verwijst naar een onbekende kolom.`);
    }
  });
  data.columns = names;
  return data;
}

function clearFeedback() {
  columnsEl.querySelectorAll('.column').forEach((column) => {
    column.classList.remove('correct', 'incorrect', 'incomplete');
    column.removeAttribute('aria-label');
    column.querySelector('.feedback')?.remove();
  });
  resultEl.textContent = '';
}

function makeStatement(index, columnIndex = null) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'statement';
  button.textContent = config.statements[index].label;
  const usedUp = columnIndex === null && placementCount(index) >= config.statements[index].correctColumns.length;
  button.draggable = !usedUp;
  if (usedUp) {
    button.disabled = true;
    button.classList.add('used-up');
    button.title = 'Al in het maximale aantal kolommen geplaatst. Verwijder eerst een plaatsing om deze stelling te verplaatsen.';
  }
  button.dataset.statement = String(index);
  if (columnIndex !== null) button.dataset.column = String(columnIndex);
  if (selected === index && columnIndex === null) button.classList.add('selected');
  button.addEventListener('click', () => {
    selected = selected === index ? null : index;
    render();
  });
  button.addEventListener('dragstart', (event) => {
    dragging = { statement: index, from: columnIndex };
    event.dataTransfer.effectAllowed = columnIndex === null ? 'copy' : 'move';
    event.dataTransfer.setData('text/plain', String(index));
    button.classList.add('dragging');
  });
  button.addEventListener('dragend', () => {
    dragging = null;
    columnsEl.querySelectorAll('.column').forEach((column) => column.classList.remove('over'));
    button.classList.remove('dragging');
  });
  return button;
}

function place(statementIndex, columnIndex, from = null) {
  if (from === null && !placements[columnIndex].has(statementIndex) &&
      placementCount(statementIndex) >= config.statements[statementIndex].correctColumns.length) return;
  if (from !== null && from !== columnIndex) placements[from].delete(statementIndex);
  placements[columnIndex].add(statementIndex);
  selected = null;
  storePlacements();
  clearFeedback();
  render();
}

function render() {
  statementsEl.replaceChildren();
  columnsEl.replaceChildren();
  config.statements.forEach((_, index) => statementsEl.appendChild(makeStatement(index)));
  config.columns.forEach((name, columnIndex) => {
    const column = document.createElement('section');
    column.className = 'column';
    column.tabIndex = 0;
    column.setAttribute('aria-label', `${name}. Klik om de geselecteerde stelling toe te voegen.`);
    const heading = document.createElement('h2');
    heading.textContent = name;
    const list = document.createElement('div');
    list.className = 'placed-list';
    if (placements[columnIndex].size === 0) {
      const empty = document.createElement('span');
      empty.className = 'empty';
      empty.textContent = 'Sleep hier een stelling naartoe';
      list.appendChild(empty);
    }
    placements[columnIndex].forEach((statementIndex) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'placed';
      wrapper.appendChild(makeStatement(statementIndex, columnIndex));
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'remove';
      remove.textContent = '×';
      remove.setAttribute('aria-label', `Verwijder ${config.statements[statementIndex].label} uit ${name}`);
      remove.addEventListener('click', (event) => {
        event.stopPropagation();
        placements[columnIndex].delete(statementIndex);
        storePlacements();
        clearFeedback();
        render();
      });
      wrapper.appendChild(remove);
      list.appendChild(wrapper);
    });
    column.append(heading, list);
    column.addEventListener('click', (event) => {
      if (event.target.closest('.statement, .remove') || selected === null) return;
      place(selected, columnIndex);
    });
    column.addEventListener('keydown', (event) => {
      if ((event.key === 'Enter' || event.key === ' ') && event.target === column && selected !== null) {
        event.preventDefault();
        place(selected, columnIndex);
      }
    });
    column.addEventListener('dragover', (event) => {
      if (!dragging) return;
      event.preventDefault();
      column.classList.add('over');
    });
    column.addEventListener('dragleave', (event) => {
      if (!column.contains(event.relatedTarget)) column.classList.remove('over');
    });
    column.addEventListener('drop', (event) => {
      event.preventDefault();
      column.classList.remove('over');
      if (dragging) place(dragging.statement, columnIndex, dragging.from);
      dragging = null;
    });
    columnsEl.appendChild(column);
  });
}

checkEl.addEventListener('click', () => {
  if (completion && !completion.beginAttempt()) return;
  let correct = 0;
  columnsEl.querySelectorAll('.column').forEach((column, columnIndex) => {
    column.querySelector('.feedback')?.remove();
    const expected = new Set(config.statements.flatMap((statement, index) =>
      statement.correctColumns.includes(config.columns[columnIndex]) ? [index] : []));
    const actual = placements[columnIndex];
    const hasWrong = [...actual].some((index) => !expected.has(index));
    const missing = [...expected].filter((index) => !actual.has(index)).length;
    const state = hasWrong ? 'incorrect' : missing ? 'incomplete' : 'correct';
    column.classList.remove('correct', 'incorrect', 'incomplete');
    column.classList.add(state);
    const feedback = state === 'correct' ? 'Goed' : state === 'incomplete' ? `Nog ${missing} stelling${missing === 1 ? '' : 'en'} ontbreekt${missing === 1 ? '' : 'en'}` : 'Er staat een verkeerde stelling in deze kolom';
    column.setAttribute('aria-label', `${config.columns[columnIndex]}: ${feedback}`);
    const feedbackEl = document.createElement('p');
    feedbackEl.className = 'feedback';
    feedbackEl.textContent = feedback;
    column.appendChild(feedbackEl);
    if (state === 'correct') correct++;
  });
  resultEl.textContent = `${correct} van ${config.columns.length} kolommen goed.${correct < config.columns.length ? ' Kijk naar de niet-grijze stellingen: sommige horen in meerdere kolommen.' : ''}`;
  if (correct === config.columns.length) {
    resultSnapshot = {
      completedAt: new Date().toISOString(),
      columns: config.columns.map((label, columnIndex) => ({
        label,
        statements: [...placements[columnIndex]].map((index) => ({ number: index + 1, label: config.statements[index].label }))
      }))
    };
    storeResult(resultSnapshot);
    completion?.markCompleted({ score: { correct, total: config.columns.length } });
    showEarned();
  }
});

certificateFormEl.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!resultSnapshot) return;
  const nameInput = document.getElementById('student-name');
  const classInput = document.getElementById('student-class');
  nameInput.value = nameInput.value.trim();
  classInput.value = classInput.value.trim();
  if (!certificateFormEl.reportValidity()) return;
  const studentName = nameInput.value;
  const studentClass = classInput.value;
  const result = {
    format: 'learning-tools-result-v1',
    toolId: 'sleep-naar-de-juiste-kant',
    version: 'v1',
    uniqueId: uniqueId || null,
    title: config.title || 'Sleep naar de juiste kant',
    studentName,
    studentClass,
    completedAt: resultSnapshot.completedAt,
    score: { correct: config.columns.length, total: config.columns.length },
    columns: resultSnapshot.columns
  };
  const blob = new Blob([`${JSON.stringify(result, null, 2)}\n`], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `resultaat-sleep-naar-de-juiste-kant-${(uniqueId || 'oefening').replace(/[^a-zA-Z0-9_-]/g, '-')}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
});

function resetExercise() {
  if (completion?.cooldownActive) return;
  storePlacements(null);
  if (completion) completion.reset();
  else {
    storeResult(null);
    location.reload();
  }
}

resetEl.addEventListener('click', resetExercise);
restartEl.addEventListener('click', resetExercise);

async function init() {
  try {
    const response = await fetch(dataUrl, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Kon de gegevens niet laden (HTTP ${response.status}).`);
    config = validate(await response.json());
    titleEl.textContent = config.title || 'Sleep naar de juiste kant';
    descriptionEl.textContent = config.description || 'Sleep de stellingen naar de juiste kolommen.';
    placementsStorageKey = `learning-tools:placements:sleep-naar-de-juiste-kant:v1:${JSON.stringify([uniqueId || 'standalone', new URL(dataUrl, location.href).toString(), config.columns, config.statements])}`;
    placements = savedPlacements() || config.columns.map(() => new Set());
    render();
    exerciseEl.hidden = false;
    if (uniqueId) {
      resultStorageKey = `learning-tools:result:sleep-naar-de-juiste-kant:v1:${JSON.stringify([uniqueId, new URL(dataUrl, location.href).toString()])}`;
      completion = window.LearningToolsCompletion?.create?.({
        toolId: 'sleep-naar-de-juiste-kant',
        version: 'v1',
        cooldownSeconds: config.cooldownSeconds,
        dataUrl: new URL(dataUrl, location.href).toString(),
        uniqueId,
        title: config.title || null,
        containerEl: exerciseEl,
        standalone: false,
        onReset: () => {
          storePlacements(null);
          storeResult(null);
          location.reload();
        }
      }) || null;
      if (completion?.isCompleted) {
        resultSnapshot = savedResult();
        if (resultSnapshot) showEarned();
      }
    }
  } catch (error) {
    descriptionEl.textContent = 'De opdracht kan niet worden geopend.';
    statusEl.textContent = error.message;
  }
}

init();
