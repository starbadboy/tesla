const fs = require('node:fs/promises');
const path = require('node:path');
const OpenAI = require('openai');

const shared = import('../../shared/wrapGeneration.js');
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function assertModel3Texture(bytes, label) {
    if (bytes.length < 33 || !bytes.subarray(0, 8).equals(PNG_SIGNATURE)
        || bytes.toString('ascii', 12, 16) !== 'IHDR'
        || bytes.readUInt32BE(16) !== 1024 || bytes.readUInt32BE(20) !== 1024) {
        throw new Error(`${label} must be a 1024 × 1024 PNG texture. Please try again.`);
    }
}

/** Resolve the pinned reference locally; clients cannot substitute a different example. */
async function buildWrapEditRequest({ prompt, template, carModel, userPrompt, useReference = true }) {
    const { MODEL3_REFERENCE, model3TexturePrompt } = await shared;
    const isModel3 = carModel === MODEL3_REFERENCE.carModel;
    const bytes = Buffer.from(template[2], 'base64');
    if (isModel3) {
        if (template[1] !== 'image/png') throw new Error('The Model 3 template must be a PNG image');
        if (typeof userPrompt !== 'string' || !userPrompt.trim()) throw new Error('A design theme is required');
        if (typeof useReference !== 'boolean') throw new Error('useReference must be a boolean');
        assertModel3Texture(bytes, 'The template');
    }
    const images = [await OpenAI.toFile(bytes, 'template.png', { type: template[1] })];
    if (isModel3 && useReference) {
        const reference = await fs.readFile(path.join(__dirname, '../../public', MODEL3_REFERENCE.imagePath));
        assertModel3Texture(reference, 'The reference');
        images.push(await OpenAI.toFile(reference, 'layout-example.png', { type: 'image/png' }));
    }
    return {
        model: 'gpt-image-2',
        image: images,
        prompt: isModel3 ? model3TexturePrompt(userPrompt, useReference) : prompt,
        quality: 'high',
        n: 1,
        ...(isModel3 ? { size: '1024x1024', output_format: 'png' } : {}),
    };
}

async function validateWrapEditResult(b64, carModel) {
    const { MODEL3_REFERENCE } = await shared;
    if (carModel === MODEL3_REFERENCE.carModel) {
        assertModel3Texture(Buffer.from(b64, 'base64'), 'The generated image');
    }
}

module.exports = { buildWrapEditRequest, validateWrapEditResult };
