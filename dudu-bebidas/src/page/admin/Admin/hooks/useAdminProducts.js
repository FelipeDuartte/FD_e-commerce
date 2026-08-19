import { useCallback, useEffect, useState } from "react";
import { EMPTY_PRODUCT, generateProductId } from "../../adminUtils";
import {
  buildProductPayload,
  listAdminProducts,
  saveAdminProduct,
  toggleAdminProductActive,
  validateProductPayload,
} from "../../services/adminProductService";
import { useProductImageSearch } from "../../hooks/useProductImageSearch";

// Concentra todo o estado/lógica da aba "Produtos": listagem, filtros, e o
// modal de criar/editar (incluindo a busca/upload de imagem do produto).
export function useAdminProducts(activeTab) {
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [productCategory, setProductCategory] = useState("todos");
  const [productModal, setProductModal] = useState(null);
  const [modalForm, setModalForm] = useState(EMPTY_PRODUCT);
  const [modalSaving, setModalSaving] = useState(false);
  const [modalError, setModalError] = useState("");
  const [togglingId, setTogglingId] = useState(null);

  const handleImageResolved = useCallback((url) => {
    setModalForm((prev) => ({ ...prev, image: url }));
  }, []);

  const productModalKey =
    productModal === "new" ? "new" : (productModal?.id ?? "closed");

  const productImageSearch = useProductImageSearch(
    modalForm.name,
    productModal && productModal !== "new" ? productModal.image : "",
    handleImageResolved,
    productModalKey,
  );

  const fetchProducts = useCallback(async () => {
    setProductsLoading(true);
    setProductsError("");
    try {
      setProducts(await listAdminProducts());
    } catch (error) {
      console.error(error);
      setProductsError(error.message);
    }
    setProductsLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (activeTab === "produtos" && products.length === 0) fetchProducts();
  }, [activeTab, fetchProducts, products.length]);

  const filteredProducts = products.filter((p) => {
    const matchSearch = p.name
      .toLowerCase()
      .includes(productSearch.toLowerCase());
    const matchCategory =
      productCategory === "todos" || p.category === productCategory;
    return matchSearch && matchCategory;
  });

  const openNewProduct = () => {
    setModalForm({ ...EMPTY_PRODUCT, id: generateProductId(products) });
    setModalError("");
    setProductModal("new");
  };

  const openEditProduct = (product) => {
    setModalForm({ ...product, old_price: product.old_price ?? "" });
    setModalError("");
    setProductModal(product);
  };

  const handleModalChange = ({ target: { name, value, type, checked } }) => {
    setModalForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleModalSave = async (e) => {
    e.preventDefault();
    setModalSaving(true);
    setModalError("");

    const row = buildProductPayload(modalForm);
    const validationError = validateProductPayload(row);

    if (validationError) {
      setModalError(validationError);
      setModalSaving(false);
      return;
    }

    const isNew = productModal === "new";
    const previousStock = isNew ? null : productModal.stock;
    try {
      await saveAdminProduct(row, isNew, previousStock);
      await fetchProducts();
      setProductModal(null);
    } catch (error) {
      console.error(error);
      setModalError(error.message);
    }

    setModalSaving(false);
  };

  const handleToggleActive = async (product) => {
    setTogglingId(product.id);
    setProductsError("");
    try {
      const updatedProduct = await toggleAdminProductActive(product);
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? updatedProduct : p)),
      );
    } catch (error) {
      console.error(error);
      setProductsError(error.message);
    }
    setTogglingId(null);
  };

  return {
    products, productsLoading, productsError, productSearch, setProductSearch,
    productCategory, setProductCategory, productModal, setProductModal,
    modalForm, modalSaving, modalError, togglingId, filteredProducts,
    openNewProduct, openEditProduct, handleModalChange, handleModalSave,
    handleToggleActive, productImageSearch,
  };
}
