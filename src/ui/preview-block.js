const TAG_NAME = 'preview-block';

export class PreviewBlock extends HTMLElement {
  connectedCallback() {
    if (this.dataset.ready) return;

    const footerNodes = Array.from(this.children).filter((child) => child.getAttribute('slot') === 'footer');
    footerNodes.forEach((child) => child.removeAttribute('slot'));

    const content = document.createElement('section');
    content.className = 'preview-block';

    const label = this.getAttribute('label');
    if (label) {
      const labelEl = document.createElement('div');
      labelEl.className = 'preview-block__label';
      labelEl.textContent = label;
      content.append(labelEl);
    }

    const screen = document.createElement('div');
    screen.className = [
      'ds-screen',
      this.hasAttribute('overlay') ? 'ds-screen--overlay' : '',
      this.getAttribute('screen-class') || '',
    ].filter(Boolean).join(' ');

    if (this.hasAttribute('screen-id')) screen.id = this.getAttribute('screen-id');
    if (this.hasAttribute('min-height')) {
      screen.style.setProperty('--preview-min-height', this.getAttribute('min-height'));
    }

    screen.append(...this.childNodes);
    content.append(screen);

    this.replaceChildren(content, ...footerNodes);
    this.dataset.ready = 'true';
  }
}

export function definePreviewBlock() {
  if (!customElements.get(TAG_NAME)) customElements.define(TAG_NAME, PreviewBlock);
}

definePreviewBlock();
