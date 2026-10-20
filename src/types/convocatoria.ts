export interface Convocatoria {
  id: string;
  titulo: string;
  alcance: string; // e.g. "Aysén", "Atacama", "Todo Chile", etc.
  apertura: string | null;
  cierre: string | null;
  tope_aprox?: string | null;
  perfil?: string | string[];
  etapa?: string | string[];
  necesidad?: string | string[];
  venta?: string | string[];
  url: string;
  fuente: string; // "CORFO"
  vigente: boolean;
  permanente: boolean;
  firstSeenAt: string;
  lastSeenAt: string;
  fundId?: string | null; // Matched ID in CHILEAN_FUNDS
  resumen?: string | null;
  quienes_pueden_postular?: string | null;
  beneficio?: string | null;
  estado_corfo?: string;
  diasRestantes?: number | null;
  callStatus?: 'Abierta' | 'Cerrada' | 'Próxima' | 'Por confirmar';
  programa?: string | null;
}

export interface ConvocatoriasSyncMeta {
  lastSyncAt: string;
  total: number;
  totalVigentes: number;
  updatedAt?: string;
}
