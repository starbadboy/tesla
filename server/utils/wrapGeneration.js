const fs = require('node:fs/promises');
const path = require('node:path');
const OpenAI = require('openai');

const shared = import('../../shared/wrapGeneration.js');
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function assertSquareTexture(bytes, label, size = 1024) {
    if (bytes.length < 33 || !bytes.subarray(0, 8).equals(PNG_SIGNATURE)
        || bytes.toString('ascii', 12, 16) !== 'IHDR'
        || bytes.readUInt32BE(16) !== size || bytes.readUInt32BE(20) !== size) {
        throw new Error(`${label} must be a ${size} × ${size} PNG texture. Please try again.`);
    }
}

function decodeStyleReferences(references, limits) {
    if (!Array.isArray(references) || references.length > limits.count) {
        throw new Error(`referenceImages must be an array of at most ${limits.count} images`);
    }
    return references.map((reference, index) => {
        const fail = () => { throw new Error(`Reference image ${index + 1} must be a valid PNG, JPEG or WebP data URL (max 4 MB)`); };
        if (typeof reference !== 'string' || reference.length > 64 + Math.ceil(limits.requestBytes / 3) * 4) fail();
        const match = reference.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/);
        if (!match) fail();
        const [, type, base64] = match;
        const bytes = Buffer.from(base64, 'base64');
        if (!bytes.length || bytes.length > limits.requestBytes || bytes.toString('base64') !== base64) fail();
        const validHeader = type === 'image/png'
            ? bytes.length >= 33 && bytes.subarray(0, 8).equals(PNG_SIGNATURE) && bytes.toString('ascii', 12, 16) === 'IHDR'
            : type === 'image/jpeg'
                ? bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
                : bytes.length >= 20 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
        if (!validHeader) fail();
        return { bytes, type };
    });
}

/** Validate user images and resolve the pinned layout example before any credits are spent. */
async function buildWrapEditRequest({ prompt, template, carModel, userPrompt, useReference = true, referenceImages = [] }) {
    const { getLayoutReference, REFERENCE_IMAGE_LIMITS, wrapTexturePrompt } = await shared;
    const styleReferences = decodeStyleReferences(referenceImages, REFERENCE_IMAGE_LIMITS);
    const layoutReference = getLayoutReference(carModel);
    if ((layoutReference || styleReferences.length) && (typeof userPrompt !== 'string' || !userPrompt.trim())) {
        throw new Error('A design theme is required');
    }
    const bytes = Buffer.from(template[2], 'base64');
    if (layoutReference) {
        if (template[1] !== 'image/png') throw new Error('The wrap template must be a PNG image');
        if (typeof useReference !== 'boolean') throw new Error('useReference must be a boolean');
        assertSquareTexture(bytes, 'The template', layoutReference.size);
    }
    const images = [await OpenAI.toFile(bytes, 'template.png', { type: template[1] })];
    if (layoutReference && useReference) {
        const reference = await fs.readFile(path.join(__dirname, '../../public', layoutReference.imagePath));
        assertSquareTexture(reference, 'The reference', layoutReference.size);
        images.push(await OpenAI.toFile(reference, 'layout-example.png', { type: 'image/png' }));
    }
    for (const [index, { bytes: reference, type }] of styleReferences.entries()) {
        images.push(await OpenAI.toFile(reference, `style-reference-${index + 1}.${type.split('/')[1]}`, { type }));
    }
    return {
        model: 'gpt-image-2',
        image: images,
        prompt: layoutReference || styleReferences.length ? wrapTexturePrompt(userPrompt, carModel || 'Car', useReference, styleReferences.length) : prompt,
        quality: 'high',
        n: 1,
        ...(layoutReference ? { size: `${layoutReference.size}x${layoutReference.size}`, output_format: 'png' } : {}),
    };
}

async function validateWrapEditResult(b64, carModel) {
    const { getLayoutReference } = await shared;
    const reference = getLayoutReference(carModel);
    if (reference) {
        assertSquareTexture(Buffer.from(b64, 'base64'), 'The generated image', reference.size);
    }
}

module.exports = { buildWrapEditRequest, validateWrapEditResult };
