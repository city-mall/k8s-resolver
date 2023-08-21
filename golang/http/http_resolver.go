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

const (
	OperatorAdd    = "Add"
	OperatorDelete = "Delete"
	OperatorUpdate = "Update"
)

type PodEvent struct {
	Operator string
	Reason   string
	Phase    string
	Name     string
	Message  string
	IP       string
}

func (p *PodEvent) String() string {
	return "Operator:" + p.Operator + " Reason: " + p.Reason + " Phase: " + p.Phase + " Name: " + p.Name + " Message: " + p.Message
}

type Resolver struct {
	mu        sync.Mutex
	url       string
	service   string
	namespace string

	clientset   *kubernetes.Clientset
	informer    cache.SharedIndexInformer
	index       int
	resolvable  bool
	servicePort string
	addresses   map[string]bool
	addCh       chan<- string
	delCh       chan<- string
}

type CreateResolverOptions struct {
	Context context.Context
	Url     string
	Waiter  *sync.WaitGroup
	AddChan chan<- string
	DelChan chan<- string
}

func NewResolver(ctx context.Context, url string, wg *sync.WaitGroup) *Resolver {
	return NewResolverWithOptions(CreateResolverOptions{
		Context: ctx,
		Url:     url,
		Waiter:  wg,
		AddChan: nil,
		DelChan: nil,
	})
}

func NewResolverWithOptions(op CreateResolverOptions) *Resolver {
	var r Resolver
	r.url = op.Url

	r.addresses = make(map[string]bool)

	if !strings.Contains(op.Url, "svc.cluster.local") {
		r.resolvable = false
		return &r
	}

	r.resolvable = true
	r.addCh = op.AddChan
	r.delCh = op.DelChan

	url := strings.ReplaceAll(op.Url, "http://", "")
	hostServicePort := strings.Split(url, ":")
	host := hostServicePort[0]
	port := hostServicePort[1]
	r.servicePort = port

	serviceNameServiceNs := strings.Split(host, ".")
	service := serviceNameServiceNs[0]
	namespace := serviceNameServiceNs[1]

	r.service = service
	r.namespace = namespace

	defer op.Waiter.Done()
	config, err := rest.InClusterConfig()
	if err != nil {
		panic(err.Error())
	}

	clientset, err := kubernetes.NewForConfig(config)
	if err != nil {
		panic(err.Error())
	}

	r.clientset = clientset

	informer := cache.NewSharedIndexInformer(
		&cache.ListWatch{
			ListFunc: func(options metav1.ListOptions) (runtime.Object, error) {
				options.FieldSelector = "metadata.name=" + service
				return clientset.CoreV1().Endpoints(namespace).List(context.Background(), options)
			},
			WatchFunc: func(options metav1.ListOptions) (watch.Interface, error) {
				options.FieldSelector = "metadata.name=" + service
				return clientset.CoreV1().Endpoints(namespace).Watch(context.Background(), options)
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

func getEventFromPod(pod *v1.Pod, operator string) PodEvent {
	var event PodEvent
	event.Name = pod.Name
	event.Phase = string(pod.Status.Phase)
	event.Reason = string(pod.Status.Reason)
	event.Message = pod.Status.Message
	event.Operator = operator
	event.IP = pod.Status.PodIP
	return event
}

func (r *Resolver) listenPodEvents(ch chan<- PodEvent) {
	informer := cache.NewSharedIndexInformer(
		&cache.ListWatch{
			ListFunc: func(options metav1.ListOptions) (runtime.Object, error) {
				options.FieldSelector = "metadata.name=" + r.service
				return r.clientset.CoreV1().Endpoints(r.namespace).List(context.Background(), options)
			},
			WatchFunc: func(options metav1.ListOptions) (watch.Interface, error) {
				options.FieldSelector = "metadata.name=" + r.service
				return r.clientset.CoreV1().Endpoints(r.namespace).Watch(context.Background(), options)
			},
		},
		&v1.Pod{},
		0,
		cache.Indexers{},
	)

	informer.AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc: func(obj interface{}) {
			ch <- getEventFromPod(obj.(*v1.Pod), OperatorAdd)
		},
		DeleteFunc: func(obj interface{}) {
			ch <- getEventFromPod(obj.(*v1.Pod), OperatorDelete)
		},
		UpdateFunc: func(oldObj, newObj interface{}) {
			oldPod := oldObj.(*v1.Pod)
			newPod := newObj.(*v1.Pod)
			if oldPod.ResourceVersion == newPod.ResourceVersion {
				return
			}
			ch <- getEventFromPod(newObj.(*v1.Pod), OperatorUpdate)
		},
	})
}

func (r *Resolver) PodEvents() <-chan PodEvent {
	ch := make(chan PodEvent)
	go r.listenPodEvents(ch)
	return ch
}

func (r *Resolver) Start() {
	stop := make(chan struct{})
	r.informer.Run(stop)
}

func diff(a, b map[string]bool) []string {
	difference := make([]string, 0)
	for key := range a {
		if _, ok := b[key]; !ok {
			difference = append(difference, key)
		}
	}
	return difference
}

func (r *Resolver) handleUpsert(subsets []v1.EndpointSubset) {
	r.mu.Lock()

	addedIps := make([]string, 0)
	deletedIps := make([]string, 0)
	addresses := make(map[string]bool)

	for _, sub := range subsets {
		for _, point := range sub.Addresses {
			if _, ok := r.addresses[point.IP]; !ok {
				addedIps = append(addedIps, point.IP)
			}
			addresses[point.IP] = true
		}
	}

	if len(addresses) < len(r.addresses) {
		deletedIps = diff(r.addresses, addresses)
	}

	r.addresses = addresses
	r.mu.Unlock()

	if r.delCh != nil {
		for _, ip := range deletedIps {
			log.Debug().Msgf("DELETE %v", ip)
			r.delCh <- ip + ":" + r.servicePort
		}
	}
	if r.addCh != nil {
		for _, ip := range addedIps {
			log.Debug().Msgf("ADD %v", ip)
			r.addCh <- ip + ":" + r.servicePort
		}
	}

	log.Debug().Str("Component", "Resolver.handleUpsert").Msgf("New address list: %v", len(addresses))
}

func (r *Resolver) handleDelete(subsets []v1.EndpointSubset) {
	r.mu.Lock()

	deletedIps := make([]string, 0)

	for _, sub := range subsets {
		for _, point := range sub.Addresses {
			delete(r.addresses, point.IP)
			deletedIps = append(deletedIps, point.IP)
		}
	}

	r.mu.Unlock()

	if r.delCh != nil {
		for _, ip := range deletedIps {
			log.Debug().Msgf("DELETE %v", ip)
			r.delCh <- ip + ":" + r.servicePort
		}
	}

	log.Debug().Str("Component", "Resolver.handleDelete").Msgf("New address list: %v", len(r.addresses))
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
		list = append(list, k+":"+r.servicePort)
	}
	return list
}
