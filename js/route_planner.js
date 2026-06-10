/**
 * route_planner.js
 * Маршрут: модальное диалоговое окно, клик на карту для точек, OSRM, анализ перекрёстков.
 */

const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? 'http://localhost:8000' : window.location.origin;
// Mapbox Directions API: работает из браузера без CORS, токен уже есть в map.js
const MAPBOX_TOKEN = 'pk.eyJ1IjoiaXZhbmtvbHRzIiwiYSI6ImNtZ25kdmRlcjFlZTQybHF3MnFkYmVsYnAifQ.lotzKzWSmKnbER_ql8T1ng';
const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const INTERSECT_THRESHOLD_M = 200;

let fromCoords = null;   // [lng, lat]
let toCoords = null;   // [lng, lat]
let fromMarker = null;
let toMarker = null;
let mapRef = null;
let clickMode = null;   // 'from' | 'to' | null — режим клика на карту

const routeLayerId  = 'route-line';
const routeSourceId = 'route-source';

// ─── Инициализация ────────────────────────────────────────────────────────────
export function initRoutePlanner(map) {
    mapRef = map;
    _bindUI();
    _bindMapClick();
}

function _bindUI() {
    // Кнопка «Построить маршрут» на дашборде → открывает диалог
    document.getElementById('routeOpenBtn').addEventListener('click', _openDialog);

    // Закрытие диалога
    document.getElementById('routeDialogClose').addEventListener('click', _closeDialog);
    document.getElementById('routeDialogOverlay').addEventListener('click', e => {
        if (e.target === e.currentTarget) _closeDialog();
    });

    // GPS
    document.getElementById('routeFromGPS').addEventListener('click', _getGPSLocation);

    // Клик-режим выбора точки на карте
    document.getElementById('routePickFrom').addEventListener('click', () => _startPickMode('from'));
    document.getElementById('routePickTo').addEventListener('click', () => _startPickMode('to'));

    // Поиск адресов
    document.getElementById('routeFromInput').addEventListener('keydown', e => { if (e.key === 'Enter') _geocode('from'); });
    document.getElementById('routeFromSearch').addEventListener('click', () => _geocode('from'));
    document.getElementById('routeToInput').addEventListener('keydown', e => { if (e.key === 'Enter') _geocode('to'); });
    document.getElementById('routeToSearch').addEventListener('click', () => _geocode('to'));

    // Действия
    document.getElementById('routeBuildBtn').addEventListener('click', _buildRoute);
    document.getElementById('routeClearBtn').addEventListener('click', _clearRoute);
}

// ─── Диалог ───────────────────────────────────────────────────────────────────
function _openDialog() {
    document.getElementById('routeDialogOverlay').classList.add('active');
}
function _closeDialog() {
    document.getElementById('routeDialogOverlay').classList.remove('active');
    clickMode = null;
    _updatePickHint();
}

// ─── Режим клика на карту ─────────────────────────────────────────────────────
function _bindMapClick() {
    mapRef.on('click', e => {
        if (!clickMode) return;
        const { lng, lat } = e.lngLat;
        const coords = [lng, lat];

        if (clickMode === 'from') {
            fromCoords = coords;
            document.getElementById('routeFromInput').value = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
            _placeMarker('from', coords);
            clickMode = null;
            _updatePickHint();
            mapRef.getCanvas().style.cursor = '';
            // Автоматически переходим к выбору конечной точки
            setTimeout(() => _startPickMode('to'), 200);
        } else {
            toCoords = coords;
            document.getElementById('routeToInput').value = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
            _placeMarker('to', coords);
            clickMode = null;
            _updatePickHint();
            mapRef.getCanvas().style.cursor = '';
            // Автоматически открываем диалог — пользователь сразу видит кнопку «Построить»
            document.getElementById('routeDialogOverlay').classList.add('active');
        }
    });
}

function _startPickMode(type) {
    clickMode = type;
    _updatePickHint();
    mapRef.getCanvas().style.cursor = 'crosshair';
    // Сворачиваем диалог чтобы видеть карту, но не закрываем
    document.getElementById('routeDialogOverlay').classList.remove('active');
    _setStatus(`Кликните на карту — точка «${type === 'from' ? 'Откуда' : 'Куда'}»`, 'loading');
}

function _updatePickHint() {
    const hint = document.getElementById('routePickHint');
    if (!hint) return;
    if (clickMode) {
        hint.textContent = `📍 Кликните на карту для точки «${clickMode === 'from' ? 'Откуда' : 'Куда'}»`;
        hint.style.display = 'block';
    } else {
        hint.style.display = 'none';
    }
}

