// api.js — отвечает за работу с сервером (fetch)
// URL туннеля подставляется автоматически скриптом start.ps1
const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:8000'
    : 'https://79f72884a38bef.lhr.life';

// Глобальный доступ для всех модулей
window.API_BASE = API_BASE;

// Универсальный fetch
window.apiFetch = function(url, options = {}) {
    return fetch(url, options);
};

export async function fetchCarData() {
    const camId = window.currentCameraId || 'all';
    const apiUrl = `${API_BASE}/api/cars?camera_id=${camId}`;
    const response = await window.apiFetch(apiUrl);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
}

export async function triggerVoiceAlert() {
    try {
        const response = await window.apiFetch(`${API_BASE}/api/voice-alert`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        if (!response.ok) throw new Error('Network response was not ok');
        return await response.json();
    } catch (error) {
        console.error('Error triggering voice alert:', error);
        return null;
    }
}
