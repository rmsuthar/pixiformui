# Renderer

PixiForm draws with its own small scene graph on the browser's built-in **Canvas 2D** API
([src/lib/render/canvas.ts](../src/lib/render/canvas.ts), about 1,000 lines, no dependencies).

## Why Canvas 2D

| | |
| --- | --- |
| Size | The standalone bundle with every control is about 57 KB gzipped. |
| Many forms per page | No WebGL contexts, so there's no per-page limit: 20 forms on one page mount in about half a second. |
| Compatibility | Works wherever `<canvas>` does, including browsers or devices with WebGL disabled. |
| Content Security Policy | Needs only `script-src 'self'`: no `'unsafe-eval'`, no workers (`worker-src 'none'`), no `blob:` URLs. |
| Power use | Renders only when something changes; an idle form uses no CPU. |

## API

The primitives below are what the built-in controls use, and what custom controls are built from. Everything
is exported from the library entry:

```ts
import { Application, Container, Graphics, Text, Rectangle, Circle, type FederatedPointerEvent } from 'pixiformui';
```

- `Container`: children, `position`/`x`/`y`, `visible`, `alpha`, `mask`, `eventMode`, `cursor`, `hitArea`,
  `getBounds()`, `toLocal()`/`toGlobal()`, events via `on`/`off`/`emit`.
- `Graphics`: `rect`, `roundRect`, `circle`, `poly`, `moveTo`/`lineTo`/`arc`/`quadraticCurveTo`, then
  `fill(color | {color, alpha})` and `stroke({width, color, alpha, alignment, cap, join})`. Alignment `1` is inside,
  `0` outside and `0.5` centred.
- `Text`: plain text with `style` (font, size, weight, fill, lineHeight, wordWrap, wordWrapWidth, breakWords),
  `anchor`, measured `width`/`height`. Mutating `text.style.x` re-lays it out.
- Pointer events: `pointerdown`, `pointerup`, `pointerupoutside`, `pointertap`, `pointermove`,
  `globalpointermove`, `pointerover`/`pointerout`, and `wheel`, with bubbling and `stopPropagation()`.
- `Application`: `init({ width, height, resizeTo, background, backgroundAlpha, resolution })`, `stage`,
  `screen`, `canvas`, `ticker`, `renderer.resize()`, `renderer.background`, `render()`, `destroy()`.

## Limits (by design)

- Translation-only transforms: no scale, rotation or skew (PixiForm never uses them).
- Hit-testing without a `hitArea` uses bounding boxes. Interactive controls set `hitArea`.
- Wheel events are not cancelled by the renderer. A handler calls `e.preventDefault()` only when it actually
  scrolls (`ScrollView`, open `Select` menu), so the page scrolls normally over an embedded form.
