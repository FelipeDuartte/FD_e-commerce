import { useCallback, useEffect, useMemo, useState } from "react";
import { EMPTY_PRODUCT, generateProductId } from "../utils/productConstants";
import {
  buildProductPayload,
  deleteAdminProduct,
  listAdminProducts,
  registerProductPurchase,
  registerProductBonus,
  saveAdminProduct,
  toggleAdminProductActive,
  validateProductPayload,
} from "../services/productService";
import { useProductImageSearch } from "./useProductImageSearch";
import { useProductsRealtime } from "../../../shared/hooks/useProductsRealtime";
import { findSimilarProducts, normalizeProductName } from "../utils/productNameMatch";

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
  // Produto praticamente igual a um já cadastrado → em vez de salvar direto,
  // pergunta se é outro produto mesmo (cadastro duplicado era o problema
  // mais comum: "para tudo" e "paratudo" viravam dois produtos).
  const [duplicateWarning, setDuplicateWarning] = useState(null);

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

  // Recarrega quando OUTRO terminal mexe em algum produto — mesmo motivo
  // do useProductCatalog (Venda), só que pra essa lista.
  useProductsRealtime(fetchProducts);

  const filteredProducts = products.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(productSearch.toLowerCase());
    const matchCategory = productCategory === "todos" || p.category === productCategory;
    return matchSearch && matchCategory;
  });

  const editingId = productModal && productModal !== "new" ? productModal.id : null;
  const similarProducts = useMemo(
    () => (productModal ? findSimilarProducts(modalForm.name, modalForm.ean, products, { excludeId: editingId }) : []),
    [productModal, modalForm.name, modalForm.ean, products, editingId],
  );

  const openNewProduct = () => {
    setModalForm({ ...EMPTY_PRODUCT, id: generateProductId(products) });
    setModalError("");
    setDuplicateWarning(null);
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
    setDuplicateWarning(null);
    setProductModal(product);
  };

  const handleModalChange = ({ target: { name, value, type, checked } }) => {
    if (name === "name" || name === "ean") setDuplicateWarning(null);
    setModalForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleNameBlur = () => {
    setModalForm((prev) => ({ ...prev, name: normalizeProductName(prev.name) }));
  };

  const applyProductName = (name) => {
    setDuplicateWarning(null);
    setModalForm((prev) => ({ ...prev, name }));
  };

  const persistProduct = async ({ ignoreDuplicates = false } = {}) => {
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
    // Na edição só pergunta se o nome/EAN mudou — senão um par de
    // duplicados antigo ficaria pedindo confirmação a cada edição.
    const identityChanged =
      isNew ||
      normalizeProductName(productModal.name) !== row.name ||
      String(productModal.ean ?? "") !== String(row.ean ?? "");
    const nearDuplicates = similarProducts.filter((s) => s.nearDuplicate);
    if (!ignoreDuplicates && identityChanged && nearDuplicates.length > 0) {
      setDuplicateWarning(nearDuplicates);
      setModalSaving(false);
      return;
    }

    const previousStock = isNew ? null : productModal.stock;
    try {
      await saveAdminProduct(row, isNew, previousStock);
      await fetchProducts();
      onProductsChanged?.();
      setProductModal(null);
      setDuplicateWarning(null);
    } catch (error) {
      console.error(error);
      setModalError(error.message);
    }

    setModalSaving(false);
  };

  const handleModalSave = (e) => {
    e.preventDefault();
    persistProduct();
  };

  const confirmSaveDuplicate = () => persistProduct({ ignoreDuplicates: true });
  const dismissDuplicateWarning = () => setDuplicateWarning(null);

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

  // Bonificação do fornecedor (grátis) — mesmo modal de registrar compra,
  // caminho diferente porque não tem valor pago e não mexe no custo.
  const confirmBonus = async (quantity) => {
    const outcome = await registerProductBonus(productToPurchase, quantity);
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
    similarProducts, duplicateWarning, confirmSaveDuplicate, dismissDuplicateWarning,
    handleNameBlur, applyProductName,
    productToDelete, deleting, deleteError, requestDelete, dismissDelete, confirmDelete,
    productToPurchase, requestPurchase, dismissPurchase, confirmPurchase, confirmBonus,
  };
}
