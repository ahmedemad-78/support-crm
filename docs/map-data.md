# Locally bundled map reference data

The interactive map loads the Positron basemap from OpenFreeMap. The browser overlays case counts at reference locations. Egypt opens at fixed bounds. World view includes overseas locations. Marker sizes are relative to the busiest displayed place. If the basemap cannot load, the dashboard uses its bundled fallback. The tile provider receives map requests without customer addresses or case records.

World boundaries: world-atlas 2.0.2 countries-110m TopoJSON, derived from Natural Earth, decoded into WGS84 polygon rings with three decimal places. Source: https://github.com/topojson/world-atlas (ISC distribution); Natural Earth geographic data is public domain. Original asset: https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json. Country fallback markers use the bounding-box centre of the main polygon and are explicitly country-level reference points. Low-resolution boundaries are for aggregate context, not legal/administrative delineation.

Reference coordinates, consulted 2026-11-13:

- Cairo: GeoNames 360630, 30.06263 N / 31.24967 E — https://www.geonames.org/360630/cairo.html
- Alexandria: GeoNames 361058, 31.20176 N / 29.91582 E — https://www.geonames.org/361058/alexandria.html
- Asyut: UNGEGN / CAPMAS, 27.18858603 N / 31.16372869 E — https://ungegn.un.org/dashboard/cities/details?id=2946
- Damietta: GeoNames Egypt gazetteer search, 31.416477 N / 31.813316 E — https://www.geonames.org/search.html?country=EG&startRow=0
- Qalyubia: GeoNames 360621 administrative reference, 30.3 N / 31.25 E — https://www.geonames.org/360621/qalyubia.html
- Red Sea (Egypt): GeoNames administrative reference, 27.186242 N / 33.788452 E — https://www.geonames.org/advanced-search.html?country=EG&q=Rosso%2C+Mar

GeoNames is attributed under CC BY 4.0: https://www.geonames.org/about.html.

Markers indicate the recorded city/area at a reference point, never a customer address or observed density surface. Radius/colour indicate case counts. Missing city IDs and the explicit “Not recorded” city are excluded from map marks and reported together as unknown. A recorded location without an approved reference remains visible in the list as unmapped; it is never silently placed in Egypt. Only existing exact country-name matches receive the country-level fallback. New Egyptian city/area references can be added after verification without modifying tickets.
