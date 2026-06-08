// js/auth.js

const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:8000'
    : '';   // относительный путь — фронт и API на одном домене через ngrok

// Переменная для хранения токена в памяти (или localStorage)
const TOKEN_KEY = 'traffic_monitor_access_token';

export function getToken() {
    return localStorage.getItem(TOKEN_KEY);
}

export function isLoggedIn() {
    return !!getToken();
}

export function logout() {
    localStorage.removeItem(TOKEN_KEY);
    updateAuthUI();
    alert("Вы вышли из системы");
}

// Вспомогательная функция для заголовков запроса
export function getAuthHeaders() {
    const token = getToken();
    const headers = {
        'Content-Type': 'application/json'
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
}

// Функция обновления UI (кнопки войти/выйти)
function updateAuthUI() {
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');

    if (isLoggedIn()) {
        if (loginBtn) loginBtn.style.display = 'none';
        if (logoutBtn) logoutBtn.style.display = 'inline-block';
    } else {
        if (loginBtn) loginBtn.style.display = 'inline-block';
        if (logoutBtn) logoutBtn.style.display = 'none';
    }
}

// Логика модального окна и формы
document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById("authModal");
    const btn = document.getElementById("loginBtn");
    const logoutBtn = document.getElementById("logoutBtn");
    const span = document.getElementsByClassName("close-modal")[0];
    const form = document.getElementById("loginForm");
    const errorMsg = document.getElementById("loginError");

    updateAuthUI();

    if (btn) {
        btn.onclick = function () {
            modal.style.display = "block";
            errorMsg.style.display = "none";
        };
    }

    if (logoutBtn) {
        logoutBtn.onclick = logout;
    }

    if (span) {
        span.onclick = function () {
            modal.style.display = "none";
        };
    }

    window.onclick = function (event) {
        if (event.target == modal) {
            modal.style.display = "none";
        }
    };

    // Простой fetch — CORS не нужен, фронт и API на одном домене
    function authFetch(url, options = {}) {
        return fetch(url, options);
    }

    if (form) {
        form.onsubmit = async function (e) {
            e.preventDefault();
            const submitBtn = form.querySelector('button[type="submit"]');
            errorMsg.style.display = 'none';
            if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Вход...'; }

            const formData = new FormData(form);

            // 2 попытки с задержкой — защита от случайного таймаута
            let lastError = null;
            for (let attempt = 1; attempt <= 2; attempt++) {
                try {
                    const response = await authFetch(`${API_BASE}/token`, {
                        method: 'POST',
                        body: formData
                    });

                    if (response.ok) {
                        const data = await response.json();
                        localStorage.setItem(TOKEN_KEY, data.access_token);
                        modal.style.display = 'none';
                        form.reset();
                        updateAuthUI();
                        console.log('✅ Успешный вход!');
                        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Войти в систему'; }
                        return;
                    } else {
                        // HTTP ошибка (401) — повторять не нужно
                        errorMsg.style.display = 'block';
                        errorMsg.textContent = 'Ошибка входа. Проверьте данные.';
                        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Войти в систему'; }
                        return;
                    }
                } catch (error) {
                    lastError = error;
                    console.warn(`Попытка ${attempt} не удалась:`, error);
                    if (attempt < 2) await new Promise(r => setTimeout(r, 1500));
                }
            }

            // Обе попытки провалились
            console.error('Login error:', lastError);
            errorMsg.style.display = 'block';
            errorMsg.textContent = 'Ошибка соединения. Повторите попытку.';
            if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Войти в систему'; }
        };
    }
});
