import { formatBRL } from "../../../shared/utils/format";
import { getBillStatus, STATUS_LABEL, STATUS_ICON, daysUntilDue, remainingAmount } from "../billStatus";
import BillModal from "./BillModal";
import MarkPaidModal from "./MarkPaidModal";
import DeleteBillModal from "./DeleteBillModal";

const STATUS_FILTERS = [
  { value: "todas", label: "Todas" },
  { value: "a_vencer", label: "A Vencer" },
  { value: "vencido", label: "Vencido" },
  { value: "parcial", label: "Pago Parcial" },
  { value: "pago", label: "Pago" },
];

function summarise(bills) {
  const now = new Date();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let aVencer = 0;
  let vencido = 0;
  let pagoNoMes = 0;

  for (const bill of bills) {
    const status = getBillStatus(bill);
    if (status === "pago") {
      const paidDate = new Date(`${bill.paid_at}T00:00:00`);
      if (paidDate.getMonth() === now.getMonth() && paidDate.getFullYear() === now.getFullYear()) {
        pagoNoMes += Number(bill.amount_paid ?? bill.amount);
      }
      continue;
    }

    // a_vencer, vencido e parcial ainda têm dívida em aberto — o que falta
    // pagar entra no total certo (vencido ou a vencer) conforme a data,
    // mesmo já tendo recebido uma baixa parcial.
    const owed = status === "parcial" ? remainingAmount(bill) : Number(bill.amount);
    const overdue = new Date(`${bill.due_date}T00:00:00`) < today;
    if (overdue) vencido += owed; else aVencer += owed;
  }

  return { aVencer, vencido, pagoNoMes };
}

