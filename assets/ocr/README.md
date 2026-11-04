# Local English OCR language data

`eng.traineddata.gz` comes from `@tesseract.js-data/eng@1.0.0`, specifically
`4.0.0_best_int/eng.traineddata.gz`. It is the integerized English Tessdata Best
model for Tesseract LSTM-only OCR.

The npm wrapper metadata declares MIT; the model itself is byte-identical to
[naptha/tessdata at commit 806cd9adc8c6e8abc11c782db1818c990576bebc](https://github.com/naptha/tessdata/blob/806cd9adc8c6e8abc11c782db1818c990576bebc/4.0.0_best_int/eng.traineddata.gz),
whose upstream license is Apache-2.0, preserved in `LICENSE-tessdata.txt`.
The wrapper contains no license text; that metadata is not represented as a
license grant for the model.

SHA-256: `45b4cb346724ac1774f1c36f42f182b887bcdb28ebe63e6fff90ac41f3fcff91`.
The npm tarball integrity was checked before extraction; complete archive
origins and SHA-512 values are in `../../vendor/ocr/integrity.json`.

VIN photos are processed locally in the browser. The image is not sent to
Tesseract, NHTSA or any external image service.
