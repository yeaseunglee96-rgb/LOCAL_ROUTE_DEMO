import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { hashSessionToken, issueSessionToken } from "../services/community.js";
import { optionalSession, sessionToken } from "../services/auth.js";
import { createPasswordRecord, normalizeEmail, PASSWORD_RULE, validEmail, verifyPassword } from "../services/account.js";

export const accountRouter = Router();
const accountLifetimeMs = 30 * 24 * 60 * 60 * 1000;

function publicUser(user: { id: string; email: string; name: string; emailVerified: boolean }) {
  return { id: user.id, email: user.email, name: user.name, emailVerified: user.emailVerified };
}

accountRouter.post("/auth/register", async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const name = typeof req.body?.name === "string" ? req.body.name.trim().slice(0, 50) : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (!name) return res.status(400).json({ error_code: "NAME_REQUIRED", message: "이름을 입력해주세요." });
    if (!validEmail(email)) return res.status(400).json({ error_code: "INVALID_EMAIL", message: "이메일 주소를 확인해주세요." });
    if (!PASSWORD_RULE.test(password)) return res.status(400).json({ error_code: "WEAK_PASSWORD", message: "비밀번호는 8~64자이며 영문, 숫자, 특수문자를 포함해야 합니다." });

    const guest = await optionalSession(req);
    const credentials = await createPasswordRecord(password);
    const issued = issueSessionToken();
    const expiresAt = new Date(Date.now() + accountLifetimeMs);
    const result = await prisma.$transaction(async (tx) => {
      const ownerSession = guest ?? await tx.anonymousSession.create({ data: { tokenHash: issueSessionToken().tokenHash, locale: req.body?.locale === "EN" ? "EN" : "KO", expiresAt, localProfile: { create: {} } } });
      const user = await tx.user.create({ data: { email, name, passwordHash: credentials.hash, passwordSalt: credentials.salt, ownerSessionId: ownerSession.id } });
      await tx.accountSession.create({ data: { tokenHash: issued.tokenHash, userId: user.id, expiresAt } });
      return user;
    });
    res.status(201).json({ token: issued.token, user: publicUser(result) });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return res.status(409).json({ error_code: "EMAIL_ALREADY_EXISTS", message: "이미 가입된 이메일입니다." });
    next(error);
  }
});

accountRouter.post("/auth/login", async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !await verifyPassword(password, user.passwordSalt, user.passwordHash)) return res.status(401).json({ error_code: "INVALID_CREDENTIALS", message: "이메일 또는 비밀번호가 올바르지 않습니다." });
    const issued = issueSessionToken();
    await prisma.accountSession.create({ data: { tokenHash: issued.tokenHash, userId: user.id, expiresAt: new Date(Date.now() + accountLifetimeMs) } });
    res.json({ token: issued.token, user: publicUser(user) });
  } catch (error) { next(error); }
});

accountRouter.get("/auth/me", async (req, res, next) => {
  try {
    const token = sessionToken(req);
    if (!token) return res.status(401).json({ error_code: "ACCOUNT_REQUIRED", message: "로그인이 필요합니다." });
    const account = await prisma.accountSession.findUnique({ where: { tokenHash: hashSessionToken(token) }, include: { user: true } });
    if (!account || account.expiresAt <= new Date()) return res.status(401).json({ error_code: "SESSION_EXPIRED", message: "로그인이 만료되었습니다." });
    res.json({ user: publicUser(account.user) });
  } catch (error) { next(error); }
});

accountRouter.post("/auth/logout", async (req, res, next) => {
  try {
    const token = sessionToken(req);
    if (token) {
      await prisma.accountSession.deleteMany({ where: { tokenHash: hashSessionToken(token) } });
    }
    res.status(204).end();
  } catch (error) { next(error); }
});
