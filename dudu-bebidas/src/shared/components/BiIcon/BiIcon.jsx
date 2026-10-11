import lightningChargeFill from "bootstrap-icons/icons/lightning-charge-fill.svg?raw";
import xCircleFill from "bootstrap-icons/icons/x-circle-fill.svg?raw";
import exclamationCircleFill from "bootstrap-icons/icons/exclamation-circle-fill.svg?raw";
import chevronLeft from "bootstrap-icons/icons/chevron-left.svg?raw";
import chevronRight from "bootstrap-icons/icons/chevron-right.svg?raw";
import search from "bootstrap-icons/icons/search.svg?raw";
import plusCircle from "bootstrap-icons/icons/plus-circle.svg?raw";
import dashCircle from "bootstrap-icons/icons/dash-circle.svg?raw";
import checkCircleFill from "bootstrap-icons/icons/check-circle-fill.svg?raw";
import whatsapp from "bootstrap-icons/icons/whatsapp.svg?raw";
import houseDoorFill from "bootstrap-icons/icons/house-door-fill.svg?raw";
import gridFill from "bootstrap-icons/icons/grid-fill.svg?raw";
import envelopeFill from "bootstrap-icons/icons/envelope-fill.svg?raw";
import envelope from "bootstrap-icons/icons/envelope.svg?raw";
import instagram from "bootstrap-icons/icons/instagram.svg?raw";
import geoAlt from "bootstrap-icons/icons/geo-alt.svg?raw";
import cupStraw from "bootstrap-icons/icons/cup-straw.svg?raw";
import cup from "bootstrap-icons/icons/cup.svg?raw";
import dropletFill from "bootstrap-icons/icons/droplet-fill.svg?raw";
import bag from "bootstrap-icons/icons/bag.svg?raw";
import tag from "bootstrap-icons/icons/tag.svg?raw";
import "./BiIcon.css";

// Só os ícones que o site usa, como SVG embutido — antes o site baixava a
// fonte inteira do Bootstrap Icons (~2.000 ícones, ~210 KB entre fonte e
// CSS) pra mostrar estes poucos. Mesmo desenho da fonte, então o visual
// não muda. Pra usar um ícone novo: importe o .svg dele aqui e adicione no
// mapa (lista completa em node_modules/bootstrap-icons/icons/).
const ICONS = {
  "lightning-charge-fill": lightningChargeFill,
  "x-circle-fill": xCircleFill,
  "exclamation-circle-fill": exclamationCircleFill,
  "chevron-left": chevronLeft,
  "chevron-right": chevronRight,
  "search": search,
  "plus-circle": plusCircle,
  "dash-circle": dashCircle,
  "check-circle-fill": checkCircleFill,
  "whatsapp": whatsapp,
  "house-door-fill": houseDoorFill,
  "grid-fill": gridFill,
  "envelope-fill": envelopeFill,
  "envelope": envelope,
  "instagram": instagram,
  "geo-alt": geoAlt,
  "cup-straw": cupStraw,
  "cup": cup,
  "droplet-fill": dropletFill,
  "bag": bag,
  "tag": tag,
};

// Mantém o <i className="bi bi-..."> de antes: o CSS do site estiliza os
// ícones por essa tag (tamanho, cor, hover) e continua valendo igual.
export default function BiIcon({ name, className = "", ...rest }) {
  const key = String(name).replace(/^bi-/, "");
  const svg = ICONS[key] ?? ICONS.tag;
  return (
    <i
      className={`bi bi-${key}${className ? ` ${className}` : ""}`}
      aria-hidden="true"
      {...rest}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
