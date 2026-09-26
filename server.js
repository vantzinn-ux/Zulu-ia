require("dotenv").config();

const path = require("path");
const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 3000;
if (process.env.TRUST_PROXY || process.env.RENDER) app.set("trust proxy", Number(process.env.TRUST_PROXY || 1));

const RAW_SUPABASE_URL = String(process.env.SUPABASE_URL || "").trim();
let SUPABASE_URL = RAW_SUPABASE_URL;
try {
  if (RAW_SUPABASE_URL) SUPABASE_URL = new URL(RAW_SUPABASE_URL).origin;
} catch (_) {
  console.warn("SUPABASE_URL inválida.");
}

const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false
}));

app.use(cors((req, done) => {
  const allowed = new Set([
    "https://zulu-ia.onrender.com", "https://localhost", "capacitor://localhost", "http://localhost",
    ...((process.env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean))
  ]);
  // Accept the UI served by this same origin, including local development ports.
  const sameOrigin = `${req.protocol}://${req.get("host")}`;
  done(null, {
    origin(origin, cb) {
      if (!origin || origin === sameOrigin || allowed.has(origin)) return cb(null, true);
      return cb(Object.assign(new Error("Origem não permitida"), { status: 403 }));
    },
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"], maxAge: 86400
  });
}));

// Large attachment bodies are parsed only after authentication on the chat route.
const smallJson = express.json({ limit: "100kb" });
app.use((req, res, next) => /^\/api\/chats\/[^/]+\/message$/.test(req.path) && req.method === "POST" ? next() : smallJson(req, res, next));

app.use(rateLimit({
  windowMs: 60 * 1000,
  limit: 80,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas solicitações. Aguarde um minuto e tente novamente." }
}));

function userSupabase(token) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

async function auth(req, res, next) {
  try {
    const h = String(req.get("authorization") || "");
    const token = h.startsWith("Bearer ") ? h.slice(7).trim() : "";
    if (!token) return res.status(401).json({ error: "Sessão necessária" });

    const client = userSupabase(token);
    const { data, error } = await client.auth.getUser(token);
    if (error || !data?.user) return res.status(401).json({ error: "Sessão inválida ou expirada" });

    req.zulu = { token, client, user: data.user };
    next();
  } catch (e) {
    console.error("auth:", e);
    res.status(401).json({ error: "Não foi possível validar sua sessão" });
  }
}

const { gemini } = require("./lib/gemini");
const makeChatRoute = require("./lib/chat-route");

async function getProfile(client, user) {
  let { data, error } = await client
    .from("profiles")
    .select("id,display_name,avatar_url,name_confirmed,created_at,updated_at")
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    const initialName =
      user?.user_metadata?.display_name ||
      user?.user_metadata?.full_name ||
      null;

    const created = await client
      .from("profiles")
      .insert({
        id: user.id,
        display_name: initialName,
        name_confirmed: false
      })
      .select("id,display_name,avatar_url,name_confirmed,created_at,updated_at")
      .single();

    if (created.error) throw created.error;
    data = created.data;
  }

  return data;
}

async function getSettings(client, user) {
  let { data, error } = await client
    .from("user_settings")
    .select("theme,language,created_at,updated_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    const created = await client
      .from("user_settings")
      .insert({ user_id: user.id })
      .select("theme,language,created_at,updated_at")
      .single();

    if (created.error) throw created.error;
    data = created.data;
  }

  return data;
}

async function getMemoryText(client, userId) {
  const { data, error } = await client
    .from("memories")
    .select("category,memory_key,memory_value")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(80);

  if (error) throw error;
  if (!data?.length) return "Nenhuma memória salva ainda.";

  return data
    .map(m => `- [${m.category}] ${m.memory_key}: ${m.memory_value}`)
    .join("\n");
}

async function extractMemories(client, userId, chatId, text) {
  try {
    const instruction = `
Analise a mensagem abaixo e extraia SOMENTE fatos úteis e relativamente duradouros para personalização futura.

NÃO extraia:
- senhas
- códigos OTP
- chaves de API
- tokens
- dados bancários
- segredos
- informação passageira sem utilidade futura

Retorne SOMENTE JSON válido:
{"memories":[{"category":"preferencia|perfil|projeto|rotina|geral","key":"chave_curta","value":"valor_curto"}]}

Se não houver nada útil:
{"memories":[]}

Mensagem:
${JSON.stringify(text)}
`;

    const raw = await gemini(
      [{ role: "user", parts: [{ text: instruction }] }],
      "Você é um extrator seguro de memórias. Retorne apenas JSON válido.",
      { temperature: 0.1, maxOutputTokens: 600 }
    );

    const clean = raw.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
    const parsed = JSON.parse(clean);

    for (const mem of (parsed.memories || []).slice(0, 4)) {
      const category = String(mem.category || "geral").slice(0, 30).trim();
      const key = String(mem.key || "").slice(0, 80).trim();
      const value = String(mem.value || "").slice(0, 500).trim();
      if (!key || !value) continue;

      const { error } = await client.from("memories").upsert({
        user_id: userId,
        category,
        memory_key: key,
        memory_value: value,
        source_chat_id: chatId
      }, { onConflict: "user_id,memory_key" });

      if (error) console.error("Memória upsert:", error);
    }
  } catch (e) {
    console.error("Memória automática:", e);
  }
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true, name: "Zulu", version: "5.0.0", auth: "Supabase" });
});

app.get("/api/config", (req, res) => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return res.status(503).json({ error: "Supabase ainda não configurado no servidor" });
  }
  res.json({ supabaseUrl: SUPABASE_URL, supabaseAnonKey: SUPABASE_ANON_KEY });
});

