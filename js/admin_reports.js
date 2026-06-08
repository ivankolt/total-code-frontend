import { getToken, isLoggedIn } from './auth.js';

const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? 'http://localhost:8000' : 'https://bfylh-77-222-99-129.run.pinggy-free.link';

let cpuChart = null;
let metricsInterval = null;

document.addEventListener('DOMContentLoaded', () => {
    const reportBtn   = document.getElementById('reportBtn');
    const modal       = document.getElementById('reportModal');
    const closeBtn    = document.querySelector('.close-report');

    // Дефолтные даты
    const now       = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const fmt = d => d.toISOString().slice(0, 16);

    // Устанавливаем даты на все поля
    ['dateFrom', 'dateTo', 'dateFromLogs', 'dateToLogs'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.value = id.startsWith('dateTo') ? fmt(now) : fmt(yesterday);
    });

    // Показ/скрытие кнопки отчётов
    setInterval(() => {
        if (reportBtn) reportBtn.style.display = isLoggedIn() ? 'inline-block' : 'none';
    }, 1000);

    // Открытие модального окна
    if (reportBtn) {
        reportBtn.addEventListener('click', () => {
            modal.style.display = 'block';
            loadMetrics();           // сразу грузим метрики
            loadDashboard();         // и статус камер
            startMetricsPolling();
        });
    }

    // Закрытие
    if (closeBtn) {
        closeBtn.onclick = () => {
            modal.style.display = 'none';
            stopMetricsPolling();
        };
    }

    // Закрытие кликом по фону
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
            stopMetricsPolling();
        }
    });

    // --- Переключение вкладок ---
    document.querySelectorAll('.report-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.report-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.report-tab-content').forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            const target = document.getElementById('tab-' + tab.dataset.tab);
            if (target) target.classList.add('active');

            // При переходе на вкладку Система — обновляем камеры
            if (tab.dataset.tab === 'system') loadDashboard();
            if (tab.dataset.tab === 'monitor') loadMetrics();
            if (tab.dataset.tab === 'cameras') loadStreamCameras();
            if (tab.dataset.tab === 'chart') initChartTab();

            // Остановить стрим при уходе с вкладки камер
            if (tab.dataset.tab !== 'cameras') stopStream();
        });
    });

    // --- Кнопки скачивания ---
    document.getElementById('downloadStatsBtn')?.addEventListener('click', () =>
        downloadReport(`${API_BASE}/api/admin/reports/stats`, 'dateFrom', 'dateTo', 'report_traffic.xlsx'));

    document.getElementById('downloadLogsBtn')?.addEventListener('click', () =>
        downloadReport(`${API_BASE}/api/admin/reports/logs`, 'dateFromLogs', 'dateToLogs', 'report_logs.pdf'));

    document.getElementById('downloadSystemBtn')?.addEventListener('click', () =>
        downloadDirect(`${API_BASE}/api/admin/reports/system`, 'report_system.xlsx'));
});


