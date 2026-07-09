import { supabase, getCurrentStoreId } from "../../../supabase/Supabaseclient";
import { AdminServiceError } from "./AdminServiceError";

// ── CATEGORIAS ────────────────────────────────────────────────────────────────
// Padrão idêntico ao adminProductService.js que já funciona no projeto.

export async function listCategories() {
  console.log("[categories] listCategories →");
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("name");

  console.log("[categories] listCategories ←", { data, error });

  if (error)
    throw new AdminServiceError(
      "Não foi possível carregar as categorias.",
      error,
    );
  return data ?? [];
}

export async function createCategory(name) {
  const normalized = name.trim().toLowerCase();
  console.log("[categories] createCategory →", { normalized });

  const { error } = await supabase
    .from("categories")
    .insert({ name: normalized, store_id: getCurrentStoreId() });

  console.log("[categories] createCategory ←", { error });

  if (error) {
    if (error.code === "23505") {
      throw new AdminServiceError(
        `Já existe uma categoria chamada "${normalized}".`,
      );
    }
    throw new AdminServiceError("Não foi possível criar a categoria.", error);
  }
}

export async function updateCategory(id, name) {
  const normalized = name.trim().toLowerCase();

  const { data: currentCategory, error: loadError } = await supabase
    .from("categories")
    .select("name")
    .eq("id", id)
    .maybeSingle();

  if (loadError) {
    throw new AdminServiceError(
      "Não foi possível carregar a categoria para atualizar.",
      loadError,
    );
  }

  if (!currentCategory) {
    throw new AdminServiceError("Categoria não encontrada.");
  }

  const previousName = currentCategory.name;
  console.log("[categories] updateCategory →", {
    id,
    previousName,
    normalized,
  });

  if (previousName === normalized) return;

  // PASSO 1: conta ANTES de mexer em qualquer coisa quantos produtos
  // usam o nome antigo. Vira a "expectativa" para validar o passo 3
  // e detectar atualizações parciais/silenciosas.
  const { count: expectedCount, error: countError } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("category", previousName);

  if (countError) {
    throw new AdminServiceError(
      "Não foi possível verificar os produtos vinculados à categoria.",
      countError,
    );
  }

  // PASSO 2: renomeia a categoria.
  const { error } = await supabase
    .from("categories")
    .update({ name: normalized })
    .eq("id", id);

  console.log("[categories] updateCategory ←", { error });

  if (error) {
    if (error.code === "23505") {
      throw new AdminServiceError(
        `Já existe uma categoria chamada "${normalized}".`,
      );
    }
    throw new AdminServiceError(
      "Não foi possível atualizar a categoria.",
      error,
    );
  }

  // PASSO 3: reatribui os produtos vinculados ao nome antigo.
  // Um UPDATE no Supabase/Postgres NÃO gera erro quando 0 linhas
  // correspondem ao filtro (seja por texto divergente, seja por uma
  // policy de RLS escondendo as linhas). Por isso usamos `.select("id")`
  // para saber quantas linhas foram REALMENTE alteradas e comparamos
  // com `expectedCount`. Se não bater, revertemos o nome da categoria
  // para não deixar categories/products dessincronizados (o app não
  // tem transação real entre as duas tabelas).
  if (expectedCount > 0) {
    const { data: updatedRows, error: productError } = await supabase
      .from("products")
      .update({ category: normalized })
      .eq("category", previousName)
      .select("id");

    const affectedCount = updatedRows?.length ?? 0;

    console.log("[categories] updateCategory products ←", {
      expectedCount,
      affectedCount,
      productError,
    });

    if (productError || affectedCount !== expectedCount) {
      await supabase
        .from("categories")
        .update({ name: previousName })
        .eq("id", id);

      throw new AdminServiceError(
        affectedCount === 0
          ? `Categoria NÃO renomeada: ${expectedCount} produto(s) usam o texto "${previousName}", mas nenhum pôde ser atualizado (verifique políticas de RLS na tabela "products" ou divergências de texto — espaços, maiúsculas, acentos). Nada foi salvo.`
          : `Categoria NÃO renomeada: apenas ${affectedCount} de ${expectedCount} produto(s) foram atualizados. Nada foi salvo para evitar produtos órfãos — verifique divergências de texto na coluna "category".`,
        productError,
      );
    }
  }
}

export async function toggleCategory(id, is_active) {
  console.log("[categories] toggleCategory →", { id, is_active });

  const { error } = await supabase
    .from("categories")
    .update({ is_active })
    .eq("id", id);

  console.log("[categories] toggleCategory ←", { error });

  if (error)
    throw new AdminServiceError(
      "Não foi possível alterar o status da categoria.",
      error,
    );
}

export async function deleteCategory(id, categoryName) {
  console.log("[categories] deleteCategory →", { id, categoryName });

  const { count, error: countError } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("category", categoryName);

  console.log("[categories] deleteCategory count ←", { count, countError });

  if (countError)
    throw new AdminServiceError(
      "Não foi possível verificar os produtos.",
      countError,
    );
  if (count > 0) {
    throw new AdminServiceError(
      `Esta categoria possui ${count} produto(s) vinculado(s). Desative-a antes de excluir.`,
    );
  }

  const { error } = await supabase.from("categories").delete().eq("id", id);

  console.log("[categories] deleteCategory delete ←", { error });

  if (error)
    throw new AdminServiceError("Não foi possível excluir a categoria.", error);
}

// ── ZONAS DE ENTREGA (BAIRROS) ────────────────────────────────────────────────

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

// ── CONFIGURAÇÃO DA LOJA ──────────────────────────────────────────────────────

export async function getStoreConfig() {
  const { data, error } = await supabase
    .from("store_config")
    .select("*")
    .eq("store_id", getCurrentStoreId())
    .single();
  if (error)
    throw new AdminServiceError(
      "Não foi possível carregar as configurações.",
      error,
    );
  return data;
}

export async function updateStoreConfig(config) {
  const { error } = await supabase
    .from("store_config")
    .update({ ...config, updated_at: new Date().toISOString() })
    .eq("store_id", getCurrentStoreId());
  if (error)
    throw new AdminServiceError(
      "Não foi possível salvar as configurações.",
      error,
    );
}

// ── HORÁRIOS DE FUNCIONAMENTO ─────────────────────────────────────────────────

export async function listStoreHours() {
  const { data, error } = await supabase
    .from("store_hours")
    .select("*")
    .order("day_of_week");
  if (error)
    throw new AdminServiceError(
      "Não foi possível carregar os horários.",
      error,
    );
  return data ?? [];
}

export async function upsertStoreHours(rows) {
  const storeId = getCurrentStoreId();
  for (const row of rows) {
    const toTime = (t) => (t && t.length === 5 ? `${t}:00` : (t ?? "09:00:00"));
    const { error } = await supabase
      .from("store_hours")
      .update({
        is_open: row.is_open,
        open_time: toTime(row.open_time),
        close_time: toTime(row.close_time),
      })
      .eq("store_id", storeId)
      .eq("day_of_week", row.day_of_week);
    if (error)
      throw new AdminServiceError(
        `Não foi possível salvar horário do dia ${row.day_of_week}.`,
        error,
      );
  }
}
