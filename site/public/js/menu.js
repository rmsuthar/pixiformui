// Mobile header menu (progressive enhancement; external file so the strict CSP needs no 'unsafe-inline').
(() => {
  const header = document.querySelector('.nav');
  const button = header && header.querySelector('.menu-toggle');
  const nav = header && header.querySelector('#site-nav');
  if (!button || !nav) return;
  header.classList.add('nav-js');
  button.hidden = false;
  const setOpen = (open) => {
    header.classList.toggle('open', open);
    button.setAttribute('aria-expanded', String(open));
    button.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  };
  button.addEventListener('click', () => setOpen(!header.classList.contains('open')));
  nav.addEventListener('click', (e) => e.target.closest('a') && setOpen(false));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && header.classList.contains('open')) {
      setOpen(false);
      button.focus();
    }
  });
  document.addEventListener('click', (e) => header.classList.contains('open') && !header.contains(e.target) && setOpen(false));
  matchMedia('(min-width: 821px)').addEventListener('change', (e) => e.matches && setOpen(false));
})();
