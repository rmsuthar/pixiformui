/**
 * All-in-one bundle for plain HTML pages, with encrypted file uploads (one copy of the core).
 * Loading it registers <pixi-form> and the 'file' field type.
 *
 *   <script type="module" src="https://cdn.jsdelivr.net/npm/pixiformui@0.1/pixiformui-file.standalone.js"></script>
 *   … config: { upload: '/api/upload', fields: [{ type: 'file', name: 'cv', label: 'CV', accept: ['.pdf'] }] }
 */
export * from './standalone';
export * from './file/index';
