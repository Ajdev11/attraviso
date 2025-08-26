// Fallback image galleries by category (public domain/stock-like). These are used
// when an attraction has no direct image from Wikidata/Wikipedia/website.

const galleries = {
  hotel: [
    'https://images.unsplash.com/photo-1551776235-dde6d4829808?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1554995207-c18c203602cb?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?q=80&w=1200&auto=format&fit=crop',
  ],
  apartment: [
    'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1524758631624-e2822e304c36?q=80&w=1200&auto=format&fit=crop',
  ],
  guest_house: [
    'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1528909514045-2fa4ac7a08ba?q=80&w=1200&auto=format&fit=crop',
  ],
  hostel: [
    'https://images.unsplash.com/photo-1551776235-cc64ac80f27d?q=80&w=1200&auto=format&fit=crop',
  ],
  motel: [
    'https://images.unsplash.com/photo-1505692794403-34d4982b1ac9?q=80&w=1200&auto=format&fit=crop',
  ],
  museum: [
    'https://images.unsplash.com/photo-1520697222865-7d95c0c09fa9?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1509042239860-f550ce710b93?q=80&w=1200&auto=format&fit=crop',
  ],
  gallery: [
    'https://images.unsplash.com/photo-1549880338-65ddcdfd017b?q=80&w=1200&auto=format&fit=crop',
  ],
  artwork: [
    'https://images.unsplash.com/photo-1496317899792-9d7dbcd928a1?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1550534791-2677533605a1?q=80&w=1200&auto=format&fit=crop',
  ],
  memorial: [
    'https://images.unsplash.com/photo-1506806732259-39c2d0268443?q=80&w=1200&auto=format&fit=crop',
  ],
  monument: [
    'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?q=80&w=1200&auto=format&fit=crop',
  ],
  attraction: [
    'https://images.unsplash.com/photo-1491553895911-0055eca6402d?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1467269204594-9661b134dd2b?q=80&w=1200&auto=format&fit=crop',
  ],
  picnic_site: [
    'https://images.unsplash.com/photo-1455732063391-5f50f0c66b91?q=80&w=1200&auto=format&fit=crop',
  ],
  viewpoint: [
    'https://images.unsplash.com/photo-1470770903676-69b98201ea1c?q=80&w=1200&auto=format&fit=crop',
  ],
  wayside_shrine: [
    'https://images.unsplash.com/photo-1473181488821-2d23949a045a?q=80&w=1200&auto=format&fit=crop',
  ],
};

export function getFallbackGalleryForCategory(category) {
  const key = String(category || '').toLowerCase();
  // Lodging aliases
  if (['guest_house', 'hostel', 'motel', 'apartment'].includes(key)) return galleries[key] || galleries.hotel;
  return galleries[key] || galleries.attraction;
}


