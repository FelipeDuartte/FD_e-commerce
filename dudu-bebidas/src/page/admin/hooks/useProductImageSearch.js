import { useCallback, useEffect, useRef, useState } from "react";
import {
  findMasterImage,
  uploadProductImage,
} from "../services/adminImageService";

const DEBOUNCE_MS = 500;

// Estados possíveis do fluxo de imagem:
// "idle"       → nada digitado ainda / nome muito curto
// "searching"  → buscando no catálogo mestre
// "found"      → encontrou automaticamente
// "not_found"  → não encontrou, aguardando upload manual
// "uploading"  → enviando imagem selecionada pelo usuário
// "manual"     → usuário já enviou/trocou a imagem manualmente

/**
 * Hook responsável por buscar automaticamente (com debounce) uma imagem
 * no catálogo mestre do Cloudinary conforme o nome do produto muda, e
 * por expor o fluxo de upload manual quando nada é encontrado.
 *
 * @param {string} productName - nome atual do produto (form.name)
 * @param {string} currentImage - URL atual em form.image (produto existente)
 * @param {(url: string) => void} onImageResolved - chamado quando uma URL deve ser aplicada ao form
 * @param {string|number} resetKey - identidade do produto/modal (ex: "new" ou product.id).
 *   Sempre que mudar, o estado interno é reiniciado — evita "vazar" o resultado
 *   da busca de um produto para o próximo quando o modal é reaberto.
 */
export function useProductImageSearch(
  productName,
  currentImage,
  onImageResolved,
  resetKey,
) {
  const [status, setStatus] = useState(currentImage ? "manual" : "idle");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);

  const lastSearchedName = useRef(null);
  const debounceRef = useRef(null);
  const progressTimerRef = useRef(null);

  // Sempre que o modal é (re)aberto para um produto diferente, reinicia
  // o estado do fluxo de imagem com base no que já existe salvo.
  useEffect(() => {
    setStatus(currentImage ? "manual" : "idle");
    setError("");
    lastSearchedName.current = currentImage ? productName : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = (productName ?? "").trim();

    if (trimmed.length < 3) {
      setStatus("idle");
      return;
    }

    if (trimmed === lastSearchedName.current) return;

    debounceRef.current = setTimeout(async () => {
      lastSearchedName.current = trimmed;
      setStatus("searching");
      setError("");

      try {
        const result = await findMasterImage(trimmed);
        if (result.found) {
          setStatus("found");
          onImageResolved(result.url);
        } else {
          setStatus("not_found");
          onImageResolved("");
        }
      } catch (err) {
        console.error(err);
        setStatus("not_found");
        setError(
          "Não foi possível buscar automaticamente. Envie a imagem manualmente.",
        );
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(debounceRef.current);
  }, [productName, onImageResolved]);

  const uploadImage = useCallback(
    async (file) => {
      setStatus("uploading");
      setError("");
      setProgress(0);

      // supabase.functions.invoke não expõe progresso real de upload;
      // simulamos um avanço suave para dar feedback visual ao usuário.
      progressTimerRef.current = setInterval(() => {
        setProgress((prev) => (prev < 90 ? prev + 10 : prev));
      }, 150);

      try {
        const url = await uploadProductImage(file);
        setProgress(100);
        setStatus("manual");
        onImageResolved(url);
      } catch (err) {
        console.error(err);
        setStatus("not_found");
        setError(err.message || "Não foi possível enviar a imagem.");
      } finally {
        clearInterval(progressTimerRef.current);
        setTimeout(() => setProgress(0), 400);
      }
    },
    [onImageResolved],
  );

  const resetToManual = useCallback(() => {
    setStatus("not_found");
    setError("");
    onImageResolved("");
  }, [onImageResolved]);

  useEffect(() => {
    return () => {
      clearTimeout(debounceRef.current);
      clearInterval(progressTimerRef.current);
    };
  }, []);

  return { status, error, progress, uploadImage, resetToManual };
}
