import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

type ServiceWorkerRequest = {
  method: string;
  mode: string;
  url: string;
};

type ServiceWorkerEvent = {
  request?: ServiceWorkerRequest;
  waitUntil?: (promise: Promise<unknown>) => void;
  respondWith?: (promise: Promise<Response>) => void;
};

type ServiceWorkerListener = (event: ServiceWorkerEvent) => void;

function loadServiceWorker() {
  const source = readFileSync(resolve(process.cwd(), "public/sw.js"), "utf8");
  const listeners = new Map<string, ServiceWorkerListener>();
  const cache = { addAll: vi.fn().mockResolvedValue(undefined) };
  const caches = {
    open: vi.fn().mockResolvedValue(cache),
    keys: vi.fn().mockResolvedValue([]),
    delete: vi.fn().mockResolvedValue(true),
    match: vi.fn(),
  };
  const fetchMock = vi.fn();
  const self = {
    location: { origin: "https://app.felixwise.io.vn" },
    clients: { claim: vi.fn().mockResolvedValue(undefined) },
    skipWaiting: vi.fn().mockResolvedValue(undefined),
    addEventListener: (type: string, listener: ServiceWorkerListener) => {
      listeners.set(type, listener);
    },
  };

  class MockRequest {
    url: string;
    init?: RequestInit;

    constructor(url: string, init?: RequestInit) {
      this.url = url;
      this.init = init;
    }
  }

  vm.runInNewContext(source, {
    self,
    caches,
    fetch: fetchMock,
    Request: MockRequest,
    Response,
    URL,
    Promise,
  });

  return { cache, caches, fetchMock, listeners, self };
}

describe("Felix service worker", () => {
  it("precaches only the offline page and public PWA icons", async () => {
    const worker = loadServiceWorker();
    let completion = Promise.resolve();
    worker.listeners.get("install")?.({
      waitUntil: (promise) => {
        completion = promise.then(() => undefined);
      },
    });
    await completion;

    const requests = worker.cache.addAll.mock.calls[0][0] as Array<{
      url: string;
    }>;
    expect(requests.map((request) => request.url)).toEqual([
      "/offline.html",
      "/pwa-icon-192.png",
      "/pwa-icon-512.png",
      "/pwa-icon-maskable-512.png",
      "/pwa-apple-touch-icon.png",
    ]);
    expect(worker.self.skipWaiting).toHaveBeenCalledOnce();
  });

  it("does not intercept POST, API or cross-origin requests", () => {
    const worker = loadServiceWorker();
    const respondWith = vi.fn();
    const fetchListener = worker.listeners.get("fetch");

    fetchListener?.({
      request: {
        method: "POST",
        mode: "navigate",
        url: "https://app.felixwise.io.vn/overview",
      },
      respondWith,
    });
    fetchListener?.({
      request: {
        method: "GET",
        mode: "navigate",
        url: "https://app.felixwise.io.vn/api/auth/session",
      },
      respondWith,
    });
    fetchListener?.({
      request: {
        method: "GET",
        mode: "navigate",
        url: "https://example.com/overview",
      },
      respondWith,
    });

    expect(respondWith).not.toHaveBeenCalled();
    expect(worker.fetchMock).not.toHaveBeenCalled();
  });

  it("uses network for navigation and falls back without caching the response", async () => {
    const worker = loadServiceWorker();
    const offlineResponse = new Response("offline");
    worker.fetchMock.mockRejectedValueOnce(new Error("offline"));
    worker.caches.match.mockResolvedValueOnce(offlineResponse);
    let responsePromise: Promise<Response> | undefined;

    worker.listeners.get("fetch")?.({
      request: {
        method: "GET",
        mode: "navigate",
        url: "https://app.felixwise.io.vn/wallets",
      },
      respondWith: (promise) => {
        responsePromise = promise;
      },
    });

    expect(await responsePromise).toBe(offlineResponse);
    expect(worker.caches.match).toHaveBeenCalledWith("/offline.html");
    expect(worker.caches.open).not.toHaveBeenCalled();
  });
});
