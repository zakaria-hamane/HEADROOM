// Original engine from "LLM GPU Planner.html", kept verbatim as the reference for tests/engine.parity.test.ts.
/* LLM sizing engine v2: pure functions, no DOM.
   Memory in GiB (shown as "GB", as nvidia-smi and most calculators do). Bandwidth GB/s and TFLOPS are decimal. */
(function (root) {
  'use strict';
  var GiB = 1073741824;

  // ---------- precision tables
  // b = bits per weight (incl. scales); keep16 = embeddings / LM head usually stay 16-bit in this format; c = compute class
  var WQ = {
    fp32:    { l: 'FP32', b: 32, c: 'fp16' },
    bf16:    { l: 'BF16 / FP16', b: 16, c: 'fp16' },
    fp8:     { l: 'FP8 (W8A8)', b: 8, c: 'fp8', keep16: true },
    int8:    { l: 'INT8 (W8A8 / W8A16)', b: 8, c: 'int8', keep16: true },
    awq:     { l: 'INT4 AWQ / GPTQ', b: 4.25, c: 'fp16', keep16: true },
    nvfp4:   { l: 'NVFP4', b: 4.5, c: 'fp4', keep16: true },
    mxfp4:   { l: 'MXFP4', b: 4.25, c: 'fp4', keep16: true },
    q8_0:    { l: 'GGUF Q8_0', b: 8.5, c: 'fp16', gguf: true },
    q6_k:    { l: 'GGUF Q6_K', b: 6.56, c: 'fp16', gguf: true },
    q5_k_m:  { l: 'GGUF Q5_K_M', b: 5.69, c: 'fp16', gguf: true },
    q5_k_s:  { l: 'GGUF Q5_K_S', b: 5.54, c: 'fp16', gguf: true },
    q4_k_m:  { l: 'GGUF Q4_K_M', b: 4.89, c: 'fp16', gguf: true },
    q4_k_s:  { l: 'GGUF Q4_K_S', b: 4.58, c: 'fp16', gguf: true },
    q4_0:    { l: 'GGUF Q4_0', b: 4.5, c: 'fp16', gguf: true },
    iq4_xs:  { l: 'GGUF IQ4_XS', b: 4.25, c: 'fp16', gguf: true },
    q3_k_m:  { l: 'GGUF Q3_K_M', b: 3.91, c: 'fp16', gguf: true },
    iq3_xxs: { l: 'GGUF IQ3_XXS', b: 3.06, c: 'fp16', gguf: true },
    q2_k:    { l: 'GGUF Q2_K', b: 3.35, c: 'fp16', gguf: true },
    iq2_xxs: { l: 'GGUF IQ2_XXS', b: 2.06, c: 'fp16', gguf: true },
    iq1_s:   { l: 'GGUF IQ1_S', b: 1.56, c: 'fp16', gguf: true }
  };
  var KQ = {
    fp32: { l: 'FP32', b: 4 }, fp16: { l: 'FP16 / BF16', b: 2 }, fp8: { l: 'FP8', b: 1 },
    q8_0: { l: 'Q8_0 (llama.cpp)', b: 1.0625 }, q5_1: { l: 'Q5_1 (llama.cpp)', b: 0.75 }, q4_0: { l: 'Q4_0 (llama.cpp)', b: 0.5625 },
    fp4: { l: 'NVFP4 (TensorRT-LLM)', b: 0.5625 }
  };
  // inference runtimes: GB per GPU for framework / CUDA graphs / multi-GPU buffers; eta = share of peak memory bandwidth reached while
  // writing; mfu = share of peak compute reached while reading prompts
  var ENGINES = {
    vllm:     { l: 'vLLM', ovh: [0.8, 0.012], fw: 0.75, graphs: 0.6, comm: 0.8, eta: 0.55, mfu: 0.5, kv: ['fp16', 'fp8', 'fp32'], paged: true },
    sglang:   { l: 'SGLang', ovh: [0.7, 0.01], fw: 0.75, graphs: 0.6, comm: 0.8, eta: 0.58, mfu: 0.52, kv: ['fp16', 'fp8', 'fp32'], paged: true },
    trtllm:   { l: 'TensorRT-LLM', ovh: [0.5, 0.008], fw: 0.6, graphs: 0.4, comm: 0.8, eta: 0.62, mfu: 0.58, kv: ['fp16', 'fp8', 'fp4', 'fp32'], paged: true },
    llamacpp: { l: 'llama.cpp / Ollama', ovh: [1.5, 0.03], fw: 0.35, graphs: 0.15, comm: 0.3, eta: 0.5, mfu: 0.35, kv: ['fp16', 'q8_0', 'q5_1', 'q4_0', 'fp32'], paged: false },
    exllama:  { l: 'ExLlamaV3', ovh: [1.0, 0.02], fw: 0.4, graphs: 0.1, comm: 0.3, eta: 0.55, mfu: 0.4, kv: ['fp16', 'q8_0', 'q4_0'], paged: true },
    mlx:      { l: 'MLX (Apple)', ovh: [1.5, 0.03], fw: 0.3, graphs: 0, comm: 0, eta: 0.6, mfu: 0.4, kv: ['fp16', 'q8_0', 'q4_0'], paged: false },
    hf:       { l: 'HF Transformers', ovh: [5, 0.12], fw: 1.0, graphs: 0, comm: 0.5, eta: 0.3, mfu: 0.35, kv: ['fp16', 'fp8', 'fp32'], paged: false }
  };
  var NETS = {
    ib800: { l: 'InfiniBand XDR / 800G per GPU', bw: 100, lat: 4e-6 },
    ib400: { l: 'InfiniBand NDR / 400G per GPU', bw: 50, lat: 5e-6 },
    ib200: { l: 'InfiniBand HDR / 200G per GPU', bw: 25, lat: 6e-6 },
    eth400: { l: 'Ethernet RoCE 400G per GPU', bw: 50, lat: 8e-6 },
    eth100: { l: 'Ethernet 100G per node', bw: 12.5, lat: 15e-6 }
  };
  var HOSTS = {
    dual24: { l: '2 CPUs · 24 ch DDR5-5600', bw: 1075 },
    dual16: { l: '2 CPUs · 16 ch DDR5-4800', bw: 614 },
    single12: { l: '1 CPU · 12 ch DDR5-5600', bw: 538 },
    single8: { l: '1 CPU · 8 ch DDR5-4800', bw: 307 },
    desktop: { l: 'Desktop · 2 ch DDR5-6000', bw: 96 }
  };
  var PCIE = { 3: 12, 4: 25, 5: 50, 6: 100 };
  var STD_RAM = [16, 32, 64, 128, 256, 512, 768, 1024, 1536, 2048, 3072, 4096];
  var STD_CPU = [8, 16, 24, 32, 48, 64, 96, 128, 192, 256, 384, 512];
  var OPTIM = {   // bytes per trainable parameter for optimizer states (incl. FP32 master copy where the scheme keeps one)
    adamw:   { l: 'AdamW', mixed: 12, fp32: 8, pure: 4 },
    adamw8:  { l: 'AdamW 8-bit', mixed: 6, fp32: 2, pure: 2 },
    paged8:  { l: 'Paged AdamW 8-bit', mixed: 6, fp32: 2, pure: 2, paged: true },
    lion:    { l: 'Lion', mixed: 8, fp32: 4, pure: 2 },
    adafactor: { l: 'Adafactor', mixed: 4.1, fp32: 0.1, pure: 0.1 },
    sgd:     { l: 'SGD + momentum', mixed: 8, fp32: 4, pure: 2 }
  };

  // ---------- helpers
  function num(x, d) { return typeof x === 'number' && isFinite(x) ? x : d; }
  function roundUp(x, list) { for (var i = 0; i < list.length; i++) if (list[i] >= x - 1e-9) return list[i]; var l = list[list.length - 1]; return Math.ceil(x / l) * l; }
  function normModel(m) {
    var o = Object.assign({}, m);
    o.layers = num(o.layers, 32); o.hidden = num(o.hidden, 4096); o.heads = num(o.heads, 32);
    o.kvHeads = num(o.kvHeads, o.heads); o.headDim = num(o.headDim, o.hidden / o.heads);
    o.ffn = num(o.ffn, o.hidden * 4); o.vocab = num(o.vocab, 32000); o.params = num(o.params, 7);
    o.activeParams = num(o.activeParams, o.params); o.maxCtx = num(o.maxCtx, 131072);
    o.embedParams = num(o.embedParams, o.vocab * o.hidden / 1e9); o.tied = !!o.tied;
    var ll = o.linearLayers;
    if (ll && typeof ll === 'object') { o.linearN = num(ll.layers, 0); o.linearStateMB = num(ll.stateMB, 0); o.linearKind = ll.kind || 'linear'; }
    else { o.linearN = num(ll, 0); o.linearStateMB = num(o.linearStateMB, 0); }
    return o;
  }
  function expertParams(m) {   // billions held in routed experts
    if (!m.moe || !m.moe.experts) return 0;
    var ffn = num(m.moe.expertFfn, m.ffn), moeLayers = m.layers - num(m.moe.denseLayers, 0);
    return Math.min(m.params * 0.985, moeLayers * m.moe.experts * 3 * m.hidden * ffn / 1e9);
  }
  function weightsGiB(m, q, keep16) {
    var emb = m.embedParams * (m.tied ? 1 : 2), body = Math.max(0, m.params - emb);
    var embBits = keep16 && q.keep16 ? 16 : q.b;
    return (body * q.b + emb * embBits) * 1e9 / 8 / GiB;
  }
  function attnLayers(m) { return Math.max(0, m.layers - num(m.linearN, 0)); }
  // KV cache for one sequence holding S tokens. exact = use the special global-layer layout; swa = sliding layers keep only the window
  function kvSeq(m, S, kvB, exact, swa, tp) {
    var parts = [], A = attnLayers(m), kc = m.kvCompression, sh = m.kvSharedLayers || {};
    if (kc && (kc.growingElemsPerToken || kc.documentedBytesPerToken)) {
      if (kc.growingElemsPerToken) {
        parts.push({ kind: 'compressed (growing)', layers: 1, kvh: 1, hd: kc.growingElemsPerToken, kv: 1, tokens: S, rep: tp });
        if (kc.windowElemsPerSeq) parts.push({ kind: 'compressed (window)', layers: 1, kvh: 1, hd: kc.windowElemsPerSeq, kv: 1, tokens: 1, rep: tp });
      } else parts.push({ kind: 'compressed (documented)', layers: 1, kvh: 1, hd: kc.documentedBytesPerToken / kvB, kv: 1, tokens: S, rep: tp });
    } else if (m.mla && m.mla.kvLoraRank) {
      parts.push({ kind: 'MLA latent', layers: A, kvh: 1, hd: m.mla.kvLoraRank + num(m.mla.qkRopeHeadDim, 64), kv: 1, tokens: S, rep: tp });
    } else {
      var sw = m.swa && m.swa.layers ? Math.min(A, m.swa.layers) : 0;
      if (sw && sw - num(sh.sliding, 0) > 0) parts.push({ kind: 'sliding-window', layers: sw - num(sh.sliding, 0), kvh: m.kvHeads, hd: m.headDim, kv: 2, tokens: swa ? Math.min(S, m.swa.window) : S, rep: tp > m.kvHeads ? tp / m.kvHeads : 1 });
      var gl = A - sw - num(sh.full, 0);
      if (gl > 0) {
        var g = exact && m.global ? m.global : null, kvh = g && g.kvHeads || m.kvHeads, hd = g && g.headDim || m.headDim;
        parts.push({ kind: sw ? 'global' : 'attention', layers: gl, kvh: kvh, hd: hd, kv: g && g.kvShared ? 1 : 2, tokens: S, rep: tp > kvh ? tp / kvh : 1 });
      }
    }
    var logical = 0, stored = 0;
    parts.forEach(function (p) { p.bytes = p.layers * p.kvh * p.hd * p.kv * p.tokens * kvB; logical += p.bytes; stored += p.bytes * p.rep; });
    var state = num(m.linearStateMB, 0) * 1048576;
    return { parts: parts, logical: logical + state, stored: stored + state, perToken: S ? logical / S : 0 };
  }
  function attnDim(m) { return m.mla ? m.heads * (num(m.mla.qkNopeHeadDim, 128) + num(m.mla.qkRopeHeadDim, 64) + num(m.mla.vHeadDim, 128)) / 2 : m.heads * m.headDim; }
  // FLOPs for one new token with `ctx` tokens already attended (decode), using active parameters
  function decodeFlops(m, ctx, swa) {
    var A = attnLayers(m), sw = m.swa && m.swa.layers ? Math.min(A, m.swa.layers) : 0, d = attnDim(m);
    var att = 4 * d * ((A - sw) * ctx + sw * (swa && m.swa ? Math.min(ctx, m.swa.window) : ctx));
    return 2 * m.activeParams * 1e9 + att;
  }
  // FLOPs to read a prompt of P new tokens after `pre` cached tokens
  function prefillFlops(m, P, pre, swa) {
    var A = attnLayers(m), sw = m.swa && m.swa.layers ? Math.min(A, m.swa.layers) : 0, d = attnDim(m);
    var avg = pre + P / 2, win = swa && m.swa ? Math.min(avg, m.swa.window) : avg;
    return P * (2 * m.activeParams * 1e9 + 4 * d * ((A - sw) * avg + sw * win));
  }
  function linkFor(g, tp, perNode, net) {
    if (tp <= perNode && num(g.nvlinkGBs, 0) > 0 && tp <= num(g.linkDomain, 1)) return { kind: g.vendor === 'AMD' ? 'Infinity Fabric' : (g.vendor === 'Google' ? 'ICI' : 'NVLink'), bw: g.nvlinkGBs / 2, lat: 5e-6 };
    if (tp <= perNode) return { kind: 'PCIe Gen' + (g.pcieGen || 4), bw: (PCIE[g.pcieGen] || 25) * 0.8, lat: 12e-6 };
    var n = NETS[net] || NETS.ib400; return { kind: n.l, bw: n.bw, lat: n.lat };
  }
  // host link: PCIe x16, or NVLink-C2C (450 GB/s each way) on Grace superchips
  function hostLinkGBs(g) { return g.pcieGen ? (PCIE[g.pcieGen] || 25) : (/^g[bh]\d/.test(g.id || '') ? 450 : 25); }
  function allReduce(msg, n, link) { return n > 1 ? 2 * (n - 1) / n * msg / (link.bw * 1e9) + 2 * (n - 1) * link.lat : 0; }
  function tflopsFor(g, c, prec) {
    var f16 = num(g.fp16, 0);
    if (prec === 'eight') { if (c === 'fp8' && g.fp8) return g.fp8; if (c === 'int8' && g.int8) return g.int8; if (c === 'fp4' && (g.fp8 || g.int8)) return g.fp8 || g.int8; }
    if (prec === 'four' && c === 'fp4' && g.fp4) return g.fp4;
    return f16;
  }

  function topology(s) {
    var G, tp, pp, perNode;
    if (s.hw === 'cluster') { perNode = Math.max(1, s.perNode | 0); G = Math.max(1, s.nodes | 0) * perNode; tp = Math.max(1, s.tp | 0); pp = Math.max(1, s.pp | 0); }
    else { perNode = Math.max(1, s.n | 0); G = perNode; tp = G; pp = 1; }
    var rep = tp * pp, dp = Math.max(1, Math.floor(G / rep));
    return { G: G, tp: tp, pp: pp, dp: dp, rep: rep, perNode: perNode, idle: G - dp * rep, valid: rep <= G };
  }

  // ---------- inference
  function inference(s, gpu, model, nOverride) {
    var m = normModel(model), g = gpu, q = WQ[s.wq] || WQ.bf16, kq = KQ[s.kvq] || KQ.fp16;
    var engKey = s.engine === 'auto' ? autoEngine(s.wq, g) : s.engine, E = ENGINES[engKey] || ENGINES.vllm;
    var st = nOverride ? Object.assign({}, s, { hw: 'single', n: nOverride }) : s;
    var T = topology(st), tp = T.tp, pp = T.pp;
    var users = Math.max(1, Math.round(s.users)), seqs = users * Math.max(1, Math.round(s.batch || 1));
    var Br = Math.ceil(seqs / T.dp);
    var S = Math.max(16, Math.round(s.seq)), O = Math.min(Math.max(1, Math.round(s.out || 512)), S - 1), P = S - O;
    var pre = Math.min(Math.max(0, Math.round(s.prefix || 0)), P);
    var eta = num(s.eta, E.eta), mfu = num(s.mfu, E.mfu);
    var W = weightsGiB(m, q, s.keep16 !== false);
    var Ep = expertParams(m), expFrac = m.params ? Ep / m.params : 0;
    var kv = kvSeq(m, S, kq.b, s.kvMode === 'exact', s.swa !== false, tp);
    var kvUserGpu = kv.stored / GiB, kvUserRam = kv.logical / GiB;
    var prefixShare = pre / S;                                   // share of each sequence's KV that is a shared, cached prefix
    // offloading
    var off = s.offload && s.offload.on, L = m.layers;
    var fW = off ? (s.offload.by === 'pct' ? Math.min(1, num(s.offload.pct, 0) / 100) : Math.min(1, num(s.offload.layers, 0) / L)) : 0;
    var kvOff = !!(off && s.offload.kv);
    var W_off = W * fW, W_gpu = W - W_off;
    var kvMemPerSeq = kvUserGpu * (1 - prefixShare);           // private part
    var KV_gpu = kvOff ? 0 : Br * kvMemPerSeq + kvUserGpu * prefixShare;
    var KV_off = kvOff ? Br * kvUserRam * (1 - prefixShare) + kvUserRam * prefixShare : 0;
    var offBytes = W_off + KV_off;
    // runtime memory for one replica (tp x pp GPUs)
    var nRep = T.rep;
    var fw = num(s.fw, E.fw) * nRep, graphs = (s.graphs === false ? 0 : num(s.graphsGB, E.graphs)) * nRep, comm = nRep > 1 ? num(s.commGB, E.comm) * nRep : 0;
    var ffnEff = m.moe ? num(m.moe.expertFfn, m.ffn) * num(m.moe.active, 2) + num(m.moe.sharedFfn, num(m.moe.expertFfn, m.ffn)) * num(m.moe.shared, 0) : m.ffn;
    var chunk = Math.max(256, num(s.chunk, 2048));
    var act = nRep * (chunk * (6 * m.hidden + 3 * ffnEff / tp) * 2 + Br * m.vocab * 4 / tp) / GiB;
    var other = num(s.other, 0);
    var shared = W_gpu + fw + graphs + comm + act;
    var llm = shared + KV_gpu, used = llm + other;
    var memGB = num(g.memGB, 24), usableFrac = num(s.usable, 0.9);
    var totalRep = nRep * memGB, usablePerGpu = memGB * usableFrac, usableRep = nRep * usablePerGpu;
    var ratio = used / usableRep, fits = used <= usableRep + 1e-9 && T.valid;
    // compute / bandwidth
    var tfPer = tflopsFor(g, q.c, s.prec), TFrep = nRep * tfPer * 1e12;
    var bw = num(g.bwGBs, 500) * 1e9 * eta;
    var touched = m.moe && m.moe.experts ? 1 - Math.pow(1 - Math.min(1, num(m.moe.active, 2) / m.moe.experts), Math.max(1, Br / pp)) : 1;
    var Wexp_gpu = W_gpu * expFrac, Wdense_gpu = W_gpu - Wexp_gpu;
    var bytesW = (Wdense_gpu + Wexp_gpu * touched) * GiB;
    var bytesKV = kvOff ? 0 : Br * kvUserGpu * GiB;
    var tMem = (bytesW / tp + bytesKV / (tp * pp)) / bw;
    var Fdec = decodeFlops(m, S, s.swa !== false);
    var cpuExec = off && s.offload.exec !== 'pcie' && offBytes > 0;
    var attnShare = 1 - 2 * m.activeParams * 1e9 / Fdec;
    var Fcpu = cpuExec ? Fdec * ((1 - attnShare) * fW + attnShare * (kvOff ? 1 : fW)) : 0;
    var tComp = Br * (Fdec - Fcpu) / (TFrep * mfu);
    var link = linkFor(g, tp, T.perNode, s.net), tComm = 0, tP2p = 0;
    if (s.comm !== false && tp > 1) tComm = 2 * m.layers * allReduce(Br / pp * m.hidden * 2, tp, link);
    if (pp > 1) { var pl = T.perNode >= tp * pp ? linkFor(g, 2, T.perNode, s.net) : (NETS[s.net] || NETS.ib400); tP2p = (pp - 1) * (pl.lat + Br / pp * m.hidden * 2 / (pl.bw * 1e9)); }
    var tOff = 0, tRam = 0, tCpu = 0, offBw = 0, offBound = '';
    var pcie = hostLinkGBs(g), host = HOSTS[s.host] || HOSTS.dual24;
    if (offBytes > 0) {
      if (cpuExec) {
        offBw = s.offload.target === 'nvme' ? num(s.nvme, 7) : host.bw * num(s.ramEff, 0.78);
        tRam = offBytes * GiB / (offBw * 1e9); tCpu = Br * Fcpu / (num(s.cpuTflops, 8) * 1e12);
        tOff = Math.max(tRam, tCpu); offBound = tRam >= tCpu ? (s.offload.target === 'nvme' ? 'nvme' : 'ram') : 'cpu';
      } else {
        offBw = Math.min(nRep * pcie, s.offload.target === 'nvme' ? num(s.nvme, 7) : Infinity);
        tOff = offBytes * GiB / (offBw * 1e9); offBound = s.offload.target === 'nvme' ? 'nvme' : 'pcie';
      }
    }
    var tOvh = (E.ovh[0] + E.ovh[1] * m.layers * (s.graphs === false && E.graphs ? 3 : 1)) / 1000;
    var tGpu = Math.max(tMem, tComp), tStep = tGpu + tComm + tP2p + tOff + tOvh;
    var speed = 1 / tStep, thr = seqs * speed;
    var bound = tOff > tGpu + tComm ? offBound : (tComm + tP2p > tGpu ? 'comm' : (tComp > tMem ? 'compute' : 'bandwidth'));
    // first word
    var k = Math.max(1, Math.round(users * num(s.burst, 0.05)));
    var Fpre = prefillFlops(m, P - pre, pre, s.swa !== false);
    var ppEff = pp > 1 ? pp * 0.9 : 1, tfPre = tp * tfPer * 1e12 * ppEff * mfu;
    var tPre = Fpre / tfPre;
    var wFloor = Math.ceil(Math.max(1, P - pre) / chunk) * (Wdense_gpu + Wexp_gpu) * GiB / (tp * bw);
    var prefComm = s.comm !== false && tp > 1 ? 2 * m.layers * Math.ceil(Math.max(1, P - pre) / chunk) * allReduce(chunk * m.hidden * 2, tp, link) : 0;
    var hostLink = nRep * pcie;
    var kvWrite = kvOff ? kvUserRam * (1 - prefixShare) * GiB / (hostLink * 1e9) : 0;
    var wStream = W_off > 0 ? W_off * GiB / (Math.min(hostLink, s.offload.target === 'nvme' ? num(s.nvme, 7) : Infinity) * 1e9) : 0;
    var one = Math.max(tPre, wFloor) + prefComm + kvWrite;
    var ttft1 = one + wStream + num(s.overheadMs, 30) / 1000;
    var ttftK = k * one + wStream + num(s.overheadMs, 30) / 1000;
    // capacity
    var totalTF = T.G * tfPer;
    var computeTF = thr * Fdec / 1e12, share = computeTF / totalTF;
    var free = usableRep - (shared + other);
    var maxSeqs = kvOff ? Infinity : Math.max(0, Math.floor(free / Math.max(1e-9, kvMemPerSeq) + 1e-9)) * T.dp;
    // money and power
    var price = num(s.price, num(g.priceHr, 0)), util = num(s.util, 0.6);
    var power = T.G * num(g.tdpW, g.unified ? 120 : 300) * num(s.powerLoad, 0.8) * (1 + num(s.hostOverhead, 0.15));
    var costHr = T.G * price + power / 1000 * num(s.kwh, 0.12);
    var tokensHr = thr * 3600 * util;
    // server
    var coresRaw = num(s.coresPerGpu, 6) * T.G + num(s.appCores, 8) + (cpuExec ? num(s.offCores, 18) : 0);
    var ramNeed = num(s.appRam, 11) + Math.max(W + other, offBytes);
    var warn = [];
    if (!T.valid) warn.push('TP × PP (' + T.rep + ') is larger than the number of GPUs (' + T.G + ').');
    if (T.idle) warn.push(T.idle + ' GPU(s) left idle: total GPUs is not a multiple of TP × PP.');
    if (S > m.maxCtx) warn.push('The context (' + S.toLocaleString('en-US') + ') is longer than the model supports (' + m.maxCtx.toLocaleString('en-US') + ').');
    if (tp > 1 && m.heads % tp) warn.push('Tensor parallelism needs the attention heads (' + m.heads + ') to divide by TP (' + tp + ').');
    if (tp > T.perNode) warn.push('TP spans several nodes: every layer waits for the network. Keep TP inside a node and use PP across nodes.');
    if (tp > 1 && link.kind.indexOf('PCIe') === 0) warn.push('No NVLink between these ' + tp + ' GPUs: tensor-parallel traffic crosses PCIe (counted).');
    if (E.kv.indexOf(s.kvq) < 0) warn.push(E.l + ' does not offer a ' + kq.l + ' KV cache.');
    if (q.gguf && ['vllm', 'sglang', 'trtllm'].indexOf(engKey) >= 0) warn.push('GGUF formats run best in llama.cpp / Ollama; ' + E.l + ' support is limited.');
    if (s.prec === 'eight' && q.c !== 'fp8' && q.c !== 'int8' && q.c !== 'fp4') warn.push('8-bit compute needs FP8 / INT8 weights and activations (W8A8).');
    if (q.c === 'fp4' && !g.fp4) warn.push((g.name || 'This GPU') + ' has no FP4 tensor cores: the weights are unpacked to 16-bit for compute.');
    if (q.c === 'fp8' && !g.fp8) warn.push((g.name || 'This GPU') + ' has no FP8 tensor cores: FP8 runs as weight-only (W8A16) here.');
    if (off && s.offload.target === 'nvme' && kvOff) warn.push('KV cache on NVMe is far too slow for interactive use.');
    if (kv.parts.some(function (p) { return p.rep > 1; })) warn.push('More GPUs than KV heads on some layers: their KV cache is copied on several GPUs (counted).');
    if (g.unified) warn.push('Unified memory: part of it is used by the OS and apps; lower "usable memory" if needed.');
    return {
      engine: engKey, E: E, T: T, model: m, gpu: g, q: q, kq: kq, users: users, seqs: seqs, Br: Br, S: S, O: O, P: P, pre: pre,
      W: W, W_gpu: W_gpu, W_off: W_off, fW: fW, Ep: Ep, expFrac: expFrac, touched: touched, kv: kv, kvUserGpu: kvUserGpu, kvUserRam: kvUserRam,
      kvOff: kvOff, KV_gpu: KV_gpu, KV_off: KV_off, offBytes: offBytes, fw: fw, graphs: graphs, comm: comm, act: act, other: other,
      shared: shared, llm: llm, used: used, totalRep: totalRep, total: T.G * memGB, usablePerGpu: usablePerGpu, usableRep: usableRep,
      ratio: ratio, fits: fits, eta: eta, mfu: mfu, tfPer: tfPer, Fdec: Fdec, Fcpu: Fcpu, Fpre: Fpre, bytesW: bytesW / GiB, bytesKV: bytesKV / GiB,
      tMem: tMem, tComp: tComp, tOvh: tOvh, tComm: tComm, tP2p: tP2p, tOff: tOff, tRam: tRam, tCpu: tCpu, offBw: offBw, tStep: tStep, link: link,
      speed: speed, thr: thr, bound: bound, cpuExec: cpuExec, k: k, tPre: tPre, wFloor: wFloor, prefComm: prefComm, kvWrite: kvWrite, wStream: wStream,
      ttft1: ttft1, ttftK: ttftK, computeTF: computeTF, totalTF: totalTF, share: share, maxSeqs: maxSeqs,
      price: price, power: power, costHr: costHr, perMTok: tokensHr > 0 ? costHr / tokensHr * 1e6 : Infinity, util: util,
      kwhPerMTok: thr > 0 ? power / 1000 / (thr * 3600) * 1e6 : Infinity,
      coresRaw: coresRaw, cores: roundUp(coresRaw, STD_CPU), ramNeed: ramNeed, ram: roundUp(ramNeed, STD_RAM), warn: warn
    };
  }
  function autoEngine(wq, g) {
    var q = WQ[wq] || {};
    if (g && g.vendor === 'Apple') return 'mlx';
    if (q.gguf) return 'llamacpp';
    if (wq === 'nvfp4') return 'trtllm';
    return 'vllm';
  }
  // smallest single-rig GPU count (1, 2, 4, 8, 16) that fits
  function single(g) { return !!(g.unified || g.segment === 'apple' || g.segment === 'edge'); }
  function minGpus(s, gpu, model) {
    var opts = single(gpu) ? [1] : [1, 2, 4, 8, 16];
    for (var i = 0; i < opts.length; i++) { var r = inference(s, gpu, model, opts[i]); if (r.fits) return { n: opts[i], r: r }; }
    return { n: null, r: inference(s, gpu, model, 16) };
  }
  // every GPU in the catalog: smallest count that fits, speed, first word, cost
  function compareAll(s, gpus, model) {
    return gpus.map(function (g) {
      var x = minGpus(s, g, model), r = x.r;
      return { gpu: g, n: x.n, fits: !!x.n, speed: r.speed, ttft: r.ttftK, thr: r.thr, costHr: x.n ? r.costHr : null, perMTok: x.n ? r.perMTok : null, power: r.power, ratio: r.ratio };
    });
  }

  // ---------- fine-tuning
  function loraParams(m, r, targets) {
    var h = m.hidden, q = m.heads * m.headDim, kvd = m.kvHeads * m.headDim, f = m.moe ? num(m.moe.expertFfn, m.ffn) : m.ffn;
    var per = r * ((h + q) + 2 * (h + kvd) + (q + h));
    if (targets === 'all') per += r * 3 * (h + f) * (m.moe ? num(m.moe.active, 1) + num(m.moe.shared, 0) : 1);
    return m.layers * per / 1e9;
  }
  function finetune(s, gpu, model) {
    var m = normModel(model), g = gpu, T = topology(s), G = T.G;
    var method = s.method || 'lora', prec = s.ftPrec || 'mixed', O = OPTIM[s.optim] || OPTIM.adamw;
    var N = m.params, b = Math.max(1, Math.round(s.ftBatch || 1)), S = Math.max(16, Math.round(s.ftSeq || 2048)), ga = Math.max(1, Math.round(s.gradAccum || 1));
    var lora = method === 'full' ? 0 : loraParams(m, Math.max(1, s.loraR || 16), s.loraTargets || 'all');
    var trainable = method === 'full' ? N : lora;
    var pk = prec === 'fp32' ? 'fp32' : (prec === 'pure' ? 'pure' : 'mixed');
    var wB = method === 'qlora' ? null : (pk === 'fp32' ? 4 : 2);
    var weights = method === 'qlora' ? weightsGiB(m, { b: 4.13, keep16: true }, true) : N * 1e9 * (method === 'full' ? wB : 2) / GiB;
    var adapter = method === 'full' ? 0 : lora * 1e9 * 2 / GiB;
    var grads = trainable * 1e9 * (pk === 'fp32' ? 4 : 2) / GiB;
    var optim = trainable * 1e9 * O[pk] / GiB;
    var shard = s.zero || 'none';
    if (shard === 'zero1' || shard === 'zero2' || shard === 'zero3') optim /= G;
    if (shard === 'zero2' || shard === 'zero3') grads /= G;
    if (shard === 'zero3') { weights /= G; adapter /= G; }
    var h = m.hidden, kvd = m.kvHeads * m.headDim, f = m.moe ? num(m.moe.expertFfn, m.ffn) * num(m.moe.active, 2) + num(m.moe.sharedFfn, num(m.moe.expertFfn, m.ffn)) * num(m.moe.shared, 0) : m.ffn;
    var perTokLayer = 2 * (7 * h + 2 * kvd + 4 * f) + (s.flash === false ? 5 * m.heads * S : 0);
    var tokens = b * S;
    var act = s.ckpt !== false ? (m.layers * tokens * 2 * h + tokens * perTokLayer) / GiB : m.layers * tokens * perTokLayer / GiB;
    var logits = s.fused ? tokens * h * 4 / GiB : tokens * m.vocab * 6 / GiB;
    var temp = 0.5 + (method === 'full' ? Math.min(4, trainable * 1e9 * 2 / GiB * 0.05) : 0.2);
    var frame = 1.5;
    var offRam = 0, offList = s.ftOff || {};
    if (s.ftOffOn) {
      if (offList.optim) { offRam += optim * G; optim = 0; }
      if (offList.grads) { offRam += grads * G; grads = 0; }
      if (offList.weights) { offRam += weights * (shard === 'zero3' ? G : 1); weights = 0; }
      if (offList.act) { offRam += act * 0.8 * G; act *= 0.2; }
    }
    var perGpu = weights + adapter + grads + optim + act + logits + temp + frame;
    var usablePerGpu = num(g.memGB, 24) * num(s.usable, 0.9);
    var fits = perGpu <= usablePerGpu + 1e-9;
    // speed
    var Fbase = (method === 'full' ? 6 : 4) * m.activeParams * 1e9 + 3 * 4 * attnDim(m) * attnLayers(m) * S / 2;
    if (s.ckpt !== false) Fbase += 2 * m.activeParams * 1e9;
    var mfu = num(s.ftMfu, method === 'full' ? 0.4 : (method === 'lora' ? 0.35 : 0.28));
    if (s.flash === false) mfu *= 0.8;
    if (s.fused) mfu *= 1.05;
    if (s.pure16 && method === 'full') mfu *= 1.03;
    var tf = num(g.fp16, 100) * 1e12;
    var tokS = G * tf * mfu / Fbase;
    var useful = s.packing ? 0.98 : (s.dynPad ? 0.85 : Math.min(1, num(s.tokPerSample, S) / S));
    var tokPerStep = b * S * ga * G;
    var steps = Math.ceil(num(s.samples, 10000) * num(s.tokPerSample, 1024) * num(s.epochs, 1) / (tokPerStep * useful));
    var stepCompute = tokPerStep / tokS;
    var pcie = hostLinkGBs(g), stepOff = 0;
    if (s.ftOffOn && offList.optim) stepOff += trainable * 1e9 * 4 / (pcie * 1e9) + trainable * 1e9 / 1.5e9 / Math.max(1, G);
    if (s.ftOffOn && offList.weights) stepOff += ga * 2 * N * 1e9 * 2 / (pcie * 1e9);
    var stepTime = stepCompute + stepOff, time = steps * stepTime;
    var totalTokens = num(s.samples, 10000) * num(s.tokPerSample, 1024) * num(s.epochs, 1);
    var price = num(s.price, num(g.priceHr, 0));
    var power = G * num(g.tdpW, g.unified ? 120 : 300) * 0.9 * (1 + num(s.hostOverhead, 0.15));
    var warn = [];
    if (method === 'qlora' && G > 1 && shard === 'zero3') warn.push('QLoRA with ZeRO-3 / FSDP needs a recent bitsandbytes + accelerate stack.');
    if (method === 'full' && O === OPTIM.paged8) warn.push('Paged optimizers mostly help when GPU memory spikes; states still live in GPU memory between spikes.');
    if (!s.fused && m.vocab >= 150000) warn.push('Large vocabulary: the loss logits need ' + (tokens * m.vocab * 6 / GiB).toFixed(1) + ' GB. Turn on fused kernels (chunked cross-entropy, e.g. Liger) to remove most of it.');
    if (S > m.maxCtx) warn.push('The sequence is longer than the model supports.');
    if (!fits && G > 1 && shard !== 'zero3') warn.push('With ' + (shard === 'none' ? 'plain data parallel (DDP)' : shard.toUpperCase()) + ' every GPU keeps a full copy of the weights: choose ZeRO-3 / FSDP to split them across the ' + G + ' GPUs.');
    return {
      model: m, gpu: g, T: T, G: G, method: method, trainable: trainable, lora: lora, weights: weights, adapter: adapter, grads: grads, optim: optim,
      act: act, logits: logits, temp: temp, frame: frame, perGpu: perGpu, usablePerGpu: usablePerGpu, ratio: perGpu / usablePerGpu, fits: fits,
      offRam: offRam, Fbase: Fbase, mfu: mfu, tokS: tokS * useful, rawTokS: tokS, useful: useful, steps: steps, stepTime: stepTime, time: time,
      totalTokens: totalTokens, price: price, cost: time / 3600 * (G * price + power / 1000 * num(s.kwh, 0.12)), power: power, warn: warn
    };
  }

  // ---------- RAG / agent companion models (embeddings, rerankers, parsers, speech, guardrails...)
  var TASKS = {
    embedding: { l: 'Embeddings' }, reranker: { l: 'Reranker' }, parser: { l: 'Document parsing / OCR' }, asr: { l: 'Speech-to-text' },
    tts: { l: 'Text-to-speech' }, guard: { l: 'Guardrails' }, vlm: { l: 'Vision' }, ner: { l: 'NER / PII' }, router: { l: 'Router / tool calling' }
  };
  var CPREC = { fp32: 4, fp16: 2, bf16: 2, int8: 1, fp8: 1, int4: 0.5 };
  var CDEF = { embedding: { qTok: 64, chunkTok: 512 }, reranker: { k: 20, pTok: 384, qTok: 64 }, parser: { pages: 10000, par: 8 },
    asr: { streams: 4 }, tts: { streams: 4 }, guard: { checks: 2, tok: 512 }, vlm: { tok: 1500, out: 300 }, ner: { tok: 512 }, router: { tok: 1024, out: 32 } };
  function companion(c, it, g, ctx) {
    var api = !!c.api || c.arch === 'api';
    var place = api ? 'api' : (it.place || 'gpu');
    var prec = it.prec || c.defaultPrecision || 'fp16', bytes = CPREC[prec] || 2;
    var N = num(c.params, 0) * 1e9, L = num(c.layers, 24), d = num(c.hidden, 1024);
    var heads = num(c.heads, 16), kvh = num(c.kvHeads, heads), hd = num(c.headDim, d / heads);
    var dec = c.arch === 'decoder' || c.arch === 'vlm' || c.arch === 'encoder-decoder';
    var D = Object.assign({}, CDEF[c.task] || {}, it);
    var W = api ? 0 : (c.arch === 'pipeline' && !N ? num(c.vramGB, 1.5) : N * bytes / GiB);
    var onCpu = place === 'cpu';
    var tf = onCpu ? num(ctx.cpuTflops, 8) * 1e12 : num(g.fp16, 100) * 1e12;
    var bw = onCpu ? num(ctx.ramBw, 300) * 1e9 * 0.6 : num(g.bwGBs, 500) * 1e9 * num(ctx.eta, 0.55);
    var mfu = 0.35, kvTok = dec ? 2 * L * kvh * hd * 2 : 0, wRead = W * GiB / bw, stepOvh = (1 + 0.012 * L) / 1000;
    function fl(tok) { return 2 * N * tok + 4 * L * d * tok * tok; }
    var over = api ? 0 : (dec ? 1.0 : 0.4), act = api ? 0 : (dec ? 0.3 : 16384 * d * 2 * 10 / GiB), kv = 0;
    var r = { c: c, it: it, place: place, prec: prec, W: W, metrics: [], latency: 0, gpuSecPerReq: 0, share: 0, cost: null, warn: null };
    var task = c.task;
    if (api) {
      var price = c.api.pricePer1kPages != null ? c.api.pricePer1kPages : c.api.price, unit = (c.api.priceUnit || '').toLowerCase();
      if (task === 'parser' && price != null) { r.cost = num(D.pages, 10000) / 1000 * price; r.metrics.push('$' + price + ' per 1,000 pages → $' + Math.round(r.cost).toLocaleString('en-US') + ' for ' + num(D.pages, 10000).toLocaleString('en-US') + ' pages'); }
      else if (task === 'reranker' && price != null) {
        var perQ = unit.indexOf('token') >= 0 ? price * num(D.k, 20) * (num(D.qTok, 64) + num(D.pTok, 384)) / 1e6 : price / 1000;
        r.perQ = perQ; r.latency = 0.25;
        r.metrics.push('$' + price + ' ' + (c.api.priceUnit || '').replace(/^USD /, '') + ' → ≈ $' + (perQ * 1000).toFixed(2) + ' per 1,000 questions');
        r.metrics.push('≈ 250 ms per call over the network (estimate)');
      }
      else if (price != null) r.metrics.push('$' + price + ' ' + (c.api.priceUnit || 'per 1,000 calls').replace(/^USD /, ''));
      r.metrics.push(c.api.dataLeaves === false ? 'Can run in your own cloud' : 'Documents leave your servers');
      if (c.api.selfHost) r.metrics.push('Self-hosting: ' + c.api.selfHost);
    } else if (task === 'embedding' || task === 'ner') {
      var q = num(D.qTok, 64), ch = num(D.chunkTok, 512);
      r.latency = Math.max(wRead, fl(q) / (tf * mfu)) + 0.002;
      r.gpuSecPerReq = fl(q) / (tf * mfu);
      var tokS = tf * mfu / (2 * N + 4 * L * d * ch);
      r.metrics.push((task === 'ner' ? 'Text of ' + q + ' tokens' : 'Query') + ' in ' + Math.max(1, Math.round(r.latency * 1000)) + ' ms');
      if (task === 'embedding') { var cps = tokS / ch; r.metrics.push('Indexing ≈ ' + (cps < 10 ? cps.toFixed(1) : Math.round(cps).toLocaleString('en-US')) + ' chunks/s of ' + ch + ' tokens'); }
    } else if (task === 'reranker' && !dec) {
      var k = num(D.k, 20), pair = num(D.qTok, 64) + num(D.pTok, 384);
      r.gpuSecPerReq = k * fl(pair) / (tf * mfu);
      r.latency = r.gpuSecPerReq + wRead + 0.003;
      r.metrics.push('Top ' + k + ' passages in ' + Math.round(r.latency * 1000) + ' ms');
      r.metrics.push('≈ ' + Math.round(tf * mfu / fl(pair)).toLocaleString('en-US') + ' pairs/s');
    } else if (task === 'reranker') {
      var k2 = num(D.k, 20), pair2 = num(D.qTok, 64) + num(D.pTok, 384);
      r.gpuSecPerReq = k2 * fl(pair2) / (tf * 0.4);
      r.latency = r.gpuSecPerReq + wRead + 0.005; kv = Math.min(k2, 32) * pair2 * kvTok / GiB;
      r.metrics.push('Top ' + k2 + ' passages in ' + Math.round(r.latency * 1000) + ' ms (LLM reranker)');
    } else if (task === 'parser') {
      var pages = num(D.pages, 10000), par = Math.max(1, num(D.par, 8));
      var sp;
      if (c.arch === 'pipeline' || !dec) {
        sp = num(c.secPerPage, 1.0);
        var hw = c.secPerPageHw || '';
        r.metrics.push('≈ ' + sp.toFixed(2) + ' s per page' + (hw ? ' (published: ' + hw.split('(')[0].trim() + ')' : ' (estimate)') + (onCpu && !/cpu/i.test(hw) ? ', slower on CPU' : ''));
      } else {
        var vis = num(c.visualTokensPerPage, 1200), out = num(c.outTokensPerPage, 800);
        kv = par * (vis + out) * kvTok / GiB;
        var pre = par * fl(vis) / (tf * 0.4), step = (W * GiB + par * (vis + out / 2) * kvTok) / bw + stepOvh;
        sp = (pre + out * step) / par;
        r.metrics.push('≈ ' + (sp * par).toFixed(1) + ' s per page with ' + par + ' in parallel');
      }
      var pph = 3600 / sp;
      r.metrics.push('≈ ' + Math.round(pph).toLocaleString('en-US') + ' pages/hour → ' + pages.toLocaleString('en-US') + ' pages in ' + (pages / pph < 1 ? Math.round(pages / pph * 60) + ' min' : (pages / pph).toFixed(1) + ' h'));
    } else if (task === 'asr' || task === 'tts') {
      var rtfx, streams = Math.max(0, num(D.streams, 4)), tokC = 2 * N / (tf * mfu), est = false;
      // autoregressive decoders share one weight read per step across streams: ASR ≈ 4 text tokens + 25 audio tokens per second, TTS ≈ 75 audio tokens per second
      var steps = task === 'asr' ? 4 : 75, preTok = task === 'asr' ? 25 : 0;
      if (task === 'asr' && c.rtfxA100) rtfx = c.rtfxA100 * (onCpu ? 0.02 : num(g.fp16, 312) / 312);
      else if (c.rtfx) rtfx = c.rtfx * (onCpu ? 0.05 : 1);
      else if (dec) { rtfx = 1 / (steps * (wRead + tokC + stepOvh) + preTok * tokC); est = true; }
      else { rtfx = onCpu ? 5 : 60; est = true; }
      r.share = dec && est ? steps * (wRead + stepOvh + streams * tokC) + streams * preTok * tokC : streams / Math.max(0.01, rtfx);
      r.metrics.push('× ' + (rtfx >= 10 ? Math.round(rtfx) : rtfx.toFixed(1)) + ' real time' + (est ? ' (estimate)' : ''));
      r.metrics.push(streams + ' live ' + (task === 'asr' ? 'stream' : 'voice') + (streams === 1 ? '' : 's') + ' use ≈ ' + Math.round(r.share * 100) + '% of a GPU');
      if (task === 'asr') r.metrics.push('1 hour of audio in ≈ ' + Math.max(1, Math.round(3600 / rtfx)) + ' s');
      if (r.share > 0.8) r.warn = streams + ' live streams need ' + Math.round(r.share * 100) + '% of a GPU.';
      act = 0.5;
    } else {
      var tok = num(D.tok, 512), outT = task === 'guard' ? 5 : num(D.out, 32);
      var one = fl(tok) / (tf * 0.4) + outT * (wRead + stepOvh) + 0.004;
      var checks = task === 'guard' ? Math.max(0, num(D.checks, 2)) : 1;
      r.latency = task === 'guard' ? one : one; r.gpuSecPerReq = checks * fl(tok) / (tf * 0.4);
      kv = 8 * (tok + outT) * kvTok / GiB;
      r.metrics.push((task === 'guard' ? 'Check' : 'Call') + ' of ' + tok + ' tokens in ' + Math.round(one * 1000) + ' ms' + (task === 'guard' ? ' · ' + checks + ' per question' : ''));
    }
    r.mem = api ? 0 : W + over + act + kv;
    r.gpuMem = place === 'gpu' ? r.mem : 0;
    r.ram = onCpu ? r.mem + 0.5 : 0;
    return r;
  }
  // whole stack: per-model results, GPU / RAM totals, retrieval latency per question and GPU load from questions
  function stack(items, index, g, ctx) {
    var rows = [], gpuMem = 0, ram = 0, cost = 0, emb = 0, rr = 0, guardIn = 0, gpuSec = 0, share = 0, perQ = 0;
    (items || []).forEach(function (it) {
      var c = index[it.id]; if (!c) return;
      var r = companion(c, it, g, ctx); rows.push(r);
      gpuMem += r.gpuMem; ram += r.ram; if (r.cost) cost += r.cost; if (r.perQ) perQ += r.perQ;
      if (c.task === 'embedding' && !emb && r.place !== 'api') emb = r.latency;
      if (c.task === 'reranker' && !rr) rr = r.latency;
      if (c.task === 'guard' && !guardIn && r.place !== 'api') guardIn = r.latency;
      if (r.place === 'gpu') { gpuSec += r.gpuSecPerReq; share += r.share; }
    });
    var qps = num(ctx.users, 1) * num(ctx.qpm, 1) / 60;
    var load = (gpuSec * qps + share) / Math.max(1, num(ctx.G, 1));
    var search = emb || rr ? num(ctx.searchMs, 15) / 1000 : 0;
    return { rows: rows, gpuMem: gpuMem, ram: ram, cost: cost, perQ: perQ, emb: emb, search: search, rr: rr, guard: guardIn, retrieval: emb + search + rr + guardIn, load: load, qps: qps };
  }

  var api = { GiB: GiB, WQ: WQ, KQ: KQ, ENGINES: ENGINES, NETS: NETS, HOSTS: HOSTS, OPTIM: OPTIM, PCIE: PCIE,
              normModel: normModel, weightsGiB: weightsGiB, kvSeq: kvSeq, decodeFlops: decodeFlops, prefillFlops: prefillFlops, expertParams: expertParams,
              loraParams: loraParams, topology: topology, single: single, TASKS: TASKS, CPREC: CPREC, CDEF: CDEF, companion: companion, stack: stack, roundUp: roundUp, STD_RAM: STD_RAM, inference: inference, minGpus: minGpus, compareAll: compareAll, finetune: finetune, autoEngine: autoEngine };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.LLMCalc = api;
})(this);
