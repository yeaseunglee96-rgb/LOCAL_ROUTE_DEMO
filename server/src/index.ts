import "dotenv/config";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { randomUUID } from "node:crypto";
import { tripsRouter } from "./routes/trips.js";
import { communityRouter } from "./routes/community.js";
import { analyticsRouter } from "./routes/analytics.js";
import { commerceRouter } from "./routes/commerce.js";
import { experienceRouter } from "./routes/experience.js";
import { collaborationRouter } from "./routes/collaboration.js";
import { socialRouter } from "./routes/social.js";

const app = express();
export { app };
const allowedOrigins = new Set((process.env.CORS_ORIGINS ?? "http://localhost:5173").split(",").map((value) => value.trim()));
app.disable("x-powered-by");
app.use((req, res, next) => { const traceId = req.header("x-request-id")?.slice(0, 100) || randomUUID(); res.locals.traceId = traceId; res.setHeader("x-request-id", traceId); next(); });
app.use(helmet({ contentSecurityPolicy: false, strictTransportSecurity: process.env.NODE_ENV === "production" ? undefined : false }));
app.use(cors({ origin(origin, callback) { callback(null, !origin || allowedOrigins.has(origin)); }, methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"], allowedHeaders: ["Content-Type", "Authorization", "Idempotency-Key", "X-Request-Id", "X-Session-Token", "X-Booking-Webhook-Secret", "X-Admin-Token"] }));
app.use("/api/stories", express.json({ limit: "3mb" }));
app.use(express.json({ limit: "256kb" }));
app.use("/api", rateLimit({ windowMs: 15 * 60_000, limit: 300, standardHeaders: "draft-7", legacyHeaders: false, message: { error_code: "RATE_LIMITED", message: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." } }));

app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api", tripsRouter);
app.use("/api", communityRouter);
app.use("/api", analyticsRouter);
app.use("/api", commerceRouter);
app.use("/api", experienceRouter);
app.use("/api", collaborationRouter);
app.use("/api", socialRouter);

app.use((_req, res) => res.status(404).json({ error_code: "NOT_FOUND", message: "요청한 API를 찾을 수 없습니다.", traceId: res.locals.traceId }));
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err?.type === "entity.too.large") return res.status(413).json({ error_code: "PAYLOAD_TOO_LARGE", message: "일반 요청은 256KB, 스토리 이미지는 3MB 이하여야 합니다.", traceId: res.locals.traceId });
  console.error(`[${res.locals.traceId}]`, err);
  res.status(500).json({ error_code: "INTERNAL_ERROR", message: "서버에서 요청을 처리하지 못했습니다.", traceId: res.locals.traceId });
});

const port = Number(process.env.PORT ?? 4000);
if (process.env.NODE_ENV !== "test") app.listen(port, () => { console.log(`LOCAL ROUTE server listening on http://localhost:${port}`); });
