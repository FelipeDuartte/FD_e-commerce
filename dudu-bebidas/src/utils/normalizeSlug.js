// src/utils/normalizeSlug.js
//
// Função reutilizável de normalização de texto → slug.
// Usada hoje para localizar imagens do catálogo mestre no Cloudinary,
// mas pensada para ser reaproveitada futuramente em logos, banners,
// categorias e qualquer outro recurso do SaaS que precise de um
// identificador previsível a partir de um nome livre.
//
// "Heineken Long Neck"  → "heineken-long-neck"
// "Água Cristal 500ml"  → "agua-cristal-500ml"
// "X-Bacon Artesanal!!" → "x-bacon-artesanal"

/**
 * Normaliza um texto para um slug padronizado:
 * - remove acentos
 * - remove caracteres especiais
 * - converte para minúsculas
 * - substitui espaços por hífen
 * - remove hífens duplicados/nas pontas
 *
 * @param {string} text
 * @returns {string}
 */
export function normalizeSlug(text) {
  if (!text) return "";

  return String(text)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "") // remove caracteres especiais
    .replace(/\s+/g, "-") // espaços → hífen
    .replace(/-+/g, "-") // remove hífens duplicados
    .replace(/^-+|-+$/g, ""); // remove hífens nas pontas
}
