package alerts

import (
	"fmt"
	"os"
	"time"

	"gopkg.in/yaml.v3"
)

const (
	ConditionKindServiceDown   = "service_down"
	ConditionKindSystemAbove   = "system_above"
	ConditionKindRefreshFailed = "refresh_failed"
)

type Config struct {
	Version  int            `yaml:"version" json:"version"`
	Defaults DefaultsConfig `yaml:"defaults" json:"defaults"`
	Rules    []RuleConfig   `yaml:"rules" json:"rules"`
}

type DefaultsConfig struct {
	Severity string `yaml:"severity" json:"severity"`
	Cooldown string `yaml:"cooldown" json:"cooldown"`
}

type RuleConfig struct {
	ID          string            `yaml:"id" json:"id"`
	Summary     string            `yaml:"summary" json:"summary"`
	Description string            `yaml:"description" json:"description,omitempty"`
	Severity    string            `yaml:"severity" json:"severity,omitempty"`
	Cooldown    string            `yaml:"cooldown" json:"cooldown,omitempty"`
	Labels      map[string]string `yaml:"labels" json:"labels,omitempty"`
	Condition   ConditionConfig   `yaml:"condition" json:"condition"`
}

type ConditionConfig struct {
	Kind      string  `yaml:"kind" json:"kind"`
	Service   string  `yaml:"service,omitempty" json:"service,omitempty"`
	Metric    string  `yaml:"metric,omitempty" json:"metric,omitempty"`
	Threshold float64 `yaml:"threshold,omitempty" json:"threshold,omitempty"`
}

type RuleSet struct {
	Config Config
	Rules  []CompiledRule
}

type CompiledRule struct {
	ID          string
	Summary     string
	Description string
	Severity    string
	Cooldown    time.Duration
	Labels      map[string]string
	Condition   ConditionConfig
}

type ProbeSnapshot struct {
	Name           string
	URL            string
	Up             bool
	StatusCode     int
	LatencySeconds float64
	Error          string
	LastCheckedUTC string
}

type SystemSnapshot struct {
	CPUPercent        float64
	MemoryUsedBytes   uint64
	MemoryTotalBytes  uint64
	MemoryUsedPercent float64
	DiskPath          string
	DiskUsedBytes     uint64
	DiskTotalBytes    uint64
	DiskUsedPercent   float64
}

type Snapshot struct {
	LastRefreshSuccess bool
	LastRefreshedUTC   string
	System             SystemSnapshot
	Probes             []ProbeSnapshot
	Errors             []string
}

type EvaluatedAlert struct {
	ID          string            `json:"id"`
	Status      string            `json:"status"`
	Summary     string            `json:"summary"`
	Description string            `json:"description,omitempty"`
	Severity    string            `json:"severity"`
	Labels      map[string]string `json:"labels,omitempty"`
	Observed    string            `json:"observed"`
	Value       float64           `json:"value,omitempty"`
	TriggeredAt string            `json:"triggeredAtUtc,omitempty"`
	Cooldown    string            `json:"cooldown"`
}

func LoadRuleSet(path string) (*RuleSet, error) {
	if path == "" {
		return &RuleSet{
			Config: Config{
				Version: 1,
			},
		}, nil
	}

	contents, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read alert rules: %w", err)
	}

	var cfg Config
	if err := yaml.Unmarshal(contents, &cfg); err != nil {
		return nil, fmt.Errorf("parse alert rules: %w", err)
	}

	return compileRuleSet(cfg)
}

func compileRuleSet(cfg Config) (*RuleSet, error) {
	if cfg.Version == 0 {
		cfg.Version = 1
	}

	defaultSeverity := cfg.Defaults.Severity
	if defaultSeverity == "" {
		defaultSeverity = "warning"
	}

	defaultCooldown := 10 * time.Minute
	if cfg.Defaults.Cooldown != "" {
		parsedCooldown, err := time.ParseDuration(cfg.Defaults.Cooldown)
		if err != nil {
			return nil, fmt.Errorf("parse default cooldown: %w", err)
		}
		defaultCooldown = parsedCooldown
	}

	rules := make([]CompiledRule, 0, len(cfg.Rules))
	for _, rule := range cfg.Rules {
		compiledRule, err := compileRule(rule, defaultSeverity, defaultCooldown)
		if err != nil {
			return nil, err
		}
		rules = append(rules, compiledRule)
	}

	return &RuleSet{
		Config: cfg,
		Rules:  rules,
	}, nil
}