// ─── Геолокация ───────────────────────────────────────────────────────────────
function _getGPSLocation() {
    const btn = document.getElementById('routeFromGPS');
    btn.disabled = true; btn.textContent = '⏳';

    if (!navigator.geolocation) {
        _setStatus('Геолокация не поддерживается', 'error');
        btn.disabled = false; btn.textContent = '📍 GPS';
        return;
    }
    navigator.geolocation.getCurrentPosition(
        pos => {
            fromCoords = [pos.coords.longitude, pos.coords.latitude];
            document.getElementById('routeFromInput').value =
                `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`;
            _placeMarker('from', fromCoords);
            mapRef.flyTo({ center: fromCoords, zoom: 14 });
            _setStatus('Местоположение получено ✓', 'ok');
            btn.disabled = false; btn.textContent = '📍 GPS';
        },
        err => {
            _setStatus('GPS ошибка: ' + err.message, 'error');
            btn.disabled = false; btn.textContent = '📍 GPS';
        },
        { enableHighAccuracy: true, timeout: 10000 }
    );
}

// ─── Геокодирование ───────────────────────────────────────────────────────────
async function _geocode(type) {
    const inputId = type === 'from' ? 'routeFromInput' : 'routeToInput';
    const query = document.getElementById(inputId).value.trim();
    if (!query) return;

    _setStatus('Поиск адреса...', 'loading');
    try {
        const url = `${NOMINATIM}?q=${encodeURIComponent(query)}&format=json&limit=1&accept-language=ru`;
        const res = await window.apiFetch(url);
        const data = await res.json();

        if (!data.length) { _setStatus('Адрес не найден', 'error'); return; }

        const { lat, lon, display_name } = data[0];
        const coords = [parseFloat(lon), parseFloat(lat)];

        if (type === 'from') fromCoords = coords;
        else toCoords = coords;

        document.getElementById(inputId).value = display_name;
        _placeMarker(type, coords);
        mapRef.flyTo({ center: coords, zoom: 14 });
        _setStatus('Найдено ✓', 'ok');
    } catch (e) {
        _setStatus('Ошибка поиска: ' + e.message, 'error');
    }
}

// ─── Маркеры ─────────────────────────────────────────────────────────────────
function _placeMarker(type, coords) {
    if (type === 'from') {
        if (fromMarker) fromMarker.remove();
        fromMarker = new mapboxgl.Marker({ color: '#00e676', draggable: true })
            .setLngLat(coords)
            .setPopup(new mapboxgl.Popup({ offset: 25 }).setText('Откуда'))
            .addTo(mapRef);
        fromMarker.on('dragend', () => {
            const { lng, lat } = fromMarker.getLngLat();
            fromCoords = [lng, lat];
            document.getElementById('routeFromInput').value = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        });
    } else {
        if (toMarker) toMarker.remove();
        toMarker = new mapboxgl.Marker({ color: '#ff5252', draggable: true })
            .setLngLat(coords)
            .setPopup(new mapboxgl.Popup({ offset: 25 }).setText('Куда'))
            .addTo(mapRef);
        toMarker.on('dragend', () => {
            const { lng, lat } = toMarker.getLngLat();
            toCoords = [lng, lat];
            document.getElementById('routeToInput').value = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        });
    }
}

// ─── Построение маршрута ──────────────────────────────────────────────────────
async function _buildRoute() {
    if (!fromCoords || !toCoords) {
        _setStatus('Укажите обе точки маршрута', 'error'); return;
    }
    const btn = document.getElementById('routeBuildBtn');
    btn.disabled = true; btn.textContent = '⏳ Строим...';
    _setStatus('Запрос маршрута...', 'loading');

    try {
        // Mapbox Directions API — работает из браузера без CORS
        const url = `https://api.mapbox.com/directions/v5/mapbox/driving/` +
            `${fromCoords[0]},${fromCoords[1]};${toCoords[0]},${toCoords[1]}` +
            `?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`;

        const res = await window.apiFetch(url);
        const data = await res.json();

        if (!data.routes || !data.routes.length) {
            _setStatus('Маршрут не найден', 'error'); return;
        }

        const route = data.routes[0];
        const coords = route.geometry.coordinates;
        const distKm = (route.distance / 1000).toFixed(1);
        const durMin = Math.ceil(route.duration / 60);

        _drawRoute(route.geometry);

        const bounds = coords.reduce(
            (b, c) => b.extend(c),
            new mapboxgl.LngLatBounds(coords[0], coords[0])
        );
        mapRef.fitBounds(bounds, { padding: 80 });

        // Сначала показываем базовое время Mapbox, потом уточняем через трафик
        _setStatus(`✓ ${distKm} км · ⏳ анализ трафика...`, 'loading');

        const onRoute = await _checkIntersections(coords);
        await _fetchRoutePrediction(onRoute, route.duration, distKm);

    } catch (e) {
        _setStatus('Ошибка: ' + e.message, 'error');
    } finally {
        btn.disabled = false; btn.textContent = '🛣️ Построить';
    }
}


