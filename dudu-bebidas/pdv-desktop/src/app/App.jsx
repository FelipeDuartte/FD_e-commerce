import { useEffect, useRef, useState } from "react";
import { supabase, loadStore } from "../shared/supabase/Supabaseclient";
import { useTheme } from "../shared/hooks/useTheme";
import Login from "./Login";
import Pdv from "./Pdv";
import "../shared/styles/theme.css";
import "../shared/styles/Pdv.css";

// A loja vem do login: só entra quem é admin (is_admin) de uma loja ativa
// (profiles.store_id) — e o PDV abre nessa loja. Um instalador e um canal
// de atualização servem todas as lojas.
export default function App() {
  const [user, setUser] = useState(null);
  // null = verificando · "ok" = loja carregada · string = motivo de não entrar
  const [access, setAccess] = useState(null);
  const lastCheckedUid = useRef(null);
  const hadStore = useRef(false);
  // Chamado aqui (não dentro de Pdv.jsx) pra já aplicar o tema escolhido
  // mesmo antes do login — senão a tela de login sempre nasceria escura,
  // não importa o que o operador tinha escolhido da última vez.
  const theme = useTheme();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session) setAccess("");
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => setUser(session?.user ?? null),
    );
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      lastCheckedUid.current = null;
      // Saiu depois de ter entrado numa loja: recarrega o app pra não sobrar
      // nada da loja anterior em memória (listas, relatórios em cache...).
      if (hadStore.current) window.location.reload();
      // Sem sessão a tela de login já aparece (setAccess no getSession ou
      // na recusa abaixo) — nada a mudar aqui, senão apagaria a mensagem.
      return;
    }
    if (user.id === lastCheckedUid.current) return;
    lastCheckedUid.current = user.id;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAccess(null);

    (async () => {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("is_admin, store_id")
        .eq("id", user.id)
        .single();

      if (error || !profile?.is_admin || !profile.store_id) {
        await supabase.auth.signOut();
        setAccess("Esta conta não é administradora de nenhuma loja.");
        return;
      }
      try {
        await loadStore(profile.store_id);
        hadStore.current = true;
        setAccess("ok");
      } catch (e) {
        await supabase.auth.signOut();
        setAccess(e.message);
      }
    })();
  }, [user]);

  if (access === null) {
    return (
      <div className="adm-loading" style={{ minHeight: "100vh" }}>
        <div className="adm-spinner" />
        <p>Verificando acesso...</p>
      </div>
    );
  }

  if (access !== "ok") {
    return <Login theme={theme.theme} onToggleTheme={theme.toggleTheme} accessError={access} />;
  }

  return <Pdv theme={theme.theme} onToggleTheme={theme.toggleTheme} />;
}
