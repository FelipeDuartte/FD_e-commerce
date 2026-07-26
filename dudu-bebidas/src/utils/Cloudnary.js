// src/utils/cloudinary.js
const CLOUD_NAME = "dfcsficmg"; // seu cloud name
const OWN_UPLOAD_PREFIX = `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/`;

/**
 * Gera URL otimizada e padronizada do Cloudinary.
 *
 * - Se já é uma URL do NOSSO Cloudinary (upload), aplica a transformação
 *   direto na própria URL — sem passar pelo "fetch".
 * - Se é uma URL de verdade externa (outro site), usa fetch do Cloudinary.
 * - Se é um public_id (ex: "dudu-bebidas/cervejas/000468"), gera a URL direto.
 *
 * IMPORTANTE: "fetch" cria um recurso novo em cache no Cloudinary pra CADA
 * URL de origem diferente que passa por ele — mesmo se a origem já for o
 * seu próprio Cloudinary (é assim que o Cloudinary funciona, documentado
 * oficialmente). Era isso que enchia a conta de imagem duplicada: toda vez
 * que a busca automática do catálogo mestre encontrava um candidato
 * diferente enquanto o admin digitava o nome do produto, o preview
 * (imgProduto) reprocessava aquela URL via fetch e criava mais um recurso
 * — mesmo a imagem já estando no seu Cloudinary. Por isso a checagem do
 * OWN_UPLOAD_PREFIX vem ANTES do fetch: pra imagem que já é sua, nunca
 * precisa criar nada novo, só pedir a transformação na URL que já existe.
 */
export function imgProduto(src) {
  if (!src) return null;

  const transforms = "w_400,h_400,c_pad,b_white,f_auto,q_auto";

  // Já é uma imagem do nosso próprio Cloudinary — aplica a transformação
  // direto, sem criar nenhum recurso novo.
  if (src.startsWith(OWN_UPLOAD_PREFIX)) {
    const rest = src.slice(OWN_UPLOAD_PREFIX.length);
    return `${OWN_UPLOAD_PREFIX}${transforms}/${rest}`;
  }

  // URL externa de verdade (amazon, outro site, etc) — aí sim faz sentido
  // usar fetch, já que a imagem não está no nosso Cloudinary.
  if (src.startsWith("http")) {
    const encoded = encodeURIComponent(src);
    return `https://res.cloudinary.com/${CLOUD_NAME}/image/fetch/${transforms}/${encoded}`;
  }

  // Public_id puro (ex: "dudu-bebidas/cervejas/000468")
  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${transforms}/${src}`;
}