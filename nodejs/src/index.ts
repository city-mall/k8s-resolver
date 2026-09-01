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

const K8sScheme = "k8s";
const TRACER_NAME = "k8s_resolver";
const FieldSelectorPrefix = "metadata.name=";

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
  private restartTimer: NodeJS.Timeout | undefined;

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

    informer.on("add", (obj) => {
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
      this.restartTimer = setTimeout(() => {
        this.restartTimer = undefined;
        if (this.destroyed) {
          return;
        }
        informer.start().catch((err) => console.error(`[K8sResolver] Error`, err));
      }, this.backoff?.duration() || 0);
    });

    // destroy() can land while the initial endpoints list above is in flight,
    // before this.informer is set, which would leave this informer running with
    // nothing holding a reference to stop it.
    if (this.destroyed) {
      return;
    }

    this.informer = informer;

    this.informer.start().catch((err) => console.error(`[K8sResolver] Error`, err));

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

  private updateResolutionFromAddress() {
    if (this.addresses.size === 0) {
      return;
    }

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
      // unreachable. Hand the failure to the informer instead; its error
      // handler owns the backoff and is itself gated on destroyed.
      if (this.destroyed) {
        throw err;
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
