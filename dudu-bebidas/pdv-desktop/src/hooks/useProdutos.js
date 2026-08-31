import { useCallback, useEffect, useState } from "react";
import { EMPTY_PRODUCT, generateProductId } from "../utils/productConstants";
import {
  buildProductPayload,
  deleteAdminProduct,
  listAdminProducts,
  saveAdminProduct,
  toggleAdminProductActive,
  validateProductPayload,
} from "../services/productService";
import { useProductImageSearch } from "./useProductImageSearch";

// Concentra todo o estado/lógica da view "Produtos": listagem, filtros, o
// modal de criar/editar (incluindo a busca/upload de imagem do produto) e
// a exclusão (com confirmação em modal próprio).
export function useProdutos() {
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
  const [productToDelete, setProductToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const handleImageResolved = useCallback((url) => {
    setModalForm((prev) => ({ ...prev, image: url }));
  }, []);

  const productModalKey = productModal === "new" ? "new" : (productModal?.id ?? "closed");

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
    fetchProducts();
  }, [fetchProducts]);

  const filteredProducts = products.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(productSearch.toLowerCase());
    const matchCategory = productCategory === "todos" || p.category === productCategory;
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
      setProducts((prev) => prev.map((p) => (p.id === product.id ? updatedProduct : p)));
    } catch (error) {
      console.error(error);
      setProductsError(error.message);
    }
    setTogglingId(null);
  };

  const requestDelete = (product) => {
    setDeleteError("");
    setProductToDelete(product);
  };

  const dismissDelete = () => {
    if (deleting) return;
    setProductToDelete(null);
    setDeleteError("");
  };

  const confirmDelete = async () => {
    if (!productToDelete) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await deleteAdminProduct(productToDelete);
      setProducts((prev) => prev.filter((p) => p.id !== productToDelete.id));
      setProductToDelete(null);
    } catch (error) {
      console.error(error);
      setDeleteError(error.message);
    }
    setDeleting(false);
  };

  return {
    products, productsLoading, productsError, productSearch, setProductSearch,
    productCategory, setProductCategory, productModal, setProductModal,
    modalForm, modalSaving, modalError, togglingId, filteredProducts,
    openNewProduct, openEditProduct, handleModalChange, handleModalSave,
    handleToggleActive, productImageSearch,
    productToDelete, deleting, deleteError, requestDelete, dismissDelete, confirmDelete,
  };
}
