// Lifecycle regression tests for the k8s resolver.
//
// Run with: npm test   (compiles src, then executes this against dist/)
//
// There is no test framework here on purpose: the package has one runtime
// dependency graph and these tests need to substitute @kubernetes/client-node
// before dist/index.js is first required, which is easiest to reason about in
// plain node. Failures throw, so a non-zero exit is the signal.

const assert = require("assert");
const { EventEmitter } = require("events");
const Module = require("module");

// ---------------------------------------------------------------------------
// Count the 1s timers the poll loop in watch() schedules. A destroyed resolver
// must stop scheduling them; the bug this catches kept one alive per channel
// for the life of the process.
// ---------------------------------------------------------------------------
let pollTicks = 0;
const realSetTimeout = global.setTimeout;
global.setTimeout = function (fn, delay, ...rest) {
  if (delay === 1000) {
    pollTicks++;
  }
  return realSetTimeout(fn, delay, ...rest);
};

// ---------------------------------------------------------------------------
// Fake @kubernetes/client-node. index.ts holds a module-level `new
// k8s.KubeConfig()` evaluated at import time, so this has to be installed
// before dist/index.js is required.
// ---------------------------------------------------------------------------
const informers = [];

function makeFakeInformer() {
  const inf = new EventEmitter();
  inf.starts = 0;
  inf.stops = 0;
  inf.start = async () => {
    inf.starts++;
  };
  inf.stop = async () => {
    inf.stops++;
  };
  informers.push(inf);
  return inf;
}

let listCalls = 0;
let listBehaviour = () => ({ response: { statusCode: 200 }, body: { items: [] } });

const fakeK8s = {
  KubeConfig: class {
    loadFromDefault() {}
    makeApiClient() {
      return {
        listNamespacedEndpoints: async () => {
          listCalls++;
          return listBehaviour();
        },
      };
    }
  },
  CoreV1Api: class {},
  makeInformer: () => makeFakeInformer(),
};

const realResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request === "@kubernetes/client-node") {
    return "\u0000fake-k8s";
  }
  return realResolve.call(this, request, ...rest);
};
require.cache["\u0000fake-k8s"] = { id: "\u0000fake-k8s", filename: "\u0000fake-k8s", loaded: true, exports: fakeK8s };

const { setup, K8sResolover } = require("../dist/index.js");
const { parseUri } = require("@grpc/grpc-js/build/src/resolver");
const uriParser = require("@grpc/grpc-js/build/src/uri-parser");

setup("svc.ns.svc.cluster.local:1234");

const sleep = (ms) => new Promise((r) => realSetTimeout(r, ms));

function newListener() {
  const seen = { ok: [], err: [] };
  return {
    seen,
    listener: {
      onSuccessfulResolution: (...a) => seen.ok.push(a),
      onError: (e) => seen.err.push(e),
    },
  };
}

function newResolver(path = "svc:1234") {
  const { seen, listener } = newListener();
  const target = uriParser.parseUri(`k8s://ns/${path}`);
  const resolver = new K8sResolover(target, listener, {});
  return { resolver, seen };
}

// ---------------------------------------------------------------------------
// destroy() used to return early while useDnsResolver was still true, which is
// the state every resolver is in until its first endpoint arrives. The
// informer, its watch against the apiserver and the poll loop all survived the
// channel that owned them.
// ---------------------------------------------------------------------------
async function testDestroyStopsInformerBeforeUpgrade() {
  informers.length = 0;
  const { resolver } = newResolver();
  await sleep(100);

  assert.strictEqual(informers.length, 1, "watch() should have built an informer");
  const inf = informers[0];
  assert.strictEqual(inf.starts, 1, "informer should have been started");
  assert.strictEqual(resolver.useDnsResolver, true, "still on the DNS fallback: no endpoints yet");

  resolver.destroy();
  await sleep(50);

  assert.strictEqual(inf.stops, 1, "destroy() left the informer running: one leaked apiserver watch per closed channel");
}

