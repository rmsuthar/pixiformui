# Releasing PixiFormUI

## One-time setup

1. **GitHub:** the repository is https://github.com/rmsuthar/pixiformui. Don't commit `.keys/` (it's in `.gitignore`).
2. **npm:** create an account at npmjs.com, enable two-factor authentication, then run `npm login`.
3. The package links to the repository automatically (override with `REPO_URL` if it moves).

## Every release

```bash
# 1. Bump the version (root package.json drives the package, the site and the /v/<version>/ downloads)
npm version patch --no-git-tag-version      # or minor / major
# 2. Update CHANGELOG.md
# 3. Check everything
npm run typecheck && npm test
# 4. Build the package and look at what will be published
npm run build:lib
cd dist-lib && npm pack --dry-run && cd ..
# 5. Publish (asks for your 2FA code)
cd dist-lib && npm publish && cd ..
# 6. Publish the website (install page shows the new version + integrity hashes)
npm run deploy:site
# 7. Tag the release
git commit -am "Release vX.Y.Z" && git tag vX.Y.Z && git push --follow-tags
```

After publishing, jsDelivr and unpkg serve the package automatically:
`https://cdn.jsdelivr.net/npm/pixiformui@X.Y.Z/pixiformui.standalone.js`.

## Notes

- Old versions stay downloadable from the website only if you keep their files: copy `dist-site/v/<old>/` forward
  or keep them in `site/public/v/<old>/` before building a new version.
- Never unpublish a version people depend on; publish a fixed patch release instead.
