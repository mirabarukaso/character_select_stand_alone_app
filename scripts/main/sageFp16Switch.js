import { FORGE_UNET_STORAGE_AUTOMATIC, FORGE_UNET_STORAGE_DTYPE } from '../types.js';

// SageFP16Switch_MiraSubPack: model in, model out.
// PyTorch_FP16 casts compute to fp16. Sage_FP16 also casts attention q/k/v for SageAttention.
const FP16_CAST = {
  PyTorch_FP16: { compute_fp16: true, sage_cast: false },
  Sage_FP16: { compute_fp16: true, sage_cast: true },
};

export const SAGE_FP16_NODE_ID = '4';

export const FORGE_FP16_PLUGIN_URL = 'https://github.com/mirabarukaso/forge-turing-fp16.git';

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