// ==========================================
// ЗАГРУЗКА МЕТРИК CPU / RAM / Disk
// ==========================================
async function loadMetrics() {
    if (!isLoggedIn()) return;

    try {
        const res = await window.apiFetch(`${API_BASE}/api/admin/system-metrics`, {
            headers: authHeaders()
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();

        updateGauge('cpu', data.cpu);
        updateGauge('ram', data.ram);
        updateGauge('disk', data.disk);

        // Обновить мини-график CPU
        if (data.cpu_history && data.cpu_history.length > 0) {
            renderCpuChart(data.cpu_history);
        }

        // Время обновления
        const hint = document.getElementById('metric-updated');
        if (hint) {
            const t = new Date().toLocaleTimeString('ru-RU');
            hint.textContent = `Обновлено: ${t}`;
        }

    } catch (e) {
        console.warn('Ошибка загрузки метрик:', e.message);
        ['cpu-val', 'ram-val', 'disk-val'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = 'N/A';
        });
    }
}

function updateGauge(name, value) {
    const valEl  = document.getElementById(`${name}-val`);
    const barEl  = document.getElementById(`${name}-bar`);
    const cardEl = document.getElementById(`metric-${name}`);

    if (!valEl || !barEl) return;

    if (value === null || value === undefined) {
        valEl.textContent = 'N/A';
        return;
    }

    valEl.textContent = value.toFixed(1);
    barEl.style.width = Math.min(value, 100) + '%';

    // Цвет по порогам
    let color = '#00e676';     // зелёный
    if (value >= 90) color = '#ff1744';
    else if (value >= 75) color = '#ff9100';
    else if (value >= 50) color = '#ffd600';

    barEl.style.background = color;
    if (cardEl) cardEl.style.borderColor = color + '55';
}

function renderCpuChart(history) {
    const canvas = document.getElementById('cpuMiniChart');
    if (!canvas) return;

    const labels = history.map(p => p.time);
    const values = history.map(p => p.value);

    if (cpuChart) {
        cpuChart.data.labels = labels;
        cpuChart.data.datasets[0].data = values;
        cpuChart.update('none');
        return;
    }

    cpuChart = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'CPU %',
                data: values,
                borderColor: '#00b0ff',
                backgroundColor: 'rgba(0,176,255,0.15)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 0,
            }]
        },
        options: {
            responsive: true,
            animation: false,
            plugins: { legend: { display: false } },
            scales: {
                x: {
                    ticks: { color: '#888', font: { size: 9 }, maxTicksLimit: 6 },
                    grid: { color: '#333' }
                },
                y: {
                    min: 0, max: 100,
                    ticks: { color: '#888', font: { size: 9 }, callback: v => v + '%' },
                    grid: { color: '#333' }
                }
            }
        }
    });
}

