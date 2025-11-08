import { execSync } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { rollup } from 'rollup';
import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

async function buildExtension() {
  console.log('🔨 Building extension...');

  // Run vite build
  execSync('vite build', { stdio: 'inherit', cwd: rootDir });

  console.log('📦 Creating browser-specific builds...');

  const distDir = path.join(rootDir, 'dist');
  const distChrome = path.join(rootDir, 'dist-chrome');
  const distFirefox = path.join(rootDir, 'dist-firefox');

  // Clean previous builds
  await fs.remove(distChrome);
  await fs.remove(distFirefox);

  // Copy dist to dist-chrome
  console.log('📋 Creating Chrome build...');
  await fs.copy(distDir, distChrome);

  // Copy dist to dist-firefox
  console.log('📋 Creating Firefox build...');
  await fs.copy(distDir, distFirefox);

  // Replace manifest in Firefox build
  const firefoxManifest = path.join(rootDir, 'public', 'manifest-firefox.json');
  const firefoxManifestDest = path.join(distFirefox, 'manifest.json');
  await fs.copy(firefoxManifest, firefoxManifestDest);

  // Re-bundle background script for Firefox as IIFE (non-module)
  console.log('🔄 Rebuilding background script for Firefox...');
  const bundle = await rollup({
    input: path.join(rootDir, 'src', 'background.ts'),
    plugins: [
      resolve({ browser: true }),
      commonjs(),
      typescript({
        tsconfig: path.join(rootDir, 'tsconfig.json'),
        compilerOptions: {
          declaration: false,
          declarationMap: false,
          allowImportingTsExtensions: false,
          outDir: distFirefox
        }
      })
    ]
  });

  await bundle.write({
    file: path.join(distFirefox, 'background.js'),
    format: 'iife',
    name: 'TabGraphBackground',
    sourcemap: false
  });

  await bundle.close();

  // Clean up unnecessary manifest-firefox.json from both builds
  await fs.remove(path.join(distChrome, 'manifest-firefox.json'));
  await fs.remove(path.join(distFirefox, 'manifest-firefox.json'));

  console.log('✅ Build complete!');
  console.log(`   Chrome build: dist-chrome/`);
  console.log(`   Firefox build: dist-firefox/`);
}

buildExtension().catch((error) => {
  console.error('❌ Build failed:', error);
  process.exit(1);
});
