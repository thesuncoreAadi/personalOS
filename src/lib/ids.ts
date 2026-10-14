/** Small, dependency-free id generator (stable across refreshes, no collisions in practice). */
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

export function uid(prefix = ''): string {
  const bytes = new Uint8Array(10);
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) out += ALPHABET[bytes[i] % ALPHABET.length];
  return prefix ? `${prefix}_${out}` : out;
}
