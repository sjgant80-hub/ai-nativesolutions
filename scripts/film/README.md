# The film's source (own-it-prove-it-90s.mp4)

Everything the 90-second film is made from, so it can be re-made from here rather than from a temp folder.
The images it captures (`shots/*.png`) and the voice clips (`vo/*.wav`) are generated, not stored.

1. `script.json` — every line, as shown (`text`) and as voiced (`say`). The voice is the local Windows one
   (System.Speech, "Microsoft Hazel Desktop", en-GB), no cloud: `powershell -File vo-gen.ps1 -Ids <scene>`.
   The same settings reproduce the original clips byte for byte.
2. `node vo-process.cjs` — trim edge silence, cap pauses at 280 ms → `vo/*.trim.wav`, `vo/timing.json`.
3. `node build-audio.cjs` — lay the voice on a 90.0 s timeline, split the captions, mix the ambient pad →
   `out/film-audio.wav`, `timeline.json`, `out/film.vtt`. The speech must end by 89.40 s or the film runs long.
4. `node encode.cjs` — render every frame of `film.html` in the installed Chrome and encode H.264 + AAC with
   WebCodecs; it refuses anything but exactly 2,700 frames. Mux → `out/film.mp4`.
5. `node verify-mp4.cjs` — parse the boxes, decode, seek, play in real time, check voice energy.
6. `node site-film-update.cjs <site> <version>` — copy the film and captions into `media/film/`, carry changed
   lines into the explainer transcript, and key every embed with `?v=<version>`.
7. `node pdf-prospectus.cjs <site>` — the brochure PDF only; `node pdfs.cjs <site>` — the brochure and the deck (A4 landscape, one slide per page). Both write into the site folder you name; there is no default.

`film.html` reads `facts.json` (pass `?facts=<url>` to point it at `media/film/facts.json`), so every number on
screen comes from the site's one facts file.

2026-09-28 re-render: the receipt frame shows the CI re-run as live and link-bound; "examples it's never seen" →
"examples kept out of its spec"; the sizer "suggests the smallest model that should clear your bar"; the trust rail
"breaks the code to test the tests"; the fold-cycle figure is stated as prefix caching kept stable, with its control.
