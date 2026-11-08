import * as ort from 'onnxruntime-node';
import * as os from 'node:os';

const CAT = '[taggerSession]';
const sessionCache = new Map();
const CPU_IDLE_MS = 5 * 60 * 1000;
const GPU_IDLE_MS = 2 * 60 * 1000;
const CPU_CACHE_MAX = 3;
const IDLE_CHECK_MS = 30 * 1000;

let idleCheckTimer = null;

function getCpuSessionOptions(freeDimensionOverrides) {
  return {
    executionProviders: ['cpu'],
    intraOpNumThreads: Math.max(1, os.cpus().length - 1),
    interOpNumThreads: 1,
    graphOptimizationLevel: 'all',
    enableCpuMemArena: true,
    enableMemPattern: true,
    executionMode: 'sequential',
    ...(freeDimensionOverrides ? { freeDimensionOverrides } : {}),
  };
}

function getDmlSessionOptions(freeDimensionOverrides, deviceId = 0) {
  // DirectML requires mem-pattern off and sequential execution.
  // Fixed free dims let DML plan/fuse the graph once instead of every run.
  return {
    executionProviders: [{ name: 'dml', deviceId }],
    intraOpNumThreads: 1,
    interOpNumThreads: 1,
    graphOptimizationLevel: 'all',
    enableCpuMemArena: false,
    enableMemPattern: false,
    executionMode: 'sequential',
    ...(freeDimensionOverrides ? { freeDimensionOverrides } : {}),
  };
}

function getCudaSessionOptions(freeDimensionOverrides) {
  return {
    executionProviders: [{ name: 'cuda', deviceId: 0 }],
    intraOpNumThreads: 1,
    interOpNumThreads: 1,
    graphOptimizationLevel: 'all',
    enableCpuMemArena: true,
    enableMemPattern: true,
    executionMode: 'sequential',
    ...(freeDimensionOverrides ? { freeDimensionOverrides } : {}),
  };
}

function makeCacheKey(modelPath, freeDimensionOverrides, deviceId) {
  return `${modelPath}::${JSON.stringify(freeDimensionOverrides || null)}::${deviceId}`;
}

function touchEntry(entry) {
  if (entry) {
    entry.lastUsedAt = Date.now();
  }
}

function isGpuProvider(provider) {
  return provider === 'dml' || provider === 'cuda';
}

function resolveInputShape(session, freeDimensionOverrides = {}) {
  const meta = session.inputMetadata?.[0];
  if (!meta?.shape) {
    return null;
  }
  return meta.shape.map((dim) => {
    if (typeof dim === 'number') {
      return dim;
    }
    const overridden = freeDimensionOverrides[dim];
    if (typeof overridden === 'number') {
      return overridden;
    }
    return 1;
  });
}

async function warmupSession(session, freeDimensionOverrides) {
  const shape = resolveInputShape(session, freeDimensionOverrides);
  if (!shape) {
    return;
  }
  const size = shape.reduce((acc, n) => acc * n, 1);
  const type = session.inputMetadata[0].type || 'float32';
  const tensor = new ort.Tensor(type, new Float32Array(size), shape);
  await session.run({ [session.inputNames[0]]: tensor });
}

async function createSessionWithProvider(modelPath, options, providerName, freeDimensionOverrides) {
  const session = await ort.InferenceSession.create(modelPath, options);
  console.log(CAT, `Session ready via ${providerName}: ${modelPath}`);
  await warmupSession(session, freeDimensionOverrides);
  return session;
}

async function releaseSessionSafe(session) {
  try {
    if (session && typeof session.release === 'function') {
      await session.release();
    }
  } catch (err) {
    console.warn(CAT, 'session.release failed:', err?.message || err);
  }
}

function storeEntry(cacheKey, entry) {
  touchEntry(entry);
  sessionCache.set(cacheKey, entry);
  return entry.session;
}

async function createCpuEntry(modelPath, freeDimensionOverrides, deviceId, cacheKey) {
  const session = await createSessionWithProvider(
    modelPath,
    getCpuSessionOptions(freeDimensionOverrides),
    'cpu',
    freeDimensionOverrides
  );
  storeEntry(cacheKey, {
    session,
    provider: 'cpu',
    modelPath,
    freeDimensionOverrides,
    deviceId,
  });
  await trimCpuCache();
  return sessionCache.get(cacheKey)?.session || session;
}

