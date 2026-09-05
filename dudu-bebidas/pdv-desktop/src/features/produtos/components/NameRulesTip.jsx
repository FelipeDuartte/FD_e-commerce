export default function NameRulesTip() {
  return (
    <div className="pdv-name-rules">
      <h6 className="pdv-name-rules-title">ℹ️ Regras para cadastrar o nome do produto</h6>
      <p className="pdv-name-rules-desc">
        Utilize sempre esse padrão. Isso melhora a busca de produtos, evita duplicidade e permite localizar
        automaticamente as imagens.
      </p>

      <div className="pdv-name-rules-group">
        <strong>📦 Cerveja em caixa</strong>
        <div className="pdv-name-rules-examples">
          <div>• Caixa Brahma 600ml</div>
          <div>• Caixa Brahma Zero 600ml</div>
        </div>
      </div>

      <div className="pdv-name-rules-group">
        <strong>🍺 Cerveja em pack</strong>
        <div className="pdv-name-rules-examples">
          <div>• Pack Brahma 473ml</div>
          <div>• Pack Brahma Zero 473ml</div>
        </div>
      </div>

      <div className="pdv-name-rules-group">
        <strong>🥤 Unidade</strong>
        <div className="pdv-name-rules-examples">
          <div>• Brahma 600ml</div>
          <div>• Brahma lata 473ml</div>
          <div>• Brahma Zero lata 473ml</div>
          <div>• Brahma litro 1L</div>
          <div>• Brahma lata 350ml</div>
          <div>• Brahma Zero lata 350ml</div>
          <div>• Brahma Malzbier lata 350ml</div>
          <div>• Brahma Long Neck</div>
          <div>• Brahma Malzbier Long Neck</div>
          <div>• Brahma litrinho 300ml</div>
          <div>• Beats GT Gin Tônica 269ml</div>
        </div>
      </div>

      <p className="pdv-name-rules-hint">
        💡 <strong>Dica:</strong> sempre que possível, utilize o nome do produto conforme consta na embalagem. Evite
        abreviações e siglas.
      </p>
    </div>
  );
}
