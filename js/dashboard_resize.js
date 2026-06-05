document.addEventListener('DOMContentLoaded', () => {
    const dashboard = document.getElementById('dashboard');
    const handle = document.getElementById('drag-handle');

    let isDragging = false;
    let startY, startHeight;

    // Минимальная и максимальная высота дашборда
    const MIN_HEIGHT = 100; // Только ползунок и селект камер
    let MAX_HEIGHT = window.innerHeight * 0.85; // 85% от высоты экрана

    // Обновляем MAX_HEIGHT при изменении размера окна
    window.addEventListener('resize', () => {
        MAX_HEIGHT = window.innerHeight * 0.85;
    });

    // Обработчики начала перетаскивания
    handle.addEventListener('mousedown', startDrag);
    handle.addEventListener('touchstart', startDrag, { passive: false });

    function startDrag(e) {
        isDragging = true;
        // Определяем Y координату (мышь или касание)
        startY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
        startHeight = parseInt(document.defaultView.getComputedStyle(dashboard).height, 10);

        document.addEventListener('mousemove', onDrag);
        document.addEventListener('touchmove', onDrag, { passive: false });

        document.addEventListener('mouseup', stopDrag);
        document.addEventListener('touchend', stopDrag);
    }

    function onDrag(e) {
        if (!isDragging) return;

        // Предотвращаем скролл страницы на телефонах при перетаскивании ползунка
        if (e.type.includes('touch')) {
            e.preventDefault();
        }

        const currentY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
        const dy = startY - currentY; // Разница. Положительная, если тянем ВВЕРХ

        let newHeight = startHeight + dy;

        // Применяем границы
        if (newHeight < MIN_HEIGHT) newHeight = MIN_HEIGHT;
        if (newHeight > MAX_HEIGHT) newHeight = MAX_HEIGHT;

        dashboard.style.height = `${newHeight}px`;

        // Опционально: если Chart.js ведет себя странно при изменении контейнера,
        // можно заставить его перерисоваться, раскомментировав строку ниже:
        // window.dispatchEvent(new Event('resize'));
    }

    function stopDrag() {
        if (!isDragging) return;
        isDragging = false;
        document.removeEventListener('mousemove', onDrag);
        document.removeEventListener('touchmove', onDrag);
        document.removeEventListener('mouseup', stopDrag);
        document.removeEventListener('touchend', stopDrag);
    }
});