async function tryCreateGpuSession(modelPath, freeDimensionOverrides, deviceId) {
  if (process.platform === 'win32') {
    return {
      session: await createSessionWithProvider(
        modelPath,
        getDmlSessionOptions(freeDimensionOverrides, deviceId),
        'dml',
        freeDimensionOverrides
      ),
      provider: 'dml',
    };
  }
  if (process.platform === 'linux') {
    return {
      session: await createSessionWithProvider(
        modelPath,
        getCudaSessionOptions(freeDimensionOverrides),
        'cuda',
        freeDimensionOverrides
      ),
      provider: 'cuda',
    };
  }
  throw new Error('GPU EP not available on this platform');
}

function ensureIdleCheckTimer() {
  if (idleCheckTimer) {
    return;
  }
  idleCheckTimer = setInterval(() => {
    pruneIdleSessions().catch((err) => {
      console.warn(CAT, 'Idle prune failed:', err?.message || err);
    });
  }, IDLE_CHECK_MS);
  // Keep the tagger worker alive while GPU/CPU caches may still need pruning.
}

async function pruneIdleCpuSessions(maxIdleMs = CPU_IDLE_MS) {
  const now = Date.now();
  const stale = [...sessionCache.entries()].filter(([, entry]) => (
    entry?.provider === 'cpu'
    && typeof entry.lastUsedAt === 'number'
    && now - entry.lastUsedAt > maxIdleMs
  ));

  await stale.reduce(
    (prev, [cacheKey, entry]) => prev.then(async () => {
      await releaseSessionSafe(entry.session);
      sessionCache.delete(cacheKey);
      console.log(CAT, `Pruned idle CPU cache: ${entry.modelPath}`);
    }),
    Promise.resolve()
  );
}

/** GPU unused for GPU_IDLE_MS → release VRAM; best-effort move into CPU cache. */
async function pruneIdleGpuSessions(maxIdleMs = GPU_IDLE_MS) {
  const now = Date.now();
  const stale = [...sessionCache.entries()].filter(([, entry]) => (
    isGpuProvider(entry?.provider)
    && typeof entry.lastUsedAt === 'number'
    && now - entry.lastUsedAt > maxIdleMs
  ));

  await stale.reduce(
    (prev, [cacheKey, entry]) => prev.then(async () => {
      await releaseSessionSafe(entry.session);
      sessionCache.delete(cacheKey);
      try {
        await createCpuEntry(
          entry.modelPath,
          entry.freeDimensionOverrides,
          entry.deviceId,
          cacheKey
        );
        console.log(CAT, `Pruned idle GPU → CPU cache: ${entry.modelPath}`);
      } catch (err) {
        console.log(
          CAT,
          `Pruned idle GPU (no CPU cache): ${entry.modelPath}:`,
          err?.message || err
        );
      }
    }),
    Promise.resolve()
  );
}

async function pruneIdleSessions() {
  await pruneIdleGpuSessions();
  await pruneIdleCpuSessions();
}

/** Keep at most CPU_CACHE_MAX CPU sessions (LRU by lastUsedAt). */
async function trimCpuCache() {
  const cpuEntries = [...sessionCache.entries()]
    .filter(([, entry]) => entry?.provider === 'cpu')
    .sort((a, b) => (b[1].lastUsedAt || 0) - (a[1].lastUsedAt || 0));

  const overflow = cpuEntries.slice(CPU_CACHE_MAX);
  await overflow.reduce(
    (prev, [cacheKey, entry]) => prev.then(async () => {
      await releaseSessionSafe(entry.session);
      sessionCache.delete(cacheKey);
      console.log(CAT, `Evicted CPU cache (max ${CPU_CACHE_MAX}): ${entry.modelPath}`);
    }),
    Promise.resolve()
  );
}

/**
 * Ensure only one GPU-resident model. Other GPU entries are released into CPU cache.
 */
async function releaseOtherGpuSessions(keepCacheKey) {
  const others = [...sessionCache.entries()].filter(([key, entry]) => (
    key !== keepCacheKey && isGpuProvider(entry?.provider)
  ));

  await others.reduce(
    (prev, [cacheKey, entry]) => prev.then(async () => {
      await releaseSessionSafe(entry.session);
      sessionCache.delete(cacheKey);
      try {
        await createCpuEntry(
          entry.modelPath,
          entry.freeDimensionOverrides,
          entry.deviceId,
          cacheKey
        );
        console.log(CAT, `Moved previous GPU model to CPU cache: ${entry.modelPath}`);
      } catch (err) {
        console.warn(
          CAT,
          `Released previous GPU model without CPU cache: ${entry.modelPath}:`,
          err?.message || err
        );
      }
    }),
    Promise.resolve()
  );
}