export default function ContasAPagarView({ contasAPagar }) {
  const {
    bills, filteredBills, loading, error, search, setSearch, statusFilter, setStatusFilter,
    dueDateFrom, setDueDateFrom, dueDateTo, setDueDateTo,
    billModal, setBillModal, modalForm, repeatMonths, setRepeatMonths, modalSaving, modalError,
    openNewBill, openEditBill, handleModalChange, handleModalSave,
    payingBill, payingSaving, payingError, requestMarkPaid, dismissMarkPaid, confirmMarkPaid,
    unmarkingId, handleUnmarkPaid,
    billToDelete, deleting, deleteError, requestDelete, dismissDelete, confirmDelete,
  } = contasAPagar;

  const { aVencer, vencido, pagoNoMes } = summarise(bills);
  const total = filteredBills.reduce((sum, b) => sum + Number(b.amount), 0);

  return (
    <>
      {billModal && (
        <BillModal
          billModal={billModal}
          modalForm={modalForm}
          repeatMonths={repeatMonths}
          setRepeatMonths={setRepeatMonths}
          modalSaving={modalSaving}
          modalError={modalError}
          handleModalChange={handleModalChange}
          handleModalSave={handleModalSave}
          setBillModal={setBillModal}
        />
      )}

      {payingBill && (
        <MarkPaidModal
          bill={payingBill}
          saving={payingSaving}
          error={payingError}
          onConfirm={confirmMarkPaid}
          onDismiss={dismissMarkPaid}
        />
      )}

      {billToDelete && (
        <DeleteBillModal
          bill={billToDelete}
          deleting={deleting}
          deleteError={deleteError}
          onConfirm={confirmDelete}
          onDismiss={dismissDelete}
        />
      )}

      <div className="adm-title-row">
        <div>
          <h1 className="adm-title">Contas a Pagar</h1>
          <p className="adm-subtitle">Controle das obrigações financeiras da loja.</p>
        </div>
        <button className="adm-btn-new-product" onClick={openNewBill}>
          + Nova Conta
        </button>
      </div>

      <div className="rpt-summary-grid">
        <div className="rpt-summary-card">
          <span className="rpt-summary-icon">⏳</span>
          <div className="rpt-summary-content">
            <span className="rpt-summary-value">{formatBRL(aVencer)}</span>
            <span className="rpt-summary-label">A vencer</span>
          </div>
        </div>
        <div className="rpt-summary-card">
          <span className="rpt-summary-icon">⚠️</span>
          <div className="rpt-summary-content">
            <span className="rpt-summary-value">{formatBRL(vencido)}</span>
            <span className="rpt-summary-label">Vencido</span>
          </div>
        </div>
        <div className="rpt-summary-card">
          <span className="rpt-summary-icon">✅</span>
          <div className="rpt-summary-content">
            <span className="rpt-summary-value">{formatBRL(pagoNoMes)}</span>
            <span className="rpt-summary-label">Pago este mês</span>
          </div>
        </div>
      </div>

      <div className="adm-product-filters">
        <input
          className="adm-product-search"
          placeholder="🔍 Buscar por referente, fornecedor ou categoria..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="pdv-bill-date-filter">
          <label>
            Vencimento de
            <input type="date" value={dueDateFrom} onChange={(e) => setDueDateFrom(e.target.value)} />
          </label>
          <label>
            até
            <input type="date" value={dueDateTo} onChange={(e) => setDueDateTo(e.target.value)} />
          </label>
          {(dueDateFrom || dueDateTo) && (
            <button
              type="button"
              className="pdv-bill-date-filter-clear"
              onClick={() => { setDueDateFrom(""); setDueDateTo(""); }}
            >
              ✕ Limpar
            </button>
          )}
        </div>
      </div>

      <div className="pdv-clientes-filters" style={{ marginBottom: 20 }}>
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            className={`pdv-clientes-filter-btn ${statusFilter === f.value ? "active" : ""}`}
            onClick={() => setStatusFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <div className="adm-modal-error">⚠️ {error}</div>}

      {loading ? (
        <div className="adm-loading">
          <div className="adm-spinner" />
          <p>Carregando...</p>
        </div>
      ) : filteredBills.length === 0 ? (
        <div className="adm-empty"><p>Nenhuma conta encontrada.</p></div>
      ) : (
        <div className="adm-product-table-wrap">
          <table className="adm-product-table">
            <thead>
              <tr>
                {["Status", "Vencimento", "Referente a", "Fornecedor", "Categoria", "Valor", "Ações"].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredBills.map((bill) => {
                const status = getBillStatus(bill);
                const days = daysUntilDue(bill.due_date);
                return (
                  <tr key={bill.id} className={status === "pago" ? "adm-row-inactive" : ""}>
                    <td>
                      <span className={`pdv-bill-status-pill ${status}`}>
                        {STATUS_ICON[status]} {STATUS_LABEL[status]}
                      </span>
                    </td>
                    <td>
                      {new Date(`${bill.due_date}T00:00:00`).toLocaleDateString("pt-BR")}
                      {status !== "pago" && (
                        <span className="rpt-summary-small" style={{ display: "block" }}>
                          {days === 0 ? "vence hoje" : days > 0 ? `em ${days}d` : `${Math.abs(days)}d atrasado`}
                        </span>
                      )}
                    </td>
                    <td className="adm-td-name">{bill.description}</td>
                    <td>{bill.supplier || "—"}</td>
                    <td>{bill.category ? <span className="adm-cat-badge">{bill.category}</span> : "—"}</td>
                    <td>
                      {formatBRL(bill.amount)}
                      {status === "parcial" && (
                        <span className="rpt-summary-small" style={{ display: "block" }}>
                          pago {formatBRL(bill.amount_paid)} · falta {formatBRL(remainingAmount(bill))}
                        </span>
                      )}
                    </td>
                    <td className="adm-td-actions">
                      {status !== "pago" && (
                        <button className="adm-btn-toggle activate" onClick={() => requestMarkPaid(bill)}>
                          💰 Baixar
                        </button>
                      )}
                      {(status === "pago" || status === "parcial") && (
                        <button
                          className="adm-btn-toggle deactivate"
                          onClick={() => handleUnmarkPaid(bill)}
                          disabled={unmarkingId === bill.id}
                        >
                          {unmarkingId === bill.id ? "..." : "↩️ Desfazer"}
                        </button>
                      )}
                      <button className="adm-btn-edit" onClick={() => openEditBill(bill)}>
                        ✏️ Editar
                      </button>
                      <button className="adm-btn-delete" onClick={() => requestDelete(bill)} title="Excluir conta">
                        🗑️
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="pdv-bill-table-total">
            {filteredBills.length} conta(s) · Total: {formatBRL(total)}
          </div>
        </div>
      )}
    </>
  );
}
