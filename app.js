import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyDMltgfInB2YU1XQpU8CAS3oDUW6kJexIY",
    authDomain: "yuppinewsl.firebaseapp.com",
    projectId: "yuppinewsl",
    storageBucket: "yuppinewsl.firebasestorage.app",
    messagingSenderId: "124896063416",
    appId: "1:124896063416:web:be271e26b00efe08cce94d"
};

const N8N_WEBHOOK_URL = 'https://n8n.vsellm.ru/webhook/a919449d-ba2d-419e-84d3-df503d4764ae';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const mainBtn = document.getElementById('main-btn');
const toggleBtn = document.getElementById('toggle-form');
const msg = document.getElementById('message');
const usernameGroup = document.getElementById('name-group');
const usernameInput = document.getElementById('username'); // ИСПРАВЛЕНО: было 'name'
const formTitle = document.getElementById('form-title');

let isLogin = false;

toggleBtn.onclick = () => {
    isLogin = !isLogin;
    isLogin ? usernameGroup.classList.add('hidden') : usernameGroup.classList.remove('hidden');
    formTitle.innerText = isLogin ? "Welcome Back!" : "Sign Up";
    mainBtn.innerText = isLogin ? "Log In" : "Sign Up";
    toggleBtn.innerText = isLogin ? "Don't have an account? Sign Up" : "Already have an account? Log In";
};

mainBtn.onclick = async () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const username = usernameInput ? usernameInput.value : ""; // Безопасное получение

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
            await sendToN8n({ type: 'login', uid: userCredential.user.uid, email: userCredential.user.email });
            window.location.href = 'welcome.html';
        } else {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            await sendToN8n({ type: 'register', uid: userCredential.user.uid, email: userCredential.user.email, name: username });
            msg.innerText = "Success! Now you can Log In.";
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