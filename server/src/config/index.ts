import dotenv from "dotenv";
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || "3000", 10),
  nodeEnv: process.env.NODE_ENV || "development",

  db: {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "5432", 10),
    name: process.env.DB_NAME || "hyperlocal_chat",
    user: process.env.DB_USER || "chat_user",
    pass: process.env.DB_PASS || "chat_pass",
    get url() {
      return `postgresql://${this.user}:${this.pass}@${this.host}:${this.port}/${this.name}`;
    },
  },

  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
  },

  smsProvider: process.env.SMS_PROVIDER || "console",

  textbee: {
    apiKey: process.env.TEXTBEE_API_KEY || "",
    deviceId: process.env.TEXTBEE_DEVICE_ID || "",
    apiBase: process.env.TEXTBEE_API_BASE || "https://api.textbee.dev",
  },

  otp: {
    ttlSeconds: parseInt(process.env.OTP_TTL_SECONDS || "300", 10),
    length: parseInt(process.env.OTP_LENGTH || "6", 10),
  },

  jwt: {
    secret: process.env.JWT_SECRET || "dev-secret",
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  },

  group: {
    maxDurationHours: parseInt(process.env.MAX_GROUP_DURATION_HOURS || "2", 10),
    maxMembers: parseInt(process.env.MAX_GROUP_MEMBERS || "50", 10),
    proximityRadiusMeters: parseInt(
      process.env.PROXIMITY_RADIUS_METERS || "10000",
      10
    ),
    locationGracePeriodSeconds: parseInt(
      process.env.LOCATION_GRACE_PERIOD_SECONDS || "120",
      10
    ),
  },
};
