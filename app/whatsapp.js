require("dotenv").config();
const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode");
const sqlite3 = require("sqlite3").verbose();
const axios = require("axios");
const path = require("path");
const puppeteer = require("puppeteer");

let client = null;
let currentQR = null; // 🔹 Armazena o último QR gerado
let isReady = false;  // 🔹 Flag se WhatsApp já está conectado

// === Banco local ===
const dbPath = path.resolve(process.cwd(), "db", "contacts.db");
const db = new sqlite3.Database(dbPath);
db.run(`
  CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    number TEXT UNIQUE,
    contact_id TEXT,
    conversation_id TEXT
  )
`);

// === Envia mensagem recebida para o Chatwoot ===
async function sendMessageToChatwoot(contactId, conversationId, content) {
  try {
    await axios.post(
      `${process.env.CHATWOOT_URL}/api/v1/accounts/${process.env.CHATWOOT_ACCOUNT_ID}/conversations/${conversationId}/messages`,
      {
        content,
        message_type: "incoming",
        private: false,
      },
      {
        headers: {
          "Content-Type": "application/json",
          api_access_token: process.env.CHATWOOT_API_TOKEN,
        },
      }
    );
  } catch (e) {
    console.error("❌ Erro ao enviar mensagem para Chatwoot:", e.response?.data || e.message);
  }
}

// === Inicializa WhatsApp ===
async function startWhatsApp() {
  console.log("🚀 Iniciando cliente WhatsApp...");

  client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
      headless: true,
      executablePath: puppeteer.executablePath(),
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-extensions",
        "--disable-gpu",
      ],
    },
  });

  client.on("qr", async (qr) => {
    currentQR = await qrcode.toDataURL(qr); // 🔹 Gera QR como imagem base64
    isReady = false;
    console.log("📱 QR Code atualizado! Acesse http://localhost:3000/qrcode para escanear.");
  });

  client.on("ready", () => {
    isReady = true;
    currentQR = null; // Remove o QR quando estiver pronto
    console.log("✅ WhatsApp conectado e pronto!");
  });

  client.on("disconnected", (reason) => {
    console.error("⚠️ WhatsApp desconectado:", reason);
    isReady = false;
    console.log("🔄 Tentando reconectar em 5 segundos...");
    setTimeout(startWhatsApp, 5000);
  });

  // === Quando receber mensagem ===
  client.on("message", async (msg) => {
    try {
      const rawNumber = msg.from;
      const messageText = msg.body;
      let numberDigits = rawNumber.replace("@c.us", "").replace(/\D/g, "");

      // Força formato +55 se não tiver DDI
      if (!numberDigits.startsWith("55")) numberDigits = "55" + numberDigits;
      const numberE164 = `+${numberDigits}`;

      db.get("SELECT * FROM contacts WHERE number = ?", [numberE164], async (err, row) => {
        if (err) {
          console.error("Erro ao consultar banco:", err);
          return;
        }

        if (row) {
          await sendMessageToChatwoot(row.contact_id, row.conversation_id, messageText);
        } else {
          try {
            const contactRes = await axios.post(
              `${process.env.CHATWOOT_URL}/api/v1/accounts/${process.env.CHATWOOT_ACCOUNT_ID}/contacts`,
              {
                inbox_id: process.env.CHATWOOT_INBOX_ID,
                name: numberE164,
                identifier: numberE164,
                phone_number: numberE164,
                custom_attributes: { whatsapp: true },
              },
              {
                headers: {
                  "Content-Type": "application/json",
                  api_access_token: process.env.CHATWOOT_API_TOKEN,
                },
              }
            );

            const contact = contactRes.data.payload.contact;
            const convRes = await axios.post(
              `${process.env.CHATWOOT_URL}/api/v1/accounts/${process.env.CHATWOOT_ACCOUNT_ID}/conversations`,
              {
                source_id: numberE164,
                inbox_id: process.env.CHATWOOT_INBOX_ID,
                contact_id: contact.id,
              },
              {
                headers: {
                  "Content-Type": "application/json",
                  api_access_token: process.env.CHATWOOT_API_TOKEN,
                },
              }
            );

            const conversation = convRes.data;
            db.run(
              "INSERT INTO contacts (number, contact_id, conversation_id) VALUES (?, ?, ?)",
              [numberE164, contact.id, conversation.id],
              (errInsert) => {
                if (errInsert) console.error("Erro ao salvar contato:", errInsert);
              }
            );

            await sendMessageToChatwoot(contact.id, conversation.id, messageText);
          } catch (apiErr) {
            console.error("Erro ao criar contato/conversa:", apiErr.response?.data || apiErr.message);
          }
        }
      });
    } catch (err) {
      console.error("Erro ao processar mensagem:", err.message);
    }
  });

  try {
    await new Promise((r) => setTimeout(r, 2000));
    await client.initialize();
  } catch (err) {
    console.error("Erro ao iniciar cliente:", err.message);
    console.log("Reiniciando em 5 segundos...");
    setTimeout(startWhatsApp, 5000);
  }
}

function getQR() {
  return currentQR;
}

function getStatus() {
  return isReady;
}

module.exports = {
  startWhatsApp,
  getClient: () => client,
  getQR,
  getStatus,
};
