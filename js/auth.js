import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { auth, db } from "./config.js";
import { initData } from "./db.js";

let sessionUnsubscribe;
let unsubscribe;

function initAuth() {
    onAuthStateChanged(auth, async (u) => {
        if (u) {
            document.getElementById('loginOverlay').style.display = 'none';
            document.getElementById('appContent').classList.remove('d-none');

            // Session Enforcement
            const localSessionId = localStorage.getItem('sessionId');
            if (!localSessionId) {
                // Should have been set during login, but if missing (e.g. clear cache), set a new one
                const newSessionId = Date.now().toString();
                localStorage.setItem('sessionId', newSessionId);
                await setDoc(doc(db, 'users', u.uid), { sessionId: newSessionId }, { merge: true });
            }

            // Listen for Session Changes
            if (sessionUnsubscribe) sessionUnsubscribe();
            sessionUnsubscribe = onSnapshot(doc(db, 'users', u.uid), (docSnap) => {
                if (docSnap.exists()) {
                    const dbSessionId = docSnap.data().sessionId;
                    const currentSessionId = localStorage.getItem('sessionId');
                    if (dbSessionId && dbSessionId !== currentSessionId) {
                        // Session Mismatch -> Logout
                        signOut(auth);
                        alert("Akun anda telah login di perangkat lain. Anda telah logout.");
                    }
                }
            });

            initData();
        } else {
            document.getElementById('loginOverlay').style.display = 'flex';
            document.getElementById('appContent').classList.add('d-none');
            // Note: unsubscribe for data is handled in db.js, but we might want to expose a cleanup function there
            if (sessionUnsubscribe) sessionUnsubscribe();
        }
    });
}

async function login(email, password) {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        // Set Session ID on Login
        const sessionId = Date.now().toString();
        localStorage.setItem('sessionId', sessionId);
        await setDoc(doc(db, 'users', userCredential.user.uid), { sessionId: sessionId }, { merge: true });
    } catch (e) {
        throw e;
    }
}

function logout() {
    if (confirm('Logout?')) signOut(auth);
}

export { initAuth, login, logout };
