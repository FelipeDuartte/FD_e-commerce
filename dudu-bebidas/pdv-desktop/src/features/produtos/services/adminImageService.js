import { supabase } from "../../../shared/supabase/Supabaseclient";
import { AdminServiceError } from "../../../shared/services/AdminServiceError";

/**
 * Busca no catálogo mestre do Cloudinary uma imagem cujo nome
 * corresponda ao nome do produto informado.
 * Retorna { found: boolean, url?: string, candidates: [...] }.
 */
export async function findMasterImage(productName) {
  const { data, error } = await supabase.functions.invoke("find-master-image", {
    body: { productName },
  });

  if (error) {
    throw new AdminServiceError("Não foi possível buscar a imagem no catálogo.", error);
  }

  return data ?? { found: false };
}
