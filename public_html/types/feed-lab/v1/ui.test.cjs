/* Lightweight DOM integration harness; real-browser visual checks stay separate. */
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
async function harness(options={}) {
 if(options.minified===undefined) options.minified=process.env.FEEDLAB_MINIFIED==='1';
 const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8'), elements={};for(const m of html.matchAll(/id="([^"]+)"/g)) elements[m[1]]=new Element('div');elements.settings.hidden=true;
 const store=options.store || new Map(); const data=JSON.parse(fs.readFileSync(path.join(__dirname,'example.json'),'utf8'));
 if(!options.groups) delete data.respondent_groups;
 if(options.configure) options.configure(data);
 const p=data.posts[0];p.image={url:'https://example.invalid/image.jpg',alt:'Een fictieve foto'};p.body='<img src=x onerror=alert(1)>';const c=data.comments.find(c=>c.post_id===p.id);const reply={...c,id:'fixture-child',parent_id:c.id,body:'Echte kindreactie'};data.comments.push(reply);p.comment_ids.push(reply.id);
 let url=options.url || 'https://example.invalid/tool/?seed=ui-test'; const css={}; const context={console,URL,Uint32Array,Blob,FileReader:class{readAsDataURL(file){if(file.readError){this.onerror();return;}this.result=file.dataURL;this.onload();}},crypto:options.crypto || require('node:crypto').webcrypto,setTimeout,window:{FeedLabEngine:E},location:{get href(){return url;}},history:{replaceState(a,b,u){url=String(u);}},localStorage:{getItem(k){if(options.storageError)throw Error('blocked');return store.get(k)||null;},setItem(k,v){if(options.storageError)throw Error('blocked');store.set(k,v);}},document:{documentElement:{style:{setProperty(k,v){css[k]=v;}}},getElementById:id=>elements[id] || walk({children:Object.values(elements)},el=>el.id===id),createElement:tag=>new Element(tag)},fetch:async()=>{if(options.fetchError)throw Error('offline');return{ok:true,json:async()=>data};}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,options.minified?'app.min.js':'app.js'),'utf8'),context);await new Promise(r=>setImmediate(r));return{elements,context,data,store,css};
}
test('loads preserved data, hidden settings, minified runtime assets',async()=>{const h=await harness();assert.equal(h.elements.workspace.hidden,false);assert.equal(h.elements.settings.hidden,true);assert.equal(h.elements.feed.children.length,10);const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');for(const asset of ['engine.min.js','app.min.js','style.min.css'])assert.ok(html.includes(asset));await h.elements.settingsToggle.click();assert.equal(h.elements.settings.hidden,false);assert.equal(h.elements.settingsToggle.attributes['aria-expanded'],'true');});
test('safe URL allowlist and text-only rendering, actual nested child context',async()=>{const h=await harness();for(const u of ['javascript:alert(1)','data:image/svg+xml,bad','file:///etc/passwd','https://u:p@example.com'])assert.equal(h.context.window.FeedLabUI.safeImageUrl(u),null);assert.equal(h.context.window.FeedLabUI.safeImageUrl('https://example.com/a'),'https://example.com/a');const settings=JSON.parse([...h.store.values()][0]);settings.settings.postLimit=0;settings.settings.perTopic=0;settings.settings.commentLimit=0;h.store.set([...h.store.keys()][0],JSON.stringify(settings));const again=await harness({store:h.store});const article=again.elements.feed.children.find(el=>el.dataset.postId===again.data.posts[0].id);assert.ok(walk(article,el=>el.textContent==='<img src=x onerror=alert(1)>'));assert.equal(walk(article,el=>el.tagName==='img' && el.className==='post-image').alt,'Een fictieve foto');await walk(article,el=>el.tagName==='button').click();const parent=walk(article,el=>el.dataset.commentId===again.data.comments[0].id);assert.ok(walk(parent,el=>el.dataset.commentId==='fixture-child'));});
test('questions have empty defaults; private answer changes preserve ranking',async()=>{const h=await harness();const before=h.elements.feed.children.map(p=>p.dataset.postId);const question=walk(h.elements.questions,el=>el.id?.startsWith('answer-'));assert.equal(question.value,'');question.value='7';await question.dispatch('input');assert.deepEqual(h.elements.feed.children.map(p=>p.dataset.postId),before);assert.ok([...h.store.values()][0].includes('before:'));await h.elements.clearAnswers.click();assert.deepEqual(JSON.parse([...h.store.values()][0]).answers,{});});
test('load errors never show fallback data; storage failure is visible',async()=>{const h=await harness({fetchError:true});assert.equal(h.elements.error.hidden,false);assert.equal(h.elements.workspace.hidden,true);const blocked=await harness({storageError:true});assert.equal(blocked.elements.notice.hidden,false);assert.match(blocked.elements.notice.textContent,/bewaren/);assert.equal(blocked.elements.workspace.hidden,false);});
test('invalid imported config rejected without replacing visible feed',async()=>{const h=await harness();h.elements.importData.files=[{text:async()=>'{"invalid":true}'}];await h.elements.importData.dispatch('change');assert.match(h.elements.notice.textContent,/Import geweigerd/);assert.equal(h.elements.feed.children.length,10);});
test('local author forms create validated posts and nested replies, preserving source fields',async()=>{const h=await harness();const find=id=>walk(h.elements.authorForms,el=>el.id===id);const postForm=h.elements.authorForms.children[0].children.find(el=>el.tagName==='form');find('author-postAuthor').value='Fictieve tester';find('author-headline').value='Lokale kop';find('author-postBody').value='Lokale tekst';await postForm.dispatch('submit');assert.match(h.elements.notice.textContent,/Lokale preview bijgewerkt/);let saved=JSON.parse([...h.store.values()][0]);assert.equal(saved.preview.posts.length,h.data.posts.length+1);assert.deepEqual(saved.preview.questions,h.data.questions);const commentForm=h.elements.authorForms.children[1].children.find(el=>el.tagName==='form');find('author-commentAuthor').value='Fictieve reageerder';find('author-commentBody').value='Lokale kindreactie';find('author-parent').value=h.data.comments[0].id;await commentForm.dispatch('submit');saved=JSON.parse([...h.store.values()][0]);const added=saved.preview.comments.at(-1);assert.equal(added.parent_id,h.data.comments[0].id);assert.equal(added.body,'Lokale kindreactie');assert.ok(saved.preview.posts[0].comment_ids.includes(added.id));assert.doesNotThrow(()=>E.validate(saved.preview));});
test('restores original feed order after ranking change and reload',async()=>{const h=await harness();const before=h.elements.feed.children.map(p=>p.dataset.postId);const rank=walk(h.elements.ruleFields,el=>el.id==='rule-postRank');rank.value='newest';await rank.dispatch('input');const again=await harness({store:h.store});await again.elements.reset.click();assert.deepEqual(again.elements.feed.children.map(p=>p.dataset.postId),before);assert.equal(again.elements.questionTopic.value,again.data.topics[0].id);});
test('empty-topic import is refused transactionally before ranking state changes',async()=>{const h=await harness();const original=h.elements.feed.children.map(p=>p.dataset.postId);const empty={...h.data,topics:[],posts:[],comments:[],questions:[]};assert.doesNotThrow(()=>E.validate(empty));h.elements.importData.files=[{text:async()=>JSON.stringify(empty)}];await h.elements.importData.dispatch('change');assert.match(h.elements.notice.textContent,/minimaal één onderwerp/);const rank=walk(h.elements.ruleFields,el=>el.id==='rule-postRank');rank.value='weighted';await rank.dispatch('input');assert.deepEqual(h.elements.feed.children.map(p=>p.dataset.postId),original);await h.elements.reset.click();assert.deepEqual(h.elements.feed.children.map(p=>p.dataset.postId),original);});
test('begin snapshot restores original content while retaining local additions in preview',async()=>{const h=await harness();const small=structuredClone(h.data);small.posts=small.posts.slice(0,1);small.comments=small.comments.filter(c=>c.post_id===small.posts[0].id);h.elements.importData.files=[{text:async()=>JSON.stringify(small)}];await h.elements.importData.dispatch('change');assert.equal(h.elements.feed.children.length,1);const find=id=>walk(h.elements.authorForms,el=>el.id===id);const f=h.elements.authorForms.children[0].children.find(el=>el.tagName==='form');find('author-postAuthor').value='Fictieve auteur';find('author-headline').value='Lokaal toegevoegd';find('author-postBody').value='Bewaar deze aanvulling';await f.dispatch('submit');assert.equal(h.elements.feed.children.length,2);await h.elements.reset.click();assert.equal(h.elements.feed.children.length,1);assert.equal(h.elements.feed.children[0].dataset.postId,small.posts[0].id);const saved=JSON.parse([...h.store.values()].filter(v=>JSON.parse(v).settings).at(-1));assert.equal(saved.preview.posts.length,2);assert.equal(saved.initialData.posts.length,1);const rank=walk(h.elements.ruleFields,el=>el.id==='rule-postRank');rank.value='newest';await rank.dispatch('input');assert.equal(h.elements.feed.children.length,2);});

test('assignment 3 file import reproduces exported settings and order over a different open URL seed',async()=>{
 for(const minified of [false,true]){
  const author=await harness({minified,url:'https://example.invalid/tool/?seed=export-author'});
  const rank=walk(author.elements.ruleFields,el=>el.id==='rule-postRank');rank.value='random';await rank.dispatch('input');
  const config=author.context.window.FeedLabUI.toolConfig();assert.equal(config.classroom,undefined);
  const exported=JSON.parse(JSON.stringify(author.context.window.FeedLabUI.research()));
  const recipient=await harness({minified,url:'https://example.invalid/tool/?seed=recipient-existing'});
  assert.equal(recipient.context.window.FeedLabUI.research().feedcode,'recipient-existing');
  recipient.elements.importData.files=[{text:async()=>JSON.stringify(config)}];await recipient.elements.importData.dispatch('change');
  const imported=JSON.parse(JSON.stringify(recipient.context.window.FeedLabUI.research()));
  assert.equal(imported.feedcode,exported.feedcode);assert.deepEqual(imported.settings,exported.settings);assert.deepEqual(imported.visibleIds,exported.visibleIds);assert.deepEqual(imported.initialIds,exported.visibleIds);
  assert.equal(new URL(recipient.context.location.href).searchParams.get('seed'),'export-author');
  const pageload=await harness({minified,url:'https://example.invalid/tool/?seed=explicit-url',configure:data=>{data.initial_settings=JSON.parse(JSON.stringify(config.initial_settings));}});
  assert.equal(pageload.context.window.FeedLabUI.research().feedcode,'explicit-url');
 }
});

function groupConfig(data){data.respondent_groups=[{id:'A',label:'Groep A',settings:{commentStanceBias:1,weights:{stance_bias:1}}},{id:'B',label:'Groep B',settings:{commentStanceBias:-1,weights:{stance_bias:-1}}}];data.showQuestions=false;}
function state(store){return JSON.parse([...store.values()].find(v=>JSON.parse(v).settings));}
function assigned(h){return h.context.window.FeedLabUI.research().respondent_group?.id;}
function fixedCrypto(n){return {getRandomValues(values){for(let i=0;i<values.length;i++)values[i]=n;return values;}};}
test('automatic assignment has equal random intervals for 1, 2 and 3 groups with rejection sampling',async()=>{
 const h=await harness(),pick=h.context.window.FeedLabUI.chooseRandomGroup;
 assert.equal(pick([],()=>{throw Error('not used');}),null);
 assert.equal(pick([{id:'only'}],()=>{throw Error('not used');}),'only');
 const groups=['A','B','C'].map(id=>({id}));
 for(let i=0;i<12;i++){assert.equal(pick(groups,()=>i),groups[i%3].id);assert.equal(pick(groups.slice(0,2),()=>i),groups[i%2].id);}
 const draws=[4294967295,2];assert.equal(pick(groups,()=>draws.shift()),'C');
});
test('automatic groups render directly with small badge and preserve assignment across seeds/config updates',async()=>{
 const a=await harness({configure:groupConfig,crypto:fixedCrypto(0)});assert.equal(a.elements.workspace.hidden,false);assert.equal(assigned(a),'A');assert.equal(a.elements.questionPanel.hidden,true);assert.equal(a.elements.settings.hidden,true);assert.equal(a.elements.groupBadge.textContent,'Groep: Groep A');
 const changed=await harness({store:a.store,configure:d=>{groupConfig(d);d.title='Gewijzigde configuratie';},crypto:fixedCrypto(1),url:'https://example.invalid/?seed=other'});assert.equal(assigned(changed),'A');
 const b=await harness({configure:groupConfig,crypto:fixedCrypto(1)});assert.equal(assigned(b),'B');
 const one=await harness({configure:d=>{groupConfig(d);d.respondent_groups=d.respondent_groups.slice(0,1);},crypto:fixedCrypto(1)});assert.equal(assigned(one),'A');
 const three=await harness({configure:d=>{groupConfig(d);d.respondent_groups.push({id:'C',label:'Groep C',settings:{}});},crypto:fixedCrypto(2)});assert.equal(assigned(three),'C');
 const removed=await harness({store:a.store,configure:d=>{groupConfig(d);d.respondent_groups=d.respondent_groups.slice(1);},crypto:fixedCrypto(0)});assert.equal(assigned(removed),'B');
});
test('URL group is explicit local preview and never overwrites automatic assignment',async()=>{
 const a=await harness({configure:groupConfig,crypto:fixedCrypto(0)});
 const preview=await harness({store:a.store,configure:groupConfig,crypto:fixedCrypto(1),url:'https://example.invalid/?seed=ui-test&group=B'});
 const r=preview.context.window.FeedLabUI.research();assert.equal(r.respondent_group.id,'A');assert.equal(r.active_group,'B');assert.equal(r.local_preview,true);assert.equal(r.settings.commentStanceBias,-1);
 const again=await harness({store:a.store,configure:groupConfig});assert.equal(assigned(again),'A');assert.equal(again.context.window.FeedLabUI.research().active_group,'A');
});
test('author group management adds, renames, previews, saves and removes without mutating other group algorithms',async()=>{
 const h=await harness({configure:groupConfig,crypto:fixedCrypto(0)});const sourceB=JSON.parse(JSON.stringify(h.context.window.FeedLabUI.toolConfig().respondent_groups.find(g=>g.id==='B').settings));
 h.elements.newGroupLabel.value='Derde groep';await h.elements.addGroup.click();let config=h.context.window.FeedLabUI.toolConfig();assert.equal(config.respondent_groups.length,3);const added=config.respondent_groups[2];
 h.elements.groupSelect.value=added.id;await h.elements.groupSelect.dispatch('change');h.elements.groupLabel.value='Aangepaste groep';await h.elements.renameGroup.click();
 const rule=walk(h.elements.ruleFields,e=>e.id==='rule-commentStanceBias');rule.value='.35';await rule.dispatch('input');
 h.elements.groupSelect.value=added.id;await h.elements.saveGroupSettings.click();config=h.context.window.FeedLabUI.toolConfig();assert.equal(config.respondent_groups.find(g=>g.id===added.id).settings.commentStanceBias,.35);assert.deepEqual(JSON.parse(JSON.stringify(config.respondent_groups.find(g=>g.id==='B').settings)),sourceB);
 h.elements.groupSelect.value='B';await h.elements.previewGroup.click();assert.equal(assigned(h),'A');assert.equal(h.context.window.FeedLabUI.research().settings.commentStanceBias,-1);assert.equal(h.context.window.FeedLabUI.research().local_preview,true);
 await h.elements.returnAssigned.click();assert.equal(h.context.window.FeedLabUI.research().active_group,'A');
 h.elements.groupSelect.value='A';await h.elements.removeGroup.click();assert.notEqual(assigned(h),'A');assert.ok(h.context.window.FeedLabUI.toolConfig().respondent_groups.every(g=>g.id!=='A'));
});
test('group export/import preserves assignment, seed and settings and rejects invalid group imports transactionally',async()=>{
 const author=await harness({configure:groupConfig,crypto:fixedCrypto(1),url:'https://example.invalid/?seed=exported'});const config=JSON.parse(JSON.stringify(author.context.window.FeedLabUI.toolConfig()));
 const recipient=await harness({configure:groupConfig,crypto:fixedCrypto(0),url:'https://example.invalid/?seed=recipient'});recipient.elements.importData.files=[{text:async()=>JSON.stringify(config)}];await recipient.elements.importData.dispatch('change');
 assert.equal(assigned(recipient),'B');assert.equal(recipient.context.window.FeedLabUI.research().feedcode,'exported');assert.deepEqual(JSON.parse(JSON.stringify(recipient.context.window.FeedLabUI.research().settings)),JSON.parse(JSON.stringify(author.context.window.FeedLabUI.research().settings)));
 const before=recipient.elements.feed.children.map(p=>p.dataset.postId);config.respondent_groups.push(config.respondent_groups[0]);recipient.elements.importData.files=[{text:async()=>JSON.stringify(config)}];await recipient.elements.importData.dispatch('change');assert.match(recipient.elements.notice.textContent,/Import geweigerd/);assert.deepEqual(recipient.elements.feed.children.map(p=>p.dataset.postId),before);
});
test('theme color inputs, local persistence, export/import, contrast and reset validate exact hex values',async()=>{
 for(const minified of [false,true]){
  const h=await harness({minified});h.elements['theme-background'].value='#123456';await h.elements['theme-background'].dispatch('input');h.elements['theme-accent'].value='#ffff00';await h.elements['theme-accent'].dispatch('input');assert.equal(h.css['--background'],'#123456');assert.equal(h.css['--accent-ink'],'#000000');
  h.elements['theme-accent'].value='red;display:none';await h.elements['theme-accent'].dispatch('input');assert.equal(h.css['--accent'],'#ffff00');
  const again=await harness({store:h.store,minified});assert.equal(again.css['--background'],'#123456');
  const config=JSON.parse(JSON.stringify(h.context.window.FeedLabUI.toolConfig()));const recipient=await harness({minified});recipient.elements.importData.files=[{text:async()=>JSON.stringify(config)}];await recipient.elements.importData.dispatch('change');assert.equal(recipient.css['--background'],'#123456');
  config.theme.text='url(javascript:alert(1))';recipient.elements.importData.files=[{text:async()=>JSON.stringify(config)}];await recipient.elements.importData.dispatch('change');assert.match(recipient.elements.notice.textContent,/Import geweigerd/);assert.equal(recipient.css['--background'],'#123456');
  await recipient.elements.resetTheme.click();assert.equal(recipient.css['--background'],E.themeDefaults.background);assert.equal(recipient.css['--accent-ink'],'#000000');assert.equal(recipient.css['--accent-hover'],'#3B5999');assert.equal(recipient.css['--accent-hover-ink'],'#FFFFFF');
 }
});
test('minified runtime automatically assigns and keeps group preview state out of other algorithms',async()=>{const h=await harness({minified:true,configure:groupConfig,crypto:fixedCrypto(1)});assert.equal(assigned(h),'B');assert.equal(h.elements.workspace.hidden,false);h.elements.groupSelect.value='A';await h.elements.previewGroup.click();assert.equal(assigned(h),'B');assert.equal(h.context.window.FeedLabUI.research().active_group,'A');assert.equal(h.context.window.FeedLabUI.research().local_preview,true);});

test('first authored group receives everyone and deleting the last group falls back to defaults',async()=>{
 const h=await harness();h.elements.newGroupLabel.value='Iedereen';await h.elements.addGroup.click();const id=assigned(h);assert.ok(id);assert.equal(h.context.window.FeedLabUI.research().active_group,id);assert.equal(h.context.window.FeedLabUI.research().local_preview,false);
 h.elements.groupSelect.value=id;await h.elements.removeGroup.click();assert.equal(assigned(h),undefined);assert.equal(h.context.window.FeedLabUI.research().active_group,null);assert.equal(h.elements.groupBadge.textContent,'Standaardgroep');
});
test('preview answers and edited rules remain isolated and assigned state restores on return',async()=>{
 const h=await harness({configure:d=>{groupConfig(d);d.showQuestions=true;},crypto:fixedCrypto(0)});
 const question=walk(h.elements.questions,e=>e.id?.startsWith('answer-'));question.value='4';await question.dispatch('input');const rule=walk(h.elements.ruleFields,e=>e.id==='rule-postLimit');rule.value='2';await rule.dispatch('input');
 h.elements.groupSelect.value='B';await h.elements.previewGroup.click();const other=walk(h.elements.questions,e=>e.id?.startsWith('answer-'));assert.equal(other.value,'');other.value='7';await other.dispatch('input');
 await h.elements.returnAssigned.click();assert.equal(walk(h.elements.questions,e=>e.id?.startsWith('answer-')).value,'4');assert.equal(h.context.window.FeedLabUI.research().settings.postLimit,2);
});

const tinyPNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l1sAAAAASUVORK5CYII=';
function imageEditor(h,id){return walk(h.elements.authorForms,el=>el.id===id);}
test('export preserves effective algorithm of untouched groups when active group changes shared defaults',async()=>{
 const h=await harness({configure:groupConfig,crypto:fixedCrypto(0)});
 const before=JSON.parse(JSON.stringify(E.defaults(h.data,'same','B')));const originalGroup=JSON.stringify(h.data.respondent_groups[1]);
 for(const [name,value] of [['likeWeight','.9'],['angryWeight','.1'],['postLimit','3']]){const i=walk(h.elements.ruleFields,e=>e.id==='rule-'+name);i.value=value;await i.dispatch('input');}
 const exported=h.context.window.FeedLabUI.toolConfig();assert.deepEqual(JSON.parse(JSON.stringify(E.defaults(exported,'same','B'))),before);assert.equal(exported.initial_settings.likeWeight,.9);assert.equal(E.defaults(exported,'same','A').likeWeight,.9);assert.equal(JSON.stringify(h.data.respondent_groups[1]),originalGroup);
});
test('every visible post has an image, missing or broken URLs use local placeholder without retry loops',async()=>{
 const h=await harness();assert.ok(fs.existsSync(path.join(__dirname,'placeholder.svg')));
 for(const p of h.elements.feed.children){const img=walk(p,e=>e.tagName==='img' && e.className==='post-image');assert.ok(img);const source=h.data.posts.find(x=>x.id===p.dataset.postId);if(!source.image){assert.equal(img.src,'./placeholder.svg');assert.equal(img.alt,'Nog geen afbeelding');assert.equal(source.image,undefined);}else{await img.dispatch('error');assert.equal(img.src,'./placeholder.svg');assert.equal(img.alt,'Nog geen afbeelding');await img.dispatch('error');assert.equal(img.src,'./placeholder.svg');}}
 assert.ok(h.context.window.FeedLabUI.toolConfig().posts.some(p=>!p.image));
});
test('FileReader uploads support allowed bitmap types and reject invalid MIME, data payload and size',async()=>{
 const h=await harness(),read=h.context.window.FeedLabUI.readImage;
 for(const type of ['image/png','image/jpeg','image/webp','image/gif'])assert.equal(await read({type,size:4,dataURL:'data:'+type+';base64,AQIDBA=='}),'data:'+type+';base64,AQIDBA==');
 for(const file of [{type:'image/svg+xml',size:4,dataURL:'data:image/svg+xml;base64,AQIDBA=='},{type:'text/html',size:4},{type:'image/png',size:2097153},{type:'image/png',size:0},{type:'image/png',size:4,dataURL:'data:image/png;base64,!!'},{type:'image/png',size:4,dataURL:'data:image/gif;base64,AQIDBA=='},{type:'image/png',size:4,readError:true}])await assert.rejects(()=>read(file));
});
test('existing post upload, alt update, URL replacement, local restore, export/import and image removal',async()=>{
 const h=await harness(),postId=h.data.posts[0].id;imageEditor(h,'image-post').value=postId;await imageEditor(h,'image-post').dispatch('change');
 imageEditor(h,'image-upload').files=[{type:'image/png',size:68,dataURL:tinyPNG}];imageEditor(h,'image-alt').value='Kleine testafbeelding';await imageEditor(h,'imageForm').dispatch('submit');
 let config=h.context.window.FeedLabUI.toolConfig();assert.equal(config.posts.find(p=>p.id===postId).image.url,tinyPNG);assert.equal(config.posts.find(p=>p.id===postId).image.alt,'Kleine testafbeelding');assert.doesNotThrow(()=>E.validate(config));
 const again=await harness({store:h.store});assert.equal(again.context.window.FeedLabUI.toolConfig().posts.find(p=>p.id===postId).image.url,tinyPNG);
 const recipient=await harness();recipient.elements.importData.files=[{text:async()=>JSON.stringify(config)}];await recipient.elements.importData.dispatch('change');assert.equal(recipient.context.window.FeedLabUI.toolConfig().posts.find(p=>p.id===postId).image.url,tinyPNG);
 imageEditor(recipient,'image-post').value=postId;await imageEditor(recipient,'image-post').dispatch('change');imageEditor(recipient,'image-url').value='https://example.invalid/replacement.jpg';imageEditor(recipient,'image-alt').value='Vervangende foto';await imageEditor(recipient,'imageForm').dispatch('submit');assert.equal(recipient.context.window.FeedLabUI.toolConfig().posts.find(p=>p.id===postId).image.url,'https://example.invalid/replacement.jpg');
 await imageEditor(recipient,'image-clear').click();assert.equal(recipient.context.window.FeedLabUI.toolConfig().posts.find(p=>p.id===postId).image,undefined);
});
test('new post accepts bitmap upload with required alt and invalid existing-image edits retain state',async()=>{
 const h=await harness();const find=id=>walk(h.elements.authorForms,e=>e.id===id);find('author-postAuthor').value='Auteur';find('author-headline').value='Nieuwe afbeelding';find('author-postBody').value='Beschrijving';find('author-imageUpload').files=[{type:'image/png',size:68,dataURL:tinyPNG}];
 const form=h.elements.authorForms.children[0].children.find(e=>e.tagName==='form');const count=h.data.posts.length;await form.dispatch('submit');assert.equal(h.context.window.FeedLabUI.toolConfig().posts.length,count);assert.match(h.elements.notice.textContent,/beschrijving/);
 find('author-alt').value='Testbeeld';await form.dispatch('submit');let config=h.context.window.FeedLabUI.toolConfig();assert.equal(config.posts.length,count+1);assert.equal(config.posts.at(-1).image.url,tinyPNG);
 const id=config.posts[0].id;imageEditor(h,'image-post').value=id;await imageEditor(h,'image-post').dispatch('change');imageEditor(h,'image-upload').files=[{type:'image/svg+xml',size:20,dataURL:'data:image/svg+xml;base64,PHN2Zz4='}];await imageEditor(h,'imageForm').dispatch('submit');assert.deepEqual(JSON.parse(JSON.stringify(h.context.window.FeedLabUI.toolConfig().posts[0].image)),JSON.parse(JSON.stringify(config.posts[0].image)));
});
