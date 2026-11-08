import * as fs from 'node:fs';
import sharp from 'sharp';
import { createTaggerSession } from './taggerSession.js';

const CAT = '[CLTagger] ';

async function preprocessImageCL(base64Str, targetSize=448) {
  const buffer = Buffer.from(base64Str, "base64");

  let image = sharp(buffer);
  // ensure alpha channel and flatten on white background
  image = image.ensureAlpha().flatten({ background: { r: 255, g: 255, b: 255 } });

  const { width, height } = await image.metadata();
  const size = Math.max(width, height);

  // top=floor, bottom=ceil，left=floor, right=ceil
  const padTop = Math.max(0, Math.floor((size - height) / 2));
  const padBottom = Math.max(0, Math.ceil((size - height) / 2));
  const padLeft = Math.max(0, Math.floor((size - width) / 2));
  const padRight = Math.max(0, Math.ceil((size - width) / 2));

  // create padded image, fill with white, remove alpha, then resize to targetSize x targetSize
  const proc = await image
    .clone()
    .extend({
      top: padTop,
      bottom: padBottom,
      left: padLeft,
      right: padRight,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .removeAlpha()
    .png()
    .toBuffer();
  const resized = sharp(proc).resize(targetSize, targetSize, { fit: 'fill' });

  // check dimensions and get raw pixel data
  const { data: rawBuffer, info } = await resized.raw().toBuffer({ resolveWithObject: true });
  if (info.width !== targetSize || info.height !== targetSize || info.channels < 3) {
    throw new Error(`${CAT}Unexpected raw image shape: ${info.width}x${info.height}x${info.channels}`);
  }

  // normalize to [0,1], then (x - mean) / std
  // HWC -> CHW, produce channels in BGR order
  const channels = info.channels || 3;
  const N = targetSize * targetSize;
  const src = rawBuffer; // Buffer / Uint8Array
  const chwArray = new Float32Array(3 * N);
  const meanR = 0.5, meanG = 0.5, meanB = 0.5;
  const invStdR = 1 / 0.5, invStdG = 1 / 0.5, invStdB = 1 / 0.5;
  let srcIdx = 0;
  // Precompute plane offsets
  const planeR = 0;
  const planeG = N;
  const planeB = 2 * N;

  for (let p = 0; p < N; p++) {
    const r = src[srcIdx    ] / 255;
    const g = src[srcIdx + 1] / 255;
    const b = src[srcIdx + 2] / 255;

    chwArray[planeR + p] = (b - meanB) * invStdB;
    chwArray[planeG + p] = (g - meanG) * invStdG;
    chwArray[planeB + p] = (r - meanR) * invStdR;

    srcIdx += channels;
  }

  // return CHW float32 array ready for new ort.Tensor("float32", chwArray, [1,3,targetSize,targetSize])
  return chwArray;
}

function shouldIncludeTag(entry, i, probs, allowedCats, gen_threshold, char_threshold) {
  const category = (entry?.category) ? entry.category : "General";
  if (allowedCats.size > 0 && !allowedCats.has(String(category).toLowerCase())) {
    return false;
  }
  const p = probs[i];
  if (p === undefined) return false;
  const threshold =
    ["Character", "Copyright", "Artist"].includes(category)
      ? char_threshold
      : gen_threshold;
  return p >= threshold;
}

async function runClTagger(modelPath, inputTensor, gen_threshold=0.55, char_threshold=0.6, 
  cat = ['General', 'Character', 'Artist', 'Copyright', 'Meta', 'Model', 'Rating', 'Quality'],
  preferGpu = true) {
  // Sigmoid function with clamping to avoid overflow
  function sigmoid(x) {
    return 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, x))));
  }

  const session = await createTaggerSession(modelPath, {
    preferGpu,
    freeDimensionOverrides: { batch: 1, height: 448, width: 448 },
  });

  const inputName = session.inputNames[0];
  const outputName = session.outputNames[0];

  const inferStart = Date.now();
  const results = await session.run({ [inputName]: inputTensor });
  const inferMs = Date.now() - inferStart;
  const logits = results[outputName].data;

  const probs = logits.map(sigmoid);

  console.log(CAT, `Model run complete in ${inferMs} ms. Mapping tags...`);
  // Load tag mapping
  const mappingPath = modelPath.replace(/\.onnx$/, "_tag_mapping.json");
  if (!fs.existsSync(mappingPath)) throw new Error(`${CAT}Missing tag mapping file.`);
  const tagMapping = JSON.parse(fs.readFileSync(mappingPath, "utf-8"));

  // Normalize allowed categories to a set for quick, case-insensitive lookup
  const allowedCats = new Set((cat || []).map(c => String(c).toLowerCase()));

  let outputTags = [];

  // Apply thresholds and collect tags
  for (const [idxStr, entry] of Object.entries(tagMapping)) {
    const i = Number.parseInt(idxStr, 10);
    if (Number.isNaN(i)) continue;
    if (shouldIncludeTag(entry, i, probs, allowedCats, gen_threshold, char_threshold)) {
      const tag = (entry?.tag) ? entry.tag : String(entry);
      outputTags.push(String(tag).replaceAll('_', ' '));
    }
  }

  console.log(CAT, `Generated ${outputTags.length} tags.`);
  return outputTags;
}

export {
  preprocessImageCL,
  runClTagger
};
