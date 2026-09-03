import { supabase, getCurrentStoreId } from "../../../../../shared/supabase/Supabaseclient";
import { AdminServiceError } from "../../../../shared/services/AdminServiceError";

export async function listDeliveryZones() {
  const { data, error } = await supabase
    .from("delivery_zones")
    .select("*")
    .order("sort_order");
  if (error)
    throw new AdminServiceError("Não foi possível carregar os bairros.", error);
  return data ?? [];
}

export async function createDeliveryZone({ nome, frete, is_retirada = false }) {
  if (!nome?.trim())
    throw new AdminServiceError("O nome do bairro não pode estar vazio.");
  const freteNum = parseFloat(frete);
  if (isNaN(freteNum) || freteNum < 0)
    throw new AdminServiceError("Informe uma taxa válida.");

  const { data: maxRow } = await supabase
    .from("delivery_zones")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const sort_order = (maxRow?.sort_order ?? -1) + 1;

  const { data, error } = await supabase
    .from("delivery_zones")
    .insert({
      nome: nome.trim(),
      frete: freteNum,
      is_retirada,
      sort_order,
      store_id: getCurrentStoreId(),
    })
    .select()
    .single();

  if (error)
    throw new AdminServiceError("Não foi possível criar o bairro.", error);
  return data;
}

export async function updateDeliveryZone(id, { nome, frete, is_retirada }) {
  const update = {};
  if (nome !== undefined) {
    if (!nome.trim())
      throw new AdminServiceError("O nome não pode estar vazio.");
    update.nome = nome.trim();
  }
  if (frete !== undefined) {
    const freteNum = parseFloat(frete);
    if (isNaN(freteNum) || freteNum < 0)
      throw new AdminServiceError("Informe uma taxa válida.");
    update.frete = freteNum;
  }
  if (is_retirada !== undefined) update.is_retirada = is_retirada;

  const { data, error } = await supabase
    .from("delivery_zones")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error)
    throw new AdminServiceError("Não foi possível atualizar o bairro.", error);
  return data;
}

export async function toggleDeliveryZone(id, is_active) {
  const { data, error } = await supabase
    .from("delivery_zones")
    .update({ is_active })
    .eq("id", id)
    .select()
    .single();
  if (error)
    throw new AdminServiceError("Não foi possível alterar o status.", error);
  return data;
}

export async function deleteDeliveryZone(id) {
  const { error } = await supabase.from("delivery_zones").delete().eq("id", id);
  if (error)
    throw new AdminServiceError("Não foi possível excluir o bairro.", error);
}
