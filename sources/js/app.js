import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Вебхук оставляем, так как это твой эндпоинт для связи с n8n
const N8N_WEBHOOK_URL = 'https://n8n.vsellm.ru/webhook/a919449d-ba2d-419e-84d3-df503d4764ae';

let auth;

// Динамическая инициализация Firebase без хардкода ключей
async function initFirebase() {
    try {
        // Запрашиваем конфиг у самого Firebase Hosting
        const response = await fetch('/__/firebase/init.json');
        const config = await response.json();

        const app = initializeApp(config);
        auth = getAuth(app);
        console.log("Firebase initialized securely");
    } catch (e) {
        console.error("Failed to load Firebase config. Are you running on Firebase Hosting?", e);
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

toggleBtn.onclick = () => {
    isLogin = !isLogin;
    isLogin ? usernameGroup.classList.add('hidden') : usernameGroup.classList.remove('hidden');
    formTitle.innerText = isLogin ? "Welcome Back!" : "Sign Up";
    mainBtn.innerText = isLogin ? "Log In" : "Sign Up";
    toggleBtn.innerText = isLogin ? "Don't have an account? Sign Up" : "Already have an account? Log In";
};

mainBtn.onclick = async () => {
    if (!auth) {
        msg.innerText = "Auth system is not ready. Please refresh.";
        return;
    }

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const username = usernameInput ? usernameInput.value : "";

    if (!email || !password) {
        msg.innerText = "Please fill in all fields";
        msg.style.color = "red";
        return;
    }

    msg.innerText = "Loading...";
    msg.style.color = "#444";

    try {
        if (isLogin) {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            if (!userCredential.user.emailVerified) {
                await sendEmailVerification(userCredential.user);
                msg.innerText = "Please verify your email first. A verification message was sent.";
                msg.style.color = "red";
                await signOut(auth);
                return;
            }
            await sendToN8n({ type: 'login', uid: userCredential.user.uid, email: userCredential.user.email });
            window.location.href = 'welcome.html';
        } else {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            await sendEmailVerification(userCredential.user);
            await sendToN8n({ type: 'register', uid: userCredential.user.uid, email: userCredential.user.email, name: username });
            msg.innerText = "Success! Verification email sent — please check your inbox.";
            msg.style.color = "green";
        }
    } catch (error) {
        msg.innerText = "Error: " + error.message;
        msg.style.color = "red";
    }
};

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
            await signOut(auth);
            window.location.href = 'index.html';
        } catch (err) {
            console.error("Logout failed", err);
        }
    };
}