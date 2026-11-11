import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { brandFilePath, brandHtmlPlugin, loadBrand } from './src/brands/brandBuild.js'

const brandsDir = fileURLToPath(new URL('./src/brands', import.meta.url))

// https://vite.dev/config/
export default defineConfig(async ({ mode }) => {
  // Marca da loja: src/brands/<VITE_STORE_SLUG>/brand.js (ou _default).
  // O site importa "@brand" e recebe só a marca desta loja.
  const slug = loadEnv(mode, process.cwd(), 'VITE_').VITE_STORE_SLUG
  const brandFile = brandFilePath(brandsDir, slug)
  const brand = await loadBrand(brandFile)

  return {
    plugins: [react(), brandHtmlPlugin(brand, slug)],
    resolve: {
      alias: { '@brand': brandFile },
      // O PDV (pdv-desktop/) tem o próprio node_modules com outra cópia do
      // React; duas cópias juntas quebram os hooks nos testes. Usa sempre a
      // da raiz (no CI só existe ela).
      dedupe: ['react', 'react-dom'],
    },
    base: '/',
    test: {
      environment: 'node',
      include: [
        'src/**/*.test.{js,jsx}',
        'pdv-desktop/src/**/*.test.{js,jsx}',
        'supabase/functions/**/*.test.ts',
      ],
      // Horário de Brasília em qualquer máquina (CI roda em UTC) — regras
      // de "aberto agora" e feriado dependem do fuso.
      env: { TZ: 'America/Sao_Paulo' },
      // Cada teste começa com mocks/stubs/relógio limpos
      restoreMocks: true,
      unstubGlobals: true,
      unstubEnvs: true,
      // Edge functions importam o Supabase por URL (Deno); nos testes
      // (Node) usa o mesmo pacote instalado pelo npm.
      alias: { 'https://esm.sh/@supabase/supabase-js@2': '@supabase/supabase-js' },
    },
  }
})
