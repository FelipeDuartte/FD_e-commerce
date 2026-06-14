// src/hooks/useProducts.js
import { useEffect, useState } from "react";
import { listActiveProducts } from "../supabase/services/shopProductService";

export function useProducts() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchProducts() {
      setLoading(true);
      setError(null);

      try {
        const normalized = await listActiveProducts();

        if (!isMounted) return;
        setProducts(normalized);

        // Avisa o carrinho para sincronizar preços e estoques atualizados
        window.dispatchEvent(new CustomEvent("products-loaded", { detail: normalized }));
      } catch (error) {
        if (isMounted) setError(error.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchProducts();

    return () => {
      isMounted = false;
    };
  }, []);

  return { products, loading, error };
}
