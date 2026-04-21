package alerts

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestLoadRuleSetAndEvaluate(t *testing.T) {
	t.Parallel()

	tempDirectory := t.TempDir()
	rulesPath := filepath.Join(tempDirectory, "alert-rules.yaml")
	if err := os.WriteFile(rulesPath, []byte(`
version: 1
defaults:
  severity: warning
  cooldown: 5m
rules:
  - id: intel-service-down
    summary: Intel service is down
    condition:
      kind: service_down
      service: intel
  - id: high-cpu
    summary: CPU is high
    condition:
      kind: system_above
      metric: cpu_percent
      threshold: 80
  - id: refresh-failed
    summary: Refresh failed
    condition:
      kind: refresh_failed
`), 0o600); err != nil {
		t.Fatalf("write rules file: %v", err)
	}

	ruleSet, err := LoadRuleSet(rulesPath)
	if err != nil {
		t.Fatalf("load rules: %v", err)
	}

	alerts := ruleSet.Evaluate(Snapshot{
		LastRefreshSuccess: false,
		System: SystemSnapshot{
			CPUPercent: 91,
		},
		Probes: []ProbeSnapshot{
			{
				Name:       "intel",
				Up:         false,
				StatusCode: 503,
				Error:      "timeout",
			},
		},
	}, time.Date(2026, time.April, 20, 23, 0, 0, 0, time.UTC))

	if len(alerts) != 3 {
		t.Fatalf("expected 3 alerts, got %d", len(alerts))
	}
}

func TestDispatcherDeliversAndResolvesAlerts(t *testing.T) {
	t.Parallel()

	requestBodies := make(chan string, 2)
	server := newTestWebhookServer(t, requestBodies)
	dispatcher := NewDispatcher(DispatcherConfig{
		WebhookURL: server.URL,
		Source:     "atlas-metrics-test",
	}, time.Second)

	result := dispatcher.Process(t.Context(), []EvaluatedAlert{
		{
			ID:       "core-service-down",
			Summary:  "Core service is down",
			Severity: "critical",
			Observed: "service=core status=503",
			Cooldown: "1m",
		},
	}, false)

	if !result.Delivered {
		t.Fatalf("expected first dispatch to deliver, got %+v", result)
	}

	result = dispatcher.Process(t.Context(), nil, false)
	if !result.Delivered {
		t.Fatalf("expected resolve dispatch to deliver, got %+v", result)
	}
}

func TestDispatcherDisabledWebhookDoesNotAttemptDelivery(t *testing.T) {
	t.Parallel()

	dispatcher := NewDispatcher(DispatcherConfig{
		Source: "atlas-metrics-test",
	}, time.Second)

	result := dispatcher.Process(t.Context(), []EvaluatedAlert{
		{
			ID:       "core-service-down",
			Summary:  "Core service is down",
			Severity: "critical",
			Observed: "service=core status=503",
			Cooldown: "1m",
		},
	}, false)

	if result.Enabled {
		t.Fatalf("expected disabled webhook, got %+v", result)
	}

	if result.Attempted {
		t.Fatalf("expected disabled webhook not to attempt delivery, got %+v", result)
	}

	if result.Delivered {
		t.Fatalf("expected disabled webhook not to deliver, got %+v", result)
	}
}
