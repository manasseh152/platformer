import { assets } from './assets/browser-assets.js';
import { createAssetRegistry } from './asset-registry.js';

export const defaultAssetRegistry = createAssetRegistry(assets);
