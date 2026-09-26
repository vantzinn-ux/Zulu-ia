const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

let sbClient = null;
let authFlow = { mode: null, email: null };
const state = {
  session: null,
  me: null,
  chats: [],
  chatId: null,
  busy: false, attachments: [], currentMessages: [], controller: null, initializedUser: null, loadingAccount: false
};

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove("show"), 3200);
}

async function loadConfig() {
  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    throw new Error("Biblioteca de login não carregou. Atualize a página.");
  }

  const r = await fetch("/api/config", { cache: "no-store" });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || "Configuração indisponível");

  sbClient = window.supabase.createClient(d.supabaseUrl, d.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
}

async function api(path, opt = {}) {
  const { data: { session } } = await sbClient.auth.getSession();
  if (!session?.access_token) throw new Error("Sessão necessária");

  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${session.access_token}`,
    ...(opt.headers || {})
  };

  const r = await fetch(path, { ...opt, headers });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error(d.error || `HTTP ${r.status}`);
    e.status = r.status;
    e.data = d;
    throw e;
  }
  return d;
}

function setTheme(theme, saveLocal = true) {
  document.body.dataset.theme = theme === "light" ? "light" : "dark";
  $("#themeToggle").checked = theme === "light";
  if (saveLocal) localStorage.setItem("zulu_theme", theme);
}

function showAuth() {
  $("#authView").classList.remove("hidden");
  $("#appView").classList.add("hidden");
  document.body.classList.remove("signedIn");
  drawer.inert = true;
  closeDrawer();
}

function showApp() {
  $("#authView").classList.add("hidden");
  $("#appView").classList.remove("hidden");
  document.body.classList.add("signedIn");
  drawer.inert = false;
}

function openModal(id) { $(id).classList.add("show"); }
function closeModal(id) { $(id).classList.remove("show"); }

$$("[data-tab]").forEach(btn => {
  btn.onclick = () => {
    $$("[data-tab]").forEach(b => b.classList.toggle("active", b === btn));
    $("#loginPane").classList.toggle("active", btn.dataset.tab === "login");
    $("#signupPane").classList.toggle("active", btn.dataset.tab === "signup");
  };
});

$$("[data-eye]").forEach(btn => {
  btn.onclick = () => {
    const inp = $("#" + btn.dataset.eye);
    inp.type = inp.type === "password" ? "text" : "password";
  };
});

$("#loginBtn").onclick = async () => {
  try {
    const email = $("#loginEmail").value.trim();
    const password = $("#loginPassword").value;
    if (!email || !password) return toast("Preencha e-mail e senha.");
    $("#loginBtn").disabled = true;

    const { error } = await sbClient.auth.signInWithPassword({ email, password });
    if (error) throw error;
  } catch (e) {
    toast(e.message || "Não foi possível entrar.");
  } finally {
    $("#loginBtn").disabled = false;
  }
};

$("#signupBtn").onclick = async () => {
  try {
    const email = $("#signupEmail").value.trim();
    const password = $("#signupPassword").value;
    if (!email || !password) return toast("Preencha e-mail e senha.");
    $("#signupBtn").disabled = true;

    const { data, error } = await sbClient.auth.signUp({ email, password });
    if (error) throw error;

    if (data.session) {
      await afterLogin();
      return;
    }

    authFlow = { mode: "signup", email };
    $("#otpTitle").textContent = "Confirme seu e-mail 💜";
    $("#otpText").textContent = `Digite o código de 8 dígitos enviado para ${email}.`;
    $("#otpCode").value = "";
    openModal("#otpView");
  } catch (e) {
    toast(e.message || "Não foi possível criar a conta.");
  } finally {
    $("#signupBtn").disabled = false;
  }
};

$("#forgotBtn").onclick = async () => {
  const email = $("#loginEmail").value.trim();
  if (!email) return toast("Digite seu e-mail primeiro.");
  try {
    const { error } = await sbClient.auth.resetPasswordForEmail(email);
    if (error) throw error;
    authFlow = { mode: "recovery", email };
    $("#otpTitle").textContent = "Recuperar senha 🔐";
    $("#otpText").textContent = `Digite o código enviado para ${email}.`;
    $("#otpCode").value = "";
    openModal("#otpView");
  } catch (e) {
    toast(e.message || "Não foi possível enviar o código.");
  }
};

$("#otpConfirmBtn").onclick = async () => {
  const token = $("#otpCode").value.replace(/\D/g, "");
  if (token.length < 6) return toast("Digite o código completo.");

  try {
    $("#otpConfirmBtn").disabled = true;
    const type = authFlow.mode === "recovery" ? "recovery" : "signup";
    const { error } = await sbClient.auth.verifyOtp({
      email: authFlow.email,
      token,
      type
    });
    if (error) throw error;

    closeModal("#otpView");
    if (authFlow.mode === "recovery") {
      openModal("#newPasswordView");
    } else {
      toast("E-mail confirmado! 💜");
      await afterLogin();
    }
  } catch (e) {
    toast(e.message || "Código inválido ou expirado.");
  } finally {
    $("#otpConfirmBtn").disabled = false;
  }
};

$("#otpBackBtn").onclick = () => closeModal("#otpView");

$("#savePasswordBtn").onclick = async () => {
  const p1 = $("#newPassword").value;
  const p2 = $("#newPassword2").value;
  if (p1.length < 8) return toast("A senha precisa ter pelo menos 8 caracteres.");
  if (p1 !== p2) return toast("As senhas não são iguais.");

  try {
    const { error } = await sbClient.auth.updateUser({ password: p1 });
    if (error) throw error;
    closeModal("#newPasswordView");
    toast("Senha alterada com sucesso.");
    await afterLogin();
  } catch (e) {
    toast(e.message || "Não foi possível alterar a senha.");
  }
};

async function oauth(provider) {
  try {
    const { error } = await sbClient.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin }
    });
    if (error) throw error;
  } catch (e) {
    toast(`${provider === "google" ? "Google" : "Facebook"} ainda não está disponível: ${e.message}`);
  }
}
$("#googleBtn").onclick = () => oauth("google");
$("#facebookBtn").onclick = () => oauth("facebook");

async function afterLogin() {
  if (state.loadingAccount || state.initializedUser === state.session?.user?.id && state.me) return;
  state.loadingAccount = true;
  try {
    showApp();
    const d = await api("/api/me");
    state.me = d;
    $("#accountName").textContent = d.profile?.display_name || "Sua conta";
    $("#accountInitial").textContent = (d.profile?.display_name || "U").slice(0, 1).toUpperCase();

    const theme = d.settings?.theme || localStorage.getItem("zulu_theme") || "dark";
    setTheme(theme);

    $("#settingsName").value = d.profile?.display_name || "";
    $("#accountEmail").textContent = `E-mail: ${d.user?.email || "não disponível"}`;
    const providers = (d.user?.identities || []).join(", ") || "email";
    $("#accountProvider").textContent = `Login: ${providers}`;

    const hasPasswordProvider = (d.user?.identities || []).includes("email");
    $("#changePasswordBtn").style.display = hasPasswordProvider ? "" : "none";

    await loadChats();

    state.initializedUser = d.user.id;
    if (!d.profile?.name_confirmed) {
      $("#nameInput").value = d.profile?.display_name || "";
      openModal("#nameModal");
    } else if (state.chats.length) {
      await openChat(state.chats[0].id);
    } else {
      welcome();
    }
  } catch (e) {
    console.error(e);
    state.initializedUser = null;
    toast(e.message || "Erro ao carregar sua conta.");
  } finally { state.loadingAccount = false; }
}

$("#saveNameBtn").onclick = async () => {
  const name = $("#nameInput").value.trim();
  if (!name) return toast("Digite como você quer ser chamado.");
  try {
    await saveDisplayName(name);
    closeModal("#nameModal");
    welcome();
  } catch (e) {
    toast(e.message);
  }
};

async function saveDisplayName(name) {
  const d = await api("/api/profile", {
    method: "PATCH",
    body: JSON.stringify({ displayName: name })
  });
  state.me.profile.display_name = d.profile.display_name;
  state.me.profile.name_confirmed = true;
  $("#settingsName").value = d.profile.display_name;
  $("#accountName").textContent = d.profile.display_name;
  $("#accountInitial").textContent = d.profile.display_name.slice(0, 1).toUpperCase();
}

const drawer = $("#drawer"), overlay = $("#overlay"), messages = $("#messages"), input = $("#input");

function openDrawer() { drawer.classList.add("open"); overlay.classList.add("show"); }
function closeDrawer() { drawer.classList.remove("open"); overlay.classList.remove("show"); }
function closeSheets() {
  $("#memoryPanel").classList.remove("open");
  $("#settingsPanel").classList.remove("open");
}
$("#menuBtn").onclick = openDrawer;
$("#closeDrawer").onclick = closeDrawer;
overlay.onclick = () => { closeDrawer(); closeSheets(); overlay.classList.remove("show"); };

$("#memoryBtn").onclick = async () => {
  closeDrawer();
  const d = await api("/api/memories");
  const box = $("#memoryList");
  box.innerHTML = "";

  if (!d.memories.length) {
    box.innerHTML = '<div class="empty">Nenhuma preferência salva por enquanto.</div>';
  }

  for (const m of d.memories) {
    const card = document.createElement("div");
    card.className = "memoryCard";

    const del = document.createElement("button");
    del.className = "memoryDelete";
    del.textContent = "×";
    del.onclick = async () => {
      await api(`/api/memories/${m.id}`, { method: "DELETE" });
      card.remove();
    };

    const small = document.createElement("small");
    small.textContent = m.category;
    const b = document.createElement("b");
    b.textContent = m.memory_key;
    const p = document.createElement("p");
    p.textContent = m.memory_value;

    card.append(del, small, document.createElement("br"), b, p);
    box.appendChild(card);
  }

  $("#memoryPanel").classList.add("open");
  overlay.classList.add("show");
};
$("#closeMemory").onclick = () => { $("#memoryPanel").classList.remove("open"); overlay.classList.remove("show"); };

$("#settingsBtn").onclick = () => {
  closeDrawer();
  $("#settingsPanel").classList.add("open");
  overlay.classList.add("show");
};
$("#closeSettings").onclick = () => { $("#settingsPanel").classList.remove("open"); overlay.classList.remove("show"); };

$("#themeToggle").onchange = async e => {
  const theme = e.target.checked ? "light" : "dark";
  setTheme(theme);
  try {
    await api("/api/settings", { method: "PATCH", body: JSON.stringify({ theme }) });
    state.me.settings.theme = theme;
  } catch (err) {
    toast("Não consegui salvar o tema na conta.");
  }
};

$("#saveNameSettings").onclick = async () => {
  const name = $("#settingsName").value.trim();
  if (!name) return toast("Digite um nome ou apelido.");
  try {
    await saveDisplayName(name);
    toast("Nome atualizado 💜");
  } catch (e) {
    toast(e.message || "Não consegui atualizar.");
  }
};

$("#changePasswordBtn").onclick = async () => {
  const email = state.me?.user?.email;
  if (!email) return toast("Não encontrei um e-mail nesta conta.");
  try {
    const { error } = await sbClient.auth.resetPasswordForEmail(email);
    if (error) throw error;
    authFlow = { mode: "recovery", email };
    $("#otpTitle").textContent = "Verificação de segurança 🔐";
    $("#otpText").textContent = `Enviamos um código para ${email}. Confirme antes de alterar sua senha.`;
    $("#otpCode").value = "";
    closeSheets();
    overlay.classList.remove("show");
    openModal("#otpView");
  } catch (e) {
    toast(e.message || "Não consegui enviar o código.");
  }
};

$("#logoutBtn").onclick = async () => {
  state.controller?.abort();
  clearAttachments();
  state.initializedUser = null;
  await sbClient.auth.signOut();
  state.me = null;
  state.chatId = null;
  state.chats = [];
  messages.innerHTML = "";
  closeSheets();
  overlay.classList.remove("show");
  showAuth();
  toast("Você saiu da sua conta.");
};

// Avoid awaiting Supabase calls inside onAuthStateChange (the SDK holds a session lock).
async function boot() {
  document.documentElement.dataset.zuluJs = "ok";
  setTheme(localStorage.getItem("zulu_theme") || "dark", false);
  try {
    await loadConfig();
    sbClient.auth.onAuthStateChange((event, session) => {
      state.session = session;
      if (event === "SIGNED_OUT") {
        state.controller?.abort(); state.initializedUser = null; state.me = null;
        state.chatId = null; state.chats = []; state.currentMessages = []; messages.replaceChildren(); clearAttachments(); showAuth(); return;
      }
      if (event === "PASSWORD_RECOVERY") { setTimeout(() => openModal("#newPasswordView"), 0); return; }
      if (session && ["SIGNED_IN", "INITIAL_SESSION"].includes(event)) setTimeout(afterLogin, 0);
    });
    const { data: { session } } = await sbClient.auth.getSession();
    state.session = session;
    if (session) await afterLogin(); else showAuth();
  } catch (e) { console.error(e); showAuth(); toast(e.message || "Não foi possível conectar ao servidor."); }
}