app.get("/api/me", auth, async (req, res) => {
  try {
    const [profile, settings] = await Promise.all([
      getProfile(req.zulu.client, req.zulu.user),
      getSettings(req.zulu.client, req.zulu.user)
    ]);

    res.json({
      user: {
        id: req.zulu.user.id,
        email: req.zulu.user.email || null,
        identities: (req.zulu.user.identities || []).map(i => i.provider)
      },
      profile,
      settings
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Não consegui carregar sua conta" });
  }
});

app.patch("/api/profile", auth, async (req, res) => {
  try {
    const displayName = String(req.body?.displayName || "").trim().slice(0, 60);
    if (!displayName) return res.status(400).json({ error: "Nome inválido" });

    const { data, error } = await req.zulu.client
      .from("profiles")
      .update({ display_name: displayName, name_confirmed: true })
      .eq("id", req.zulu.user.id)
      .select("display_name,name_confirmed")
      .single();

    if (error) throw error;

    await req.zulu.client.from("memories").upsert({
      user_id: req.zulu.user.id,
      category: "perfil",
      memory_key: "nome_preferido",
      memory_value: displayName,
      source_chat_id: null
    }, { onConflict: "user_id,memory_key" });

    res.json({ ok: true, profile: data });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Não consegui salvar seu nome" });
  }
});

app.patch("/api/settings", auth, async (req, res) => {
  try {
    const patch = {};
    if (req.body?.theme === "dark" || req.body?.theme === "light") patch.theme = req.body.theme;
    if (typeof req.body?.language === "string") patch.language = req.body.language.slice(0, 12);

    const { data, error } = await req.zulu.client
      .from("user_settings")
      .update(patch)
      .eq("user_id", req.zulu.user.id)
      .select("theme,language")
      .single();

    if (error) throw error;
    res.json({ ok: true, settings: data });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Não consegui salvar suas configurações" });
  }
});

app.get("/api/chats", auth, async (req, res) => {
  const { data, error } = await req.zulu.client
    .from("chats")
    .select("id,title,created_at,updated_at")
    .eq("user_id", req.zulu.user.id)
    .order("updated_at", { ascending: false })
    .limit(100);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ chats: data || [] });
});

app.post("/api/chats", auth, async (req, res) => {
  const { data, error } = await req.zulu.client
    .from("chats")
    .insert({ user_id: req.zulu.user.id, title: "Novo chat" })
    .select("id,title,created_at,updated_at")
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ chat: data });
});

app.get("/api/chats/:id", auth, async (req, res) => {
  const chatId = req.params.id;

  const { data: chat, error: chatError } = await req.zulu.client
    .from("chats")
    .select("id,title,created_at,updated_at")
    .eq("id", chatId)
    .eq("user_id", req.zulu.user.id)
    .single();

  if (chatError || !chat) return res.status(404).json({ error: "Chat não encontrado" });

  const offset = Number(req.query.offset || 0);
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100000) return res.status(400).json({ error: "Página inválida" });
  const { data: messages, error: msgError } = await req.zulu.client
    .from("messages")
    .select("id,role,content,created_at")
    .eq("chat_id", chatId)
    .eq("user_id", req.zulu.user.id)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + 19);

  if (msgError) return res.status(500).json({ error: msgError.message });
  res.json({ chat, messages: (messages || []).reverse(), hasMore: messages?.length === 20 });
});

app.delete("/api/chats/:id", auth, async (req, res) => {
  const { error } = await req.zulu.client
    .from("chats")
    .delete()
    .eq("id", req.params.id)
    .eq("user_id", req.zulu.user.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

app.post("/api/chats/:id/message", auth,
  express.json({ limit: "15mb" }),
  makeChatRoute({ getProfile, getMemoryText, extractMemories }));

app.get("/api/memories", auth, async (req, res) => {
  const { data, error } = await req.zulu.client
    .from("memories")
    .select("id,category,memory_key,memory_value,source_chat_id,created_at,updated_at")
    .eq("user_id", req.zulu.user.id)
    .order("updated_at", { ascending: false })
    .limit(250);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ memories: data || [] });
});

app.delete("/api/memories/:id", auth, async (req, res) => {
  const { error } = await req.zulu.client
    .from("memories")
    .delete()
    .eq("id", req.params.id)
    .eq("user_id", req.zulu.user.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// Serve only the public UI. Never expose server.js, SQL, .env or uploaded content.
const publicFiles = ["index.html", "style.css", "app.js", "chat-ui.js", "zulu-avatar.png"];
for (const file of publicFiles) app.get("/" + file, (req, res) => res.sendFile(path.join(__dirname, file)));
const vendor = {
  "supabase.js": "@supabase/supabase-js/dist/umd/supabase.js",
  "marked.js": "marked/lib/marked.umd.js",
  "purify.js": "dompurify/dist/purify.min.js",
  "highlight.js": "@highlightjs/cdn-assets/highlight.min.js",
  "fflate.js": "fflate/umd/index.js"
};
for (const [name, file] of Object.entries(vendor)) app.get("/vendor/" + name, (req, res) => res.sendFile(path.join(__dirname, "node_modules", file)));
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));
app.use((req, res) => res.status(404).json({ error: "Rota não encontrada" }));
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  const status = error.type === "entity.too.large" ? 413 : error.status || 500;
  res.status(status).json({ error: status === 413 ? "Anexos muito grandes. Limite total de 10 MB por mensagem." : status === 400 ? "Requisição inválida." : status === 403 ? "Origem não permitida." : "Não foi possível processar a solicitação." });
});
if (require.main === module) app.listen(PORT, "0.0.0.0", () => console.log(`Zulu V5.0.0 online na porta ${PORT}`));
module.exports = app;