function _drawRoute(geojson) {
    if (mapRef.getLayer(routeLayerId)) mapRef.removeLayer(routeLayerId);
    if (mapRef.getSource(routeSourceId)) mapRef.removeSource(routeSourceId);

    mapRef.addSource(routeSourceId, {
        type: 'geojson',
        data: { type: 'Feature', geometry: geojson }
    });
    mapRef.addLayer({
        id: routeLayerId, type: 'line', source: routeSourceId,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#4fc3f7', 'line-width': 5, 'line-opacity': 0.85 }
    });
}

// ─── Анализ перекрёстков ──────────────────────────────────────────────────────
async function _checkIntersections(routeCoords) {
    const panel = document.getElementById('routeIntersections');
    panel.innerHTML = '<div class="ri-loading">Анализ перекрёстков...</div>';

    try {
        const res = await window.apiFetch(`${API_BASE}/api/cameras`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const cameras = await res.json();

        const onRoute = cameras
            .map(cam => {
                const [camLng, camLat] = cam.center;
                return { cam, dist: Math.round(_minDistToRoute(camLat, camLng, routeCoords)) };
            })
            .filter(x => x.dist <= INTERSECT_THRESHOLD_M)
            .sort((a, b) => a.dist - b.dist);

        if (!onRoute.length) {
            panel.innerHTML = '<div class="ri-empty">Известных перекрёстков на маршруте нет</div>';
            return [];
        }

        // Предварительно рендерим с текущим статусом (быстро)
        const lastStatus = window.voiceAlertController?.lastStatus ?? { density_level: 'low', total_cars: 0 };
        const preliminary = onRoute.map(({ cam, dist }) => ({
            cam, dist,
            density_level: lastStatus.density_level ?? 'low',
            total_cars: lastStatus.total_cars ?? 0,
        }));
        _renderIntersections(preliminary);

        return onRoute.map(x => x.cam.id);

    } catch (e) {
        panel.innerHTML = `<div class="ri-error">Ошибка анализа: ${e.message}</div>`;
        return [];
    }
}

// ─── Запрос ML-прогноза и итогового ETA ──────────────────────────────────────
async function _fetchRoutePrediction(cameraIds, baseDurationSec, distKm) {
    const panel   = document.getElementById('routeIntersections');
    const baseMin = Math.ceil(baseDurationSec / 60);

    if (!cameraIds.length) {
        _setStatus(`✓ ${distKm} км · ~${baseMin} мин (нет данных трафика)`, 'ok');
        return;
    }

    try {
        const idsParam = cameraIds.join(',');
        const res = await window.apiFetch(
            `${API_BASE}/api/route-predict?camera_ids=${encodeURIComponent(idsParam)}&base_duration=${Math.round(baseDurationSec)}`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        const nowMin    = Math.ceil(data.eta_now_sec   / 60);
        const futureMin = Math.ceil(data.eta_30min_sec / 60);

        // Иконка тренда
        const trend = futureMin < nowMin ? '📉' : futureMin > nowMin ? '📈' : '➡️';

        _setStatus(
            `✓ ${distKm} км  ·  Сейчас: ~${nowMin} мин  ·  +30 мин: ~${futureMin} мин ${trend}`,
            'ok'
        );

        // Перерисовываем карточки с полными данными
        _renderPredictedIntersections(data.cameras);

    } catch (e) {
        console.warn('route-predict error:', e);
        // Оставляем базовое время
        _setStatus(`✓ ${distKm} км · ~${baseMin} мин`, 'ok');
    }
}


// ─── Рендер карточек с ML-данными ────────────────────────────────────────────
const DENSITY_LEVELS_MAP = {
    low:    { cls: 'free',   emoji: '✅', label: 'СВОБОДНО' },
    medium: { cls: 'medium', emoji: '⚠️', label: 'СРЕДНЯЯ'  },
    high:   { cls: 'busy',   emoji: '🚨', label: 'ПРОБКА'   },
};

// Предварительные карточки (только текущий статус, до получения ML-ответа)
function _renderIntersections(items) {
    const panel = document.getElementById('routeIntersections');
    panel.innerHTML = `
        <div class="ri-header">🚦 Перекрёстки на маршруте (${items.length}) · <span style="color:#8a9ab5;font-size:0.75rem">Загрузка прогноза...</span></div>
        ${items.map(({ cam, density_level, total_cars }) => {
            const st = DENSITY_LEVELS_MAP[density_level] ?? DENSITY_LEVELS_MAP.low;
            return `
            <div class="ri-card ri-${st.cls}">
                <div class="ri-dot ri-dot-${st.cls}"></div>
                <div class="ri-info">
                    <div class="ri-name">${cam.name || cam.id}</div>
                    <div class="ri-meta">${total_cars} а/т · ${st.emoji} ${st.label}</div>
                </div>
            </div>`;
        }).join('')}`;
}

// Финальные карточки с двумя сценариями
function _renderPredictedIntersections(cameras) {
    const panel = document.getElementById('routeIntersections');
    panel.innerHTML = `
        <div class="ri-header">🚦 Перекрёстки на маршруте (${cameras.length})</div>
        ${cameras.map(c => {
            const now    = DENSITY_LEVELS_MAP[c.density_now]    ?? DENSITY_LEVELS_MAP.low;
            const future = DENSITY_LEVELS_MAP[c.density_30min] ?? DENSITY_LEVELS_MAP.low;
            return `
            <div class="ri-card ri-${now.cls}">
                <div class="ri-dot ri-dot-${now.cls}"></div>
                <div class="ri-info">
                    <div class="ri-name">${c.name || c.id}</div>
                    <div class="ri-scenario">
                        <span class="ri-scenario-label">Сейчас</span>
                        <span class="ri-scenario-val">${c.real_speed} км/ч · ${c.real_cars} а/т · ${now.emoji} ${now.label}</span>
                    </div>
                    <div class="ri-scenario ri-scenario-future">
                        <span class="ri-scenario-label">+30 мин</span>
                        <span class="ri-scenario-val">${c.pred_speed} км/ч · ${c.pred_cars} а/т · ${future.emoji} ${future.label}</span>
                    </div>
                </div>
            </div>`;
        }).join('')}`;
}


// ─── Геометрия: расстояние точки до маршрута (метры) ────────────────────────
function _minDistToRoute(lat, lng, routeCoords) {
    let min = Infinity;
    for (let i = 0; i < routeCoords.length - 1; i++) {
        const d = _ptSegDist(lat, lng,
            routeCoords[i][1], routeCoords[i][0],
            routeCoords[i + 1][1], routeCoords[i + 1][0]);
        if (d < min) min = d;
    }
    return min;
}
function _ptSegDist(pLat, pLng, aLat, aLng, bLat, bLng) {
    const R = 6371000, toRad = d => d * Math.PI / 180;
    const bx = (bLng - aLng) * Math.cos(toRad(aLat)) * R * Math.PI / 180, by = (bLat - aLat) * R * Math.PI / 180;
    const px = (pLng - aLng) * Math.cos(toRad(aLat)) * R * Math.PI / 180, py = (pLat - aLat) * R * Math.PI / 180;
    const len2 = bx * bx + by * by;
    if (!len2) return Math.hypot(px, py);
    const t = Math.max(0, Math.min(1, (px * bx + py * by) / len2));
    return Math.hypot(px - t * bx, py - t * by);
}

// ─── Сброс ───────────────────────────────────────────────────────────────────
function _clearRoute() {
    if (mapRef.getLayer(routeLayerId)) mapRef.removeLayer(routeLayerId);
    if (mapRef.getSource(routeSourceId)) mapRef.removeSource(routeSourceId);
    if (fromMarker) { fromMarker.remove(); fromMarker = null; }
    if (toMarker) { toMarker.remove(); toMarker = null; }
    fromCoords = toCoords = null;
    document.getElementById('routeFromInput').value = '';
    document.getElementById('routeToInput').value = '';
    document.getElementById('routeIntersections').innerHTML = '';
    _setStatus('', '');
}

function _setStatus(msg, type) {
    const el = document.getElementById('routeStatus');
    if (!el) return;
    el.textContent = msg;
    el.className = 'route-status ' + ({ error: 'rs-error', ok: 'rs-ok', loading: 'rs-loading' }[type] || '');
}
