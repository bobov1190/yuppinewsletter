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

// 2. ТВОЙ PRODUCTION URL ИЗ n8n (без слова -test)
const N8N_WEBHOOK_URL = 'https://n8n.vsellm.ru/webhook/a919449d-ba2d-419e-84d3-df503d4764ae';

// Инициализация
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Элементы интерфейса
const mainBtn = document.getElementById('main-btn');
const toggleBtn = document.getElementById('toggle-form');
const msg = document.getElementById('message');
const usernameInput = document.getElementById('username');
const formTitle = document.getElementById('form-title');

let isLogin = false; // Переключатель режима

// Переключение между Входом и Регистрацией
toggleBtn.onclick = () => {
    isLogin = !isLogin;
    formTitle.innerText = isLogin ? "Вход" : "Регистрация";
    usernameInput.style.display = isLogin ? "none" : "block"; // Скрываем имя при входе
    mainBtn.innerText = isLogin ? "Войти" : "Создать аккаунт";
    toggleBtn.innerText = isLogin ? "Нет аккаунта? Регистрация" : "Уже есть аккаунт? Войти";
    msg.innerText = ""; 
};

// Главная функция кнопки
mainBtn.onclick = async () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const username = usernameInput.value;

    if (!email || !password) {
        msg.innerText = "Заполните почту и пароль";
        msg.style.color = "red";
        return;
    }

    msg.innerText = "Обработка...";
    msg.style.color = "blue";

    try {
        if (isLogin) {
            // --- ЛОГИКА ВХОДА ---
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Отправляем сигнал о входе в n8n
            await sendToN8n({
                type: 'login',
                uid: user.uid,
                email: user.email
            });

            msg.innerText = "Успешный вход! С возвращением.";
            msg.style.color = "green";

            // ПЕРЕКИДЫВАЕМ ЮЗЕРА
            window.location.href = 'welcome.html';

        } else {
            // --- ЛОГИКА РЕГИСТРАЦИИ ---
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Отправляем полные данные для создания записи в Neon
            await sendToN8n({
                type: 'register',
                uid: user.uid,
                email: user.email,
                name: username
            });

            msg.innerText = "Аккаунт успешно создан и сохранен!";
            msg.style.color = "green";
        }
    } catch (error) {
        console.error(error);
        msg.style.color = "red";
        // Понятные ошибки для пользователя
        if (error.code === 'auth/user-not-found') msg.innerText = "Пользователь не найден";
        else if (error.code === 'auth/wrong-password') msg.innerText = "Неверный пароль";
        else if (error.code === 'auth/email-already-in-use') msg.innerText = "Этот Email уже занят";
        else msg.innerText = "Ошибка: " + error.message;
    }
};

// Функция отправки данных в n8n
async function sendToN8n(payload) {
    try {
        const response = await fetch(N8N_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error('Ошибка n8n');
        return true;
    } catch (err) {
        console.warn("n8n недоступен, но в Firebase всё ок:", err);
    }
}