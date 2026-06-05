import { map } from './map.js';

const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? 'http://localhost:8000' : 'https://e2a637d0012efe.lhr.life';

export async function initCameraSelector() {
    const selector = document.getElementById('cameraSelector');

    try {
        // --- ИСПРАВЛЕНИЕ ЗДЕСЬ ---
        // Добавляем headers, чтобы Ngrok пропустил запрос и отдал JSON
        const response = await fetch(`${API_BASE}/api/cameras`, {
            headers: {
                'ngrok-skip-browser-warning': 'true'
            }
        });

        if (!response.ok) {
            console.error("Ошибка сети при загрузке камер:", response.status);
            return;
        }

        const cameras = await response.json();

        // Проверяем, есть ли данные
        if (!cameras || cameras.length === 0) {
            console.warn("Список камер пуст!");
            return;
        }

        cameras.forEach(cam => {
            const option = document.createElement('option');
            option.value = cam.id;
            // Показываем название улицы (если есть) или ID
            option.textContent = `📹 ${cam.name || cam.id}`;
            // Сохраняем координаты прямо в элемент как data-атрибут
            option.dataset.center = JSON.stringify(cam.center);
            selector.appendChild(option);
        });

        // Обработчик выбора
        selector.addEventListener('change', (e) => {
            const camId = e.target.value;
            window.currentCameraId = camId; // Обновляем глобальную переменную

            console.log(`Переключение на камеру: ${camId}`);

            // 1. Двигаем карту
            if (camId === 'all') {
                // Вернуться к общему виду
                map.flyTo({
                    center: [58.978402, 53.364699],
                    zoom: 16,
                    pitch: 0,
                    bearing: 0
                });
            } else {
                // Найти выбранную опцию и её координаты
                const selectedOption = selector.options[selector.selectedIndex];
                if (selectedOption.dataset.center) {
                    const center = JSON.parse(selectedOption.dataset.center);

                    map.flyTo({
                        center: center,
                        zoom: 19, // Приближаем сильно
                        pitch: 45, // Немного наклоняем для 3D эффекта
                        bearing: 0,
                        speed: 1.2,
                        curve: 1.42
                    });
                }
            }

            // Заставляем графики обновиться сразу (опционально, можно подождать таймер)
            // if (typeof updateChart === 'function') updateChart();
        });

    } catch (e) {
        console.error("Ошибка загрузки списка камер:", e);
    }
}