import { useCallback, useLayoutEffect, useState } from "react";

const STORAGE_KEY = "adm-theme";

// data-theme no <html> é o que a CSS (Admin.css :root[data-theme="light"])
// usa pra trocar os tokens de cor — padrão continua escuro pra quem nunca
// mexeu no botão, e a escolha persiste entre sessões (por navegador).
export function useTheme() {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "light" ? "light" : "dark";
    } catch {
      return "dark";
    }
  });

  // useLayoutEffect (não useEffect): aplica antes do navegador pintar o
  // frame — evita um flash do tema antigo ao clicar no toggle. O flash do
  // carregamento inicial é resolvido à parte, pelo script síncrono no
  // <head> do index.html (roda antes até do React montar).
  useLayoutEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // localStorage indisponível (modo privado etc.) — só não persiste.
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === "light" ? "dark" : "light"));
  }, []);

  return { theme, toggleTheme };
}
