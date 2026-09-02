// One real API generation using the app's request builder. Results stay local.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import generation from '../server/utils/wrapGeneration.js';
import { MODEL3_REFERENCE } from '../shared/wrapGeneration.js';

const root = fileURLToPath(new URL('../', import.meta.url));
dotenv.config({ path: path.join(root, '.env'), quiet: true });
if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured');
const useReference = !process.argv.includes('--without-reference');
const theme = 'gt3 rs rexy';
const output = path.join(root, 'experiments/model3-reference.local', useReference ? 'with-reference' : 'without-reference');
await fs.mkdir(path.dirname(output), { recursive: true });
try {
    await fs.access(`${output}.png`);
    throw new Error(`A result already exists at ${output}.png; keep it before running another paid generation.`);
} catch (error) {
    if (error.code !== 'ENOENT') throw error;
}
const bytes = await fs.readFile(path.join(root, 'public/assets/model3-2024-base.png'));
const request = await generation.buildWrapEditRequest({
    prompt: theme, userPrompt: theme, carModel: MODEL3_REFERENCE.carModel,
    template: ['', 'image/png', bytes.toString('base64')], useReference,
});
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 0, timeout: 180_000 });
console.log(`Generating one ${request.model} image, reference ${useReference ? 'on' : 'off'}…`);
const response = await client.images.edit(request);
const b64 = response.data?.[0]?.b64_json;
if (!b64) throw new Error('No image returned');
// Preserve even a rejected response for inspection without another paid request.
await fs.writeFile(`${output}.png`, Buffer.from(b64, 'base64'));
await fs.writeFile(`${output}.json`, JSON.stringify({
    model: request.model, theme, useReference, reference: MODEL3_REFERENCE,
    prompt: request.prompt, size: request.size, usage: response.usage,
    createdAt: new Date().toISOString(),
}, null, 2));
await generation.validateWrapEditResult(b64, MODEL3_REFERENCE.carModel);
console.log(`Saved ${output}.png`);
