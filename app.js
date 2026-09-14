const chat=document.querySelector('#chat');
const statusEl=document.querySelector('#status');
const form=document.querySelector('#form');
const message=document.querySelector('#message');
const sendBtn=document.querySelector('#send');
const dialog=document.querySelector('#memoryDialog');
const memoryList=document.querySelector('#memoryList');

let userId=localStorage.getItem('zulu_user_id');
if(!userId){
  userId=crypto.randomUUID();
  localStorage.setItem('zulu_user_id',userId);
}

const headers=()=>({'Content-Type':'application/json','x-zulu-user':userId});

function bubble(text,who='bot'){
  const el=document.createElement('div');
  el.className='bubble '+who;
  el.textContent=text;
  chat.appendChild(el);
  chat.scrollTop=chat.scrollHeight;
}
function setStatus(text){statusEl.textContent=text}

async function start(){
  try{
    const r=await fetch('/api/hello',{headers:headers()});
    const j=await r.json();
    bubble(j.message);
    setStatus('Zulu online');
  }catch{
    bubble('Não consegui conectar ao servidor da Zulu.');
    setStatus('Sem conexão');
  }
}

form.addEventListener('submit',async e=>{
  e.preventDefault();
  const text=message.value.trim();
  if(!text)return;

  bubble(text,'user');
  message.value='';
  sendBtn.disabled=true;
  setStatus('Zulu está pensando...');

  try{
    const r=await fetch('/api/chat',{
      method:'POST',
      headers:headers(),
      body:JSON.stringify({message:text})
    });
    const j=await r.json();
    bubble(j.reply||j.error||'Não consegui responder agora.');
    setStatus(r.ok?'Zulu online':'Erro no servidor');
  }catch{
    bubble('Não consegui conectar ao servidor da Zulu.');
    setStatus('Sem conexão');
  }finally{
    sendBtn.disabled=false;
    message.focus();
  }
});

document.querySelector('#memoryBtn').onclick=async()=>{
  memoryList.textContent='Carregando...';
  dialog.showModal();
  try{
    const j=await (await fetch('/api/memories',{headers:headers()})).json();
    memoryList.innerHTML='';
    for(const item of (j.memories||[])){
      const el=document.createElement('div');
      el.className='memory';
      el.textContent=item.content;
      memoryList.appendChild(el);
    }
    if(!memoryList.children.length) memoryList.textContent='Nenhuma memória ainda.';
  }catch{
    memoryList.textContent='Não foi possível carregar a memória.';
  }
};

document.querySelector('#closeMemory').onclick=()=>dialog.close();

document.querySelector('#clearMemory').onclick=async()=>{
  if(!confirm('Apagar as memórias salvas pela Zulu?'))return;
  await fetch('/api/memories',{method:'DELETE',headers:headers()});
  memoryList.textContent='Memória limpa.';
};

start();
