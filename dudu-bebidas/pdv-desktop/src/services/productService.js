import { supabase } from "../supabase/Supabaseclient";
import { AdminServiceError } from "./AdminServiceError";

export async function listAdminProducts() {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("name");

  if (error) {
    throw new AdminServiceError("Não foi possível carregar os produtos.", error);
  }
  return data ?? [];
}
