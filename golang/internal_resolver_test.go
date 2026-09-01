package client

import (
	"context"
	"sync"
	"testing"
	"time"

	"k8s.io/client-go/tools/cache"
)

// fakeInformer stands in for the real SharedIndexInformer. Only Run is
// exercised; it blocks until the stop channel closes, exactly as the real one
// does, so start()'s lifecycle is what is under test.
type fakeInformer struct {
	cache.SharedIndexInformer
	running chan struct{}
	stopped chan struct{}
}

func (f *fakeInformer) Run(stop <-chan struct{}) {
	close(f.running)
	<-stop
	close(f.stopped)
}

// Goes through the same initLifecycle the real constructor uses. Building ctx,
// cancel and stop by hand here would make every lifecycle test below pass even
// if the constructor stopped creating them.
func newTestResolver() (*internalResolver, *fakeInformer) {
	var r internalResolver
	r.addresses = make(map[string]bool)
	r.initLifecycle(context.Background())
	fi := &fakeInformer{running: make(chan struct{}), stopped: make(chan struct{})}
	r.informer = fi
	return &r, fi
}

// The stop channel and the cancellable context must exist before start() runs.
// If the channel creation moves back into start(), informer.Run(nil) blocks on a
// nil channel and no close() can ever stop it.
func TestInitLifecycleCreatesStopChannelAndContext(t *testing.T) {
	var r internalResolver
	ctx := r.initLifecycle(context.Background())

	if r.stop == nil {
		t.Fatal("initLifecycle did not create the stop channel: informer.Run(nil) would never return")
	}
	if r.cancel == nil || r.ctx == nil || ctx == nil {
		t.Fatal("initLifecycle did not derive a cancellable context: close() could not release start()")
	}
	r.cancel()
	select {
	case <-ctx.Done():
	case <-time.After(time.Second):
		t.Fatal("the returned context is not cancelled by r.cancel(): List/Watch calls would outlive close()")
	}
}

// gRPC calls Close() from its idle timer while the start goroutine may still be
// coming up. start() owns the only close(r.stop), behind stopOnce, so no
// interleaving may double-close it -- that panics and takes the process down.
func TestConcurrentCloseAndStartNeverDoubleClose(t *testing.T) {
	for i := 0; i < 200; i++ {
		r, _ := newTestResolver()

		var wg sync.WaitGroup
		wg.Add(1)
		go r.start(&wg)
		go r.close()
		r.close()

		done := make(chan struct{})
		go func() { wg.Wait(); close(done) }()
		select {
		case <-done:
		case <-time.After(2 * time.Second):
			t.Fatal("start() never returned under a concurrent close()")
		}
	}
}

// The regression this package exists to prevent: Close() waits on the
// WaitGroup that start() releases, so if close() cannot make start() return,
// every caller of Close() blocks forever. gRPC calls Close() from its idle
// timer while holding the ClientConn idle lock, so a stuck Close() hangs every
// subsequent RPC on that connection until the process restarts.
func TestCloseReleasesStart(t *testing.T) {
	r, fi := newTestResolver()

	var wg sync.WaitGroup
	wg.Add(1)
	go r.start(&wg)

	select {
	case <-fi.running:
	case <-time.After(2 * time.Second):
		t.Fatal("informer never started")
	}

	r.close()

	done := make(chan struct{})
	go func() { wg.Wait(); close(done) }()

	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("close() did not release start(): Close() would deadlock and hang every RPC on the connection")
	}

	select {
	case <-fi.stopped:
	case <-time.After(2 * time.Second):
		t.Fatal("informer was not stopped")
	}
}

// close() used to close a channel that start() assigned, so closing before the
// start goroutine was scheduled closed a nil channel and panicked.
func TestCloseBeforeStartDoesNotPanic(t *testing.T) {
	r, _ := newTestResolver()
	r.close()

	var wg sync.WaitGroup
	wg.Add(1)
	go r.start(&wg)

	done := make(chan struct{})
	go func() { wg.Wait(); close(done) }()
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("start() did not return after a close() that preceded it")
	}
}

// Both close() and start() reached for the stop channel; whichever ran second
// closed an already-closed channel and panicked.
func TestDoubleCloseIsSafe(t *testing.T) {
	r, fi := newTestResolver()
	var wg sync.WaitGroup
	wg.Add(1)
	go r.start(&wg)
	<-fi.running

	r.close()
	r.close()
	wg.Wait()
}

// getIPs handed out the live map while handleDelete mutated it in place, which
// is a concurrent map read/write: an unrecoverable runtime throw, not a panic
// the recovery interceptor can catch. Run with -race.
func TestGetIPsReturnsCopy(t *testing.T) {
	r, _ := newTestResolver()
	r.addresses = map[string]bool{"10.0.0.1": true, "10.0.0.2": true}

	got := r.getIPs()
	got["10.0.0.3"] = true
	if len(r.getIPs()) != 2 {
		t.Fatal("getIPs leaked the live map: mutating the result changed resolver state")
	}

	stop := make(chan struct{})
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		for {
			select {
			case <-stop:
				return
			default:
				for range r.getIPs() {
				}
			}
		}
	}()
	for i := 0; i < 500; i++ {
		r.handleUpsert(nil)
	}
	close(stop)
	wg.Wait()
}
