export interface ReplayStep {
  title: string;
  description: string;
  codeSnapshot: string;
  issueLines: number[];
  addedLines: number[];
  removedLines: number[];
}

export interface InsightMetric {
  title: string;
  before: string;
  after: string;
  direction: 'up' | 'down' | 'neutral';
  iconKey?: string;
}
