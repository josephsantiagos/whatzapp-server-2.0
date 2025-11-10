// firebaseConfig.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyAzPS2txA2Bfk8A9tNxCYuGUZb-TLjJP2E",
  authDomain: "app-igreja-c97f2.firebaseapp.com",
  projectId: "app-igreja-c97f2",
  storageBucket: "app-igreja-c97f2.firebasestorage.app",
  messagingSenderId: "872830746247",
  appId: "1:872830746247:web:de9e0fb5688af2e0240222",
  measurementId: "G-JM9CTL6ZGS"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
const analytics = getAnalytics(app);

export { db, storage, analytics, app };
