# Reflection

Vite's dev server improves developer experience through native ES module serving and hot module
replacement, so edits to `main.ts`, `resources.ts`, or `style.css` show up in the browser almost
instantly without a full page reload or losing UI state. For production, `vite build` runs the
project through Rollup, which tree-shakes unused code, minifies JS/CSS, and content-hashes output
filenames (see `dist/assets/index-*.js`) so browsers can cache assets aggressively across
deployments. This build produced ~4.5 KB of JS and ~4 KB of CSS gzipped for the whole dashboard,
far smaller than shipping the unbundled source with all its imports. Because the config in
`vite.config.ts` is explicit about `outDir` and `base`, the build stays predictable to deploy to
any static host without extra tooling. Overall, Vite removes the friction of manual bundling
while still producing an optimized artifact, letting the focus stay on the dashboard's logic
rather than build plumbing.
