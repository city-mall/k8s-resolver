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
	informer  cache.SharedIndexInformer
	addresses map[string]bool
	stop      chan struct{}
}

func newInternalResolver(ctx context.Context, service string, namespace string, notify chan struct{}) (*internalResolver, error) {
	var r internalResolver
	r.addresses = make(map[string]bool)
	r.ctx = ctx

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
				return clientset.CoreV1().Endpoints(namespace).List(ctx, options)
			},
			WatchFunc: func(options metav1.ListOptions) (watch.Interface, error) {
				options.FieldSelector = "metadata.name=" + service
				return clientset.CoreV1().Endpoints(namespace).Watch(ctx, options)
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
				notify <- struct{}{}
			}
		},
		DeleteFunc: func(obj interface{}) {
			endpoints := obj.(*v1.Endpoints)
			ok := r.handleDelete(endpoints.Subsets)
			log.Debug().Str("Component", "Resolver").Msgf("Endpoints deleted: %s", endpoints.Name)
			if ok && notify != nil {
				notify <- struct{}{}
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
				notify <- struct{}{}
			}
		},
	})

	r.informer = informer

	return &r, nil
}

func (r *internalResolver) start(wg *sync.WaitGroup) {
	defer wg.Done()
	stop := make(chan struct{})
	r.stop = stop
	go r.informer.Run(stop)

	<-r.ctx.Done()
	close(stop)
}

func (r *internalResolver) close() {
	close(r.stop)
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
	return r.addresses
}
