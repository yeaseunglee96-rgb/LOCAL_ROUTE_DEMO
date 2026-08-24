import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ScoredPlace } from "../types.js";
import { estimateTravelSync } from "./kakao.js";
import { estimatePlaceCost } from "./recommend.js";

export interface OptimizerResult {
  status: "FEASIBLE" | "OPTIMAL" | "INFEASIBLE";
  orderedPlaceIds: string[];
  arrivals: number[];
}

function parseTime(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

export async function optimizeDayWithOrTools(
  places: ScoredPlace[],
  options: {
    startLat: number;
    startLng: number;
    dayStart: string;
    dayEnd: string;
    dayBudget: number;
    partySize: number;
    hasCar: boolean;
    maxWalkingKm: number;
    maxItems: number;
    maxFoodStops: number;
    maxRestaurantStops: number;
    travelMinutes?: number[][];
    distanceMeters?: number[][];
    mustVisitPlaceIds: string[];
  }
): Promise<OptimizerResult | null> {
  const maxFoodStops = options.maxFoodStops ?? Math.max(1, Math.floor(options.maxItems / 2));
  const maxRestaurantStops = options.maxRestaurantStops ?? (options.maxItems >= 5 ? 2 : 1);
  const nodes = [{ lat: options.startLat, lng: options.startLng }, ...places];
  const travelMinutes = options.travelMinutes ?? nodes.map((from) => nodes.map((to) => estimateTravelSync(from.lat, from.lng, to.lat, to.lng, options.hasCar).durationMin));
  const distanceMeters = options.distanceMeters ?? nodes.map((from) => nodes.map((to) => estimateTravelSync(from.lat, from.lng, to.lat, to.lng, options.hasCar).distanceM));
  const payload = {
    places: places.map((place) => ({
      id: place.id,
      category: place.category,
      score: place.score,
      stayMinutes: place.recommendedStayMin,
      openMin: parseTime(place.openTime),
      closeMin: parseTime(place.closeTime),
      cost: estimatePlaceCost(place.priceTier, options.partySize),
      mustVisit: options.mustVisitPlaceIds.includes(place.id),
    })),
    travelMinutes,
    distanceMeters,
    dayStartMin: parseTime(options.dayStart),
    dayEndMin: parseTime(options.dayEnd),
    dayBudget: Math.floor(options.dayBudget),
    hasCar: options.hasCar,
    maxWalkingM: Math.floor(options.maxWalkingKm * 1000),
    maxItems: options.maxItems,
    maxFoodStops: Math.max(
      maxFoodStops,
      places.filter((place) => options.mustVisitPlaceIds.includes(place.id) && ["RESTAURANT", "CAFE"].includes(place.category)).length,
    ),
    maxRestaurantStops: Math.max(
      maxRestaurantStops,
      places.filter((place) => options.mustVisitPlaceIds.includes(place.id) && place.category === "RESTAURANT").length,
    ),
    timeoutMs: 1500,
  };

  const moduleRoot = fileURLToPath(new URL("../../", import.meta.url));
  const serverRoot = [moduleRoot, process.cwd(), path.resolve(process.cwd(), "server")]
    .find((candidate) => existsSync(path.resolve(candidate, "solver", "route_optimizer.py"))) ?? moduleRoot;
  const python = process.env.ORTOOLS_PYTHON ?? path.resolve(serverRoot, ".venv", "Scripts", "python.exe");
  const script = path.resolve(serverRoot, "solver", "route_optimizer.py");
  return new Promise((resolve) => {
    const child = spawn(python, [script], { stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => child.kill(), 3_000);
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", (error) => {
      clearTimeout(timeout);
      console.warn(`[optimizer] OR-Tools process failed to start (${python}): ${error.message}`);
      resolve(null);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code !== 0 || !stdout) {
        console.warn(`[optimizer] OR-Tools process exited with code ${code}: ${stderr.trim() || stdout.trim() || "no output"}`);
        return resolve(null);
      }
      try {
        const result = JSON.parse(stdout) as OptimizerResult;
        if (result.status !== "INFEASIBLE" && result.orderedPlaceIds.length === 0 && places.length > 0) {
          console.warn(`[optimizer] empty solution for ${places.length} candidates`, payload.places.map((place, index) => ({ id: place.id, open: place.openMin, close: place.closeMin, cost: place.cost, distanceFromOrigin: distanceMeters[0][index + 1] })));
        }
        resolve(["FEASIBLE", "OPTIMAL", "INFEASIBLE"].includes(result.status) ? result : null);
      } catch {
        console.warn(`[optimizer] invalid OR-Tools output: ${stdout.slice(0, 200)}`);
        resolve(null);
      }
    });
    child.stdin.end(JSON.stringify(payload));
  });
}
