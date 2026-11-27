/**
 * File field: a drop zone drawn on the canvas, plus a list of chosen files.
 *
 * Files are read only at submit time, then encrypted in the browser (PFF1) and uploaded; the
 * form submits `{ id, key }` references. Nothing about a file is written to the page: the
 * system file picker is a hidden <input type="file"> whose value is cleared at once.
 *
 * Keyboard: Enter or Space opens the picker; Backspace or Delete removes the last file.
 */
import { Container, Control, Graphics, Icons, Rectangle, Text, type ControlOptions, type FormUI } from '../index';
import { FileSelection } from './selection.ts';

export { FileSelection };

export interface FileInputOptions extends ControlOptions<FileSelection> {
  /** Accepted types, as for <input accept>: extensions ('.pdf') and/or MIME types ('image/*'). */
  accept?: string[];
  /** Largest file in bytes. Default 10 MB. */
  maxSize?: number;
  /** How many files can be attached. Default 1. */
  maxFiles?: number;
  /** Short description of what's accepted, shown in the drop zone (default: from `accept`). */
  acceptLabel?: string;
}

export const formatBytes = (n: number): string => (n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`);

function describeAccept(accept: string[]): string {
  return accept.map((a) => (a.startsWith('.') ? a.slice(1).toUpperCase() : a.endsWith('/*') ? `${a.slice(0, -2)}s` : (a.split('/')[1] ?? a).toUpperCase())).join(', ');
}

export class FileInput extends Control<FileSelection> {
  private selection = new FileSelection();
  private readonly accept: string[];
  private readonly maxSize: number;
  private readonly maxFiles: number;
  private readonly acceptLabel: string;
  private readonly zone = new Graphics();
  private readonly icon = new Graphics();
  private readonly title: Text;
  private readonly hint: Text;
  private readonly chips = new Container();
  private dragOver = false;
  private picker: HTMLInputElement | null = null;
  private readonly host: HTMLElement | null;

  constructor(ui: FormUI, opts: FileInputOptions) {
    super(ui, opts);
    this.accept = (opts.accept ?? []).map((a) => a.trim().toLowerCase()).filter(Boolean);
    this.maxSize = opts.maxSize ?? 10 * 1024 * 1024;
    this.maxFiles = Math.max(1, opts.maxFiles ?? 1);
    this.acceptLabel = opts.acceptLabel ?? describeAccept(this.accept);
    this.title = new Text({ text: '', style: this.textStyle('body') });
    this.hint = new Text({ text: '', style: this.textStyle('helper') });
    this.zone.eventMode = 'static';
    this.zone.cursor = this._enabled ? 'pointer' : 'not-allowed';
    this.bindTap(this.zone, () => this.openPicker());
    this.zone.on('pointerover', () => ((this._hovered = true), this.drawBody()));
    this.zone.on('pointerout', () => ((this._hovered = false), this.drawBody()));
    this.body.addChild(this.zone, this.icon, this.title, this.hint, this.chips);
    this.host = ui.app.canvas.parentElement;
    this.host?.addEventListener('dragover', this.onDragOver);
    this.host?.addEventListener('dragleave', this.onDragLeave);
    this.host?.addEventListener('drop', this.onDrop);
    this.redraw();
  }

  getValue(): FileSelection {
    return this.selection;
  }

  setValue(v: FileSelection, emit = true): void {
    if (!(v instanceof FileSelection)) return;
    this.selection = v;
    this.ui.focus.sync(this);
    this.redraw();
    this.commitChange(emit);
  }

  isEmpty(): boolean {
    return this.selection.length === 0;
  }

  reset(): void {
    this.selection = new FileSelection();
    this.touched = false;
    this.setError(null);
    this.redraw();
  }

  override wipe(): void {
    this.selection = new FileSelection();
  }

  /** Adds files after checking type, size and count; problems show as the field's error. */
  addFiles(list: Iterable<File>): void {
    if (!this._enabled) return;
    const files = [...this.selection.files];
    const problems: string[] = [];
    for (const f of list) {
      // Messages never name the file: like every value, file names stay out of the page.
      if (!this.accepts(f)) problems.push(`That file type isn’t accepted${this.acceptLabel ? ` (${this.acceptLabel})` : ''}.`);
      else if (f.size > this.maxSize) problems.push(`That file is larger than ${formatBytes(this.maxSize)}.`);
      else if (files.length >= this.maxFiles) problems.push(this.maxFiles === 1 ? 'Only one file can be attached: remove it to choose another.' : `You can attach up to ${this.maxFiles} files.`);
      else if (!files.some((x) => x.name === f.name && x.size === f.size && x.lastModified === f.lastModified)) files.push(f);
    }
    this.touched = true;
    this.setValue(new FileSelection(files));
    if (problems.length) this.setError(problems[0], 'file');
    else void this.validate();
    this.ui.announcer.announce(problems[0] ?? `${files.length} file${files.length === 1 ? '' : 's'} attached.`);
  }

  removeFile(index: number): void {
    const f = this.selection.files[index];
    if (!f || !this._enabled) return;
    this.setValue(new FileSelection(this.selection.files.filter((_, i) => i !== index)));
    this.ui.announcer.announce(`File removed. ${this.selection.length} attached.`);
    void this.validate();
  }

  private accepts(f: File): boolean {
    if (!this.accept.length) return true;
    const name = f.name.toLowerCase();
    const type = (f.type || '').toLowerCase();
    return this.accept.some((a) => (a.startsWith('.') ? name.endsWith(a) : a.endsWith('/*') ? type.startsWith(a.slice(0, -1)) : type === a));
  }

  openPicker(): void {
    if (!this._enabled || !this.host) return;
    if (!this.picker) {
      const p = document.createElement('input');
      p.type = 'file';
      p.tabIndex = -1;
      p.setAttribute('aria-hidden', 'true');
      p.style.display = 'none';
      p.addEventListener('change', () => {
        if (p.files) this.addFiles(p.files);
        p.value = ''; // nothing about the files stays in the page
      });
      this.host.appendChild(p);
      this.picker = p;
    }
    this.picker.accept = this.accept.join(',');
    this.picker.multiple = this.maxFiles > 1;
    this.picker.click();
  }

  private overZone(e: DragEvent): boolean {
    const r = this.ui.app.canvas.getBoundingClientRect();
    const b = this.zone.getBounds();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    return this.visible && x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height;
  }
  private readonly onDragOver = (e: DragEvent): void => {
    const over = this._enabled && this.overZone(e) && !!e.dataTransfer?.types.includes('Files');
    if (over) {
      e.preventDefault();
      e.dataTransfer!.dropEffect = 'copy';
    }
    if (over !== this.dragOver) {
      this.dragOver = over;
      this.drawBody();
    }
  };
  private readonly onDragLeave = (): void => {
    if (!this.dragOver) return;
    this.dragOver = false;
    this.drawBody();
  };
  private readonly onDrop = (e: DragEvent): void => {
    if (!this.dragOver) return;
    e.preventDefault();
    this.dragOver = false;
    if (e.dataTransfer?.files) this.addFiles(e.dataTransfer.files);
    this.drawBody();
  };

  override ariaRole(): string {
    return 'button';
  }

  override ariaDescription(): { help?: string; error?: string } {
    const d = super.ariaDescription();
    // Counts and sizes only: file names are user data and never go into the page.
    const n = this.selection.length;
    const total = this.selection.files.reduce((sum, f) => sum + f.size, 0);
    return { ...d, help: [d.help, this.hintText(), n ? `${n} file${n === 1 ? '' : 's'} attached (${formatBytes(total)})` : 'No file attached'].filter(Boolean).join('. ') };
  }

  override handleKeyDown(e: KeyboardEvent): boolean {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
      this.openPicker();
      return true;
    }
    if ((e.key === 'Backspace' || e.key === 'Delete') && this.selection.length) {
      this.removeFile(this.selection.length - 1);
      return true;
    }
    return false;
  }

  private hintText(): string {
    return [this.acceptLabel, `up to ${formatBytes(this.maxSize)}`, this.maxFiles > 1 ? `${this.maxFiles} files` : ''].filter(Boolean).join(' · ');
  }

  private zoneHeight(): number {
    return Math.round(this.theme.controlHeight * 1.7);
  }
  private rowHeight(): number {
    return this.theme.controlHeight - 4;
  }

  protected bodyHeight(): number {
    const n = this.selection?.length ?? 0; // also called by the base constructor, before fields exist
    return this.zoneHeight() + (n ? 8 + n * this.rowHeight() + (n - 1) * 6 : 0);
  }

  protected drawBody(): void {
    if (!this.title) return;
    const t = this.theme;
    const c = t.colors;
    const w = this._width;
    const zh = this.zoneHeight();
    const r = t.radius;
    const accent = !this._enabled ? c.border : this._error ? c.error : this.dragOver || this._focused ? c.borderFocus : this._hovered ? c.borderHover : c.border;
    this.zone.clear().roundRect(0, 0, w, zh, r).fill(!this._enabled ? c.surfaceDisabled : this.dragOver ? c.selection : this._hovered ? c.surfaceHover : c.surface);
    this.zone.roundRect(0, 0, w, zh, r).stroke({ width: this.dragOver ? 2 : t.borderWidth, color: accent, alignment: 1 });
    this.zone.hitArea = new Rectangle(0, 0, w, zh);
    this.icon.clear();
    // Upload symbol: an arrow rising out of a tray.
    const ic = this._enabled ? c.primary : c.textDisabled;
    const cx = 26;
    const cy = zh / 2;
    this.icon
      .moveTo(cx, cy + 4).lineTo(cx, cy - 8).moveTo(cx - 5, cy - 3).lineTo(cx, cy - 8).lineTo(cx + 5, cy - 3)
      .moveTo(cx - 9, cy + 3).lineTo(cx - 9, cy + 8).lineTo(cx + 9, cy + 8).lineTo(cx + 9, cy + 3)
      .stroke({ width: 2, color: ic, cap: 'round', join: 'round' });
    const textW = Math.max(40, w - 60);
    this.title.text = this.dragOver ? 'Drop to attach' : this.maxFiles > 1 ? 'Choose files or drop them here' : 'Choose a file or drop it here';
    this.title.style = this.textStyle('body', this._enabled ? c.text : c.textDisabled, textW);
    this.hint.text = this.hintText();
    this.hint.style = this.textStyle('helper', c.textMuted, textW);
    const th = this.title.height + (this.hint.text ? 2 + this.hint.height : 0);
    this.title.position.set(48, Math.round((zh - th) / 2));
    this.hint.position.set(48, Math.round(this.title.y + this.title.height + 2));
    this.drawFocus(0, 0, w, zh, r);

    for (const child of this.chips.removeChildren()) child.destroy({ children: true });
    const rh = this.rowHeight();
    this.selection.files.forEach((f, i) => {
      const y = zh + 8 + i * (rh + 6);
      const row = new Graphics().roundRect(0, y, w, rh, Math.min(r, 10)).fill(c.surfaceHover).stroke({ width: 1, color: c.border, alpha: 0.7, alignment: 1 });
      const size = new Text({ text: formatBytes(f.size), style: this.textStyle('helper', c.textMuted) });
      const maxName = Math.max(8, Math.floor((w - size.width - 70) / (t.fontSize * 0.56)));
      const name = new Text({ text: f.name.length > maxName ? `${f.name.slice(0, maxName - 1)}…` : f.name, style: this.textStyle('body', c.text) });
      name.position.set(12, Math.round(y + (rh - name.height) / 2));
      size.position.set(w - 44 - size.width, Math.round(y + (rh - size.height) / 2));
      const remove = new Graphics();
      Icons.close(remove, 0, 0, 14, c.textMuted);
      remove.position.set(w - 20, y + rh / 2);
      remove.eventMode = 'static';
      remove.cursor = 'pointer';
      remove.hitArea = new Rectangle(-16, -16, 32, 32);
      this.bindTap(remove, () => this.removeFile(i));
      this.chips.addChild(row, name, size, remove);
    });
  }

  override destroy(options?: Parameters<Control<FileSelection>['destroy']>[0]): void {
    this.host?.removeEventListener('dragover', this.onDragOver);
    this.host?.removeEventListener('dragleave', this.onDragLeave);
    this.host?.removeEventListener('drop', this.onDrop);
    this.picker?.remove();
    super.destroy(options);
  }
}
