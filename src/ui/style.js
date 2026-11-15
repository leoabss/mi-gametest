export const FONT = '"Trebuchet MS", Verdana, sans-serif';
export const text = (size, color = '#ffffff', extra = {}) => ({
  fontFamily: FONT, fontSize: `${size}px`, color, stroke: '#10141c', strokeThickness: Math.max(2, size / 6),
  resolution: Math.min(2, window.devicePixelRatio || 1), ...extra,
});
export const TYPE_COLORS_CSS = {
  normal: '#a8a878', fire: '#f08030', water: '#6890f0', grass: '#78c850', electric: '#f8d030', ice: '#98d8d8',
  fighting: '#c03028', poison: '#a040a0', ground: '#e0c068', flying: '#a890f0', psychic: '#f85888', bug: '#a8b820',
  rock: '#b8a038', ghost: '#705898', dragon: '#7038f8', dark: '#705848', steel: '#b8b8d0', fairy: '#ee99ac',
};
