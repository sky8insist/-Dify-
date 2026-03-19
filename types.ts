
export interface StatMetric {
  label: string;
  value: string | number;
  trend: number; // percentage change
  trendDirection: 'up' | 'down';
}

// Removed Case, CaseStatus, CasePriority, AIAnalysisResult interfaces.
