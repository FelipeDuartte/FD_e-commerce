// Usado pelo vite.config.js (roda no Node, na hora do build/dev) — escolhe
// a marca da loja e escreve no index.html o que precisa existir ANTES do
// JavaScript carregar: título, descrição, favicon, metas de
// compartilhamento/verificação e as cores (sem "piscar" a cor errada).
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const DEFAULT_COLORS = {
  primary: "#ffd000",
  light: "#ffed4e",
  dark: "#b8860b",
  deep: "#ffaa00",
};

export function brandFilePath(brandsDir, slug) {
  const own = slug && path.join(brandsDir, slug, "brand.js");
  return own && fs.existsSync(own)
    ? own
    : path.join(brandsDir, "_default", "brand.js");
}

export async function loadBrand(file) {
  return (await import(`${pathToFileURL(file).href}?t=${Date.now()}`)).default;
}

function hexToRgb(hex) {
  const value = hex.replace("#", "");
  const full =
    value.length === 3 ? [...value].map((c) => c + c).join("") : value;
  const n = parseInt(full, 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

// "loja-teste-c" → "Loja Teste C" (só pro título da aba de loja sem marca)
const humanize = (slug = "") =>
  slug
    .split("-")
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");

export function brandHtmlPlugin(brand, slug) {
  const colors = { ...DEFAULT_COLORS, ...brand.colors };
  const seo = brand.seo ?? {};
  const name = brand.name || humanize(slug) || "Loja";
  const title = seo.title || name;

  const meta = (attrs) => ({ tag: "meta", attrs, injectTo: "head" });
  const tags = [
    { tag: "title", children: title, injectTo: "head" },
    {
      tag: "style",
      children: `:root{--brand:${colors.primary};--brand-light:${colors.light};--brand-dark:${colors.dark};--brand-deep:${colors.deep};--brand-rgb:${hexToRgb(colors.primary)};--brand-deep-rgb:${hexToRgb(colors.deep)};}`,
      injectTo: "head-prepend",
    },
  ];
  if (brand.faviconUrl)
    tags.push({
      tag: "link",
      attrs: { rel: "icon", href: brand.faviconUrl },
      injectTo: "head",
    });
  if (seo.description)
    tags.push(meta({ name: "description", content: seo.description }));
  if (seo.keywords)
    tags.push(meta({ name: "keywords", content: seo.keywords }));
  tags.push(meta({ property: "og:title", content: seo.ogTitle || title }));
  if (seo.ogDescription || seo.description) {
    tags.push(
      meta({
        property: "og:description",
        content: seo.ogDescription || seo.description,
      }),
    );
  }
  if (seo.url) tags.push(meta({ property: "og:url", content: seo.url }));
  if (seo.googleVerification)
    tags.push(
      meta({
        name: "google-site-verification",
        content: seo.googleVerification,
      }),
    );
  if (seo.facebookVerification)
    tags.push(
      meta({
        name: "facebook-domain-verification",
        content: seo.facebookVerification,
      }),
    );

  return {
    name: "store-brand-html",
    transformIndexHtml: () => tags,
  };
}
