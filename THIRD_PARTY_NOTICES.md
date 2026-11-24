# Tredjepartskomponenter och data

## Programvara och modell

**BioCLIP** (Imageomics Institute). Modellvikterna för bildkodaren finns konverterade till int8-ONNX i
`app/model/bioclip_visual_int8.onnx`. Licens: MIT. Källa: <https://huggingface.co/imageomics/bioclip>.
Stevens, S. et al. (2024). *BioCLIP: A Vision Foundation Model for the Tree of Life.* CVPR 2024.

**onnxruntime-web 1.30.0** (Microsoft) i `app/vendor/`. Licens: MIT. Källa: <https://github.com/microsoft/onnxruntime>.

MIT-licensen (gäller båda komponenterna ovan, med respektive upphovsrättsinnehavare):

> Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
> documentation files (the "Software"), to deal in the Software without restriction, including without limitation
> the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
> permit persons to whom the Software is furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all copies or substantial portions of
> the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE
> WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
> COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
> OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## Data

- **Rödlistan 2025** och **Dyntaxa**: SLU Artdatabanken, CC0, via GBIF.
- **Skyddsklassade arter**: SLU Artdatabanken. Källor är "List of Restricted Access Species In Sweden" (CC0, via GBIF
  Sverige) och "Nationellt skyddsklassade arter" (2023-06-12, uppdaterad 2024-04-25).
- **Signalarter**: Skogsstyrelsen (2023). *Komplett förteckning över Skogsstyrelsens signalarter, version 2023-1.*
  Listan har importerats maskinellt till `tools/signalarter_2023_1.csv` med angiven källa.
- **GBIF Backbone Taxonomy**: engelska namn och klassificering för modellens textbeskrivningar.
