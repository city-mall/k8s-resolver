import { ChannelOptions, Metadata, StatusObject } from "@grpc/grpc-js";
import { LogVerbosity, Status } from "@grpc/grpc-js/build/src/constants";
import * as logging from "@grpc/grpc-js/build/src/logging";
import * as http from "http";
import { Resolver, ResolverListener, registerResolver, createResolver } from "@grpc/grpc-js/build/src/resolver";
import {} from "@grpc/grpc-js/build/src/resolver-dns";
import { Endpoint } from "@grpc/grpc-js/build/src/subchannel-address";
import { GrpcUri, parseUri, splitHostPort, uriToString } from "@grpc/grpc-js/build/src/uri-parser";
import * as k8s from "@kubernetes/client-node";
import { ExponentialBackoff, IBackoff, IRetryBackoffContext } from "cockatiel";

// @grpc/grpc-js v1.14+ changed ResolverListener from an object with
// onSuccessfulResolution/onError methods to a plain function.
// Detect at runtime to support both versions.
const isLegacyListener = (listener: any): listener is { onSuccessfulResolution: Function; onError: Function } =>
  typeof listener === "object" && typeof listener.onSuccessfulResolution === "function";

function notifySuccess(listener: any, endpoints: Endpoint[]) {
  if (isLegacyListener(listener)) {
    // v1.13.x: listener.onSuccessfulResolution(endpoints, serviceConfig, serviceConfigError, configSelector, attributes)
    listener.onSuccessfulResolution(endpoints, null, null, null, {});
  } else if (typeof listener === "function") {
    // v1.14+: listener(StatusOr<Endpoint[]>, attributes, serviceConfig, resolutionNote)
    listener({ ok: true, value: endpoints }, {}, null, "");
  }
}

function notifyError(listener: any, error: StatusObject) {
  if (isLegacyListener(listener)) {
    listener.onError(error);
  } else if (typeof listener === "function") {
    listener({ ok: false, error }, {}, null, "");
  }
}

// ListWatch._stop() (client-node dist/cache.js:90-98) is the first statement of
// doneHandler(), which reopens the watch on its last line. Making _stop() total
// is what keeps that reopen reachable; see the call site in watch() for why a
// throw there is uncatchable and permanent.
//
// Best-effort by design: if a future client-node drops the private method this
// quietly does nothing, which is the same behaviour as not calling it at all.
function guardInformerStop(informer: unknown): void {
  const lw = informer as { _stop?: () => void; request?: { abort?: () => void } };
  if (typeof lw._stop !== "function") {
    return;
  }
  const stop = lw._stop.bind(lw);
  lw._stop = () => {
    try {
      stop();
    } catch (err) {
      // _stop() throws before it reaches request.abort(), so the watch's socket
      // is still open. `abort` is one of the keys request@2 refuses to overwrite,
      // so it is still the real method even on the corrupted object.
      try {
        lw.request?.abort?.();
      } catch {
        // nothing further we can do; the reference is dropped either way
      }
      lw.request = undefined;
      // Deliberately does not claim the watch reopened: on the doneHandler path
      // it does, but stop() also calls _stop() and nothing reopens after that.
      console.error(`[K8sResolver] informer _stop failed, aborted the watch socket directly`, err);
    }
  };
}

const K8sScheme = "k8s";
const TRACER_NAME = "k8s_resolver";
const FieldSelectorPrefix = "metadata.name=";
const RELIST_BASE_INTERVAL_MS = 30_000;
const RELIST_JITTER_INTERVAL_MS = 30_000;
const INFORMER_STALE_AFTER_MS = 2 * 60_000;

const kc = new k8s.KubeConfig();
let k8sApi: k8s.CoreV1Api;

// Initial backoff policy, used to reset the backoffs.
let backoffFactory: IBackoff<IRetryBackoffContext<unknown>> = new ExponentialBackoff();

/**
 * setup register the k8s:// scheme into grpc resolver and returns new address
 * @param address - kube cluster url
 * default is ExponentialBackoff(a max 30 second delay on a decorrelated jitter)
 */
