package http

import (
	"context"
	"strings"
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

type Resolver struct {
	mu  sync.Mutex
	url string

	ctx           context.Context
	informer      cache.SharedIndexInformer
	index         int
	resolvable    bool
	servicePort   string
	addresses     map[string]bool
	podAddressMap map[string]string
	cb            func(oldIp string, newIp string)
	tb            func(ip string)
}

type CreateResolverOptions struct {
	Context           context.Context
	Url               string
	Waiter            *sync.WaitGroup
	UpdateCallback    func(oldIp string, newIp string)
	TerminateCallback func(ip string)
}

func NewResolver(op CreateResolverOptions) *Resolver {

	cctx, cancel := context.WithCancel(op.Context)
	defer cancel()

	var r Resolver
	r.url = op.Url

	if op.UpdateCallback != nil {
		r.cb = op.UpdateCallback
	} else {
		r.cb = func(oldIp string, newIp string) {}
	}

	if op.TerminateCallback != nil {
		r.tb = op.TerminateCallback
	} else {
		r.tb = func(ip string) {}
	}

	r.addresses = make(map[string]bool)
	r.podAddressMap = make(map[string]string)

	if !strings.Contains(op.Url, "svc.cluster.local") {
		r.resolvable = false
		return &r
	}

	r.resolvable = true
	r.ctx = cctx

	url := strings.ReplaceAll(op.Url, "http://", "")
	hostServicePort := strings.Split(url, ":")
	host := hostServicePort[0]
	port := hostServicePort[1]
	r.servicePort = port

	serviceNameServiceNs := strings.Split(host, ".")
	service := serviceNameServiceNs[0]
	namespace := serviceNameServiceNs[1]

	defer op.Waiter.Done()
	config, err := rest.InClusterConfig()
	if err != nil {
		panic(err.Error())
	}

	clientset, err := kubernetes.NewForConfig(config)
	if err != nil {
		panic(err.Error())
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
			r.handleUpsert(endpoints.Subsets)
			log.Debug().Str("Component", "Resolver").Msgf("Endpoints added: %s", endpoints.Name)
		},
		DeleteFunc: func(obj interface{}) {
			endpoints := obj.(*v1.Endpoints)
			r.handleDelete(endpoints.Subsets)
			log.Debug().Str("Component", "Resolver").Msgf("Endpoints deleted: %s", endpoints.Name)
		},
		UpdateFunc: func(oldObj, newObj interface{}) {
			oldEndpoints := oldObj.(*v1.Endpoints)
			newEndpoints := newObj.(*v1.Endpoints)
			if oldEndpoints.ResourceVersion == newEndpoints.ResourceVersion {
				return
			}
			r.handleUpsert(newEndpoints.Subsets)
			log.Debug().Str("Component", "Resolver").Msgf("Endpoints updated: %s", newEndpoints.Name)
		},
	})

	r.informer = informer

	return &r
}

func (r *Resolver) Start() {
	stop := make(chan struct{})
	go r.informer.Run(stop)

	<-r.ctx.Done()
	close(stop)
}

func (r *Resolver) handleUpsert(subsets []v1.EndpointSubset) {
	r.mu.Lock()

	addedIps := make([]string, 0)
	updatedIps := make([]string, 0)
	addresses := make(map[string]bool)
	podAddressMap := make(map[string]string)
	newToOld := make(map[string]string)

	for _, sub := range subsets {
		for _, point := range sub.Addresses {
			podName := point.TargetRef.Name
			if _, ok := r.addresses[point.IP]; !ok {
				addedIps = append(addedIps, point.IP)
			} else {
				newToOld[point.IP] = r.podAddressMap[podName]
				updatedIps = append(updatedIps, point.IP)
			}
			addresses[point.IP] = true
			podAddressMap[podName] = point.IP
		}
	}

	r.addresses = addresses
	r.podAddressMap = podAddressMap
	r.mu.Unlock()

	for _, ip := range addedIps {
		r.cb("", ip)
	}
	for _, ip := range updatedIps {
		r.cb(newToOld[ip], ip)
	}

	log.Debug().Str("Component", "Resolver.handleUpsert").Msgf("New address list: %v", addresses)
}

func (r *Resolver) handleDelete(subsets []v1.EndpointSubset) {
	r.mu.Lock()

	deletedIps := make([]string, 0)

	for _, sub := range subsets {
		for _, point := range sub.Addresses {
			delete(r.addresses, point.IP)
			delete(r.podAddressMap, point.TargetRef.Name)
			deletedIps = append(deletedIps, point.IP)
		}
	}

	r.mu.Unlock()

	for _, ip := range deletedIps {
		r.cb(ip, "")
	}

	log.Debug().Str("Component", "Resolver.handleDelete").Msgf("New address list: %v", r.addresses)
}

func (r *Resolver) GetAddress() string {
	r.mu.Lock()
	defer r.mu.Unlock()
	if !r.resolvable {
		log.Debug().Str("Component", "Resolver.GetAddress").Msgf("Address not resolvable, serving \"%s\"", r.url)
		return r.url
	}

	if len(r.addresses) == 0 {
		log.Warn().Str("Component", "Resolver.GetAddress").Msgf("No addresses found, serving \"%s\"", r.url)
		return r.url
	}

	idx := r.index
	list := make([]string, 0, len(r.addresses))
	for k := range r.addresses {
		list = append(list, k)
	}
	if idx >= len(list) {
		idx = 0
	}
	r.index = (idx + 1) % len(list)
	url := "http://" + list[idx] + ":" + r.servicePort
	log.Debug().Str("Component", "Resolver.GetAddress").Msgf("Serving \"%s\" from \"%s\"", r.url, url)
	return url
}

func (r *Resolver) GetAddressList() []string {
	r.mu.Lock()
	defer r.mu.Unlock()
	list := make([]string, 0, len(r.addresses))
	for k := range r.addresses {
		list = append(list, k)
	}
	return list
}
