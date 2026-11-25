import { SignupForm } from './SignupForm';

// A server component: this HTML (including the form's placeholder) is rendered on the server.
export default function Home() {
  return (
    <main>
      <header>
        <h1>{'{{name}}'}</h1>
        <p>A secure sign-up form built with PixiFormUI and Next.js.</p>
      </header>
      <SignupForm />
      <footer>
        Edit <code>src/form.ts</code> and <code>shared/fields.js</code>. <a href="https://pixiformui.lets.gen.in/docs/">PixiFormUI docs</a>
      </footer>
    </main>
  );
}