export const setup = (address: string) => {
  // init k8s client in setup avoid throw error
  // when only import lib in non k8s env
  kc.loadFromDefault();
  k8sApi = kc.makeApiClient(k8s.CoreV1Api);
  registerResolver(K8sScheme, K8sResolover);
  const [host, servicePort] = address.split(":");
  const [serviceName, serviceNs] = host.split(".");
  address = `${K8sScheme}://${serviceNs}/${serviceName}:${servicePort}`;
  return address;
};

export class K8sResolover implements Resolver {
  private error: StatusObject | null = null;
  private defaultResolutionError: StatusObject | undefined;

  private namespace: string;
  private port: number | undefined;
  private serviceName: string | undefined;
  private addresses = new Set<string>();
  private informer: k8s.Informer<k8s.V1Endpoints> | undefined;

  // backoff is use for reconnecting
  private backoff: IBackoff<IRetryBackoffContext<unknown>> | undefined;
  private dnsResolver: Resolver | undefined;
  private useDnsResolver = true;
  private destroyed = false;
  private restart: Promise<void> = Promise.resolve();
  private restartTimer: NodeJS.Timeout | undefined;
  private livenessTimer: NodeJS.Timeout | undefined;
  private relistInFlight = false;
  private lastInformerEventAt = Date.now();
  private lastStalenessAlarmAt = 0;

  constructor(private target: GrpcUri, private listener: ResolverListener, _channelOptions: ChannelOptions) {
    this.trace("Resolver constructed");
    console.log("[K8sResolver] Resolver constructed");
    this.namespace = target.authority || "default";
    const hostPort = splitHostPort(target.path);
    this.serviceName = hostPort?.host;
    if (this.serviceName?.includes("localhost") || this.serviceName?.includes("127.0.0.1")) {
      this.error = {
        code: Status.UNAVAILABLE,
        details: `Failed to parse ${target.scheme} address ${target.path} ${target.authority}`,
        metadata: new Metadata(),
      };
      // These branches return before dnsResolver is created, so leaving
      // useDnsResolver true makes updateResolution() a no-op: the channel gets
      // neither a resolution nor an error and every RPC on it sits until its
      // deadline. Fall through to the error path instead.
      this.useDnsResolver = false;
      return;
    }
    this.port = hostPort?.port;

    if (!this.serviceName || !this.port) {
      this.error = {
        code: Status.UNAVAILABLE,
        details: `Failed to parse ${target.scheme} address ${target.path} ${target.authority}`,
        metadata: new Metadata(),
      };
      this.useDnsResolver = false;
      return;
    }

    this.dnsResolver = createResolver(parseUri(`dns:${this.serviceName}.${this.namespace}.svc.cluster.local:${this.port}`)!, listener, _channelOptions);

    this.defaultResolutionError = {
      code: Status.UNAVAILABLE,
      details: `Name resolution failed for target ${uriToString(this.target)}`,
      metadata: new Metadata(),
    };

    new Promise<void>(async (r) => {
      try {
        const res = await k8sApi.listNamespacedEndpoints(this.namespace, undefined, undefined, undefined, `${FieldSelectorPrefix}${this.serviceName}`);
        if (res.response.statusCode && res.response.statusCode >= 200 && res.response.statusCode < 300) {
          this.watch().catch((err) => console.log(`[K8sResolver] watch error`, err));
        }
      } catch (err) {
        console.error(
          "[K8sResolver] The Resolver was not able to make communication with Kubernetes. The Resolver has partially failed and hence it choosed to stay with the default DNS Resolver Implementation."
        );
      } finally {
        r();
      }
    });
  }

  // only report error if has
  updateResolution() {
    if (this.useDnsResolver) {
      return this.dnsResolver?.updateResolution();
    }
    if (this.error) {
      setImmediate(() => notifyError(this.listener, this.error!));
    }
  }

