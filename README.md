# Cache Memory Simulator

Interactive browser-based cache simulator for learning computer architecture.

## Features

- Direct-mapped, set-associative, and fully associative caches
- Configurable cache size, block size, and associativity
- LRU and FIFO replacement policies
- Decimal and hexadecimal address sequences
- Step, run, pause, reset, and inspect earlier accesses
- Hit/miss statistics and tag/index/offset address breakdown
- Locality, conflict, and sequential-access examples
- Responsive interface

## Run locally

Open `index.html` in a browser, or serve this directory:

```sh
python -m http.server 8000
```

Then visit http://localhost:8000.

No build step or npm dependencies are required. Google Fonts are optional; system font fallbacks are included.

## Model

Uses 16-bit byte addresses and read accesses with an initially empty cache. Each miss loads a complete block. There is no write policy, multilevel cache, or timing model.

## Files

- `index.html`: interface
- `style.css`: styling and responsive layouts
- `engine.js`: cache simulation logic (also exports a Node.js-compatible class)
- `app.js`: controls, rendering, and access history