/**
 * Create or reuse an InferenceSession.
 * Idle (preferGpu): at most one GPU model — the current selection.
 * Generating (!preferGpu): CPU only (reuse CPU cache / create CPU).
 */
async function createTaggerSession(modelPath, {
  preferGpu = true,
  deviceId = 0,
  freeDimensionOverrides,
} = {}) {
  ensureIdleCheckTimer();
  await pruneIdleSessions();

  const cacheKey = makeCacheKey(modelPath, freeDimensionOverrides, deviceId);
  const cached = sessionCache.get(cacheKey);

  if (!preferGpu) {
    // Prefer CPU path while generating; if this model is still on GPU, reuse it.
    if (cached?.session) {
      touchEntry(cached);
      return cached.session;
    }
    return createCpuEntry(modelPath, freeDimensionOverrides, deviceId, cacheKey);
  }

  if (cached?.session && isGpuProvider(cached.provider)) {
    touchEntry(cached);
    await releaseOtherGpuSessions(cacheKey);
    return cached.session;
  }

  try {
    const { session, provider } = await tryCreateGpuSession(
      modelPath,
      freeDimensionOverrides,
      deviceId
    );
    // Same model leaving CPU → drop CPU entry for this key.
    if (cached?.session) {
      await releaseSessionSafe(cached.session);
      sessionCache.delete(cacheKey);
    }
    storeEntry(cacheKey, {
      session,
      provider,
      modelPath,
      freeDimensionOverrides,
      deviceId,
    });
    await releaseOtherGpuSessions(cacheKey);
    return session;
  } catch (err) {
    console.warn(
      CAT,
      `GPU unavailable for ${modelPath}, using CPU:`,
      err?.message || err
    );
    if (cached?.session) {
      touchEntry(cached);
      return cached.session;
    }
    return createCpuEntry(modelPath, freeDimensionOverrides, deviceId, cacheKey);
  }
}

async function offloadOneEntry(cacheKey, entry, counters) {
  if (!entry) {
    sessionCache.delete(cacheKey);
    return;
  }

  if (entry.provider === 'cpu') {
    touchEntry(entry);
    counters.keptCpu += 1;
    return;
  }

  await releaseSessionSafe(entry.session);
  sessionCache.delete(cacheKey);
  counters.released += 1;

  try {
    await createCpuEntry(
      entry.modelPath,
      entry.freeDimensionOverrides,
      entry.deviceId,
      cacheKey
    );
    counters.keptCpu += 1;
    console.log(CAT, `Offloaded to CPU cache: ${entry.modelPath}`);
  } catch (err) {
    console.warn(
      CAT,
      `Released GPU session without CPU cache for ${entry.modelPath}:`,
      err?.message || err
    );
  }
}

/**
 * Release GPU sessions, then try to keep a CPU cache (best-effort, max 3).
 */
async function offloadTaggerSessions() {
  ensureIdleCheckTimer();
  await pruneIdleSessions();

  const entries = [...sessionCache.entries()];
  if (entries.length === 0) {
    return { released: 0, keptCpu: 0 };
  }

  const counters = { released: 0, keptCpu: 0 };
  await entries.reduce(
    (prev, [cacheKey, entry]) => prev.then(() => offloadOneEntry(cacheKey, entry, counters)),
    Promise.resolve()
  );
  await trimCpuCache();

  return counters;
}

async function releaseTaggerSessions() {
  if (idleCheckTimer) {
    clearInterval(idleCheckTimer);
    idleCheckTimer = null;
  }
  const entries = [...sessionCache.values()];
  sessionCache.clear();
  await entries.reduce(
    (prev, entry) => prev.then(() => releaseSessionSafe(entry?.session)),
    Promise.resolve()
  );
}

function clearTaggerSessionCache() {
  sessionCache.clear();
}

export {
  createTaggerSession,
  offloadTaggerSessions,
  releaseTaggerSessions,
  clearTaggerSessionCache,
};
