import { FORGE_UNET_STORAGE_AUTOMATIC, FORGE_UNET_STORAGE_DTYPE } from '../types.js';

// SageFP16Switch_MiraSubPack: model in, model out.
// PyTorch_FP16 casts compute to fp16. Sage_FP16 also casts attention q/k/v for SageAttention.
const FP16_CAST = {
  PyTorch_FP16: { compute_fp16: true, sage_cast: false },
  Sage_FP16: { compute_fp16: true, sage_cast: true },
};

export const SAGE_FP16_NODE_ID = '4';

export const FORGE_FP16_PLUGIN_URL = 'https://github.com/mirabarukaso/forge-turing-fp16.git';

export const OVERRIDE_VAE_MODES = ['auto', 'direct', 'tiled'];

const OVERRIDE_VAE_TILE_DEFAULTS = {
  tile_size: 512,
  overlap: 64,
  temporal_size: 64,
  temporal_overlap: 8,
};

const VAE_OVERRIDE_MAP = {
  VAEEncode: { class_type: 'VAEEncode_MiraSubPack', title: 'VAE Encode (Mira SubPack)', autoMode: 'direct' },
  VAEEncodeTiled: { class_type: 'VAEEncode_MiraSubPack', title: 'VAE Encode (Mira SubPack)', autoMode: 'tiled' },
  VAEDecode: { class_type: 'VAEDecode_MiraSubPack', title: 'VAE Decode (Mira SubPack)', autoMode: 'direct' },
  VAEDecodeTiled: { class_type: 'VAEDecode_MiraSubPack', title: 'VAE Decode (Mira SubPack)', autoMode: 'tiled' },
};

const MIRA_VAE_CLASS = {
  VAEEncode_MiraSubPack: true,
  VAEDecode_MiraSubPack: true,
};

// Impact FaceDetailer encodes/decodes inside Python (stock nodes.VAEEncode / vae.decode).
// Graph rewrites never see those calls; route the VAE socket through Mira's SafeVAE proxy.
const VAE_SAFE_PASSTHROUGH = {
  class_type: 'VAESafePassthrough_MiraSubPack',
  title: 'VAE Safe Passthrough (Mira SubPack)',
};

const INTERNAL_VAE_CONSUMERS = {
  FaceDetailer: true,
};

export function isFp16CastDtype(dtype) {
  return Object.hasOwn(FP16_CAST, dtype);
}

// Dropdown callbacks store the whole selection, so a saved dtype is often ["Sage_FP16"].
export function normalizeDiffusionDtype(value) {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === 'string' && raw !== '' ? raw : 'default';
}

export function normalizeForgeStorageDtype(value) {
  const raw = Array.isArray(value) ? value[0] : value;
  return FORGE_UNET_STORAGE_DTYPE.includes(raw) ? raw : FORGE_UNET_STORAGE_AUTOMATIC;
}

export function normalizeOverrideVaeMode(value) {
  const raw = Array.isArray(value) ? value[0] : value;
  return OVERRIDE_VAE_MODES.includes(raw) ? raw : 'auto';
}

export function visibleForgeStorageDtype(saved) {
  const visible = normalizeForgeStorageDtype(saved);
  return { saved: visible, choices: FORGE_UNET_STORAGE_DTYPE.slice(), visible };
}

export function readForgeDtypeSettings(settings) {
  const source = settings && typeof settings === 'object' ? settings : {};
  return {
    storage: source.api_forge_unet_storage_dtype,
    computeFp16: source.api_forge_compute_fp16 === true,
    sageFp16Cast: source.api_forge_sage_fp16_cast === true,
    overrideVae: source.api_forge_override_vae === true,
    overrideVaeMode: normalizeOverrideVaeMode(source.api_forge_override_vae_mode),
  };
}

function residentListText(modules) {
  const list = Array.isArray(modules) ? modules : [];
  return list.length > 0 ? list.join(', ') : '(none)';
}

function sameResidentModules(left, right) {
  const a = Array.isArray(left) ? left : [];
  const b = Array.isArray(right) ? right : [];
  return a.length === b.length && a.every((name, index) => name === b[index]);
}

