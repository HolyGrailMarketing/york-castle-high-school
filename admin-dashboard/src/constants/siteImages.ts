/**
 * Photographs already committed to the site's images/ directory, offered as
 * suggestions when choosing a featured image. Every entry has been checked to
 * be a genuine school photograph - the folder also contains video title cards,
 * stock wallpapers and map screenshots that should not be used as post images.
 */
export interface SiteImage {
  path: string;
  label: string;
}

export const SITE_IMAGES: SiteImage[] = [
  { path: 'images/IMG_0813.webp', label: 'Graduation procession (wide)' },
  { path: 'images/IMG_0814.webp', label: 'Graduation ceremony, school hall (wide)' },
  { path: 'images/IMG_0808.webp', label: 'Cadet corps marching band (portrait)' },
  { path: 'images/IMG_0791.webp', label: 'Cheer squad on the field (square)' },
  { path: 'images/IMG_0790.webp', label: 'Murray House (square)' },
  { path: 'images/IMG_0796.webp', label: 'Curphey House (square)' },
  { path: 'images/IMG_0799.webp', label: 'Bramwell House' },
  { path: 'images/IMG_0805.webp', label: 'Henderson House' },
  { path: 'images/IMG_0816.webp', label: 'Principal Raymon Treasure (portrait)' },
  { path: 'images/logo-badge.webp', label: 'School crest' },
];
