# saferstreetmaker

A map creator for adding potential active travel measures.

I got tired of using screenshots of Google Maps and Paint.net to create maps of potential active travel infrastructure, so, like all good developers, I decided to see if I could write my own solution. There is a live version of the site [https://saferstreetmaker.org], serving as a demo too.

Using the leaflet.js [https://leafletjs.com] mapping library to show OpenStreetMap [https://www.openstreetmap.org] maps.

The project is written in TypeScript, uses yarn for package management, Tailwind [https://www.tailwindcss.com] for styling, and Vite for the dev server and production build. As my version of the site is being hosted as a Static Web App on Azure, I took the decision to pull in all third-party libraries from external CDNs, to make sure my site would stay within the, admittedly generous, traffic limits.

It also uses the following leaflet.js add-ons:

leaflet-draw
leaflet-svg-shape-markers
leaflet-path-drag
leaflet-toolbar
leaflet-geometryutil
leaflet-arrowheads

and lz-string for compressing the map data.

It's still very basic at the moment as I just wanted to get something up and running.

The map is zipped and saved to the browser's local storage every time a change is made to it. You can choose to download a JSON version of the map to your device. Additionally, you can download a GeoJSON version of the map, if you wish to import it to more traditional mapping software.

Open **Share** in the toolbar and choose **Image**, **HTML**, or **Url** under **Export as**. Image downloads a PNG; HTML copies an embeddable iframe; Url copies a direct share link. Width and height default to the map's current on-screen size and set the PNG or iframe dimensions. Image exports keep the current map scale and center, so changing the aspect ratio changes the visible map area. The PNG includes map attribution and a legend for built-in layers with visible features in the exported view. Images are limited to 8192 pixels per side and 16,777,216 total pixels.

Image export waits for an active zoom transition to finish and stops any ongoing pan before capturing the map, keeping features aligned with the map tiles.

Additionally, you can load a JSON version of a map.

Point markers are full-size at zoom 16 and above, half-size at zooms 13-15, and hidden at zoom 12 and below.

Click an existing LTN cell to edit its boundary using the square vertex handles. Round vertex indicators are used for group and area selections, not while the cell's boundary editor is active. If a group selection is retained when boundary editing ends, its round indicators are restored.

LTN creation stays active after completing a cell. Name the cell and press Enter or close its popup, then draw the next cell without toggling the toolbar button. Press Escape or select another tool to stop drawing.

If I was developing this for a client, then I would write a backend and database to store the maps, as this would allow for user accounts, map sharing, collaborative working. As this would not be free to run, I've not gone down that route, though if any organisation would like to sponsor this project, I have plenty of ideas for functionality that could unlock.

To run this project locally, use Node.js 24 LTS (24.15.0 or newer within the 24.x
release line) and Yarn 3.6.1 via Corepack, then clone the repo and install dependencies:

```sh
corepack enable
yarn install
```

Useful commands:

```sh
yarn start      # dev server at http://localhost:1234
yarn build      # production build
yarn preview    # preview the production build
yarn test       # Playwright tests (tests/playwright.config.ts)
yarn test:unit  # Vitest tests (tests/vitest.config.ts)
```

Before running browser tests locally, install the browser engines with
`yarn playwright install chromium firefox webkit`. `yarn test` runs the full suite
in Chromium and the named layer-items workflows in Firefox and WebKit as well.
Use `yarn test --project=chromium` to run only the Chromium suite.
