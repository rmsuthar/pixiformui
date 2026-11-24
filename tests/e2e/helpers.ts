import { expect, type Page } from '@playwright/test';

/** Focuses a control the way a screen reader does: through its item in the accessibility outline. */
export async function focusField(page: Page, label: string, scope = 'body'): Promise<void> {
  // Names may carry state after a comma, e.g. "Country, nothing selected".
  const item = page
    .locator(`${scope} .pixiform-a11y [aria-label]`)
    .filter({ has: page.locator(':scope') })
    .and(page.locator(`[aria-label="${label}"], [aria-label^="${label}, "]`))
    .first();
  await expect(item).toBeAttached();
  await item.evaluate((el: HTMLElement) => el.focus());
  await expect(proxy(page)).toHaveAttribute('aria-label', new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
}

/** The single hidden input that relays keystrokes (it never holds field content). */
export const proxy = (page: Page) => page.locator('input[aria-label]').first();

/** True if `text` appears anywhere in the page's HTML or any input's value. */
export async function pageContains(page: Page, text: string): Promise<boolean> {
  return page.evaluate((t) => {
    const html = document.documentElement.outerHTML.replace(/aria-placeholder="[^"]*"/g, '');
    const values = [...document.querySelectorAll<HTMLInputElement>('input, textarea')].map((i) => i.value).join('\n');
    return html.includes(t) || values.includes(t);
  }, text);
}

/** Mounts a <pixi-form> on the plain-HTML example page and waits for its first frame. */
export async function mountElement(page: Page, config: string, id = 'f'): Promise<void> {
  await page.goto('/examples/html/index.html');
  await page.evaluate(
    async ({ config, id }) => {
      await customElements.whenDefined('pixi-form');
      document.getElementById('contact')?.remove();
      const el = document.createElement('pixi-form') as HTMLElement & { config: unknown };
      el.id = id;
      el.style.display = 'block';
      document.body.prepend(el);
      const loaded = new Promise((r) => el.addEventListener('pixiform-load', r, { once: true }));
      // eslint-disable-next-line no-new-func
      el.config = new Function(`return (${config});`)();
      await loaded;
    },
    { config, id },
  );
}
