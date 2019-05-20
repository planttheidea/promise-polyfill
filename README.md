# promise-polyfill

Promise polyfill with custom opt-in error handling for debug

Simple web implementation of the polyfill, with custom debug handling (opt-in).

## Setup

```
git clone git@github.com:planttheidea/promise-polyfill.git
yarn install
yarn dev
```

Once spun up, go to `http://localhost:3000` in the browser and open the console. You'll see log outputs that reflect expectations.

A high-level overview:

- `App.ts` is the app where the eyeball tests are
- `Promise.ts` is the actual polyfill implementation
  - A lot of it translates, but some of it is shimmed for web
- `index.ts` is the webpack entry point, it basically just pulls in App and runs stuff
