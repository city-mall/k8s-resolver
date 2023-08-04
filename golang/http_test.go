package client

import (
	"context"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"testing"

	rh "github.com/city-mall/k8s-grpc-resolver/golang/http"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

func TestHttpResolver(t *testing.T) {
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stdout})
	var wg sync.WaitGroup
	wg.Add(1)

	mainCtx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	log.Info().Msgf("Starting...")

	addCh := make(chan string)
	delCh := make(chan string)
	r := rh.NewResolver(rh.CreateResolverOptions{
		Context: mainCtx,
		Url:     "http://cart-service-cs.prod-os-v2.svc.cluster.local:7001",
		Waiter:  &wg,
		AddChan: addCh,
		DelChan: delCh,
	})
	go r.Start()

	wg.Add(1)

	go func(w *sync.WaitGroup) {
		defer w.Done()
		for ip := range addCh {
			log.Info().Msgf("Recv ADD %v", ip)
		}
	}(&wg)
	wg.Add(1)

	go func(w *sync.WaitGroup) {
		defer w.Done()
		for ip := range delCh {
			log.Info().Msgf("Recv DEL %v", ip)
		}
	}(&wg)

	wg.Wait()
}
