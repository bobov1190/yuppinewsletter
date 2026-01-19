import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Вебхук оставляем, так как это твой эндпоинт для связи с n8n
const N8N_WEBHOOK_URL = 'https://n8n.vsellm.ru/webhook/a919449d-ba2d-419e-84d3-df503d4764ae';

let auth;
// Promise that resolves once Firebase init finished (so pages can wait)
let firebaseReadyResolve;
const firebaseReady = new Promise((resolve) => { firebaseReadyResolve = resolve; });

// Динамическая инициализация Firebase без хардкода ключей
async function initFirebase() {
    try {
        // Запрашиваем конфиг у самого Firebase Hosting
        const response = await fetch('/__/firebase/init.json');
        const config = await response.json();

        const app = initializeApp(config);
        auth = getAuth(app);
        console.log("Firebase initialized securely");
        firebaseReadyResolve(true);
    } catch (e) {
        console.error("Failed to load Firebase config. Are you running on Firebase Hosting?", e);
        if (firebaseReadyResolve) firebaseReadyResolve(false);
    }
}

// Запускаем инициализацию
initFirebase();

const mainBtn = document.getElementById('main-btn');
const toggleBtn = document.getElementById('toggle-form');
const msg = document.getElementById('message');
const usernameGroup = document.getElementById('name-group');
const usernameInput = document.getElementById('username');
const formTitle = document.getElementById('form-title');
const signOutBtn = document.getElementById('sign-out');

let isLogin = false;

// Only wire up the signup/login UI if those elements exist (prevents errors on welcome page)
if (toggleBtn) {
    toggleBtn.onclick = () => {
        isLogin = !isLogin;
        if (usernameGroup) {
            isLogin ? usernameGroup.classList.add('hidden') : usernameGroup.classList.remove('hidden');
        }
        if (formTitle) formTitle.innerText = isLogin ? "Welcome Back!" : "Sign Up";
        if (mainBtn) mainBtn.innerText = isLogin ? "Log In" : "Sign Up";
        toggleBtn.innerText = isLogin ? "Don't have an account? Sign Up" : "Already have an account? Log In";
    };
}

if (mainBtn) {
    mainBtn.onclick = async () => {
        if (!auth) {
            if (msg) {
                msg.innerText = "Auth system is not ready. Please refresh.";
            }
            return;
        }

        const emailEl = document.getElementById('email');
        const passwordEl = document.getElementById('password');
        const email = emailEl ? emailEl.value : '';
        const password = passwordEl ? passwordEl.value : '';
        const username = usernameInput ? usernameInput.value : "";

        if (!email || !password) {
            if (msg) {
                msg.innerText = "Please fill in all fields";
                msg.style.color = "red";
            }
            return;
        }

        if (msg) {
            msg.innerText = "Loading...";
            msg.style.color = "#444";
        }

        try {
            if (isLogin) {
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                if (!userCredential.user.emailVerified) {
                    await sendEmailVerification(userCredential.user);
                    if (msg) {
                        msg.innerText = "Please verify your email first. A verification message was sent.";
                        msg.style.color = "red";
                    }
                    await signOut(auth);
                    return;
                }
                await sendToN8n({ type: 'login', uid: userCredential.user.uid, email: userCredential.user.email });
                window.location.href = '/sources/pages/welcome.html';
            } else {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                await sendEmailVerification(userCredential.user);
                await sendToN8n({ type: 'register', uid: userCredential.user.uid, email: userCredential.user.email, name: username });
                if (msg) {
                    msg.innerText = "Success! Verification email sent — please check your inbox.";
                    msg.style.color = "green";
                }
            }
        } catch (error) {
            if (msg) {
                msg.innerText = "Error: " + error.message;
                msg.style.color = "red";
            }
        }
    };
}

async function sendToN8n(payload) {
    try {
        await fetch(N8N_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    } catch (err) {
        console.warn("n8n sync failed:", err);
    }
}

if (signOutBtn) {
    signOutBtn.onclick = async () => {
        try {
            await firebaseReady;
            if (!auth) {
                console.error('Auth not initialized; redirecting to home');
                window.location.href = '/index.html';
                return;
            }
            await signOut(auth);
            window.location.href = '/index.html';
        } catch (err) {
            console.error("Logout failed", err);
        }
    };
}