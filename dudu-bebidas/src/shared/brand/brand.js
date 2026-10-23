import brandFile from "@brand";
import { getCurrentStore } from "../supabase/Supabaseclient";

// Marca da loja atual (src/brands/<slug>/brand.js) com os padrões aplicados.
// Tudo opcional no arquivo: loja sem banners/"Sobre" simplesmente não
// mostra essas seções; sem nome, usa o nome cadastrado no banco.
export function getBrand() {
  const name = brandFile.name || getCurrentStore()?.name || "Loja";
  const [first, ...rest] = name.split(" ");
  return {
    name,
    logoText: brandFile.logoText || [first, rest.join(" ")],
    logoUrl: brandFile.logoUrl || null,
    searchPlaceholder: brandFile.searchPlaceholder || "Buscar produtos...",
    productsLabel: brandFile.productsLabel || "Produtos",
    topBanners: brandFile.topBanners || [],
    heroSlides: brandFile.heroSlides || [],
    about: brandFile.about || null,
    footer: {
      tagline: "",
      email: "",
      location: "",
      closing: "",
      ...brandFile.footer,
    },
    // Termos de uso e política de privacidade
    legal: {
      city: "",
      deliveryTime: "",
      updatedAt: "",
      ...brandFile.legal,
      contactEmail: brandFile.legal?.contactEmail || brandFile.footer?.email || "",
    },
  };
}
