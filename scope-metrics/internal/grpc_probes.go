package internal

import (
	"context"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	healthpb "google.golang.org/grpc/health/grpc_health_v1"
)

type GRPCProbeResult struct {
	Service string `json:"service"`
	Address string `json:"address"`
	Status  string `json:"status"`
	Latency string `json:"latency"`
	Error   string `json:"error,omitempty"`
}

func ProbeGRPC(address string, serviceName string, timeout time.Duration) GRPCProbeResult {
	result := GRPCProbeResult{Service: serviceName, Address: address}
	start := time.Now()

	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	conn, err := grpc.DialContext(ctx, address, grpc.WithTransportCredentials(insecure.NewCredentials()), grpc.WithBlock())
	if err != nil {
		result.Status = "UNREACHABLE"
		result.Error = err.Error()
		result.Latency = time.Since(start).String()
		return result
	}
	defer conn.Close()

	client := healthpb.NewHealthClient(conn)
	resp, err := client.Check(ctx, &healthpb.HealthCheckRequest{Service: serviceName})
	result.Latency = time.Since(start).String()

	if err != nil {
		result.Status = "ERROR"
		result.Error = err.Error()
		return result
	}

	result.Status = resp.Status.String()
	return result
}
