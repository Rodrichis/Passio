import { Timestamp } from "firebase/firestore";

export type Cliente = {
  id: string;
  nombreCompleto: string;
  email: string;
  telefono: string;
  so?: "ios" | "android" | string;
  creadoEn?: Date | null;
  ultimaVisita?: Date | null;
  activo?: boolean;
  visitasTotales?: number;
  cicloVisitas?: number;
  premiosDisponibles?: number;
  premiosCanjeados?: number;
};

export function mapDoc(d: any): Cliente {
  const data = d.data() || {};
  const nombre =
    data.nombreCompleto ?? data["Nombre completo"] ?? data.nombre ?? "";
  const so = data.so ?? data.SO ?? undefined;
  const creado =
    data.creadoEn?.toDate?.() ??
    data.fechaRegistro?.toDate?.() ??
    (data.creadoEn instanceof Timestamp ? data.creadoEn.toDate() : null) ??
    null;
  const ultimaVisita =
    data.ultimaVisita?.toDate?.() ??
    (data.ultimaVisita instanceof Timestamp ? data.ultimaVisita.toDate() : null) ??
    null;

  return {
    id: d.id,
    nombreCompleto: nombre,
    email: data.email ?? "",
    telefono: data.telefono ?? "",
    so,
    creadoEn: creado,
    ultimaVisita,
    activo: data.activo ?? true,
    visitasTotales: data.visitasTotales ?? 0,
    cicloVisitas: data.cicloVisitas ?? 0,
    premiosDisponibles: data.premiosDisponibles ?? 0,
    premiosCanjeados: data.premiosCanjeados ?? 0,
  };
}

export function filterItems(
  items: Cliente[],
  search: string,
  filterOS: "all" | "ios" | "android",
  filterPremios: "all" | "with" | "without"
) {
  const term = search.trim().toLowerCase();
  return items.filter((it) => {
    const termMatch =
      !term ||
      (it.nombreCompleto || "").toLowerCase().includes(term) ||
      (it.email || "").toLowerCase().includes(term) ||
      (it.id || "").toLowerCase().includes(term);

    const osMatch =
      filterOS === "all" ||
      (it.so || "").toLowerCase() === filterOS;

    const premios = Number(it.premiosDisponibles ?? 0);
    const premiosMatch =
      filterPremios === "all" ||
      (filterPremios === "with" && premios > 0) ||
      (filterPremios === "without" && premios <= 0);

    return termMatch && osMatch && premiosMatch;
  });
}

export function sortItems(
  items: Cliente[],
  sortOrder: "asc" | "desc"
): Cliente[] {
  const copy = items.slice();
  copy.sort((a, b) => {
    const aTime = a.creadoEn instanceof Date ? a.creadoEn.getTime() : 0;
    const bTime = b.creadoEn instanceof Date ? b.creadoEn.getTime() : 0;
    return sortOrder === "desc" ? bTime - aTime : aTime - bTime;
  });
  return copy;
}