// prev is the last request this process sent. baseline is the current Forge options
// when there is no previous request. checkpoint values are checkpointKey results,
// and module lists are normalizedModuleNames results.
export function forgeResidentUnloadDecision(prev, next, baseline = null) {
  const reasons = [];
  if (!next) return { unload: false, reasons };
  const prior = prev || baseline;
  if (!prior) return { unload: false, reasons };

  if (prev) {
    if (prev.compute === true && next.compute !== true) {
      reasons.push('forge_compute_fp16 true -> false');
    }
    if (prev.sage === true && next.sage !== true) {
      reasons.push('forge_sage_fp16_cast true -> false');
    }
  }

  const fromCheckpoint = prior.checkpoint ?? '';
  const toCheckpoint = next.checkpoint ?? '';
  if (fromCheckpoint !== toCheckpoint) {
    reasons.push(`checkpoint ${fromCheckpoint || '(none)'} -> ${toCheckpoint || '(none)'}`);
  }

  if (!sameResidentModules(prior.modules, next.modules)) {
    reasons.push(`forge_additional_modules ${residentListText(prior.modules)} -> ${residentListText(next.modules)}`);
  }

  return { unload: reasons.length > 0, reasons };
}

export function forgeOverrideSettings(forgeDtype = null) {
  const source = forgeDtype && typeof forgeDtype === 'object' ? forgeDtype : {};
  const compute = source.computeFp16 === true;
  const sage = source.sageFp16Cast === true;
  return {
    forge_compute_fp16: compute,
    forge_sage_fp16_cast: sage,
    forge_unet_storage_dtype: (compute || sage)
      ? FORGE_UNET_STORAGE_AUTOMATIC
      : normalizeForgeStorageDtype(source.storage),
  };
}

export function visibleDiffusionDtype(saved, modelType, allChoices) {
  const dtype = normalizeDiffusionDtype(saved);
  const choices = modelType === 'Checkpoint'
    ? allChoices.filter((item) => !isFp16CastDtype(item))
    : allChoices;
  const visible = choices.includes(dtype) ? dtype : (choices[0] || 'default');
  return { saved: dtype, choices, visible };
}

export function diffusionLoaderDtype(dtype) {
  return isFp16CastDtype(dtype) ? 'default' : dtype;
}

function retargetLoaderModel(workflow, loaderId, switchId) {
  for (const node of Object.values(workflow)) {
    const inputs = node?.inputs;
    if (!inputs || typeof inputs !== 'object') continue;
    for (const value of Object.values(inputs)) {
      if (!Array.isArray(value) || value.length < 2) continue;
      if (String(value[0]) === loaderId && Number(value[1]) === 0) {
        value[0] = switchId;
      }
    }
  }
}

function switchFlags(mode) {
  if (typeof mode === 'string' || Array.isArray(mode)) {
    return FP16_CAST[normalizeDiffusionDtype(mode)] || null;
  }
  if (!mode || typeof mode !== 'object') return null;
  const compute = mode.computeFp16 === true || mode.compute_fp16 === true;
  const sage = mode.sageFp16Cast === true || mode.sage_cast === true;
  if (!compute && !sage) return null;
  return { compute_fp16: compute, sage_cast: sage };
}

export function applySageFp16Switch(workflow, loaderNodeId, mode) {
  const flags = switchFlags(mode);
  if (!flags) return workflow;

  const switchId = SAGE_FP16_NODE_ID;
  if (workflow[switchId]) {
    console.warn(`[ComfyUI] Node ${switchId} is already used. Sage FP16 switch was not inserted.`);
    return workflow;
  }

  const loaderId = String(loaderNodeId);
  retargetLoaderModel(workflow, loaderId, switchId);
  workflow[switchId] = {
    inputs: {
      model: [loaderId, 0],
      compute_fp16: flags.compute_fp16,
      sage_cast: flags.sage_cast,
    },
    class_type: 'SageFP16Switch_MiraSubPack',
    _meta: {
      title: 'Sage FP16 Switch (Mira SubPack)',
    },
  };
  return workflow;
}

function resolveOverrideVaeMode(classType, requestedMode) {
  const mode = normalizeOverrideVaeMode(requestedMode);
  if (mode === 'direct' || mode === 'tiled') return mode;
  return VAE_OVERRIDE_MAP[classType]?.autoMode || 'direct';
}

