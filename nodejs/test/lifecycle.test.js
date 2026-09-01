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

function makeFakeInformer(listFn) {
  const inf = new EventEmitter();
  inf.starts = 0;
  inf.stops = 0;
  inf.listFn = listFn;
  // A real ListWatch.start() runs a list + watch round trip, so it is in flight
  // for a long time. Resolving synchronously here would make overlapping starts
  // impossible to express, which would leave the serialization in queueStart()
  // untested no matter what the assertions said. startBarrier holds a start open
  // so a second one has a window to overlap it.
  inf.startBarrier = null;
  inf.inFlight = 0;
  inf.maxInFlight = 0;
  inf.start = async () => {
    inf.starts++;
    inf.inFlight++;
    if (inf.inFlight > inf.maxInFlight) {
      inf.maxInFlight = inf.inFlight;
    }
    if (inf.startBarrier) {
      await inf.startBarrier;
    }
    inf.inFlight--;
  };
  inf.stop = async () => {
    inf.stops++;
  };
  // Mirror the one call shape that matters for the listFn: ListWatch.doneHandler
  // awaits listFn() inside an async method (cache.js:113-115), and the watch
  // layer invokes that method as a discarded promise (watch.js:70 `done(err)`,
  // and stream close). A rejection there has no catch anywhere in the process.
  inf.driveDoneHandler = () => {
    void (async () => {
      await inf.listFn();
    })();
  };

  // Stand-in for ListWatch._stop (cache.js:90-98). `removeAllListeners` is a
  // string here, which is exactly the corrupted shape seen in prod: request@2
  // copies non-reserved option keys onto the instance and shadows the inherited
  // EventEmitter method. `abort` is reserved, so it survives as a real method.
  inf.aborted = 0;
  inf.request = {
    removeAllListeners: "shadowed by a request option",
    abort: () => {
      inf.aborted++;
    },
  };
  inf._stop = () => {
    if (inf.request) {
      if (typeof inf.request.removeAllListeners !== "function") {
        throw new TypeError("this.request.removeAllListeners is not a function");
      }
      inf.request.abort();
      inf.request = undefined;
    }
  };

  // Mirror ListWatch.doneHandler(err): cache.js:101 calls this._stop() as its
  // FIRST statement and only reopens the watch on its LAST (cache.js:132), so a
  // throw out of _stop() skips the reopen entirely.
  inf.reopened = 0;
  inf.driveDoneHandlerWithStop = () => {
    void (async () => {
      inf._stop();
      await inf.listFn();
      inf.reopened++;
    })();
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
  makeInformer: (_kc, _path, listFn) => makeFakeInformer(listFn),
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

// ---------------------------------------------------------------------------
// fetchEndpoints is the informer's listFn. A destroyed resolver used to rethrow
// from its catch to break the retry loop, but doneHandler awaits the listFn and
// nothing catches doneHandler, so the rejection became an unhandledRejection --
// which Node exits on. An apiserver blip during a normal channel teardown was
// enough to kill the whole process.
// ---------------------------------------------------------------------------
async function testDestroyedListFnDoesNotRejectIntoDoneHandler() {
  informers.length = 0;
  const { resolver } = newResolver();
  await sleep(100);

  const inf = informers[0];
  const rejections = [];
  const onRejection = (err) => rejections.push(err);
  process.on("unhandledRejection", onRejection);
  try {
    resolver.destroy();
    listBehaviour = () => {
      throw new Error("apiserver unreachable");
    };
    inf.driveDoneHandler();
    await sleep(300);
  } finally {
    process.off("unhandledRejection", onRejection);
    listBehaviour = () => ({ response: { statusCode: 200 }, body: { items: [] } });
  }

  assert.strictEqual(
    rejections.length,
    0,
    `listFn rejected into ListWatch.doneHandler, which nothing catches: the process exits (${rejections[0] && rejections[0].message})`
  );
}

// ---------------------------------------------------------------------------
// Two errors inside one backoff window each scheduled a restart: the second
// setTimeout overwrote restartTimer without clearing the first, so both fired.
// Two concurrent ListWatch.start() chains open two apiserver watches but share
// one `request` field, so the loser is unreachable by _stop() and leaks for the
// life of the process while still feeding events to the resolver.
// ---------------------------------------------------------------------------
async function testOverlappingErrorsRestartInformerOnce() {
  informers.length = 0;
  const { resolver } = newResolver();
  await sleep(100);

  const inf = informers[0];
  assert.strictEqual(inf.starts, 1, "watch() should have started the informer exactly once");

  inf.emit("error", new Error("watch closed"));
  inf.emit("error", new Error("watch closed again"));
  await sleep(1500);

  assert.strictEqual(
    inf.starts,
    2,
    `two errors ran ${inf.starts - 1} restarts; every concurrent chain leaks an unabortable apiserver watch`
  );

  resolver.destroy();
  await sleep(50);
}

// ---------------------------------------------------------------------------
// Prod, recurring: `TypeError: this.request.removeAllListeners is not a
// function` out of cache.js:92. _stop() is the first statement of doneHandler
// and the watch is reopened on its last, so the throw strands the informer:
// it never watches again, and because doneHandler was called with err === null
// no "error" event fires, so nothing restarts it either. The resolver then
// serves its last-known endpoint list forever, silently, with no error anywhere
// except this one uncatchable rejection.
// ---------------------------------------------------------------------------
async function testCorruptedRequestDoesNotStrandTheInformer() {
  informers.length = 0;
  const { resolver } = newResolver();
  await sleep(100);

  const inf = informers[0];
  const rejections = [];
  const onRejection = (err) => rejections.push(err);
  process.on("unhandledRejection", onRejection);
  try {
    inf.driveDoneHandlerWithStop();
    await sleep(300);
  } finally {
    process.off("unhandledRejection", onRejection);
  }

  assert.strictEqual(
    rejections.length,
    0,
    `_stop() rejected into doneHandler, which nothing catches (${rejections[0] && rejections[0].message})`
  );
  assert.strictEqual(inf.reopened, 1, "doneHandler never reached the reopen: the informer is stranded, watching nothing, forever");
  assert.strictEqual(inf.aborted, 1, "the corrupted request was never aborted: its watch socket leaks");
  assert.strictEqual(inf.request, undefined, "the corrupted request is still referenced, so every later _stop() throws again");

  resolver.destroy();
  await sleep(50);
}

// ---------------------------------------------------------------------------
// queueStart() chains starts so they can never run concurrently. Two concurrent
// ListWatch.start() chains open two apiserver watches but share one `request`
// field, so the loser is unreachable by _stop() and leaks for the life of the
// process while still feeding events into a resolver that believes it has one
// watch. testOverlappingErrorsRestartInformerOnce only covers the clearTimeout;
// this covers the serialization itself.
// ---------------------------------------------------------------------------
async function testStartsNeverOverlap() {
  informers.length = 0;
  const { resolver } = newResolver();
  await sleep(100);

  const inf = informers[0];
  let release;
  inf.startBarrier = new Promise((r) => {
    release = r;
  });

  // Both paths that produce a start in prod: the initial one from watch() and a
  // restart from the error handler, arriving while the first is still in flight.
  resolver.queueStart(inf);
  resolver.queueStart(inf);
  await sleep(150);

  assert.strictEqual(
    inf.maxInFlight,
    1,
    `${inf.maxInFlight} starts ran concurrently; every extra chain leaks an apiserver watch that _stop() can never reach`
  );

  release();
  await sleep(50);
  resolver.destroy();
  await sleep(50);
}

// ---------------------------------------------------------------------------
// A stopped informer still drains its cache, firing a delete for every endpoint
// it held. grpc-js has already torn the channel down by then, so notifying its
// listener is a use-after-destroy.
// ---------------------------------------------------------------------------
async function testEventsAfterDestroyDoNotNotifyListener() {
  informers.length = 0;
  const { resolver, seen } = newResolver();
  await sleep(100);

  const inf = informers[0];
  inf.emit("add", { subsets: [{ addresses: [{ ip: "10.0.0.1" }] }] });
  await sleep(1500);
  assert.ok(seen.ok.length >= 1, "precondition: the listener should have been notified while alive");
  const before = seen.ok.length;

  resolver.destroy();
  inf.emit("add", { subsets: [{ addresses: [{ ip: "10.0.0.2" }] }] });
  inf.emit("delete", { subsets: [{ addresses: [{ ip: "10.0.0.1" }] }] });
  await sleep(200);

  assert.strictEqual(
    seen.ok.length,
    before,
    `listener was notified ${seen.ok.length - before} time(s) after destroy(): the channel is already gone`
  );
}

const tests = [
  testDestroyStopsInformerBeforeUpgrade,
  testDestroyReleasesPollLoop,
  testErrorAfterDestroyDoesNotRestart,
  testDoubleDestroyIsSafe,
  testUnparseableTargetReportsError,
  testUpgradesOffDnsWhenEndpointsArrive,
  testDestroyedListFnDoesNotRejectIntoDoneHandler,
  testOverlappingErrorsRestartInformerOnce,
  testCorruptedRequestDoesNotStrandTheInformer,
  testStartsNeverOverlap,
  testEventsAfterDestroyDoNotNotifyListener,
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
