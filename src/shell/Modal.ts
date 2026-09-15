export interface ModalOptions {
  title: string;
  body?: string;
  /** Shows a number box; `ok.run` gets its value. */
  numberInput?: { min: number; max: number; value: number };
  ok: { label: string; run: (value: number) => boolean | void };
  cancel?: { label: string; run?: () => void };
  /** A third choice with no key of its own, between cancel and ok. */
  extra?: { label: string; run: () => void };
  className?: string;
}

/** One modal at a time. Enter confirms, Esc cancels; the game ignores other keys while it is open. */
export class Modals {
  private overlay: HTMLDivElement | null = null;
  private opts: ModalOptions | null = null;
  private input: HTMLInputElement | null = null;

  constructor(private readonly host: HTMLElement) {}

  isOpen(): boolean {
    return this.overlay !== null;
  }

  open(opts: ModalOptions): void {
    this.close();
    this.opts = opts;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const panel = document.createElement('div');
    panel.className = `modal ${opts.className ?? ''}`;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');

    const title = document.createElement('h2');
    title.textContent = opts.title;
    panel.append(title);
    if (opts.body) {
      const body = document.createElement('p');
      body.textContent = opts.body;
      panel.append(body);
    }
    if (opts.numberInput) {
      const input = document.createElement('input');
      input.type = 'number';
      input.inputMode = 'numeric';
      input.min = String(opts.numberInput.min);
      input.max = String(opts.numberInput.max);
      input.value = String(opts.numberInput.value);
      panel.append(input);
      this.input = input;
    }
    const row = document.createElement('div');
    row.className = 'modal-buttons';
    if (opts.cancel) {
      const cancel = document.createElement('button');
      cancel.textContent = `${opts.cancel.label} (Esc)`;
      cancel.addEventListener('click', () => this.cancel());
      row.append(cancel);
    }
    if (opts.extra) {
      const extra = document.createElement('button');
      extra.textContent = opts.extra.label;
      extra.addEventListener('click', () => {
        this.close();
        opts.extra?.run();
      });
      row.append(extra);
    }
    const ok = document.createElement('button');
    ok.className = 'primary';
    ok.textContent = `${opts.ok.label} (Enter)`;
    ok.addEventListener('click', () => this.confirm());
    row.append(ok);
    panel.append(row);

    overlay.append(panel);
    overlay.addEventListener('pointerdown', (e) => {
      if (e.target === overlay && opts.cancel) this.cancel();
    });
    this.host.append(overlay);
    this.overlay = overlay;
    if (this.input) {
      this.input.focus();
      this.input.select();
    } else {
      ok.focus();
    }
  }

  /** Call from the page's keydown while a modal is open. */
  handleKey(e: KeyboardEvent): void {
    if (e.key === 'Enter') {
      e.preventDefault();
      this.confirm();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      this.cancel();
    } else if (document.activeElement !== this.input) {
      // Keys go nowhere else while a modal is up.
      e.preventDefault();
    }
  }

  close(): void {
    this.overlay?.remove();
    this.overlay = null;
    this.opts = null;
    this.input = null;
  }

  private confirm(): void {
    const opts = this.opts;
    if (!opts) return;
    let value = 0;
    if (opts.numberInput && this.input) {
      value = Number(this.input.value);
      const { min, max } = opts.numberInput;
      if (!Number.isInteger(value) || value < min || value > max) {
        this.input.classList.remove('nope');
        void this.input.offsetWidth;
        this.input.classList.add('nope');
        this.input.select();
        return;
      }
    }
    this.close();
    opts.ok.run(value);
  }

  private cancel(): void {
    const opts = this.opts;
    if (!opts) return;
    this.close();
    opts.cancel?.run?.();
  }
}
