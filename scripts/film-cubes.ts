// Dev only: write every film's color stage as a .cube LUT (Photoshop, Resolve,
// ffmpeg lut3d) so store shots and tuning can use the exact app colors.
// node --experimental-strip-types scripts/film-cubes.ts [outdir=store/luts]
// e.g. ffmpeg -i in.jpg -vf lut3d=store/luts/grey-portra.cube out.jpg
// (color only: halation, grain, leak and vignette are added by the shader)

import { mkdirSync, writeFileSync } from 'node:fs';
import { FILM_NAMES, type FilmId } from '../src/lib/film.ts';
import { LOOKS } from '../src/lib/looks.ts';
import { toCube } from '../src/lib/lut.ts';

const out = process.argv[2] ?? 'store/luts';
mkdirSync(out, { recursive: true });
for (const id of Object.keys(LOOKS) as FilmId[]) writeFileSync(`${out}/${id}.cube`, toCube(LOOKS[id], `ROLLCAM ${FILM_NAMES[id]}`));
console.log(`${Object.keys(LOOKS).length} cubes -> ${out}`);
