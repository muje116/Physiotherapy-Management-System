interface UploadResult {
  key: string;
  url: string;
  bucket: string;
}

export async function uploadFile(
  buffer: Buffer,
  fileName: string,
  mimeType: string,
  folder: string = 'uploads'
): Promise<UploadResult> {
  const bucket = process.env.AWS_S3_BUCKET || 'physiocore-uploads';
  const region = process.env.AWS_REGION || 'eu-west-1';

  const key = `${folder}/${Date.now()}-${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    try {
      const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
      const s3 = new S3Client({ region });
      await s3.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      }));
      return { key, url: `https://${bucket}.s3.${region}.amazonaws.com/${key}`, bucket };
    } catch (error) {
      console.warn('[Storage] S3 upload failed:', error);
      throw error;
    }
  }

  console.log(`[Storage] Simulated upload: ${key} (${buffer.length} bytes)`);
  return { key, url: `/local-storage/${key}`, bucket: 'local' };
}

export async function deleteFile(key: string): Promise<void> {
  const bucket = process.env.AWS_S3_BUCKET || 'physiocore-uploads';
  const region = process.env.AWS_REGION || 'eu-west-1';

  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    try {
      const { S3Client, DeleteObjectCommand } = await import('@aws-sdk/client-s3');
      const s3 = new S3Client({ region });
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    } catch (error) {
      console.warn('[Storage] S3 delete failed:', error);
    }
  } else {
    console.log(`[Storage] Simulated delete: ${key}`);
  }
}

export function getPublicUrl(key: string): string {
  const bucket = process.env.AWS_S3_BUCKET || 'physiocore-uploads';
  const region = process.env.AWS_REGION || 'eu-west-1';
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}
