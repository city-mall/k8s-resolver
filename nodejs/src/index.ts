import { ChannelOptions, Metadata, StatusObject } from "@grpc/grpc-js";
import { LogVerbosity, Status } from "@grpc/grpc-js/build/src/constants";
import * as logging from "@grpc/grpc-js/build/src/logging";
import { Resolver, ResolverListener, registerResolver, createResolver } from "@grpc/grpc-js/build/src/resolver";
import {} from "@grpc/grpc-js/build/src/resolver-dns";
import { Endpoint } from "@grpc/grpc-js/build/src/subchannel-address";
import { GrpcUri, parseUri, splitHostPort, uriToString } from "@grpc/grpc-js/build/src/uri-parser";
import * as k8s from "@kubernetes/client-node";

const K8sScheme = "k8s";
const TRACER_NAME = "k8s_resolver";
const FieldSelectorPrefix = "metadata.name=";

const kc = new k8s.KubeConfig();
let k8sApi: k8s.CoreV1Api;

// In Cockatiel v3.2.1, the API has changed significantly, so we implement our own simple backoff

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
  private backoffTime = 1000; // Start with 1 second
  private dnsResolver: Resolver | undefined;
  private useDnsResolver = true;

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
      return;
    }
    this.port = hostPort?.port;

    if (!this.serviceName || !this.port) {
      this.error = {
        code: Status.UNAVAILABLE,
        details: `Failed to parse ${target.scheme} address ${target.path} ${target.authority}`,
        metadata: new Metadata(),
      };
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
        await k8sApi.listNamespacedEndpoints({
          namespace: this.namespace,
          fieldSelector: `${FieldSelectorPrefix}${this.serviceName}`,
        });
        this.watch().catch((err) => console.log(`[K8sResolver] watch error`, err));
      } catch (err) {
        console.error(
          "[K8sResolver] The Resolver was not able to make communication with Kubernetes. The Resolver has partially failed and hence it choosed to stay with the default DNS Resolver Implementation.",
          err
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
      setImmediate(() => this.listener.onError(this.error!));
    }
  }

  destroy() {
    if (this.useDnsResolver) {
      return this.dnsResolver?.destroy();
    }
    this.trace("Resolver destroy");
    console.log("[K8sResolver] Resolver destroy");

    if (this.informer) {
      this.informer.stop().catch((err) => console.error(`[K8sResolver] informer stop error`, err));
    }
  }

  private async watch() {
    // watch endpoints by namespace and service name
    // Create a wrapper function that adapts the return type to match what makeInformer expects in v1.3.0

    const informer = k8s.makeInformer(kc, `/api/v1/namespaces/${this.namespace}/endpoints?fieldSelector=${FieldSelectorPrefix}${this.serviceName}`, async () => {
      const result = await this.fetchEndpoints();
      return {
        metadata: result.metadata,
        items: result.items,
      };
    });

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

      this.trace(`informer add event, changed: ${changed}, obj: ${JSON.stringify(obj)}`);
      console.log(`[K8sResolver] informer add event, changed: ${changed}, obj: ${JSON.stringify(obj)}`);
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

      this.trace(`informer delete event, changed: ${changed}, obj: ${JSON.stringify(obj)}`);
      console.log(`[K8sResolver] informer delete event, changed: ${changed}, obj: ${JSON.stringify(obj)}`);
    });

    informer.on("update", (obj) => {
      this.resetBackoff();

      if (!obj.subsets || !Array.isArray(obj.subsets)) {
        return;
      }

      this.handleFullUpdate(obj.subsets || []);

      this.trace(`informer update event, obj: ${JSON.stringify(obj)}`);
      console.log(`[K8sResolver] informer update event, obj: ${JSON.stringify(obj)}`);
    });

    // informer will not restart when the under watcher got error
    // so we restart the informer ourselves
    informer.on("error", (err: any) => {
      if (this.defaultResolutionError) {
        this.listener.onError(this.defaultResolutionError);
      }

      // Implement simple exponential backoff with jitter
      this.backoffTime = Math.min(30000, this.backoffTime * 1.5); // Cap at 30 seconds
      const jitter = Math.random() * 0.3 + 0.85; // 0.85-1.15 jitter factor
      const duration = Math.floor(this.backoffTime * jitter);

      this.trace(`informer error event, will restart informer, backoff duration: ${duration}, err: ${JSON.stringify(err)}`);

      console.log(`[K8sResolver] informer error event, will restart informer, backoff duration: ${duration}, err: ${JSON.stringify(err)}`);
      setTimeout(() => informer.start().catch((err) => console.error(`[K8sResolver] Error`, err)), duration);
    });

    this.informer = informer;

    this.informer.start().catch((err) => console.error(`[K8sResolver] Error`, err));

    while (this.addresses.size === 0) {
      await new Promise((r) => setTimeout(r, 1000));
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

    this.listener.onSuccessfulResolution(this.addressToEndpoints(), null, null, null, {});
  }

  private addressToEndpoints(): Endpoint[] {
    return [
      {
        addresses: [...this.addresses.keys()].map((addr) => ({
          host: addr,
          port: this.port!,
        })),
      },
    ];
  }

  private async fetchEndpoints(): Promise<k8s.V1EndpointsList> {
    try {
      const r = await k8sApi.listNamespacedEndpoints({
        namespace: this.namespace,
        fieldSelector: `${FieldSelectorPrefix}${this.serviceName}`,
      });
      return r;
    } catch (err) {
      console.error(`[K8sResolver] fetchEndpoints error`, err);
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
    console.log(`[K8sResolver] HandleFullUpdate changed: ${changed}`);
  }

  private trace(msg: string) {
    logging.trace(LogVerbosity.DEBUG, TRACER_NAME, `Target ${uriToString(this.target)} ${msg}`);
  }

  private resetBackoff() {
    this.backoffTime = 1000; // Reset to initial value
  }

  static getDefaultAuthority(target: GrpcUri): string {
    return target.path;
  }
}
