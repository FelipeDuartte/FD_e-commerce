import { useCallback, useEffect, useState } from "react";
import { EMPTY_PRODUCT, generateProductId } from "../utils/productConstants";
import {
  buildProductPayload,
  deleteAdminProduct,
  listAdminProducts,
  registerProductPurchase,
  saveAdminProduct,
  toggleAdminProductActive,
  validateProductPayload,
} from "../services/productService";
import { useProductImageSearch } from "./useProductImageSearch";

// Concentra todo o estado/lógica da view "Produtos": listagem, filtros, o
// modal de criar/editar (incluindo a busca/upload de imagem do produto) e
// a exclusão (com confirmação em modal próprio).
// onProductsChanged: avisa quem chamou (Pdv.jsx) sempre que um produto é
// criado/editado/desativado/excluído aqui — a tela de Venda tem sua PRÓPRIA
// cópia da lista (useProductCatalog), carregada uma vez só, e sem isso ela
// nunca saberia que algo mudou (ex: EAN cadastrado agora não aparecia na
// busca da Venda até reiniciar o app).
export function useProdutos(onProductsChanged) {
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
  const [productToPurchase, setProductToPurchase] = useState(null);

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
    setModalForm({
      ...product,
      old_price: product.old_price ?? "",
      // Produtos salvos antes do campo existir vêm com show_on_site nulo —
      // tratamos como "aparece no site" (mesmo default de produto novo),
      // sem mexer em quem já foi salvo explicitamente como desmarcado.
      show_on_site: product.show_on_site ?? true,
      pack_of_product_id: product.pack_of_product_id ?? "",
      pack_units: product.pack_units ?? "",
    });
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
      onProductsChanged?.();
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
      onProductsChanged?.();
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
      onProductsChanged?.();
      setProductToDelete(null);
    } catch (error) {
      console.error(error);
      setDeleteError(error.message);
    }
    setDeleting(false);
  };

  const requestPurchase = (product) => setProductToPurchase(product);
  const dismissPurchase = () => setProductToPurchase(null);

  const confirmPurchase = async (quantity, totalPaid) => {
    const outcome = await registerProductPurchase(productToPurchase, quantity, totalPaid);
    await fetchProducts();
    onProductsChanged?.();
    return outcome;
  };

  return {
    products, fetchProducts, productsLoading, productsError, productSearch, setProductSearch,
    productCategory, setProductCategory, productModal, setProductModal,
    modalForm, modalSaving, modalError, togglingId, filteredProducts,
    openNewProduct, openEditProduct, handleModalChange, handleModalSave,
    handleToggleActive, productImageSearch,
    productToDelete, deleting, deleteError, requestDelete, dismissDelete, confirmDelete,
    productToPurchase, requestPurchase, dismissPurchase, confirmPurchase,
  };
}
