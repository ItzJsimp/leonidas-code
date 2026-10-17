# Images page: backend asks

The redesigned Images page (Create, Models, Gallery, Setup) runs on a mock in `apps/web/src/components/images/useImagesCatalog.ts`. The server replaces the body of that hook. The return shape stays the same. The proposed types are in `packages/contracts/src/images.ts` (`ImageCatalogModel`, `ImageHardwareFit`, `ImageGenerateSettings`).

## Asks

1. **Catalog as data.** Send `ImageCatalogModel[]` in the live state: id, label, family, files with sizes, licence fields, tags, speed tier, defaults, ranges and samplers. Replace the hard-coded `COMFY_MODEL_IDS` and `imageModels.ts`. Each model needs a workflow template.
2. **Install state.** Check model files against ComfyUI (`/object_info` loader lists; verify the routes on a live server). Send `state` (not-installed, installing, ready, broken) and `installProgress` from 0 to 1.
3. **Install action.** Download files into the ComfyUI model folders. Check free disk space first with `hardwareWatch/localModelCapacity.ts`. Send progress. Allow cancel.
4. **Hardware fit.** Send `ImageHardwareFit` (card name, graphics memory, memory, free disk). Use `localModelCapacity.ts` and ComfyUI `/system_stats`. Compute `fit` and `fitReason` on the server with the same rule as `computeFit` in `catalog.logic.ts`.
5. **Measured time.** Read `seconds` from the Recipe files and send `measuredSeconds` and `measuredRuns` per model for this PC. Send `estimatedSeconds` and `loadSeconds` when no run exists.
6. **Generate settings.** Accept `ImageGenerateSettings` in `ImagesGenerateInput`: width, height, steps, guidance, negative prompt, sampler. Clamp each value to the range of each model. Write all values in the Recipe.
7. **Gallery fields.** Send width, height, steps, guidance, sampler and negative prompt on each `ImageItem`, from the Recipe. Keep `jobId` for run groups. Add a `benchmark` flag.
8. **Delete.** New `images.delete` command: remove the PNG, its Recipe and any kept copy.
9. **Open folder.** New command to open the images folder of the project in the file manager (desktop only).
10. **Queue order.** Order the queue by model inside one run, so each model loads once. Check `expandVariations` in `ImagesEngine.ts`.
11. **Re-check connection.** New `images.recheck` command, so Setup can check ComfyUI on demand.
12. **Licence data.** A person must check each licence on the official model card. Store `licenceName`, `licenceUrl`, `commercialUse` and `licenceVerifiedOn`. Until then, the page shows a neutral "Check licence".
13. **Scratch folder.** Let a run work with no project: a default Scratch folder (audit finding 16). The mock has no project picker.
14. **Benchmark run.** Optional server preset for the 6 fixed prompts (`BENCHMARK_PROMPTS` in `images.mock.ts`), seed 1234, on each ready model.
