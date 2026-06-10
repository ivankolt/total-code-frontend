// js/prediction.js
const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:8000'
    : window.location.origin;

export function initPrediction() {
    const btn = document.getElementById('getAiPredictionBtn');
    const cameraSelector = document.getElementById('cameraSelector');
    const timeLabel = document.getElementById('predictionTimeLabel');

    if (!btn) return;

    // ��������� ����� ������� ����� � ������ ������
    function updateTimeLabel() {
        if (!timeLabel) return;
        const future = getFutureEkbTime(30); // ������� �� +30 �����
        const hh = String(future.hour).padStart(2, '0');
        const mm = String(future.minute).padStart(2, '0');
        timeLabel.textContent = `����� 30 ��� > ${hh}:${mm}`;
    }

    updateTimeLabel();
    setInterval(updateTimeLabel, 60_000);

    btn.addEventListener('click', async () => {
        const camId = cameraSelector.value;

        if (camId === 'all') {
            alert('������� �������� ����������� �� ����� ��� � ������');
            return;
        }

        // ������������ �� +30 ����� �����
        const future = getFutureEkbTime(30);

        try {
            const response = await window.apiFetch(
                `${API_BASE}/api/predict?camera_id=${camId}&day=${future.day}&hour=${future.hour}&minute=${future.minute}`
            );
            const data = await response.json();

            document.getElementById('aiResult').style.display = 'block';
            document.getElementById('aiCars').innerText = data.predicted_cars;
            document.getElementById('aiSpeed').innerText = data.predicted_speed + ' ��/�';

            document.getElementById('aiCars').style.color = data.predicted_cars > 100 ? '#ff5252' : '#4caf50';

        } catch (error) {
            console.error('������:', error);
        }
    });
}

/** ������� ����� ��� (UTC+5) + offsetMinutes ����� ����� */
function getFutureEkbTime(offsetMinutes = 0) {
    const now = new Date();
    // ��������� � UTC+5 � ��������� ��������
    const ekbMs = now.getTime() + (now.getTimezoneOffset() * 60000) + (3600000 * 5)
                  + (offsetMinutes * 60000);
    const ekbDate = new Date(ekbMs);

    let jsDay = ekbDate.getDay();
    let pyDay = (jsDay === 0) ? 6 : jsDay - 1; // ��=0, ��=6

    return {
        hour: ekbDate.getHours(),
        minute: ekbDate.getMinutes(),
        day: pyDay
    };
}
