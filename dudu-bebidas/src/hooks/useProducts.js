// src/hooks/useProducts.js
import { useEffect, useState } from "react";
import { supabase } from "../supabase/Supabaseclient";

export function useProducts() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  useEffect(() => {
    async function fetchProducts() {
      setLoading(true);

      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("is_active", true)  // só produtos ativos aparecem na loja
        .order("name");

      if (error) {
        setError(error.message);
      } else {
        // Normaliza para o formato que seu app já usa
        const normalized = data.map((p) => ({
          id:          p.id,
          nome:        p.name,
          categoria:   p.category,
          preco:       Number(p.price),
          precoAntigo: p.old_price ? Number(p.old_price) : null,
          desconto:    p.discount,
          imagem:      p.image,
          estoque:     p.stock,
          promocao:    p.promotion,
          fornecedor:  p.supplier,
          ean:         p.ean,
          isActive:    p.is_active,
        }));
        setProducts(normalized);

        // Avisa o carrinho para sincronizar preços e estoques atualizados
        window.dispatchEvent(new CustomEvent("products-loaded", { detail: normalized }));
      }

      setLoading(false);
    }

    fetchProducts();
  }, []);

  return { products, loading, error };
}