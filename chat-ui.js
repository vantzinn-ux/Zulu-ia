'use strict';
const paths = {
  plus:'M12 5v14M5 12h14',close:'m6 6 12 12M6 18 18 6',search:'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  chat:'M21 11a8 8 0 0 1-8 8H7l-5 3 1-6a8 8 0 0 1-1-4 9 9 0 0 1 19-1Z',sidebar:'M8 3v18M3 3h18v18H3Z',
  edit:'m15 4 5 5M4 20l4-1L21 6a2 2 0 0 0-3-3L5 16Z',download:'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',upload:'M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5',
  up:'M12 19V5m-6 6 6-6 6 6',down:'M12 5v14m-6-6 6 6 6-6',stop:'M6 6h12v12H6Z',file:'M14 2H5v20h14V7l-5-5Zm0 0v6h5M8 12h8M8 16h5',
  code:'m8 7-5 5 5 5m8-10 5 5-5 5m-3-14-2 18',write:'m4 20 4-1L21 6l-3-3L5 16 4 20Zm11-14 3 3',image:'M3 3h18v18H3ZM3 17l5-5 4 4 3-3 6 6M9 7h.01',
  copy:'M9 9h12v12H9ZM5 15H3V3h12v2',check:'m5 12 4 4 10-11',trash:'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7',
  memory:'M9 4a3 3 0 0 0-5 3 4 4 0 0 0-1 7 4 4 0 0 0 6 6h3V5a3 3 0 0 0-3-1Zm6 0a3 3 0 0 1 5 3 4 4 0 0 1 1 7 4 4 0 0 1-6 6h-3M6 10h3m6 5h3',
  settings:'m9 3-1 3-3 1-2 4 2 3 1 3 4 3 3-1 3-1 3-4-1-3-1-3-4-2-4-1Zm6 9a3 3 0 1 1-6 0 3 3 0 0 1 6 0',spark:'m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z',lock:'M6 10h12v11H6ZM8 10V6a4 4 0 0 1 8 0v4'
};
function icon(name) { return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name] || paths.file}"/></svg>`; }
function paintIcons(root = document) { root.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon); }); }
function el(tag, className, text) { const n = document.createElement(tag); if (className) n.className = className; if (text !== undefined) n.textContent = text; return n; }
function action(label, name, handler, className = 'textBtn') { const b = el('button', className); b.type = 'button'; b.innerHTML = icon(name); b.append(document.createTextNode(label)); b.setAttribute('aria-label', label); b.onclick = handler; return b; }
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function sizeLabel(bytes) { return bytes > 1048576 ? (bytes / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(bytes / 1024)) + ' KB'; }
function safeFilename(name) {
  const segments = String(name || 'arquivo.txt').replace(/\\/g, '/').split('/').filter(s => s && s !== '.' && s !== '..').map(s => s.replace(/[<>:"|?*\x00-\x1f\x7f]/g, '_').slice(0, 100));
  return segments.join('/').slice(0, 200) || 'arquivo.txt';
}
function downloadBlob(blob, name) { const url = URL.createObjectURL(blob), a = el('a'); a.href = url; a.download = safeFilename(name).split('/').pop(); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000); }
function downloadText(text, name) { downloadBlob(new Blob([text], { type:'text/plain;charset=utf-8' }), name); }
async function copyText(text, button) {
  try {
    if (navigator.clipboard?.writeText && window.isSecureContext) await navigator.clipboard.writeText(text);
    else { const temp = el('textarea'); temp.value = text; temp.style.position = 'fixed'; temp.style.opacity = '0'; document.body.append(temp); temp.select(); const ok = document.execCommand('copy'); temp.remove(); if (!ok) throw new Error('copy'); }
    if (button) { const old = button.innerHTML; button.innerHTML = icon('check') + ' Copiado'; setTimeout(() => { if (button.isConnected) button.innerHTML = old; }, 1500); }
    else toast('Copiado.');
  } catch { toast('Não foi possível copiar. Selecione o texto e use Copiar.'); }
}
function zipFiles(files) {
  if (!window.fflate) return toast('Atualize a página para carregar os downloads.');
  const items = Object.create(null), names = new Set();
  for (const f of files) { let name = safeFilename(f.name), n = 2; const base = name; while (names.has(name)) name = `${n++}-${base}`; names.add(name); items[name] = fflate.strToU8(f.text); }
  fflate.zip(items, { level: 6 }, (error, data) => { if (error) toast('Não consegui criar o ZIP. Baixe os arquivos individualmente.'); else downloadBlob(new Blob([data], { type:'application/zip' }), 'arquivos.zip'); });
}
const extension = { javascript:'js',typescript:'ts',python:'py',markdown:'md',text:'txt',plaintext:'txt',bash:'sh',shell:'sh',powershell:'ps1',csharp:'cs',cpp:'cpp',html:'html',css:'css',lua:'lua',json:'json',sql:'sql',yaml:'yml',xml:'xml',java:'java',go:'go',rust:'rs',php:'php',jsx:'jsx',tsx:'tsx',bat:'bat',ahk:'ahk' };
function renderMarkdown(container, raw, controls, limited = false) {
  const codes = [];
  const renderer = new marked.Renderer();
  renderer.html = token => esc(token.text);
  renderer.image = token => `[Imagem: ${esc(token.text || 'referência externa')}]`;
  renderer.code = token => {
    const info = token.lang || '', lang = (info.split(/\s+/)[0] || 'text').toLowerCase();
    const match = info.match(/(?:^|\s)filename=(?:"([^"]+)"|'([^']+)'|([^\s]+))/);
    const name = match ? safeFilename(match[1] || match[2] || match[3]) : `codigo-${codes.length + 1}.${extension[lang] || 'txt'}`;
    const index = codes.push({ text: token.text + '\n', lang, name, named: !!match }) - 1;
    return `<div class="codeBlock${['text','plaintext','markdown','md'].includes(lang) ? ' textBlock' : ''}" data-code="${index}"><div class="codeHead"><span class="codeLabel">${esc(match ? name : lang)}</span><div class="codeActions"></div></div><pre><code>${esc(token.text)}</code></pre></div>`;
  };
  container.innerHTML = DOMPurify.sanitize(marked.parse(raw, { renderer, gfm:true, breaks:false }), { USE_PROFILES:{ html:true }, FORBID_TAGS:['img','iframe','form','input','button','style','script','video','audio','object','embed'], FORBID_ATTR:['style','srcset'] });
  container.querySelectorAll('a').forEach(a => { if (!/^https?:|^mailto:/i.test(a.getAttribute('href') || '')) a.removeAttribute('href'); a.target='_blank'; a.rel='noopener noreferrer'; });
  container.querySelectorAll('table').forEach(table => { const wrap = el('div','tableScroll'); table.replaceWith(wrap); wrap.append(table); });
  container.querySelectorAll('[data-code]').forEach(block => {
    const entry = codes[Number(block.dataset.code)]; if (!entry) return;
    const toolbar = block.querySelector('.codeActions');
    toolbar.append(action('Copiar','copy', e => copyText(entry.text, e.currentTarget)));
    if (!limited) toolbar.append(action('Baixar','download', () => downloadText(entry.text,entry.name)));
    const code = block.querySelector('code');
    if (window.hljs?.getLanguage(entry.lang) && entry.text.length < 70000) code.innerHTML = hljs.highlight(code.textContent, { language:entry.lang, ignoreIllegals:true }).value;
  });
  if (!controls) return;
  const named = codes.filter(c => c.named);
  if (named.length && !limited) {
    const cards = el('div','fileDownloads');
    for (const f of named) { const b = action('','file',()=>downloadText(f.text,f.name),'downloadCard'); const label=el('span','',f.name); label.append(el('small','',`${sizeLabel(new Blob([f.text]).size)} · Baixar arquivo`)); b.append(label); b.setAttribute('aria-label',`Baixar ${f.name}`); cards.append(b); }
    controls.append(cards);
  }
  const bar = el('div','messageActions');
  bar.append(action('Copiar resposta','copy',e=>copyText(raw,e.currentTarget)),action('Baixar texto','download',()=>downloadText(raw,'resposta.md')));
  if (codes.length > 1 && !limited) bar.append(action('Baixar tudo em ZIP','download',()=>zipFiles(named.length ? named : codes)));
  controls.append(bar);
  if (limited) {
    controls.append(el('div','messageNote','Resposta parcial: o limite desta geração foi atingido. Peça para continuar antes de usar os arquivos.'));
    controls.append(action('Continuar resposta','down',()=>{input.value='Continue exatamente de onde parou. Se um arquivo ficou incompleto, reenvie esse arquivo completo em um único bloco com filename.';send();}));
  }
}
function unpack(content) { try { const d=JSON.parse(content); if(d?._zulu===5 && typeof d.text==='string' && Array.isArray(d.attachments)) return d; } catch {} return {text:content,attachments:[]}; }
function downloadAttachment(a) {
  try { const binary = atob(a.data), bytes = new Uint8Array(binary.length); for (let i=0;i<binary.length;i++) bytes[i]=binary.charCodeAt(i); downloadBlob(new Blob([bytes],{type:a.mime || 'application/octet-stream'}),a.name); } catch {toast('Arquivo indisponível. Reenvie o anexo.');}
}
function addMessage(content, role) {
  const row=el('article',`msgRow ${role}`), bubble=el('div','bubble'); row.append(bubble); messages.append(row);
  const decoded = unpack(content);
  if (role === 'assistant') { const markdown = el('div','markdown'), controls=el('div'); bubble.append(markdown,controls); renderMarkdown(markdown,decoded.text,controls,!!decoded.limited); }
  else {
    if(decoded.text) bubble.append(el('div','',decoded.text));
    if(decoded.attachments.length) { const list=el('div','userAttachments');
      for(const a of decoded.attachments){const chip=el('div','attachment');
        if(a.kind==='image' || /^image\/(png|jpeg|webp)$/.test(a.mime)){const img=el('img');img.src=`data:${a.mime};base64,${a.data}`;img.alt=a.name;chip.append(img);}else{const ic=el('span');ic.innerHTML=icon('file');chip.append(ic);}
        const text=el('span','',a.name);text.append(el('small','',sizeLabel(a.size)));chip.append(text,action('','download',()=>downloadAttachment(a)));chip.lastChild.setAttribute('aria-label',`Baixar ${a.name}`);list.append(chip);
      } bubble.append(list);
    }
  }
  return row;
}
function welcome(){
  messages.replaceChildren();state.currentMessages=[];$('#chatHeading').textContent='Nova conversa';
  const box=el('div','welcome');
  box.innerHTML=`<div class="welcomeLabel">${icon('spark')} UM ESPAÇO PARA SUAS IDEIAS</div><h1>O que vamos<br><span>criar hoje?</span></h1><p>Uma ideia, um código ou um problema.<br>Traga o começo. A gente constrói o próximo passo.</p><div class="suggestions"></div><div class="welcomeFoot">${icon('file')} Você também pode arrastar um arquivo ou colar uma imagem.</div>`;
  const choices=[['code','Vamos programar','Crie, revise ou entenda seu código.','Quero ajuda para programar. '],['write','Encontre as palavras','Textos com o seu tom e a sua intenção.','Me ajude a escrever um texto sobre '],['image','Resolva com uma imagem','Envie um print e vamos entender juntos.','']];
  for(const [ic,title,subtitle,prompt] of choices){const b=el('button','suggestion');b.innerHTML=icon(ic);b.append(el('strong','',title),el('small','',subtitle));b.onclick=()=>{if(ic==='image')$('#fileInput').click();else{input.value=prompt;resize();input.focus();}};box.querySelector('.suggestions').append(b);}
  messages.append(box);$('#exportChatBtn').disabled=true;
}
function updateHeading(){const c=state.chats.find(c=>c.id===state.chatId);$('#chatHeading').textContent=c?.title==='Novo chat'?'Nova conversa':c?.title||'Nova conversa';}
function drawChats(){
  const box=$('#chatList');box.replaceChildren();const search=$('#chatSearch').value.trim().toLocaleLowerCase();
  const chats=state.chats.filter(c=>c.title.toLocaleLowerCase().includes(search));$('#chatCount').textContent=String(state.chats.length);
  if(!chats.length)box.append(el('div','empty',search?'Nenhuma conversa encontrada.':'Seu próximo projeto começa em uma nova conversa.'));
  for(const c of chats){const item=el('div','chatItem'+(c.id===state.chatId?' active':''));const open=action('','chat',()=>openChat(c.id).catch(e=>toast(e.message)),'chatOpen');open.append(el('span','chatTitle',c.title));open.setAttribute('aria-label',c.title);open.title=c.title;
    const del=action('','trash',async()=>{if(state.busy)return toast('Interrompa a resposta antes de excluir.');if(!confirm('Excluir esta conversa e seus anexos?'))return;try{await api(`/api/chats/${c.id}`,{method:'DELETE'});if(state.chatId===c.id){state.chatId=null;welcome();}await loadChats();}catch(e){toast(e.message);}},'chatDelete');del.setAttribute('aria-label',`Excluir ${c.title}`);item.append(open,del);box.append(item);
  }updateHeading();
}
async function loadChats(){const d=await api('/api/chats');state.chats=d.chats||[];drawChats();}
let chatLoad=0;
async function openChat(id){
  if(state.busy)return toast('Aguarde ou interrompa a resposta para mudar de conversa.');
  const request=++chatLoad,d=await api(`/api/chats/${id}`);if(request!==chatLoad||state.busy)return;
  state.chatId=id;clearAttachments();input.value='';resize();messages.replaceChildren();
  if(!d.messages.length)welcome();else{state.currentMessages=d.messages;for(const m of d.messages)addMessage(m.content,m.role);}
  addOlderButton(d.hasMore);drawChats();closeDrawer();scrollToEnd(true);$('#exportChatBtn').disabled=!d.messages.length;
}
async function createChat(){
  if(state.busy)return toast('Aguarde ou interrompa a resposta para criar uma conversa.');
  ++chatLoad;state.chatId=null;clearAttachments();input.value='';resize();welcome();drawChats();closeDrawer();input.focus();
}
function scrollToEnd(force=false){if(force||messages.scrollHeight-messages.scrollTop-messages.clientHeight<170)messages.scrollTop=messages.scrollHeight;}
messages.addEventListener('scroll',()=>$('#scrollBottom').classList.toggle('hidden',messages.scrollHeight-messages.scrollTop-messages.clientHeight<200),{passive:true});
$('#scrollBottom').onclick=()=>scrollToEnd(true);
$('#chatSearch').oninput=drawChats;
$('#newChatBtn').onclick=createChat;$('#newTopBtn').onclick=createChat;
function clearAttachments(){state.attachments=[];drawAttachments();}
function drawAttachments(){const tray=$('#attachmentTray');tray.replaceChildren();for(const [i,a] of state.attachments.entries()){const chip=el('div','attachment');if(/^image\/(png|jpeg|webp)$/.test(a.mime)){const img=el('img');img.src=`data:${a.mime};base64,${a.data}`;img.alt=a.name;chip.append(img);}else{const span=el('span');span.innerHTML=icon('file');chip.append(span);}const title=el('span','',a.name);title.append(el('small','',sizeLabel(a.size)));const remove=action('','close',()=>{if(state.busy)return;state.attachments.splice(i,1);drawAttachments();});remove.setAttribute('aria-label',`Remover ${a.name}`);chip.append(title,remove);tray.append(chip);} }
function readFile(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]);r.onerror=()=>reject(new Error(`Não consegui ler ${file.name}.`));r.readAsDataURL(file);});}
async function addFiles(files){
  if(state.busy||state.reading)return toast('Aguarde o envio atual terminar para adicionar arquivos.');
  state.reading=true;$('#attachBtn').disabled=true;
  try{for(const file of files){
    if(state.attachments.length>=6)throw new Error('Limite de 6 arquivos por mensagem.');
    if(!file.size)throw new Error(`${file.name} está vazio.`);
    if(file.size>5*1024*1024)throw new Error(`${file.name} ultrapassa 5 MB.`);
    if(state.attachments.reduce((n,a)=>n+a.size,0)+file.size>10*1024*1024)throw new Error('O total dos anexos ultrapassa 10 MB.');
    const data=await readFile(file);state.attachments.push({name:file.name,size:file.size,mime:file.type||'application/octet-stream',data});drawAttachments();
  }}catch(e){toast(e.message);}finally{state.reading=false;$('#attachBtn').disabled=state.busy;$('#fileInput').value='';}
}
$('#attachBtn').onclick=()=>$('#fileInput').click();$('#fileInput').onchange=e=>addFiles([...e.target.files]);
input.addEventListener('paste',e=>{const files=[...(e.clipboardData?.files||[])];if(files.length){e.preventDefault();addFiles(files);}});
let dragDepth=0;
const surface=$('#appView');
surface.addEventListener('dragenter',e=>{if(e.dataTransfer.types.includes('Files')){e.preventDefault();dragDepth++;$('#dropHint').classList.remove('hidden');}});
surface.addEventListener('dragover',e=>{if(e.dataTransfer.types.includes('Files'))e.preventDefault();});
surface.addEventListener('dragleave',e=>{if(--dragDepth<=0){dragDepth=0;$('#dropHint').classList.add('hidden');}});
surface.addEventListener('drop',e=>{e.preventDefault();dragDepth=0;$('#dropHint').classList.add('hidden');addFiles([...e.dataTransfer.files]);});
function resize(){input.style.height='auto';input.style.height=Math.min(input.scrollHeight,180)+'px';$('#charCount').textContent=input.value.length>5000?`${input.value.length.toLocaleString('pt-BR')} / 60.000`:'';}
input.oninput=resize;
input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing&&!matchMedia('(pointer: coarse)').matches){e.preventDefault();send();}});
$('#composer').onsubmit=e=>{e.preventDefault();send();};
function setBusy(busy){state.busy=busy;$('#sendBtn').classList.toggle('hidden',busy);$('#stopBtn').classList.toggle('hidden',!busy);$('#attachBtn').disabled=busy;input.disabled=busy;$('#status').textContent=busy?'Preparando resposta…':'Pronta para ajudar';messages.setAttribute('aria-busy',String(busy));}
function liveMessage(){
  const row=el('article','msgRow assistant'),bubble=el('div','bubble'),text=el('div','streamingText');row.append(bubble);messages.append(row);
  bubble.innerHTML='<div class="typingDots"><i></i><i></i><i></i><span>Preparando sua resposta</span></div>';
  let full='',shown=0,timer;const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  function tick(){if(!full)return;if(!text.isConnected)bubble.replaceChildren(text);const follow=messages.scrollHeight-messages.scrollTop-messages.clientHeight<180;shown=reduced?full.length:Math.min(full.length,shown+Math.max(4,Math.ceil((full.length-shown)/8)));text.textContent=full.slice(0,shown);if(follow)scrollToEnd(true);}
  timer=setInterval(tick,28);
  return {row,get raw(){return full;},delta(s){full+=s;$('#status').textContent='Escrevendo…';},finish(raw,note,limited=false){clearInterval(timer);bubble.replaceChildren();const body=el('div','markdown'),controls=el('div');bubble.append(body,controls);renderMarkdown(body,raw,controls,limited);if(note)bubble.append(el('div','messageNote',note));scrollToEnd();return controls;},dispose(){clearInterval(timer);}};
}
async function readNDJSON(response,onEvent){
  if(!response.body)throw new Error('Seu navegador não recebeu a resposta. Atualize a página.');
  const reader=response.body.getReader(),decoder=new TextDecoder();let pending='';
  try{while(true){const {value,done}=await reader.read();pending+=done?decoder.decode():decoder.decode(value,{stream:true});let p;while((p=pending.indexOf('\n'))>=0){const line=pending.slice(0,p).trim();pending=pending.slice(p+1);if(line)onEvent(JSON.parse(line));}if(done)break;}if(pending.trim())onEvent(JSON.parse(pending));}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
async function send(){
  if(state.busy||state.reading)return;
  const text=input.value.trim(),attachments=[...state.attachments];if(!text&&!attachments.length)return;
  if(text.length>60000)return toast('Envie o código longo como arquivo. O campo aceita até 60 mil caracteres.');
  let optimistic,live,done=false;const account=state.me?.user?.id;
  setBusy(true);state.controller=new AbortController();
  try{
    if(!state.chatId){const d=await api('/api/chats',{method:'POST',signal:state.controller.signal});state.chatId=d.chat.id;state.chats.unshift(d.chat);drawChats();}
    if(messages.querySelector('.welcome'))messages.replaceChildren();
    const userContent=attachments.length?JSON.stringify({_zulu:5,text,attachments}):text;
    optimistic=addMessage(userContent,'user');input.value='';clearAttachments();resize();live=liveMessage();scrollToEnd(true);
    const {data:{session}}=await sbClient.auth.getSession();if(!session)throw new Error('Sua sessão expirou. Entre novamente.');
    const response=await fetch(`/api/chats/${state.chatId}/message`,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${session.access_token}`},body:JSON.stringify({message:text,attachments,stream:true}),signal:state.controller.signal});
    if(!response.ok){const d=await response.json().catch(()=>({}));if(d.code==='NAME_REQUIRED')openModal('#nameModal');throw new Error(d.error||'Não consegui enviar a mensagem.');}
    await readNDJSON(response,event=>{
      if(event.type==='delta')live.delta(event.text);
      if(event.type==='error')throw new Error(event.error);
      if(event.type==='done'){
        done=true;const controls=live.finish(event.reply,undefined,event.limited);state.currentMessages.push({role:'user',content:userContent},{role:'assistant',content:event.limited?JSON.stringify({_zulu:5,text:event.reply,attachments:[],limited:true}):event.reply});
        const chat=state.chats.find(c=>c.id===state.chatId);if(chat){chat.title=event.title||chat.title;chat.updated_at=new Date().toISOString();state.chats.sort((a,b)=>new Date(b.updated_at)-new Date(a.updated_at));drawChats();}
        $('#exportChatBtn').disabled=false;
      }
    });
    if(!done)throw new Error('A conexão terminou antes da confirmação. Reabra a conversa para conferir se a resposta foi salva.');
  }catch(e){
    if(state.me?.user?.id!==account){live?.dispose();return;}
    const stopped=e.name==='AbortError';const msg=stopped?'Resposta interrompida. O trecho exibido pode ser copiado. Reabra a conversa para conferir o histórico.':e.message;
    if(!done){
      const controls=live?.finish(live.raw||'',msg);if(optimistic)optimistic.append(el('div','srOnly','Envio sem confirmação.'));
      input.value=text;state.attachments=attachments;drawAttachments();resize();
      controls?.append(action('Tentar novamente','up',()=>{optimistic?.remove();live?.row.remove();send();}));
    }
    if(!stopped)toast(msg);
  }finally{live?.dispose();setBusy(false);state.controller=null;if(state.me)input.focus();}
}
$('#stopBtn').onclick=()=>state.controller?.abort();
$('#exportChatBtn').onclick=()=>{if(!state.currentMessages.length)return toast('Envie uma mensagem primeiro.');const title=$('#chatHeading').textContent;const text=`# ${title}\n\n`+state.currentMessages.map(m=>{const d=unpack(m.content);return `## ${m.role==='user'?'Você':'Resposta'}\n\n${d.text}${d.attachments.length?'\n\nAnexos: '+d.attachments.map(a=>a.name).join(', '):''}`;}).join('\n\n---\n\n');downloadText(text,`${title}.md`);};
// Keyboard and dialog accessibility without changing account flows.
let lastFocus=null;
const baseOpenModal=openModal,baseCloseModal=closeModal;
openModal=function(id){lastFocus=document.activeElement;baseOpenModal(id);setTimeout(()=>$(id).querySelector('input,button')?.focus(),0);};
closeModal=function(id){baseCloseModal(id);lastFocus?.focus?.();};
document.addEventListener('keydown',e=>{
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'&&state.me){e.preventDefault();createChat();}
  if(e.key==='Escape'){closeDrawer();closeSheets();overlay.classList.remove('show');if($('#otpView').classList.contains('show'))closeModal('#otpView');}
  if(e.key==='Tab'){const dialog=document.querySelector('.modalScreen.show')||document.querySelector('.sheet.open')||(matchMedia('(max-width:760px)').matches?document.querySelector('.drawer.open'):null);if(!dialog)return;const targets=[...dialog.querySelectorAll('button,input,textarea,[tabindex="0"]')].filter(x=>!x.disabled&&x.offsetParent!==null);const first=targets[0],last=targets.at(-1);if(e.shiftKey&&(document.activeElement===first||!dialog.contains(document.activeElement))){e.preventDefault();last?.focus();}else if(!e.shiftKey&&(document.activeElement===last||!dialog.contains(document.activeElement))){e.preventDefault();first?.focus();}}
});
window.addEventListener('beforeunload',e=>{if(state.busy){e.preventDefault();e.returnValue='';}});
paintIcons();boot();

function addOlderButton(hasMore){
  messages.querySelector('.loadOlder')?.remove();
  if(!hasMore)return;
  const b=action('Carregar mensagens anteriores','up',async()=>{
    if(state.busy)return toast('Aguarde a resposta terminar.');
    b.disabled=true;const id=state.chatId;
    try{
      const d=await api(`/api/chats/${id}?offset=${state.currentMessages.length}`);
      if(id!==state.chatId)return;
      const height=messages.scrollHeight,top=messages.scrollTop;
      b.remove();const fragment=document.createDocumentFragment();
      for(const m of d.messages){const row=addMessage(m.content,m.role);fragment.append(row);}
      messages.prepend(fragment);state.currentMessages=[...d.messages,...state.currentMessages];addOlderButton(d.hasMore);
      messages.scrollTop=top+(messages.scrollHeight-height);
    }catch(e){toast(e.message);b.disabled=false;}
  },'textBtn loadOlder');messages.prepend(b);
}
