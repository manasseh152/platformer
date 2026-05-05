const base = './assets/kenney-pixel-platformer/Tiles/';
const tileUrl = name => new URL(`${base}${name}`, import.meta.url).href;

export const KENNEY_PIXEL_PLATFORMER = {
  id: 'kenney-pixel-platformer',
  artTileSize: 18,
  themes: {
    grass: {
      terrain: {
        fill: tileUrl('tile_0104.png'),
        fillAlt: tileUrl('tile_0122.png'),
        top: tileUrl('tile_0022.png'),
        bottom: tileUrl('tile_0142.png'),
        left: tileUrl('tile_0121.png'),
        right: tileUrl('tile_0123.png'),
        topLeft: tileUrl('tile_0021.png'),
        topRight: tileUrl('tile_0023.png'),
        bottomLeft: tileUrl('tile_0141.png'),
        bottomRight: tileUrl('tile_0143.png'),
        platform: tileUrl('tile_0018.png')
      },
      hazards: {
        spikes: tileUrl('tile_0068.png')
      }
    }
  }
};
