package client

import "testing"

// Try split on ":" and "." and indexed [1] unconditionally, so an address
// containing svc.cluster.local but not shaped host.ns...:port panicked.
// Well-formed addresses must keep resolving exactly as before.
func TestTryMalformedInputDoesNotPanic(t *testing.T) {
	cases := []struct{ in, want string }{
		{"cart-service-os.tsr-staging-dev.svc.cluster.local:7001", "k8s://tsr-staging-dev/cart-service-os:7001"},
		{"inmemory-cs.prod-product-store.svc.cluster.local:3001", "k8s://prod-product-store/inmemory-cs:3001"},
		{"svc.cluster.local", "svc.cluster.local"},
		{"nocolon.svc.cluster.local", "nocolon.svc.cluster.local"},
		{"localhost:8082", "localhost:8082"},
		{"", ""},
	}
	for _, c := range cases {
		if got := Try(c.in); got != c.want {
			t.Errorf("Try(%q) = %q, want %q", c.in, got, c.want)
		}
	}
}
