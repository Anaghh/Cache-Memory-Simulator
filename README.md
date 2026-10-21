# Cache Memory Simulator · Cache Lab

A browser-based learning lab aligned with the six supplied Advanced Computer Architecture units. It extends the original cache visualizer into five labs, with explicit boundaries between executable models and explanatory material.

## Labs

| Lab | Working features |
| --- | --- |
| Cache & writes | Direct, set-associative, fully associative mapping; unified or split I/D banks; LRU, FIFO, LFU, Random, MRU, Optimal, tree PLRU, ARC; byte values, dirty bits, write-through/write-back and write-allocate/write-around; memory traffic; access snapshots; policy comparison |
| L1 / L2 / L3 | One to three cache levels, configurable sizes and serial probe latencies, per-level mapping/replacement shared across levels, read traces, local/global miss rates, measured AMAT |
| TLB & paging | Fully associative LRU/FIFO TLB, editable resident page table, 4/8 KB pages, page/frame/offset translation, TLB misses vs page faults |
| BTB & multicore | Direct-mapped branch target buffer with direction counters; two-core clean-copy sharing, write invalidation, and false sharing |
| Syllabus guide | Coverage by unit/slide, worked experiments, GPU cache/access-path distinctions, consistency model reference, and model limitations |

## Run

Open `index.html` directly, or serve the repository:

```sh
python -m http.server 8000
```

Visit http://localhost:8000. There are no npm dependencies or build steps. Optional Google Fonts fall back to system fonts when offline.

## Trace syntax

```text
0, 8, 0, 32             # bare decimal/hex addresses mean reads
R:0, W:8=42, I:0x10     # read, write one byte, instruction fetch
```

The `#` comments above are documentation only, not accepted trace syntax. Separate accesses with commas, spaces, semicolons, or newlines. Addresses are 16-bit (0–65535); values are bytes (0–255). A write with no value stores 1. A trace may contain at most 256 operations.

BTB traces use `PC:target:T` or `PC:target:N`, for example `0:64:T, 0:64:T, 0:64:N`. The BTB has four direct-mapped entries indexed by `(PC / 4) % 4`; addresses are 4-byte aligned. A target hit and a correct next-PC prediction are separate metrics.

Coherence traces use `core:R:address` or `core:W:address=value`, for example `0:R:0, 1:R:0, 0:W:0=7`.

## Verify

With Node.js 18 or later:

```sh
node tests/engine.test.cjs
# or
npm test
```

Twenty test groups cover parsing, known mapping results, policy-specific eviction, ARC resident/ghost invariants, tree PLRU, all write-policy pairings, dirty byte persistence, geometry invariants across every policy, split banks, multilevel timing, TLB faults/replacement, BTB predictions, coherence, and immutable history snapshots.

## Model details

- All caches start empty. RAM byte values start at zero. Operations access a single byte; no operation crosses a block boundary.
- Capacities are intentionally small teaching examples, not real CPU specifications. Selected size is per bank; split I/D doubles the selected total capacity.
- LFU counts reset on insertion and ties use LRU. Random uses a deterministic LCG with seed 42. Tree PLRU uses `ways - 1` binary-tree bits per set. ARC uses resident lists T1/T2 and ghost lists B1/B2, independently per set.
- Optimal uses future trace knowledge and is a hit-rate benchmark for read-only demand caching, not a dirty-write-cost optimizer. It is unavailable in the multilevel lab, whose lower-level reference streams differ from the CPU trace.
- Write-through/write-around transactions transfer one byte. Dirty write-back eviction transfers a complete block. Remaining dirty lines are not automatically flushed at trace end. Reset discards state.
- Split instruction/data banks are not automatically coherent for self-modifying code. Use separate instruction and data regions for organization experiments.
- Miss categories use a fully associative LRU shadow cache of equal capacity. “Conflict / policy” includes replacement or allocation effects; categories are diagnostic outside ordinary read-only LRU demand caching.
- The hierarchy is read-only, serial, and non-inclusive/non-exclusive. Missed upper levels are filled; lower eviction does not invalidate an upper line. No inclusion or exclusivity invariant is enforced.
- Timing adds the probe latencies of visited levels, plus RAM latency on a full miss. `AMAT = total demand latency / CPU accesses`. Local miss rate divides by level accesses; global miss rate divides by CPU accesses.
- TLB page faults stop translation for that access. OS page loading, ASIDs, permissions, and page-table walk timing are not simulated.
- BTB counters are 2-bit saturating counters, 0–1 predict not taken, 2–3 taken. Misses predict PC+4. A new entry starts at 2 after taken, 1 after not taken. The direction model is an educational extension to the syllabus BTB concept.
- Coherence is a simplified serialized write-through/write-invalidate model with unbounded two-core caches and 8-byte blocks. Clean copy labels are not a full MESI/MOESI protocol. It does not model relaxed/weak/release consistency outcomes.
- GPU constant, texture/read-only paths, shared memory, consistency models, and emerging memory technologies are explained in the guide. The app does not emulate a GPU, model texture filtering/broadcast, or simulate physical memory technologies.

## Syllabus coverage

| Source | Relevant material |
| --- | --- |
| Unit 1 · Processor Performance and Pipelined Architectures | Cache hit rate and performance factors, slides 15, 27, 29 |
| Unit 2 · Instruction-Level Parallelism and Superscalar Architectures | BTB, slide 28 |
| Unit 3 · Memory Hierarchy and Advanced Memory Systems | Organization/mapping 17–32; replacement 33–37; writes 38–41; multilevel/metrics 42–49; VM/TLB 50–61; consistency 62–72; emerging memory 73–78 |
| Unit 4 · Multicore and Parallel Architectures | Shared resources, coherence and locality, slides 9, 15, 17–18, 25, 44 |
| Unit 5 · GPU and Heterogeneous Computing Architectures | Cache/shared-memory resources and specialized GPU paths, slides 16, 31 |
| Unit 6 · Emerging Trends in Computer Architecture | Caches/buffers and reduced AI data movement, slides 5, 28 |

The user-supplied decks are not redistributed in this repository. The guide uses original summaries and experiment instructions.

Algorithm references: [ARC, FAST 2003](https://www.usenix.org/conference/fast-03/arc-self-tuning-low-overhead-replacement-cache), [gem5 tree PLRU](https://doxygen.gem5.org/develop/tree__plru__rp_8cc_source.html).

## Files

- `index.html`: lab interfaces
- `style.css`: responsive styling
- `engine.js`: simulation models, also exported for Node.js
- `app.js`: controls, state rendering, and comparison
- `guide.js`: syllabus coverage and learning notes
- `tests/engine.test.cjs`: simulation regression tests

The hosted Site source keeps static assets under `dist/`; this GitHub repository exposes the same files at its root for direct opening and simple static hosting. The test runner supports either layout.
