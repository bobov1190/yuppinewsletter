import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification, signOut, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, updateProfile } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Вебхук оставляем, так как это твой эндпоинт для связи с n8n
const N8N_WEBHOOK_URL = 'https://n8n.vsellm.ru/webhook/a919449d-ba2d-419e-84d3-df503d4764ae';

let auth;
let db;
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
        try {
            db = getFirestore(app);
            console.log('Firestore initialized');
        } catch (e) {
            console.warn('Firestore not available or initialization failed', e);
        }
        console.log("Firebase initialized securely");
        firebaseReadyResolve(true);
    } catch (e) {
        console.error("Failed to load Firebase config. Are you running on Firebase Hosting?", e);
        if (firebaseReadyResolve) firebaseReadyResolve(false);
    }
}

// Запускаем инициализацию
initFirebase();

// After Firebase is ready, check if a redirect sign-in just occurred
firebaseReady.then(async (ready) => {
    if (!ready) return;
    try {
        if (!auth) return;
        const redirectResult = await getRedirectResult(auth);
        if (redirectResult && redirectResult.user) {
            console.log('Handled redirect sign-in result');
            try {
                const regResp = await saveUserProfile(redirectResult.user, 'register', 'google');
                console.log('Redirect flow: register result', regResp);
                
                const loginResp = await saveUserProfile(redirectResult.user, 'login', 'google');
                console.log('Redirect flow: login result', loginResp);
            } catch (err) {
                console.warn('Redirect flow sequence failed, falling back to redirect', err);
            }
            console.log('Fallback: saving redirect user to localStorage:', redirectResult.user.email, redirectResult.user.displayName);
            localStorage.setItem('userEmail', redirectResult.user.email || '');
            localStorage.setItem('userName', redirectResult.user.displayName || '');
            console.log('localStorage saved, redirecting to welcome');
            setTimeout(() => {
                window.location.href = '/sources/pages/welcome.html';
            }, 100);
        }
    } catch (err) {
        // No redirect result or an error — not fatal
        console.debug('No redirect result or error', err && err.code ? err.code : err);
    }
});

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
                        msg.innerText = "Please check your email to verify your account before logging in.";
                        msg.style.color = "red";
                    }
                    await signOut(auth);
                    return;
                }
                console.log('Email/password login: calling saveUserProfile');
                const loginResp = await saveUserProfile(userCredential.user, 'login');
                console.log('Email/password login: n8n response:', loginResp);
                
                // Check if response contains error
                if (loginResp && loginResp.raw && loginResp.raw.toLowerCase().includes('not found')) {
                    if (msg) {
                        msg.innerText = "User not found. Please register first.";
                        msg.style.color = "red";
                    }
                    await signOut(auth);
                    return;
                }
                
                // Save user info to localStorage before redirect
                const userName = (loginResp && loginResp.name) ? loginResp.name : (userCredential.user.displayName || 'User');
                console.log('Saving to localStorage:', userCredential.user.email, userName);
                localStorage.setItem('userEmail', userCredential.user.email || '');
                localStorage.setItem('userName', userName);
                console.log('localStorage saved, redirecting to welcome');
                setTimeout(() => {
                    window.location.href = '/sources/pages/welcome.html';
                }, 100);
            } else {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                
                // Update user displayName with the name from input
                if (username) {
                    await updateProfile(userCredential.user, {
                        displayName: username
                    });
                    console.log('Updated displayName:', username);
                }
                
                await sendEmailVerification(userCredential.user);
                console.log('Email/password signup: calling saveUserProfile');
                const registerResp = await saveUserProfile(userCredential.user, 'register');
                console.log('Email/password signup: n8n response:', registerResp);
                if (msg) {
                    msg.innerText = "Success! Please check your email to verify your account.";
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
        console.log('sendToN8n: sending to', N8N_WEBHOOK_URL);
        console.log('sendToN8n: payload:', JSON.stringify(payload, null, 2));
        const res = await fetch(N8N_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        console.log('sendToN8n: result status', res && res.status);
        if (res && res.ok) {
            try {
                const text = await res.text();
                console.log('sendToN8n: text response', text);
                
                // Try to extract name from response (format: "timestamp,name" or just response text)
                const parts = text.split(',');
                const response = {
                    raw: text,
                    timestamp: parts[0] ? parts[0].trim() : null,
                    name: parts[1] ? parts[1].trim() : null
                };
                console.log('sendToN8n: parsed response', response);
                return response;
            } catch (e) {
                console.warn('sendToN8n: failed to get text response', e);
                return null;
            }
        }
        return null;
    } catch (err) {
        console.warn("n8n sync failed:", err);
        return null;
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

// Google sign-in / quick register
const googleBtn = document.getElementById('google-btn');
if (googleBtn) {
    googleBtn.onclick = async () => {
        console.log('Google button clicked');
        await firebaseReady;
        if (!auth) {
            if (msg) {
                msg.innerText = 'Auth not initialized. Try refreshing.';
                msg.style.color = 'red';
            }
            return;
        }

        const provider = new GoogleAuthProvider();
        try {
            console.log('Attempting signInWithPopup');
            if (msg) { msg.innerText = 'Opening Google sign-in...'; msg.style.color = '#444'; }
            const result = await signInWithPopup(auth, provider);
            console.log('signInWithPopup resolved', result && result.user && result.user.uid);
            const user = result.user;
            const isNew = result && result.additionalUserInfo && result.additionalUserInfo.isNewUser;
            // Always perform register then login sequentially for Google OAuth
            // (this ensures your n8n workflow runs the insert path first)
            try {
                console.log('Google flow: calling register');
                const regResp = await saveUserProfile(user, 'register', 'google');
                console.log('Google flow: register completed', regResp);
                
                console.log('Google flow: calling login');
                const loginResp = await saveUserProfile(user, 'login', 'google');
                console.log('Google flow: login completed', loginResp);
            } catch (err) {
                console.warn('Google flow sequence failed, error:', err);
            }
            // Save user info to localStorage before redirect
            console.log('Saving Google user to localStorage:', user.email, user.displayName);
            localStorage.setItem('userEmail', user.email || '');
            localStorage.setItem('userName', user.displayName || '');
            console.log('localStorage saved, redirecting to welcome');
            setTimeout(() => {
                // default redirect
                window.location.href = '/sources/pages/welcome.html';
            }, 100);
        } catch (err) {
            console.warn('Popup sign-in failed or was blocked; falling back to redirect', err && err.code ? err.code : err, err && err.message ? err.message : '');
            if (msg) { msg.innerText = 'Popup blocked or failed; using redirect fallback...'; msg.style.color = '#444'; }
            try {
                console.log('Calling signInWithRedirect');
                await signInWithRedirect(auth, provider);
                // signInWithRedirect will navigate away — getRedirectResult will handle completion after redirect
            } catch (rErr) {
                console.error('Google sign-in (redirect) failed', rErr && rErr.code ? rErr.code : rErr, rErr && rErr.message ? rErr.message : '');
                if (msg) {
                    msg.innerText = 'Google sign-in failed: ' + (rErr.message || rErr);
                    msg.style.color = 'red';
                }
            }
        }
    };
}

// Save user info to Firestore (if configured) and to n8n webhook
async function saveUserProfile(user, eventType = 'login', provider = null) {
    if (!user) return;
    console.log('saveUserProfile: start', user.uid, user.email, eventType);
    // If this is a new registration we generate a random password locally
    // and send a SHA-256 hash to the server. Storing plain passwords is NOT recommended;
    // prefer hashing on the server. We include both here only if you explicitly want it.
    async function sha256Hex(text) {
        const enc = new TextEncoder();
        const data = enc.encode(text);
        const hash = await crypto.subtle.digest('SHA-256', data);
        const bytes = new Uint8Array(hash);
        return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    function generateRandomPassword(len = 16) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=';
        const arr = new Uint32Array(len);
        crypto.getRandomValues(arr);
        return Array.from(arr).map(n => chars[n % chars.length]).join('');
    }

    let generatedPassword = null;
    const payload = {
        type: eventType,
        uid: user.uid,
        email: user.email || null,
        name: user.displayName || null,
        provider: provider || (user.providerData && user.providerData[0] && user.providerData[0].providerId) || null,
        timestamp: new Date().toISOString()
    };

    if (eventType === 'register') {
        try {
            const gen = generateRandomPassword(16);
            generatedPassword = gen;
            const hash = await sha256Hex(gen);
            // include generated password and its hash in payload
            payload.generatedPassword = gen; // optional: remove if you don't want plain password sent
            payload.passwordHash = hash;
            console.log('saveUserProfile: generated password for new user, sent hash');
        } catch (err) {
            console.warn('Failed to generate/hash password', err);
        }
    }

    let n8nResp = null;
    try {
        console.log('saveUserProfile: full payload before sending:', JSON.stringify(payload));
        n8nResp = await sendToN8n(payload);
        console.log('saveUserProfile: n8n notified', n8nResp);
    } catch (err) {
        console.warn('Failed to notify n8n about user', err);
    }

    console.log('saveUserProfile: about to check firestore, db exists:', !!db);
    if (db) {
        // Fire and forget - don't wait for Firestore, it's optional
        console.log('saveUserProfile: queueing firestore save in background');
        setDoc(doc(db, 'users', user.uid), {
            uid: user.uid,
            email: user.email || null,
            name: user.displayName || null,
            lastLogin: serverTimestamp()
        }, { merge: true }).then(() => {
            console.log('saveUserProfile: firestore updated (background)');
        }).catch((err) => {
            console.warn('Failed to save user profile to Firestore', err);
        });
    } else {
        console.log('saveUserProfile: db is not available, skipping firestore');
    }
    console.log('saveUserProfile: done', user.uid, 'returning:', n8nResp, 'truthy:', !!n8nResp);
    return n8nResp;
}