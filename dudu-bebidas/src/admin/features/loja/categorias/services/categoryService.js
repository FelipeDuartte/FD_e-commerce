import { supabase, getCurrentStoreId } from "../../../../../shared/supabase/Supabaseclient";
import { AdminServiceError } from "../../../../shared/services/AdminServiceError";

export async function listCategories() {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("name");

  if (error)
    throw new AdminServiceError(
      "Não foi possível carregar as categorias.",
      error,
    );
  return data ?? [];
}

export async function createCategory(name) {
  const normalized = name.trim().toLowerCase();

  const { error } = await supabase
    .from("categories")
    .insert({ name: normalized, store_id: getCurrentStoreId() });

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
  const { error } = await supabase
    .from("categories")
    .update({ is_active })
    .eq("id", id);

  if (error)
    throw new AdminServiceError(
      "Não foi possível alterar o status da categoria.",
      error,
    );
}

export async function deleteCategory(id, categoryName) {
  const { count, error: countError } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("category", categoryName);

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

  if (error)
    throw new AdminServiceError("Não foi possível excluir a categoria.", error);
}
