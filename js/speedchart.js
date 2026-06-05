// speedchart.js
const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? 'http://localhost:8000' : 'https://e2a637d0012efe.lhr.life';

let chart;
const directions = ['С', 'Ю', 'З', 'В'];
const colors = ['#FF0000', '#0000FF', '#00AA00', '#FFA500'];

const timePoints = [];
const speedSeries = [[], [], [], []];

function initChart() {
    const canvas = document.getElementById('speedChart');
    if (!canvas) {
        console.error('speedChart canvas not found');
        return;
    }

    const ctx = canvas.getContext('2d');
    chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: timePoints,
            datasets: directions.map((dir, i) => ({
                label: dir,
                data: speedSeries[i],
                borderColor: colors[i],
                borderWidth: 2,
                pointRadius: 0,
                fill: false,
                tension: 0.1
            }))
        },
        options: {
            responsive: true,
            animation: false,
            scales: {
                x: {
                    title: { display: true, text: 'Время' },
                    ticks: { maxTicksLimit: 6 }
                },
                y: {
                    title: { display: true, text: 'Скорость (км/ч)' },
                    min: 0
                }
            },
            plugins: {
                legend: { display: true }
            }
        }
    });
}

async function updateChart() {
    if (!chart) return;

    try {
        const camId = window.currentCameraId || 'all';
        const resp = await fetch(`${API_BASE}/api/speed-by-direction?camera_id=${window.currentCameraId}`, {
            headers: { 'ngrok-skip-browser-warning': 'true' }
        });
        const data = await resp.json();

        const now = new Date();
        const label = now.toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

        timePoints.push(label);
        directions.forEach((dir, idx) => {
            const v = data.speeds?.[dir] ?? 0;
            speedSeries[idx].push(v);
        });

        if (timePoints.length > 60) {
            timePoints.shift();
            speedSeries.forEach(arr => arr.shift());
        }

        chart.update();
    } catch (e) {
        console.error('updateChart error:', e);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initChart();
    updateChart();
    setInterval(updateChart, 3000);
});
