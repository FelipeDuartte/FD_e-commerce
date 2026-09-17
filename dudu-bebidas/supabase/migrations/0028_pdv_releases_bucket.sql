BEGIN;

-- ─────────────────────────────────────────────────────────────
-- Bucket público só pros instaladores/manifesto de atualização do PDV
-- desktop. O repositório do código é privado (GitHub bloqueia download
-- anônimo de asset de Release em repo privado — por isso o auto-update
-- nunca funcionava), então o CI passa a espelhar os arquivos JÁ
-- COMPILADOS aqui depois de gerar a Release — o código-fonte continua
-- 100% privado, só o resultado final (instalador) fica acessível sem
-- login, do jeito que o Tauri Updater exige.
-- ─────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('pdv-releases', 'pdv-releases', true)
ON CONFLICT (id) DO NOTHING;

COMMIT;
