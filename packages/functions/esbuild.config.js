const esbuild = require('esbuild');
const {glob} = require('glob');
const fs = require('fs-extra');
const path = require('path');

const isProduction = process.argv.includes('--production');
const isWatch = process.argv.includes('--watch');

const srcDir = path.resolve(__dirname, 'src');
const outDir = path.resolve(__dirname, 'lib');

// Convert @functions imports to relative paths
async function transformAliasImports() {
  const jsFiles = glob.sync('**/*.js', {
    cwd: outDir,
    nodir: true,
    absolute: true
  });

  for (const filePath of jsFiles) {
    let content = await fs.readFile(filePath, 'utf-8');
    let modified = false;

    // Match all @functions/ imports in require() or import statements
    const aliasRegex = /require\(["']@functions\/([^"']+)["']\)/g;

    content = content.replace(aliasRegex, (match, importPath) => {
      modified = true;
      const fileDir = path.dirname(filePath);
      // Target should be in lib directory, not src
      const targetPath = path.join(outDir, importPath);

      // Calculate relative path from current file to target
      let relativePath = path.relative(fileDir, targetPath);

      // Ensure it starts with ./ or ../
      if (!relativePath.startsWith('.')) {
        relativePath = './' + relativePath;
      }

      // Convert Windows backslashes to forward slashes
      relativePath = relativePath.replace(/\\/g, '/');

      // Add .js extension if not present
      if (!relativePath.endsWith('.js')) {
        relativePath += '.js';
      }

      return `require("${relativePath}")`;
    });

    if (modified) {
      await fs.writeFile(filePath, content, 'utf-8');
    }
  }

  console.log('Transformed @functions aliases to relative paths');
}

async function copyNonJsFiles() {
  // Copy all non-JS files (like .ejs templates, .json, etc.)
  const nonJsFiles = glob.sync('**/*.!(js)', {
    cwd: srcDir,
    nodir: true,
    dot: true
  });

  for (const file of nonJsFiles) {
    const srcFile = path.join(srcDir, file);
    const destFile = path.join(outDir, file);
    await fs.ensureDir(path.dirname(destFile));
    await fs.copy(srcFile, destFile);
  }

  if (nonJsFiles.length > 0) {
    console.log(`Copied ${nonJsFiles.length} non-JS files`);
  }
}

async function build() {
  try {
    // Ensure output directory exists (don't clean to avoid permission issues)
    await fs.ensureDir(outDir);

    // Find all .js files in src
    const entryPoints = glob.sync('**/*.js', {
      cwd: srcDir,
      nodir: true,
      absolute: true
    });

    console.log(`Building ${entryPoints.length} files...`);

    const buildOptions = {
      entryPoints,
      outdir: outDir,
      bundle: false, // Don't bundle, keep file structure
      platform: 'node',
      target: 'node20',
      format: 'cjs', // Convert to CommonJS for Firebase Functions
      sourcemap: !isProduction,
      minify: isProduction,
      keepNames: true, // Preserve function names for debugging
      logLevel: 'info',
      outbase: srcDir, // Preserve directory structure
      // Handle path aliases
      plugins: [
        {
          name: 'alias-resolver',
          setup(build) {
            // Resolve @functions alias to ./src
            build.onResolve({filter: /^@functions\//}, args => {
              const importPath = args.path.replace('@functions/', '');
              return {
                path: path.resolve(srcDir, importPath + (importPath.endsWith('.js') ? '' : '.js')),
                external: false
              };
            });
          }
        }
      ]
    };

    if (isWatch) {
      console.log('Starting watch mode...');

      // Create esbuild context with plugins for watch mode
      const watchOptions = {
        ...buildOptions,
        plugins: [
          ...buildOptions.plugins,
          {
            name: 'on-end',
            setup(build) {
              build.onEnd(async () => {
                await transformAliasImports();
              });
            }
          }
        ]
      };

      const ctx = await esbuild.context(watchOptions);
      await ctx.watch();
      console.log('Watching for changes...');

      // Also watch for non-JS file changes
      const chokidar = require('chokidar');
      const watcher = chokidar.watch(srcDir, {
        ignored: /\.js$/,
        persistent: true
      });

      watcher.on('change', async changedPath => {
        const relativePath = path.relative(srcDir, changedPath);
        const destPath = path.join(outDir, relativePath);
        await fs.ensureDir(path.dirname(destPath));
        await fs.copy(changedPath, destPath);
        console.log(`Copied: ${relativePath}`);
      });

      // Initial copy of non-JS files and transform aliases
      await copyNonJsFiles();
      await transformAliasImports();
    } else {
      await esbuild.build(buildOptions);
      await copyNonJsFiles();
      await transformAliasImports();
      console.log('Build completed!');
    }
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

build();
