require("dotenv").config();
const express = require("express");
const whatsapp = require("./whatsapp.js");
const webhookApp = require("./webhook.js");
const path = require("path");
const bodyParser = require("body-parser");
const sqlite3 = require("sqlite3").verbose();
const { getClient } = require("./whatsapp.js");
const { getQR, getStatus } = require("./whatsapp.js");

// === Firebase SDK ===
const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs } = require("firebase/firestore");

// === Configuração Firebase (pegue do seu firebaseConfig.js) ===
const firebaseConfig = {
  apiKey: "AIzaSyAzPS2txA2Bfk8A9tNxCYuGUZb-TLjJP2E",
  authDomain: "app-igreja-c97f2.firebaseapp.com",
  projectId: "app-igreja-c97f2",
  storageBucket: "app-igreja-c97f2.firebasestorage.app",
  messagingSenderId: "872830746247",
  appId: "1:872830746247:web:de9e0fb5688af2e0240222",
  measurementId: "G-JM9CTL6ZGS"
};

// === Inicializa Firebase ===
const firebaseApp = initializeApp(firebaseConfig);
const dbFirebase = getFirestore(firebaseApp);

console.log("🔥 Firebase conectado com sucesso!");

// === Setup servidor ===
const PORT = process.env.PORT || 3000;
const app = express();

app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Inicia o cliente WhatsApp
whatsapp.startWhatsApp();

// Monta as rotas do Webhook (Chatwoot → WhatsApp)
app.use("/", webhookApp);

// Conecta ao banco local SQLite
const db = new sqlite3.Database(path.resolve(process.cwd(), "db", "contacts.db"));

// Helper para usar db.all com Promise
function dbAllAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}




// === Rota para exibir QR Code do WhatsApp ===
app.get("/qrcode", async (req, res) => {
  const qr = getQR();
  const ready = getStatus();

  if (ready) {
    return res.send(`
      <h2>✅ WhatsApp já conectado!</h2>
      <p>Você pode fechar esta aba.</p>
      <script>setTimeout(()=>location.reload(), 5000)</script>
    `);
  }

  if (!qr) {
    return res.send(`
      <h2>⏳ Aguardando geração do QR Code...</h2>
      <p>Atualize esta página em alguns segundos.</p>
      <script>setTimeout(()=>location.reload(), 3000)</script>
    `);
  }

  res.send(`
    <html>
      <head><title>QR Code WhatsApp</title></head>
      <body style="text-align:center; font-family:sans-serif; background:#f7f7f7;">
        <h2>📱 Escaneie com o WhatsApp</h2>
        <img src="${qr}" style="width:300px; height:300px; border-radius:8px; border:1px solid #ccc;">
        <p>A página atualiza automaticamente...</p>
        <script>setTimeout(()=>location.reload(), 10000)</script>
      </body>
    </html>
  `);
});

