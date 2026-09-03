import { useState, useEffect } from "react";
import {
  getStoreConfig,
  updateStoreConfig,
  listStoreHours,
  upsertStoreHours,
} from "../../services/adminStoreService";
import { DAYS, DEFAULT_HOURS } from "../../constants";

export default function StoreHoursSection() {
  const [config, setConfig]   = useState(null);
  const [hours, setHours]     = useState(DEFAULT_HOURS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [cfg, hrs] = await Promise.all([getStoreConfig(), listStoreHours()]);
        if (cancelled) return;
        setConfig(cfg);
        if (hrs.length > 0) {
          const byDay = Object.fromEntries(hrs.map((h) => [h.day_of_week, h]));
          setHours(DAYS.map((d) => byDay[d.key]
            ? { day_of_week: d.key, is_open: byDay[d.key].is_open, open_time: (byDay[d.key].open_time ?? "09:00").slice(0, 5), close_time: (byDay[d.key].close_time ?? "19:00").slice(0, 5) }
            : DEFAULT_HOURS.find((dh) => dh.day_of_week === d.key)
          ));
        }
      } catch (e) { if (!cancelled) setError(e.message); }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const updateRow = (dayKey, field, value) =>
    setHours((prev) => prev.map((h) => h.day_of_week === dayKey ? { ...h, [field]: value } : h));

  const handleSave = async () => {
    setSaving(true); setError(""); setSuccess("");
    try {
      await Promise.all([
        upsertStoreHours(hours),
        config !== null ? updateStoreConfig({ close_on_holidays: config.close_on_holidays }) : Promise.resolve(),
      ]);
      setSuccess("Horários salvos com sucesso!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (e) { setError(e.message); }
    setSaving(false);
  };

  if (loading) return (
    <div className="adm-store-section">
      <div className="adm-loading"><div className="adm-spinner" /><p>Carregando horários…</p></div>
    </div>
  );

  return (
    <div className="adm-store-section">
      <div className="adm-store-section-header">
        <h2 className="adm-store-section-title">Horário de Funcionamento</h2>
        <p className="adm-store-section-desc">Defina abertura e fechamento por dia da semana.</p>
      </div>

      {error   && <div className="adm-modal-error">⚠️ {error}</div>}
      {success && <div className="adm-store-success">✅ {success}</div>}

      {config !== null && (
        <div className="adm-store-global-flags">
          <label className="adm-store-flag-row">
            <div className="adm-store-flag-info">
              <span className="adm-store-flag-label">🗓️ Fechar em feriados</span>
              <span className="adm-store-flag-desc">Fecha automaticamente em feriados nacionais.</span>
            </div>
            <div
              className={`adm-store-toggle ${config.close_on_holidays ? "on" : "off"}`}
              onClick={() => setConfig((p) => ({ ...p, close_on_holidays: !p.close_on_holidays }))}
              role="switch" aria-checked={config.close_on_holidays} tabIndex={0}
              onKeyDown={(e) => e.key === " " && setConfig((p) => ({ ...p, close_on_holidays: !p.close_on_holidays }))}
            >
              <span className="adm-store-toggle-thumb" />
            </div>
          </label>
        </div>
      )}

      <div className="adm-store-hours-grid">
        <div className="adm-store-hours-header">
          <span>Dia</span><span>Aberto</span><span>Abre às</span><span>Fecha às</span>
        </div>
        {DAYS.map((day) => {
          const row = hours.find((h) => h.day_of_week === day.key);
          if (!row) return null;
          return (
            <div key={day.key} className={`adm-store-hours-row ${!row.is_open ? "closed" : ""}`}>
              <span className="adm-store-day-label">{day.label}</span>
              <div
                className={`adm-store-toggle ${row.is_open ? "on" : "off"}`}
                onClick={() => updateRow(day.key, "is_open", !row.is_open)}
                role="switch" aria-checked={row.is_open} tabIndex={0}
                onKeyDown={(e) => e.key === " " && updateRow(day.key, "is_open", !row.is_open)}
              >
                <span className="adm-store-toggle-thumb" />
              </div>
              <input type="time" className="adm-store-time-input" value={row.open_time}
                onChange={(e) => updateRow(day.key, "open_time", e.target.value)} disabled={!row.is_open} />
              <input type="time" className="adm-store-time-input" value={row.close_time}
                onChange={(e) => updateRow(day.key, "close_time", e.target.value)} disabled={!row.is_open} />
            </div>
          );
        })}
      </div>

      <div className="adm-store-hours-save">
        <button className="adm-btn-new-product" onClick={handleSave} disabled={saving}>
          {saving ? "Salvando…" : "💾 Salvar Horários"}
        </button>
        <p className="adm-store-hours-hint">Alterações entram em vigor imediatamente.</p>
      </div>
    </div>
  );
}
