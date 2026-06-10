// js/prediction.js
const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:8000'
    : 'https://api.total-code.ru';

export function initPrediction() {
    const btn = document.getElementById('getAiPredictionBtn');
    const cameraSelector = document.getElementById('cameraSelector');
    const timeLabel = document.getElementById('predictionTimeLabel');

    if (!btn) return;

    function updateTimeLabel() {
        if (!timeLabel) return;
        const future = getFutureEkbTime(30);
        const hh = String(future.hour).padStart(2, '0');
        const mm = String(future.minute).padStart(2, '0');
        // "\u0427\u0435\u0440\u0435\u0437 30 \u043c\u0438\u043d" = "Через 30 мин"
        timeLabel.textContent = '\u0427\u0435\u0440\u0435\u0437 30 \u043c\u0438\u043d > ' + hh + ':' + mm;
    }

    updateTimeLabel();
    setInterval(updateTimeLabel, 60000);

    btn.addEventListener('click', async () => {
        const camId = cameraSelector.value;

        if (camId === 'all') {
            // "\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u043a\u043e\u043d\u043a\u0440\u0435\u0442\u043d\u0443\u044e \u043a\u0430\u043c\u0435\u0440\u0443 \u0434\u043b\u044f AI-\u043f\u0440\u043e\u0433\u043d\u043e\u0437\u0430"
            alert('\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u043a\u043e\u043d\u043a\u0440\u0435\u0442\u043d\u0443\u044e \u043a\u0430\u043c\u0435\u0440\u0443 \u0434\u043b\u044f AI-\u043f\u0440\u043e\u0433\u043d\u043e\u0437\u0430');
            return;
        }

        const future = getFutureEkbTime(30);

        try {
            const response = await window.apiFetch(
                `${API_BASE}/api/predict?camera_id=${camId}&day=${future.day}&hour=${future.hour}&minute=${future.minute}`
            );
            const data = await response.json();

            document.getElementById('aiResult').style.display = 'block';
            document.getElementById('aiCars').innerText = data.predicted_cars;
            // "\u043a\u043c/\u0447" = "км/ч"
            document.getElementById('aiSpeed').innerText = data.predicted_speed + ' \u043a\u043c/\u0447';

            document.getElementById('aiCars').style.color = data.predicted_cars > 100 ? '#ff5252' : '#4caf50';

        } catch (error) {
            console.error('\u041e\u0448\u0438\u0431\u043a\u0430:', error);
        }
    });
}

function getFutureEkbTime(offsetMinutes) {
    if (offsetMinutes === undefined) offsetMinutes = 0;
    const now = new Date();
    const ekbMs = now.getTime() + (now.getTimezoneOffset() * 60000) + (3600000 * 5)
                  + (offsetMinutes * 60000);
    const ekbDate = new Date(ekbMs);
    let jsDay = ekbDate.getDay();
    let pyDay = (jsDay === 0) ? 6 : jsDay - 1;
    return {
        hour: ekbDate.getHours(),
        minute: ekbDate.getMinutes(),
        day: pyDay
    };
}