// ---------------------------------------------------------------------------
// The `while (addresses.size === 0)` loop in watch() had no exit condition
// other than an endpoint arriving, so a channel closed before its first
// endpoint left a 1s timer rescheduling itself forever.
// ---------------------------------------------------------------------------
async function testDestroyReleasesPollLoop() {
  informers.length = 0;
  const { resolver } = newResolver();
  await sleep(100);

  resolver.destroy();
  await sleep(1200); // let any in-flight tick land
  const before = pollTicks;
  await sleep(2500);

  assert.strictEqual(pollTicks, before, `poll loop kept ticking after destroy(): ${pollTicks - before} timers in 2.5s`);
}

// ---------------------------------------------------------------------------
// A stopped informer still emits its final error. The error handler restarted
// it on a backoff, resurrecting an informer the channel had already destroyed.
// ---------------------------------------------------------------------------
async function testErrorAfterDestroyDoesNotRestart() {
  informers.length = 0;
  const { resolver } = newResolver();
  await sleep(100);

  const inf = informers[0];
  resolver.destroy();
  inf.emit("error", new Error("watch closed"));
  await sleep(500);

  assert.strictEqual(inf.starts, 1, "informer was restarted after destroy()");
}

// ---------------------------------------------------------------------------
// destroy() is called more than once by grpc-js in some teardown paths.
// ---------------------------------------------------------------------------
async function testDoubleDestroyIsSafe() {
  informers.length = 0;
  const { resolver } = newResolver();
  await sleep(100);

  const inf = informers[0];
  resolver.destroy();
  resolver.destroy();
  await sleep(50);

  assert.strictEqual(inf.stops, 1, "double destroy() should stop the informer exactly once");
}

// ---------------------------------------------------------------------------
// The constructor's parse-failure branches return before dnsResolver exists but
// left useDnsResolver true, so updateResolution() did nothing at all: the
// channel got neither endpoints nor an error and every RPC on it sat until its
// deadline.
// ---------------------------------------------------------------------------
async function testUnparseableTargetReportsError() {
  const { resolver, seen } = newResolver("localhost:1234");
  resolver.updateResolution();
  await sleep(50);

  assert.strictEqual(seen.err.length, 1, "an unparseable target must report an error, not hang the channel");
  assert.strictEqual(seen.ok.length, 0);
  resolver.destroy();
}

// ---------------------------------------------------------------------------
// A healthy resolver must still upgrade off DNS once endpoints arrive. This is
// the "did the fix break the happy path" test.
// ---------------------------------------------------------------------------
async function testUpgradesOffDnsWhenEndpointsArrive() {
  informers.length = 0;
  const { resolver, seen } = newResolver();
  await sleep(100);

  informers[0].emit("add", { subsets: [{ addresses: [{ ip: "10.0.0.1" }, { ip: "10.0.0.2" }] }] });
  await sleep(1500);

  assert.strictEqual(resolver.useDnsResolver, false, "resolver never upgraded off the DNS fallback");
  assert.ok(seen.ok.length >= 1, "listener was never given endpoints");
  const endpoints = seen.ok[0][0];
  assert.deepStrictEqual(
    endpoints[0].addresses.map((a) => `${a.host}:${a.port}`),
    ["10.0.0.1:1234", "10.0.0.2:1234"]
  );

  resolver.destroy();
  await sleep(50);
  assert.strictEqual(informers[0].stops, 1, "destroy() after upgrade must still stop the informer");
}

const tests = [
  testDestroyStopsInformerBeforeUpgrade,
  testDestroyReleasesPollLoop,
  testErrorAfterDestroyDoesNotRestart,
  testDoubleDestroyIsSafe,
  testUnparseableTargetReportsError,
  testUpgradesOffDnsWhenEndpointsArrive,
];

(async () => {
  let failed = 0;
  for (const t of tests) {
    try {
      await t();
      console.log(`PASS  ${t.name}`);
    } catch (err) {
      failed++;
      console.log(`FAIL  ${t.name}: ${err.message}`);
    }
  }
  console.log(`\n${tests.length - failed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
