import { useEffect, useRef, useState } from "react";
import { supabase, getCurrentStoreId } from "../shared/supabase/Supabaseclient";
import { useTheme } from "../shared/hooks/useTheme";
import Login from "./Login";
import Pdv from "./Pdv";
import "../shared/styles/theme.css";
import "../shared/styles/Pdv.css";

// Mesmo padrão de auth do App.jsx do site web: is_admin sozinho não basta
// (auth.users é compartilhado entre todas as lojas no mesmo projeto
// Supabase) — só entra quem for admin DESSA loja.
export default function App() {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(null);
  const lastCheckedUid = useRef(null);
  // Chamado aqui (não dentro de Pdv.jsx) pra já aplicar o tema escolhido
  // mesmo antes do login — senão a tela de login sempre nasceria escura,
  // não importa o que o operador tinha escolhido da última vez.
  const theme = useTheme();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => setUser(session?.user ?? null),
    );
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      lastCheckedUid.current = null;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsAdmin(false);
      return;
    }
    if (user.id === lastCheckedUid.current) return;
    lastCheckedUid.current = user.id;

    supabase
      .from("profiles")
      .select("is_admin, store_id")
      .eq("id", user.id)
      .single()
      .then(({ data, error }) => {
        const admin = !error && data?.is_admin === true && data?.store_id === getCurrentStoreId();
        setIsAdmin(admin);
      });
  }, [user]);

  if (isAdmin === null) {
    return (
      <div className="adm-loading" style={{ minHeight: "100vh" }}>
        <div className="adm-spinner" />
        <p>Verificando acesso...</p>
      </div>
    );
  }

  if (!isAdmin) return <Login theme={theme.theme} onToggleTheme={theme.toggleTheme} />;

  return <Pdv theme={theme.theme} onToggleTheme={theme.toggleTheme} />;
}
