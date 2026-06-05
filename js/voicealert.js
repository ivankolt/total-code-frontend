/**
 * Voice Alert System
 * Клиентское голосовое оповещение о состоянии трафика.
 * Звук воспроизводится ТОЛЬКО в браузере пользователя (Web Speech API).
 * Сервер не используется для аудио.
 */

const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? 'http://localhost:8000' : 'https://e2a637d0012efe.lhr.life';

const DENSITY_LEVELS = {
    low:    { label: 'НИЗКАЯ',   color: '#4CAF50', emoji: '✅', description: 'Пробок нет' },
    medium: { label: 'СРЕДНЯЯ',  color: '#FFC107', emoji: '⚠️', description: 'Небольшие затруднения' },
    high:   { label: 'ВЫСОКАЯ',  color: '#FF5252', emoji: '🚨', description: 'Обнаружены пробки' },
    fog:    { label: 'ТУМАН',    color: '#9C27B0', emoji: '🌫️', description: 'Детекция не работает' }
};

const VOICE_MESSAGES = {
    low:    'Дорожная обстановка свободная. Пробок нет.',
    medium: 'Дорожная обстановка средняя. Возможны небольшие затруднения.',
    high:   'Внимание! Высокая плотность движения. Обнаружены пробки.',
    fog:    'Внимание! Детекция транспорта работает с ограничениями.'
};

class VoiceAlertController {
    constructor() {
        this.isPlaying      = false;
        this.lastDensity    = null;   // последний известный уровень
        this.autoMode       = false;  // авто-оповещение включено?

        this.playBtn        = document.getElementById('playAlertBtn');
        this.statusBtn      = document.getElementById('checkStatusBtn');
        this.autoToggleBtn  = document.getElementById('autoAlertToggleBtn');
        this.statusDisplay  = document.getElementById('trafficStatusDisplay');
        this.directionStats = document.getElementById('directionStats');

        this.initEventListeners();
        this.startAutoStatusCheck();
    }

    initEventListeners() {
        // Ручной запуск оповещения
        if (this.playBtn) {
            this.playBtn.addEventListener('click', () => this.triggerVoiceAlert());
        }

        // Проверить статус вручную
        if (this.statusBtn) {
            this.statusBtn.addEventListener('click', () => this.checkTrafficStatus());
        }

        // Переключить авто-режим
        if (this.autoToggleBtn) {
            this.autoToggleBtn.addEventListener('click', () => this.toggleAutoMode());
        }
    }

    // ─── РУЧНОЙ ЗАПУСК ───────────────────────────────────────────────────────

    async triggerVoiceAlert() {
        if (this.isPlaying) return;

        this.setButtonLoading(this.playBtn, true);

        try {
            const camId   = window.currentCameraId || 'all';
            const response = await fetch(
                `${API_BASE}/api/traffic-status?camera_id=${camId}`,
                { headers: { 'ngrok-skip-browser-warning': 'true' } }
            );

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data    = await response.json();
            const density = data.density_level || 'low';

            this.updateStatusDisplay(density);
            this.updateDirectionStats(data.directions);
            this.speakAlert(density);
            this.showNotification(
                `🔊 Оповещение: ${DENSITY_LEVELS[density]?.label}`
            );

        } catch (error) {
            console.error('triggerVoiceAlert error:', error);
            this.showNotification(`Ошибка: ${error.message}`, 'error');
        } finally {
            this.setButtonLoading(this.playBtn, false);
        }
    }

    // ─── ПРОВЕРКА СТАТУСА (используется и авто, и кнопкой) ──────────────────

    async checkTrafficStatus() {
        if (this.statusBtn) this.setButtonLoading(this.statusBtn, true);

        try {
            const camId   = window.currentCameraId || 'all';
            const response = await fetch(
                `${API_BASE}/api/traffic-status?camera_id=${camId}`,
                { headers: { 'ngrok-skip-browser-warning': 'true' } }
            );

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data    = await response.json();
            const density = data.density_level || 'low';

            this.updateStatusDisplay(density);
            this.updateDirectionStats(data.directions);

            // ─── АВТО-РЕЖИМ: озвучиваем только при смене уровня ──────────────
            if (this.autoMode && density !== this.lastDensity) {
                this.speakAlert(density);
                this.showNotification(
                    `🔊 Авто: уровень изменился → ${DENSITY_LEVELS[density]?.label}`
                );
            }

            this.lastDensity = density;

        } catch (error) {
            console.error('checkTrafficStatus error:', error);
        } finally {
            if (this.statusBtn) this.setButtonLoading(this.statusBtn, false);
        }
    }

