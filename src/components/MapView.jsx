import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvent } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Supercluster from 'supercluster';

// Fix default marker icons for Parcel/CRA builds
// eslint-disable-next-line
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function BoundsWatcher({ onBoundsChange }) {
  useMapEvent('moveend', (e) => {
    const map = e.target;
    const b = map.getBounds();
    const bounds = {
      west: b.getWest(),
      south: b.getSouth(),
      east: b.getEast(),
      north: b.getNorth(),
    };
    onBoundsChange?.(bounds, map.getZoom());
  });
  return null;
}

export default function MapView({ center, items, radius, onBoundsChange }) {
  const mapCenter = center ? [center.lat, center.lon] : [0, 0];

  const points = items
    .filter((it) => typeof it.latitude === 'number' && typeof it.longitude === 'number')
    .map((it) => ({
      type: 'Feature',
      properties: { cluster: false, id: it.id, name: it.name, distance: it.distanceMeters },
      geometry: { type: 'Point', coordinates: [it.longitude, it.latitude] },
      _item: it,
    }));

  const index = React.useMemo(() => new Supercluster({ radius: 60, maxZoom: 18 }), []);
  React.useMemo(() => {
    index.load(points);
  }, [index, points]);

  const [viewState, setViewState] = React.useState({ bounds: null, zoom: 13 });

  return (
    <div className="h-[70vh] w-full overflow-hidden rounded-lg border border-gray-200 shadow-sm dark:border-gray-800">
      <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <BoundsWatcher onBoundsChange={(b, z) => { setViewState({ bounds: b, zoom: z }); onBoundsChange?.(b, z); }} />
        {center && (
          <Marker position={[center.lat, center.lon]}>
            <Popup>You are here</Popup>
          </Marker>
        )}
        {(() => {
          if (!viewState.bounds) return null;
          const bbox = [
            viewState.bounds.west,
            viewState.bounds.south,
            viewState.bounds.east,
            viewState.bounds.north,
          ];
          const clusters = index.getClusters(bbox, Math.round(viewState.zoom));
          return clusters.map((c) => {
            const [lng, lat] = c.geometry.coordinates;
            const key = c.id || `${lng}:${lat}`;
            if (c.properties.cluster) {
              const count = c.properties.point_count;
              const size = Math.min(10 + count, 40);
              const html = `<div style="background:#2563eb;color:white;border-radius:9999px;width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;font-size:12px;box-shadow:0 1px 2px rgba(0,0,0,0.2)">${count}</div>`;
              const icon = L.divIcon({ html, className: 'cluster-marker', iconSize: [size, size] });
              return (
                <Marker key={`cluster-${key}`} position={[lat, lng]} icon={icon} />
              );
            }
            const item = c._item;
            return (
              <Marker key={item.id} position={[item.latitude, item.longitude]}>
                <Popup>
                  <div className="text-sm">
                    <div className="font-semibold">{item.name}</div>
                    {typeof item.distanceMeters === 'number' && (
                      <div>{Math.round(item.distanceMeters)} m</div>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          });
        })()}
      </MapContainer>
    </div>
  );
}


