import { useEffect } from "react";

// Mantém a tela do celular acesa enquanto `active` — com a tela bloqueada o
// navegador pausa a página e a localização para de ir pro cliente. O
// sistema solta a trava quando a página sai da tela; ela é pedida de novo
// quando o entregador volta. Navegador sem suporte: não faz nada.
export function useWakeLock(active) {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return undefined;

    let lock = null;
    const request = async () => {
      if (lock && !lock.released) return;
      try {
        lock = await navigator.wakeLock.request("screen");
      } catch {
        // bateria fraca, aba em segundo plano etc. — tenta de novo na volta
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") request();
    };

    request();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      lock?.release().catch(() => {});
    };
  }, [active]);
}
