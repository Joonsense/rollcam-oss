# ROLLCAM

A camera for exactly one photo a day. You don't pick the film: the weather, the time and the light where you are pick it, and one line tells you why. Each month becomes a 36-frame roll; days you missed are filled with that day's sky.

하루에 딱 한 장만 찍는 카메라입니다. 필름은 고를 수 없고, 지금 있는 곳의 날씨와 시간과 빛이 골라 줍니다.

Android app on Google Play (closed testing). Expo SDK 58, React Native, Skia.

## What is in here

- `src/lib/film.ts`: which film loads (weather, sun, season, moon, distance from home)
- `src/lib/looks.ts`, `src/lib/lut.ts`, `src/lib/filmShader.ts`: each film's color (baked into a 3D LUT) and the optical part (halation, light leak, grain, vignette) as a Skia shader
- `src/screens/`: camera, roll, year view, film book; `src/widget/`: home screen widgets
- `tests/`: the pure logic, run with Node's test runner
- `scripts/develop-node.ts`: develop a photo on a Mac with the app's own shader (CanvasKit); `scripts/film-cubes.ts` writes every film as a `.cube` LUT

Photos never leave the device. The only network call is the weather (Open-Meteo) with a location rounded to about 10 km. No account, no ads, no analytics.

## Run

```
npm install
npm test
npx tsc --noEmit
npx expo run:android
```

Release signing and Play upload scripts (`scripts/android-release.mjs`, `scripts/play-*.mjs`) read their keys from files outside the repo; see the comments at the top of each.

## Credits

- Hangul font: subset of [Pretendard](https://github.com/orioncactus/pretendard) by Kil Hyung-jin, SIL Open Font License 1.1 (`assets/fonts/`), renamed RollcamSans
- Weather: [Open-Meteo](https://open-meteo.com) (CC BY 4.0)
- Sample photos in `assets/samples/` and the store screenshots: [Unsplash](https://unsplash.com) under the Unsplash License. Demo photos used for screenshots (not included in this repo):

| file | scene | photographer | source |
|---|---|---|---|
| 01-golden-hour-street.jpg | golden-hour-street | Elmer Mejía | https://unsplash.com/photos/hzkq-NK0Bj4 |
| 02-rainy-window.jpg | rainy-window | Max Bender | https://unsplash.com/photos/1YHXFeOYpN0 |
| 03-rainy-window.jpg | rainy-window | Tīna Sāra | https://unsplash.com/photos/jy-uS8iJhX4 |
| 04-snowy-street.jpg | snowy-street | Colin Lloyd | https://unsplash.com/photos/RTJ36Km7CI4 |
| 05-snowy-street.jpg | snowy-street | Maxim Tolchinskiy | https://unsplash.com/photos/GA2y1XU9bIw |
| 06-foggy-morning.jpg | foggy-morning | Spruce | https://unsplash.com/photos/c3vQp2o_CRI |
| 07-foggy-morning.jpg | foggy-morning | Artem Balashevsky | https://unsplash.com/photos/biWIhjjgSDM |
| 08-neon-night-city.jpg | neon-night-city | Andre Benz | https://unsplash.com/photos/lQTf_EUo6Fk |
| 09-summer-beach.jpg | summer-beach | Mink Mingle | https://unsplash.com/photos/g0Qdolm3K14 |
| 10-summer-beach.jpg | summer-beach | Vicko Mozara | https://unsplash.com/photos/m82uh_vamhg |
| 11-winter-blue-sky.jpg | winter-blue-sky | Maria Willow | https://unsplash.com/photos/D6rW8i1Zl9k |
| 12-cafe-window.jpg | cafe-window | Khanh Do | https://unsplash.com/photos/lFEkoe-gWkk |
| 13-cafe-window.jpg | cafe-window | T | https://unsplash.com/photos/dsnC3bnP4Ew |
| 14-storm-clouds.jpg | storm-clouds | Raychel Sanner | https://unsplash.com/photos/MnnXMvs4cQo |
| 15-windy-grass.jpg | windy-grass | Dave Hoefler | https://unsplash.com/photos/EHf86BdnWHI |
| 16-birthday-cake-candles.jpg | birthday-cake-candles | Hamid Roshaan | https://unsplash.com/photos/BQrzI0vi9x0 |
| 17-morning-coffee-table.jpg | morning-coffee-table | Aimee Giles | https://unsplash.com/photos/u1QfqxhsrXQ |
| 18-cat-window.jpg | cat-window | Mykyta Kravčenko | https://unsplash.com/photos/xvLbcfXSVTY |
| 19-cat-window.jpg | cat-window | Hans Ott | https://unsplash.com/photos/oFkDC7MeQ78 |
| 20-flowers-sunlight.jpg | flowers-sunlight | Irina Iriser | https://unsplash.com/photos/O8NfxHgR7fs |
| 21-seoul-street.jpg | seoul-street | Hc Digital | https://unsplash.com/photos/4F3IWlgtV70 |
| 22-seoul-street.jpg | seoul-street | Roméo A. | https://unsplash.com/photos/L1SmFBzBbA8 |
| 23-bicycle-street.jpg | bicycle-street | Usman Yousaf | https://unsplash.com/photos/BWLb8vZXrAY |

Also bundled in the app, scaled to 1080px: 22-seoul-street.jpg as assets/samples/film-sample.jpg (the film book's sample print, developed with each film on the phone).

## License

MIT, see `LICENSE`. The ROLLCAM name and icon identify DeblockX Labs' app; please use your own name and icon if you publish a fork.
