import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { put } from "@vercel/blob";
import { sanitizeUploadFileName } from "@/lib/knowledge/file-utils";

export async function storeUploadedBytes(
  bytes: Buffer,
  fileName: string,
  mimeType: string,
  folder: "knowledge" | "ai-studio"
): Promise<{ url: string; fileName: string; mimeType: string }> {
  if (!bytes.length) {
    throw new Error("Bestand is leeg");
  }

  const safeName = sanitizeUploadFileName(fileName || `upload-${Date.now()}.bin`);

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(`${folder}/${Date.now()}-${safeName}`, bytes, {
      access: "public",
      token: process.env.BLOB_READ_WRITE_TOKEN,
      contentType: mimeType,
    });
    return { url: blob.url, fileName: safeName, mimeType };
  }

  // Vercel serverless: geen persistent filesystem — blob token vereist
  if (process.env.VERCEL) {
    throw new Error(
      "BLOB_READ_WRITE_TOKEN ontbreekt in Vercel. Voeg Vercel Blob toe of upload alleen tekst (.md wordt wel in de database opgeslagen)."
    );
  }

  const relativeDir = path.join("public", "uploads", folder);
  const absoluteDir = path.join(process.cwd(), relativeDir);
  await mkdir(absoluteDir, { recursive: true });
  const relativePath = path.join(relativeDir, `${Date.now()}-${safeName}`);
  const absolutePath = path.join(process.cwd(), relativePath);
  await writeFile(absolutePath, bytes);

  return {
    url: `/${relativePath.replace(/^public\//, "").replaceAll("\\", "/")}`,
    fileName: safeName,
    mimeType,
  };
}

export async function storeUploadedFile(
  file: File,
  folder: "knowledge" | "ai-studio"
): Promise<{ url: string; fileName: string; mimeType: string }> {
  if (!file || file.size === 0) {
    throw new Error("Bestand ontbreekt");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const mimeType = file.type || "application/octet-stream";
  const safeName = sanitizeUploadFileName(file.name || `upload-${Date.now()}.bin`);

  return storeUploadedBytes(bytes, safeName, mimeType, folder);
}
