export function sanitizeUploadFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}
