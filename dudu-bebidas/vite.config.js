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
    },
    base: '/',
    test: {
      environment: 'node',
      include: [
        'src/**/*.test.{js,jsx}',
        'supabase/functions/**/*.test.ts',
      ],
    },
  }
})
