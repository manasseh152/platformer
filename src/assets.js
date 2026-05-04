import stoneFillUrl from './assets/kenney-medieval/stone-fill.png';
import stoneTopUrl from './assets/kenney-medieval/stone-top.png';
import stoneBlockUrl from './assets/kenney-medieval/stone-block.png';
import spikesUrl from './assets/kenney-medieval/spikes.png';
import gateUrl from './assets/kenney-medieval/gate.png';
import torchUrl from './assets/kenney-medieval/torch.png';
import bannerRedUrl from './assets/kenney-medieval/banner-red.png';
import bannerGreenUrl from './assets/kenney-medieval/banner-green.png';
import flagUrl from './assets/kenney-medieval/flag.png';

function image(src) {
  const img = new Image();
  img.src = src;
  return img;
}

export const assets = {
  tileSize: 70,
  stoneFill: image(stoneFillUrl),
  stoneTop: image(stoneTopUrl),
  stoneBlock: image(stoneBlockUrl),
  spikes: image(spikesUrl),
  gate: image(gateUrl),
  torch: image(torchUrl),
  bannerRed: image(bannerRedUrl),
  bannerGreen: image(bannerGreenUrl),
  flag: image(flagUrl)
};

export function isLoaded(asset) {
  return asset?.complete && asset.naturalWidth > 0;
}
