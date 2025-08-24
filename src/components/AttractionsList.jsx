import React from 'react';

function formatDistance(meters) {
  if (meters == null) return '';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export default function AttractionsList({ items, isLoading, error }) {
  if (isLoading) {
    return (
      <div className="py-10 text-center text-gray-500">Loading nearby attractions…</div>
    );
  }
  if (error) {
    return (
      <div className="py-10 text-center text-red-600">{error}</div>
    );
  }
  if (!items || items.length === 0) {
    return (
      <div className="py-10 text-center text-gray-500">No attractions found for this area.</div>
    );
  }

  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((item) => (
        <li key={item.id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-base font-semibold text-gray-900">
                {item.name}
              </h3>
              <p className="text-xs text-gray-500">{item.category}</p>
            </div>
            {typeof item.distanceMeters === 'number' && (
              <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                {formatDistance(item.distanceMeters)}
              </span>
            )}
          </div>
          <div className="mt-3 text-sm text-gray-600">
            <div>Lat: {item.latitude?.toFixed?.(5)} | Lon: {item.longitude?.toFixed?.(5)}</div>
            {item.tags?.website && (
              <a className="text-blue-600 hover:underline" href={item.tags.website} target="_blank" rel="noreferrer">
                Website
              </a>
            )}
            {item.tags?.wikipedia && (
              <div className="mt-1">
                <span className="text-gray-500">Wikipedia: </span>
                <span>{item.tags.wikipedia}</span>
              </div>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}