// ==========================================
// ЗАГРУЗКА ДАШБОРДА (камеры + сервисы)
// ==========================================
async function loadDashboard() {
    if (!isLoggedIn()) return;

    try {
        const res = await window.apiFetch(`${API_BASE}/api/admin/dashboard`, {
            headers: authHeaders()
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();

        // Статус сервисов (на вкладке Monitor)
        updateServiceBadge('svc-postgres', data.services?.postgres);
        updateServiceBadge('svc-influx',   data.services?.influxdb);
        updateServiceBadge('svc-ml',       data.services?.ml_models);

        // Список камер (на вкладке Система)
        renderCamerasList(data.cameras || []);

    } catch (e) {
        console.warn('Ошибка загрузки дашборда:', e.message);
    }
}

function updateServiceBadge(id, status) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = status === 'ok' ? '✅ OK' : status === 'error' ? '❌ Ошибка' : '—';
    el.className = 'svc-badge ' + (status === 'ok' ? 'svc-ok' : 'svc-err');
}

function renderCamerasList(cameras) {
    const container = document.getElementById('cameras-status-list');
    if (!container) return;

    if (!cameras.length) {
        container.innerHTML = '<div class="cameras-loading">Камеры не обнаружены</div>';
        return;
    }

    container.innerHTML = cameras.map(cam => {
        const isActive = cam.status === 'active';
        const statusIcon = isActive ? '🟢' : '🔴';
        const speedColor = cam.avg_speed >= 20 ? '#00e676' : cam.avg_speed >= 5 ? '#ffd600' : '#ff1744';
        return `
        <div class="camera-status-card">
            <div class="cam-header">
                <span class="cam-id">${statusIcon} ${cam.id}</span>
                <span class="cam-status-text ${isActive ? 'cam-ok' : 'cam-off'}">${isActive ? 'Активна' : 'Офлайн'}</span>
            </div>
            <div class="cam-stats">
                <div class="cam-stat"><span>🚗 Машин:</span><strong>${cam.active_cars}</strong></div>
                <div class="cam-stat"><span>⚡ Скорость:</span><strong style="color:${speedColor}">${cam.avg_speed} км/ч</strong></div>
            </div>
        </div>`;
    }).join('');
}

// ==========================================
// ПОЛЛИНГ (авто-обновление каждые 15 сек)
// ==========================================
function startMetricsPolling() {
    stopMetricsPolling();
    metricsInterval = setInterval(() => {
        loadMetrics();
    }, 15000);
}

function stopMetricsPolling() {
    if (metricsInterval) {
        clearInterval(metricsInterval);
        metricsInterval = null;
    }
}

// ==========================================
// СКАЧИВАНИЕ ОТЧЁТОВ
// ==========================================
async function downloadReport(endpoint, fromId, toId, filename) {
    const dateFrom = document.getElementById(fromId)?.value;
    const dateTo   = document.getElementById(toId)?.value;

    if (!dateFrom || !dateTo) {
        alert('Выберите даты!');
        return;
    }

    const url = `${endpoint}?start=${encodeURIComponent(dateFrom + ':00')}&end=${encodeURIComponent(dateTo + ':00')}`;
    await triggerDownload(url, filename);
}

async function downloadDirect(endpoint, filename) {
    await triggerDownload(endpoint, filename);
}

async function triggerDownload(url, filename) {
    try {
        const res = await window.apiFetch(url, { headers: authHeaders() });
        if (!res.ok) {
            const txt = await res.text();
            console.error('Server error:', txt);
            alert('Ошибка при генерации отчёта: ' + res.status);
            return;
        }
        const blob = await res.blob();
        if (blob.type === 'text/html') {
            alert('Получена HTML-страница вместо файла. Проверьте авторизацию.');
            return;
        }
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        URL.revokeObjectURL(a.href);
    } catch (e) {
        console.error('Download error:', e);
        alert('Ошибка: ' + e.message);
    }
}

function authHeaders() {
    return {
        'Authorization': `Bearer ${getToken()}`,
        'ngrok-skip-browser-warning': 'true'
    };
}

// ==========================================
// ВКЛАДКА «КАМЕРЫ» — просмотр MJPEG-потока
// ==========================================

let currentStreamImg = null;

async function loadStreamCameras() {
    const list = document.getElementById('stream-cam-list');
    if (!list) return;
    list.innerHTML = '<div class="stream-loading">Загрузка камер...</div>';

    try {
        const res = await window.apiFetch(`${API_BASE}/api/cameras`);
        const cameras = await res.json();

        if (!cameras.length) {
            list.innerHTML = '<div class="stream-loading">Нет доступных камер</div>';
            return;
        }

        list.innerHTML = cameras.map(cam => `
            <button class="stream-cam-btn" data-id="${encodeURIComponent(cam.id)}" title="${cam.id}">
                <span class="scb-icon">📷</span>
                <span class="scb-name">${cam.name || cam.id}</span>
            </button>
        `).join('');

        list.querySelectorAll('.stream-cam-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                list.querySelectorAll('.stream-cam-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                openStream(decodeURIComponent(btn.dataset.id));
            });
        });

    } catch (e) {
        list.innerHTML = `<div class="stream-error">Ошибка: ${e.message}</div>`;
    }
}

function openStream(camId) {
    const token  = getToken();
    const viewer = document.getElementById('stream-viewer');
    const label  = document.getElementById('stream-cam-label');
    const placeholder = document.getElementById('stream-placeholder');

    if (!token) {
        alert('Требуется авторизация');
        return;
    }

    // Остановить предыдущий стрим
    stopStream();

    const img = document.createElement('img');
    img.id  = 'stream-img';
    img.alt = camId;
    img.src = `${API_BASE}/api/stream/${encodeURIComponent(camId)}?token=${encodeURIComponent(token)}`;

    img.onerror = () => {
        img.removeAttribute('src');
        if (placeholder) placeholder.style.display = 'flex';
        const errEl = document.getElementById('stream-error-msg');
        if (errEl) errEl.textContent = '⚠️ Ошибка подключения к камере';
    };

    if (placeholder) placeholder.style.display = 'none';
    if (label) label.textContent = camId;

    viewer.appendChild(img);
    currentStreamImg = img;
}

function stopStream() {
    if (currentStreamImg) {
        currentStreamImg.removeAttribute('src');
        currentStreamImg.remove();
        currentStreamImg = null;
    }
    const placeholder = document.getElementById('stream-placeholder');
    if (placeholder) placeholder.style.display = 'flex';
    const label = document.getElementById('stream-cam-label');
    if (label) label.textContent = '';

    // Если fullscreen открыт — закрываем тоже
    closeStreamFullscreen();
}

