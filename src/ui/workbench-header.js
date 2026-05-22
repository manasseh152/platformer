export function initWorkbenchHeader(root = document) {
  const header = root.querySelector('.wb-site-header');
  if (!header) return;

  const compactAfter = 72;
  let compact = window.scrollY > compactAfter;
  let ticking = false;
  header.classList.toggle('is-compact', compact);

  const sync = () => {
    ticking = false;
    const y = window.scrollY;
    const nextCompact = compact ? y > 0 : y > compactAfter;
    if (nextCompact === compact) return;
    compact = nextCompact;
    header.classList.toggle('is-compact', compact);
  };

  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(sync);
  }, { passive: true });
}

initWorkbenchHeader();
