/* Feedlab: all answers and edits stay in this browser. */
(function () {
  'use strict';
  const E = window.FeedLabEngine, $ = id => document.getElementById(id);
  const clone = value => JSON.parse(JSON.stringify(value));
  const node = (tag, text, cls) => { const el = document.createElement(tag); if (text !== undefined) el.textContent = text; if (cls) el.className = cls; return el; };
  const hash = text => { let n = 2166136261; for (const c of text) { n ^= c.charCodeAt(0); n = Math.imul(n, 16777619); } return (n >>> 0).toString(36); };
  const safeImageUrl = value => E.safeImageUrl(value) ? (value.startsWith('data:') ? value : new URL(value).href) : null;
  function readImage(file){
    return new Promise((resolve,reject)=>{
      if(!E.imageTypes.includes(file.type))return reject(Error('Kies PNG, JPEG, WebP of GIF. SVG is geen toegestane upload.'));
      if(!Number.isSafeInteger(file.size) || file.size<=0 || file.size>E.maxImageBytes)return reject(Error('De afbeelding mag maximaal 2 MiB zijn en mag niet leeg zijn.'));
      const reader=new FileReader();
      reader.onerror=()=>reject(Error('De afbeelding kon niet worden gelezen.'));
      reader.onload=()=>{const value=reader.result;if(typeof value!=='string' || !E.safeImageUrl(value) || !value.startsWith('data:'+file.type+';base64,'))return reject(Error('De afbeelding bevat geen geldige toegestane data-URL.'));resolve(value);};
      reader.readAsDataURL(file);
    });
  }
  async function authoredImage(url,file,alt,fallback){
    const value=file ? await readImage(file) : url.trim() || fallback;
    if(!value)return undefined;
    if(!E.safeImageUrl(value))throw Error('Gebruik een geldige http(s)-afbeeldings-URL of een toegestane upload van maximaal 2 MiB.');
    if(!alt.trim())throw Error('Vul een beschrijving van de afbeelding in.');
    return {url:value,alt:alt.trim()};
  }
  function imageUpload(parent,id){const input=node('input');input.type='file';input.accept='image/png,image/jpeg,image/webp,image/gif';return field(parent,'Of upload PNG, JPEG, WebP of GIF (maximaal 2 MiB)',input,id);}
  const freshSeed = () => { const n = new Uint32Array(2); crypto.getRandomValues(n); return Array.from(n, x => x.toString(36)).join('-'); };
  let assignedGroupId = null, activeGroupId = null, previewMode = false, assignmentKey, previewKey, data, initialData, viewingInitial = false, settings, initialSettings, initialIds, fingerprint, answers = {}, key, questionTopic, phase = 'before';
  const expanded = new Set();
  function notice(text) { $('notice').textContent = text; $('notice').hidden = false; }
  function read(key) { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch (_) { notice('Lokaal bewaren is niet beschikbaar of opgeslagen gegevens zijn beschadigd. Bewaar je feedcode en exporteer je antwoorden zelf.'); return null; } }
  function write(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) { notice('Lokaal bewaren is niet gelukt. Bewaar je feedcode en download je antwoorden zelf.'); } }
  function save() { write(key, { settings, initialSettings, initialIds, initialData, viewingInitial, answers, preview:data }); write(previewKey,data); write(assignmentKey,{group_id:assignedGroupId}); }
  function updateUrl() { try { const u = new URL(location.href); u.searchParams.set('seed', settings.seed); u.searchParams.delete('cohort'); history.replaceState(null, '', u); } catch (_) { notice('De URL kon niet worden bijgewerkt. Bewaar je feedcode zelf.'); } }
  function download(name, content, type) { const url = URL.createObjectURL(new Blob([content], { type })); const a = node('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
  function select(options, value) { const s = node('select'); options.forEach(([v, text]) => { const o = node('option', text); o.value = v; s.append(o); }); s.value = String(value); return s; }
  function field(parent, label, input, id) { const wrap = node('div'); input.id = id; const l = node('label', label); l.htmlFor = id; wrap.append(l, input); parent.append(wrap); return input; }
  function numeric(value, min, max, step) { const i = node('input'); i.type = 'number'; i.value = value; i.min = min; if (max !== undefined) i.max = max; i.step = step || 1; return i; }
  function date(value) { const d = new Date(value); return Number.isNaN(d.getTime()) ? value : d.toLocaleString('nl-NL', { dateStyle: 'medium', timeStyle: 'short' }); }
  function person(item, timestamp) {
    const header = node('div', undefined, 'post-head');
    const name = item.author_name || item.author_id;
    const portrait = node('img', undefined, 'avatar');
    const number = parseInt(hash(String(item.author_id || name)), 36) % 20 + 1;
    portrait.src = './avatars/profile-' + String(number).padStart(2, '0') + '.png';
    portrait.alt = '';
    portrait.width = 44;
    portrait.height = 44;
    portrait.loading = 'lazy';
    const byline = node('div', undefined, 'byline');
    byline.append(node('strong', name), node('small', date(timestamp) + ' · ' + item.id));
    header.append(portrait, byline);
    return header;
  }
  function reactionMetric(kind, text) {
    const metric = node('span', undefined, 'reaction-metric');
    const icon = node('img', undefined, 'reaction-icon');
    icon.src = './reaction-' + kind + '.svg';
    icon.alt = '';
    icon.setAttribute('aria-hidden', 'true');
    metric.append(icon, node('span', text));
    return metric;
  }
  function metrics(item, comment) { const m = item.metrics || {}; const bar = node('div', undefined, 'metrics'); const likes = comment ? (m.likes ?? m.thumbs_up ?? 0) : (m.likes ?? 0); bar.append(reactionMetric('like', likes + ' ' + (comment ? 'eens / likes' : 'likes')), reactionMetric('angry', (m.angry ?? 0) + ' boos'), node('span', '↳ ' + (m.reply_count ?? 0) + ' reacties')); if (m.dislikes !== undefined || m.thumbs_down !== undefined) bar.append(node('span', '↓ ' + (m.dislikes ?? m.thumbs_down) + ' ' + (comment ? 'oneens' : 'dislikes'))); return bar; }
  function viewData() { return viewingInitial ? initialData : data; }
  function renderComments(postId, parentId, depth) { const list = node('div', undefined, depth ? 'thread' : 'comments'); if (depth > 100) { list.append(node('p', 'Deze thread is te diep om verder te tonen.')); return list; } const children = E.rankComments(viewData(), postId, parentId, settings); children.forEach(c => { const article = node('article', undefined, 'comment'); article.dataset.commentId = c.id; article.append(person(c, c.created_at), node('p', c.body, 'body-text'), metrics(c, true)); const replies = renderComments(postId, c.id, depth + 1); if (replies.childElementCount) article.append(replies); list.append(article); }); return list; }
  function postBody(text) {
    const body = node('p', undefined, 'body-text');
    const characters = Array.from(text);
    let end = Math.min(175, characters.length);
    if (characters.length > end) {
      while (end > 0 && !/\s/u.test(characters[end])) end--;
      // Keep an unusually long first word intact.
      if (!end) {
        end = 175;
        while (end < characters.length && !/\s/u.test(characters[end])) end++;
      }
    }
    const preview = characters.slice(0, end).join('').trimEnd();
    if (end >= characters.length || !characters.slice(end).join('').trim()) {
      body.textContent = text;
      return body;
    }
    const content = node('span', preview + '... ');
    const more = node('button', 'Meer weergeven', 'post-more');
    more.type = 'button';
    more.setAttribute('aria-expanded', 'false');
    more.addEventListener('click', () => {
      content.textContent = text;
      more.setAttribute('aria-expanded', 'true');
      more.hidden = true;
    });
    body.append(content, more);
    return body;
  }
  function renderFeed() { const shownData = viewData(); const posts = E.rankPosts(shownData, settings); $('feed').replaceChildren(); posts.forEach(p => { const article = node('article', undefined, 'post'); article.dataset.postId = p.id; const topic = shownData.topics.find(t => t.id === p.topic_id); article.append(person(p, p.published_at), node('span', topic ? topic.title : p.topic_id, 'topic'), node('h3', p.headline), postBody(p.body)); { const img = node('img', undefined, 'post-image'); const url=p.image && safeImageUrl(p.image.url);img.src=url || './placeholder.svg';img.alt=url ? p.image.alt : 'Nog geen afbeelding';img.dataset.placeholder=String(!url);img.loading='lazy';img.referrerPolicy='no-referrer';img.addEventListener('error',()=>{if(img.dataset.placeholder==='true')return;img.dataset.placeholder='true';img.src='./placeholder.svg';img.alt='Nog geen afbeelding';});article.append(img); } article.append(metrics(p, false)); const available = shownData.comments.filter(c => c.post_id === p.id).length; const toggle = node('button', (expanded.has(p.id) ? 'Verberg' : 'Bekijk') + ' reacties · ' + available + ' beschikbaar', 'quiet comments-toggle'); toggle.type = 'button'; toggle.setAttribute('aria-expanded', String(expanded.has(p.id))); const container = node('div'); container.id = 'thread-' + p.id; toggle.setAttribute('aria-controls', container.id); container.hidden = !expanded.has(p.id); if (!container.hidden) container.append(renderComments(p.id, null, 0)); toggle.addEventListener('click', () => { if (expanded.has(p.id)) expanded.delete(p.id); else expanded.add(p.id); container.hidden = !expanded.has(p.id); toggle.setAttribute('aria-expanded', String(!container.hidden)); toggle.textContent = (container.hidden ? 'Bekijk' : 'Verberg') + ' reacties · ' + available + ' beschikbaar'; container.replaceChildren(); if (!container.hidden) container.append(renderComments(p.id, null, 0)); }); article.append(toggle, container); $('feed').append(article); }); if (!posts.length) $('feed').append(node('p', 'Er passen geen berichten bij deze instellingen.', 'panel')); $('publicSeed').textContent = 'Feedcode: ' + settings.seed; renderGroupBadge(); $('feedCount').textContent = posts.length + ' van ' + shownData.posts.length + ' berichten' + (viewingInitial ? ' · beginfeed (lokale aanvullingen bewaard)' : ''); $('selectionInfo').textContent = 'Selectie: ' + posts.length + ' berichten. Per onderwerp: ' + (settings.perTopic || 'onbeperkt') + '; totaal: ' + (settings.postLimit || 'alle') + '; reacties per ouder: ' + (settings.commentLimit || 'alle') + '. Feedcode: ' + settings.seed; }
  function renderRules() { $('ruleFields').replaceChildren(); $('weightFields').replaceChildren(); const rankings = { postRank: [['weighted','Gewogen mix'],['likes','Meeste likes'],['angry','Meeste boosreacties'],['combined','Likes + boosreacties'],['reply_count','Meeste reacties'],['newest','Nieuwste eerst'],['random','Vaste toevalsvolgorde']], commentRank: [['thumbs_up','Meeste eens / likes'],['thumbs_down','Meeste oneens'],['angry','Meeste boosreacties'],['combined','Eens + boosreacties'],['reply_count','Meeste reacties'],['newest','Nieuwste eerst'],['random','Vaste toevalsvolgorde']] };
    const controls = [['seed','Feedcode',null],['postRank','Berichten rangschikken',rankings.postRank],['commentRank','Reacties rangschikken',rankings.commentRank],['commentStanceBias','Standpuntbias reacties (−1 tot 1)',null],['topicId','Onderwerp',[['','Alle onderwerpen'], ...data.topics.map(t => [t.id,t.title])]],['postLimit','Aantal berichten (0 = alle)',null],['perTopic','Maximaal per onderwerp (0 = alle)',null],['commentLimit','Reacties per ouder (0 = alle)',null],['maxPerAuthor','Maximaal per auteur (0 = alle)',null],['randomWeight','Toeval (0–1)',null],['likeWeight','Gewicht likes (0–1)',null],['angryWeight','Gewicht boosreacties (0–1)',null]];
    controls.forEach(([name,label,opts]) => { let i; if (opts) i = select(opts, settings[name]); else if (name === 'seed') { i = node('input'); i.value = settings.seed; i.maxLength = 200; } else i = numeric(settings[name],name==='commentStanceBias' ? -1 : 0,name.endsWith('Weight') || name==='commentStanceBias' ? 1 : undefined,name.endsWith('Weight') || name==='commentStanceBias' ? .05 : 1); field($('ruleFields'),label,i,'rule-'+name); i.addEventListener('input', () => { if (!i.checkValidity() || (name === 'seed' && !i.value.trim())) return; viewingInitial = false; settings[name] = opts || name === 'seed' ? i.value : Number(i.value); save(); updateUrl(); renderFeed(); }); });
    const labels = { stance_bias:'Handmatige standpuntbias (−1 tot 1)',engagement:'Betrokkenheid',emotional_intensity:'Emotionele intensiteit',information_quality:'Gemodelleerde informatiekwaliteit',recency:'Actualiteit',controversy:'Controverse',novelty:'Nieuwheid',predicted_dwell_seconds:'Voorspelde leestijd',topic_affinity:'Gemodelleerde onderwerpaffiniteit' }; Object.entries(labels).forEach(([name,label]) => { const i = numeric(settings.weights[name] || 0,name === 'stance_bias' ? -1 : 0,1,.05); field($('weightFields'),label,i,'weight-'+name); i.addEventListener('input', () => { if (!i.checkValidity()) return; viewingInitial = false; settings.weights[name] = Number(i.value); save(); renderFeed(); }); }); $('initialIds').textContent = initialIds.join(' → '); }
  function renderQuestions() { $('questionPanel').hidden = data.showQuestions===false; $('questions').replaceChildren(); if(data.showQuestions===false) return; const topic = questionTopic || data.topics[0].id; data.questions.filter(q => q.topic_id === topic && (q.phase === 'both' || q.phase === phase || q.phase === (phase === 'before' ? 'pre' : 'post'))).forEach(q => { const block = node('div',undefined,'question-block'); const answerKey = phase + ':' + q.id; let input; if (q.kind === 'percentage') { input = numeric(answers[answerKey] ?? '', q.min ?? 0, q.max ?? 100); input.placeholder = 'Overslaan / geen antwoord'; } else { input = select([['','Overslaan / geen antwoord'],...Array.from({length:7},(_,i) => [String(i+1), String(i+1) + (i === 0 ? ' · '+q.min_label : i === 6 ? ' · '+q.max_label : '')])], answers[answerKey] ?? ''); } field(block,q.prompt,input,'answer-'+q.id); input.addEventListener('input', () => { if (!input.checkValidity()) { $('answerStatus').textContent = 'Vul een geldig getal tussen ' + input.min + ' en ' + input.max + ' in.'; return; } if (input.value === '') delete answers[answerKey]; else answers[answerKey] = Number(input.value); save(); $('answerStatus').textContent = 'Antwoord lokaal verwerkt. Je feed verandert niet.'; }); $('questions').append(block); }); }
  function visibleComments() {
    const result=[];
    const visit=(postId,parentId,depth)=>{if(depth>100)return;for(const c of E.rankComments(viewData(),postId,parentId,settings)){result.push(c.id);visit(postId,c.id,depth+1);}};
    for(const p of E.rankPosts(viewData(),settings)) if(expanded.has(p.id)) visit(p.id,null,0);
    return result;
  }
  function toolConfig() {
    const preservedGroups=(data.respondent_groups || []).map(g=>({...clone(g),settings:E.defaults(data,undefined,g.id)}));
    const result={...clone(data),respondent_groups:preservedGroups,source_format:'feed-lab-v1',initial_settings:clone(settings),theme:E.themeFor(data),respondent_assignment:{group_id:assignedGroupId}};
    if(activeGroupId) result.respondent_groups.find(g=>g.id===activeGroupId).settings=clone(settings);
    if(previewMode && activeGroupId) result.respondent_assignment.preview_group_id=activeGroupId;
    return result;
  }
  function research() { return {source:'Feedlab v1',dataset:fingerprint,respondent_group:assignedGroupId ? {id:assignedGroupId,label:data.respondent_groups.find(g=>g.id===assignedGroupId)?.label} : null,active_group:activeGroupId,local_preview:previewMode,feedcode:settings.seed,initialSettings:clone(initialSettings),initialIds:clone(initialIds),settings:clone(settings),visibleIds:E.rankPosts(viewData(),settings).map(p=>p.id),visibleCommentIds:visibleComments()}; }
  function exportAnswers(text) { const result = { ...research(),dataset:fingerprint,feedcode:settings.seed,initialSettings,initialIds,settings,visibleIds:E.rankPosts(viewData(),settings).map(p=>p.id),questions:data.questions,answers }; download('feedlab-antwoorden.'+(text?'txt':'json'),text ? 'Vrijwillige lokale antwoorden\n\n'+JSON.stringify(result,null,2) : JSON.stringify(result,null,2),text?'text/plain':'application/json'); }
  function formInput(form,name,label,type,required) { const i = node(type === 'textarea' ? 'textarea' : 'input'); if (type !== 'textarea') i.type = type; i.name = name; i.required = !!required; if (type === 'number') { i.min=0; i.value=0; i.step=1; } field(form,label,i,'author-'+name); return i; }
  function addAuthorForms() { const target=$('authorForms'); target.replaceChildren(); ['post','comment'].forEach(kind => { const detail=node('details'); detail.append(node('summary',kind==='post'?'Bericht toevoegen':'Reactie toevoegen')); const f=node('form'); const grid=node('div',undefined,'grid'); f.append(grid); const author=formInput(grid,kind+'Author','Auteursnaam','text',true); const timestamp=formInput(grid,kind+'Date','Datum en tijd','datetime-local',true); timestamp.value=new Date().toISOString().slice(0,16); let topic, post, parent, headline, image, upload, alt;
    if (kind==='post') { topic=field(grid,'Onderwerp',select(data.topics.map(t=>[t.id,t.title]),data.topics[0].id),'author-topic'); headline=formInput(grid,'headline','Kop','text',true); image=formInput(grid,'image','Afbeeldings-URL (http/https)','url',false);upload=imageUpload(grid,'author-imageUpload'); alt=formInput(grid,'alt','Beschrijving afbeelding','text',false); } else { post=field(grid,'Bij bericht',select(data.posts.map(p=>[p.id,p.headline]),data.posts[0]?.id),'author-post'); parent=field(grid,'Ouderreactie',select([],''),'author-parent'); const refresh=()=>{ parent.replaceChildren(node('option','Direct bij het bericht')); parent.firstChild.value=''; data.comments.filter(c=>c.post_id===post.value).forEach(c=>{ const o=node('option',c.author_name+': '+c.body.slice(0,55));o.value=c.id;parent.append(o); }); }; post.addEventListener('change',refresh); refresh(); }
    const body=formInput(f,kind+'Body','Inhoud','textarea',true), likes=formInput(grid,kind+'Likes',kind==='post'?'Likes':'Eens / likes','number',true), angry=formInput(grid,kind+'Angry','Boosreacties','number',true); const submit=node('button','Voeg lokaal toe'); submit.type='submit';f.append(submit); f.addEventListener('submit',async event=>{event.preventDefault();try { const next=clone(data),id='local_'+kind+'_'+freshSeed(),authorId='fictional_'+hash(author.value); const metrics={angry:Number(angry.value),reply_count:0}; if(kind==='post'){ metrics.likes=Number(likes.value); const p={id,topic_id:topic.value,author_id:authorId,author_name:author.value,published_at:new Date(timestamp.value).toISOString(),headline:headline.value,body:body.value,stance:0,metadata:{},metrics,comment_ids:[],fictional:true}; const picture=await authoredImage(image.value,upload.files[0],alt.value);if(picture)p.image=picture;next.posts.push(p); } else { metrics.thumbs_up=Number(likes.value);metrics.thumbs_down=0;next.comments.push({id,post_id:post.value,parent_id:parent.value||null,author_id:authorId,author_name:author.value,body:body.value,created_at:new Date(timestamp.value).toISOString(),stance:0,metrics,fictional:true});const p=next.posts.find(p=>p.id===post.value);p.comment_ids=p.comment_ids||[];p.comment_ids.push(id); } E.validate(next);data=next;viewingInitial=false;save();renderFeed();addAuthorForms();notice('Lokale preview bijgewerkt. Exporteer de toolconfig om je wijzigingen mee te nemen. De serverbron is niet gewijzigd.'); }catch(error){notice('Niet toegevoegd: '+error.message);} }); detail.append(f);target.append(detail); }); addImageEditor(target); }
  function addImageEditor(target){
    const detail=node('details');detail.id='imageEditor';detail.append(node('summary','Afbeelding van bestaand bericht aanpassen'));
    const form=node('form');form.id='imageForm';const grid=node('div',undefined,'grid');form.append(grid);
    const post=field(grid,'Bericht',select(data.posts.map(p=>[p.id,p.headline]),data.posts[0]?.id || ''),'image-post');
    const url=node('input');url.type='url';field(grid,'Afbeeldings-URL (http/https)',url,'image-url');
    const upload=imageUpload(grid,'image-upload');const alt=node('input');field(grid,'Beschrijving afbeelding',alt,'image-alt');
    const refresh=()=>{const p=data.posts.find(p=>p.id===post.value);url.value=p?.image?.url.startsWith('http') ? p.image.url : '';alt.value=p?.image?.alt || '';upload.value='';};post.addEventListener('change',refresh);refresh();
    form.append(node('p','Een upload gaat voor de URL. Zonder nieuwe URL of upload blijft de bestaande afbeelding behouden. Afbeeldingen worden lokaal bewaard en gaan mee in de toolconfig.'));
    const actions=node('div',undefined,'actions');const submit=node('button','Afbeelding lokaal bewaren');submit.type='submit';const clear=node('button','Afbeelding wissen (placeholder tonen)','quiet');clear.id='image-clear';clear.type='button';actions.append(submit,clear);form.append(actions);
    function commit(next){E.validate(next);data=next;viewingInitial=false;save();renderFeed();refresh();notice('Afbeelding lokaal bijgewerkt. Exporteer de toolconfig om de wijziging mee te nemen.');}
    form.addEventListener('submit',async event=>{event.preventDefault();try{const next=clone(data),p=next.posts.find(p=>p.id===post.value);if(!p)throw Error('Kies een bestaand bericht.');const picture=await authoredImage(url.value,upload.files[0],alt.value,p.image?.url);if(picture)p.image=picture;else delete p.image;commit(next);}catch(error){notice('Afbeelding niet gewijzigd: '+error.message);}});
    clear.addEventListener('click',()=>{const next=clone(data),p=next.posts.find(p=>p.id===post.value);if(!p)return;delete p.image;commit(next);});
    detail.append(form);target.append(detail);
  }
  function accentInk(color){
    const channels=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
    const luminance=.2126*channels[0]+.7152*channels[1]+.0722*channels[2];
    return luminance>.179 ? '#000000' : '#FFFFFF';
  }
  function renderTheme(){
    const theme=E.themeFor(data);
    for(const [key,value] of Object.entries(theme)){
      document.documentElement.style.setProperty('--'+key,value);
      $('theme-'+key).value=value;
    }
    document.documentElement.style.setProperty('--accent-ink',accentInk(theme.accent));
    const hover=theme.accent.toLowerCase()==='#1877f3'?'#3B5999':theme.accent;
    document.documentElement.style.setProperty('--accent-hover',hover);
    document.documentElement.style.setProperty('--accent-hover-ink',accentInk(hover));
  }
  function chooseRandomGroup(groups,random32) {
    if(!groups.length) return null;
    if(groups.length===1) return groups[0].id;
    const draw=random32 || (()=>{const bytes=new Uint32Array(1);crypto.getRandomValues(bytes);return bytes[0];});
    // Rejection sampling gives exactly equal chances without a modulo remainder.
    const cutoff=4294967296-(4294967296%groups.length);let value;
    do {value=draw();if(!Number.isInteger(value) || value<0 || value>=4294967296)throw Error('Ongeldige toevalsbron.');} while(value>=cutoff);
    return groups[value%groups.length].id;
  }
  function normalizedData(next) {
    E.validate(next);const result=clone(next);
    if(result.respondent_groups===undefined && result.classroom) result.respondent_groups=clone(result.classroom.cohorts);
    delete result.classroom;result.source_format='feed-lab-v1';return result;
  }
  function groupName(id){return data.respondent_groups?.find(g=>g.id===id)?.label || 'Standaard';}
  function renderGroupBadge(){
    const label=assignedGroupId ? 'Groep: '+groupName(assignedGroupId) : 'Standaardgroep';
    $('groupBadge').textContent=label+(previewMode ? ' · preview: '+groupName(activeGroupId) : '');
    $('groupStatus').textContent=previewMode ? 'Lokale preview van '+groupName(activeGroupId)+'. Je toegewezen groep blijft '+groupName(assignedGroupId)+'.' : 'Toegewezen groep: '+groupName(assignedGroupId)+'. Aanpassingen aan de regels zijn lokaal totdat je ze bewaart voor een groep of exporteert.';
  }
  function renderGroups(selectedId){
    const groups=data.respondent_groups || [];
    const options=groups.map(g=>[g.id,g.label]);
    const picker=select(options,selectedId || activeGroupId || groups[0]?.id || '');
    $('groupSelect').replaceChildren(...Array.from(picker.children));$('groupSelect').value=picker.value;
    const selected=groups.find(g=>g.id===picker.value);$('groupLabel').value=selected?.label || '';
    for(const id of ['renameGroup','removeGroup','saveGroupSettings','previewGroup']) $(id).disabled=!selected;
    $('returnAssigned').hidden=!previewMode;renderGroupBadge();
  }
  function stateKey(groupId){return 'feedlab-v1:state:'+hash(data.unique_id)+':'+fingerprint+':'+(groupId || 'default');}
  function loadGroupPreview(id,isPreview,restoreState=false){
    save();
    const nextSettings=E.defaults(data,settings.seed,id);
    E.rankPosts(data,nextSettings);
    activeGroupId=id;previewMode=isPreview;key=stateKey(id);
    const stored=read(key);
    initialData=clone(data);initialSettings=clone(nextSettings);initialIds=E.rankPosts(initialData,initialSettings).map(p=>p.id);
    settings=clone(nextSettings);viewingInitial=false;answers=stored?.answers || {};expanded.clear();
    if(restoreState && stored){
      if(stored.initialData){E.validate(stored.initialData);initialData=stored.initialData;}
      if(stored.initialSettings)initialSettings=E.settingsFor(data,stored.initialSettings);
      if(stored.settings)settings=E.settingsFor(data,stored.settings);
      initialIds=E.rankPosts(initialData,initialSettings).map(p=>p.id);viewingInitial=!!stored.viewingInitial;
    }
    // Loading a group's algorithm uses its saved defaults, not the previous preview edits.
    renderRules();renderFeed();renderQuestions();renderGroups(id);save();
  }
  function updateGroups(nextGroups,after){
    const next={...clone(data),respondent_groups:nextGroups};delete next.respondent_assignment;E.validate(next);data=next;
    if(!nextGroups.some(g=>g.id===assignedGroupId)) assignedGroupId=chooseRandomGroup(nextGroups);
    if(!nextGroups.some(g=>g.id===activeGroupId)) {loadGroupPreview(assignedGroupId,false);} else previewMode=activeGroupId!==assignedGroupId;
    renderGroups(after);save();renderFeed();
  }
  function install(next, restore) {
    // Validate all imported content and overrides before replacing active state.
    next=normalizedData(next);
    if (!next.topics.length) throw Error('Deze interface vraagt minimaal één onderwerp. Voeg een onderwerp toe aan de toolconfig.');
    const nextFingerprint=hash(JSON.stringify(next)), datasetId=hash(next.unique_id);
    const nextAssignmentKey='feedlab-v1:assignment:'+datasetId;
    const nextPreviewKey='feedlab-v1:preview:'+datasetId+':'+nextFingerprint;
    let nextData=next;
    const preview=restore ? read(nextPreviewKey) : null;
    if(preview){try{E.validate(preview);if(!preview.topics.length || preview.unique_id!==next.unique_id)throw Error();nextData=preview;}catch(_){notice('De opgeslagen preview was ongeldig. De geladen bron wordt gebruikt.');}}
    const groups=nextData.respondent_groups || [];
    const previous=read(nextAssignmentKey)?.group_id;
    const imported=restore ? null : next.respondent_assignment;
    const remembered=imported?.group_id ?? previous;
    const nextAssigned=groups.find(g=>g.id===remembered)?.id || chooseRandomGroup(groups);
    const params=new URL(location.href).searchParams;
    const explicitPreview=restore ? params.get('group') : imported?.preview_group_id;
    const nextActive=groups.find(g=>g.id===explicitPreview)?.id || nextAssigned;
    const nextKey='feedlab-v1:state:'+datasetId+':'+nextFingerprint+':'+(nextActive || 'default');
    const stored=restore ? read(nextKey) : null;
    const requested=params.get('seed');
    const useStored=stored && (!requested || requested===stored.settings?.seed || requested===stored.initialSettings?.seed);
    const seed=(!restore && next.initial_settings?.seed) || requested || stored?.initialSettings?.seed || next.initial_settings?.seed || freshSeed();
    let nextInitialData=clone(nextData),nextInitialSettings=E.defaults(nextData,seed,nextActive);
    if(useStored && stored?.initialData){E.validate(stored.initialData);if(!stored.initialData.topics.length)throw Error('Opgeslagen beginsnapshot heeft geen onderwerpen.');nextInitialData=stored.initialData;}
    if(useStored && stored?.initialSettings)nextInitialSettings=E.settingsFor(nextData,{...nextInitialSettings,...stored.initialSettings,weights:{...nextInitialSettings.weights,...stored.initialSettings.weights}});
    const nextInitialIds=E.rankPosts(nextInitialData,nextInitialSettings).map(p=>p.id);
    let nextSettings=clone(nextInitialSettings);
    if(useStored && stored?.settings)nextSettings=E.settingsFor(nextData,{...nextSettings,...stored.settings,weights:{...nextSettings.weights,...stored.settings.weights}});
    E.rankPosts(nextData,nextSettings);
    data=nextData;initialData=nextInitialData;fingerprint=nextFingerprint;key=nextKey;assignmentKey=nextAssignmentKey;previewKey=nextPreviewKey;
    assignedGroupId=nextAssigned;activeGroupId=nextActive;previewMode=nextActive!==nextAssigned;
    initialSettings=nextInitialSettings;initialIds=nextInitialIds;settings=nextSettings;
    viewingInitial=!!(useStored && stored?.viewingInitial);answers=stored?.answers || {};
    questionTopic=data.topics[0].id;expanded.clear();$('title').textContent=data.title || data.lesson.title;
    const options=select(data.topics.map(t=>[t.id,t.title]),questionTopic);
    $('questionTopic').replaceChildren(...Array.from(options.children));$('questionTopic').value=questionTopic;
    renderRules();renderFeed();renderQuestions();renderGroups();renderTheme();addAuthorForms();updateUrl();save();
    $('settings').hidden=true;$('settingsToggle').hidden=data.showAlgorithmButton===false;$('settingsToggle').setAttribute('aria-expanded','false');
    $('workspace').hidden=false;$('loading').hidden=true;$('error').hidden=true;$('groupBadge').hidden=false;
    if(previous && !groups.some(g=>g.id===previous) && !imported)notice('De vorige groep bestaat niet meer. Er is automatisch een beschikbare groep toegewezen.');
  }
  async function load(){ $('loading').hidden=false;$('workspace').hidden=true;$('error').hidden=true;try{const path=new URL(location.href).searchParams.get('data') || './example.json'; const response=await fetch(path);if(!response.ok)throw Error('HTTP '+response.status);const next=await response.json();install(next,true);}catch(error){$('loading').hidden=true;$('error').hidden=false;$('errorText').textContent='Controleer de dataset-URL of JSON. '+error.message;}}
  for(const name of Object.keys(E.themeDefaults)) $('theme-'+name).addEventListener('input',e=>{
    if(!/^#[0-9a-fA-F]{6}$/.test(e.target.value)){notice('Gebruik een hexkleur zoals #1877F3.');return;}
    data={...data,theme:{...E.themeFor(data),[name]:e.target.value}};renderTheme();save();
  });
  $('resetTheme').addEventListener('click',()=>{data={...data,theme:{...E.themeDefaults}};renderTheme();save();notice('Standaardkleuren hersteld.');});
  $('groupSelect').addEventListener('change',()=>{const g=data.respondent_groups.find(g=>g.id===$('groupSelect').value);$('groupLabel').value=g?.label || '';});
  $('addGroup').addEventListener('click',()=>{
    const label=$('newGroupLabel').value.trim();if(!label){notice('Vul een groepsnaam in.');return;}
    const id='groep_'+freshSeed();const groups=clone(data.respondent_groups || []);groups.push({id,label,settings:clone(settings)});updateGroups(groups,id);$('newGroupLabel').value='';notice('Respondentgroep toegevoegd met de huidige algoritme-instellingen. Exporteer de toolconfig om dit te delen.');
  });
  $('renameGroup').addEventListener('click',()=>{const label=$('groupLabel').value.trim();if(!label){notice('Vul een groepsnaam in.');return;}const groups=clone(data.respondent_groups);const g=groups.find(g=>g.id===$('groupSelect').value);if(!g)return;g.label=label;updateGroups(groups,g.id);notice('Groepsnaam lokaal bijgewerkt.');});
  $('removeGroup').addEventListener('click',()=>{const id=$('groupSelect').value;updateGroups(data.respondent_groups.filter(g=>g.id!==id));notice('Groep lokaal verwijderd. Bij een verwijderde toewijzing kiest de tool opnieuw uit de resterende groepen.');});
  $('saveGroupSettings').addEventListener('click',()=>{const groups=clone(data.respondent_groups);const g=groups.find(g=>g.id===$('groupSelect').value);if(!g)return;g.settings=clone(settings);updateGroups(groups,g.id);notice('Huidige algoritme-instellingen bewaard voor '+g.label+'. Antwoorden zijn niet ingevuld of overgenomen.');});
  $('previewGroup').addEventListener('click',()=>{const id=$('groupSelect').value;if(!data.respondent_groups?.some(g=>g.id===id))return;loadGroupPreview(id,id!==assignedGroupId);notice('Algoritme van '+groupName(id)+' geladen als lokale preview.');});
  $('returnAssigned').addEventListener('click',()=>{const url=new URL(location.href);url.searchParams.delete('group');history.replaceState(null,'',url);loadGroupPreview(assignedGroupId,false,true);updateUrl();});
  $('exportResearch').addEventListener('click',()=>download('feedlab-instellingen-onderzoek.json',JSON.stringify(research(),null,2),'application/json'));
  $('settingsToggle').addEventListener('click',()=>{if(!settings || data.showAlgorithmButton===false)return;const open=$('settings').hidden;$('settings').hidden=!open;$('settingsToggle').setAttribute('aria-expanded',String(open));});
  $('rules').addEventListener('submit',e=>e.preventDefault());$('reset').addEventListener('click',()=>{viewingInitial=true;settings=clone(initialSettings);save();updateUrl();renderRules();renderFeed();});$('newSeed').addEventListener('click',()=>{viewingInitial=false;settings.seed=freshSeed();save();updateUrl();renderRules();renderFeed();});
  $('questionTopic').addEventListener('change',e=>{questionTopic=e.target.value;renderQuestions();});$('questionPhase').addEventListener('change',e=>{phase=e.target.value;renderQuestions();});$('clearAnswers').addEventListener('click',()=>{answers={};save();renderQuestions();$('answerStatus').textContent='Alle lokale antwoorden voor deze dataset gewist.';});$('exportAnswers').addEventListener('click',()=>exportAnswers(false));$('exportText').addEventListener('click',()=>exportAnswers(true));$('exportData').addEventListener('click',()=>download('feedlab-toolconfig.json',JSON.stringify(toolConfig(),null,2),'application/json'));$('importData').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{install(JSON.parse(await file.text()),false);notice('Geïmporteerde dataset actief als lokale preview. De oorspronkelijke bron is niet gewijzigd.');}catch(error){notice('Import geweigerd: '+error.message);}e.target.value='';});$('retry').addEventListener('click',load);
  window.FeedLabUI={safeImageUrl,hash,toolConfig,research,chooseRandomGroup,accentInk,readImage};
  load();
}());
