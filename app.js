import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// ТВОИ ДАННЫЕ ИЗ FIREBASE CONSOLE
const firebaseConfig = {
  apiKey: "AIzaSyDMltgfInB2YU1XQpU8CAS3oDUW6kJexIY",
  authDomain: "yuppinewsl.firebaseapp.com",
  projectId: "yuppinewsl",
  storageBucket: "yuppinewsl.firebasestorage.app",
  messagingSenderId: "124896063416",
  appId: "1:124896063416:web:be271e26b00efe08cce94d",
  measurementId: "G-K944TGJHDZ"
};


const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const mainBtn = document.getElementById('main-btn');
const toggleBtn = document.getElementById('toggle-form');
const msg = document.getElementById('message');

let isLogin = false;

// Переключение между Входом и Регистрацией
toggleBtn.onclick = () => {
    isLogin = !isLogin;
    document.getElementById('form-title').innerText = isLogin ? "Вход" : "Регистрация";
    document.getElementById('username').style.display = isLogin ? "none" : "block";
    mainBtn.innerText = isLogin ? "Войти" : "Создать аккаунт";
    toggleBtn.innerText = isLogin ? "Нет аккаунта? Регистрация" : "Уже есть аккаунт? Войти";
};

mainBtn.onclick = async () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const username = document.getElementById('username').value;

    try {
        if (isLogin) {
            // ВХОД
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            msg.innerText = "Успешный вход!";
            msg.style.color = "green";
        } else {
            // РЕГИСТРАЦИЯ в Firebase
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // ОТПРАВКА ДАННЫХ В n8n (чтобы сохранить в Neon)
            await fetch('https://n8n.vsellm.ru/webhook/a919449d-ba2d-419e-84d3-df503d4764ae', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    uid: user.uid,
                    email: user.email,
                    name: username
                })
            });

            msg.innerText = "Аккаунт создан и сохранен!";
            msg.style.color = "green";
        }
    } catch (error) {
        msg.innerText = "Ошибка: " + error.message;
        msg.style.color = "red";
    }
};