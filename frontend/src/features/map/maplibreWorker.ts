import { setWorkerUrl } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'

// MapLibre 6 cerca il worker accanto al proprio file: con il bundling di Vite quel file non
// esiste, quindi lo facciamo compilare a Vite e passiamo l'URL esplicitamente.
setWorkerUrl(workerUrl)
