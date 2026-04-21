FROM golang:1.26-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY cmd ./cmd
COPY config ./config
COPY internal ./internal
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/atlas-metrics ./cmd/atlas-metrics

FROM alpine:3.22
RUN apk add --no-cache ca-certificates && addgroup -S atlas && adduser -S atlas -G atlas
WORKDIR /app
COPY --from=build /out/atlas-metrics ./atlas-metrics
COPY --from=build /src/config ./config
EXPOSE 9090
USER atlas
ENTRYPOINT ["./atlas-metrics"]
