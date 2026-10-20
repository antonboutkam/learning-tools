const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

class Element {
  constructor(tagName) {
    this.tagName = tagName; this.children = []; this.listeners = {}; this.dataset = {}; this.className = ''; this.attributes = {};
    this.classList = { add() {}, remove() {} };
  }
  append(...nodes) { assert.ok(nodes.every(node => node instanceof Element)); this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  addEventListener(type, callback) { (this.listeners[type] ||= []).push(callback); }
  dispatch(type, event = {}) { for (const callback of this.listeners[type] || []) callback({target: this, preventDefault() {}, ...event}); }
  querySelector(tagName) { return this.children.find(child => child.tagName === tagName); }
  closest(selector) { return selector === '.post' && this.className.split(' ').includes('post') ? this : null; }
  focus() { this.focused = true; }
  setAttribute(name, value) { this.attributes[name] = value; }
}
function findById(element, id) {
  if (element.id === id) return element;
  for (const child of element.children) { const found = findById(child, id); if (found) return found; }
}

async function harness(options = {}) {
  const elements = {};
  for (const [, id] of fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8').matchAll(/id="([^"]+)"/g)) elements[id] = new Element('div');
  elements.score.append(new Element('small'), new Element('strong'));
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'example.json'), 'utf8'));
  options.configure?.(data);
  let fetched;
  const context = {URL, setTimeout() {}, location: {href: options.url || 'https://example.test/tool/'}, document: {getElementById: id => elements[id] || findById(elements.feed, id), createElement: tag => new Element(tag)}, fetch: async url => { fetched = url; if (options.fail) throw Error('offline'); return {ok: true, json: async () => data}; }};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8'), context);
  await new Promise(resolve => setImmediate(resolve));
  return {elements, data, get fetched() { return fetched; }};
}
const posts = h => h.elements.feed.children.filter(element => element.className.split(' ').includes('post'));
const visible = h => posts(h).filter(element => !element.className.includes('is-hidden'));
const toggle = article => article.children.find(element => element.tagName === 'label').children[0];
const reactions = (h, postId) => posts(h).find(post => post.dataset.id === postId).children.find(element => element.tagName === 'section').children.filter(element => element.tagName === 'article');
const move = (h, source, target) => h.elements.feed.dispatch('drop', {target: posts(h).find(post => post.dataset.id === target), dataTransfer: {getData: () => source}});
const moveButton = (h, id, direction) => findById(h.elements.feed, `move-${direction}-${id}`);

test('Courses data URL replaces the example; failures show an error', async () => {
  const h = await harness({url: 'https://example.test/tool/?data=https%3A%2F%2Fcourses.test%2Flesson.json', configure: data => { data.title = 'Eigen opdracht'; }});
  assert.equal(h.fetched, 'https://courses.test/lesson.json');
  assert.equal(h.elements.pageTitle.textContent, 'Eigen opdracht');
  assert.equal(h.elements.workspace.hidden, false);
  assert.equal((await harness()).fetched, './example.json');
  const failed = await harness({fail: true});
  assert.equal(failed.elements.workspace.hidden, true);
  assert.equal(failed.elements.error.hidden, false);
});

test('crossing the feed boundary displaces the last visible post; hiding moves the boundary', async () => {
  const h = await harness();
  assert.equal(visible(h).length, 4);
  move(h, 'post-3', 'post-5');
  assert.deepEqual(visible(h).map(post => post.dataset.id), ['post-3', 'post-5', 'post-6', 'post-1']);
  move(h, 'post-4', 'post-3');
  assert.equal(h.elements.score.children[1].textContent, '29');
  const first = toggle(visible(h)[0]); first.checked = false; first.dispatch('change');
  assert.equal(visible(h).length, 3);
  assert.equal(h.elements.feed.children[3].className, 'limit-notice');
  const before = posts(h).map(post => post.dataset.id);
  move(h, 'foreign-id', 'post-1');
  assert.deepEqual(posts(h).map(post => post.dataset.id), before);
});

