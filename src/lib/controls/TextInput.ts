import type { FormUI } from '../core/FormUI';
import { TextField, type TextFieldOptions } from './TextField';

export interface TextInputOptions extends TextFieldOptions<string> {
  value?: string;
}

/** Single-line text field (like Flutter's TextFormField). */
export class TextInput extends TextField<string> {
  private readonly initial: string;

  constructor(ui: FormUI, opts: TextInputOptions) {
    super(ui, { ...opts, multiline: false });
    this.initial = opts.value ?? '';
    if (this.initial) this.setText(this.initial, false);
    this.redraw();
  }

  getValue(): string {
    return this.buf.toString();
  }

  setValue(value: string, emit = true): void {
    this.setText(String(value ?? ''), emit);
  }

  override reset(): void {
    super.reset();
    if (this.initial) this.setText(this.initial, false);
  }
}

export interface TextAreaOptions extends Omit<TextFieldOptions<string>, 'multiline'> {
  value?: string;
}

/** Multi-line, word-wrapping text field. */
export class TextArea extends TextField<string> {
  private readonly initial: string;

  constructor(ui: FormUI, opts: TextAreaOptions) {
    super(ui, { ...opts, multiline: true });
    this.initial = opts.value ?? '';
    if (this.initial) this.setText(this.initial, false);
    this.redraw();
  }

  getValue(): string {
    return this.buf.toString();
  }

  setValue(value: string, emit = true): void {
    this.setText(String(value ?? ''), emit);
  }

  override reset(): void {
    super.reset();
    if (this.initial) this.setText(this.initial, false);
  }
}
