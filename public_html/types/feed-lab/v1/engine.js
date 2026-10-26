/* Feedlab v1: pure deterministic ranking over preserved authoring data. */
(function (root) {
  'use strict';
  const weightKeys = ['stance_bias','engagement','emotional_intensity','information_quality','recency','controversy','novelty','predicted_dwell_seconds','topic_affinity'];
  const postRanks = ['weighted','likes','angry','combined','reply_count','newest','random'];
  const commentRanks = ['thumbs_up','thumbs_down','angry','combined','reply_count','newest','random'];
  const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
  const text = x => typeof x === 'string' && x.trim().length > 0;
  function fail(message) { throw Error(message); }
  function hash(value) {
    let h = 2166136261;
    for (const c of String(value)) { h ^= c.codePointAt(0); h = Math.imul(h,16777619); }
    h ^= h >>> 16; h = Math.imul(h,0x7feb352d); h ^= h >>> 15; h = Math.imul(h,0x846ca68b); h ^= h >>> 16;
    return h >>> 0;
  }
  const random = (seed,id) => hash(`${seed}|${id}`)/4294967296;
  const tie = (a,b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  const maxImageBytes=2*1024*1024;
  const imageTypes=['image/png','image/jpeg','image/webp','image/gif'];
  function safeImageUrl(value) {
    if (!text(value) || value !== value.trim() || /[\u0000-\u0020\u007f]/.test(value)) return false;
    if(value.startsWith('data:')){
      if(value.length>Math.ceil(maxImageBytes/3)*4+40)return false;
      const match=/^data:image\/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
      if(!match || match[2].length%4!==0)return false;
      const payload=match[2],bytes=payload.length/4*3-(payload.endsWith('==')?2:payload.endsWith('=')?1:0);
      return bytes>0 && bytes<=maxImageBytes;
    }
    try { const url = new URL(value); return ['http:','https:'].includes(url.protocol) && !url.username && !url.password; } catch (_) { return false; }
  }
  function validDate(value) {
    if (typeof value !== 'string') return false;
    const m = /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d)(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.exec(value);
    if (!m || !Number.isFinite(Date.parse(value))) return false;
    const [,y,mo,day,hour,minute,second] = m.map(Number);
    const days = [31,(y%4===0 && (y%100!==0 || y%400===0))?29:28,31,30,31,30,31,31,30,31,30,31];
    return mo>=1 && mo<=12 && day>=1 && day<=days[mo-1] && hour<24 && minute<60 && second<60;
  }
  const themeDefaults=Object.freeze({background:'#F0F2F5',card:'#FFFFFF',text:'#1C1E21',accent:'#1877F3'});
  function themeFor(data) {
    const theme=data.theme ?? {};
    if(data.theme===null || !object(theme) || Object.keys(theme).some(k=>!Object.hasOwn(themeDefaults,k)) || Object.values(theme).some(v=>typeof v!=='string' || !/^#[0-9a-fA-F]{6}$/.test(v))) fail('Vormgeving: gebruik uitsluitend hexkleuren (#RRGGBB).');
    return {...themeDefaults,...theme};
  }
  function validate(data) {
    if (!object(data) || !['feed-lab-v1','feed-lab-v2','feed-lab-v3'].includes(data.source_format) || !text(data.title) || !text(data.unique_id) || !object(data.lesson) || !text(data.lesson.id) || !text(data.lesson.title)) fail('Ongeldige Feedlab v1-configuratie of les.');
    for (const key of ['topics','posts','comments','questions']) if (!Array.isArray(data[key])) fail(`${key}: lijst ontbreekt.`);
    const ids = new Set();
    function identify(node,label) {
      if (!object(node) || !text(node.id) || ids.has(node.id)) fail(`${label}: ontbrekend of dubbel ID.`);
      ids.add(node.id);
    }
    const topics = new Set();
    for (const topic of data.topics) { identify(topic,'Onderwerp'); if (!text(topic.title)) fail('Onderwerptitel ontbreekt.'); topics.add(topic.id); }
    const posts = new Map(), comments = new Map();
    function metrics(node) {
      if (!object(node.metrics) || Object.values(node.metrics).some(v => !Number.isSafeInteger(v) || v < 0)) fail(`${node.id}: ongeldige metrics.`);
    }
    function author(node,dateKey) {
      if (!text(node.author_id) || !text(node.author_name) || !text(node.body) || !validDate(node[dateKey])) fail(`${node.id}: auteur, tekst of ISO-datum ongeldig.`);
      metrics(node);
      if (node.stance !== undefined && (!Number.isFinite(node.stance) || Math.abs(node.stance)>1)) fail(`${node.id}: stance buiten -1..1.`);
      if (node.metadata !== undefined && (!object(node.metadata) || Object.entries(node.metadata).some(([k,v]) => !Number.isFinite(v) || v<0 || (k !== 'predicted_dwell_seconds' && v>1)))) fail(`${node.id}: ongeldige metadata.`);
    }
    for (const p of data.posts) {
      identify(p,'Bericht'); author(p,'published_at');
      if (!topics.has(p.topic_id) || !text(p.headline)) fail(`${p.id}: onderwerp of kop ongeldig.`);
      if (p.image !== undefined && (!object(p.image) || !safeImageUrl(p.image.url) || !text(p.image.alt))) fail(`${p.id}: afbeelding vraagt een veilige http(s)-URL of PNG/JPEG/WebP/GIF-data-URL (maximaal 2 MiB) en alt-tekst.`);
      posts.set(p.id,p);
    }
    for (const c of data.comments) {
      identify(c,'Reactie'); author(c,'created_at');
      if (!posts.has(c.post_id) || (c.parent_id !== undefined && c.parent_id !== null && !text(c.parent_id))) fail(`${c.id}: ongeldig bericht of ouder.`);
      comments.set(c.id,c);
    }
    for (const c of data.comments) {
      if (c.parent_id != null) {
        const parent = comments.get(c.parent_id);
        if (!parent || parent.post_id !== c.post_id) fail(`${c.id}: ouder ontbreekt of hoort bij ander bericht.`);
      }
    }
    // Iterative graph walk avoids recursion limits, even for deep imported threads.
    const complete = new Set();
    for (const c of data.comments) {
      const path = new Set(); let current = c;
      while (current && !complete.has(current.id)) {
        if (path.has(current.id)) fail(`${c.id}: cyclus in reacties.`);
        path.add(current.id); current = comments.get(current.parent_id);
      }
      for (const id of path) complete.add(id);
    }
    for (const p of data.posts) if (p.comment_ids !== undefined) {
      if (!Array.isArray(p.comment_ids) || new Set(p.comment_ids).size !== p.comment_ids.length || p.comment_ids.some(id => !comments.has(id) || comments.get(id).post_id !== p.id)) fail(`${p.id}: ongeldige comment_ids.`);
    }
    for (const q of data.questions) {
      identify(q,'Vraag');
      if (!topics.has(q.topic_id) || !text(q.prompt) || !['before','after','both'].includes(q.phase) || !['likert_7','percentage'].includes(q.kind) || typeof q.required !== 'boolean') fail(`${q.id}: ongeldige vraag.`);
      if (q.kind === 'percentage' && (!Number.isFinite(q.min) || !Number.isFinite(q.max) || q.min < 0 || q.max >100 || q.min >= q.max)) fail(`${q.id}: ongeldig percentagebereik.`);
      if (q.kind === 'likert_7' && (!text(q.min_label) || !text(q.max_label))) fail(`${q.id}: schaallabel ontbreekt.`);
    }
    if (data.algorithm_defaults !== undefined && !object(data.algorithm_defaults)) fail('Ongeldige algorithm_defaults.');
    if (data.showAlgorithmButton !== undefined && typeof data.showAlgorithmButton !== 'boolean') fail('showAlgorithmButton: verwacht boolean.');
    if (data.showQuestions !== undefined && typeof data.showQuestions !== 'boolean') fail('showQuestions: verwacht boolean.');
    if (data.initial_settings !== undefined) validateOverrides(data, data.initial_settings);
    if (data.respondent_groups !== undefined && !Array.isArray(data.respondent_groups)) fail('respondent_groups: verwacht een lijst.');
    const groupList=data.respondent_groups ?? data.classroom?.cohorts;
    if (groupList !== undefined) {
      if (!Array.isArray(groupList)) fail('respondent_groups: verwacht een lijst.');
      const groups = new Set();
      for (const c of groupList) {
        if (!object(c) || Object.keys(c).some(k=>!['id','label','settings'].includes(k)) || !text(c.id) || !/^[a-zA-Z0-9_-]+$/.test(c.id) || groups.has(c.id) || !text(c.label) || !object(c.settings)) fail('Ongeldige of dubbele respondentgroep.');
        groups.add(c.id); validateOverrides(data,c.settings);
      }
    }
    if (data.classroom !== undefined && (!object(data.classroom) || !Array.isArray(data.classroom.cohorts) || !data.classroom.cohorts.length)) fail('Ongeldige legacygroepsconfiguratie.');
    if (data.respondent_assignment !== undefined) {
      const a=data.respondent_assignment;
      if (!object(a) || Object.keys(a).some(k=>!['group_id','preview_group_id'].includes(k)) || !(a.group_id===null || typeof a.group_id==='string') || !Object.hasOwn(a,'group_id') || (a.preview_group_id!==undefined && typeof a.preview_group_id!=='string')) fail('Ongeldige groepscontext.');
      for(const id of [a.group_id,a.preview_group_id]) if(id!=null && !groupList?.some(g=>g.id===id)) fail('Groepscontext verwijst naar ontbrekende groep.');
    }
    themeFor(data);
    settingsFor(data, {});
    return data;
  }
  function baseDefaults(data,seed) {
    const source = data.algorithm_defaults || {};
    const weights = Object.fromEntries(weightKeys.map(k => [k,0]));
    for (const k of weightKeys) if (Number.isFinite(source.post_weights?.[k])) weights[k] = source.post_weights[k];
    return {seed:String(seed ?? source.seed ?? 42),postRank:'weighted',commentRank:source.comment_rank_by || 'thumbs_up',commentStanceBias:0,postLimit:10,perTopic:source.posts_per_topic ?? 0,commentLimit:source.comments_per_post ?? data.lesson?.default_comments_per_post ?? 5,topicId:'',maxPerAuthor:0,randomWeight:0.2,likeWeight:0.5,angryWeight:0.5,weights};
  }
  function defaults(data,seed,groupId) {
    const base = baseDefaults(data);
    const initial = data.initial_settings || {};
    const cohort = (data.respondent_groups ?? data.classroom?.cohorts)?.find(c=>c.id===groupId)?.settings || {};
    const result = {...base,...initial,...cohort,weights:{...base.weights,...initial.weights,...cohort.weights}};
    if (seed !== undefined) result.seed=String(seed);
    return result;
  }
  function validateOverrides(data,value) {
    const base=baseDefaults(data);
    if (!object(value) || Object.keys(value).some(k=>!Object.hasOwn(base,k)) || (value.weights !== undefined && (!object(value.weights) || Object.keys(value.weights).some(k=>!weightKeys.includes(k))))) fail('Onbekende of ongeldige instellingen.');
    settingsFor(data,value);
  }
  function settingsFor(data,settings) {
    const base = defaults(data); const result = {...base,...settings,weights:{...base.weights,...settings?.weights}};
    if (typeof result.seed !== 'string' || !result.seed.length || result.seed.length>200 || !postRanks.includes(result.postRank) || !commentRanks.includes(result.commentRank) || typeof result.topicId !== 'string') fail('Ongeldige rankinginstellingen.');
    for (const key of ['postLimit','perTopic','commentLimit','maxPerAuthor']) if (!Number.isSafeInteger(result[key]) || result[key]<0) fail(`${key}: verwacht geheel getal vanaf 0.`);
    if (!Number.isFinite(result.commentStanceBias) || Math.abs(result.commentStanceBias)>1) fail('commentStanceBias: verwacht -1..1.');
    for (const key of ['randomWeight','likeWeight','angryWeight']) if (!Number.isFinite(result[key]) || result[key]<0 || result[key]>1) fail(`${key}: verwacht 0..1.`);
    for (const key of weightKeys) if (!Number.isFinite(result.weights[key]) || result.weights[key] < (key==='stance_bias' ? -1 : 0) || result.weights[key]>1) fail(`${key}: ongeldig gewicht.`);
    return result;
  }
  const metric = (node,key) => node.metrics?.[key] ?? (key==='likes' ? node.metrics?.thumbs_up : 0) ?? 0;
  function normalized(nodes,value,node) { const max = Math.max(0,...nodes.map(value)); return max ? value(node)/max : 0; }
  function recency(node,nodes,dateKey) {
    const times = nodes.map(n=>Date.parse(n[dateKey])); const min = Math.min(...times), max = Math.max(...times);
    return max===min ? 0 : (Date.parse(node[dateKey])-min)/(max-min);
  }
  function combined(node,nodes,s) { return s.likeWeight*normalized(nodes,n=>metric(n,'likes'),node)+s.angryWeight*normalized(nodes,n=>metric(n,'angry'),node); }
  function weighted(post,data,s) {
    let score = s.weights.stance_bias*(post.stance || 0);
    for (const key of weightKeys.filter(k=>k!=='stance_bias')) {
      const value = key==='recency' ? recency(post,data.posts,'published_at') : key==='engagement' ? combined(post,data.posts,s) : normalized(data.posts,p=>p.metadata?.[key] || 0,post);
      score += s.weights[key]*value;
    }
    return (1-s.randomWeight)*score+s.randomWeight*random(s.seed,post.id);
  }
  function scorePost(post,data,settings) {
    const s = settingsFor(data,settings);
    if (s.postRank === 'weighted') return weighted(post,data,s);
    if (s.postRank === 'random') return random(s.seed,post.id);
    if (s.postRank === 'newest') return Date.parse(post.published_at);
    if (s.postRank === 'combined') return combined(post,data.posts,s);
    return metric(post,s.postRank);
  }
  function rankPosts(data,settings) {
    const s = settingsFor(data,settings);
    const ranked = data.posts.filter(p=>!s.topicId || p.topic_id===s.topicId).map(p=>({p,score:scorePost(p,data,s)})).sort((a,b)=>b.score-a.score || tie(a.p,b.p));
    const topics = new Map(), authors = new Map(), result=[];
    for (const {p} of ranked) {
      if ((s.perTopic && (topics.get(p.topic_id)||0)>=s.perTopic) || (s.maxPerAuthor && (authors.get(p.author_id)||0)>=s.maxPerAuthor)) continue;
      topics.set(p.topic_id,(topics.get(p.topic_id)||0)+1); authors.set(p.author_id,(authors.get(p.author_id)||0)+1); result.push(p);
      if (s.postLimit && result.length>=s.postLimit) break;
    }
    return result;
  }
  function rankComments(data,postId,parentId,settings) {
    const s = settingsFor(data,settings);
    const siblings = data.comments.filter(c=>c.post_id===postId && (c.parent_id ?? null)===(parentId ?? null));
    const score = c => s.commentRank==='random' ? random(s.seed,c.id) : s.commentRank==='newest' ? Date.parse(c.created_at) : s.commentRank==='combined' ? combined(c,siblings,s) : metric(c,s.commentRank);
    const values=siblings.map(score), min=Math.min(...values), max=Math.max(...values);
    const rankedScore = c => s.commentStanceBias===0 ? score(c) : (max===min ? 0 : (score(c)-min)/(max-min))+s.commentStanceBias*(c.stance || 0);
    const result = siblings.map(c=>({c,score:rankedScore(c)})).sort((a,b)=>b.score-a.score || tie(a.c,b.c)).map(x=>x.c);
    return s.commentLimit ? result.slice(0,s.commentLimit) : result;
  }
  const api = {validate,maxImageBytes,imageTypes,themeFor,themeDefaults,defaults,settingsFor,rankPosts,rankComments,scorePost,hash,random,safeImageUrl,weightKeys,postRanks,commentRanks};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.FeedLabEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
