import { randomBytes, scrypt, timingSafeEqual } from 'crypto';

// Password hashing for agency customer logins, with Node's built-in scrypt.
// Stored as "scrypt$N$r$p$saltB64$hashB64" so the cost can change later.

const N = 16384;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;

function derive(
  password: string,
  salt: Buffer,
  n: number,
  r: number,
  p: number,
) {
  return new Promise<Buffer>((resolve, reject) =>
    scrypt(
      password,
      salt,
      KEY_LENGTH,
      { N: n, r, p, maxmem: 64 * 1024 * 1024 },
      (err, key) => (err ? reject(err) : resolve(key)),
    ),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, N, R, P);
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [scheme, n, r, p, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const key = await derive(
    password,
    Buffer.from(salt, 'base64'),
    Number(n),
    Number(r),
    Number(p),
  );
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/** A hash to compare against when the account does not exist, so a wrong email costs as long as a wrong password. */
let dummyHash: Promise<string> | null = null;
export function dummyPasswordHash() {
  dummyHash ??= hashPassword(randomBytes(16).toString('hex'));
  return dummyHash;
}
