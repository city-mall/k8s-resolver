package client

import (
	"context"
	"fmt"
	"strings"
	"sync"

	r "google.golang.org/grpc/resolver"
)

const K8sScheme = "k8s"

// Short Note on UpdateState
// UpdateState updates the state of the ClientConn appropriately.
//
// If an error is returned, the resolver should try to resolve the
// target again. The resolver should use a backoff timer to prevent
// overloading the server with requests. If a resolver is certain that
// reresolving will not change the result, e.g. because it is
// a watch-based resolver, returned errors can be ignored.
//
// If the resolved State is the same as the last reported one, calling
// UpdateState can be omitted.

type K8sResolverBuilder struct {
}

type k8sEventDrivenResolver struct {
	resolver *internalResolver
	wg       *sync.WaitGroup
}

// ResolveNow will be called by gRPC to try to resolve the target name
// again. It's just a hint, resolver can ignore this if it's not necessary.
//
// It could be called multiple times concurrently.
func (k *k8sEventDrivenResolver) ResolveNow(opts r.ResolveNowOptions) {

}

// Close closes the resolver.
func (k *k8sEventDrivenResolver) Close() {
	k.resolver.close()
	k.wg.Wait()
}

// Build creates a new resolver for the given target.
//
// gRPC dial calls Build synchronously, and fails if the returned error is
// not nil.
func (b *K8sResolverBuilder) Build(target r.Target, cc r.ClientConn, opts r.BuildOptions) (r.Resolver, error) {
	var wg sync.WaitGroup
	wg.Add(1)
	namespace := target.URL.Hostname()
	service := target.Endpoint()
	idx := strings.Index(service, ":")
	serviceName := service[:idx]
	port := service[idx+1:]
	notifier := make(chan struct{})
	resolver := newInternalResolver(context.Background(), serviceName, namespace, notifier)
	go func() {
		for range notifier {
			ips := resolver.getIPs()
			addresses := make([]r.Address, 0, len(ips))
			for ip := range ips {
				addresses = append(addresses, r.Address{Addr: ip + ":" + port})
			}
			if err := cc.UpdateState(r.State{Addresses: addresses}); err != nil {
				panic(err)
			}
		}
	}()
	go resolver.start(&wg)

	return &k8sEventDrivenResolver{
		wg:       &wg,
		resolver: resolver,
	}, nil
}

// Scheme returns the scheme supported by this r.Scheme is defined
// at https://github.com/grpc/grpc/blob/master/doc/naming.md.  The returned
// string should not contain uppercase characters, as they will not match
// the parsed target's scheme as defined in RFC 3986.
func (b *K8sResolverBuilder) Scheme() string {
	return K8sScheme
}

func Try(address string) string {
	if strings.Contains(address, "svc.cluster.local") {
		hostServicePort := strings.Split(address, ":")
		host := hostServicePort[0]
		servicePort := hostServicePort[1]

		serviceNameServiceNs := strings.Split(host, ".")
		serviceName := serviceNameServiceNs[0]
		serviceNs := serviceNameServiceNs[1]

		address = fmt.Sprintf("%s://%s/%s:%s", K8sScheme, serviceNs, serviceName, servicePort)
	}
	return address
}
