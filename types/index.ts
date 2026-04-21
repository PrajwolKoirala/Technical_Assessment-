// ─────────────────────────────────────────────────────────────────────────────
// Core Entity Types
// ─────────────────────────────────────────────────────────────────────────────

export type EntityType = "company" | "individual";

export interface SearchEntity {
  name: string;
  type: EntityType;
}

// ─────────────────────────────────────────────────────────────────────────────
// Adapter / Data Source Types
// ─────────────────────────────────────────────────────────────────────────────

export type AdapterCategory =
  | "social"       // Social & Public Footprint
  | "technical"    // Technical Infrastructure
  | "regulatory";  // Contextual & Regulatory

export type RiskLevel = "low" | "medium" | "high" | "critical" | "unknown";
export type ConfidenceLevel = "low" | "medium" | "high";

export interface DataPoint {
  id: string;
  title: string;
  value: string;
  sourceUrl?: string;
  timestamp: string;
  riskLevel: RiskLevel;
  confidence: ConfidenceLevel;
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

// ─────────────────────────────────────────────────────────────────────────────
// Search / Report Types
// ─────────────────────────────────────────────────────────────────────────────

export interface RiskScore {
  overall: number;            // 0-100
  breakdown: {
    social: number;
    technical: number;
    regulatory: number;
  };
  highRiskCount: number;
  criticalRiskCount: number;
}

export interface SearchResult {
  id: string;
  entity: SearchEntity;
  results: AdapterResult[];
  riskScore: RiskScore;
  summary: string;
  createdAt: string;
  completedAt?: string;
  status: "pending" | "running" | "complete" | "error";
}

// ─────────────────────────────────────────────────────────────────────────────
// Database / History Types
// ─────────────────────────────────────────────────────────────────────────────

export interface SearchHistoryEntry {
  id: string;
  entityName: string;
  entityType: EntityType;
  riskScore: number;
  dataPointCount: number;
  adapterCount: number;
  createdAt: string;
  status: "complete" | "error";
}

// ─────────────────────────────────────────────────────────────────────────────
// API Response Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface SearchApiRequest {
  name: string;
  type: EntityType;
}
