import { useCallback, useEffect, useRef, useState } from "react";
import { findMasterImage } from "../services/adminImageService";

const DEBOUNCE_MS = 500;

// Estados possíveis do fluxo de imagem (só catálogo — não existe upload):
// "idle"       → nada digitado ainda / nome muito curto
// "searching"  → buscando no catálogo mestre
// "found"      → encontrou no catálogo
// "not_found"  → nada parecido no catálogo (ou o operador removeu a imagem)
// "saved"      → produto já existente, com a imagem que estava salva

/**
 * Busca automaticamente (com debounce) imagens no catálogo mestre do
 * Cloudinary conforme o nome do produto muda.
 *
 * @param {string} productName - nome atual do produto (form.name)
 * @param {string} currentImage - URL atual em form.image (produto existente)
 * @param {(url: string) => void} onImageResolved - chamado quando uma URL deve ser aplicada ao form
 * @param {string|number} resetKey - identidade do produto/modal (ex: "new" ou product.id).
 *   Sempre que mudar, o estado interno é reiniciado — evita "vazar" o resultado
 *   da busca de um produto para o próximo quando o modal é reaberto.
 */
export function useProductImageSearch(productName, currentImage, onImageResolved, resetKey) {
  const [status, setStatus] = useState(currentImage ? "saved" : "idle");
  const [error, setError] = useState("");
  // Até 3 imagens parecidas do catálogo — a melhor já vem aplicada, as
  // outras ficam como "Não é essa?" pro operador trocar com um clique.
  const [candidates, setCandidates] = useState([]);
  const [selectedUrl, setSelectedUrl] = useState("");

  const lastSearchedName = useRef(null);
  const debounceRef = useRef(null);

  // Sempre que o modal é (re)aberto para um produto diferente, reinicia
  // o estado do fluxo de imagem com base no que já existe salvo.
  useEffect(() => {
    setStatus(currentImage ? "saved" : "idle");
    setError("");
    setCandidates([]);
    setSelectedUrl("");
    lastSearchedName.current = currentImage ? productName : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const runSearch = useCallback(
    async (name) => {
      lastSearchedName.current = name;
      setStatus("searching");
      setError("");

      try {
        const result = await findMasterImage(name);
        setCandidates(result.candidates ?? []);
        if (result.found) {
          setStatus("found");
          setSelectedUrl(result.url);
          onImageResolved(result.url);
        } else {
          setStatus("not_found");
          setSelectedUrl("");
          onImageResolved("");
        }
      } catch (err) {
        console.error(err);
        setStatus("not_found");
        setCandidates([]);
        setError("Não foi possível buscar no catálogo. Tente de novo em instantes.");
      }
    },
    [onImageResolved],
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = (productName ?? "").trim();

    if (trimmed.length < 3) {
      setStatus((prev) => (prev === "saved" ? prev : "idle"));
      setCandidates([]);
      return;
    }

    if (trimmed === lastSearchedName.current) return;

    debounceRef.current = setTimeout(() => runSearch(trimmed), DEBOUNCE_MS);

    return () => clearTimeout(debounceRef.current);
  }, [productName, runSearch]);

  // Produto antigo (imagem salva antes) ou depois de remover — busca de
  // novo no catálogo sem precisar mexer no nome.
  const searchAgain = useCallback(() => {
    const trimmed = (productName ?? "").trim();
    if (trimmed.length >= 3) runSearch(trimmed);
  }, [productName, runSearch]);

  const removeImage = useCallback(() => {
    setStatus("not_found");
    setError("");
    setSelectedUrl("");
    onImageResolved("");
  }, [onImageResolved]);

  const selectCandidate = useCallback(
    (url) => {
      setStatus("found");
      setError("");
      setSelectedUrl(url);
      onImageResolved(url);
    },
    [onImageResolved],
  );

  const selectedCandidate = candidates.find((c) => c.url === selectedUrl) ?? null;

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  return { status, error, removeImage, searchAgain, candidates, selectedCandidate, selectCandidate };
}
