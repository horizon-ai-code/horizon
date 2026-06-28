export interface InsightMetric {
  title: string;
  before: string;
  after: string;
  direction: 'up' | 'down' | 'neutral';
  iconKey?: string;
  interpretation?: string;
}
