import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import sharp from "sharp";
import { validateAdminSession } from "@/lib/auth";
import { getMenuPhoto, setMenuPhoto } from "@/lib/redis";

const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");

export async function GET(request: NextRequest) {
  const valid = await validateAdminSession(request);
  if (!valid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const date = new Date().toISOString().split("T")[0];
  const filename = await getMenuPhoto(date);

  if (!filename) {
    return NextResponse.json({ filename: null, url: null });
  }

  return NextResponse.json({
    filename,
    url: `/uploads/${filename}`,
  });
}

export async function POST(request: NextRequest) {
  const valid = await validateAdminSession(request);
  if (!valid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  // Validate MIME type
  const mimeType = file.type;
  if (!mimeType.startsWith("image/")) {
    return NextResponse.json(
      { error: "File must be an image" },
      { status: 400 },
    );
  }

  const date = new Date().toISOString().split("T")[0];
  const filename = `menu-${date}.jpg`;
  const outputPath = path.join(UPLOADS_DIR, filename);

  // Delete old file for this date if one exists
  const existingFilename = await getMenuPhoto(date);
  if (existingFilename) {
    const oldPath = path.join(UPLOADS_DIR, existingFilename);
    try {
      await fs.promises.unlink(oldPath);
    } catch {
      // File may already be gone — not a fatal error
    }
  }

  // Ensure uploads directory exists
  await fs.promises.mkdir(UPLOADS_DIR, { recursive: true });

  // Convert to JPEG with sharp
  const buffer = Buffer.from(await file.arrayBuffer());
  await sharp(buffer).jpeg({ quality: 85 }).toFile(outputPath);

  // Update Redis
  await setMenuPhoto(date, filename);

  return NextResponse.json({
    filename,
    url: `/uploads/${filename}`,
  });
}
