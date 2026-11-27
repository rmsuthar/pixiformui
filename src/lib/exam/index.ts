/**
 * pixiformui/exam: timed exams and quizzes, one question per screen.
 *
 *   import { mountExam } from 'pixiformui/exam';
 *   const exam = await mountExam(host, { title: 'Unit 3 quiz', action: '/api/answers', session: '/api/session' }, {
 *     timeLimit: 20 * 60,
 *     shuffleQuestions: true,
 *     questions: [
 *       { id: 'q1', text: 'Which planet is largest?', options: ['Earth', 'Jupiter', 'Mars'] },
 *       { id: 'q2', text: 'Explain photosynthesis in one sentence.', answer: 'long' },
 *     ],
 *   });
 *
 * Built on multi-step forms: a countdown, a question navigator (answered / current / marked for review),
 * "Mark for review", optional no-going-back and shuffling, a warning before finishing with unanswered
 * questions, automatic submission when time is up, and focus-loss counting. The submission carries every
 * answer plus `examReport` (time taken, marked questions, how it ended, and an integrity log of rule breaks and
 * signals with their times: leaving the tab or window, leaving full screen, pasting, typing bursts…).
 *
 * Correct answers never belong in the browser: score on your server (option values stay the same when
 * options are shuffled). Questions are drawn on the canvas, so they aren't in the page's HTML, though screen
 * readers still receive them through the accessibility outline.
 */
import { Checkbox, Container, Control, Graphics, Rectangle, Text, mountPixiForm, type FieldConfig, type FormUI, type PixiFormConfig, type PixiFormHandle } from '../index';

export interface ExamQuestion {
  /** Field name for the answer (letters, digits, _ . -; starts with a letter). */
  id: string;
  text: string;
  /** Multiple choice. Plain strings get the values 'a', 'b', 'c'… in the order written. */
  options?: (string | { value: string; label: string })[];
  /** Without options: 'text' (one line, default) or 'long' (a paragraph). */
  answer?: 'text' | 'long';
}

export interface ExamOptions {
  questions: ExamQuestion[];
  /** Seconds from now. Prefer `endsAt` from your server, so a reload doesn't restart the clock. */
  timeLimit?: number;
  /** When the exam ends (epoch ms). */
  endsAt?: number;
  /** False: answers can't be revisited (no Back, no navigator jumps backwards). Default true. */
  allowBack?: boolean;
  /** Show the question navigator. Default true (hidden when allowBack is false). */
  navigator?: boolean;
  shuffleQuestions?: boolean;
  shuffleOptions?: boolean;
  /** Progress caption. Default 'Question {n} of {total}'. */
  questionLabel?: string;
  onTimeUp?: () => void;
  /** The window lost focus (another tab or app). */
  onFocusLost?: (count: number) => void;
  /** Exam rules, all optional. Every event is logged in `examReport.integrity` either way. */
  integrity?: {
    /** Ask for full screen at the start and log each exit as a rule break. */
    requireFullscreen?: boolean;
    /** Block pasting into answers (it's logged either way). */
    blockPaste?: boolean;
    /** Submit automatically after this many rule breaks (leaving the page, leaving full screen, pasting). */
    maxViolations?: number;
    /** Tell the candidate when a rule break is recorded. Default true. */
    warn?: boolean;
  };
  /** A rule break was recorded. */
  onViolation?: (type: IntegrityEventType, count: number) => void;
}

/**
 * What the integrity log records. Rule breaks: tab-hidden, window-blur, fullscreen-exit, paste.
 * Signals (logged only): typing-burst, resize (a narrow, split-screen window), extended-display (a second
 * screen, Chromium only), devtools-shortcut, print, context-menu. Screenshots can't be detected by browsers.
 */
export type IntegrityEventType = 'tab-hidden' | 'window-blur' | 'fullscreen-exit' | 'paste' | 'typing-burst' | 'resize' | 'extended-display' | 'devtools-shortcut' | 'print' | 'context-menu';
export interface IntegrityEvent {
  type: IntegrityEventType;
  /** Milliseconds after the exam started. */
  at: number;
  /** How long the candidate was away (leaving events). */
  ms?: number;
  /** Characters pasted or inserted at once (never the text). */
  size?: number;
}
const VIOLATIONS = new Set<IntegrityEventType>(['tab-hidden', 'window-blur', 'fullscreen-exit', 'paste']);

