import express from "express";
import cors from "cors";
import helmet from "helmet";
import http from "http";
import { Server } from "socket.io";
import { config } from "./config";
import { pool } from "./db/pool";
import { redis } from "./db/redis";
import { runMigrations } from "./db/migrate";
import { setupSocketHandlers } from "./socket/handler";
import { startGroupExpiryJob } from "./jobs/groupExpiry";
import authRoutes from "./routes/auth";
import groupRoutes from "./routes/groups";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    await redis.ping();
    res.json({
      status: "ok",
      db: "connected",
      redis: "connected",
      uptime: process.uptime(),
    });
  } catch (err) {
    res.status(503).json({
      status: "error",
      message: (err as Error).message,
    });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/groups", groupRoutes);

setupSocketHandlers(io);
startGroupExpiryJob();

async function start() {
  await runMigrations();

  server.listen(config.port, () => {
    console.log(`Server running on port ${config.port}`);
    console.log(`Group max duration: ${config.group.maxDurationHours}h`);
    console.log(`Proximity radius: ${config.group.proximityRadiusMeters / 1000}km`);
  });
}

start();

process.on("SIGTERM", async () => {
  console.log("Shutting down...");
  await redis.quit();
  await pool.end();
  server.close();
  process.exit(0);
});
