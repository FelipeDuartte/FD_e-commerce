# Marcas das lojas

Cada loja tem uma pasta com o **mesmo nome do slug** (`VITE_STORE_SLUG`) e um
`brand.js` dentro. O build usa só a marca da loja configurada; loja sem pasta
usa `_default` (nome vindo do banco, sem logo, banners nem "Sobre").

Nova loja: copie `loja-teste-a/brand.js` para `src/brands/<slug>/brand.js` e
troque o conteúdo. Todos os campos são opcionais.

| Campo | O que é |
|---|---|
| `name` | Nome da loja (título, rodapé, admin) |
| `logoText` | `["Primeira", "Destaque"]` — a segunda parte sai na cor da marca |
| `logoUrl`, `faviconUrl` | Imagens do logo e do ícone da aba |
| `colors` | `primary` (cor principal), `light`, `dark` e `deep` (ponta dos degradês) |
| `seo` | `title`, `description`, `keywords`, `url`, `ogTitle`, `ogDescription`, `googleVerification`, `facebookVerification` |
| `searchPlaceholder` | Texto da busca ("Buscar bebidas...") |
| `productsLabel` | Item "produtos" do menu do celular |
| `topBanners` | Faixa do topo: `titulo`, `subtitulo`, `texto`, `bg`, `titleColor`, `textColor` |
| `heroSlides` | Carrossel: `title`, `subtitle`, `description`, `badge`, `imageSmall`, `imageLarge` (ou `bg` em degradê), `ctaText`, `category` |
| `about` | "Sobre": `eyebrow`, `title` (lista de linhas), `text`, `stats`, `chips` |
| `footer` | `tagline`, `email`, `location`, `closing` ("Beba com moderação.") |
| `legal` | Termos e privacidade: `city`, `deliveryTime` ("30 minutos"), `contactEmail` (padrão: e-mail do rodapé), `updatedAt` ("março de 2026") |

Dados que mudam sem novo deploy (WhatsApp, Instagram, endereço de retirada,
aviso de +18) ficam no cadastro da loja no banco (tabela `stores`), não aqui.
Os termos e a política também leem do banco os bairros atendidos e as formas
de pagamento ativas.

**Não coloque segredo aqui** — tudo isso vai para o navegador do cliente.
