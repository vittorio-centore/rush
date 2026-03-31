import { createHash } from "crypto";

export function stableUserBucket(userId: string) {
  const digest = createHash("sha256").update(userId).digest();
  return digest.readUInt32BE(0) % 100;
}

export function isUserInRollout(userId: string, percent: number) {
  if (percent <= 0) {
    return false;
  }

  if (percent >= 100) {
    return true;
  }

  return stableUserBucket(userId) < percent;
}
