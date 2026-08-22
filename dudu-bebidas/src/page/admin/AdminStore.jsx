import { useState } from "react";
import "./AdminStore.css";
import CategoriesSection from "./AdminStore/sections/CategoriesSection";
import DeliveryZonesSection from "./AdminStore/sections/DeliveryZonesSection";
import StoreHoursSection from "./AdminStore/sections/StoreHoursSection";
import TeamSection from "./AdminStore/sections/TeamSection";
import PaymentSection from "./AdminStore/sections/PaymentSection";
import { STORE_TABS } from "./AdminStore/constants";

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
      {storeTab === "pagamentos" && <PaymentSection />}
    </>
  );
}
