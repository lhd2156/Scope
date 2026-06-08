FROM golang:1.26.4-alpine@sha256:f23e8b227fb4493eabe03bede4d5a32d04092da71962f1fb79b5f7d1e6c2a17f AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY cmd ./cmd
COPY config ./config
COPY internal ./internal
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/scope-metrics ./cmd/scope-metrics

FROM alpine:3.23@sha256:5b10f432ef3da1b8d4c7eb6c487f2f5a8f096bc91145e68878dd4a5019afde11
RUN apk add --no-cache ca-certificates \
    && addgroup -S -g 10005 scope \
    && adduser -S -D -H -u 10005 -G scope scope
WORKDIR /app
COPY --from=build /out/scope-metrics ./scope-metrics
COPY --from=build /src/config ./config
EXPOSE 9090
USER scope
ENTRYPOINT ["./scope-metrics"]
