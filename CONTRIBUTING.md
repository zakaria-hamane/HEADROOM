# Contributing to Headroom

Thanks for helping people size their GPUs before they buy them. Bug reports, accuracy checks against real hardware, new models and GPUs, and code are all welcome.

## The quickest ways to help

- **Request a model or GPU** that's missing: [open a request](https://github.com/zakaria-hamane/HEADROOM/issues/new?template=model-or-gpu.yml).
- **Report a number that looks wrong**: tell us the setup (or paste the setup code from *Copy summary*) and what you measured. Real measurements are the most valuable thing you can send.
- **Fix something**: issues labeled `good first issue` are a good start.

## Run it locally

Requires Node.js 22.9 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:3000. No database setup is needed: without `DATABASE_URL`, accounts and plans live in an embedded Postgres in `./.data`. Password-reset links are printed in the terminal.

Before you open a pull request:

```bash
npm run check   # type-check, lint, engine parity and planner tests
npm run build   # production build
```

CI runs the same two commands on every pull request.

## Adding a model or a GPU

The catalog is one file: `src/data/catalog.json`.

- **Models** need their architecture from the published config (`config.json` on the model card): parameters, layers, hidden size, attention heads and KV heads, head dimension, max context, sliding window if any, and MoE details for mixture-of-experts models.
- **GPUs** need memory (GB), memory bandwidth (GB/s), dense FP16/BF16 and lower-precision TFLOPS without sparsity, interconnect, power and a typical cloud price per hour. Link the vendor datasheet in the pull request.

Run `npm test` afterwards: the parity tests run every model through the engine, so a malformed entry fails fast.

## Changing the engine

`src/lib/engine` is a line-by-line port of the original single-file planner, and `tests/engine.parity.test.ts` requires identical results from both. If you are fixing a formula on purpose, update `tests/fixtures/original-engine.cjs` the same way and explain the change (with a source) in the pull request.

## Pull requests

- Keep each pull request to one change, with a short description of what and why.
- Include a screenshot for UI changes, in light and dark themes when colors are involved.
- Don't commit `.env.local`, `.data/` or any secrets.

## License of contributions

Headroom is licensed under [AGPL-3.0](LICENSE). By opening a pull request you agree that your contribution is licensed under the same terms. The maintainer may ask you to sign a contributor license agreement before merging larger changes, so the project can keep offering commercial licenses.
