import "./Entregador.css";
import { useCourierAuth } from "./hooks/useCourierAuth";
import CourierLogin from "./components/CourierLogin";
import CourierOrderList from "./components/CourierOrderList";

export default function EntregadorApp() {
  const { courier, login, logout } = useCourierAuth();

  if (courier === undefined) {
    return <div className="ent-loading">Carregando...</div>;
  }

  if (courier === false) {
    return <CourierLogin onLogin={login} />;
  }

  return (
    <div className="ent-root">
      <header className="ent-header">
        <span className="ent-header-title">🛵 Olá, {courier.name.split(" ")[0]}</span>
        <button className="ent-btn-logout" onClick={logout}>Sair</button>
      </header>
      <CourierOrderList />
    </div>
  );
}
