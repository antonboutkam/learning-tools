/* Run from any directory: node path/to/build-v1.cjs */
const fs = require('node:fs/promises');
const path = require('node:path');
const { minify } = require('terser');
const CleanCSS = require('clean-css');
(async () => {
  for (const name of ['engine', 'app']) {
    const result = await minify(await fs.readFile(path.join(__dirname, name + '.js'), 'utf8'), { compress: true, mangle: true });
    await fs.writeFile(path.join(__dirname, name + '.min.js'), result.code + '\n');
  }
  const css = new CleanCSS({ level: 2 }).minify(await fs.readFile(path.join(__dirname, 'style.css'), 'utf8'));
  if (css.errors.length) throw Error(css.errors.join('\n'));
  await fs.writeFile(path.join(__dirname, 'style.min.css'), css.styles + '\n');
  console.log('Built engine.min.js, app.min.js, style.min.css');
})().catch(error => { console.error(error); process.exitCode = 1; });
