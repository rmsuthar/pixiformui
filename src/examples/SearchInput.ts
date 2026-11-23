/**
 * Example: customising a built-in control by subclassing (see Developer Guide §9.6).
 * Adds a clear (×) button to a TextInput using the trailing-area hooks.
 */
import { Graphics, type FederatedPointerEvent } from '../lib/render/canvas';
import { Icons, TextInput, type FormUI, type TextInputOptions } from '../lib';

export class SearchInput extends TextInput {
  private readonly clearIcon = new Graphics();

  constructor(ui: FormUI, opts: TextInputOptions) {
    super(ui, { inputMode: 'search', enterKeyHint: 'search', ...opts });
    this.trailingWidth = 36;
    this.body.addChild(this.clearIcon);
    this.redraw();
  }

  protected override drawTrailing(w: number, h: number): void {
    if (!this.clearIcon) return; // may run before the field exists
    this.clearIcon.clear();
    if (!this.isEmpty()) Icons.close(this.clearIcon, w - 20, h / 2, 18, this.theme.colors.textMuted);
  }

  protected override handleTrailingClick(e: FederatedPointerEvent): boolean {
    if (e.getLocalPosition(this.body).x < this.layoutWidth - 36 || this.isEmpty()) return false;
    this.setValue('');
    return true;
  }
}
