import React from 'react';

function formatDistance(meters) {
  if (meters == null) return '';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-800">
      <div className="h-4 w-2/3 rounded bg-gray-200 dark:bg-gray-700"></div>
      <div className="mt-2 h-3 w-1/4 rounded bg-gray-200 dark:bg-gray-700"></div>
      <div className="mt-4 h-3 w-full rounded bg-gray-200 dark:bg-gray-700"></div>
      <div className="mt-2 h-3 w-5/6 rounded bg-gray-200 dark:bg-gray-700"></div>
    </div>
  );
}

export default function AttractionsList({ items, isLoading, error }) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-center text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">{error}</div>
    );
  }
  if (!items || items.length === 0) {
    return (
      <div className="rounded-md border border-gray-200 bg-white p-8 text-center text-gray-600 dark:border-gray-800 dark:bg-gray-800 dark:text-gray-300">
        No attractions found for this area. Try increasing the radius or adjusting filters.
      </div>
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <li key={item.id} className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition hover:shadow-md dark:border-gray-800 dark:bg-gray-800">
          {item.imageUrl && (
            <div className="relative h-40 w-full overflow-hidden bg-gray-100 dark:bg-gray-700">
              <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" loading="lazy" />
            </div>
          )}
          <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                {item.name}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">{item.category}</p>
            </div>
            {typeof item.distanceMeters === 'number' && (
              <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                {formatDistance(item.distanceMeters)}
              </span>
            )}
          </div>
          <div className="mt-3 text-sm text-gray-600 dark:text-gray-300">
            <div>Lat: {item.latitude?.toFixed?.(5)} | Lon: {item.longitude?.toFixed?.(5)}</div>
            {item.tags?.website && (
              <a className="text-blue-600 hover:underline dark:text-blue-400" href={item.tags.website} target="_blank" rel="noreferrer">
                Website
              </a>
            )}
            {item.tags?.wikipedia && (
              <div className="mt-1">
                <span className="text-gray-500 dark:text-gray-400">Wikipedia: </span>
                <span className="break-words">{item.tags.wikipedia}</span>
              </div>
            )}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {item.latitude && item.longitude && (
              <a
                className="rounded-md border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700"
                href={`https://www.google.com/maps/search/?api=1&query=${item.latitude},${item.longitude}`}
                target="_blank"
                rel="noreferrer"
              >
                Open in Maps
              </a>
            )}
            {item.tags?.website && (
              <a
                className="rounded-md bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700"
                href={item.tags.website}
                target="_blank"
                rel="noreferrer"
              >
                Visit Site
              </a>
            )}
          </div>
          </div>
        </li>
      ))}
    </ul>
  );
}


