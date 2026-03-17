// api/_storage.js — Alpha Quantum ERP v18 — Cloud Storage
import crypto from 'crypto';

export function parseBase64Upload(body) {
  const data  = body.file  || body.data  || '';
  const name  = body.filename || body.name  || 'upload.bin';
  const mime  = body.mimetype || body.type  || 'application/octet-stream';
  if (!data) throw new Error('No file data provided');
  const clean  = data.replace(/^data:[^;]+;base64,/, '');
  const buffer = Buffer.from(clean, 'base64');
  return { buffer, filename: name, mimetype: mime };
}

export async function uploadFile(buffer, filename, mimetype, folder) {
  const folder2 = folder || 'uploads';
  const accountId = process.env.CF_ACCOUNT_ID;
  const accessKey = process.env.CF_ACCESS_KEY_ID;
  const secretKey = process.env.CF_SECRET_ACCESS_KEY;
  const bucket    = process.env.CF_R2_BUCKET || 'alpha-erp-uploads';

  if (!accountId || !accessKey || !secretKey) {
    throw new Error('Storage not configured. Set CF_ACCOUNT_ID, CF_ACCESS_KEY_ID, CF_SECRET_ACCESS_KEY');
  }

  const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
  });

  const ext = filename.split('.').pop() || 'bin';
  const key = `${folder2}/${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${ext}`;

  await s3.send(new PutObjectCommand({
    Bucket: bucket, Key: key, Body: buffer, ContentType: mimetype,
    CacheControl: 'public, max-age=31536000',
  }));

  const publicUrl = process.env.CF_R2_PUBLIC_URL
    ? `${process.env.CF_R2_PUBLIC_URL.replace(/\/$/, '')}/${key}`
    : `https://${bucket}.r2.dev/${key}`;

  return { key, url: publicUrl };
}
