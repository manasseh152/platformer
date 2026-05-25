import '#/app/pwa.js';
import { renderIcon, renderIconLabel } from './app/ui/components/icons.js';
import '#/editor/map-editor.js';

function setIconLabel(id, icon, label) {
  const element = document.getElementById(id);
  if (element) element.innerHTML = renderIconLabel(icon, label);
}

function hydrateEditorIcons() {
  setIconLabel('newButton', 'filePlus', 'New blank');
  setIconLabel('resetButton', 'refreshCcw', 'Reload from selected');
  setIconLabel('previewButton', 'play', 'Play preview');
  setIconLabel('copyButton', 'copy', 'Copy JS');
  setIconLabel('exportMapButton', 'download', 'Export map');
  setIconLabel('importMapButton', 'upload', 'Import map');
  setIconLabel('undoButton', 'undo2', 'Undo');
  setIconLabel('redoButton', 'redo2', 'Redo');
  setIconLabel('resetViewButton', 'rotateCcw', 'Reset');
  setIconLabel('panToggleButton', 'move', 'Pan');
  setIconLabel('floatingPaletteToggle', 'brush', 'Brush');

  const zoomOut = document.getElementById('zoomOutButton');
  if (zoomOut) zoomOut.innerHTML = renderIcon('zoomOut');
  const zoomIn = document.getElementById('zoomInButton');
  if (zoomIn) zoomIn.innerHTML = renderIcon('zoomIn');
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hydrateEditorIcons, { once: true });
else hydrateEditorIcons();
