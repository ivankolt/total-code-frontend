/**
 * Traffic Lights Module
 * Виртуальные светофоры на карте — определяют фазу по скорости машин
 */

import { map } from './map.js';

const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? 'http://localhost:8000' : 'https://c4a33ee3752b46.lhr.life';

// Смещения по умолчанию для 4 направлений (в градусах GPS, ~15-20 метров)
const DIR_OFFSETS_DEFAULT = {
    'С': { dlat: 0.00018, dlon: 0 },   // Север
    'Ю': { dlat: -0.00018, dlon: 0 },   // Юг
    'В': { dlat: 0, dlon: 0.00028 },   // Восток
    'З': { dlat: 0, dlon: -0.00028 }    // Запад
};

// Переопределения для конкретных камер, у которых перекрёсток повёрнут
// или смещения нужно подстроить вручную
const DIR_OFFSETS_OVERRIDE = {
    // ул. Грязнова — перекрёсток развёрнут: пр. КМ идёт ~С-Ю, Грязнова ~З-В
    // Подбираем смещения по визуальному положению на карте
    'ул. Грязнова - пр. Карла Маркса': {
        'С': { dlat: 0.00050, dlon: -0.00035 },   // север — чуть левее (запад)
        'Ю': { dlat: -0.00022, dlon: -0.00005 },   // юг — без изменений
        'В': { dlat: 0.00030, dlon: 0.00032 },   // восток — поднят вверх к северу
        'З': { dlat: 0.0000, dlon: -0.00044 }    // запад — дальше на запад
    }
};

/** Получить смещения для конкретной камеры */
function getDirOffsets(camId) {
    return DIR_OFFSETS_OVERRIDE[camId] || DIR_OFFSETS_DEFAULT;
}

const DIR_LABELS = {
    'С': 'С', 'Ю': 'Ю', 'З': 'З', 'В': 'В'
};

const PHASE_COLORS = {
    green: { bg: '#00e676', shadow: '0 0 12px #00e676, 0 0 24px rgba(0,230,118,0.4)' },
    yellow: { bg: '#ffea00', shadow: '0 0 12px #ffea00, 0 0 24px rgba(255,234,0,0.4)' },
    red: { bg: '#ff1744', shadow: '0 0 12px #ff1744, 0 0 24px rgba(255,23,68,0.4)' },
    unknown: { bg: '#ff1744', shadow: '0 0 12px #ff1744, 0 0 24px rgba(255,23,68,0.4)' }
};

// Хранилище маркеров: { "cam980_С": marker, ... }
const markers = {};

/**
 * Создать или обновить один маркер-индикатор
 */
function upsertLightMarker(camId, direction, phase, avgSpeed, carCount, centerLon, centerLat) {
    const key = `${camId}_${direction}`;
    const offset = getDirOffsets(camId)[direction];
    const lon = centerLon + offset.dlon;
    const lat = centerLat + offset.dlat;
    const colors = PHASE_COLORS[phase] || PHASE_COLORS.unknown;

    if (markers[key]) {
        // Обновляем существующий маркер
        const el = markers[key].getElement();
        const dot = el.querySelector('.tl-dot');
        const label = el.querySelector('.tl-label');

        dot.style.backgroundColor = colors.bg;
        dot.style.boxShadow = colors.shadow;
        dot.className = `tl-dot tl-phase-${phase}`;

        label.textContent = carCount > 0 ? `${avgSpeed}` : '';
        label.title = `${DIR_LABELS[direction]}: ${avgSpeed} км/ч, ${carCount} авто`;

        markers[key].setLngLat([lon, lat]);
    } else {
        // Создаём новый маркер
        const el = document.createElement('div');
        el.className = 'tl-marker';
        el.title = `${DIR_LABELS[direction]}: ${avgSpeed} км/ч, ${carCount} авто`;

        el.innerHTML = `
            <div class="tl-dot tl-phase-${phase}" style="background-color: ${colors.bg}; box-shadow: ${colors.shadow};">
                <span class="tl-dir">${DIR_LABELS[direction]}</span>
            </div>
            <div class="tl-label">${carCount > 0 ? avgSpeed : ''}</div>
        `;

        const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
            .setLngLat([lon, lat])
            .addTo(map);

        markers[key] = marker;
    }
}

/**
 * Опрос API и обновление маркеров
 */
async function updateTrafficLights() {
    try {
        const resp = await fetch(`${API_BASE}/api/traffic-lights`, {
            headers: { 'ngrok-skip-browser-warning': 'true' }
        });

        if (!resp.ok) return;

        const data = await resp.json();
        const lights = data.lights || [];

        for (const cam of lights) {
            for (const [dir, info] of Object.entries(cam.directions)) {
                upsertLightMarker(
                    cam.camera_id,
                    dir,
                    info.phase,
                    info.avg_speed,
                    info.car_count,
                    cam.center[0],
                    cam.center[1]
                );
            }
        }
    } catch (e) {
        console.error('Traffic lights error:', e);
    }
}

/**
 * Инициализация: ждём загрузки карты, затем опрашиваем каждые 2 секунды
 */
export function initTrafficLights() {
    if (map.loaded()) {
        start();
    } else {
        map.on('load', start);
    }
}

function start() {
    console.log('🚦 Traffic Lights module started');
    updateTrafficLights();
    setInterval(updateTrafficLights, 2000);
}

// Автоматический запуск
document.addEventListener('DOMContentLoaded', () => {
    // Небольшая задержка чтобы карта успела инициализироваться
    setTimeout(() => initTrafficLights(), 1000);
});
