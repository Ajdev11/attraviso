import React from 'react';

export default function CardImage({ src, alt, fallbackSrc }) {
  const apiBase = React.useMemo(() => (process.env.NODE_ENV === 'development' ? 'http://localhost:5000' : ''), []);
  const baseSrc = React.useMemo(() => (src?.startsWith('/') ? `${apiBase}${src}` : src), [apiBase, src]);
  const [loaded, setLoaded] = React.useState(false);
  const [useFallback, setUseFallback] = React.useState(false);

  const effectiveSrc = useFallback && fallbackSrc ? (fallbackSrc.startsWith('/') ? `${apiBase}${fallbackSrc}` : fallbackSrc) : baseSrc;
  const tinySrc = `${effectiveSrc}${effectiveSrc?.includes('?') ? '&' : '?'}w=24&q=20`;
  const mainSrc = `${effectiveSrc}${effectiveSrc?.includes('?') ? '&' : '?'}w=640&q=78`;

  return (
    <div className="relative aspect-[5/3] w-full overflow-hidden bg-gray-100 dark:bg-slate-800">
      <img
        src={tinySrc}
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full transform-gpu object-cover object-center blur-lg"
        onError={() => setUseFallback(true)}
      />
      <img
        src={mainSrc}
        alt={alt}
        className={`absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => setUseFallback(true)}
      />
    </div>
  );
}


