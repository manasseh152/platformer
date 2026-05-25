import {
  Accessibility,
  ArrowRight,
  Brush,
  Check,
  ChevronLeft,
  Copy,
  Download,
  FilePlus,
  Gamepad2,
  Gauge,
  Heart,
  Home,
  List,
  Map,
  Menu,
  Minus,
  Monitor,
  MousePointerClick,
  Move,
  PanelLeftClose,
  PanelRightClose,
  Pencil,
  Play,
  Plus,
  Redo2,
  RefreshCcw,
  RefreshCw,
  RotateCcw,
  Settings,
  SkipForward,
  Target,
  Timer,
  Trash2,
  TriangleAlert,
  Undo2,
  Upload,
  Wrench,
  X,
  Zap,
  ZoomIn,
  ZoomOut
} from 'lucide';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

const icons = {
  accessibility: Accessibility,
  arrowRight: ArrowRight,
  brush: Brush,
  check: Check,
  chevronLeft: ChevronLeft,
  copy: Copy,
  download: Download,
  filePlus: FilePlus,
  gamepad2: Gamepad2,
  gauge: Gauge,
  heart: Heart,
  home: Home,
  list: List,
  map: Map,
  menu: Menu,
  minus: Minus,
  monitor: Monitor,
  mousePointerClick: MousePointerClick,
  move: Move,
  panelLeftClose: PanelLeftClose,
  panelRightClose: PanelRightClose,
  pencil: Pencil,
  play: Play,
  plus: Plus,
  redo2: Redo2,
  refreshCcw: RefreshCcw,
  refreshCw: RefreshCw,
  rotateCcw: RotateCcw,
  settings: Settings,
  skipForward: SkipForward,
  target: Target,
  timer: Timer,
  trash2: Trash2,
  triangleAlert: TriangleAlert,
  undo2: Undo2,
  upload: Upload,
  wrench: Wrench,
  x: X,
  zap: Zap,
  zoomIn: ZoomIn,
  zoomOut: ZoomOut
};

function attrs(attributes = {}) {
  return Object.entries(attributes)
    .filter(([, value]) => value !== undefined && value !== null && value !== false)
    .map(([name, value]) => value === true ? ` ${name}` : ` ${name}="${escapeHtml(value)}"`)
    .join('');
}

function nodeToSvg(iconNode, attributes) {
  const children = iconNode.map(([tag, childAttrs]) => `<${tag}${attrs(childAttrs)} />`).join('');
  return `<svg${attrs(attributes)}>${children}</svg>`;
}

function normalizeOptions(labelOrOptions) {
  if (typeof labelOrOptions === 'string') return { label: labelOrOptions };
  return labelOrOptions || {};
}

function normalizeAccessibility(options) {
  const label = options.label ?? options['aria-label'];
  const decorative = options.decorative ?? (options.iconOnly === false ? true : undefined) ?? !label;
  return { label, decorative };
}

/**
 * Render a Lucide SVG icon.
 * - renderIcon(name) and renderIcon(name, { decorative: true }) render decorative SVGs.
 * - renderIcon(name, { label: 'Close' }) renders an accessible image.
 * - renderIcon(name, 'Close') is the legacy label shorthand.
 */
export function renderIcon(name, labelOrOptions) {
  const icon = icons[name];
  if (!icon) return '';
  const options = normalizeOptions(labelOrOptions);
  const { label, decorative } = normalizeAccessibility(options);
  const className = ['ui-icon', options.className].filter(Boolean).join(' ');
  return nodeToSvg(icon, {
    xmlns: 'http://www.w3.org/2000/svg',
    width: options.size || 18,
    height: options.size || 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': options.strokeWidth || 2,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    class: className,
    'aria-hidden': decorative ? 'true' : undefined,
    role: decorative ? undefined : 'img',
    'aria-label': decorative ? undefined : label,
    focusable: 'false'
  });
}

export function renderIconLabel(iconName, text, options = {}) {
  return `<span class="ui-icon-label">${renderIcon(iconName, { ...options, decorative: true })}<span>${escapeHtml(text)}</span></span>`;
}
