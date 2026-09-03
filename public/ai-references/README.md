# Vehicle layout references

Each reference is the raw texture for its exact vehicle variant, selected from this project's public gallery in descending download order. Metadata and source URLs are pinned in `shared/wrapGeneration.js`. The Model 3 (2024 Base) selection dates to 2026-09-02; the other seven selections date to 2026-09-03.

Model S (2021+), Model S Plaid (2025+), and Model X (2021+) each had 24 matching entries, all with zero downloads. Their tied, first-listed `Vintage Stripes` textures are used as layout examples; they are not presented as popular downloads.

Model S, S Plaid, Model X, and Cybertruck templates in `public/assets/` were downloaded from Tesla's `teslamotors/custom-wraps` repository on 2026-09-03:

- https://github.com/teslamotors/custom-wraps/blob/master/models-2021/template.png
- https://github.com/teslamotors/custom-wraps/blob/master/models-2025-plaid/template.png
- https://github.com/teslamotors/custom-wraps/blob/master/modelx-2021/template.png
- https://github.com/teslamotors/custom-wraps/blob/master/cybertruck/template.png

Cybertruck's source template is 1024 × 768. `loadGenerationTemplate` scales the complete sheet to 1024 × 1024 before generation, matching the editor's square UV mapping. No crop or padding is applied. The other seven templates are already 1024 × 1024. Model X uses an outlined template, so its prompt explicitly identifies the central roof/window opening and background as reserved space.

The input order is: vehicle template, optional matching layout example, then user-uploaded style references. Layout examples teach placement and orientation; user images supply the design style. Neither may override the template geometry.
