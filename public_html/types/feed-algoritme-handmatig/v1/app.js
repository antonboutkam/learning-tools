(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const COMMENT_LIMIT = 5;
  const collapsedComments = new Set();
  let completion = null;
  let config, visiblePosts = new Set(), visibleComments = new Set(), order = [], previouslyPassed = false;
  const text = (element, value) => { element.textContent = value; return element; };
  const clone = value => JSON.parse(JSON.stringify(value));
  const initials = name => name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || '?';
  const score = () => order.filter(id => visiblePosts.has(id)).reduce((total, id) => {
    const post = config.posts.find(item => item.id === id);
    return total + post.image_correction + config.comments.filter(comment => comment.post_id === id && visibleComments.has(comment.id)).reduce((sum, comment) => sum + comment.score, 0);
  }, 0);
  const passes = value => config.target.comparison === 'more_than' ? value > config.target.score : value < config.target.score;
  const visibleCommentIds = postId => config.comments.filter(comment => comment.post_id === postId && visibleComments.has(comment.id)).map(comment => comment.id);
  const displayedOrder = () => [...order.filter(id => visiblePosts.has(id)), ...order.filter(id => !visiblePosts.has(id))];
  function moveControls(post, index) {
    const controls = document.createElement('div'); controls.className = 'post-move';
    for (const [direction, name, label] of [[-1, 'up', '↑ Omhoog'], [1, 'down', '↓ Omlaag']]) {
      const button = text(document.createElement('button'), label);
      button.type = 'button'; button.id = `move-${name}-${post.id}`;
      button.ariaLabel = `Verplaats post ${direction < 0 ? 'omhoog' : 'omlaag'}: ${post.headline}`;
      button.disabled = direction < 0 ? index === 0 : index === order.length - 1;
      button.addEventListener('click', () => {
        const selection = displayedOrder(), position = selection.indexOf(post.id);
        const target = selection[position + direction];
        if (!target) return;
        movePost(post.id, target, direction > 0);
        const moved = $(button.id), alternative = $(`move-${direction < 0 ? 'down' : 'up'}-${post.id}`);
        if (moved && !moved.disabled) moved.focus({preventScroll: true});
        else if (alternative && !alternative.disabled) alternative.focus({preventScroll: true});
      });
      controls.append(button);
    }
    return controls;
  }
  function visibilityControl(kind, id, selected, label) {
    const control = document.createElement('label');
    control.className = `visibility ${selected ? 'visible' : 'hidden'}`;
    const input = document.createElement('input'); input.type = 'checkbox'; input.checked = selected;
    const eye = text(document.createElement('span'), selected ? '◉' : '◌'); eye.className = 'eye';
    control.append(input, eye, text(document.createElement('span'), selected ? 'Is zichtbaar' : 'Is onzichtbaar'));
    control.title = `${selected ? 'Maak' : 'Maak'} ${label} ${selected ? 'onzichtbaar' : 'zichtbaar'}`;
    input.addEventListener('change', () => {
      const set = kind === 'post' ? visiblePosts : visibleComments;
      if (input.checked && kind === 'comment' && visibleCommentIds(config.comments.find(comment => comment.id === id).post_id).length >= COMMENT_LIMIT) {
        input.checked = false; $('result').className = 'result failure'; text($('result'), `Huidige score: ${score()} punten. Per post kunnen maximaal ${COMMENT_LIMIT} reacties zichtbaar zijn.`); return;
      }
      if (input.checked && kind === 'post' && visiblePosts.size >= config.feed_post_limit) {
        const displaced = [...order].reverse().find(postId => visiblePosts.has(postId));
        if (displaced) visiblePosts.delete(displaced);
      }
      input.checked ? set.add(id) : set.delete(id); render();
    });
    return control;
  }
  function person(item, moment) {
    const head = document.createElement('div'); head.className = 'post-head';
    const avatar = text(document.createElement('span'), initials(item.author_name)); avatar.className = 'avatar'; head.append(avatar);
    const byline = document.createElement('div'); byline.className = 'byline'; byline.append(text(document.createElement('strong'), item.author_name), text(document.createElement('small'), moment || 'Fictief account'));
    head.append(byline); return head;
  }
  function renderComment(comment) {
    const article = document.createElement('article'); article.className = `comment${visibleComments.has(comment.id) ? '' : ' is-hidden'}`;
    const body = text(document.createElement('p'), comment.body); body.className = 'body-text'; article.append(person(comment, 'Reactie'), visibilityControl('comment', comment.id, visibleComments.has(comment.id), 'deze reactie'), body);
    return article;
  }
  function renderPost(post, index) {
    const article = document.createElement('article'); article.className = `post${visiblePosts.has(post.id) ? '' : ' is-hidden'}`; article.draggable = true; article.dataset.id = post.id;
    article.addEventListener('dragstart', event => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', post.id); article.classList.add('dragging'); });
    article.addEventListener('dragend', () => article.classList.remove('dragging'));
    const topic = text(document.createElement('span'), post.topic || 'Bericht'); topic.className = 'topic'; const body = text(document.createElement('p'), post.body); body.className = 'body-text'; article.append(person(post, post.published_at || 'Fictief bericht'), visibilityControl('post', post.id, visiblePosts.has(post.id), 'dit bericht'), topic, text(document.createElement('h3'), post.headline), moveControls(post, index), body);
    if (post.image?.url) { const image = document.createElement('img'); image.className = 'post-image'; image.src = post.image.url; image.alt = post.image.alt || ''; image.loading = 'lazy'; article.append(image); }
    const comments = document.createElement('section'); comments.className = 'comments'; comments.append(text(document.createElement('h4'), `Meest relevant · ${visibleCommentIds(post.id).length} van ${COMMENT_LIMIT} zichtbaar`));
    const postComments = config.comments.filter(comment => comment.post_id === post.id);
    comments.id = `comments-${post.id}`; comments.hidden = collapsedComments.has(post.id);
    if (postComments.length) {
      const toggle = document.createElement('button'); toggle.type = 'button'; toggle.className = 'comments-toggle';
      toggle.id = `comments-toggle-${post.id}`; toggle.setAttribute('aria-controls', comments.id);
      const updateToggle = () => {
        toggle.textContent = `${comments.hidden ? 'Reacties tonen' : 'Reacties verbergen'} · ${postComments.length}`;
        toggle.setAttribute('aria-expanded', String(!comments.hidden));
        toggle.ariaLabel = `${comments.hidden ? 'Reacties tonen' : 'Reacties verbergen'} bij: ${post.headline}`;
      };
      toggle.addEventListener('click', () => {
        comments.hidden = !comments.hidden;
        comments.hidden ? collapsedComments.add(post.id) : collapsedComments.delete(post.id);
        updateToggle();
      });
      updateToggle(); article.append(toggle);
    }
    [...postComments.filter(comment => visibleComments.has(comment.id)), ...postComments.filter(comment => !visibleComments.has(comment.id))].forEach(comment => comments.append(renderComment(comment))); article.append(comments); return article;
  }
  function render() {
    const feed = $('feed'); feed.replaceChildren();
    const visible = order.filter(id => visiblePosts.has(id)), hidden = order.filter(id => !visiblePosts.has(id));
    const selection = [...visible, ...hidden];
    const boundary = () => { const limit = text(document.createElement('div'), '~ ~ berichten onder deze lijn vallen buiten de feed ~ ~'); limit.className = 'limit-notice'; feed.append(limit); };
    selection.forEach((id, index) => { if (index === visible.length) boundary(); feed.append(renderPost(config.posts.find(post => post.id === id), index)); });
    if (!hidden.length) boundary();
    const current = score(); text($('score').querySelector('strong'), String(current)); text($('feedCount'), `${visible.length} zichtbaar · ${hidden.length} buiten de feed`);
    $('result').className = 'result'; text($('result'), `Huidige score: ${current} punten.`);
    const nowPassed = passes(current); if (nowPassed && !previouslyPassed) { $('score').classList.add('score-pulse'); $('workspace').classList.add('success-flash'); setTimeout(() => { $('score').classList.remove('score-pulse'); $('workspace').classList.remove('success-flash'); }, 1800); } previouslyPassed = nowPassed;
  }
  function movePost(source, target, after = false) {
    if (!order.includes(source) || !order.includes(target) || source === target) return;
    order = displayedOrder();
    const sourceWasVisible = visiblePosts.has(source), targetWasVisible = visiblePosts.has(target);
    order.splice(order.indexOf(source), 1);
    order.splice(order.indexOf(target) + (after ? 1 : 0), 0, source);
    if (!sourceWasVisible && targetWasVisible) {
      visiblePosts.add(source);
      if (visiblePosts.size > config.feed_post_limit) {
        visiblePosts.delete([...order].reverse().find(id => visiblePosts.has(id)));
      }
    } else if (sourceWasVisible && !targetWasVisible) {
      visiblePosts.delete(source); visiblePosts.add(target);
    }
    render();
  }
  function drop(event) {
    event.preventDefault();
    movePost(event.dataTransfer.getData('text/plain'), event.target.closest('.post')?.dataset.id);
  }
  function validate(data) {
    if (!data || data.source_format !== 'feed-algoritme-handmatig-v1' || !Array.isArray(data.posts) || !Array.isArray(data.comments)) throw Error('De configuratie is geen geldige Feedalgoritme: handmatig v1-configuratie.');
    if (!Number.isInteger(data.feed_post_limit) || data.feed_post_limit < 1 || data.feed_post_limit > data.posts.length) throw Error('feed_post_limit moet een geheel getal vanaf 1 binnen het aantal posts zijn.');
    if (!data.target || !['more_than', 'less_than'].includes(data.target.comparison) || !Number.isFinite(data.target.score)) throw Error('De scoredoelstelling is ongeldig.');
    const postIds = new Set(); data.posts.forEach(post => { if (!post.id || postIds.has(post.id) || !post.author_name || !post.headline || !post.body || !Number.isInteger(post.image_correction) || post.image_correction < -100 || post.image_correction > 100) throw Error('Elke post heeft een uniek id, tekst en beeldvormingcorrectie van −100 t/m 100 nodig.'); postIds.add(post.id); });
    const commentIds = new Set(); data.comments.forEach(comment => { if (!comment.id || commentIds.has(comment.id) || !postIds.has(comment.post_id) || !comment.author_name || !comment.body || !Number.isInteger(comment.score) || comment.score < -5 || comment.score > 5) throw Error('Elke reactie heeft een uniek id, bestaande post en score van −5 t/m 5 nodig.'); commentIds.add(comment.id); });
  }
  async function load() {
    $('loading').hidden = false; $('workspace').hidden = true; $('error').hidden = true;
    try {
      const path = new URL(location.href).searchParams.get('data') || './example.json';
      const response = await fetch(path, {cache: 'no-store'});
      if (!response.ok) throw Error(`HTTP ${response.status}`);
      const next = clone(await response.json()); validate(next); config = next;
      if (!completion) completion = window.LearningToolsCompletion?.create({
        cooldownSeconds: config.cooldownSeconds, toolId: 'feed-algoritme-handmatig', version: 'v1', dataUrl: path,
        uniqueId: new URL(location.href).searchParams.get('unique_id') || config.unique_id || `feed-algoritme-handmatig:${new URL(path, location.href).href}`,
        title: config.title, containerEl: $('workspace'), onReset: load, standalone: false,
      });
      collapsedComments.clear();
      order = config.posts.map(post => post.id);
      visiblePosts = new Set(order.slice(0, config.feed_post_limit)); visibleComments = new Set(); previouslyPassed = false;
      for (const post of config.posts) {
        config.comments.filter(comment => comment.post_id === post.id).slice(0, COMMENT_LIMIT).forEach(comment => visibleComments.add(comment.id));
      }
      $('pageTitle').textContent = config.title; $('instructionTitle').textContent = config.instruction_title;
      $('instructionText').textContent = config.instruction_text;
      const direction = config.target.comparison === 'more_than' ? 'meer' : 'minder';
      $('targetText').innerHTML = `Je hebt deze oefening succesvol afgerond als je <b>${direction}</b> dan <b>${config.target.score}</b> punten hebt.`;
      render(); $('workspace').hidden = false; $('loading').hidden = true;
    } catch (error) {
      $('workspace').hidden = true; $('loading').hidden = true; $('error').hidden = false; $('errorText').textContent = error.message;
    }
  }
  $('feed').addEventListener('dragover', event => event.preventDefault());
  $('feed').addEventListener('drop', drop);
  $('checkScore').addEventListener('click', () => {
    if (completion && !completion.beginAttempt()) return;
    const current = score(), ok = passes(current), result = $('result');
    if (ok) completion?.markCompleted({ score: { value: current } });
    result.className = `result ${ok ? 'success' : 'failure'}`;
    result.textContent = ok ? (completion?.isGrouped ? `Je hebt deze opdracht goed gemaakt. Score: ${current}.` : `Certificaat behaald — je score is ${current}.`) : `Helaas certificaat nog niet behaald — je score is ${current}.`;
  });
  $('retry').addEventListener('click', load); load();
})();
