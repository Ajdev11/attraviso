import React from 'react';
import CardImage from './CardImage';
import { getFallbackGalleryForCategory } from './fallbackImages';

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

export default function AttractionsList({ items, isLoading, error, darkMode }) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2" style={{ columnGap: '3rem', rowGap: '2.5rem' }}>
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

  const cardStyle = darkMode
    ? { backgroundColor: '#0b1220', borderColor: '#1e293b', color: '#f8fafc' }
    : undefined;
  const badgeStyle = darkMode ? { backgroundColor: '#0f172a', color: '#e2e8f0' } : undefined;

  return (
    <ul className="grid grid-cols-2" style={{ columnGap: '3rem', rowGap: '2.5rem' }}>
      {items.map((item) => (
        <li key={item.id} className="overflow-hidden rounded-lg border shadow-sm transition hover:shadow-md" style={cardStyle}>
          {(() => {
            const fallback = `/api/image?url=${encodeURIComponent(getFallbackGalleryForCategory(item.category)[0])}`;
            if (item.imageUrl) {
              return <CardImage src={`/api/image?url=${encodeURIComponent(item.imageUrl)}`} fallbackSrc={fallback} alt={item.name} />;
            }
            return <CardImage src={fallback} alt={item.name} />;
          })()}
          <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-slate-50">
                {item.name}
              </h3>
              <p className="text-xs text-gray-500 dark:text-slate-300">{item.category}</p>
            </div>
            {typeof item.distanceMeters === 'number' && (
              <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700" style={badgeStyle}>
                {formatDistance(item.distanceMeters)}
              </span>
            )}
          </div>
          <div className="mt-3 text-sm text-gray-600 dark:text-slate-200">
            <div>Lat: {item.latitude?.toFixed?.(5)} | Lon: {item.longitude?.toFixed?.(5)}</div>
            {item.tags?.website && (
              <a className="text-blue-600 hover:underline dark:text-blue-300" href={item.tags.website} target="_blank" rel="noreferrer">
                Website
              </a>
            )}
            {item.tags?.wikipedia && (
              <div className="mt-1">
                <span className="text-gray-500 dark:text-slate-300">Wikipedia: </span>
                <span className="break-words">{item.tags.wikipedia}</span>
              </div>
            )}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {item.latitude && item.longitude && (
              <a
                className="rounded-md border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50 dark:border-slate-700 dark:hover:bg-slate-800"
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


