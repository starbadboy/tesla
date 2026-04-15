const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const path = require('path');

// Initialize S3 client for Cloudflare R2
const s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});

const BUCKET_NAME = process.env.R2_BUCKET_NAME || 'teslawrap-media';
const PUBLIC_URL = process.env.R2_PUBLIC_URL || '';

/**
 * Upload a buffer to R2
 * @param {Buffer} fileBuffer - The file data
 * @param {string} key - Object key (e.g. 'wraps/1234-myfile.png')
 * @param {string} contentType - MIME type (e.g. 'image/png')
 * @returns {string} Public URL of the uploaded file
 */
async function uploadToR2(fileBuffer, key, contentType) {
    const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: fileBuffer,
        ContentType: contentType,
    });

    await s3Client.send(command);
    return `${PUBLIC_URL}/${key}`;
}

/**
 * Delete an object from R2
 * @param {string} key - Object key to delete
 */
async function deleteFromR2(key) {
    const command = new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
    });

    await s3Client.send(command);
}

/**
 * Extract R2 key from a full public URL
 * e.g. 'https://pub-xxx.r2.dev/wraps/1234-file.png' -> 'wraps/1234-file.png'
 * Returns null if not an R2 URL
 */
function getR2KeyFromUrl(url) {
    if (!url || !PUBLIC_URL || !url.startsWith(PUBLIC_URL)) {
        return null;
    }
    return url.replace(PUBLIC_URL + '/', '');
}

/**
 * Determine MIME type from filename
 */
function getMimeType(filename) {
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml',
        '.wav': 'audio/wav',
        '.mp3': 'audio/mpeg',
        '.ogg': 'audio/ogg',
        '.m4a': 'audio/mp4',
    };
    return mimeTypes[ext] || 'application/octet-stream';
}

module.exports = {
    uploadToR2,
    deleteFromR2,
    getR2KeyFromUrl,
    getMimeType,
    s3Client,
    BUCKET_NAME,
    PUBLIC_URL,
};
