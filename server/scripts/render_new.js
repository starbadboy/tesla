const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const SCRIPT = path.join(ROOT, 'scripts', 'render-wraps.mjs');

/**
 * Renders the wraps that have no thumbnail yet — in practice, whatever the scrapers just
 * added. Run after them so a new wrap reaches the 3D gallery and the hover swap on the
 * same day it arrives, instead of waiting for someone to run the batch by hand.
 *
 * A separate process rather than an import: the renderer drives a headless browser
 * against this very server, and a crash in Chromium then cannot take the API down with
 * it. It is also best-effort — without a browser installed there is nothing to render
 * with, so it says so and returns rather than failing the job.
 */
function renderNewWraps() {
    try {
        require.resolve('playwright');
    } catch {
        console.warn('Render skipped: playwright is not installed here. Install it and its '
            + 'chromium build to have new wraps rendered automatically.');
        return Promise.resolve();
    }

    const base = `http://localhost:${process.env.PORT || 5001}`;
    console.log(`Rendering new wraps against ${base}`);

    return new Promise(resolve => {
        const child = spawn(process.execPath, [SCRIPT, `--base=${base}`], { cwd: ROOT, stdio: 'inherit' });
        child.on('error', error => {
            console.error('Render failed to start:', error.message);
            resolve();
        });
        child.on('exit', code => {
            if (code !== 0) console.error(`Render exited with code ${code}`);
            resolve();
        });
    });
}

module.exports = { renderNewWraps };
