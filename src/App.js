import React from 'react';
import AttractionsList from './components/AttractionsList';
import MapView from './components/MapView';

function App() {
  const API_BASE = process.env.NODE_ENV === 'development' ? 'http://localhost:5000' : '';
  const [coords, setCoords] = React.useState(null);
  const [permissionError, setPermissionError] = React.useState(null);
  const [radius, setRadius] = React.useState(2000);
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [search, setSearch] = React.useState('');
  const [typeFilter, setTypeFilter] = React.useState('all'); // all | tourism | historic | other
  const [darkMode, setDarkMode] = React.useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') return true;
    if (saved === 'light') return false;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [view, setView] = React.useState('list'); // list | map
  const [mapBounds, setMapBounds] = React.useState(null);
  const [filterToMap, setFilterToMap] = React.useState(false);

  // UI style helpers (no logic change)
  const toolbarButtonClasses =
    'rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800';
  const primaryButtonClasses =
    'rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow hover:bg-blue-700';

  React.useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

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
      const params = new URLSearchParams({ lat: String(lat), lon: String(lon), radius: String(r), enrich: '1' });
      const res = await fetch(`${API_BASE}/api/attractions?${params.toString()}`);
      const contentType = res.headers.get('content-type') || '';
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || `Request failed (${res.status})`);
      }
      if (!contentType.includes('application/json')) {
        throw new Error('API did not return JSON. Is the backend running on http://localhost:5000?');
      }
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
  }, [API_BASE]);

  React.useEffect(() => {
    if (coords) {
      fetchAttractions(coords.lat, coords.lon, radius);
    }
  }, [coords, radius, fetchAttractions]);

  const locateMe = React.useCallback(() => {
    if (!('geolocation' in navigator)) {
      setPermissionError('Geolocation is not supported by this browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setCoords({ lat: latitude, lon: longitude });
      },
      (err) => setPermissionError(err.message || 'Failed to get location.'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, []);

  const filteredItems = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    let out = items.filter((it) => {
      const type = it?.tags?.historic ? 'historic' : (it?.tags?.tourism ? 'tourism' : 'other');
      const matchesType = typeFilter === 'all' || type === typeFilter;
      const matchesSearch = !q || (it.name || '').toLowerCase().includes(q);
      return matchesType && matchesSearch;
    });
    if (filterToMap && mapBounds) {
      out = out.filter((it) => (
        typeof it.latitude === 'number' && typeof it.longitude === 'number' &&
        it.latitude >= mapBounds.south && it.latitude <= mapBounds.north &&
        it.longitude >= mapBounds.west && it.longitude <= mapBounds.east
      ));
    }
    return out;
  }, [items, search, typeFilter, filterToMap, mapBounds]);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-slate-950 dark:text-slate-50">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
        <div className="mx-auto max-w-6xl px-6 sm:px-8 md:px-10 py-3">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded bg-gradient-to-br from-blue-500 to-indigo-600"></div>
              <h1 className="text-lg font-semibold tracking-tight">Attraviso</h1>
            </div>
            <div className="ml-auto flex items-center justify-end gap-3">
              <div className="hidden items-center gap-2 md:flex">
                <label className="text-sm text-gray-600 dark:text-gray-300">Radius</label>
                <input
                  type="range"
                  min={1000}
                  max={20000}
                  step={1000}
                  value={radius}
                  onChange={(e) => setRadius(Number(e.target.value))}
                  className="h-2 w-40 cursor-pointer appearance-none rounded bg-gray-200 accent-blue-600 dark:bg-gray-700"
                />
                <span className="w-10 text-right text-sm text-gray-700 dark:text-gray-300">{Math.round(radius/1000)}k</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="inline-flex overflow-hidden rounded-md border border-gray-300 dark:border-gray-700">
                  <button
                    className={`px-3 py-1.5 text-sm ${view==='list' ? 'bg-gray-100 dark:bg-gray-800 font-medium' : 'hover:bg-gray-50'}`}
                    onClick={() => setView('list')}
                    title="List view"
                  >
                    List
                  </button>
                  <button
                    className={`border-l border-gray-300 px-3 py-1.5 text-sm dark:border-gray-700 ${view==='map' ? 'bg-gray-100 dark:bg-gray-800 font-medium' : 'hover:bg-gray-50'}`}
                    onClick={() => setView('map')}
                    title="Map view"
                  >
                    Map
                  </button>
                </div>
                {view === 'map' && (
                  <label className="ml-1 hidden cursor-pointer items-center gap-2 whitespace-nowrap text-sm text-gray-700 md:flex dark:text-gray-300">
                    <input type="checkbox" className="accent-blue-600" checked={filterToMap} onChange={(e) => setFilterToMap(e.target.checked)} />
                    Filter map area
                  </label>
                )}
                <button
                  className={toolbarButtonClasses}
                  onClick={locateMe}
                  title="Locate me"
                >
                  📍 Locate
                </button>
                {coords && (
                  <button
                    className={primaryButtonClasses}
                    onClick={() => fetchAttractions(coords.lat, coords.lon, radius)}
                  >
                    ↻ Refresh
                  </button>
                )}
                <button
                  className={toolbarButtonClasses}
                  onClick={() => setDarkMode((v) => !v)}
                  title="Toggle dark mode"
                >
                  {darkMode ? '🌙' : '☀️'}
                </button>
              </div>
            </div>
          </div>
          <div className="mt-3 flex flex-col items-stretch gap-3 md:flex-row md:items-center md:justify-between">
            <input
              type="text"
              placeholder="Search attractions…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800"
            />
            <div className="flex flex-wrap items-center justify-center gap-2 md:justify-start">
              {['all','tourism','historic','other'].map((t) => (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={`rounded-full px-3 py-1 text-sm ${typeFilter===t ? 'bg-blue-600 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800'}`}
                >
                  {t[0].toUpperCase() + t.slice(1)}
                </button>
              ))}
              <div className="flex items-center gap-2 md:hidden">
                <label className="text-sm text-gray-600 dark:text-gray-300">Radius</label>
                <select
                  className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800"
                  value={radius}
                  onChange={(e) => setRadius(Number(e.target.value))}
                >
                  <option value={1000}>1 km</option>
                  <option value={2000}>2 km</option>
                  <option value={5000}>5 km</option>
                  <option value={10000}>10 km</option>
                  <option value={20000}>20 km</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 sm:px-8 md:px-10 py-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
        {!coords && !permissionError && (
          <div className="rounded-md border border-blue-200 bg-blue-50 p-4 text-center text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200">
            Please allow location access to find attractions near you.
          </div>
        )}
        {permissionError && (
          <div className="rounded-md border border-red-200 bg-red-50 p-4 text-center text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
            {permissionError}
          </div>
        )}

        {coords && (
          <div className="mb-4 text-center text-sm text-gray-600 md:text-left">
            Your location: lat {coords.lat.toFixed(5)}, lon {coords.lon.toFixed(5)}
          </div>
        )}

        {view === 'list' ? (
          <AttractionsList items={filteredItems} isLoading={loading} error={error} />
        ) : (
          <MapView center={coords} items={filteredItems} radius={radius} onBoundsChange={(b) => setMapBounds(b)} />
        )}
      </main>

      <footer className="mx-auto max-w-6xl px-6 sm:px-8 md:px-10 py-8 text-center text-xs text-gray-500 dark:text-gray-400">
        Data from OpenStreetMap (Overpass API)
      </footer>
    </div>
  );
}

export default App;
