package alerts

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestLoadRuleSetValidationAndDefaultBranches(t *testing.T) {
	empty, err := LoadRuleSet("")
	if err != nil {
		t.Fatalf("expected empty path to load defaults: %v", err)
	}
	if empty.Config.Version != 1 || len(empty.Rules) != 0 {
		t.Fatalf("unexpected empty rule set: %+v", empty)
	}

	for name, contents := range map[string]string{
		"bad-yaml":         "version: [",
		"bad-default":      "defaults:\n  cooldown: nope\nrules: []\n",
		"missing-id":       "rules:\n  - summary: Missing id\n    condition:\n      kind: refresh_failed\n",
		"missing-summary":  "rules:\n  - id: missing-summary\n    condition:\n      kind: refresh_failed\n",
		"bad-rule-cooldown": "rules:\n  - id: bad-cooldown\n    summary: Bad cooldown\n    cooldown: nope\n    condition:\n      kind: refresh_failed\n",
	} {
		t.Run(name, func(t *testing.T) {
			path := filepath.Join(t.TempDir(), "rules.yaml")
			if err := os.WriteFile(path, []byte(contents), 0o600); err != nil {
				t.Fatalf("write rules: %v", err)
			}
			if _, err := LoadRuleSet(path); err == nil {
				t.Fatalf("expected %s to fail validation", name)
			}
		})
	}

	if _, err := LoadRuleSet(filepath.Join(t.TempDir(), "missing.yaml")); err == nil || !strings.Contains(err.Error(), "read alert rules") {
		t.Fatalf("expected missing file read error, got %v", err)
	}
}

func TestEvaluateCoversMetricVariantsMissingServiceAndInactiveBranches(t *testing.T) {
	now := time.Date(2026, time.May, 20, 12, 0, 0, 0, time.UTC)
	ruleSet := &RuleSet{Rules: []CompiledRule{
		{ID: "core-down", Summary: "Core down", Severity: "critical", Cooldown: time.Minute, Condition: ConditionConfig{Kind: ConditionKindServiceDown, Service: "core"}},
		{ID: "mem-high", Summary: "Memory high", Severity: "warning", Cooldown: time.Minute, Condition: ConditionConfig{Kind: ConditionKindSystemAbove, Metric: "memory_used_percent", Threshold: 80}},
		{ID: "disk-high", Summary: "Disk high", Severity: "warning", Cooldown: time.Minute, Condition: ConditionConfig{Kind: ConditionKindSystemAbove, Metric: "disk_used_percent", Threshold: 80}},
		{ID: "unknown-metric", Summary: "Unknown metric", Severity: "info", Cooldown: time.Minute, Condition: ConditionConfig{Kind: ConditionKindSystemAbove, Metric: "unknown", Threshold: 1}},
		{ID: "refresh-failed", Summary: "Refresh failed", Severity: "critical", Cooldown: time.Minute, Condition: ConditionConfig{Kind: ConditionKindRefreshFailed}},
		{ID: "unknown-kind", Summary: "Unknown kind", Severity: "info", Cooldown: time.Minute, Condition: ConditionConfig{Kind: "unknown"}},
	}}

	alerts := ruleSet.Evaluate(Snapshot{
		LastRefreshSuccess: false,
		System: SystemSnapshot{
			MemoryUsedPercent: 91,
			DiskUsedPercent:   95,
			DiskPath:          "/tmp",
		},
		Probes: []ProbeSnapshot{{Name: "content", Up: true, StatusCode: 200}},
		Errors: []string{"refresh blew up"},
	}, now)

	ids := map[string]EvaluatedAlert{}
	for _, alert := range alerts {
		ids[alert.ID] = alert
	}
	for _, id := range []string{"core-down", "mem-high", "disk-high", "refresh-failed"} {
		if _, ok := ids[id]; !ok {
			t.Fatalf("expected alert %s in %+v", id, alerts)
		}
	}
	if _, ok := ids["unknown-metric"]; ok {
		t.Fatalf("unknown metric should not fire: %+v", alerts)
	}
	if !strings.Contains(ids["core-down"].Observed, "missing probe") {
		t.Fatalf("expected missing probe observation, got %+v", ids["core-down"])
	}
	if ids["refresh-failed"].Observed != "refresh blew up" {
		t.Fatalf("expected first refresh error as observed text, got %+v", ids["refresh-failed"])
	}

	inactive := ruleSet.Evaluate(Snapshot{
		LastRefreshSuccess: true,
		System:             SystemSnapshot{MemoryUsedPercent: 10, DiskUsedPercent: 10},
		Probes:             []ProbeSnapshot{{Name: "core", Up: true}},
	}, now)
	if len(inactive) != 0 {
		t.Fatalf("expected inactive snapshot to produce no alerts, got %+v", inactive)
	}
}
