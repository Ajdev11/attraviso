import React from 'react';

function SkeletonJob() {
  return (
    <div className="animate-pulse rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-800">
      <div className="h-4 w-2/3 rounded bg-gray-200 dark:bg-gray-700"></div>
      <div className="mt-2 h-3 w-1/3 rounded bg-gray-200 dark:bg-gray-700"></div>
      <div className="mt-4 h-3 w-full rounded bg-gray-200 dark:bg-gray-700"></div>
    </div>
  );
}

function formatDistance(m) {
  if (m == null) return null;
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

export default function JobsList({ items, isLoading, error, darkMode }) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2" style={{ columnGap: '3rem', rowGap: '2.5rem' }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonJob key={i} />
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
        No jobs found near you. Try increasing the radius or adjusting search.
      </div>
    );
  }

  const cardStyle = darkMode
    ? { backgroundColor: '#0b1220', borderColor: '#1e293b', color: '#f8fafc' }
    : undefined;
  const badgeStyle = darkMode ? { backgroundColor: '#0f172a', color: '#e2e8f0' } : undefined;

  return (
    <ul className="grid grid-cols-2" style={{ columnGap: '3rem', rowGap: '2.5rem' }}>
      {items.map((j) => (
        <li key={j.id} className="overflow-hidden rounded-lg border shadow-sm transition hover:shadow-md" style={cardStyle}>
          <div className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-slate-50">{j.title}</h3>
                <p className="text-xs text-gray-500 dark:text-slate-300">{j.company || 'Company'}</p>
                {j.location && (
                  <p className="mt-1 text-xs text-gray-500 dark:text-slate-300">{j.location}</p>
                )}
              </div>
              {typeof j.distanceMeters === 'number' && (
                <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700" style={badgeStyle}>
                  {formatDistance(j.distanceMeters)}
                </span>
              )}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {j.url && (
                <a
                  className="rounded-md bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700"
                  href={j.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  View job
                </a>
              )}
              {j.source && (
                <span className="text-xs text-gray-500 dark:text-slate-300">Source: {j.source}</span>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}



