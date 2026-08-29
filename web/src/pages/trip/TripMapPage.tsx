import { SocialExplorationMap } from "../../components/SocialExplorationMap";
import { useTrip } from "./TripContext";

/** /trips/:tripId/map — 독립 발자국 탭: 해무 탐험·도감·방문 기록 */
export function TripMapPage() {
  const { itinerary, tripId } = useTrip();

  return (
    <div className="service-view map-view">
      <SocialExplorationMap tripId={tripId} itinerary={itinerary} />
    </div>
  );
}
