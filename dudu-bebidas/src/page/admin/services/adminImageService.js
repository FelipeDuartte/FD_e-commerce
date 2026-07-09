import { supabase, getCurrentStore } from "../../../supabase/Supabaseclient";
import { AdminServiceError } from "./AdminServiceError";

// ── Identificador da loja para uploads (Fdtech/stores/{storeSlug}/products/) ──
// Antes era fixo ("dudu-bebidas"); agora vem da loja resolvida no boot do app
// (Supabaseclient.js → resolveStore()), então cada projeto/cliente grava na
// própria pasta do Cloudinary automaticamente.
function getStoreSlugForUpload() {
  const store = getCurrentStore();
  if (!store?.slug) {
    throw new AdminServiceError(
      "Loja não identificada — recarregue a página antes de enviar imagens.",
    );
  }
  return store.slug;
}

/**
 * Busca no catálogo mestre do Cloudinary uma imagem cujo nome
 * corresponda ao nome do produto informado.
 * Retorna { found: boolean, url?: string }.
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

/**
 * Converte um File (input ou drag-and-drop) para base64 (data URL).
 */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    reader.readAsDataURL(file);
  });
}

/**
 * Faz upload de uma imagem para o Cloudinary via Edge Function
 * autenticada. Retorna a secure_url pronta para salvar em form.image.
 */
export async function uploadProductImage(file) {
  const fileBase64 = await fileToBase64(file);

  const { data, error } = await supabase.functions.invoke("upload-product-image", {
    body: { storeId: getStoreSlugForUpload(), fileBase64 },
  });

  if (error) {
    throw new AdminServiceError("Não foi possível enviar a imagem.", error);
  }

  if (!data?.url) {
    throw new AdminServiceError("Upload concluído, mas nenhuma URL foi retornada.");
  }

  return data.url;
}