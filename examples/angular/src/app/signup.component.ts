/** Example usage inside an Angular feature component. */
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import type { PixiFormConfig, PixiFormHandle, SubmitResult } from 'pixiformui';
import { PixiFormComponent } from './pixi-form.component';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [PixiFormComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2>Create your account</h2>
    <label>
      Accent
      <select (change)="accent.set($any($event.target).value)">
        <option value="indigo">Indigo</option><option value="teal">Teal</option><option value="rose">Rose</option>
      </select>
    </label>
    <pixi-form [config]="config" [theme]="accent()" (ready)="handle = $event" (success)="onSuccess($event)" />
    <p role="status">{{ status() }}</p>
  `,
})
export class SignupComponent {
  readonly accent = signal<'indigo' | 'teal' | 'rose'>('indigo');
  readonly status = signal('');
  handle: PixiFormHandle | null = null;

  /** Built once: changing the accent re-themes without rebuilding. */
  readonly config: PixiFormConfig = {
    fields: [
      { type: 'text', name: 'name', label: 'Full name', required: true, row: 'a' },
      { type: 'email', name: 'email', label: 'Email', required: true, row: 'a' },
      { type: 'password', name: 'password', label: 'Password', required: true, strengthMeter: true },
      { type: 'checkbox', name: 'terms', label: 'I accept the terms', required: true },
    ],
    submitText: 'Create account',
    onSubmit: async (values): Promise<SubmitResult> => {
      // Real app: encrypt with sealSecret() and post with secureSubmit(); see the developer guide §23.
      this.status.set(`Submitting ${String(values['email'])}…`);
      await new Promise((r) => setTimeout(r, 500));
      return { ok: true, message: 'Account created.' };
    },
  };

  onSuccess(result: SubmitResult): void {
    this.status.set(result.message ?? 'Done');
  }
}
