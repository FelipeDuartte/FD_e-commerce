import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { supabase, getCurrentStoreId } from "../../../supabase/Supabaseclient";

// Busca o QR/copia-e-cola do Pix quando aplicável, e expõe as ações de
// "Já paguei" / "Copiar código". customerClaimedPaidAt vem de fora (é
// carregado/atualizado pelo useOrderStatusPolling) — onMarkPaid faz esse
// hook irmão refletir a marcação otimista sem os dois hooks precisarem se
// conhecer diretamente.
export function usePixCharge({ orderId, isPixPending, customerClaimedPaidAt, onMarkPaid }) {
  const [pixCharge, setPixCharge] = useState(null);
  const [pixQrImage, setPixQrImage] = useState(null);
  const [pixLoading, setPixLoading] = useState(false);
  const [pixError, setPixError] = useState("");
  const [claimingPaid, setClaimingPaid] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // "pixCharge" é a única guarda contra buscar de novo — nunca incluir
    // "pixLoading" nas dependências: setar pixLoading(true) aqui dentro
    // re-executaria o efeito, cuja função de cleanup (rodada ANTES da
    // nova execução) marcaria "cancelled=true" na requisição que acabou
    // de sair, matando a resposta assim que ela chegasse. Foi exatamente
    // o bug do "fica carregando pra sempre".
    if (!orderId || !isPixPending || customerClaimedPaidAt || pixCharge) return;

    let cancelled = false;

    // setState adiado (mesmo padrão usado em outros pontos do admin) pra
    // não disparar o lint react-hooks/set-state-in-effect por chamar
    // setState de forma síncrona direto no corpo do efeito.
    const timer = setTimeout(() => {
      if (cancelled) return;
      setPixLoading(true);
      setPixError("");

      supabase.functions
        .invoke("pix-charge", { body: { orderId, storeId: getCurrentStoreId() } })
        .then(async ({ data, error }) => {
          if (cancelled) return;
          if (error || data?.error) {
            setPixError(data?.error || "Não foi possível gerar o QR Code do Pix.");
            setPixLoading(false);
            return;
          }
          setPixCharge(data);
          try {
            const qrImage = await QRCode.toDataURL(data.brCode, { width: 260, margin: 1 });
            if (!cancelled) setPixQrImage(qrImage);
          } catch (e) {
            console.error("Erro ao gerar imagem do QR Code:", e);
          }
          if (!cancelled) setPixLoading(false);
        });
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [orderId, isPixPending, customerClaimedPaidAt, pixCharge]);

  const handleMarkPaid = async () => {
    setClaimingPaid(true);
    try {
      await supabase.rpc("mark_customer_claimed_paid", {
        p_order_id: orderId,
        p_store_id: getCurrentStoreId(),
      });
      onMarkPaid();
    } catch (e) {
      console.error("Erro ao registrar 'já paguei':", e);
    }
    setClaimingPaid(false);
  };

  const handleCopyPixCode = async () => {
    if (!pixCharge?.brCode) return;
    try {
      await navigator.clipboard.writeText(pixCharge.brCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error("Erro ao copiar código Pix:", e);
    }
  };

  return {
    pixCharge,
    pixQrImage,
    pixLoading,
    pixError,
    claimingPaid,
    copied,
    handleMarkPaid,
    handleCopyPixCode,
  };
}