    // ─── ПЕРЕКЛЮЧЕНИЕ АВТО-РЕЖИМА ─────────────────────────────────────────────

    toggleAutoMode() {
        this.autoMode = !this.autoMode;

        if (this.autoToggleBtn) {
            this.autoToggleBtn.textContent = this.autoMode
                ? '🔔 Авто: ВКЛ'
                : '🔕 Авто: ВЫКЛ';
            this.autoToggleBtn.style.background = this.autoMode
                ? 'rgba(76,175,80,0.3)'
                : 'rgba(255,255,255,0.08)';
        }

        this.showNotification(
            this.autoMode
                ? 'Авто-оповещение включено'
                : 'Авто-оповещение выключено'
        );
    }

    // ─── СИНТЕЗ РЕЧИ (Web Speech API) ────────────────────────────────────────

    speakAlert(densityLevel) {
        if (!('speechSynthesis' in window)) {
            console.warn('SpeechSynthesis не поддерживается браузером');
            return;
        }

        const text = VOICE_MESSAGES[densityLevel] || 'Статус дорожной обстановки не определён.';

        window.speechSynthesis.cancel(); // прерываем предыдущее, если есть

        const utterance   = new SpeechSynthesisUtterance(text);
        utterance.lang    = 'ru-RU';
        utterance.rate    = 1.0;
        utterance.pitch   = 1.0;
        utterance.volume  = 1.0;

        // Выбрать русский голос если доступен
        const voices = window.speechSynthesis.getVoices();
        const ruVoice = voices.find(v => v.lang.startsWith('ru'));
        if (ruVoice) utterance.voice = ruVoice;

        utterance.onstart = () => { this.isPlaying = true; };
        utterance.onend   = () => { this.isPlaying = false; };

        window.speechSynthesis.speak(utterance);
    }

    // ─── UI ОБНОВЛЕНИЯ ────────────────────────────────────────────────────────

    updateStatusDisplay(densityLevel) {
        if (!this.statusDisplay) return;
        const el = this.statusDisplay.querySelector('.traffic-status-value');
        if (!el) return;

        Object.keys(DENSITY_LEVELS).forEach(k => el.classList.remove(`status-${k}`));
        el.classList.add(`status-${densityLevel}`);

        const info = DENSITY_LEVELS[densityLevel] || { emoji: '❓', label: 'НЕИЗВЕСТНО' };
        el.innerHTML = `${info.emoji} ${info.label}`;
    }

    updateDirectionStats(directions) {
        if (!directions || !this.directionStats) return;

        const labels = { 'С': '↑ Север', 'Ю': '↓ Юг', 'З': '← Запад', 'В': '→ Восток' };
        let html = '';

        for (const [dir, stats] of Object.entries(directions)) {
            html += `
                <div>
                    <span>${labels[dir] || dir}:</span>
                    <span>${stats.count || 0} авт. &nbsp; ${stats.avg_speed || 0} км/ч</span>
                </div>`;
        }

        this.directionStats.innerHTML = html;
    }

    setButtonLoading(btn, loading) {
        if (!btn) return;
        if (loading) {
            btn.innerHTML = '<span class="loading-spinner"></span>Загрузка...';
            btn.disabled  = true;
        } else {
            btn.disabled = false;
            if (btn === this.playBtn)   btn.innerHTML = '🔊 Запустить оповещение';
            if (btn === this.statusBtn) btn.innerHTML = '📊 Проверить статус';
        }
    }

    showNotification(message, type = 'success') {
        const el = document.getElementById('status');
        if (!el) return;
        const prev = el.textContent;
        el.textContent = message;
        setTimeout(() => { el.textContent = prev; }, 3000);
    }

    // Авто-проверка каждые 30 секунд
    startAutoStatusCheck() {
        this.checkTrafficStatus();
        setInterval(() => this.checkTrafficStatus(), 30000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.voiceAlertController = new VoiceAlertController();
    console.log('✅ Voice Alert System инициализирована');
});

export { VoiceAlertController };
