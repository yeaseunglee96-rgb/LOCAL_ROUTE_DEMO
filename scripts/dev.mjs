#!/usr/bin/env node
/**
 * 백엔드(:4000)와 프런트엔드(:5173)를 한 번에 실행한다.
 *
 * 프런트만 실행하면 화면은 뜨지만 /api 프록시 대상이 없어 모든 기능이 실패한다.
 * 그 상황을 구조적으로 막기 위한 스크립트이며, 추가 의존성 없이 동작한다.
 */
import { spawn } from "node:child_process";

const TARGETS = [
  { name: "server", color: "[36m", workspace: "server" },
  { name: "web", color: "[35m", workspace: "web" },
];

const children = [];
let shuttingDown = false;

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    try { child.kill(); } catch { /* 이미 종료된 프로세스는 무시 */ }
  }
  process.exit(code);
}

for (const target of TARGETS) {
  const child = spawn("npm", ["run", "dev", "--workspace", target.workspace], {
    shell: process.platform === "win32",
    stdio: ["ignore", "pipe", "pipe"],
  });

  const prefix = `${target.color}[${target.name}][0m `;
  const pipe = (stream, out) => {
    let buffered = "";
    stream.setEncoding("utf8");
    stream.on("data", (chunk) => {
      buffered += chunk;
      const lines = buffered.split("\n");
      buffered = lines.pop() ?? "";
      for (const line of lines) out.write(prefix + line + "\n");
    });
  };
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);

  child.on("exit", (code) => {
    if (shuttingDown) return;
    process.stderr.write(`${prefix}프로세스가 종료되었습니다 (exit ${code}). 나머지도 함께 정리합니다.\n`);
    shutdown(code ?? 1);
  });

  children.push(child);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

process.stdout.write("[32m▶ server(:4000) + web(:5173) 동시 실행 중 · 중지하려면 Ctrl+C[0m\n");
