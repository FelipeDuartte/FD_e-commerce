import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App";
import EnvBadge from "./shared/components/EnvBadge";

// A loja é carregada depois do login (ver App.jsx) — não há mais loja fixa
// no build, então o app abre direto na tela de login.
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
    <EnvBadge />
  </React.StrictMode>,
);
