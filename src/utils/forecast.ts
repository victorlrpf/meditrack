import { addDays } from './date';

export type StockStatus = 'unknown' | 'empty' | 'low' | 'ok';

export interface Forecast {
  /** Dias inteiros de estoque estimados (null quando não há como estimar). */
  daysRemaining: number | null;
  /** Data estimada de término do estoque. */
  estimatedEnd: string | null;
  /** Data a partir da qual vale planejar a reposição (término - antecedência). */
  alertDate: string | null;
  status: StockStatus;
  /** O estoque estimado cobre o tratamento até a data de término cadastrada. */
  coversTreatment: boolean;
}

export interface ForecastInput {
  stock: number;
  dailyConsumption: number;
  today: string;
  leadDays: number;
  treatmentEnd: string | null;
}

/**
 * dias_restantes = quantidade_disponivel / consumo_medio_diario
 * data_estimada_de_termino = data_atual + dias_restantes
 *
 * É uma estimativa baseada na programação cadastrada, não uma garantia.
 */
export function computeForecast(p: ForecastInput): Forecast {
  if (p.stock <= 0) {
    return {
      daysRemaining: 0,
      estimatedEnd: p.today,
      alertDate: p.today,
      status: 'empty',
      coversTreatment: false,
    };
  }
  if (!(p.dailyConsumption > 0)) {
    return {
      daysRemaining: null,
      estimatedEnd: null,
      alertDate: null,
      status: 'unknown',
      coversTreatment: false,
    };
  }
  const days = Math.floor(p.stock / p.dailyConsumption);
  const estimatedEnd = addDays(p.today, days);
  const alertDate = addDays(estimatedEnd, -p.leadDays);
  const coversTreatment = p.treatmentEnd !== null && estimatedEnd >= p.treatmentEnd;
  const low = !coversTreatment && days <= p.leadDays;
  return {
    daysRemaining: days,
    estimatedEnd,
    alertDate,
    status: low ? 'low' : 'ok',
    coversTreatment,
  };
}
