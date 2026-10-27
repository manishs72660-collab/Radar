# Radar Benchmarks

## Environment
- Node.js v24 (backend)
- MongoDB Atlas M0 (free tier, shared cluster)
- Local Redis
- Seed: 3 monitors, ~12,000 checks over 14 days (5-min interval)
- k6 v0.x

## Methodology
- 5 VUs, 60s per test, 3 runs, median reported
- Rate limiting disabled on backend (`RATE_LIMIT_DISABLED=true`)
- Auto cleanup disabled (`AUTO_CLEANUP=false`)
- 20s warm-up before each baseline

## Dashboard summary (`GET /api/dashboard/summary`)

| Stage | p50 | p95 | p99 | RPS | Error |
|---|---|---|---|---|---|
| Baseline (no optimizations) | 639ms | 920ms | 1.27s | 2.68 | 0% |
| + Compound index on checks | 519ms | 807ms | — | 2.79 | 0% |
| + SWR cache + single-flight | 192ms | 481ms | 649ms | 3.60 | 0% |

**Verified improvements (baseline → final):**
- p50: **639ms → 192ms (-70%)**
- p95: **920ms → 481ms (-48%)**
- p99: **1270ms → 649ms (-49%)**
- RPS: **2.68 → 3.60 (+34%)**
- Error rate: 0% throughout

## Optimizations implemented

### 1. Compound index
```javascript
checkSchema.index({ monitorId: 1, checkedAt: 1 });