# Releasing PixiFormUI

## One-time setup

1. **GitHub:** the repository is https://github.com/rmsuthar/pixiformui. Don't commit `.keys/` (it's in `.gitignore`).
2. **npm:** create an account at npmjs.com, enable two-factor authentication, then run `npm login`.
3. The package links to the repository automatically (override with `REPO_URL` if it moves).

## Every release

Releases are published by GitHub Actions ([.github/workflows/release.yml](../.github/workflows/release.yml)) with
**npm provenance**: the npm page shows that the package was built from this repository, and no npm token is stored
anywhere.

**One-time setup:** on npmjs.com open `pixiformui` → **Settings** → **Trusted publishing** → **GitHub Actions**, and
enter owner `rmsuthar`, repository `pixiformui`, workflow `release.yml`.

```bash
# 1. Bump the version and update CHANGELOG.md (add a "## X.Y.Z" section)
npm version patch --no-git-tag-version      # or minor / major
# 2. Check everything locally
npm run typecheck && npm test && npm run test:e2e
# 3. Commit, tag and push: the Release workflow publishes to npm and creates the GitHub release
git commit -am "Release vX.Y.Z" && git tag vX.Y.Z && git push --follow-tags
# 4. Publish the website (the install page switches to the new version once it's on npm)
npm run deploy:site
```

After publishing, jsDelivr and unpkg serve the package automatically:
`https://cdn.jsdelivr.net/npm/pixiformui@X.Y.Z/pixiformui.standalone.js`.

## Notes

- `npm run deploy:site` also notifies IndexNow (Bing, Yandex, Naver, Seznam…) about every URL in the sitemap.
  Submit specific pages with `npm run indexnow -- /docs/install/`. The key file `site/public/<key>.txt` is public by
  design. Google doesn't use IndexNow: submit the sitemap in Search Console.
- The Install page advertises the latest version **on npm**, so deploying before `npm publish` never shows CDN links
  that 404; it switches to the new version on the first deploy after publishing.

- Old versions stay downloadable from the website only if you keep their files: copy `dist-site/v/<old>/` forward
  or keep them in `site/public/v/<old>/` before building a new version.
- Never unpublish a version people depend on; publish a fixed patch release instead.
