import { randomBytes } from 'node:crypto';

let lastMs = 0;
let lastSeq = 0;

/**
 * UUID version 7 (RFC 9562): 48-bit Unix milliseconds, then random bits.
 * Time-ordered, so new rows land at the end of B-tree indexes.
 * A 12-bit counter in `rand_a` keeps ids monotonic within the same millisecond.
 */
export function uuidv7(now: number = Date.now()): string {
  let ms = now;
  if (ms <= lastMs) {
    ms = lastMs;
    lastSeq = (lastSeq + 1) & 0xfff;
    if (lastSeq === 0) ms = ++lastMs; // counter overflow: borrow the next millisecond
  } else {
    lastSeq = randomBytes(2).readUInt16BE(0) & 0x7ff; // random start, leaves room to count up
  }
  lastMs = ms;

  const bytes = randomBytes(16);
  bytes.writeUIntBE(ms, 0, 6);
  bytes[6] = 0x70 | (lastSeq >> 8); // version 7 + high bits of counter
  bytes[7] = lastSeq & 0xff;
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10

  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
