import React from 'react';

export default function CardImage({ src, alt }) {
  const [loaded, setLoaded] = React.useState(false);
  const tinySrc = `${src}${src.includes('?') ? '&' : '?'}w=24&q=20`;
  const mainSrc = `${src}${src.includes('?') ? '&' : '?'}w=640&q=78`;
  return (
    <div className="relative aspect-[16/9] w-full overflow-hidden bg-gray-100 dark:bg-gray-700">
      <img
        src={tinySrc}
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full transform-gpu object-cover blur-lg"
        onLoad={() => {}}
      />
      <img
        src={mainSrc}
        alt={alt}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        loading="lazy"
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
}


