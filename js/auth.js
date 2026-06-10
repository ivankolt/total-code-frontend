// js/auth.js
// Токен теперь хранится в httpOnly cookie (устанавливается сервером).
// JavaScript НЕ имеет доступа к токену — это и есть защита от XSS.

const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:8000'
    : 'https://api.total-code.ru';

// Флаг авторизации хранится только в памяти (сессионно)
let _loggedIn = false;

export function isLoggedIn() {
    return _loggedIn;
}

// getToken() - оставлен для совместимости (cookie автоматически отправляется браузером)
export function getToken() {
    return null; // Токен хранится в httpOnly cookie, JS не имеет к нему доступа
}

export async function logout() {
    try {
        // Просим сервер удалить httpOnly cookie
        await fetch(`${API_BASE}/logout`, {
            method: 'POST',
            credentials: 'include'   // Обязательно для отправки cookie
        });
    } catch (e) {
        console.warn('Logout request failed:', e);
    }
    _loggedIn = false;
    updateAuthUI();
    alert("Вы вышли из системы");
}

// Заголовки запроса — Authorization больше не нужен,
// cookie отправляется браузером автоматически
export function getAuthHeaders() {
    return { 'Content-Type': 'application/json' };
}

// Все запросы к API — с credentials: 'include'
// чтобы браузер автоматически отправлял httpOnly cookie
export function apiFetch(url, options = {}) {
    return fetch(url, {
        ...options,
        credentials: 'include',
        headers: {
            ...getAuthHeaders(),
            ...(options.headers || {})
        }
    });
}

// Проверяем авторизацию при загрузке страницы через /api/me
async function checkAuth() {
    try {
        const res = await fetch(`${API_BASE}/api/me`, {
            credentials: 'include'
        });
        _loggedIn = res.ok;
    } catch {
        _loggedIn = false;
    }
    updateAuthUI();
}

function updateAuthUI() {
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');

    if (_loggedIn) {
        if (loginBtn) loginBtn.style.display = 'none';
        if (logoutBtn) logoutBtn.style.display = 'inline-block';
    } else {
        if (loginBtn) loginBtn.style.display = 'inline-block';
        if (logoutBtn) logoutBtn.style.display = 'none';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById("authModal");
    const btn = document.getElementById("loginBtn");
    const logoutBtn = document.getElementById("logoutBtn");
    const span = document.getElementsByClassName("close-modal")[0];
    const form = document.getElementById("loginForm");
    const errorMsg = document.getElementById("loginError");

    // Проверяем состояние авторизации по cookie
    checkAuth();

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

    if (form) {
        form.onsubmit = async function (e) {
            e.preventDefault();
            const submitBtn = form.querySelector('button[type="submit"]');
            errorMsg.style.display = 'none';
            if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Вход...'; }

            const formData = new FormData(form);

            let lastError = null;
            for (let attempt = 1; attempt <= 2; attempt++) {
                try {
                    const response = await fetch(`${API_BASE}/token`, {
                        method: 'POST',
                        body: formData,
                        credentials: 'include'  // Сервер установит httpOnly cookie
                    });

                    if (response.ok) {
                        // Токен сохранён в httpOnly cookie сервером автоматически
                        _loggedIn = true;
                        modal.style.display = 'none';
                        form.reset();
                        updateAuthUI();
                        console.log('✅ Успешный вход! Токен сохранён в httpOnly cookie.');
                        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Войти в систему'; }
                        return;
                    } else {
                        errorMsg.style.display = 'block';
                        errorMsg.textContent = response.status === 429
                            ? 'Слишком много попыток. Подождите минуту.'
                            : 'Ошибка входа. Проверьте данные.';
                        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Войти в систему'; }
                        return;
                    }
                } catch (error) {
                    lastError = error;
                    console.warn(`Попытка ${attempt} не удалась:`, error);
                    if (attempt < 2) await new Promise(r => setTimeout(r, 1500));
                }
            }

            console.error('Login error:', lastError);
            errorMsg.style.display = 'block';
            errorMsg.textContent = 'Ошибка соединения. Повторите попытку.';
            if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Войти в систему'; }
        };
    }
});
