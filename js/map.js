// js/map.js
import { initializeHeatmap } from './heatmap.js';

mapboxgl.accessToken = 'pk.eyJ1IjoiaXZhbmtvbHRzIiwiYSI6ImNtZ25kdmRlcjFlZTQybHF3MnFkYmVsYnAifQ.lotzKzWSmKnbER_ql8T1ng';
const mapCenter = [58.978402, 53.364699];

// Один раз экспортируем map
export const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/satellite-streets-v11',
    center: mapCenter,
    zoom: 17.5,
    pitch: 0,
    bearing: -17.6
});

let compassInitialized = false;

function initCustomCompass() {
    if (compassInitialized) return;
    compassInitialized = true;

    const needle = document.getElementById('compass-needle');
    const compassBtn = document.getElementById('custom-compass');

    if (!needle || !compassBtn) {
        console.warn('Компас элементы не найдены');
        return;
    }

    console.log('🧭 Инициализация компаса...');

    // Функция обновления стрелки
    function updateCompass() {
        const bearing = map.getBearing();
        const normalizedBearing = ((bearing % 360) + 360) % 360;
        needle.style.transform = `rotate(${-normalizedBearing}deg)`;
    }

    // 1. Синхронизация с поворотом карты (сразу + события)
    updateCompass(); // Начальное положение

    const handlers = {
        'rotate': updateCompass,
        'rotate-start': updateCompass,
        'rotate-end': updateCompass,
        'move': updateCompass,
        'moveend': updateCompass
    };

    Object.entries(handlers).forEach(([event, handler]) => {
        map.on(event, handler);
    });

    // 2. Клик для сброса ориентации
    compassBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    compassBtn.style.transform = 'scale(0.95)';
    setTimeout(() => compassBtn.style.transform = '', 150);

    map.easeTo({
        bearing: 0,
        pitch: 0,
        duration: 1000,
        // easing ДОЛЖЕН быть функцией, а не строкой!
        easing: (t) => t
    });
});

    // 3. Анимация загрузки
    needle.style.transition = 'transform 0.3s ease-in-out';
    needle.style.transform = 'rotate(360deg)';
    setTimeout(() => {
        needle.style.transition = 'transform 0.15s ease-out';
    }, 500);

    console.log('✅ Компас активирован');
}


map.on('load', () => {
    // даём DOM дорисоваться
    setTimeout(() => {
        initCustomCompass();
        initializeHeatmap(map);
    }, 300);

    const statusEl = document.getElementById('status');
    if (statusEl) statusEl.textContent = '🗺️ Карта + компас готовы';

    // Сообщаем другим модулям что карта готова
    window.dispatchEvent(new CustomEvent('mapReady', { detail: { map } }));
});

// дополнительная защита: если карта уже создалась, но load ещё не сработал
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initCustomCompass, 500);
});

// если нужно отдельно импортировать initCustomCompass в других модулях:
export { initCustomCompass };
