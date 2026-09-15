import { useCallback, useState } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

// Verifica uma vez ao montar o Pdv (mesmo estilo de useCashSession/
// useProdutos) se existe uma versão mais nova publicada — o manifesto é
// lido de endpoints/pubkey em tauri.conf.json (GitHub Releases). Nunca
// instala sozinho: só guarda o resultado, quem decide a hora de
// atualizar é o operador (clicando no aviso), nunca no meio de uma venda.
export function useAppUpdater() {
  const [update, setUpdate] = useState(null);
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState("");

  const checkForUpdate = useCallback(async () => {
    try {
      const result = await check();
      if (result?.available) setUpdate(result);
    } catch (e) {
      // Falha de rede/endpoint não deve incomodar o operador — só loga.
      console.error("[useAppUpdater] Erro ao verificar atualização:", e);
    }
  }, []);

  const installUpdate = useCallback(async () => {
    if (!update) return;
    setInstalling(true);
    setError("");
    try {
      await update.downloadAndInstall();
      await relaunch();
    } catch (e) {
      console.error("[useAppUpdater] Erro ao instalar atualização:", e);
      setError(e.message ?? "Não foi possível instalar a atualização.");
      setInstalling(false);
    }
  }, [update]);

  return {
    updateAvailable: Boolean(update),
    updateVersion: update?.version ?? null,
    installing,
    error,
    checkForUpdate,
    installUpdate,
  };
}
