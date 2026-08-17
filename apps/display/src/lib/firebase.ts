import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyDPoogZrY20wvrN8ejssfAbHvpCzAIm57Y",
  authDomain: "realtime-db-b2264.firebaseapp.com",
  databaseURL: "https://realtime-db-b2264-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "realtime-db-b2264",
  storageBucket: "realtime-db-b2264.firebasestorage.app",
  messagingSenderId: "80707107460",
  appId: "1:80707107460:web:78d890ed3677b7893f20d1"
};

const app = initializeApp(firebaseConfig);
export const rtdb = getDatabase(app);
