/**
 * React wrapper for PixiForm. Copy this file into your app.
 *
 *   <PixiForm config={config} onReady={(h) => (handleRef.current = h)} />
 *
 * - Mounts on first render, destroys on unmount (wiping secrets).
 * - Safe under <StrictMode> double-mounting and async races.
 * - Pass a NEW config object to rebuild the form; memoise it (useMemo) to avoid rebuilds.
 * - `theme`/`mode` props update live without rebuilding.
 * - `skeleton`: with server-side rendering (Next.js, Remix…), puts a lightweight placeholder with the
 *   labels in the server HTML; the form replaces it on its first frame (include PIXIFORM_SKELETON_CSS).
 */
import { useEffect, useMemo, useRef, type CSSProperties } from 'react';
import { mountPixiForm, type PixiFormConfig, type PixiFormHandle, type ThemeInput } from 'pixiformui';
import { pixiformSkeleton } from 'pixiformui/ssr';

export interface PixiFormProps {
  config: PixiFormConfig;
  theme?: ThemeInput;
  mode?: 'light' | 'dark' | 'auto';
  onReady?: (handle: PixiFormHandle) => void;
  className?: string;
  style?: CSSProperties;
  /** Render a placeholder until the form mounts (useful with SSR). */
  skeleton?: boolean;
}

export function PixiForm({ config, theme, mode, onReady, className, style, skeleton }: PixiFormProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<PixiFormHandle | null>(null);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let handle: PixiFormHandle | null = null;
    mountPixiForm(host, { ...config, theme: theme ?? config.theme, mode: mode ?? config.mode }).then((h) => {
      if (cancelled) return h.destroy(); // unmounted (or StrictMode re-ran) while mounting
      handle = handleRef.current = h;
      onReadyRef.current?.(h);
    });
    return () => {
      cancelled = true;
      handle?.destroy();
      handleRef.current = null;
    };
    // Rebuild only when the config object changes; theme/mode are applied below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  useEffect(() => {
    if (handleRef.current && (theme || mode)) handleRef.current.setTheme(theme ?? config.theme ?? 'indigo', mode);
  }, [theme, mode, config.theme]);

  // Same string on the server and in the browser, so hydration matches; the form removes it.
  const placeholder = useMemo(() => (skeleton ? { __html: pixiformSkeleton(config) } : undefined), [skeleton, config]);
  return <div ref={hostRef} className={className} style={style} dangerouslySetInnerHTML={placeholder} suppressHydrationWarning />;
}