// ─── Fullscreen просмотр потока ────────────────────────────────────────────────
function openStreamFullscreen() {
    const token = getToken();
    const camId = document.getElementById('stream-cam-label')?.textContent?.trim();

    if (!camId) { alert('Сначала выберите камеру'); return; }
    if (!token) { alert('Требуется авторизация');   return; }

    const overlay       = document.getElementById('stream-fullscreen-overlay');
    const fsViewer      = document.getElementById('stream-fs-viewer');
    const fsLabel       = document.getElementById('stream-fs-label');
    const fsPlaceholder = document.getElementById('stream-fs-placeholder');

    // Убираем предыдущий поток в fs
    const oldImg = document.getElementById('stream-fs-img');
    if (oldImg) { oldImg.removeAttribute('src'); oldImg.remove(); }

    const img = document.createElement('img');
    img.id  = 'stream-fs-img';
    img.alt = camId;
    img.src = `${API_BASE}/api/stream/${encodeURIComponent(camId)}?token=${encodeURIComponent(token)}`;
    img.onerror = () => {
        img.removeAttribute('src');
        if (fsPlaceholder) fsPlaceholder.style.display = 'flex';
    };

    if (fsPlaceholder) fsPlaceholder.style.display = 'none';
    if (fsLabel) fsLabel.textContent = `📷 ${camId}`;
    fsViewer.appendChild(img);

    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeStreamFullscreen() {
    const overlay = document.getElementById('stream-fullscreen-overlay');
    if (!overlay) return;

    const fsImg = document.getElementById('stream-fs-img');
    if (fsImg) { fsImg.removeAttribute('src'); fsImg.remove(); }

    const fsPlaceholder = document.getElementById('stream-fs-placeholder');
    if (fsPlaceholder) fsPlaceholder.style.display = 'flex';

    overlay.classList.remove('active');
    document.body.style.overflow = '';
}

// Экспортируем в window — нужно для inline onclick в HTML
window.stopStream            = stopStream;
window.openStreamFullscreen  = openStreamFullscreen;
window.closeStreamFullscreen = closeStreamFullscreen;


// ==========================================
// ВКЛАДКА «ГРАФИК» — гистограмма машин
// ==========================================

// Цветовая палитра для камер (до 10 разных цветов)
const CHART_PALETTE = [
    { bg: 'rgba(0, 180, 255, 0.75)',  border: '#00b4ff' },
    { bg: 'rgba(255, 140, 0, 0.75)',  border: '#ff8c00' },
    { bg: 'rgba(0, 230, 118, 0.75)',  border: '#00e676' },
    { bg: 'rgba(255, 64, 129, 0.75)', border: '#ff4081' },
    { bg: 'rgba(179, 136, 255, 0.75)',border: '#b388ff' },
    { bg: 'rgba(255, 215, 0, 0.75)',  border: '#ffd700' },
    { bg: 'rgba(29, 233, 182, 0.75)', border: '#1de9b6' },
    { bg: 'rgba(255, 110, 64, 0.75)', border: '#ff6e40' },
    { bg: 'rgba(130, 177, 255, 0.75)',border: '#82b1ff' },
    { bg: 'rgba(240, 98, 146, 0.75)', border: '#f06292' },
];

let trafficBarChart = null;
let chartTabReady   = false;

async function initChartTab() {
    if (!chartTabReady) {
        // Установить дефолтные даты
        const now       = new Date();
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const fmt = d => d.toISOString().slice(0, 16);

        const fromEl = document.getElementById('chartDateFrom');
        const toEl   = document.getElementById('chartDateTo');
        if (fromEl) fromEl.value = fmt(yesterday);
        if (toEl)   toEl.value   = fmt(now);

        // Загрузить список камер в селектор
        await populateChartCameraSelect();

        // Кнопка «Построить»
        document.getElementById('buildChartBtn')
            ?.addEventListener('click', buildTrafficChart);

        chartTabReady = true;
    }
}

async function populateChartCameraSelect() {
    const sel = document.getElementById('chartCameraSelect');
    if (!sel) return;

    try {
        const res  = await window.apiFetch(`${API_BASE}/api/cameras`);
        const list = await res.json();

        // Удаляем старые опции кроме «Все»
        while (sel.options.length > 1) sel.remove(1);

        list.forEach(cam => {
            const opt  = document.createElement('option');
            opt.value  = cam.id;
            opt.text   = cam.name || cam.id;
            sel.appendChild(opt);
        });
    } catch (e) {
        console.warn('Не удалось загрузить список камер для графика:', e.message);
    }
}

async function buildTrafficChart() {
    if (!isLoggedIn()) { alert('Требуется авторизация'); return; }

    const from     = document.getElementById('chartDateFrom')?.value;
    const to       = document.getElementById('chartDateTo')?.value;
    const camId    = document.getElementById('chartCameraSelect')?.value || 'all';
    const statusEl = document.getElementById('chartStatus');

    if (!from || !to) { alert('Выберите диапазон дат'); return; }
    if (new Date(from) > new Date(to)) { alert('Дата начала должна быть раньше конца'); return; }

    if (statusEl) statusEl.textContent = '⏳ Загрузка данных...';

    const url = `${API_BASE}/api/admin/traffic-chart`
        + `?start=${encodeURIComponent(from + ':00')}`
        + `&end=${encodeURIComponent(to + ':00')}`
        + `&camera_id=${encodeURIComponent(camId)}`;

    try {
        const res  = await window.apiFetch(url, { headers: authHeaders() });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        if (!data.labels?.length) {
            if (statusEl) statusEl.textContent = '⚠️ Нет данных за выбранный период';
            destroyTrafficChart();
            return;
        }

        if (statusEl) statusEl.textContent = '';
        renderTrafficBarChart(data);

    } catch (e) {
        if (statusEl) statusEl.textContent = `❌ Ошибка: ${e.message}`;
        console.error('buildTrafficChart error:', e);
    }
}

function renderTrafficBarChart(data) {
    const canvas = document.getElementById('trafficBarChart');
    if (!canvas) return;

    // Уничтожить предыдущий экземпляр если был
    destroyTrafficChart();

    const datasets = data.cameras.map((cam, idx) => {
        const color = CHART_PALETTE[idx % CHART_PALETTE.length];
        return {
            label:           cam,
            data:            data.series[cam],
            backgroundColor: color.bg,
            borderColor:     color.border,
            borderWidth:     1.5,
            borderRadius:    4,
            hoverBackgroundColor: color.border,
        };
    });

    trafficBarChart = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels:   data.labels,
            datasets: datasets,
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 400 },
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    display: data.cameras.length > 1,
                    labels:  { color: '#ccc', font: { size: 11 } },
                },
                tooltip: {
                    backgroundColor: 'rgba(15,18,30,0.95)',
                    titleColor:      '#fff',
                    bodyColor:       '#b0bec5',
                    borderColor:     'rgba(255,255,255,0.1)',
                    borderWidth:     1,
                    callbacks: {
                        label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y} а/т`,
                    },
                },
            },
            scales: {
                x: {
                    stacked: false,
                    grid:    { color: 'rgba(255,255,255,0.06)' },
                    ticks: {
                        color:         '#90a4ae',
                        font:          { size: 10 },
                        maxTicksLimit: 20,
                        maxRotation:   45,
                    },
                    title: {
                        display: true,
                        text:    'Время (30-мин интервал)',
                        color:   '#78909c',
                        font:    { size: 11 },
                    },
                },
                y: {
                    beginAtZero: true,
                    grid:        { color: 'rgba(255,255,255,0.06)' },
                    ticks: {
                        color: '#90a4ae',
                        font:  { size: 10 },
                        precision: 0,
                    },
                    title: {
                        display: true,
                        text:    'Количество машин',
                        color:   '#78909c',
                        font:    { size: 11 },
                    },
                },
            },
        },
    });
}

function destroyTrafficChart() {
    if (trafficBarChart) {
        trafficBarChart.destroy();
        trafficBarChart = null;
    }
}