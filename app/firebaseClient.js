// firebaseClient.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";

// copie exatamente o mesmo config que você tem no front
const firebaseConfig = {
  apiKey: "AIzaSyAzPS2txA2Bfk8A9tNxCYuGUZb-TLjJP2E",
  authDomain: "app-igreja-c97f2.firebaseapp.com",
  projectId: "app-igreja-c97f2",
  storageBucket: "app-igreja-c97f2.firebasestorage.app",
  messagingSenderId: "872830746247",
  appId: "1:872830746247:web:de9e0fb5688af2e0240222",
  measurementId: "G-JM9CTL6ZGS"
};

// inicializa o app Firebase normal
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// autentica o servidor com um usuário válido
// (crie esse usuário no Firebase Authentication)
async function connectFirebase() {
  try {
    await signInWithEmailAndPassword(auth, "admin@app.com", "senha-segura123");
    console.log("🔥 Conectado ao Firestore via FirebaseConfig!");
    return db;
  } catch (err) {
    console.error("Erro ao conectar Firebase:", err.message);
  }
}

export { connectFirebase };
