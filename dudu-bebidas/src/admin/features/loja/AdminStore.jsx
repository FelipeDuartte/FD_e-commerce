import { useState } from "react";
import "./AdminStore.css";
import CategoriesSection from "./categorias/components/CategoriesSection";
import DeliveryZonesSection from "./bairros/components/DeliveryZonesSection";
import StoreHoursSection from "./horarios/components/StoreHoursSection";
import TeamSection from "./equipe/components/TeamSection";
import EntregadoresSection from "./entregadores/components/EntregadoresSection";
import PaymentMethodsToggleSection from "./pagamentos/components/PaymentMethodsToggleSection";
import PixConfigSection from "./pagamentos/components/PixConfigSection";
import { STORE_TABS } from "./constants";

export default function AdminStore() {
  const [storeTab, setStoreTab] = useState("categorias");
  return (
    <>
      <div className="adm-title-row">
        <div>
          <h1 className="adm-title">Configurações da Loja</h1>
          <p className="adm-subtitle">Categorias, taxas de entrega e horários.</p>
        </div>
      </div>
      <div className="adm-subtabs">
        {STORE_TABS.map(({ key, label }) => (
          <button
            key={key}
            className={`adm-subtab ${storeTab === key ? "adm-subtab-active" : ""}`}
            onClick={() => setStoreTab(key)}
          >{label}</button>
        ))}
      </div>
      {storeTab === "categorias" && <CategoriesSection />}
      {storeTab === "bairros"    && <DeliveryZonesSection />}
      {storeTab === "horarios"   && <StoreHoursSection />}
      {storeTab === "equipe"     && <TeamSection />}
      {storeTab === "entregadores" && <EntregadoresSection />}
      {storeTab === "pagamentos" && (
        <>
          <PaymentMethodsToggleSection />
          <PixConfigSection />
        </>
      )}
    </>
  );
}
