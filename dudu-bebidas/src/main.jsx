import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap-icons/font/bootstrap-icons.css'
import { BrowserRouter } from 'react-router-dom'
import { resolveStore } from './supabase/Supabaseclient'

// ─────────────────────────────────────────────────────────────
// MULTI-LOJA: resolve a loja (VITE_STORE_SLUG → id) ANTES de montar o app.
// Todo hook/componente já nasce com o header "x-store-id" disponível no
// client do Supabase, então a primeíssima query (ex: useProducts no mount
// do App) já vem filtrada corretamente pela RLS.
// ─────────────────────────────────────────────────────────────

const rootElement = document.getElementById('root')

function renderStoreError(message) {
  rootElement.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#1a1a1a;color:#fff;font-family:sans-serif;text-align:center;padding:24px;">
      <div>
        <h1 style="font-size:20px;margin-bottom:8px;">Não foi possível carregar a loja</h1>
        <p style="opacity:.7;font-size:14px;">${message}</p>
      </div>
    </div>
  `
}

async function bootstrap() {
  try {
    await resolveStore()
  } catch (err) {
    console.error('[main] Falha ao resolver a loja:', err)
    renderStoreError(err.message ?? 'Verifique a configuração (VITE_STORE_SLUG).')
    return
  }

  createRoot(rootElement).render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>,
  )
}

bootstrap()