func compileRule(rule RuleConfig, defaultSeverity string, defaultCooldown time.Duration) (CompiledRule, error) {
	if rule.ID == "" {
		return CompiledRule{}, fmt.Errorf("alert rule id is required")
	}
	if rule.Summary == "" {
		return CompiledRule{}, fmt.Errorf("alert rule %q summary is required", rule.ID)
	}

	cooldown := defaultCooldown
	if rule.Cooldown != "" {
		parsedCooldown, err := time.ParseDuration(rule.Cooldown)
		if err != nil {
			return CompiledRule{}, fmt.Errorf("parse cooldown for %q: %w", rule.ID, err)
		}
		cooldown = parsedCooldown
	}

	severity := rule.Severity
	if severity == "" {
		severity = defaultSeverity
	}

	return CompiledRule{
		ID:          rule.ID,
		Summary:     rule.Summary,
		Description: rule.Description,
		Severity:    severity,
		Cooldown:    cooldown,
		Labels:      cloneLabels(rule.Labels),
		Condition:   rule.Condition,
	}, nil
}

func (r *RuleSet) Evaluate(snapshot Snapshot, now time.Time) []EvaluatedAlert {
	evaluatedAlerts := make([]EvaluatedAlert, 0, len(r.Rules))

	for _, rule := range r.Rules {
		alert, active := evaluateRule(rule, snapshot, now)
		if !active {
			continue
		}

		evaluatedAlerts = append(evaluatedAlerts, alert)
	}

	return evaluatedAlerts
}

func evaluateRule(rule CompiledRule, snapshot Snapshot, now time.Time) (EvaluatedAlert, bool) {
	switch rule.Condition.Kind {
	case ConditionKindServiceDown:
		for _, probe := range snapshot.Probes {
			if probe.Name != rule.Condition.Service {
				continue
			}

			if probe.Up {
				return EvaluatedAlert{}, false
			}

			observed := fmt.Sprintf("service=%s status=%d error=%s", probe.Name, probe.StatusCode, probe.Error)
			return buildAlert(rule, observed, 0, now), true
		}

		return buildAlert(rule, fmt.Sprintf("service=%s missing probe result", rule.Condition.Service), 0, now), true

	case ConditionKindSystemAbove:
		value, observed := observedMetric(rule.Condition.Metric, snapshot.System)
		if value < rule.Condition.Threshold {
			return EvaluatedAlert{}, false
		}

		return buildAlert(rule, observed, value, now), true

	case ConditionKindRefreshFailed:
		if snapshot.LastRefreshSuccess {
			return EvaluatedAlert{}, false
		}

		observed := "latest refresh reported failure"
		if len(snapshot.Errors) > 0 {
			observed = snapshot.Errors[0]
		}

		return buildAlert(rule, observed, 0, now), true

	default:
		return EvaluatedAlert{}, false
	}
}

func observedMetric(metric string, system SystemSnapshot) (float64, string) {
	switch metric {
	case "cpu_percent":
		return system.CPUPercent, fmt.Sprintf("cpu_percent=%.2f", system.CPUPercent)
	case "memory_used_percent":
		return system.MemoryUsedPercent, fmt.Sprintf("memory_used_percent=%.2f", system.MemoryUsedPercent)
	case "disk_used_percent":
		return system.DiskUsedPercent, fmt.Sprintf("disk_used_percent=%.2f path=%s", system.DiskUsedPercent, system.DiskPath)
	default:
		return 0, metric
	}
}

func buildAlert(rule CompiledRule, observed string, value float64, now time.Time) EvaluatedAlert {
	return EvaluatedAlert{
		ID:          rule.ID,
		Status:      "firing",
		Summary:     rule.Summary,
		Description: rule.Description,
		Severity:    rule.Severity,
		Labels:      cloneLabels(rule.Labels),
		Observed:    observed,
		Value:       value,
		TriggeredAt: now.UTC().Format(time.RFC3339),
		Cooldown:    rule.Cooldown.String(),
	}
}

func cloneLabels(labels map[string]string) map[string]string {
	cloned := make(map[string]string, len(labels))
	for key, value := range labels {
		cloned[key] = value
	}
	return cloned
}
