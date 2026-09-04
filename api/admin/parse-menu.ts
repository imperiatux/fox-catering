import type { VercelRequest, VercelResponse } from '@vercel/node';
import Busboy from '@fastify/busboy';
import { verifyAdminSession } from '../lib/auth';
import { setMenuImage } from '../lib/kv';
import { validateDate } from '../lib/validation';

// ---------------------------------------------------------------------------
// Multipart helper — reads the first file field from the request stream
// ---------------------------------------------------------------------------
function readUploadedImage(req: VercelRequest): Promise<{ buffer: Buffer; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const bb = Busboy({ headers: req.headers as unknown as import('@fastify/busboy').BusboyHeaders });
    let resolved = false;

    bb.on('file', (_fieldname, stream, _filename, _transferEncoding, mimeType) => {
      const chunks: Uint8Array[] = [];
      stream.on('data', (chunk: Uint8Array) => chunks.push(chunk));
      stream.on('end', () => {
        if (!resolved) {
          resolved = true;
          resolve({ buffer: Buffer.concat(chunks), mimeType });
        }
      });
      stream.on('error', reject);
    });

    bb.on('error', reject);
    bb.on('finish', () => {
      if (!resolved) reject(new Error('No file uploaded'));
    });

    req.pipe(bb);
  });
}

// ---------------------------------------------------------------------------
// Handler — POST /api/admin/parse-menu?date=YYYY-MM-DD
// Stores the uploaded image so the public order page can display it.
// ---------------------------------------------------------------------------
export const config = {
  api: { bodyParser: false },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!verifyAdminSession(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const dateParam = typeof req.query.date === 'string' ? req.query.date : '';
  const dateError = dateParam ? validateDate(dateParam) : null;
  if (dateError) {
    return res.status(400).json({ error: dateError });
  }

  let imageBuffer: Buffer;
  let mimeType: string;

  try {
    ({ buffer: imageBuffer, mimeType } = await readUploadedImage(req));
  } catch (err) {
    return res.status(400).json({ error: `Failed to read uploaded file: ${String(err)}` });
  }

  if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/tiff'].includes(mimeType)) {
    return res.status(400).json({ error: 'Only JPEG, PNG, WebP, GIF, or TIFF images are accepted' });
  }

  if (imageBuffer.length > 20 * 1024 * 1024) {
    return res.status(400).json({ error: 'Image must be under 20 MB' });
  }

  if (dateParam) {
    const dataUrl = `data:${mimeType};base64,${imageBuffer.toString('base64')}`;
    await setMenuImage(dateParam, dataUrl);
  }

  return res.status(200).json({});
}
