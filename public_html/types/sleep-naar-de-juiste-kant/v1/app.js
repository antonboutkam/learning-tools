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
let config;
let placements = [];
let selected = null;
let dragging = null;
let completion = null;

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
  button.draggable = true;
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
  if (from !== null && from !== columnIndex) placements[from].delete(statementIndex);
  placements[columnIndex].add(statementIndex);
  selected = null;
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
  resultEl.textContent = `${correct} van ${config.columns.length} kolommen goed.`;
  if (correct === config.columns.length) {
    completion?.markCompleted({ score: { correct, total: config.columns.length } });
  }
});

async function init() {
  try {
    const response = await fetch(dataUrl, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Kon de gegevens niet laden (HTTP ${response.status}).`);
    config = validate(await response.json());
    titleEl.textContent = config.title || 'Sleep naar de juiste kant';
    descriptionEl.textContent = config.description || 'Sleep de stellingen naar de juiste kolommen.';
    placements = config.columns.map(() => new Set());
    render();
    exerciseEl.hidden = false;
    if (uniqueId) {
      completion = window.LearningToolsCompletion?.create?.({
        toolId: 'sleep-naar-de-juiste-kant',
        version: 'v1',
        cooldownSeconds: config.cooldownSeconds,
        dataUrl: new URL(dataUrl, location.href).toString(),
        uniqueId,
        title: config.title || null,
        containerEl: exerciseEl,
        onReset: () => location.reload()
      }) || null;
    }
  } catch (error) {
    descriptionEl.textContent = 'De opdracht kan niet worden geopend.';
    statusEl.textContent = error.message;
  }
}

init();
