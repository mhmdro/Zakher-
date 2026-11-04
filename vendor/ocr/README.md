# Browser-local VIN OCR runtime

Pinned components:

- `tesseract.js@6.0.1`: `dist/tesseract.esm.min.js`, `dist/worker.min.js`.
- `tesseract.js-core@6.0.0`: non-SIMD `tesseract-core-lstm.js` and
  `tesseract-core-lstm.wasm`. These are kept together so the worker can resolve
  the wasm file under a repository subpath such as `/Zakher-/`.
- `@tesseract.js-data/eng@1.0.0`: the LSTM English integer model, vendored
  separately in `../../assets/ocr/`.

Both JavaScript and core packages use Apache-2.0. Original license files and
bundled third-party notices are retained alongside the runtime files. Model
license/provenance details are in `../../assets/ocr/README.md`.

Packages were downloaded from the official npm registry using the configured
HTTPS proxy with TLS verification, and their full SHA-512 tarball integrity
was compared with registry metadata before extraction. `integrity.json` records
those origins plus exact SHA-256 and byte counts for the copied files.

`vin.js` imports the local ESM default export and creates a worker with local
`workerPath`, `corePath` and `langPath`, `workerBlobURL: false`, `gzip: true`,
`cacheMethod: 'none'`, and LSTM-only engine mode. No CDN is used at runtime.
Only English/Latin text is recognized; ambiguous I/O/Q readings are not silently
replaced with 1/0. Image input is limited to JPEG/PNG/WebP up to 20 MiB.

The optional NHTSA vPIC lookup is a separate operation that sends only the
reviewed VIN string to `https://vpic.nhtsa.dot.gov`. OCR image data stays local.

A synthetic clear VIN image was tested in desktop Chromium. This does not
establish recognition accuracy for real camera photographs or Safari/iPhone.
