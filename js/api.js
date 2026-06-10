// api.js — запросы к бэкенду
const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:8000'
    : 'https://api.total-code.ru';  // ← постоянный домен через VPS

//     
window.API_BASE = API_BASE;

//  fetch — всегда отправляем cookie для авторизации
window.apiFetch = function(url, options = {}) {
    return fetch(url, {
        ...options,
        credentials: 'include'  // ← обязательно для httpOnly JWT cookie
    });
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
