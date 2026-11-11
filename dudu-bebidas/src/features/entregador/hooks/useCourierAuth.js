import { useEffect, useState } from "react";
import { supabase } from "../../../shared/supabase/Supabaseclient";

// Resolve identidade do entregador via a tabela `couriers` — NUNCA via
// profiles/is_admin (ver migration 0030_couriers.sql: is_admin dá acesso
// total de admin, entregador é um papel isolado disso).
//
// courier: undefined = ainda verificando · false = sem sessão OU logado
// mas sem cadastro de entregador ativo pra essa loja (acesso negado) ·
// objeto = entregador válido.
export function useCourierAuth() {
  const [session, setSession] = useState(undefined);
  // Resultado da busca, marcado com o usuário a que se refere — assim uma
  // troca de login nunca mostra o entregador do login anterior.
  const [lookup, setLookup] = useState(null); // { userId, courier }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s ?? null));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    const userId = session.user.id;
    let cancelled = false;
    supabase
      .from("couriers")
      .select("id, name, phone, is_active")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setLookup({ userId, courier: data && data.is_active ? data : false });
      });
    return () => { cancelled = true; };
  }, [session]);

  const courier =
    session === undefined ? undefined // ainda verificando a sessão
    : session === null ? false // sem login
    : lookup?.userId === session.user.id ? lookup.courier
    : undefined; // buscando o cadastro deste login

  const login = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error?.message ?? null;
  };

  const logout = () => supabase.auth.signOut();

  return { courier, login, logout };
}
