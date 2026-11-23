import type { KeyboardTarget } from './KeyboardProxy';
import type { Container } from '../render/canvas';

export interface Focusable extends KeyboardTarget {
  readonly view: Container;
  focusOrder: number;
  isFocusable(): boolean;
  setFocused(focused: boolean, viaKeyboard: boolean): void;
  /** Help and error text, linked with aria-describedby / aria-errormessage. */
  ariaDescription?(): { help?: string; error?: string };
  /** Activate like Enter/Space (screen-reader click on the accessibility outline). */
  activate?(): void;
}
