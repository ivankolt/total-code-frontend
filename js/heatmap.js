const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? 'http://localhost:8000' : 'https://05e87439228aac.lhr.life';

let heatmapPoints = [];
const MAX_POINTS = 10000;
const statusDiv = document.getElementById('status');

export function initializeHeatmap(map) {
    map.addSource('heatmap-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
    });

    map.addLayer({
        id: 'heatmap-layer',
        type: 'heatmap',
        source: 'heatmap-source',   
        maxzoom: 22,
        paint: {
            // Интенсивность
            'heatmap-intensity': [
                'interpolate', ['linear'], ['zoom'],
                16, 1,
                22, 0.5
            ],
            // Градиент цвета
            'heatmap-color': [
                'interpolate', ['linear'], ['heatmap-density'],
                0, 'rgba(33,102,172,0)',
                0.2, 'royalblue',
                0.4, 'cyan',
                0.6, 'lime',
                0.8, 'yellow',
                1, 'red'
            ],
            // Радиус точки
            'heatmap-radius': [
                'interpolate', ['linear'], ['zoom'],
                16, 4,
                22, 10
            ],
            // Прозрачность
            'heatmap-opacity': [
                'interpolate', ['linear'], ['zoom'],
                16, 0.8,
                22, 1
            ]
        }
    });

    setInterval(async () => {
        try {
            const resp = await fetch(`${API_BASE}/api/cars`, {
                headers: {
                    'ngrok-skip-browser-warning': 'true'
                }
            });

            const contentType = resp.headers.get('content-type') || '';
            if (!resp.ok || !contentType.includes('application/json')) {
                const text = await resp.text();
                console.error('cars RAW RESPONSE:', text.slice(0, 200));
                throw new Error(`Bad /api/cars response ${resp.status}`);
            }

            const data = await resp.json();
            const cars = data.cars || [];

            statusDiv.textContent = `Connected | Processing ${cars.length} points`;
            statusDiv.style.backgroundColor = 'rgba(0,128,0,0.7)';

            const newPoints = cars.map(car => ({
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: [car.lon, car.lat]
                }
            }));

            heatmapPoints = heatmapPoints.concat(newPoints);
            if (heatmapPoints.length > MAX_POINTS) {
                heatmapPoints.splice(0, heatmapPoints.length - MAX_POINTS);
            }

            map.getSource('heatmap-source').setData({
                type: 'FeatureCollection',
                features: heatmapPoints
            });
        } catch (e) {
            console.error('Heatmap connection error:', e);
            statusDiv.textContent = 'Connection Error';
            statusDiv.style.backgroundColor = 'rgba(255,0,0,0.7)';
        }
    }, 500);
}
