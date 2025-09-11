export const TECHNICAL_CONFIG = {
  disaster_recovery: {
    rpo_hours: 1,
    rto_hours: 4,
    backup_retention_days: {
      daily: 7,
      weekly: 28,
      monthly: 365,
    },
  },
  performance: {
    query_timeout_ms: 3000,
    api_response_time_p95: 500,
    cache_ttl: {
      rankings: 30,
      works_list: 60,
      user_profile: 300,
      recommendations: 120,
    },
  },
  scaling: {
    database: {
      connections: { min: 25, max: 100 },
      cpu_threshold: 70,
      memory_threshold: 80,
    },
    edge_functions: {
      instances: { min: 2, max: 10 },
      rps_threshold: 100,
      cpu_threshold: 60,
    },
  },
} as const

export type TechnicalConfig = typeof TECHNICAL_CONFIG

