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
  const [courier, setCourier] = useState(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s ?? null));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session === undefined) return;
    if (!session) {
      setCourier(false);
      return;
    }
    let cancelled = false;
    setCourier(undefined);
    supabase
      .from("couriers")
      .select("id, name, phone, is_active")
      .eq("user_id", session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setCourier(data && data.is_active ? data : false);
      });
    return () => { cancelled = true; };
  }, [session]);

  const login = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error?.message ?? null;
  };

  const logout = () => supabase.auth.signOut();

  return { courier, login, logout };
}