function copyVaeTileInputs(inputs) {
  const src = inputs && typeof inputs === 'object' ? inputs : {};
  return {
    tile_size: Number.isFinite(src.tile_size) ? src.tile_size : OVERRIDE_VAE_TILE_DEFAULTS.tile_size,
    overlap: Number.isFinite(src.overlap) ? src.overlap : OVERRIDE_VAE_TILE_DEFAULTS.overlap,
    temporal_size: Number.isFinite(src.temporal_size) ? src.temporal_size : OVERRIDE_VAE_TILE_DEFAULTS.temporal_size,
    temporal_overlap: Number.isFinite(src.temporal_overlap) ? src.temporal_overlap : OVERRIDE_VAE_TILE_DEFAULTS.temporal_overlap,
  };
}

function rewriteStandardVaeNode(node, mapping, mode) {
  const inputs = node.inputs && typeof node.inputs === 'object' ? { ...node.inputs } : {};
  const next = {
    ...node,
    class_type: mapping.class_type,
    inputs: {
      ...inputs,
      ...copyVaeTileInputs(inputs),
      mode,
    },
    _meta: {
      ...(node._meta && typeof node._meta === 'object' ? node._meta : {}),
      title: mapping.title,
    },
  };
  return next;
}

function patchMiraVaeMode(node, mode) {
  const inputs = node.inputs && typeof node.inputs === 'object' ? { ...node.inputs } : {};
  const nextMode = mode === 'direct' || mode === 'tiled'
    ? mode
    : (inputs.mode === 'tiled' || inputs.mode === 'direct' ? inputs.mode : 'direct');
  return {
    ...node,
    inputs: {
      ...inputs,
      ...copyVaeTileInputs(inputs),
      mode: nextMode,
    },
  };
}

function miraVaeNeedsDefaults(node) {
  const inputs = node?.inputs;
  if (!inputs || typeof inputs !== 'object') return true;
  return !('mode' in inputs)
    || !('tile_size' in inputs)
    || !('overlap' in inputs)
    || !('temporal_size' in inputs)
    || !('temporal_overlap' in inputs);
}

function nextWorkflowNodeId(workflow) {
  let max = 0;
  for (const id of Object.keys(workflow)) {
    const n = Number(id);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return String(max + 1);
}

function applyInternalVaeSafePassthrough(workflow, requestedMode) {
  const gates = new Map();
  const tiled = requestedMode === 'tiled';

  for (const node of Object.values(workflow)) {
    if (!INTERNAL_VAE_CONSUMERS[node?.class_type] || !node.inputs) continue;

    // Mode only controls Impact's existing tiled flags; safety comes from SafeVAE.
    node.inputs.tiled_encode = tiled;
    node.inputs.tiled_decode = tiled;

    const vae = node.inputs.vae;
    if (!Array.isArray(vae) || vae.length < 2) continue;

    const srcId = String(vae[0]);
    const srcSlot = Number(vae[1]);
    const srcNode = workflow[srcId];
    if (srcNode?.class_type === VAE_SAFE_PASSTHROUGH.class_type) continue;

    const key = `${srcId}:${srcSlot}`;
    let gateId = gates.get(key);
    if (!gateId) {
      gateId = nextWorkflowNodeId(workflow);
      workflow[gateId] = {
        inputs: { vae: [srcId, srcSlot] },
        class_type: VAE_SAFE_PASSTHROUGH.class_type,
        _meta: { title: VAE_SAFE_PASSTHROUGH.title },
      };
      gates.set(key, gateId);
    }
    node.inputs.vae = [gateId, 0];
  }
}

export function applyOverrideVae(workflow, forgeDtype = null) {
  if (!workflow || typeof workflow !== 'object') return workflow;
  const source = forgeDtype && typeof forgeDtype === 'object' ? forgeDtype : {};
  if (source.overrideVae !== true) return workflow;

  const requestedMode = normalizeOverrideVaeMode(source.overrideVaeMode);
  for (const [nodeId, node] of Object.entries(workflow)) {
    const classType = node?.class_type;
    if (!classType) continue;

    const mapping = VAE_OVERRIDE_MAP[classType];
    if (mapping) {
      workflow[nodeId] = rewriteStandardVaeNode(node, mapping, resolveOverrideVaeMode(classType, requestedMode));
      continue;
    }

    if (MIRA_VAE_CLASS[classType]
      && (requestedMode === 'direct' || requestedMode === 'tiled' || miraVaeNeedsDefaults(node))) {
      workflow[nodeId] = patchMiraVaeMode(node, requestedMode);
    }
  }

  applyInternalVaeSafePassthrough(workflow, requestedMode);
  return workflow;
}
