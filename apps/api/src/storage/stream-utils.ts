import type { Readable } from 'node:stream';

/** Reads a whole stream into memory (PDFs up to UPLOAD_MAX_FILE_MB). */
export async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array));
  return Buffer.concat(chunks);
}
