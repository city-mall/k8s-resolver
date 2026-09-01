package client

import (
	"context"
	"sync"

	"github.com/rs/zerolog/log"
	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/cache"
)

type internalResolver struct {
	mu sync.RWMutex

	ctx       context.Context
	cancel    context.CancelFunc
	informer  cache.SharedIndexInformer
	addresses map[string]bool
	stop      chan struct{}
	stopOnce  sync.Once
}

func newInternalResolver(ctx context.Context, service string, namespace string, notify chan struct{}) (*internalResolver, error) {
	var r internalResolver
	r.addresses = make(map[string]bool)
	cctx := r.initLifecycle(ctx)

	config, err := rest.InClusterConfig()
	if err != nil {
		return nil, err
	}

	clientset, err := kubernetes.NewForConfig(config)
	if err != nil {
		return nil, err
	}

	informer := cache.NewSharedIndexInformer(
		&cache.ListWatch{
			ListFunc: func(options metav1.ListOptions) (runtime.Object, error) {
				options.FieldSelector = "metadata.name=" + service
				return clientset.CoreV1().Endpoints(namespace).List(cctx, options)
			},
			WatchFunc: func(options metav1.ListOptions) (watch.Interface, error) {
				options.FieldSelector = "metadata.name=" + service
				return clientset.CoreV1().Endpoints(namespace).Watch(cctx, options)
			},
		},
		&v1.Endpoints{},
		0,
		cache.Indexers{},
	)

	informer.AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc: func(obj interface{}) {
			endpoints := obj.(*v1.Endpoints)
			ok := r.handleUpsert(endpoints.Subsets)
			log.Debug().Str("Component", "Resolver").Msgf("Endpoints added: %s", endpoints.Name)
			if ok && notify != nil {
				// Never block forever: after close() nothing reads notifier,
				// and a blocked handler wedges the shared informer.
				select {
				case notify <- struct{}{}:
				case <-cctx.Done():
				}
			}
		},
		DeleteFunc: func(obj interface{}) {
			endpoints := obj.(*v1.Endpoints)
			ok := r.handleDelete(endpoints.Subsets)
			log.Debug().Str("Component", "Resolver").Msgf("Endpoints deleted: %s", endpoints.Name)
			if ok && notify != nil {
				// Never block forever: after close() nothing reads notifier,
				// and a blocked handler wedges the shared informer.
				select {
				case notify <- struct{}{}:
				case <-cctx.Done():
				}
			}
		},
		UpdateFunc: func(oldObj, newObj interface{}) {
			oldEndpoints := oldObj.(*v1.Endpoints)
			newEndpoints := newObj.(*v1.Endpoints)
			if oldEndpoints.ResourceVersion == newEndpoints.ResourceVersion {
				return
			}
			ok := r.handleUpsert(newEndpoints.Subsets)
			log.Debug().Str("Component", "Resolver").Msgf("Endpoints updated: %s", newEndpoints.Name)
			if ok && notify != nil {
				// Never block forever: after close() nothing reads notifier,
				// and a blocked handler wedges the shared informer.
				select {
				case notify <- struct{}{}:
				case <-cctx.Done():
				}
			}
		},
	})

	r.informer = informer

	return &r, nil
}

// initLifecycle sets up the fields start() and close() rely on, and returns the
// derived context the informer's List/Watch calls must use.
//
// It is a separate method so tests go through the real initialization instead of
// hand-building these fields: a test that builds its own stop channel would stay
// green if the channel creation moved back into start(), which is exactly the
// bug this ordering exists to prevent.
func (r *internalResolver) initLifecycle(ctx context.Context) context.Context {
	// Derive our own cancellable context. close() cancels it, which is what
	// lets start() return and release the WaitGroup that Close() waits on.
	// Callers pass context.Background(), so without this start() parks forever.
	cctx, cancel := context.WithCancel(ctx)
	r.ctx = cctx
	r.cancel = cancel
	// Created here rather than in start() so close() can never race a nil
	// channel when Close() lands before the start goroutine is scheduled.
	r.stop = make(chan struct{})
	return cctx
}

func (r *internalResolver) start(wg *sync.WaitGroup) {
	defer wg.Done()
	go r.informer.Run(r.stop)

	<-r.ctx.Done()
	r.stopOnce.Do(func() { close(r.stop) })
}

// close cancels the resolver. It only cancels the context: start() owns
// closing the stop channel, so the channel is closed exactly once no matter
// how close() and context cancellation interleave.
func (r *internalResolver) close() {
	r.cancel()
}

func (r *internalResolver) handleUpsert(subsets []v1.EndpointSubset) bool {
	r.mu.Lock()
	defer r.mu.Unlock()

	addresses := make(map[string]bool)
	for _, sub := range subsets {
		for _, point := range sub.Addresses {
			addresses[point.IP] = true
		}
	}

	r.addresses = addresses
	log.Debug().Str("Component", "Resolver.handleUpsert").Msgf("New address list: %v", addresses)
	return true
}

func (r *internalResolver) handleDelete(subsets []v1.EndpointSubset) bool {
	r.mu.Lock()
	defer r.mu.Unlock()

	for _, sub := range subsets {
		for _, point := range sub.Addresses {
			delete(r.addresses, point.IP)
		}
	}

	log.Debug().Str("Component", "Resolver.handleDelete").Msgf("New address list: %v", r.addresses)
	return true
}

func (r *internalResolver) getIPs() map[string]bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	// Return a copy. Callers range over this while handleDelete mutates the
	// live map in place, which is a concurrent map read/write and takes the
	// whole process down with an unrecoverable runtime throw.
	out := make(map[string]bool, len(r.addresses))
	for ip, ok := range r.addresses {
		out[ip] = ok
	}
	return out
}
