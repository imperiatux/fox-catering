import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";

const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { filename } = await params;

  // Prevent path traversal
  const safeName = path.basename(filename);
  const filePath = path.join(UPLOADS_DIR, safeName);

  let data: Buffer;
  try {
    data = await fs.promises.readFile(filePath);
  } catch {
    return new NextResponse(null, { status: 404 });
  }

  // All uploads are converted to JPEG by sharp
  const contentType = safeName.endsWith(".jpg") || safeName.endsWith(".jpeg")
    ? "image/jpeg"
    : safeName.endsWith(".png")
    ? "image/png"
    : "application/octet-stream";

  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
