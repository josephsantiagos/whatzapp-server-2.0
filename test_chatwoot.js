require("dotenv").config();
const axios = require("axios");

(async () => {
  try {
    const res = await axios.get(
      `${process.env.CHATWOOT_URL}/api/v1/accounts/${process.env.CHATWOOT_ACCOUNT_ID}/inboxes`,
      {
        headers: {
          api_access_token: process.env.CHATWOOT_API_TOKEN,
        },
      }
    );
    console.log("✅ Conectado ao Chatwoot!");
    console.log(res.data);
  } catch (e) {
    console.error("❌ Erro ao conectar:", e.response?.data || e.message);
  }
})();
