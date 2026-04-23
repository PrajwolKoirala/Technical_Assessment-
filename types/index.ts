export type EntityType = "company" | "individual";

export interface SearchEntity {
  name: string;
  type: EntityType;
}

export type AdapterCategory = "social" | "technical" | "regulatory";
export type RiskLevel = "low" | "medium" | "high" | "critical" | "unknown";
export type ConfidenceLevel = "low" | "medium" | "high";
export type FindingStatus = "needs_review" | "confirmed" | "false_positive";

export interface DataPoint {
  id: string;
  title: string;
  value: string;
  sourceUrl?: string;
  sourceName?: string;
  timestamp: string;
  riskLevel: RiskLevel;
  confidence: ConfidenceLevel;
  urlValid?: boolean;     // set by URL validator
  raw?: Record<string, unknown>;
}

export interface AdapterResult {
  adapterId: string;
  adapterName: string;
  category: AdapterCategory;
  entityName: string;
  status: "success" | "error" | "partial";
  data: DataPoint[];
  error?: string;
  fetchedAt: string;
}

export interface RiskScore {
  overall: number;
  breakdown: { social: number; technical: number; regulatory: number };
  highRiskCount: number;
  criticalRiskCount: number;
}

export interface EntityProfile {
  image?: string;
  bio?: string;
  url?: string;
  location?: string;
  name?: string;
  tags?: string[];
  company?: string;
}

export interface SearchResult {
  id: string;
  entity: SearchEntity;
  results: AdapterResult[];
  riskScore: RiskScore;
  summary: string;
  profile?: EntityProfile;
  createdAt: string;
  completedAt?: string;
  status: "pending" | "running" | "complete" | "error";
}

export interface SearchHistoryEntry {
  id: string;
  entityName: string;
  entityType: EntityType;
  riskScore: number;
  dataPointCount: number;
  adapterCount: number;
  createdAt: string;
  status: "complete" | "error";
  profileImage?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface SearchApiRequest {
  name: string;
  type: EntityType;
}