test('maximum five reactions, selected reactions first, strict negative score target', async () => {
  const h = await harness({configure: data => {
    data.feed_post_limit = 1;
    data.target = {comparison: 'less_than', score: -70};
    data.comments = Array.from({length: 6}, (_, index) => ({id: `r${index}`, post_id: data.posts[0].id, author_name: 'Tester', body: `Reactie ${index}`, score: -1}));
  }});
  assert.equal(reactions(h, h.data.posts[0].id).filter(reaction => toggle(reaction).checked).length, 5);
  const sixth = toggle(reactions(h, h.data.posts[0].id)[5]); sixth.checked = true; sixth.dispatch('change');
  assert.equal(h.elements.score.children[1].textContent, '-70');
  assert.match(h.elements.result.textContent, /maximaal 5/);
  h.elements.checkScore.dispatch('click');
  assert.match(h.elements.result.textContent, /Helaas/);
  const reaction = visible(h)[0].children.find(element => element.tagName === 'section').children[1];
  assert.ok(!reaction.className.includes('is-hidden'));
});

test('initial score includes the default reactions and appears before checking the score', async () => {
  const h = await harness();
  assert.equal(h.elements.workspace.hidden, false);
  assert.equal(h.elements.score.children[1].textContent, '66');
  assert.equal(h.elements.result.textContent, 'Huidige score: 66 punten.');
  assert.equal(h.elements.result.className, 'result');
  for (const post of h.data.posts) {
    const comments = reactions(h, post.id);
    assert.equal(comments.filter(comment => toggle(comment).checked).length, Math.min(5, comments.length));
  }
  h.elements.checkScore.dispatch('click');
  assert.match(h.elements.result.textContent, /Helaas.*66/);
  const first = toggle(visible(h)[0]); first.checked = false; first.dispatch('change');
  assert.equal(h.elements.score.children[1].textContent, '135');
  assert.equal(h.elements.result.textContent, 'Huidige score: 135 punten.');
  assert.equal(h.elements.result.className, 'result');
});

test('first five means source order, replacement updates score and hidden posts do not count', async () => {
  const h = await harness({configure: data => {
    data.feed_post_limit = 1;
    data.comments = [1, 2, 3, 4, 5, -5].map((score, index) => ({id: `r${index}`, post_id: data.posts[0].id, author_name: 'Tester', body: `Reactie ${index}`, score}));
    data.comments.push({id: 'hidden-post-reaction', post_id: data.posts[1].id, author_name: 'Tester', body: 'Bij verborgen post', score: 5});
  }});
  assert.equal(h.elements.score.children[1].textContent, '-50');
  assert.equal(h.elements.result.textContent, 'Huidige score: -50 punten.');
  assert.deepEqual(reactions(h, h.data.posts[0].id).map(reaction => toggle(reaction).checked), [true, true, true, true, true, false]);
  assert.equal(toggle(reactions(h, h.data.posts[1].id)[0]).checked, true);
  const first = toggle(reactions(h, h.data.posts[0].id)[0]); first.checked = false; first.dispatch('change');
  assert.equal(h.elements.score.children[1].textContent, '-51');
  const replacement = toggle(reactions(h, h.data.posts[0].id).find(reaction => reaction.children.some(child => child.textContent === 'Reactie 5')));
  replacement.checked = true; replacement.dispatch('change');
  assert.equal(h.elements.score.children[1].textContent, '-56');
  assert.equal(h.elements.result.textContent, 'Huidige score: -56 punten.');
});

test('zero remains an explicit initial score when no reactions are available', async () => {
  const h = await harness({configure: data => {
    data.posts[0].image_correction = 0; data.feed_post_limit = 1; data.comments = [];
  }});
  assert.equal(h.elements.score.children[1].textContent, '0');
  assert.equal(h.elements.result.textContent, 'Huidige score: 0 punten.');
  assert.equal(reactions(h, h.data.posts[0].id).length, 0);
});

test('move buttons change one position, retain focus and stop at the first and last post', async () => {
  const h = await harness();
  assert.equal(moveButton(h, 'post-5', 'up').disabled, true);
  assert.equal(moveButton(h, 'post-4', 'down').disabled, true);
  moveButton(h, 'post-6', 'up').dispatch('click');
  assert.deepEqual(posts(h).map(post => post.dataset.id), ['post-6', 'post-5', 'post-1', 'post-2', 'post-3', 'post-4']);
  assert.equal(h.elements.score.children[1].textContent, '66');
  assert.equal(moveButton(h, 'post-6', 'up').disabled, true);
  assert.equal(moveButton(h, 'post-6', 'down').focused, true);
  moveButton(h, 'post-6', 'down').dispatch('click');
  assert.deepEqual(posts(h).map(post => post.dataset.id), h.data.posts.map(post => post.id));
});

