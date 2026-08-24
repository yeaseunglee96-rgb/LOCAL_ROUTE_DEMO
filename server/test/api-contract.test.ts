import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";

process.env.NODE_ENV = "test";
process.env.CORS_ORIGINS = "http://localhost:5173";
const { app } = await import("../src/index.js");

test("health 응답에 추적 ID와 기본 보안 헤더가 있다", async () => {
  const response = await request(app).get("/health").set("Origin", "http://localhost:5173").expect(200);
  assert.equal(response.body.status, "ok");
  assert.ok(response.headers["x-request-id"]);
  assert.equal(response.headers["x-content-type-options"], "nosniff");
  assert.equal(response.headers["access-control-allow-origin"], "http://localhost:5173");
});

test("없는 API는 일관된 오류 코드와 추적 ID를 반환한다", async () => {
  const response = await request(app).get("/api/not-a-route").expect(404);
  assert.equal(response.body.error_code, "NOT_FOUND");
  assert.equal(response.body.traceId, response.headers["x-request-id"]);
});

test("256KB를 넘는 JSON 요청을 거부한다", async () => {
  const response = await request(app).post("/api/events").set("Content-Type", "application/json").send({ payload: "x".repeat(300_000) }).expect(413);
  assert.equal(response.body.error_code, "PAYLOAD_TOO_LARGE");
});

test("페이지 안 길찾기는 대중교통과 자차 모드를 같은 계약으로 반환한다", async () => {
  for (const mode of ["TRANSIT", "CAR"]) {
    const response = await request(app).get("/api/routes/directions").query({ startLat: 35.1152, startLng: 129.0403, endLat: 35.1587, endLng: 129.1604, mode }).expect(200);
    assert.equal(response.body.mode, mode);
    assert.ok(response.body.durationMin > 0);
    assert.ok(response.body.distanceM > 0);
    assert.ok(response.body.path.length >= 2);
  }
});

test("주소 검색은 짧은 검색어를 거부한다", async () => {
  const response = await request(app).get("/api/locations/search?query=부").expect(400);
  assert.equal(response.body.error_code, "QUERY_TOO_SHORT");
});