export interface Exam {
  readonly handle: PixiFormHandle;
  /** Milliseconds left (Infinity without a time limit). */
  readonly remainingMs: number;
  readonly marked: string[];
  readonly focusLost: number;
  /** Rule breaks so far. */
  readonly violations: number;
  readonly integrity: { violations: number; counts: Partial<Record<IntegrityEventType, number>>; events: IntegrityEvent[] };
}

/** Fisher–Yates with crypto randomness. */
function shuffle<T>(list: readonly T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const clock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(h ? 2 : 1, '0');
  return `${h ? `${h}:` : ''}${mm}:${String(s % 60).padStart(2, '0')}`;
};

function answerField(q: ExamQuestion, shuffleOptions: boolean): FieldConfig {
  if (q.options?.length) {
    let options = q.options.map((o, i) => (typeof o === 'string' ? { value: String.fromCharCode(97 + i), label: o } : o));
    if (shuffleOptions) options = shuffle(options);
    return { type: 'radio', name: q.id, label: 'Your answer', hideLabel: true, options };
  }
  return q.answer === 'long' ? { type: 'textarea', name: q.id, label: 'Your answer', rows: 5, maxLength: 5000 } : { type: 'text', name: q.id, label: 'Your answer', maxLength: 500 };
}

// ------------------------------------------------------------------ question navigator
/** Numbered squares: answered (filled), current (ring), marked for review (amber). Arrow keys + Enter. */
class ExamNavigator extends Control<number> {
  override readonly isAction = true; // never validated or submitted
  private pick = 0;
  current = 0;
  private readonly cells = new Graphics();
  private readonly labels: Text[] = [];
  constructor(
    ui: FormUI,
    private readonly count: number,
    private readonly answered: (i: number) => boolean,
    private readonly isMarked: (i: number) => boolean,
    private readonly onJump: (i: number) => void,
  ) {
    super(ui, { name: 'examNavigator', label: 'Questions' });
    this.body.addChild(this.cells);
    for (let i = 0; i < count; i++) this.body.addChild((this.labels[i] = new Text({ text: String(i + 1) })));
    this.body.eventMode = 'static';
    this.body.cursor = 'pointer'; // the mouse pointer
    this.bindTap(this.body, (e) => {
      const p = e.getLocalPosition(this.body);
      const i = this.cellAt(p.x, p.y);
      if (i >= 0) this.onJump(i);
    });
    this.redraw();
  }
  private get size() {
    return 34;
  }
  private perRow(): number {
    return Math.max(1, Math.floor((this._width + 6) / (this.size + 6)));
  }
  private cellAt(x: number, y: number): number {
    const s = this.size + 6;
    const i = Math.floor(y / s) * this.perRow() + Math.floor(x / s);
    return x % s <= this.size && y % s <= this.size && i < this.count ? i : -1;
  }
  setCurrent(i: number): void {
    this.current = this.pick = i;
    this.redraw();
  }
  refresh(): void {
    this.drawBody();
    this.ui.focus.sync(this);
  }
  getValue(): number {
    return this.pick;
  }
  setValue(): void {}
  reset(): void {}
  isEmpty(): boolean {
    return false;
  }
  private state(i: number): string {
    return `${this.answered(i) ? 'answered' : 'not answered'}${this.isMarked(i) ? ', marked for review' : ''}${i === this.current ? ', current' : ''}`;
  }
  override ariaRole(): string {
    return 'button';
  }
  override ariaLabel(): string {
    return `Go to question ${this.pick + 1} of ${this.count} (${this.state(this.pick)})`;
  }
  override ariaDescription(): { help?: string; error?: string } {
    let done = 0;
    let marked = 0;
    for (let i = 0; i < this.count; i++) {
      if (this.answered(i)) done++;
      if (this.isMarked(i)) marked++;
    }
    return { help: `Question navigator: arrow keys choose a question, Enter goes there. ${done} of ${this.count} answered${marked ? `, ${marked} marked for review` : ''}.` };
  }
  override handleKeyDown(e: KeyboardEvent): boolean {
    const per = this.perRow();
    const moves: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: per, ArrowUp: -per };
    if (e.key in moves) this.pick = Math.min(this.count - 1, Math.max(0, this.pick + moves[e.key]));
    else if (e.key === 'Home') this.pick = 0;
    else if (e.key === 'End') this.pick = this.count - 1;
    else if (e.key === 'Enter' || e.key === ' ') {
      this.onJump(this.pick);
      return true;
    } else return false;
    this.refresh();
    return true;
  }
  protected bodyHeight(): number {
    if (!this.count) return 0;
    return Math.ceil(this.count / this.perRow()) * (this.size + 6) - 6;
  }
  protected drawBody(): void {
    if (!this.labels) return;
    const t = this.theme;
    const c = t.colors;
    const s = this.size;
    const per = this.perRow();
    const g = this.cells.clear();
    for (let i = 0; i < this.count; i++) {
      const x = (i % per) * (s + 6);
      const y = Math.floor(i / per) * (s + 6);
      const done = this.answered(i);
      const marked = this.isMarked(i);
      g.roundRect(x, y, s, s, 8).fill(done ? c.primary : c.surface);
      g.roundRect(x, y, s, s, 8).stroke({ width: i === this.current ? 2.5 : 1, color: marked ? c.warning : i === this.current ? c.borderFocus : c.border, alignment: 1 });
      if (marked) g.circle(x + s - 6, y + 6, 3.5).fill(c.warning);
      if (this._focused && this._focusVisible && i === this.pick) g.roundRect(x - 4, y - 4, s + 8, s + 8, 11).stroke({ width: t.focusRingWidth, color: c.focusRing });
      const label = this.labels[i];
      label.style = this.textStyle('helper', done ? c.primaryText : c.text);
      label.position.set(Math.round(x + (s - label.width) / 2), Math.round(y + (s - label.height) / 2));
    }
    this.body.hitArea = new Rectangle(0, 0, this._width, this.bodyHeight());
  }
}

