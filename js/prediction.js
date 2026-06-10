// js/prediction.js
const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:8000'
    : 'https://api.total-code.ru';

export function initPrediction() {
    const btn = document.getElementById('getAiPredictionBtn');
    const cameraSelector = document.getElementById('cameraSelector');
    const timeLabel = document.getElementById('predictionTimeLabel');

    if (!btn) return;

    // Обновляем метку времени при вызове функции
    function updateTimeLabel() {
        if (!timeLabel) return;
        const future = getFutureEkbTime(30); // прогноз на +30 минут
        const hh = String(future.hour).padStart(2, '0');
        const mm = String(future.minute).padStart(2, '0');
        timeLabel.textContent = `Через 30 мин > ${hh}:${mm}`;
    }

    updateTimeLabel();
    setInterval(updateTimeLabel, 60_000);

    btn.addEventListener('click', async () => {
        const camId = cameraSelector.value;

        if (camId === 'all') {
            alert('Выберите конкретную камеру для AI-прогноза');
            return;
        }

        // Прогнозируем на +30 минут вперёд
        const future = getFutureEkbTime(30);

        try {
            const response = await window.apiFetch(
                `${API_BASE}/api/predict?camera_id=${camId}&day=${future.day}&hour=${future.hour}&minute=${future.minute}`
            );
            const data = await response.json();

            document.getElementById('aiResult').style.display = 'block';
            document.getElementById('aiCars').innerText = data.predicted_cars;
            document.getElementById('aiSpeed').innerText = data.predicted_speed + ' км/ч';

            document.getElementById('aiCars').style.color = data.predicted_cars > 100 ? '#ff5252' : '#4caf50';

        } catch (error) {
            console.error('Ошибка прогноза:', error);
        }
    });
}

/** Текущее время Екб (UTC+5) + offsetMinutes минут вперёд */
function getFutureEkbTime(offsetMinutes = 0) {
    const now = new Date();
    // Переводим в UTC+5 с учётом смещения браузера
    const ekbMs = now.getTime() + (now.getTimezoneOffset() * 60000) + (3600000 * 5)
                  + (offsetMinutes * 60000);
    const ekbDate = new Date(ekbMs);

    let jsDay = ekbDate.getDay();
    let pyDay = (jsDay === 0) ? 6 : jsDay - 1; // Пн=0, Вс=6

    return {
        hour: ekbDate.getHours(),
        minute: ekbDate.getMinutes(),
        day: pyDay
    };
}
