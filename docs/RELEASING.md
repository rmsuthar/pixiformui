# Releasing PixiFormUI

## One-time setup

1. **GitHub:** the repository is https://github.com/rmsuthar/pixiformui. Don't commit `.keys/` (it's in `.gitignore`).
2. **npm:** create an account at npmjs.com, enable two-factor authentication, then run `npm login`.
3. The package links to the repository automatically (override with `REPO_URL` if it moves).

## Every release

Releases are published by GitHub Actions ([.github/workflows/release.yml](../.github/workflows/release.yml)) with
**npm provenance**: the npm page shows that the package was built from this repository, and no npm token is stored
anywhere.

A release tag publishes two packages from the same version number:

| Package | What it is | Built by |
| --- | --- | --- |
| `pixiformui` | The library | `npm run build:lib` → `dist-lib/` |
| `create-pixiformui` | `npm create pixiformui@latest` starter apps (vanilla, React, Next.js) | `node packages/create-pixiformui/build.mjs` |

`create-pixiformui` goes out after the library, because its templates depend on `pixiformui@^X.Y.Z`. Its build
generates the templates' server libraries from this repository's sources and sets its version to match
`package.json`, so there is nothing to bump by hand. If its publish fails, the GitHub release is still created (the
step has `continue-on-error`); check that step's log after each release.

**One-time setup:** on npmjs.com open **each package** (`pixiformui` and `create-pixiformui`) → **Settings** →
**Trusted publishing** → **GitHub Actions**, and enter owner `rmsuthar`, repository `pixiformui`, workflow
`release.yml`. npm can only set this up for a package that already exists, so a new package's first version is
published by hand (`npm publish --access public` from its folder, after its build step). npm then takes a few minutes
to process a new package before `npm install` or `npm create` can download it.

```bash
# 1. Bump the version and update CHANGELOG.md (add a "## X.Y.Z" section)
npm version patch --no-git-tag-version      # or minor / major
# 2. Check everything locally
npm run typecheck && npm test && npm run test:e2e
# 3. Commit, tag and push: the Release workflow publishes both packages and creates the GitHub release
git commit -am "Release vX.Y.Z" && git tag vX.Y.Z
git push && git push origin vX.Y.Z           # push the tag by name: --follow-tags skips plain tags
# 3b. Watch it: both "Publish" steps should succeed (gh run watch, or the Actions tab)
# 4. Publish the website (the install page switches to the new version once it's on npm)
npm run deploy:site
# 5. Check the starter works from npm (a fresh cache avoids stale 404s)
npm_config_cache="$(mktemp -d)" npm create pixiformui@latest /tmp/pf-check -- --template next
```

After publishing, jsDelivr and unpkg serve the package automatically:
`https://cdn.jsdelivr.net/npm/pixiformui@X.Y.Z/pixiformui.standalone.js`.

## Notes

- **The tag must reach GitHub**, or nothing is published: `git ls-remote --tags origin vX.Y.Z` should print it.
  `git push --follow-tags` only pushes annotated tags (`git tag -a`), so push the tag by name.
- **If `create-pixiformui` fails to publish** (its step is allowed to fail): a `403 OIDC permission denied` means its
  trusted-publisher settings on npmjs.com don't match (owner `rmsuthar`, repository `pixiformui`, workflow
  `release.yml`, environment empty). Publish that version by hand: `node packages/create-pixiformui/build.mjs`, then
  `npm login` and `npm publish --access public` in `packages/create-pixiformui`. A `404 Not Found` on publish means
  you aren't logged in (`npm whoami`).
- `npm run deploy:site` uses the repository's pinned Wrangler (a devDependency): no global install needed. It also
  notifies IndexNow (Bing, Yandex, Naver, Seznam…) about every URL in the sitemap.
  Submit specific pages with `npm run indexnow -- /docs/install/`. The key file `site/public/<key>.txt` is public by
  design. Google doesn't use IndexNow: submit the sitemap in Search Console.
- The Install page advertises the latest version **on npm**, so deploying before `npm publish` never shows CDN links
  that 404; it switches to the new version on the first deploy after publishing.

- Old versions stay downloadable from the website only if you keep their files: copy `dist-site/v/<old>/` forward
  or keep them in `site/public/v/<old>/` before building a new version.
- Never unpublish a version people depend on; publish a fixed patch release instead.
- If a release changes how controls look, regenerate the guide's pictures before deploying the site:
  `npm run build:lib && npm run docs:images` (scenes are in `scripts/doc-images/harness.js`).

## Usage stats

`npm run stats` prints, from public sources with no setup: npm downloads (per version, with a 30-day trend), jsDelivr
CDN hits per version, and GitHub stars, forks and dependents ("used by"). GitHub's own traffic page shows repository
views, clones and referrers: https://github.com/rmsuthar/pixiformui/graphs/traffic

To see which websites use the script, search public code (GitHub code search for `pixiformui`) or website scanners
(for example PublicWWW for `pixiformui.standalone.js`).

The library itself contains no telemetry and never will: usage is measured only from the outside.

