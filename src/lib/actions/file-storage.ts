"use server";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { put } from "@vercel/blob";

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function storeUploadedFile(
  file: File,
  folder: "knowledge" | "ai-studio"
): Promise<{ url: string; fileName: string; mimeType: string }> {
  if (!file || file.size === 0) {
    throw new Error("Bestand ontbreekt");
  }

  const safeName = sanitizeFileName(file.name || `upload-${Date.now()}.bin`);
  const mimeType = file.type || "application/octet-stream";
  const bytes = Buffer.from(await file.arrayBuffer());

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(`${folder}/${Date.now()}-${safeName}`, bytes, {
      access: "public",
      token: process.env.BLOB_READ_WRITE_TOKEN,
      contentType: mimeType,
    });
    return { url: blob.url, fileName: safeName, mimeType };
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
