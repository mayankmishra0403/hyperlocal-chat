import { Router, Request, Response } from "express";
import { z } from "zod";
import { config } from "../config";
import { loginExisting, loginOrRegister } from "../services/auth";
import { sendOtp, verifyOtp } from "../services/otp";
import { findUserByPhone } from "../models/user";

const router = Router();

const phoneSchema = z.object({
  phone: z.string().regex(/^\+?[1-9]\d{6,14}$/, "Invalid phone number"),
});

const loginSchema = z.object({
  phone: z.string().regex(/^\+?[1-9]\d{6,14}$/, "Invalid phone number"),
  displayName: z.string().max(100).optional(),
});

const loginExistingSchema = z.object({
  phone: z.string().regex(/^\+?[1-9]\d{6,14}$/, "Invalid phone number"),
});

const verifySchema = z.object({
  phone: z.string().regex(/^\+?[1-9]\d{6,14}$/, "Invalid phone number"),
  code: z.string().min(1).max(10),
  displayName: z.string().min(1).max(100),
});

router.post("/check", async (req: Request, res: Response) => {
  try {
    const body = phoneSchema.parse(req.body);
    const user = await findUserByPhone(body.phone);
    res.json({ exists: !!user });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors });
      return;
    }
    console.error("check error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/send-otp", async (req: Request, res: Response) => {
  try {
    const body = phoneSchema.parse(req.body);
    await sendOtp(body.phone);
    res.json({ message: "OTP sent" });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors });
      return;
    }
    console.error("send-otp error:", err);
    res.status(500).json({ error: "Failed to send OTP" });
  }
});

router.post("/verify-otp", async (req: Request, res: Response) => {
  try {
    const body = verifySchema.parse(req.body);
    const result = await verifyOtp(body.phone, body.code, body.displayName);
    if (!result) {
      res.status(401).json({ error: "Invalid or expired OTP" });
      return;
    }
    res.json(result);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors });
      return;
    }
    console.error("verify-otp error:", err);
    res.status(500).json({ error: "Failed to verify OTP" });
  }
});

router.post("/login", async (req: Request, res: Response) => {
  try {
    const body = loginSchema.parse(req.body);
    const existing = await findUserByPhone(body.phone);
    if (!existing && !body.displayName) {
      res.status(400).json({ error: "Display name is required for new users" });
      return;
    }
    const result = await loginOrRegister(body.phone, body.displayName || "");
    res.json(result);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors });
      return;
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Auth error:", err);
    if (config.nodeEnv === "development") {
      res.status(500).json({ error: message });
    } else {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

router.post("/login-existing", async (req: Request, res: Response) => {
  try {
    const body = loginExistingSchema.parse(req.body);
    const result = await loginExisting(body.phone);
    if (!result) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json(result);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors });
      return;
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Auth error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
