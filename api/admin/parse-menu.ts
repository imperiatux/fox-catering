import type { VercelRequest, VercelResponse } from '@vercel/node';
import Busboy from '@fastify/busboy';
import { verifyAdminSession } from '../lib/auth';
import type { MenuVariant, ParseMenuResponse } from '../../src/types';

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
// Tesseract OCR — send image to the local OCR service
// ---------------------------------------------------------------------------
async function runOcr(imageBuffer: Buffer, mimeType: string): Promise<string> {
  const ocrUrl = process.env.OCR_URL ?? 'http://ocr:8884';

  // Build multipart body manually using FormData (available in Node 18+)
  const form = new FormData();
  const blob = new Blob([new Uint8Array(imageBuffer)], { type: mimeType });
  form.append('file', blob, 'menu.jpg');
  form.append('options', JSON.stringify({ languages: ['ron', 'eng'], dpi: 300 }));

  const res = await fetch(`${ocrUrl}/tesseract`, { method: 'POST', body: form });

  if (!res.ok) {
    throw new Error(`OCR service returned HTTP ${res.status}`);
  }

  const json = await res.json() as {
    data: { stdout: string; stderr: string; exit: { code: number } };
  };

  if (json.data.exit.code !== 0) {
    throw new Error(`Tesseract error: ${json.data.stderr.trim()}`);
  }

  return json.data.stdout;
}

// ---------------------------------------------------------------------------
// Text → menu fields parser
//
// Romanian catering menus typically follow one of these patterns:
//
//   Vegetarian / Meniu vegetarian / Meniu 1 / Menu 1
//     Fel principal: <name>
//     Fel secundar / Garnitura / Supa: <name>
//
//   Non-Vegetarian / Meniu cu carne / Meniu 2 / Menu 2
//     Fel principal: <name>
//     Fel secundar / Garnitura / Supa: <name>
//
// The parser is heuristic and intentionally lenient so the organizer
// can review and correct pre-filled fields before saving.
// ---------------------------------------------------------------------------

function cleanLine(line: string): string {
  return line
    .replace(/[|\\[\]{}]/g, '') // strip OCR noise characters
    .replace(/\s+/g, ' ')
    .trim();
}

function extractField(lines: string[], keywords: string[]): string {
  for (const line of lines) {
    const lower = line.toLowerCase();
    for (const kw of keywords) {
      const idx = lower.indexOf(kw);
      if (idx !== -1) {
        // Take everything after the keyword (and any trailing colon/dash)
        const rest = line.slice(idx + kw.length).replace(/^[\s:–-]+/, '').trim();
        if (rest.length > 0) return rest;
      }
    }
  }
  return '';
}

function parseMenuText(raw: string): { vegetarian: MenuVariant; nonVegetarian: MenuVariant } {
  const lines = raw.split('\n').map(cleanLine).filter((l) => l.length > 0);

  // Split into veg / non-veg sections by finding section header lines
  const vegHeaderRe = /vegetar|meniu\s*1|menu\s*1|veg[^e]/i;
  const nonVegHeaderRe = /non.?veg|carne|meniu\s*2|menu\s*2/i;

  let vegStart = -1;
  let nonVegStart = -1;

  for (let i = 0; i < lines.length; i++) {
    if (vegHeaderRe.test(lines[i]) && vegStart === -1) vegStart = i;
    if (nonVegHeaderRe.test(lines[i]) && nonVegStart === -1) nonVegStart = i;
  }

  // Slice each section (up to the other section's start, or end of text)
  const vegLines =
    vegStart !== -1
      ? lines.slice(vegStart, nonVegStart !== -1 && nonVegStart > vegStart ? nonVegStart : undefined)
      : lines;

  const nonVegLines =
    nonVegStart !== -1
      ? lines.slice(nonVegStart, vegStart !== -1 && vegStart > nonVegStart ? vegStart : undefined)
      : lines;

  const mainKeywords = ['fel principal', 'principal', 'mancare', 'preparat', 'main'];
  const secondaryKeywords = ['fel secundar', 'secundar', 'garnitura', 'garnit', 'supa', 'salata', 'secondary', 'side'];

  return {
    vegetarian: {
      main: extractField(vegLines, mainKeywords),
      secondary: extractField(vegLines, secondaryKeywords),
    },
    nonVegetarian: {
      main: extractField(nonVegLines, mainKeywords),
      secondary: extractField(nonVegLines, secondaryKeywords),
    },
  };
}

// ---------------------------------------------------------------------------
// Handler — POST /api/admin/parse-menu
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

  const ocrUrl = process.env.OCR_URL ?? 'http://ocr:8884';
  if (!ocrUrl) {
    return res.status(500).json({ error: 'OCR service is not configured (OCR_URL missing)' });
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

  let raw: string;
  try {
    raw = await runOcr(imageBuffer, mimeType);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(502).json({ error: `OCR failed: ${msg}` });
  }

  const parsed = parseMenuText(raw);
  const result: ParseMenuResponse = { ...parsed, raw };
  return res.status(200).json(result);
}
