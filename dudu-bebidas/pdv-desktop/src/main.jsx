import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App";
import { resolveStore } from "./shared/supabase/Supabaseclient";

const rootElement = document.getElementById("root");

function renderStoreError(message) {
  rootElement.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0a0a0a;color:#fff;font-family:sans-serif;text-align:center;padding:24px;">
      <div>
        <h1 style="font-size:20px;margin-bottom:8px;">Não foi possível carregar a loja</h1>
        <p style="opacity:.7;font-size:14px;">${message}</p>
      </div>
    </div>
  `;
}

async function bootstrap() {
  try {
    await resolveStore();
  } catch (err) {
    console.error("[main] Falha ao resolver a loja:", err);
    renderStoreError(err.message ?? "Verifique a configuração (VITE_STORE_SLUG).");
    return;
  }

  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

bootstrap();
