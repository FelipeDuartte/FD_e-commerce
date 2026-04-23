// src/utils/cloudinary.js
const CLOUD_NAME = "dfcsficmg"; // seu cloud name

/**
 * Gera URL otimizada e padronizada do Cloudinary.
 * Se já for uma URL completa (http), aplica transformação via fetch URL.
 * Se for um public_id, gera a URL diretamente.
 */
export function imgProduto(src) {
  if (!src) return null;

  const transforms = "w_400,h_400,c_pad,b_white,f_auto,q_auto";

  // Se já é uma URL externa (amazon, etc), usa fetch do Cloudinary
  if (src.startsWith("http")) {
    const encoded = encodeURIComponent(src);
    return `https://res.cloudinary.com/${CLOUD_NAME}/image/fetch/${transforms}/${encoded}`;
  }

  // Se é um public_id do Cloudinary (ex: "dudu-bebidas/cervejas/000468")
  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${transforms}/${src}`;
}