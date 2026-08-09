// .cjs extension is deliberate: package.json sets "type": "module" for the
// whole project (the real source code uses native ES modules), but Jest's
// own config/tooling loading works most reliably as plain CommonJS. Naming
// this file with .cjs tells Node "treat this one file as CommonJS" no
// matter what the package.json says everywhere else.
//
// Plain language: this file tells Jest's helper (Babel) "when a test needs
// one of our source files, quietly translate its modern `import`/`export`
// syntax into the older `require`/`module.exports` syntax Jest understands,
// on the fly, without changing the actual source files on disk."
module.exports = {
  presets: [['@babel/preset-env', { targets: { node: 'current' } }]],
};
