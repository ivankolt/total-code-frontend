// api.js — отвечает за работу с сервером (fetch)
// Автоматически определяет URL: локально или продакшн
const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:8000'
    : 'https://c4a33ee3752b46.lhr.life';


export async function fetchCarData() {
    const camId = window.currentCameraId || 'all';
    const apiUrl = `${API_BASE}/api/cars?camera_id=${camId}`;
    const response = await fetch(apiUrl);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
}

export async function triggerVoiceAlert() {
    try {
        const response = await fetch(`${API_BASE}/api/voice-alert`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        if (!response.ok) throw new Error('Network response was not ok');
        return await response.json();
    } catch (error) {
        console.error('Error triggering voice alert:', error);
        return null;
    }
}