// === Página /mensagens ===
app.get("/mensagens", async (req, res) => {
  const client = getClient();
  if (!client) return res.send("⚠️ Cliente WhatsApp ainda não está inicializado.");

  // === Conversas do WhatsApp ===
  let chats = [];
  try {
    chats = await client.getChats();
  } catch (err) {
    console.error("Erro ao buscar conversas:", err?.message || err);
    chats = [];
  }

  // === Contatos do Firestore ===
  let contatosFirebase = [];
  try {
    const snapshot = await getDocs(collection(dbFirebase, "whatsapp_subscribers"));
    contatosFirebase = snapshot.docs.map((doc) => ({
      origem: "Firebase",
      name: doc.data().nome || "(sem nome)",
      number: doc.data().phone || "",
      lastMessage: "(novo contato)"
    }));
  } catch (err) {
    console.error("Erro ao buscar contatos do Firestore:", err?.message || err);
  }

  // === Contatos do SQLite ===
  let contatosBanco = [];
  try {
    contatosBanco = await dbAllAsync("SELECT * FROM contacts ORDER BY id DESC");
  } catch (err) {
    console.error("Erro ao ler DB:", err?.message || err);
  }

  // === Combina todos ===
  const todos = [
    ...contatosFirebase.map((c) => ({
      origem: "Firebase",
      name: c.name,
      number: c.number,
      lastMessage: c.lastMessage
    })),
    ...contatosBanco.map((c) => ({
      origem: "Banco",
      name: c.number,
      number: c.number,
      lastMessage: "-"
    }))
  ];

  // === Adiciona conversas do WhatsApp ===
  chats.forEach((chat) => {
    if (chat && chat.id && chat.id.user && !chat.isGroup) {
      const number = `+${String(chat.id.user).replace(/\D/g, "")}`;
      const jaExiste = todos.find((x) => x.number === number);
      if (!jaExiste) {
        todos.push({
          origem: "WhatsApp",
          number,
          name: chat.name || number,
          lastMessage: chat.lastMessage?.body || "(sem mensagens)"
        });
      }
    }
  });

  // === Gera tabela HTML ===
  const linhas = todos
    .map(
      (c) => `
        <tr>
          <td style="text-align:center"><input type="checkbox" name="contatos" value="${c.number}" class="checkContato"></td>
          <td>${c.origem}</td>
          <td>${c.name}</td>
          <td>${c.number}</td>
          <td>${c.lastMessage}</td>
        </tr>`
    )
    .join("");

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Envio em Massa WhatsApp</title>
  <style>
    body { font-family: Arial; background: #f9f9f9; padding: 20px; }
    h1 { text-align: center; margin-bottom: 20px; }
    .top-bar { background: white; padding: 16px; border-radius: 8px; box-shadow: 0 1px 6px rgba(0,0,0,0.1); max-width: 1100px; margin: 0 auto 20px; position: relative; }
    textarea { width: 100%; height: 80px; border: 1px solid #ccc; border-radius: 6px; padding: 8px; box-sizing: border-box; }
    .actions { margin-top: 10px; display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
    .btn { background: #25D366; color: white; padding: 10px 16px; border: none; border-radius: 6px; cursor: pointer; text-decoration: none; font-weight: bold; }
    .btn:hover { opacity: 0.9; }
    .btn-red { background: #f44336; }
    .btn-blue { background: #007BFF; }
    .qrcode-link { position: absolute; top: 16px; right: 16px; }
    table { border-collapse: collapse; width: 100%; max-width: 1100px; margin: 0 auto; background: white; border-radius: 6px; overflow: hidden; }
    th, td { padding: 10px; border-bottom: 1px solid #eee; text-align: left; }
    th { background: #25D366; color: white; }
    tbody tr:hover { background: #f5f5f5; }
    #contador { display:block; text-align:center; margin-top:6px; }
  </style>
</head>
<body>
  <h1>💬 Enviar Mensagem em Massa</h1>

  <form action="/enviar-multiplo" method="POST" onsubmit="return confirmarEnvio();">
    <div class="top-bar">
      <a href="/qrcode" target="_blank" class="btn btn-blue qrcode-link">🔗 Conexão WhatsApp</a>
      <textarea name="mensagem" placeholder="Digite sua mensagem..." required></textarea>
      <div class="actions">
        <button type="button" onclick="selecionarTodos(true)" class="btn">Selecionar Todos</button>
        <button type="button" onclick="selecionarTodos(false)" class="btn btn-red">Desmarcar Todos</button>
        <button type="submit" class="btn">📤 Enviar</button>
      </div>
      <small id="contador">0 contatos selecionados</small>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width:50px; text-align:center;">✔</th>
          <th>Origem</th>
          <th>Nome</th>
          <th>Número</th>
          <th>Última Mensagem</th>
        </tr>
      </thead>
      <tbody>${linhas}</tbody>
    </table>
  </form>

  <script>
    function selecionarTodos(estado) {
      document.querySelectorAll('.checkContato').forEach(chk => chk.checked = estado);
      atualizarContador();
    }

    function confirmarEnvio() {
      const selecionados = document.querySelectorAll('.checkContato:checked').length;
      if (selecionados === 0) {
        alert('Selecione pelo menos um contato.');
        return false;
      }
      return confirm('Enviar mensagem para ' + selecionados + ' contato(s)?');
    }

    function atualizarContador() {
      const n = document.querySelectorAll('.checkContato:checked').length;
      document.getElementById('contador').innerText = n + ' contatos selecionados';
    }

    document.addEventListener('change', e => {
      if (e.target.classList.contains('checkContato')) atualizarContador();
    });
    atualizarContador();
  </script>
</body>
</html>`;

  res.send(html);
});

// === Envio em massa ===
app.post("/enviar-multiplo", async (req, res) => {
  const { contatos, mensagem } = req.body;
  const client = getClient();
  if (!client) return res.send("⚠️ Cliente WhatsApp não está inicializado.");

  let numeros = [];
  if (typeof contatos === "string") numeros = [contatos];
  else if (Array.isArray(contatos)) numeros = contatos;

  let enviados = 0;
  for (const numero of numeros) {
    const clean = String(numero).replace(/\D/g, "");
    const chatId = `${clean}@c.us`;
    try {
      await client.sendMessage(chatId, mensagem);
      enviados++;
      console.log(`✅ Mensagem enviada para ${numero}`);
    } catch (err) {
      console.error(`❌ Erro ao enviar para ${numero}:`, err?.message || err);
    }
  }

  res.send(`
    <script>
      alert('Mensagens enviadas com sucesso para ${enviados} contato(s)!');
      window.location.href='/mensagens';
    </script>
  `);
});

// === Inicia servidor ===
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
