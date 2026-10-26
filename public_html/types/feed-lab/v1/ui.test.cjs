/* DOM integration checks; visual browser checks are separate. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const E = require('./engine.js');
class Element {
  constructor(tag) { this.tagName=tag;this.children=[];this.listeners={};this.attributes={};this.dataset={};this.value='';this.hidden=false;this.textContent='';this.files=[]; }
  append(...nodes){this.children.push(...nodes);} replaceChildren(...nodes){this.children=nodes;} setAttribute(k,v){this.attributes[k]=v;} getAttribute(k){return this.attributes[k];} addEventListener(k,f){(this.listeners[k] ||= []).push(f);} dispatch(k){return Promise.all((this.listeners[k]||[]).map(f=>f({target:this,preventDefault(){}})));} checkValidity(){return true;} click(){return this.dispatch('click');} get childElementCount(){return this.children.length;} get firstChild(){return this.children[0];}
}
function walk(el,predicate){if(predicate(el))return el;for(const child of el.children||[]){const found=walk(child,predicate);if(found)return found;}}
const plain = value => JSON.parse(JSON.stringify(value));
async function harness(options={}) {
  const minified=options.minified ?? process.env.FEEDLAB_MINIFIED==='1';
  const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8'), elements={};
  for(const match of html.matchAll(/id="([^"]+)"/g)) elements[match[1]]=new Element('div');
  elements.settings.hidden=true;
  const store=options.store || new Map(), downloads=[];
  const data=JSON.parse(fs.readFileSync(path.join(__dirname,'example.json'),'utf8'));
  delete data.respondent_groups;
  const p=data.posts[0];p.image={url:'https://example.invalid/image.jpg',alt:'Een fictieve foto'};p.body='<img src=x onerror=alert(1)>';
  const c=data.comments.find(c=>c.post_id===p.id);
  data.comments.push({...c,id:'fixture-child',parent_id:c.id,body:'Echte kindreactie'});p.comment_ids.push('fixture-child');
  options.configure?.(data);
  let url=options.url || 'https://example.invalid/tool/?seed=ui-test';
  const css={};
  class TestURL extends URL {}
  TestURL.createObjectURL=blob=>{downloads.push(blob);return 'blob:fixture';};TestURL.revokeObjectURL=()=>{};
  const context={console,URL:TestURL,Uint32Array,Blob,crypto:options.crypto || require('node:crypto').webcrypto,setTimeout(){},window:{FeedLabEngine:E},location:{get href(){return url;}},history:{replaceState(a,b,u){url=String(u);}},localStorage:{getItem(k){if(options.storageError)throw Error('blocked');return store.get(k)||null;},setItem(k,v){if(options.storageError)throw Error('blocked');store.set(k,v);}},document:{documentElement:{style:{setProperty(k,v){css[k]=v;}}},getElementById:id=>elements[id] || walk({children:Object.values(elements)},el=>el.id===id),createElement:tag=>new Element(tag)},fetch:async()=>{if(options.fetchError)throw Error('offline');return{ok:true,json:async()=>data};}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,minified?'app.min.js':'app.js'),'utf8'),context);
  await new Promise(resolve=>setImmediate(resolve));
  return {elements,context,data,store,css,downloads,html};
}
const research=h=>plain(h.context.window.FeedLabUI.research());
const postIds=h=>h.elements.feed.children.map(p=>p.dataset.postId);
const rule=(h,name)=>walk(h.elements.ruleFields,e=>e.id==='rule-'+name);
const fixedCrypto=value=>({getRandomValues(bytes){bytes.fill(value);return bytes;}});
function groupConfig(data) {
  data.respondent_groups=[
    {id:'A',label:'Groep A',settings:{postLimit:2,commentStanceBias:1,weights:{stance_bias:1}}},
    {id:'B',label:'Groep B',settings:{postLimit:3,commentStanceBias:-1,weights:{stance_bias:-1}}}
  ];
}
test('visitor interface has ranking controls and no authoring or design controls',async()=>{
  const h=await harness();
  assert.equal(h.elements.workspace.hidden,false);assert.equal(h.elements.settings.hidden,true);
  for(const asset of ['engine.min.js','app.min.js','style.min.css'])assert.ok(h.html.includes(asset));
  for(const id of ['groupManager','groupSelect','addGroup','renameGroup','removeGroup','saveGroupSettings','previewGroup','returnAssigned','resetTheme','importData','exportData','authorForms','initialIds'])assert.equal(h.elements[id],undefined,id);
  assert.doesNotMatch(h.html,/type="(?:file|color)"/);
  assert.equal(rule(h,'seed'),undefined);
  for(const name of ['postRank','commentRank','topicId','postLimit','perTopic','commentLimit','maxPerAuthor','commentStanceBias','randomWeight','likeWeight','angryWeight'])assert.ok(rule(h,name),name);
  for(const name of E.weightKeys)assert.ok(walk(h.elements.weightFields,e=>e.id==='weight-'+name));
  assert.equal(h.context.window.FeedLabUI.toolConfig,undefined);
  assert.equal(h.context.window.FeedLabUI.readImage,undefined);
  await h.elements.settingsToggle.click();
  assert.equal(h.elements.settings.hidden,false);assert.equal(h.elements.settingsToggle.attributes['aria-expanded'],'true');
});
test('ranking edits change the visible selection, persist and reset to configured defaults',async()=>{
  const h=await harness(), before=postIds(h);
  rule(h,'postLimit').value='2';await rule(h,'postLimit').dispatch('input');assert.equal(postIds(h).length,2);
  rule(h,'postRank').value='newest';await rule(h,'postRank').dispatch('input');
  assert.deepEqual(postIds(h),E.rankPosts(h.data,research(h).settings).map(p=>p.id));
  const again=await harness({store:h.store});
  assert.deepEqual(postIds(again),postIds(h));
  await again.elements.reset.click();assert.deepEqual(postIds(again),before);
  assert.deepEqual(research(again).settings,research(again).initialSettings);
});
test('new random order changes seed and leaves the configured dataset untouched',async()=>{
  const h=await harness({crypto:fixedCrypto(9)}), before=JSON.stringify(h.data), seed=research(h).feedcode;
  await h.elements.newSeed.click();assert.notEqual(research(h).feedcode,seed);assert.equal(JSON.stringify(h.data),before);
  const again=await harness({store:h.store,url:'https://example.invalid/?seed='+research(h).feedcode});
  await again.elements.reset.click();assert.equal(research(again).feedcode,seed);
  await h.elements.reset.click();assert.equal(research(h).feedcode,seed);
});
test('configured groups remain automatic, persistent and independent of answers or seed',async()=>{
  const h=await harness({configure:groupConfig,crypto:fixedCrypto(1)});
  assert.equal(research(h).respondent_group.id,'B');assert.equal(postIds(h).length,3);
  const again=await harness({configure:groupConfig,crypto:fixedCrypto(0),store:h.store,url:'https://example.invalid/?seed=other'});
  assert.equal(research(again).respondent_group.id,'B');
  const removed=await harness({store:h.store,configure:data=>{groupConfig(data);data.respondent_groups.pop();},crypto:fixedCrypto(0)});
  assert.equal(research(removed).respondent_group.id,'A');
  const none=await harness({store:h.store});assert.equal(research(none).respondent_group,null);
  assert.equal(none.elements.groupBadge.textContent,'Standaardgroep');
});
test('group draw uses rejection sampling and configured legacy groups still load',async()=>{
  const h=await harness(), pick=h.context.window.FeedLabUI.chooseRandomGroup;
  const groups=['A','B','C'].map(id=>({id}));
  const draws=[4294967295,2];assert.equal(pick(groups,()=>draws.shift()),'C');assert.equal(draws.length,0);
  for(let n=0;n<6;n++)assert.equal(pick(groups,()=>n),groups[n%3].id);
  const legacy=await harness({crypto:fixedCrypto(0),configure:data=>{groupConfig(data);data.classroom={cohorts:data.respondent_groups};delete data.respondent_groups;data.source_format='feed-lab-v2';}});
  assert.equal(research(legacy).respondent_group.id,'A');
});
test('explicit configured group preview does not overwrite assigned group',async()=>{
  const h=await harness({configure:groupConfig,crypto:fixedCrypto(0)});
  const preview=await harness({configure:groupConfig,store:h.store,url:'https://example.invalid/?seed=ui-test&group=B'});
  assert.equal(research(preview).respondent_group.id,'A');assert.equal(research(preview).active_group,'B');assert.equal(research(preview).local_preview,true);
  const again=await harness({configure:groupConfig,store:h.store});
  assert.equal(research(again).active_group,'A');assert.equal(research(again).local_preview,false);
});
test('JSON theme is applied with contrast and rejects invalid CSS',async()=>{
  const h=await harness({configure:data=>{data.theme={background:'#123456',card:'#eeeeee',text:'#111111',accent:'#ffff00'};}});
  assert.equal(h.css['--background'],'#123456');assert.equal(h.css['--accent'],'#ffff00');assert.equal(h.css['--accent-ink'],'#000000');
  const defaults=await harness();assert.equal(defaults.css['--accent-hover'],'#3B5999');assert.equal(defaults.css['--accent-hover-ink'],'#FFFFFF');
  const bad=await harness({configure:data=>{data.theme={text:'url(javascript:alert(1))'};}});
  assert.equal(bad.elements.workspace.hidden,true);assert.equal(bad.elements.error.hidden,false);
});
test('legacy local content, groups, colors and initial snapshots cannot replace admin JSON',async()=>{
  const configure=data=>{groupConfig(data);data.theme={background:'#123456'};};
  const h=await harness({configure,crypto:fixedCrypto(0)}), ui=h.context.window.FeedLabUI;
  const copy=plain(h.data);copy.title='LOKALE TITEL';copy.theme={background:'#abcdef'};copy.posts[0].body='LOKALE INHOUD';copy.respondent_groups[0].label='LOKALE GROEP';
  const previewKey='feedlab-v1:preview:'+ui.hash(h.data.unique_id)+':'+research(h).dataset;
  h.store.set(previewKey,JSON.stringify(copy));
  const stateKey=[...h.store.keys()].find(k=>k.includes(':state:')), state=JSON.parse(h.store.get(stateKey));
  state.initialData=copy;state.preview=copy;state.initialSettings.postLimit=1;state.viewingInitial=true;
  h.store.set(stateKey,JSON.stringify(state));
  const again=await harness({store:h.store,configure,crypto:fixedCrypto(0)});
  assert.equal(again.elements.title.textContent,h.data.title);
  assert.equal(again.css['--background'],'#123456');assert.equal(again.elements.groupBadge.textContent,'Groep: Groep A');
  assert.equal(research(again).initialSettings.postLimit,2);
  assert.ok(!walk(again.elements.feed,e=>e.textContent==='LOKALE INHOUD'));
  await again.elements.reset.click();assert.equal(postIds(again).length,2);
  const saved=JSON.parse(again.store.get(stateKey));assert.equal(saved.preview,undefined);assert.equal(saved.initialData,undefined);
});
test('updated admin JSON takes effect and algorithm-hidden config does not restore old rule edits',async()=>{
  const h=await harness({configure:data=>{data.showAlgorithmButton=false;}});
  const stateKey=[...h.store.keys()].find(k=>k.includes(':state:')), state=JSON.parse(h.store.get(stateKey));state.settings.postLimit=1;h.store.set(stateKey,JSON.stringify(state));
  const again=await harness({store:h.store,configure:data=>{data.showAlgorithmButton=false;}});
  assert.equal(again.elements.settingsToggle.hidden,true);assert.equal(postIds(again).length,10);
  await again.elements.settingsToggle.click();assert.equal(again.elements.settings.hidden,true);
  const changed=await harness({store:h.store,configure:data=>{data.initial_settings={postLimit:3};data.theme={background:'#654321'};}});
  assert.equal(postIds(changed).length,3);assert.equal(changed.css['--background'],'#654321');
});
test('voluntary answers stay independent of ranking and survive reload',async()=>{
  const h=await harness(), before=postIds(h);
  const question=walk(h.elements.questions,e=>e.id?.startsWith('answer-'));assert.equal(question.value,'');question.value='4';await question.dispatch('input');
  assert.deepEqual(postIds(h),before);
  const again=await harness({store:h.store});assert.equal(walk(again.elements.questions,e=>e.id?.startsWith('answer-')).value,'4');
  await again.elements.clearAnswers.click();assert.equal(walk(again.elements.questions,e=>e.id?.startsWith('answer-')).value,'');
  const hidden=await harness({configure:data=>{data.showQuestions=false;}});assert.equal(hidden.elements.questionPanel.hidden,true);
});
test('research export retains selection and actual expanded reaction IDs without becoming tool configuration',async()=>{
  const h=await harness();assert.deepEqual(research(h).visibleCommentIds,[]);
  const article=h.elements.feed.children[0];await walk(article,e=>e.className==='quiet comments-toggle').click();
  assert.ok(research(h).visibleCommentIds.length>0);
  await h.elements.exportResearch.click();
  const exported=JSON.parse(await h.downloads.at(-1).text());
  assert.deepEqual(exported.visibleIds,postIds(h));assert.deepEqual(exported.visibleCommentIds,research(h).visibleCommentIds);
  for(const key of ['posts','comments','theme','respondent_groups'])assert.equal(exported[key],undefined);
});
test('text is rendered safely and real nested reactions remain attached to their original post',async()=>{
  const h=await harness({configure:data=>{data.initial_settings={postLimit:0,commentLimit:0,perTopic:0};}});
  for(const url of ['javascript:alert(1)','data:image/svg+xml,bad','file:///etc/passwd','https://user:pass@example.com'])assert.equal(h.context.window.FeedLabUI.safeImageUrl(url),null);
  const article=h.elements.feed.children.find(e=>e.dataset.postId===h.data.posts[0].id);
  assert.ok(walk(article,e=>e.textContent==='<img src=x onerror=alert(1)>'));
  await walk(article,e=>e.className==='quiet comments-toggle').click();
  const parent=walk(article,e=>e.dataset.commentId===h.data.comments[0].id);assert.ok(walk(parent,e=>e.dataset.commentId==='fixture-child'));
});
test('long posts expand and broken images fall back to the placeholder',async()=>{
  const body='Een uitgebreide post met voldoende woorden. '.repeat(12);
  const h=await harness({configure:data=>{data.initial_settings={postLimit:0};data.posts[0].body=body;}});
  const article=h.elements.feed.children.find(e=>e.dataset.postId===h.data.posts[0].id), button=walk(article,e=>e.className==='post-more');
  assert.ok(button);await button.click();assert.equal(button.hidden,true);assert.ok(walk(article,e=>e.textContent===body));
  for(const post of h.elements.feed.children){const image=walk(post,e=>e.className==='post-image');assert.ok(image);await image.dispatch('error');assert.equal(image.src,'./placeholder.svg');await image.dispatch('error');assert.equal(image.src,'./placeholder.svg');}
});
test('load or storage failures report a visible error',async()=>{
  const failed=await harness({fetchError:true});assert.equal(failed.elements.workspace.hidden,true);assert.equal(failed.elements.error.hidden,false);
  const empty=await harness({configure:data=>{data.topics=[];data.posts=[];data.comments=[];data.questions=[];}});
  assert.equal(empty.elements.workspace.hidden,true);assert.match(empty.elements.errorText.textContent,/minimaal één onderwerp/);
  const blocked=await harness({storageError:true});assert.equal(blocked.elements.workspace.hidden,false);assert.match(blocked.elements.notice.textContent,/bewaren/);
});
