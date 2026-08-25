import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../db.js";

export const EVENT_TOPIC = {
  trip_searched: "trip-events",
  itinerary_generated: "trip-events",
  itinerary_confirmed: "trip-events",
  itinerary_shared: "trip-events",
  trip_completed: "trip-events",
  place_impression: "place-interaction-events",
  place_clicked: "place-interaction-events",
  place_saved: "place-interaction-events",
  place_excluded: "place-interaction-events",
  place_pinned: "place-interaction-events",
  place_reordered: "place-interaction-events",
  directions_started: "place-interaction-events",
  place_visit_verified: "local-events",
  place_revisited: "local-events",
  local_place_recommended: "local-events",
  local_course_created: "local-events",
  local_course_used: "local-events",
  recommendation_satisfaction: "recommendation-events",
  budget_exceeded: "recommendation-events",
  route_guide_viewed: "nav-events",
  taxi_card_generated: "nav-events",
  translation_corrected: "translation-events",
  ad_impression: "ad-events",
  ad_clicked: "ad-events",
  coupon_saved: "ad-events",
  booking_started: "booking-events",
  booking_completed: "booking-events",
  booking_cancelled: "booking-events",
  festival_impression: "trip-events",
  festival_added: "trip-events",
  souvenir_layer_viewed: "place-interaction-events",
  share_created: "collab-events",
  share_viewed: "collab-events",
  itinerary_cloned: "collab-events",
  companion_invited: "collab-events",
  itinerary_edited: "collab-events",
  story_created: "social-events",
  story_reported: "social-events",
  user_followed: "social-events",
  user_unfollowed: "social-events",
  weather_warning_viewed: "trip-events",
} as const;

export type EventType = keyof typeof EVENT_TOPIC;
export const EVENT_TYPES = Object.freeze(Object.keys(EVENT_TOPIC) as EventType[]);

export function isEventType(value: string): value is EventType {
  return Object.hasOwn(EVENT_TOPIC, value);
}

export function pseudonymize(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 24);
}

const SENSITIVE_KEYS = new Set(["latitude", "longitude", "lat", "lng", "token", "email", "phone", "cardNumber", "receiptImage"]);
export function sanitizeEventPayload(value: unknown): unknown {
  if (Array.isArray(value)) return value.slice(0, 100).map(sanitizeEventPayload);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !SENSITIVE_KEYS.has(key))
      .slice(0, 50)
      .map(([key, child]) => [key, sanitizeEventPayload(child)]));
  }
  if (typeof value === "string") return value.slice(0, 1000);
  return value;
}

export async function recordEvent(input: {
  eventId?: string;
  eventType: EventType;
  actorId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  language?: string | null;
  payload?: unknown;
  occurredAt?: Date;
}) {
  const eventId = input.eventId ?? randomUUID();
  const topic = EVENT_TOPIC[input.eventType];
  const partitionKey = input.entityId ?? input.actorId ?? eventId;
  try {
    const event = await prisma.eventOutbox.create({ data: {
      eventId,
      eventType: input.eventType,
      topic,
      partitionKey,
      actorId: input.actorId,
      entityType: input.entityType,
      entityId: input.entityId,
      language: input.language,
      payloadJson: JSON.stringify(sanitizeEventPayload(input.payload ?? {})),
      occurredAt: input.occurredAt ?? new Date(),
      publishStatus: process.env.KAFKA_BROKERS ? "PENDING" : "LOCAL_COMMITTED",
      publishedAt: process.env.KAFKA_BROKERS ? null : new Date(),
    } });
    return { event, deduplicated: false };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const event = await prisma.eventOutbox.findUniqueOrThrow({ where: { eventId } });
      return { event, deduplicated: true };
    }
    throw error;
  }
}
