import { useEffect, useState } from "react";
import { listCourierLocations } from "../../loja/entregadores/services/entregadoresService";
import DeliveryMap from "../../../../shared/components/DeliveryMap/DeliveryMap";

const POLL_MS = 25000;

export default function CourierMapOverview() {
  const [locations, setLocations] = useState([]);

  useEffect(() => {
    let cancelled = false;
    const reload = () => {
      listCourierLocations()
        .then((data) => { if (!cancelled) setLocations(data); })
        .catch((e) => console.error("[CourierMapOverview]", e));
    };
    reload();
    const interval = setInterval(reload, POLL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  return (
    <div className="adm-courier-map-wrap">
      {locations.length === 0 ? (
        <div className="adm-empty"><p>Nenhum entregador compartilhando localização agora.</p></div>
      ) : (
        <DeliveryMap
          height={360}
          markers={locations.map((l) => ({ lat: l.lat, lng: l.lng, emoji: "🛵", label: l.name }))}
        />
      )}
    </div>
  );
}
