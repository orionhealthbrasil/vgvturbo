export type DefectType = 'Good Service' | 'Long Delay' | 'No Response' | 'Rude/Tone' | 'Incorrect Info' | 'Other';

export interface Salesperson {
  id: string;
  name: string;
  created_at: string;
}

export interface Review {
  id: string;
  salesperson_id: string;
  response_time_minutes: number;
  defect_type: DefectType;
  review_date: string;
  notes: string | null;
  evidence_urls: string[];
  phone: string | null;
  conversation_history: string | null;
  created_at: string;
}

export interface ReviewWithSalesperson extends Review {
  salespeople: Salesperson;
}

export const DEFECT_TYPES: DefectType[] = [
  'Good Service',
  'Long Delay',
  'No Response',
  'Rude/Tone',
  'Incorrect Info',
  'Other',
];

export const DEFECT_LABELS: Record<DefectType, string> = {
  'Good Service': 'Bom Atendimento',
  'Long Delay': 'Atraso Longo',
  'No Response': 'Sem Resposta',
  'Rude/Tone': 'Grosseria/Tom',
  'Incorrect Info': 'Informação Incorreta',
  'Other': 'Outro',
};

export const getDefectLabel = (defect: DefectType): string => {
  return DEFECT_LABELS[defect] || defect;
};

export const getDefectColor = (defect: DefectType): string => {
  switch (defect) {
    case 'Good Service':
      return 'defect-good';
    case 'Long Delay':
      return 'defect-delay';
    case 'No Response':
      return 'defect-no-response';
    case 'Rude/Tone':
      return 'defect-rude';
    case 'Incorrect Info':
      return 'defect-incorrect';
    default:
      return 'defect-other';
  }
};

export const getDefectChartColor = (defect: DefectType): string => {
  switch (defect) {
    case 'Good Service':
      return 'hsl(142, 76%, 36%)';
    case 'Long Delay':
      return 'hsl(45, 93%, 47%)';
    case 'No Response':
      return 'hsl(0, 84%, 60%)';
    case 'Rude/Tone':
      return 'hsl(280, 65%, 60%)';
    case 'Incorrect Info':
      return 'hsl(217, 91%, 50%)';
    default:
      return 'hsl(215, 16%, 47%)';
  }
};
