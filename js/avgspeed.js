const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? 'http://localhost:8000' : 'https://c4a33ee3752b46.lhr.life';

let avgSpeedElement;
let liveCarsElement;

function initAvgSpeed() {
    avgSpeedElement = document.getElementById('avgSpeed');
    liveCarsElement = document.getElementById('liveCarsCount');
    if (!avgSpeedElement) {
        console.error('avgSpeed element not found');
    }
}

async function updateAvgSpeed() {
    if (!avgSpeedElement) return;

    const camParam = window.currentCameraId || 'all';

    try {
        // Запрашиваем скорость и кол-во машин параллельно
        const [speedResp, statusResp] = await Promise.all([
            fetch(`${API_BASE}/api/speed-by-direction?camera_id=${camParam}`, {
                headers: { 'ngrok-skip-browser-warning': 'true' }
            }),
            fetch(`${API_BASE}/api/traffic-status?camera_id=${camParam}`, {
                headers: { 'ngrok-skip-browser-warning': 'true' }
            })
        ]);

        const speedData = await speedResp.json();
        const statusData = await statusResp.json();

        // --- Средняя скорость ---
        const directions = ['С', 'Ю', 'З', 'В'];
        let totalSpeed = 0;
        let validDirections = 0;

        directions.forEach(dir => {
            const speed = speedData.speeds?.[dir] ?? 0;
            if (speed > 0) {
                totalSpeed += speed;
                validDirections++;
            }
        });

        const avgSpeed = validDirections > 0 ? totalSpeed / validDirections : 0;
        avgSpeedElement.textContent = Math.round(avgSpeed);

        if (avgSpeed < 15) {
            avgSpeedElement.style.color = '#ff4444';
        } else if (avgSpeed < 30) {
            avgSpeedElement.style.color = '#ffaa00';
        } else {
            avgSpeedElement.style.color = '#00ff00';
        }

        // --- Кол-во машин ---
        if (liveCarsElement && statusData.total_cars !== undefined) {
            liveCarsElement.textContent = statusData.total_cars;
        }

    } catch (e) {
        console.error('updateAvgSpeed error:', e);
        avgSpeedElement.textContent = '--';
        avgSpeedElement.style.color = '#888';
        if (liveCarsElement) liveCarsElement.textContent = '--';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initAvgSpeed();
    updateAvgSpeed();
    setInterval(updateAvgSpeed, 3001);
});