// ------------------------------------------------------------------ header: timer, mark for review, navigator
class ExamHeader extends Container {
  /** Not in the accessibility outline: announced at 5 and 1 minutes instead of on every tick. */
  private readonly timer = new Text({ text: '' });
  readonly mark: Checkbox;
  readonly navigator: ExamNavigator | null;
  private width_ = 0;
  private height_ = 0;
  private remaining = Infinity;
  constructor(
    private readonly ui: FormUI,
    count: number,
    answered: (i: number) => boolean,
    isMarked: (i: number) => boolean,
    onJump: (i: number) => void,
    withNavigator: boolean,
  ) {
    super();
    this.mark = new Checkbox(ui, { name: 'examMarkForReview', label: 'Mark for review' });
    this.navigator = withNavigator ? new ExamNavigator(ui, count, answered, isMarked, onJump) : null;
    this.addChild(this.timer, this.mark, ...(this.navigator ? [this.navigator] : []));
    for (const c of [this.mark, this.navigator]) c?.on('resize', () => this.layout(this.width_));
    ui.on('themechange', () => this.layout(this.width_));
  }
  setTime(ms: number): void {
    this.remaining = ms;
    this.paintTimer();
  }
  private paintTimer(): void {
    const t = this.ui.theme;
    const low = this.remaining <= 60_000;
    this.timer.visible = Number.isFinite(this.remaining);
    this.timer.text = `Time left ${clock(this.remaining)}`;
    this.timer.style = { fontFamily: t.fontFamily.join(','), fontSize: t.fontSize, fontWeight: '700', fill: low ? t.colors.error : t.colors.text };
  }
  get layoutHeight(): number {
    return this.height_;
  }
  layout(width: number): void {
    this.width_ = width;
    this.paintTimer();
    const markW = Math.min(200, width);
    this.mark.layout(markW);
    const timerW = this.timer.visible ? Math.ceil(this.timer.width) : 0;
    let y: number;
    if (timerW + 16 + markW <= width) {
      // Side by side: the timer on the left, "Mark for review" on the right.
      const rowH = Math.max(this.mark.layoutHeight, Math.ceil(this.timer.height));
      this.timer.position.set(0, Math.round((rowH - this.timer.height) / 2));
      this.mark.position.set(width - markW, Math.round((rowH - this.mark.layoutHeight) / 2));
      y = rowH;
    } else {
      // Narrow screens: stacked.
      this.timer.position.set(0, 0);
      const top = this.timer.visible ? Math.ceil(this.timer.height) + 8 : 0;
      this.mark.position.set(0, top);
      y = top + this.mark.layoutHeight;
    }
    if (this.navigator) {
      this.navigator.layout(width);
      this.navigator.position.set(0, y + 14);
      y += 14 + this.navigator.layoutHeight;
    }
    this.height_ = y;
    this.emit('resize', this);
  }
}

