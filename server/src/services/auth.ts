import jwt from "jsonwebtoken";
import { config } from "../config";
import { createUser, findUserByPhone } from "../models/user";
import type { AuthPayload } from "../middleware/auth";

export async function loginOrRegister(phone: string, displayName: string) {
  let user = await findUserByPhone(phone);
  if (!user) {
    user = await createUser(phone, displayName);
  }
  const payload: AuthPayload = { userId: user.id, phone: user.phone };
  const token = jwt.sign(payload, config.jwt.secret, {
    expiresIn: 7 * 24 * 60 * 60,
  });
  return { user, token };
}

export async function loginExisting(phone: string) {
  const user = await findUserByPhone(phone);
  if (!user) return null;
  const payload: AuthPayload = { userId: user.id, phone: user.phone };
  const token = jwt.sign(payload, config.jwt.secret, {
    expiresIn: 7 * 24 * 60 * 60,
  });
  return { user, token };
}
