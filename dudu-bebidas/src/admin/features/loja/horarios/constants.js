export const DAYS = [
  { key: 0, label: "Domingo" },
  { key: 1, label: "Segunda-feira" },
  { key: 2, label: "Terça-feira" },
  { key: 3, label: "Quarta-feira" },
  { key: 4, label: "Quinta-feira" },
  { key: 5, label: "Sexta-feira" },
  { key: 6, label: "Sábado" },
];

export const DEFAULT_HOURS = DAYS.map((d) => ({
  day_of_week: d.key,
  is_open:     d.key !== 0 && d.key !== 1,
  open_time:   "09:00",
  close_time:  d.key === 0 || d.key === 6 ? "19:00" : "17:30",
}));
