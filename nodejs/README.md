# k8s-grpc-resolver

A custom gRPC resolver for Kubernetes services that enables service discovery in Kubernetes clusters. This resolver allows gRPC clients to automatically discover and connect to services running in Kubernetes without hardcoding IP addresses.

## Overview

When running microservices in Kubernetes, service discovery can be challenging, especially for gRPC services. This library provides a custom resolver that:

Watches Kubernetes Endpoints resources to track service IP addresses
Automatically updates gRPC client connections when endpoints change
Handles failover and load balancing across multiple service instances
Works seamlessly within Kubernetes clusters

The resolver is available in two implementations:

- Golang implementation using the official gRPC resolver interface
- Node.js implementation using @grpc/grpc-js

## Features

- **Dynamic Service Discovery**: Automatically discovers service endpoints in Kubernetes
- **Live Updates**: Watches for changes in service endpoints and updates connections in real-time
- **Fallback Mechanism**: Node.js implementation falls back to DNS resolution if Kubernetes API is unavailable
- **Error Handling**: Implements backoff strategies for reconnection attempts
- **Simple Integration**: Easy to integrate with existing gRPC clients

## Installation

### Golang

```bash
go get github.com/city-mall/k8s-grpc-resolver/golang
```

### Node.js

```bash
npm install @citymallservices/k8s-grpc-resolver
```

## Usage

### Golang

```go
import (
    "google.golang.org/grpc"
    k8sresolver "github.com/city-mall/k8s-grpc-resolver/golang"
)

func main() {
    // Register the resolver
    resolver := k8sresolver.Builder()

    // Use the resolver in your gRPC client
    // Format: k8s://<namespace>/<service-name>:<port>
    conn, err := grpc.Dial(
        "k8s://default/my-service:8080",
        grpc.WithResolvers(resolver),
        grpc.WithInsecure(),
    )
    if err != nil {
        // Handle error
    }
    defer conn.Close()

    // Use the connection with your gRPC client
    client := pb.NewMyServiceClient(conn)
    // ...
}
```

For services with the standard Kubernetes DNS format (`service.namespace.svc.cluster.local`), you can use the `Try` helper function:

```go
import (
    k8sresolver "github.com/city-mall/k8s-grpc-resolver/golang"
)

// Convert standard Kubernetes DNS to resolver format
address := k8sresolver.Try("my-service.default.svc.cluster.local:8080")
// address will be "k8s://default/my-service:8080"
```

### Node.js

```javascript
import { setup } from "@citymallservices/k8s-grpc-resolver";
import { credentials, createClient } from "@grpc/grpc-js";

// Register the resolver and get the formatted address
const address = setup("my-service.default:8080");

// Create a client with the address
const client = createClient(address, credentials.createInsecure());

// Use the client as normal
```

## How It Works

### Golang Implementation

The Golang implementation:

1. Registers a custom resolver with the `k8s://` scheme
2. Uses the Kubernetes API to watch Endpoints resources for the specified service
3. Extracts IP addresses from the Endpoints resource
4. Updates the gRPC client connection with the new addresses

### Node.js Implementation

The Node.js implementation:

1. Registers a custom resolver with the `k8s://` scheme
2. Initially uses DNS resolution while attempting to connect to the Kubernetes API
3. Once connected, watches Endpoints resources for the specified service
4. Updates the gRPC client connection with the new addresses
5. Implements backoff strategies for reconnection attempts

## Requirements

### Golang

- Kubernetes cluster with API access
- Proper RBAC permissions to read Endpoints resources
- Go 1.15 or later

### Node.js

- Kubernetes cluster with API access
- Proper RBAC permissions to read Endpoints resources
- Node.js 14 or later
- @grpc/grpc-js 1.13.4 or later
- @kubernetes/client-node 1.3.0 or later

## Publishing

To publish a new version of the Node.js package:

1. Update the version in package.json
2. Run the following command:

```bash
npm publish
```

## License

ISC

## Author

Arkadev Banerjee

---

This project is maintained by CityMall Services.
