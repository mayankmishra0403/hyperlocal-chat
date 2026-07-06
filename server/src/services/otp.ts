import crypto from "crypto";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { redis } from "../db/redis";
import { createUser, findUserByPhone, updateDisplayName } from "../models/user";
import { sms } from "./sms";
import type { AuthPayload } from "../middleware/auth";

const OTP_PREFIX = "otp:";

export async function sendOtp(phone: string): Promise<void> {
  const normalized = phone.startsWith("+") ? phone : `+91${phone}`;
  const code = generateCode(config.otp.length);
  await redis.setex(`${OTP_PREFIX}${phone}`, config.otp.ttlSeconds, code);
  await sms.send(normalized, `Your verification code is: ${code}`);
}

export async function verifyOtp(
  phone: string,
  code: string,
  displayName: string
): Promise<{ user: any; token: string } | null> {
  const stored = await redis.get(`${OTP_PREFIX}${phone}`);
  if (!stored || stored !== code) return null;

  await redis.del(`${OTP_PREFIX}${phone}`);

  let user = await findUserByPhone(phone);
  if (!user) {
    user = await createUser(phone, displayName);
  } else if (displayName) {
    user = await updateDisplayName(user.id, displayName);
  }

  const payload: AuthPayload = { userId: user.id, phone: user.phone };
  const token = jwt.sign(payload, config.jwt.secret, {
    expiresIn: 7 * 24 * 60 * 60,
  });

  return { user, token };
}

function generateCode(length: number): string {
  const digits = "0123456789";
  let code = "";
  for (let i = 0; i < length; i++) {
    code += digits[crypto.randomInt(0, digits.length)];
  }
  return code;
}
