/**
 * Quick test: verify R2 connectivity by uploading and deleting a test file.
 * Usage: node test_r2.js
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { S3Client, ListBucketsCommand, PutObjectCommand } = require('@aws-sdk/client-s3');

async function test() {
    console.log('=== R2 Diagnostics ===');
    console.log(`Account ID: ${process.env.R2_ACCOUNT_ID}`);
    console.log(`Access Key ID: ${process.env.R2_ACCESS_KEY_ID}`);
    console.log(`Secret Key: ${process.env.R2_SECRET_ACCESS_KEY ? '***set***' : 'NOT SET'}`);
    console.log(`Bucket: ${process.env.R2_BUCKET_NAME}`);
    console.log(`Endpoint: https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`);
    console.log('');

    const s3 = new S3Client({
        region: 'auto',
        endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId: process.env.R2_ACCESS_KEY_ID,
            secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
        },
    });

    // 1. List buckets to verify credentials
    console.log('Step 1: Listing buckets...');
    try {
        const { Buckets } = await s3.send(new ListBucketsCommand({}));
        console.log('✅ Credentials work! Available buckets:');
        for (const b of Buckets) {
            console.log(`   - ${b.Name}`);
        }
    } catch (err) {
        console.error('❌ ListBuckets failed:', err.message);
        console.error('   This means your Access Key ID or Secret are wrong, or the token lacks permissions.');
        process.exit(1);
    }

    // 2. Try uploading to the specified bucket
    console.log(`\nStep 2: Uploading test file to bucket "${process.env.R2_BUCKET_NAME}"...`);
    try {
        await s3.send(new PutObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: 'test/hello.txt',
            Body: Buffer.from('Hello R2!'),
            ContentType: 'text/plain',
        }));
        console.log('✅ Upload succeeded!');
        console.log(`   URL: ${process.env.R2_PUBLIC_URL}/test/hello.txt`);
    } catch (err) {
        console.error('❌ Upload failed:', err.message);
        console.error('   Check that the bucket name is correct and the token has write permissions to this bucket.');
    }

    console.log('\n=== Done ===');
}

test().catch(console.error);
