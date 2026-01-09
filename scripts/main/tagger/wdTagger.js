import * as ort from 'onnxruntime-node';
import * as fs from 'node:fs';
import sharp from 'sharp';
import * as os from 'node:os';

const CAT = "[wdTagger] ";

async function preprocessImageWD(base64Str, targetSize=448) {
  const buffer = Buffer.from(base64Str, "base64");
  let image = sharp(buffer);
  const proc = await image
    .clone()
    .removeAlpha()
    .png()
    .toBuffer();
  const resized = sharp(proc).resize(targetSize, targetSize, { fit: 'fill', kernel: 'cubic' });

  const { data: rawBuffer, info } = await resized.raw().toBuffer({ resolveWithObject: true });
  if (info.width !== targetSize || info.height !== targetSize || info.channels < 3) {
    throw new Error(`${CAT}Unexpected raw image shape: ${info.width}x${info.height}x${info.channels}`);
  }

  const N = targetSize * targetSize;
  const src = rawBuffer; // Buffer / Uint8Array
  const out = new Float32Array(N * 3); // NHWC BGR
  // rawBuffer layout: [R,G,B,(A), R,G,B,...] per pixel
  // channels may be >=3; assume R=0,G=1,B=2
  const stride = info.channels;
  let srcIdx = 0;
  let dstIdx = 0;
  for (let p = 0; p < N; p++) {
    // read rgb
    const r = src[srcIdx];
    const g = src[srcIdx + 1];
    const b = src[srcIdx + 2];
    // write b,g,r order
    out[dstIdx    ] = b;
    out[dstIdx + 1] = g;
    out[dstIdx + 2] = r;
    srcIdx += stride;
    dstIdx += 3;
  }

  return out;  // flat NHWC BGR
}

async function loadTagMappingFromCSV(filePath) {
  const kaomojis = new Set([
    "0_0",
    "(o)_(o)",
    "+_+",
    "+_-",
    "._.",
    "<o>_<o>",
    "<|>_<|>",
    "=_=",
    ">_<",
    "3_3",
    "6_9",
    ">_o",
    "@_@",
    "^_^",
    "o_o",
    "u_u",
    "x_x",
    "|_|",
    "||_||",
  ]);

  const csvData = await fs.promises.readFile(filePath, 'utf-8');
  const lines = csvData.split("\n").filter(line => line.trim() !== "");
  
  const tags = [];
  
  // Skip header line (tag_id,name,category,count)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Split by comma, assuming no commas in tag names
    const parts = line.split(",");
    if (parts.length >= 4) {
      let tag_id = parts[0];
      let name = parts[1];
      const category = parts[2];
      const count = parts[3];
      
      // Process name: replace _ with space unless it's a kaomoji
      const processedName = kaomojis.has(name) ? name : name.replaceAll("_", " ");      
      tags.push({ tag_id, name: processedName, category, count });
    }
  }

  console.log(CAT, `Loaded ${tags.length} tags from CSV.`);
  return tags;
}

function mcutThreshold(probs) {
  // Maximum Cut Thresholding (MCut)
  const sortedProbs = [...probs].sort((a, b) => b - a);
  const difs = [];
  for (let i = 0; i < sortedProbs.length - 1; i++) {
    difs.push(sortedProbs[i] - sortedProbs[i + 1]);
  }
  if (difs.length === 0) return 0;
  const t = difs.indexOf(Math.max(...difs));
  return (sortedProbs[t] + sortedProbs[t + 1]) / 2;
}

async function runWd14Tagger(modelPath, inputTensor, gen_threshold=0.35, char_threshold=0.85, 
  general_mcut_enabled=false, character_mcut_enabled=false,
cat = ['General', 'Character', 'Rating']) {
    const session = await ort.InferenceSession.create(modelPath, { 
      executionProviders: ['dml', 'cpu'],
      
      intraOpNumThreads: Math.max(1, os.cpus().length - 1),
      interOpNumThreads: 1,
      
      graphOptimizationLevel: 'all',  // 'disabled' | 'basic' | 'extended' | 'all'
      enableCpuMemArena: true,
      enableMemPattern: true,
      executionMode: 'sequential',      // 'sequential' | 'parallel'
    });  

  const inputName = session.inputNames[0];
  const outputName = session.outputNames[0];

  const results = await session.run({ [inputName]: inputTensor });
  const logits = results[outputName].data;

  const probs = logits; // WD14 models output probabilities directly

  console.log(CAT, 'Model run complete. Mapping tags...');
  
  // Load tag mapping (from CSV file)
  const mappingPath = modelPath.replace(/\.onnx$/, "_selected_tags.csv");
  if (!fs.existsSync(mappingPath)) throw new Error(`${CAT}Missing tag mapping file.`);
  const tagMapping = await loadTagMappingFromCSV(mappingPath);

  // Separate tags by category
  const ratingTags = [];
  const generalTags = [];
  const characterTags = [];

  // Collect all general and character probs for potential MCut
  const generalProbs = [];
  const characterProbs = [];

  // First pass: collect ratings, and probs for general/character
  for (let idx = 0; idx < tagMapping.length; idx++) {
    const tag = tagMapping[idx];
    const p = probs[idx];
    
    if (!p) continue;

    // Category 9: Rating tags
    if (tag.category === "9" && cat.includes('Rating')) {
      ratingTags.push({ name: tag.name, prob: p });
    }
    // Category 0: General tags - collect probs
    else if (tag.category === "0" && cat.includes('General')) {
      generalProbs.push(p);
      generalTags.push({ name: tag.name, prob: p });
    }
    // Category 4: Character tags - collect probs
    else if (tag.category === "4"&& cat.includes('Character')) {
      characterProbs.push(p);
      characterTags.push({ name: tag.name, prob: p });
    }
  }

  // Apply thresholds, with optional MCut
  let effectiveGenThresh = gen_threshold;
  if (general_mcut_enabled && generalProbs.length > 0) {
    effectiveGenThresh = mcutThreshold(generalProbs);
  }

  let effectiveCharThresh = char_threshold;
  if (character_mcut_enabled && characterProbs.length > 0) {
    effectiveCharThresh = Math.max(0.15, mcutThreshold(characterProbs));
  }

  // Filter general tags
  const filteredGeneralTags = generalTags.filter(tag => tag.prob > effectiveGenThresh);

  // Filter character tags
  const filteredCharacterTags = characterTags.filter(tag => tag.prob > effectiveCharThresh);

  // Sort general tags by probability (descending)
  filteredGeneralTags.sort((a, b) => b.prob - a.prob);

  // Combine tags: characters first (unsorted, in original order), then general tags
  let outputTags = [];
  
  // Add character tags (preserve original order)  
  // Add general tags
  outputTags.push(...filteredCharacterTags.map(t => t.name), ...filteredGeneralTags.map(t => t.name));

  console.log(CAT, `Generated ${outputTags.length} tags (${filteredCharacterTags.length} characters, ${filteredGeneralTags.length} general).`);
  
  // Log rating prediction (argmax equivalent)
  if (ratingTags.length > 0 && cat.includes('Rating')) {
    const topRating = ratingTags.reduce((max, tag) => tag.prob > max.prob ? tag : max, ratingTags[0]);
    console.log(CAT, `Rating: ${topRating.name} (${(topRating.prob * 100).toFixed(2)}%)`);
    outputTags.unshift(topRating.name);  // prepend rating tag
  }

  return outputTags;
}

export {
  preprocessImageWD,
  runWd14Tagger
};
