// The film book's sample print: one bundled street photo (Bukchon: sky,
// autumn red, greens, people) developed with a film's own look on the phone,
// so a film you haven't caught yet can still be seen. Developed small (it is
// shown at card size) and cached per look in the cache dir; retuning a film
// makes a new one. Requests wait in one lane; the film sheet's jumps ahead
// of the film book's faint slots.

import { Skia, loadData, type SkImage } from '@shopify/react-native-skia';
import { File, Paths } from 'expo-file-system';
import { useEffect, useState } from 'react';
import { develop } from './develop';
import type { FilmId } from './film';
import { LOOKS } from './looks';
import { hash } from './lutStore';

const SAMPLE = require('../../assets/samples/film-sample.jpg');
// a fixed date and seed so the grain never changes between opens
const DAY = new Date(2026, 10, 2, 12);
const SMALL_W = 240;
const SMALL_H = 360;

let source: Promise<SkImage | null> | null = null;

/** The bundled photo scaled down once to card size; a failed load is tried again next time. */
function sampleImage(): Promise<SkImage | null> {
  source ??= loadData(SAMPLE, (d) => Skia.Image.MakeImageFromEncoded(d))
    .then((img) => {
      if (!img) return null;
      const surface = Skia.Surface.MakeOffscreen(SMALL_W, SMALL_H);
      if (!surface) return null;
      surface.getCanvas().drawImageRect(img, Skia.XYWHRect(0, 0, img.width(), img.height()), Skia.XYWHRect(0, 0, SMALL_W, SMALL_H), Skia.Paint());
      surface.flush();
      return surface.makeImageSnapshot().makeNonTextureImage();
    })
    .then((img) => {
      if (!img) source = null;
      return img;
    })
    .catch(() => {
      source = null;
      return null;
    });
  return source;
}

const fileFor = (film: FilmId) => new File(Paths.cache, `sample-${film}-${hash(JSON.stringify(LOOKS[film]))}.jpg`);

type Job = { film: FilmId; done: (uri: string | null) => void };
const lane: Job[] = [];
const waiting = new Map<FilmId, Promise<string | null>>();
let busy = false;

async function make(film: FilmId): Promise<string | null> {
  const out = fileFor(film);
  if (out.exists) return out.uri;
  const img = await sampleImage();
  if (!img) return null;
  const jpeg = develop(img, LOOKS[film], { date: DAY, stamp: false, seed: 7 });
  if (out.exists) out.delete();
  out.create();
  await out.write(jpeg);
  return out.uri;
}

async function work() {
  if (busy) return;
  busy = true;
  while (lane.length) {
    const job = lane.shift()!;
    let uri: string | null = null;
    try {
      uri = await make(job.film);
    } catch {
      uri = null;
    }
    waiting.delete(job.film);
    job.done(uri);
    // one sample per frame or so: the screen keeps scrolling between them
    await new Promise((r) => setTimeout(r, 16));
  }
  busy = false;
}

/** The developed sample's uri; null if the phone can't make it. `urgent` jumps the lane. */
export function filmSample(film: FilmId, urgent = false): Promise<string | null> {
  const hit = fileFor(film);
  if (hit.exists) return Promise.resolve(hit.uri);
  const pending = waiting.get(film);
  if (pending) {
    if (urgent) {
      const i = lane.findIndex((j) => j.film === film);
      if (i > 0) lane.unshift(...lane.splice(i, 1));
    }
    return pending;
  }
  const p = new Promise<string | null>((done) => {
    const job = { film, done };
    if (urgent) lane.unshift(job);
    else lane.push(job);
  });
  waiting.set(film, p);
  work();
  return p;
}

/** For a screen: the sample's uri once ready, or `failed` when it can't be made. */
export function useFilmSample(film: FilmId | null, urgent = false): { uri: string | null; failed: boolean } {
  const [got, setGot] = useState<{ film: FilmId; uri: string | null } | null>(null);
  useEffect(() => {
    if (!film) return;
    let live = true;
    filmSample(film, urgent).then((u) => {
      if (live) setGot({ film, uri: u });
    });
    return () => {
      live = false;
    };
  }, [film, urgent]);
  const mine = got && got.film === film ? got : null;
  return { uri: mine?.uri ?? null, failed: !!mine && !mine.uri };
}
