
export type CsvRow = Record<string, string>;

export interface ParsingResult {
  data: CsvRow[];
  columns: string[];
}

export interface AgentLog {
  id: string;
  timestamp: Date;
  message: string;
  type: 'info' | 'success' | 'error';
}

export enum ProcessingStatus {
  IDLE = 'IDLE',
  PROCESSING = 'PROCESSING',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
}

export interface ResearchTask {
  id: string;
  newColumnName: string;
  prompt: string;
}

export interface ResearchConfig {
  targetColumns: string[]; // Changed from single targetColumn to support composite keys
  tasks: ResearchTask[];
  useThinkingModel: boolean;
  rowLimit?: number;
}

export interface Source {
  title: string;
  uri: string;
}

export interface ResearchResult {
  text: string;
  sources: Source[];
}