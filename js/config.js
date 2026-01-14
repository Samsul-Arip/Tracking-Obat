import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyA3DBA4TG4nQ7Ja_zAWKRwtUSGdtdwymNU",
    authDomain: "stokapotek.firebaseapp.com",
    projectId: "stokapotek",
    storageBucket: "stokapotek.firebasestorage.app",
    messagingSenderId: "723548234862",
    appId: "1:723548234862:web:8b8a8c734be0f8153e327f"
};

let app, auth, db;
try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
} catch (e) {
    console.error("Firebase Config Error", e);
}

const colName = "transaksi_obat";

export { auth, db, colName };
