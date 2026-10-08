# PackInspect

A package-inspection game. Inspect parcels and shipping labels against the day's
rule card, repair what can be saved, then ship or reject. You are paid at the end
of each day and spend it in the shop on better tools. Defects start mundane
(leaks, crushed corners) and get stranger (a box with no bottom).

## Play locally

```bash
yarn install
yarn dev
```

Add `?seed=1` to the URL for a repeatable run.

## Develop

```bash
yarn test     # unit tests
yarn build    # typecheck and production build into dist/
```

## Deploy to GitHub Pages

The workflow in `.github/workflows/deploy.yml` runs the tests, builds the game and
publishes it on every push to `main` (or by hand from the Actions tab).

One-time setup in your GitHub repo: **Settings → Pages → Build and deployment →
Source: GitHub Actions**. The game is then served at
`https://<user>.github.io/<repo>/`.