  destroy() {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.trace("Resolver destroy");

    // Tear down both halves unconditionally. The resolver starts on the DNS
    // fallback and only clears useDnsResolver once the informer has produced
    // endpoints, so returning early here left the informer, its watch
    // connection to the apiserver and the poll loop in watch() running for the
    // life of the process on every channel closed before it upgraded.
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = undefined;
    }
    if (this.livenessTimer) {
      clearTimeout(this.livenessTimer);
      this.livenessTimer = undefined;
    }

    this.dnsResolver?.destroy();

    if (this.informer) {
      this.informer.stop().catch((err) => console.error(`[K8sResolver] informer stop error`, err));
      this.informer = undefined;
    }
  }

  private async watch() {
    // watch endpoints by namespace and service name
    const informer = k8s.makeInformer(
      kc,
      `/api/v1/namespaces/${this.namespace}/endpoints?fieldSelector=${FieldSelectorPrefix}${this.serviceName}`, // makeInformer not support fieldSelector as params for now
      () => this.fetchEndpoints()
    );

    // Seen in prod: `TypeError: this.request.removeAllListeners is not a
    // function` thrown from cache.js:92. request@2 copies every non-reserved
    // option key onto the Request instance, and `removeAllListeners` is not on
    // its reserved list, so an option of that name shadows the inherited
    // EventEmitter method. doneHandler() calls _stop() first and reopens the
    // watch last, and it runs as a discarded promise (watch.js:72 `done(err)`),
    // so the throw is uncatchable from here and aborts doneHandler before the
    // reopen. The informer then stops watching permanently, and because err was
    // null no "error" event fires, so nothing ever restarts it: the resolver
    // keeps serving whatever endpoints it last saw, forever.
    guardInformerStop(informer);

    informer.on("add", (obj) => {
      this.markInformerEvent();
      this.resetBackoff();

      let changed = false;
      for (const sub of obj.subsets || []) {
        for (const point of sub.addresses || []) {
          if (!this.addresses.has(point.ip)) {
            this.addresses.add(point.ip);
            changed = true;
          }
        }
      }

      if (changed) {
        this.updateResolutionFromAddress();
      }

      // Never serialise the whole Endpoints object here. This fires on every
      // endpoint event for every channel, and JSON.stringify runs even when
      // tracing is off, so a service with churn logs kilobytes per event.
      this.trace(`informer add event, changed: ${changed}, addresses: ${this.addresses.size}`);
    });

    informer.on("delete", (obj) => {
      this.markInformerEvent();
      this.resetBackoff();

      let changed = false;
      for (const sub of obj.subsets || []) {
        for (const point of sub.addresses || []) {
          if (this.addresses.has(point.ip)) {
            this.addresses.delete(point.ip);
            changed = true;
          }
        }
      }

      if (changed) {
        this.updateResolutionFromAddress();
      }

      this.trace(`informer delete event, changed: ${changed}, addresses: ${this.addresses.size}`);
    });

    informer.on("update", (obj) => {
      this.markInformerEvent();
      this.resetBackoff();

      if (!obj.subsets || !Array.isArray(obj.subsets)) {
        return;
      }

      this.handleFullUpdate(obj.subsets || []);

      this.trace(`informer update event, addresses: ${this.addresses.size}`);
    });

    // informer will not restart when the under watcher got error
    // so we restart the informer ourselves
    informer.on("error", (err: any) => {
      this.markInformerEvent();
      // A stopped informer still emits its final error. Restarting on it
      // resurrected an informer the channel had already destroyed, which
      // reopened a watch against the apiserver that nothing would ever close.
      if (this.destroyed) {
        return;
      }

      if (this.defaultResolutionError) {
        notifyError(this.listener, this.defaultResolutionError);
      }

      if (!this.backoff) {
        this.backoff = backoffFactory.next(null as any);
      } else {
        this.backoff = this.backoff.next(null as any) ?? this.backoff;
      }

      this.trace(`informer error event, will restart informer, backoff duration: ${this.backoff?.duration() || 0}`);

      // JSON.stringify of an Error yields "{}"; log the object itself.
      console.error(`[K8sResolver] informer error event, will restart informer, backoff duration: ${this.backoff?.duration() || 0}, err:`, err);
      // Two errors inside one backoff window each scheduled their own restart:
      // the second setTimeout overwrote this.restartTimer without clearing the
      // first, so both fired. destroy() then only knew about the last one.
      if (this.restartTimer) {
        clearTimeout(this.restartTimer);
      }
      this.restartTimer = setTimeout(() => {
        this.restartTimer = undefined;
        this.queueStart(informer);
      }, this.backoff?.duration() || 0);
    });

    // destroy() can land while the initial endpoints list above is in flight,
    // before this.informer is set, which would leave this informer running with
    // nothing holding a reference to stop it.
    if (this.destroyed) {
      return;
    }

    this.informer = informer;
    this.scheduleLivenessCheck();

    this.queueStart(informer);

    // Bounded by destroy(): without it this loop kept a 1s timer alive forever
    // on every channel that was closed before its first endpoint arrived.
    while (this.addresses.size === 0 && !this.destroyed) {
      await new Promise((r) => setTimeout(r, 1000));
    }
    if (this.destroyed) {
      return;
    }
    this.useDnsResolver = false;
    console.log("[K8sResolver] The Resolver has now been upgraded from Default DNS Resolver to use Kubernetes Endpoints Reader Resolver");
  }

  // A timer is independent of the informer so a silent watch death cannot keep
  // the resolver on a dead endpoint snapshot forever. Per-channel jitter spreads
  // lists across the 30-60s window without adding a process-wide scheduler.
  private scheduleLivenessCheck() {
    const delay = RELIST_BASE_INTERVAL_MS + Math.floor(Math.random() * RELIST_JITTER_INTERVAL_MS);
    this.livenessTimer = setTimeout(() => {
      this.livenessTimer = undefined;
      if (this.destroyed) {
        return;
      }

      this.checkInformerStaleness();
      void this.relistEndpoints();
      this.scheduleLivenessCheck();
    }, delay);
  }

  private async relistEndpoints() {
    if (this.destroyed || this.relistInFlight) {
      return;
    }

    this.relistInFlight = true;
    try {
      const { body } = await this.fetchEndpoints();
      if (this.destroyed || !Array.isArray(body.items)) {
        if (!this.destroyed) {
          console.error(`[K8sResolver] periodic endpoint re-list returned an invalid response`);
        }
        return;
      }

      const subsets: k8s.V1EndpointSubset[] = [];
      for (const item of body.items) {
        subsets.push(...(item.subsets || []));
      }
      this.handleFullUpdate(subsets);
    } catch (err) {
      console.error(`[K8sResolver] periodic endpoint re-list error`, err);
    } finally {
      this.relistInFlight = false;
    }
  }

  private checkInformerStaleness() {
    const now = Date.now();
    const staleFor = now - this.lastInformerEventAt;
    if (staleFor < INFORMER_STALE_AFTER_MS) {
      return;
    }
    if (this.lastStalenessAlarmAt && now - this.lastStalenessAlarmAt < INFORMER_STALE_AFTER_MS) {
      return;
    }

    this.lastStalenessAlarmAt = now;
    console.error(`[K8sResolver] informer stale for ${Math.floor(staleFor / 1000)}s, no informer event in ${INFORMER_STALE_AFTER_MS / 60_000}m; periodic re-list remains active`);
  }

  private markInformerEvent() {
    this.lastInformerEventAt = Date.now();
    this.lastStalenessAlarmAt = 0;
  }

  // Starts must never overlap. ListWatch.start() runs a doneHandler chain that
  // ends by assigning the single `request` field, so two concurrent chains open
  // two apiserver watches and only the last one is reachable by _stop(): the
  // loser leaks for the life of the process and keeps delivering events into a
  // resolver that believes it has one watch. Chaining rather than dropping the
  // request keeps a restart that arrives while a start is still in flight.
  private queueStart(informer: k8s.Informer<k8s.V1Endpoints>) {
    this.restart = this.restart
      .catch(() => undefined)
      .then(() => (this.destroyed ? undefined : informer.start()));
    this.restart.catch((err) => console.error(`[K8sResolver] Error`, err));
  }

  private updateResolutionFromAddress() {
    // A stopped informer still drains its cache: the final list resolves empty,
    // ListWatch fires a delete for every endpoint it held, and those handlers
    // land here. grpc-js has already torn the channel down by then, so
    // notifying its listener is a use-after-destroy.
    if (this.destroyed) {
      return;
    }
    // An empty endpoint set is a real scale-to-zero observation. Propagating it
    // removes departed pod IPs from grpc-js; keeping the old set can blackhole
    // every RPC until this process is restarted.
    this.trace(`Resolver update listener, address: ${[...this.addresses]}`);
    console.log(`[K8sResolver] Resolver update listener, address: ${[...this.addresses]}`);

    notifySuccess(this.listener, this.addressToSubchannelAddress());
  }

  private addressToSubchannelAddress(): Endpoint[] {
    return [
      {
        addresses: [...this.addresses.keys()].map((addr) => ({
          host: addr,
          port: this.port!,
        })),
      },
    ];
  }

  private async fetchEndpoints(): Promise<{
    response: http.IncomingMessage;
    body: k8s.V1EndpointsList;
  }> {
    try {
      const r = await k8sApi.listNamespacedEndpoints(this.namespace, undefined, undefined, undefined, `${FieldSelectorPrefix}${this.serviceName}`);
      return r;
    } catch (err) {
      console.error(`[K8sResolver] fetchEndpoints error`, err);
      // Retrying forever kept the promise chain, and so the destroyed resolver,
      // alive for the life of the process whenever the apiserver stayed
      // unreachable. Stop retrying once destroyed, but never reject: this is
      // the informer's listFn, awaited inside ListWatch.doneHandler, which the
      // watch layer invokes as a discarded promise. A rejection there has no
      // catch anywhere in the process and surfaces as an unhandledRejection,
      // which Node exits on. Resolve with an empty list instead.
      //
      // This is not inert: an in-flight doneHandler continues past the list step
      // and can open one more watch at cache.js:132 that the already-completed
      // _stop() will not abort. That is bounded to a single watch per destroyed
      // resolver, and its events are dropped because updateResolutionFromAddress()
      // ignores a destroyed resolver, so it is strictly better than exiting the
      // process. `metadata` must be present: doneHandler reads
      // `list.metadata.resourceVersion` without a guard.
      if (this.destroyed) {
        return {
          response: undefined as unknown as http.IncomingMessage,
          body: { items: [], metadata: {} } as k8s.V1EndpointsList,
        };
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return this.fetchEndpoints();
    }
  }

  private handleFullUpdate(subsets: k8s.V1EndpointSubset[]) {
    const newAddressesSet = new Set<string>();
    for (const sub of subsets) {
      for (const point of sub.addresses || []) {
        if (!newAddressesSet.has(point.ip)) {
          newAddressesSet.add(point.ip);
        }
      }
    }

    // diff set
    let changed = false;
    if (this.addresses.size !== newAddressesSet.size) {
      changed = true;
    } else {
      for (const newAddr of newAddressesSet) {
        if (!this.addresses.has(newAddr)) {
          changed = true;
          break;
        }
      }
    }

    if (changed) {
      this.addresses = newAddressesSet;
      this.updateResolutionFromAddress();
    }

    this.trace(`HandleFullUpdate changed: ${changed}`);
  }

  private trace(msg: string) {
    logging.trace(LogVerbosity.DEBUG, TRACER_NAME, `Target ${uriToString(this.target)} ${msg}`);
  }

  private resetBackoff() {
    this.backoff = undefined;
  }

  static getDefaultAuthority(target: GrpcUri): string {
    return target.path;
  }
}
