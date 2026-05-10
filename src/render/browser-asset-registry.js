import { assets } from '../assets.js';
import { createAssetRegistry } from './asset-registry.js';

export const defaultAssetRegistry = createAssetRegistry(assets);
