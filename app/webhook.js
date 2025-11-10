const express = require("express");
const { getClient } = require("./whatsapp.js");


const app = express();
app.use(express.json());

// === Webhook principal Chatwoot → WhatsApp ===
app.post("/webhook", async (req, res) => {
  const payload = req.body;

  // Ignora mensagens que não são de saída (somente agentes humanos)
  if (payload.message_type !== "outgoing") {
    return res.sendStatus(200);
  }

  // Ignora mensagens privadas (anotações internas)
  if (payload.private === true) {
    return res.sendStatus(200);
  }

  const conversation = payload.conversation || {};
  const messageContent = payload.content?.trim();

  // Extrai o número do cliente (origem)
  const whatsappNumber =
    conversation.meta?.sender?.phone_number ||
    conversation.meta?.sender?.identifier ||
    payload?.contact?.phone_number;

  if (!whatsappNumber) {
    console.error("❌ Nenhum número de telefone encontrado no payload!");
    return res.sendStatus(400);
  }

  if (!messageContent) {
    console.error("❌ Mensagem vazia recebida, ignorando...");
    return res.sendStatus(200);
  }

  // Converte para formato do WhatsApp Web (ex: 55999999999@c.us)
  const cleanNumber = whatsappNumber.replace(/\D/g, "");
  const chatId = `${cleanNumber}@c.us`;

  try {
    const client = getClient();

    if (client) {
      await client.sendMessage(chatId, messageContent);
      console.log(`✅ Mensagem enviada para ${whatsappNumber}: ${messageContent}`);
    } else {
      console.error("⚠️ Cliente WhatsApp ainda não inicializado.");
    }
  } catch (e) {
    console.error("❌ Erro ao enviar mensagem para WhatsApp:", e.message);
  }

  res.sendStatus(200);
});

// Rota simples pra teste
app.get("/", (req, res) => {
  res.send("🔥 Webhook do Chatwoot ativo!");
});

module.exports = app;