test('moving across the boundary swaps visibility and updates score, just like dragging', async () => {
  const h = await harness();
  moveButton(h, 'post-2', 'down').dispatch('click');
  assert.deepEqual(visible(h).map(post => post.dataset.id), ['post-5', 'post-6', 'post-1', 'post-3']);
  assert.equal(h.elements.feed.children[4].className, 'limit-notice');
  assert.equal(h.elements.score.children[1].textContent, '56');
  assert.equal(h.elements.result.textContent, 'Huidige score: 56 punten.');
  assert.equal(moveButton(h, 'post-2', 'down').focused, true);
  assert.equal(reactions(h, 'post-2').filter(reaction => toggle(reaction).checked).length, 2);
  const dragged = await harness(); move(dragged, 'post-2', 'post-3');
  assert.deepEqual(posts(dragged).map(post => post.dataset.id), posts(h).map(post => post.dataset.id));
  assert.deepEqual(visible(dragged).map(post => post.dataset.id), visible(h).map(post => post.dataset.id));
  moveButton(h, 'post-2', 'up').dispatch('click');
  assert.deepEqual(visible(h).map(post => post.dataset.id), ['post-5', 'post-6', 'post-1', 'post-2']);
  assert.equal(h.elements.score.children[1].textContent, '66');
});

test('hidden posts can be reordered and a free feed slot is filled without displacing another post', async () => {
  const h = await harness();
  moveButton(h, 'post-4', 'up').dispatch('click');
  assert.deepEqual(posts(h).slice(-2).map(post => post.dataset.id), ['post-4', 'post-3']);
  assert.equal(h.elements.score.children[1].textContent, '66');
  const lastVisible = toggle(visible(h)[3]); lastVisible.checked = false; lastVisible.dispatch('change');
  assert.equal(visible(h).length, 3);
  moveButton(h, 'post-2', 'up').dispatch('click');
  assert.deepEqual(visible(h).map(post => post.dataset.id), ['post-5', 'post-6', 'post-2', 'post-1']);
  assert.equal(h.elements.score.children[1].textContent, '66');
});

test('single-post feeds disable both move buttons', async () => {
  const h = await harness({configure: data => {
    data.posts = data.posts.slice(0, 1); data.feed_post_limit = 1;
    data.comments = data.comments.filter(comment => comment.post_id === data.posts[0].id);
  }});
  assert.equal(moveButton(h, h.data.posts[0].id, 'up').disabled, true);
  assert.equal(moveButton(h, h.data.posts[0].id, 'down').disabled, true);
});

test('reaction panels can be collapsed independently without changing selection, score or certificate result', async () => {
  const h = await harness(), firstPost = h.data.posts[0].id, secondPost = h.data.posts[1].id;
  const panel = () => findById(h.elements.feed, `comments-${firstPost}`);
  const button = () => findById(h.elements.feed, `comments-toggle-${firstPost}`);
  assert.equal(panel().hidden, false);
  assert.equal(button().attributes['aria-expanded'], 'true');
  assert.equal(button().attributes['aria-controls'], panel().id);
  h.elements.checkScore.dispatch('click'); const result = h.elements.result.textContent;
  button().dispatch('click');
  assert.equal(panel().hidden, true);
  assert.match(button().textContent, /Reacties tonen/);
  assert.equal(button().attributes['aria-expanded'], 'false');
  assert.equal(findById(h.elements.feed, `comments-${secondPost}`).hidden, false);
  assert.equal(h.elements.score.children[1].textContent, '66');
  assert.equal(h.elements.result.textContent, result);
  assert.equal(reactions(h, firstPost).filter(reaction => toggle(reaction).checked).length, 1);
  moveButton(h, firstPost, 'down').dispatch('click');
  assert.equal(panel().hidden, true);
  button().dispatch('click');
  assert.equal(panel().hidden, false);
  assert.match(button().textContent, /Reacties verbergen/);
  assert.equal(h.elements.score.children[1].textContent, '66');
});

test('empty reaction panels do not show an unnecessary toggle', async () => {
  const h = await harness({configure: data => { data.comments = []; }});
  for (const post of h.data.posts) assert.equal(findById(h.elements.feed, `comments-toggle-${post.id}`), undefined);
});
