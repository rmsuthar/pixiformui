# create-pixiformui

Start a [PixiFormUI](https://pixiformui.lets.gen.in) app: a demo sign-up form and a secure Node server.

```sh
npm create pixiformui@latest my-app
npm create pixiformui@latest my-app -- --template react
npm create pixiformui@latest my-app -- --template next
```

Templates: `vanilla` (TypeScript + Vite), `react` (React 19 + TypeScript + Vite) and `next` (Next.js 16 App Router with
server-side rendering: the page and a placeholder for the form render on the server).

You get a working form with conditional fields, a hidden field, encrypted passwords, an invisible proof-of-work,
a human check and duplicate-submission protection, plus a dependency-free server that checks all of it and
validates with the same field definitions as the browser.
