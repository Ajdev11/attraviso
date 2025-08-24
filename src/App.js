import React from 'react';
import AttractionsList from './components/AttractionsList';

function App() {
  const [coords, setCoords] = React.useState(null);
  const [permissionError, setPermissionError] = React.useState(null);
  const [radius, setRadius] = React.useState(2000);
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    if (!('geolocation' in navigator)) {
      setPermissionError('Geolocation is not supported by this browser.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setCoords({ lat: latitude, lon: longitude });
      },
      (err) => {
        setPermissionError(err.message || 'Failed to get location.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, []);

  const fetchAttractions = React.useCallback(async (lat, lon, r) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ lat: String(lat), lon: String(lon), radius: String(r) });
      const res = await fetch(`/api/attractions?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch attractions');
      const data = await res.json();
      const items = Array.isArray(data.items) ? data.items : [];
      // compute distance and sort by nearest
      const R = 6371000; // meters
      function toRad(v) { return (v * Math.PI) / 180; }
      const withDistance = items.map((it) => {
        if (typeof it.latitude !== 'number' || typeof it.longitude !== 'number') return it;
        const dLat = toRad(it.latitude - lat);
        const dLon = toRad(it.longitude - lon);
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(toRad(lat)) * Math.cos(toRad(it.latitude)) * Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const meters = R * c;
        return { ...it, distanceMeters: meters };
      });
      withDistance.sort((a, b) => (a.distanceMeters || Infinity) - (b.distanceMeters || Infinity));
      setItems(withDistance);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (coords) {
      fetchAttractions(coords.lat, coords.lon, radius);
    }
  }, [coords, radius, fetchAttractions]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold tracking-tight">Attraviso</h1>
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-600">Radius</label>
              <select
                className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm"
                value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
              >
                <option value={1000}>1 km</option>
                <option value={2000}>2 km</option>
                <option value={5000}>5 km</option>
                <option value={10000}>10 km</option>
                <option value={20000}>20 km</option>
              </select>
              {coords && (
                <button
                  className="rounded-md bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700"
                  onClick={() => fetchAttractions(coords.lat, coords.lon, radius)}
                >
                  Refresh
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {!coords && !permissionError && (
          <div className="rounded-md border border-blue-200 bg-blue-50 p-4 text-blue-800">
            Please allow location access to find attractions near you.
          </div>
        )}
        {permissionError && (
          <div className="rounded-md border border-red-200 bg-red-50 p-4 text-red-800">
            {permissionError}
          </div>
        )}

        {coords && (
          <div className="mb-4 text-sm text-gray-600">
            Your location: lat {coords.lat.toFixed(5)}, lon {coords.lon.toFixed(5)}
          </div>
        )}

        <AttractionsList items={items} isLoading={loading} error={error} />
      </main>

      <footer className="mx-auto max-w-6xl px-4 py-8 text-center text-xs text-gray-500">
        Data from OpenStreetMap (Overpass API)
      </footer>
    </div>
  );
}

export default App;
