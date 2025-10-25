# 📊 Rate Limiting Observability Dashboard

## 🎯 Key Metrics

### **Request Counters**
```
rate_limit_allowed_total{policy="Nearby"}     - Successful requests
rate_limit_allowed_total{policy="PostLocation"} - Successful requests
rate_limit_blocked_total{policy="Nearby"}     - Blocked requests  
rate_limit_blocked_total{policy="PostLocation"} - Blocked requests
```

### **Performance Metrics**
```
rate_limit_retry_after_seconds{policy="Nearby"}     - Retry delay histogram
rate_limit_remaining_tokens{policy="Nearby"}        - Token availability
```

## 🚨 Recommended Alerts

### **High Block Rate Alert**
```yaml
alert: RateLimitHighBlockRate
expr: rate(rate_limit_blocked_total[5m]) > 5
for: 2m
labels:
  severity: warning
annotations:
  summary: "High rate limiting block rate detected"
  description: "Policy {{ $labels.policy }} is blocking > 5 requests/sec for 2+ minutes"
```

### **Abuse Detection Alert**  
```yaml
alert: RateLimitAbuse
expr: rate(rate_limit_blocked_total{policy="Nearby"}[5m]) > 20
for: 1m
labels:
  severity: critical
annotations:
  summary: "Potential API abuse detected"
  description: "Nearby endpoint blocking > 20 requests/sec - possible abuse"
```

## 📈 Grafana Dashboard Queries

### **Request Rate Panel**
```promql
# Allowed requests per second
rate(rate_limit_allowed_total[1m])

# Blocked requests per second  
rate(rate_limit_blocked_total[1m])
```

### **Block Ratio Panel**
```promql
# Block percentage by policy
rate(rate_limit_blocked_total[5m]) / 
(rate(rate_limit_allowed_total[5m]) + rate(rate_limit_blocked_total[5m])) * 100
```

### **Retry Delay Heatmap**
```promql
# Retry-After distribution
rate_limit_retry_after_seconds_bucket
```

### **Token Availability Gauge**
```promql
# Current remaining tokens
rate_limit_remaining_tokens
```

## 🔍 Operational Queries

### **Top Blocked Policies**
```promql
topk(5, rate(rate_limit_blocked_total[5m]))
```

### **Average Retry Delay**
```promql
rate(rate_limit_retry_after_seconds_sum[5m]) / 
rate(rate_limit_retry_after_seconds_count[5m])
```

## 📋 Health Checks

### **Rate Limiting Health**
- ✅ Metrics are being recorded
- ✅ Block rate < 10% of total requests
- ✅ Average retry delay < 30 seconds
- ✅ No Redis connection errors in logs

### **Performance Baselines**
- **Nearby Policy:** < 5% block rate under normal load
- **PostLocation Policy:** < 2% block rate under normal load
- **Average Response Time:** < 50ms additional latency

## 🛠️ Troubleshooting

### **High Block Rate**
1. Check if legitimate traffic spike
2. Review policy capacity settings
3. Investigate potential abuse patterns
4. Consider temporary capacity increase

### **Redis Issues**
1. Monitor Redis connection health
2. Check fail-open behavior in logs
3. Verify Redis memory usage
4. Review TTL settings

### **Configuration Issues**
1. Validate policy settings in appsettings
2. Check environment-specific overrides
3. Verify DI registration
4. Test policy guardrails
