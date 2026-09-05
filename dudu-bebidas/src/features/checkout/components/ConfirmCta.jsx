export default function ConfirmCta({ label, onClick, disabled }) {
  return (
    <>
      <button className="co-cta" onClick={onClick} disabled={disabled}>
        {label}
      </button>
      <div className="co-secure">🔒 Pagamento 100% seguro</div>
    </>
  );
}
