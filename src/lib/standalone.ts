/**
 * All-in-one bundle for plain HTML pages (no dependencies).
 * Loading it registers <pixi-form> automatically.
 *
 *   <script type="module" src="/vendor/pixiformui.standalone.js"></script>
 */
export * from './index';
import { definePixiFormElement } from './element';

definePixiFormElement();
