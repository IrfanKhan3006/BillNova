import { randomBytes } from 'crypto';
import { argon2id, argon2Verify } from 'hash-wasm';

// Pure WASM argon2id (no native build step), compatible with existing $argon2id$ hashes.
export function hashPassword(password: string): Promise<string> {
  return argon2id({
    password,
    salt: randomBytes(16),
    memorySize: 65536,
    iterations: 3,
    parallelism: 1,
    hashLength: 32,
    outputType: 'encoded',
  });
}

export function verifyPassword(
  hash: string,
  password: string,
): Promise<boolean> {
  return argon2Verify({ hash, password });
}
