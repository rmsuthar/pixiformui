/**
 * Angular component for PixiForm. Copy this file into your app (Angular 16+, standalone).
 *
 *   <pixi-form [config]="config" [theme]="accent" (success)="onSaved($event)" (ready)="handle = $event" />
 *
 * PixiForm renders on requestAnimationFrame; mounting runs OUTSIDE the Angular zone so
 * animation frames don't trigger change detection. Outputs re-enter the zone.
 */
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  NgZone,
  Output,
  inject,
  type AfterViewInit,
  type OnChanges,
  type OnDestroy,
  type SimpleChanges,
} from '@angular/core';
import {
  mountPixiForm,
  PIXIFORM_EVENTS,
  type PixiFormConfig,
  type PixiFormEventMap,
  type PixiFormEventType,
  type PixiFormHandle,
  type SubmitResult,
  type ThemeInput,
} from 'pixiformui';

@Component({
  selector: 'pixi-form',
  standalone: true,
  template: '',
  host: { style: 'display:block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PixiFormComponent implements AfterViewInit, OnChanges, OnDestroy {
  /** Form definition. Assign a NEW object to rebuild the form. */
  @Input({ required: true }) config!: PixiFormConfig;
  /** Live theme: preset accent name, palette, or full Theme. */
  @Input() theme?: ThemeInput;
  @Input() mode?: 'light' | 'dark' | 'auto';

  @Output() readonly ready = new EventEmitter<PixiFormHandle>();
  @Output() readonly success = new EventEmitter<SubmitResult>();
  @Output() readonly failure = new EventEmitter<SubmitResult>();
  @Output() readonly invalid = new EventEmitter<Record<string, string>>();
  /** Field name + value on every change (secret fields emit `Secret` handles). */
  @Output() readonly valueChange = new EventEmitter<{ name: string; value: unknown }>();
  /** First frame painted (timing and size). */
  @Output() readonly loaded = new EventEmitter<PixiFormEventMap['load']>();
  /** Every form event as { type, detail } (see PixiFormEventMap). */
  @Output() readonly formEvent = new EventEmitter<{ type: PixiFormEventType; detail: unknown }>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly zone = inject(NgZone);
  private handle: PixiFormHandle | null = null;
  private generation = 0;
  private viewReady = false;

  ngAfterViewInit(): void {
    this.viewReady = true;
    void this.mount();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.viewReady) return;
    if (changes['config']) {
      void this.mount();
    } else if ((changes['theme'] || changes['mode']) && this.handle) {
      this.handle.setTheme(this.theme ?? this.config.theme ?? 'indigo', this.mode);
    }
  }

  ngOnDestroy(): void {
    this.generation++;
    this.handle?.destroy(); // also wipes secret fields
    this.handle = null;
  }

  private async mount(): Promise<void> {
    const gen = ++this.generation;
    this.handle?.destroy();
    this.handle = null;
    const cfg = this.config;
    const handle = await this.zone.runOutsideAngular(() =>
      mountPixiForm(this.host.nativeElement, {
        ...cfg,
        theme: this.theme ?? cfg.theme,
        mode: this.mode ?? cfg.mode,
        // Run the app's submit handler inside the zone so its state changes render.
        onSubmit: cfg.onSubmit ? (values, form) => this.zone.run(() => cfg.onSubmit!(values, form)) : undefined,
        // Registered before mounting so 'load' isn't missed; outputs re-enter the zone.
        on: Object.fromEntries(
          PIXIFORM_EVENTS.map((type) => [
            type,
            (detail: unknown) => {
              (cfg.on?.[type] as ((d: unknown) => void) | undefined)?.(detail);
              if (gen !== this.generation) return;
              this.zone.run(() => {
                this.formEvent.emit({ type, detail });
                if (type === 'load') this.loaded.emit(detail as PixiFormEventMap['load']);
                if (type === 'success') this.success.emit((detail as PixiFormEventMap['success']).result);
                if (type === 'failure') this.failure.emit((detail as PixiFormEventMap['failure']).result);
                if (type === 'invalid') this.invalid.emit((detail as PixiFormEventMap['invalid']).errors);
                if (type === 'change') this.valueChange.emit(detail as PixiFormEventMap['change']);
              });
            },
          ]),
        ),
      }),
    );
    if (gen !== this.generation) {
      handle.destroy(); // destroyed or config replaced while mounting
      return;
    }
    this.handle = handle;
    this.zone.run(() => this.ready.emit(handle));
  }
}
