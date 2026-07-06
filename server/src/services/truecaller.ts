import { config } from "../config";
import { createUser, findUserByPhone, updateDisplayName } from "../models/user";
import jwt from "jsonwebtoken";
import type { AuthPayload } from "../middleware/auth";

export async function loginWithTruecaller(
  requestId: string,
  phone: string,
  displayName?: string
): Promise<{ user: any; token: string } | null> {
  const normalizedPhone = phone.startsWith("+")
    ? phone
    : `+91${phone}`;

  let user = await findUserByPhone(normalizedPhone);
  if (!user) {
    user = await createUser(normalizedPhone, displayName || "User");
  } else if (displayName) {
    user = await updateDisplayName(user.id, displayName);
  }

  const payload: AuthPayload = { userId: user.id, phone: user.phone };
  const token = jwt.sign(payload, config.jwt.secret, {
    expiresIn: 7 * 24 * 60 * 60,
  });

  return { user, token };
}
