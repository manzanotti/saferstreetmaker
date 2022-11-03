# saferstreetmaker
A map creator for adding potential active travel measures.

I got tired of using screenshots of Google Maps and Paint.net to create maps of potential active travel infrastructure, so, like all good developers, I decided to see if I could write my own solution. There is a live version of the site [https://saferstreetmaker.org], serving as a demo too.

Using the leaflet.js [https://leafletjs.com] mapping library to show OpenStreetMap [https://www.openstreetmap.org] maps.

The project is written in TypeScript, uses yarn for package management tailwind [https://www.tailwindcss.com] for styling, and parcel.js [https://parceljs.org] to build everything. As my version of the site is being hosted as a Static Web App on Azure, I took the decision to pull in all third-party libraries from external CDNs, to make sure my site would stay within the, admittedly generous, traffic limits.

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

Additionally, you can load a JSON version of a map.

If I was developing this for a client, then I would write a backend and database to store the maps, as this would allow for user accounts, map sharing, collaborative working. As this would not be free to run, I've not gone down that route, though if any organisation would like to sponsor this project, I have plenty of ideas for functionality that could unlock.

To run this project locally, clone the repo, install yarn (if you don't already have it).

yarn install

yarn parcel src/index.html

The site will be available at http://localhost:1234