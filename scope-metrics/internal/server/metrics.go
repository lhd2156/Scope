package server

import (
	"runtime"

	"github.com/prometheus/client_golang/prometheus"
)

type metricsSet struct {
	buildInfo           *prometheus.GaugeVec
	startTime           prometheus.Gauge
	serviceUp           *prometheus.GaugeVec
	serviceResponseSecs *prometheus.GaugeVec
	serviceStatusCode   *prometheus.GaugeVec
	lastRefreshSuccess  prometheus.Gauge
	lastRefreshTime     prometheus.Gauge
	lastRefreshDuration prometheus.Gauge
	systemCPUPercent    prometheus.Gauge
	systemMemoryUsed    prometheus.Gauge
	systemMemoryTotal   prometheus.Gauge
	systemMemoryPercent prometheus.Gauge
	systemDiskUsed      *prometheus.GaugeVec
	systemDiskTotal     *prometheus.GaugeVec
	systemDiskPercent   *prometheus.GaugeVec
	refreshTotal        *prometheus.CounterVec
	httpRequestsTotal   *prometheus.CounterVec
	alertRulesLoaded    prometheus.Gauge
	alertRuleActive     *prometheus.GaugeVec
	alertDispatchTotal  *prometheus.CounterVec
	alertDispatchStatus *prometheus.GaugeVec
}

func newMetricsSet() metricsSet {
	return metricsSet{
		buildInfo: newGaugeVec(
			"scope_metrics_build_info",
			"Static build metadata for the Scope metrics service.",
			"version", "runtime",
		),
		startTime: newGauge(
			"scope_metrics_start_time_seconds",
			"Unix start time for the Scope metrics service.",
		),
		serviceUp: newGaugeVec(
			"scope_service_up",
			"Whether an Scope dependency health check responded successfully.",
			"service", "url",
		),
		serviceResponseSecs: newGaugeVec(
			"scope_service_response_seconds",
			"Response latency for Scope dependency health checks.",
			"service", "url",
		),
		serviceStatusCode: newGaugeVec(
			"scope_service_status_code",
			"Latest HTTP status code observed for an Scope dependency health check.",
			"service", "url",
		),
		lastRefreshSuccess: newGauge(
			"scope_metrics_last_refresh_success",
			"Whether the most recent dependency and system-metric refresh completed successfully.",
		),
		lastRefreshTime: newGauge(
			"scope_metrics_last_refresh_timestamp_seconds",
			"Unix timestamp of the most recent scope-metrics refresh.",
		),
		lastRefreshDuration: newGauge(
			"scope_metrics_last_refresh_duration_seconds",
			"Duration of the most recent scope-metrics refresh.",
		),
		systemCPUPercent: newGauge(
			"scope_system_cpu_percent",
			"Host CPU utilization percentage observed by scope-metrics.",
		),
		systemMemoryUsed: newGauge(
			"scope_system_memory_used_bytes",
			"Host memory currently in use.",
		),
		systemMemoryTotal: newGauge(
			"scope_system_memory_total_bytes",
			"Host memory available to the system.",
		),
		systemMemoryPercent: newGauge(
			"scope_system_memory_used_percent",
			"Host memory utilization percentage.",
		),
		systemDiskUsed: newGaugeVec(
			"scope_system_disk_used_bytes",
			"Disk usage for the configured scope-metrics disk path.",
			"path",
		),
		systemDiskTotal: newGaugeVec(
			"scope_system_disk_total_bytes",
			"Total disk capacity for the configured scope-metrics disk path.",
			"path",
		),
		systemDiskPercent: newGaugeVec(
			"scope_system_disk_used_percent",
			"Disk utilization percentage for the configured scope-metrics disk path.",
			"path",
		),
		refreshTotal: newCounterVec(
			"scope_metrics_refresh_total",
			"Total number of scope-metrics refresh attempts by result.",
			"result",
		),
		httpRequestsTotal: newCounterVec(
			"scope_metrics_http_requests_total",
			"Total number of scope-metrics HTTP requests by route and method.",
			"route", "method",
		),
		alertRulesLoaded: newGauge(
			"scope_alert_rules_loaded",
			"Whether scope-metrics loaded its alert-rule configuration successfully.",
		),
		alertRuleActive: newGaugeVec(
			"scope_alert_rule_active",
			"Whether an scope alert rule is currently firing.",
			"rule_id", "severity",
		),
		alertDispatchTotal: newCounterVec(
			"scope_alert_dispatch_total",
			"Total number of webhook dispatch attempts by result.",
			"result",
		),
		alertDispatchStatus: newGaugeVec(
			"scope_alert_dispatch_status",
			"Latest webhook dispatch outcome for scope-metrics.",
			"webhook",
		),
	}
}

func (m metricsSet) register(registry *prometheus.Registry) {
	registry.MustRegister(
		m.buildInfo,
		m.startTime,
		m.serviceUp,
		m.serviceResponseSecs,
		m.serviceStatusCode,
		m.lastRefreshSuccess,
		m.lastRefreshTime,
		m.lastRefreshDuration,
		m.systemCPUPercent,
		m.systemMemoryUsed,
		m.systemMemoryTotal,
		m.systemMemoryPercent,
		m.systemDiskUsed,
		m.systemDiskTotal,
		m.systemDiskPercent,
		m.refreshTotal,
		m.httpRequestsTotal,
		m.alertRulesLoaded,
		m.alertRuleActive,
		m.alertDispatchTotal,
		m.alertDispatchStatus,
	)
}

func (m metricsSet) initialize(version string, rulesLoaded bool) {
	m.buildInfo.WithLabelValues(version, runtime.Version()).Set(1)
	m.alertDispatchTotal.WithLabelValues("success")
	m.alertDispatchTotal.WithLabelValues("failure")
	if rulesLoaded {
		m.alertRulesLoaded.Set(1)
	} else {
		m.alertRulesLoaded.Set(0)
	}
}

func newGauge(name string, help string) prometheus.Gauge {
	return prometheus.NewGauge(prometheus.GaugeOpts{Name: name, Help: help})
}

func newGaugeVec(name string, help string, labels ...string) *prometheus.GaugeVec {
	return prometheus.NewGaugeVec(prometheus.GaugeOpts{Name: name, Help: help}, labels)
}

func newCounterVec(name string, help string, labels ...string) *prometheus.CounterVec {
	return prometheus.NewCounterVec(prometheus.CounterOpts{Name: name, Help: help}, labels)
}