// ------------------------------------------------------------------ mountExam
export async function mountExam(host: HTMLElement, base: Omit<PixiFormConfig, 'fields' | 'steps'>, exam: ExamOptions): Promise<Exam> {
  if (!exam.questions?.length) throw new Error('mountExam: add at least one question');
  const qs = exam.shuffleQuestions ? shuffle(exam.questions) : [...exam.questions];
  const marked = new Set<string>();
  const startedAt = Date.now();
  const endsAt = exam.endsAt ?? (exam.timeLimit ? startedAt + exam.timeLimit * 1000 : Infinity);
  let handle!: PixiFormHandle;
  let header!: ExamHeader;
  let focusLost = 0;
  let timedOut = false;
  const answered = (i: number) => !!handle && !handle.get(qs[i].id)?.isEmpty();
  const allowBack = exam.allowBack !== false;
  const jump = (i: number) => {
    if (!allowBack && i < handle.currentStep) return;
    handle.goToStep(i);
  };

  const steps = qs.map((q, i) => ({
    title: q.text,
    fields: [answerField(q, !!exam.shuffleOptions), ...(i === qs.length - 1 ? [{ type: 'hidden', name: 'examReport', value: '' } as FieldConfig] : [])],
  }));
  handle = await mountPixiForm(host, {
    ...base,
    steps,
    allowBack,
    stepLabel: exam.questionLabel ?? base.stepLabel ?? 'Question {n} of {total}',
    nextText: base.nextText ?? 'Next question',
    submitText: base.submitText ?? 'Finish exam',
    header: (ui) => (header = new ExamHeader(ui, qs.length, answered, (i) => marked.has(qs[i].id), jump, exam.navigator !== false && allowBack)),
  });

  // Navigator and "Mark for review" follow the current question.
  const sync = () => {
    header.navigator?.setCurrent(Math.max(0, handle.currentStep));
    header.mark.setValue(marked.has(qs[Math.max(0, handle.currentStep)].id), false);
  };
  sync();
  handle.on('step', sync);
  handle.on('change', () => {
    confirmed = false;
    header.navigator?.refresh();
  });
  header.mark.on('change', (on: boolean) => {
    const id = qs[Math.max(0, handle.currentStep)].id;
    if (on) marked.add(id);
    else marked.delete(id);
    header.navigator?.refresh();
  });

  // Finishing with unanswered questions asks once.
  let confirmed = false;
  handle.on('beforesubmit', (e) => {
    if (timedOut) return;
    const open = qs.filter((_, i) => !answered(i)).length;
    if (open && !confirmed) {
      e.preventDefault();
      confirmed = true;
      handle.toast(`${open} question${open === 1 ? ' is' : 's are'} unanswered. Press “${base.submitText ?? 'Finish exam'}” again to submit anyway.`, 'info');
    }
  });
  // ---- integrity log: what happened, why it counts, when and for how long (never any content)
  const opts = exam.integrity ?? {};
  const events: IntegrityEvent[] = [];
  const counts: Partial<Record<IntegrityEventType, number>> = {};
  let violations = 0;
  let endedBy: 'candidate' | 'time' | 'violations' = 'candidate';
  const record = (type: IntegrityEventType, extra: { ms?: number; size?: number } = {}) => {
    counts[type] = (counts[type] ?? 0) + 1;
    if (events.length < 200) events.push({ type, at: Date.now() - startedAt, ...extra });
    if (!VIOLATIONS.has(type)) return;
    violations++;
    exam.onViolation?.(type, violations);
    if (timedOut || handle.form.locked) return;
    const max = opts.maxViolations;
    if (max && violations >= max) return void finishEarly();
    if (opts.warn !== false) {
      const what = { 'tab-hidden': 'You left the exam tab', 'window-blur': 'You left the exam window', 'fullscreen-exit': 'You left full screen', paste: opts.blockPaste ? 'Pasting isn’t allowed' : 'Pasting was recorded' }[type as 'paste'];
      handle.toast(`${what}. ${max ? `${violations} of ${max} allowed.` : 'This is recorded in your report.'}`, 'error');
    }
  };
  const finishEarly = async () => {
    endedBy = 'violations';
    timedOut = true; // skip the unanswered question warning
    clearInterval(timer);
    handle.toast('Too many rule breaks: submitting your answers now.', 'error');
    const result = await handle.form.submit({ skipValidation: true });
    if (result?.ok !== false) handle.form.lock();
  };
  const report = () => ({ timeTakenMs: Date.now() - startedAt, focusLost, marked: [...marked], timedOut: endedBy === 'time', endedBy, integrity: { violations, counts, events } });
  handle.form.on('submitstart', () => handle.get('examReport')?.setValue(JSON.stringify(report()), false));

  // Countdown: announced at 5 and 1 minutes; at zero the answers are submitted and the form locks.
  let timer = 0;
  const said = new Set<number>();
  const tick = async () => {
    const left = endsAt - Date.now();
    header.setTime(left);
    for (const m of [5, 1]) {
      if (left <= m * 60_000 && left > (m * 60_000 - 1500) && !said.has(m)) {
        said.add(m);
        handle.ui.announcer.announce(`${m} minute${m === 1 ? '' : 's'} left.`, true);
      }
    }
    if (left > 0 || timedOut) return;
    clearInterval(timer);
    timedOut = true;
    endedBy = 'time';
    handle.toast('Time is up. Submitting your answers…', 'info');
    const result = await handle.form.submit({ skipValidation: true });
    if (result?.ok !== false) handle.form.lock();
    exam.onTimeUp?.();
  };
  if (Number.isFinite(endsAt)) {
    void tick();
    timer = setInterval(() => void tick(), 1000) as unknown as number;
  }

  // Leaving: another tab (hidden) or another window or app (blur). One departure = one event, with its length.
  let away: { since: number; hidden: boolean; logged: boolean } | null = null;
  let pending = 0;
  const lastLeave = () => [...events].reverse().find((e) => e.type === 'tab-hidden' || e.type === 'window-blur');
  const log = (hidden: boolean) => {
    if (!away || away.logged) return;
    away.logged = true;
    focusLost++;
    exam.onFocusLost?.(focusLost);
    record(hidden ? 'tab-hidden' : 'window-blur');
  };
  const leave = (hidden: boolean) => {
    if (!away) away = { since: Date.now(), hidden, logged: false };
    if (hidden) {
      // Switching tabs fires blur, then hidden: one departure, logged as a tab switch.
      clearTimeout(pending);
      away.hidden = true;
      if (!away.logged) log(true);
      else {
        const last = lastLeave();
        if (last?.type === 'window-blur') {
          last.type = 'tab-hidden';
          counts['window-blur'] = (counts['window-blur'] ?? 1) - 1;
          counts['tab-hidden'] = (counts['tab-hidden'] ?? 0) + 1;
        }
      }
    } else if (!away.logged) {
      // Another window or app: logged if it lasts (blips such as the browser's own menus are ignored).
      clearTimeout(pending);
      pending = setTimeout(() => log(false), 250) as unknown as number;
    }
  };
  const back = () => {
    clearTimeout(pending);
    if (!away) return;
    const last = away.logged ? lastLeave() : null;
    if (last) last.ms = Date.now() - away.since;
    away = null;
  };
  const onBlur = () => leave(false);
  const onVisibility = () => (document.visibilityState === 'hidden' ? leave(true) : back());
  const onFocus = () => back();

  // Full screen (optional): asked for on the first interaction (browsers need a gesture), again after leaving.
  let wasFullscreen = false;
  const askFullscreen = () => {
    if (!opts.requireFullscreen || document.fullscreenElement || handle.form.locked) return;
    void document.documentElement.requestFullscreen?.().catch(() => undefined);
  };
  const onFullscreen = () => {
    if (document.fullscreenElement) wasFullscreen = true;
    else if (wasFullscreen && !handle.form.locked) record('fullscreen-exit');
  };
  const host_ = handle.ui.app.canvas.parentElement;
  const offInteraction = handle.ui.onInteraction(() => askFullscreen());

  // Pasting into an answer: recorded (its length only), or blocked. Capture runs before the field sees it.
  const onPaste = (e: ClipboardEvent) => {
    if (!e.isTrusted) return; // only real pastes by the candidate
    record('paste', { size: e.clipboardData?.getData('text').length ?? 0 });
    if (opts.blockPaste) {
      e.preventDefault();
      e.stopPropagation();
    }
  };
  // Text appearing in a burst (an auto-typer or pasted some other way) in open answers.
  const lastText = new Map<string, { len: number; at: number }>();
  handle.on('change', ({ name, value }) => {
    if (typeof value !== 'string' || !qs.some((q) => q.id === name)) return;
    const prev = lastText.get(name) ?? { len: 0, at: Date.now() };
    if (value.length - prev.len >= 40 && Date.now() - prev.at < 500) record('typing-burst', { size: value.length - prev.len });
    lastText.set(name, { len: value.length, at: Date.now() });
  });
  // Signals (recorded, not counted as rule breaks): a narrow window (split screen), a second screen,
  // developer-tool or print shortcuts, printing, the context menu.
  let narrow = false;
  const onResize = () => {
    const now = window.innerWidth < (screen.availWidth || window.innerWidth) * 0.7;
    if (now && !narrow) record('resize');
    narrow = now;
  };
  if ((screen as unknown as { isExtended?: boolean }).isExtended) record('extended-display');
  const onKey = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    const mod = e.ctrlKey || e.metaKey;
    if (e.key === 'F12' || (mod && e.shiftKey && ['i', 'j', 'c'].includes(k)) || (mod && k === 'u')) record('devtools-shortcut');
    else if (mod && k === 'p') record('print');
  };
  const onPrint = () => record('print');
  const onMenu = () => record('context-menu');
  window.addEventListener('blur', onBlur);
  window.addEventListener('focus', onFocus);
  window.addEventListener('resize', onResize);
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('beforeprint', onPrint);
  document.addEventListener('visibilitychange', onVisibility);
  document.addEventListener('fullscreenchange', onFullscreen);
  host_?.addEventListener('paste', onPaste, true);
  host_?.addEventListener('contextmenu', onMenu);
  handle.on('destroy', () => {
    clearInterval(timer);
    clearTimeout(pending);
    offInteraction();
    window.removeEventListener('blur', onBlur);
    window.removeEventListener('focus', onFocus);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('beforeprint', onPrint);
    document.removeEventListener('visibilitychange', onVisibility);
    document.removeEventListener('fullscreenchange', onFullscreen);
    host_?.removeEventListener('paste', onPaste, true);
    host_?.removeEventListener('contextmenu', onMenu);
  });

  return {
    handle,
    get remainingMs() {
      return endsAt - Date.now();
    },
    get marked() {
      return [...marked];
    },
    get focusLost() {
      return focusLost;
    },
    get violations() {
      return violations;
    },
    get integrity() {
      return { violations, counts: { ...counts }, events: events.map((e) => ({ ...e })) };
    },
  };
}
