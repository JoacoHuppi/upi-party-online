# Modelos incorporados en UPI Party 3D

## Poly Pizza — accesorios seleccionados

- Cosmetic Pack One, J-Toastie: https://poly.pizza/bundle/Cosmetic-Pack-One-RcVgZxSR8S — CC-BY. Incorporados Frog Hat, Pizza Hat y Cat Beanie; adaptados en escala y anclaje.
- Glasses Pack, iPoly3D: https://poly.pizza/bundle/Glasses-Pack-gPz05eJm9w — CC0. Incorporados Pixel Glasses, Party Glasses y Ski Goggles; adaptados en escala y anclaje.
- No se incorporó el resto de los bundles para mantener tamaño y variedad controlados.
- Modular Platforming Bundle, Quaternius: https://poly.pizza/bundle/Modular-Platforming-Bundle-cWyDdbRbAa — CC0. Incorporados Crate, Flag y Platform como decoración física del lobby ampliado.
- Stylized Nature MegaKit, Quaternius: https://poly.pizza/bundle/Stylized-Nature-MegaKit-T34GZFA0fm — CC0. Incorporado Bush.
- Ultimate Stylized Nature Pack, Quaternius: https://poly.pizza/bundle/Ultimate-Stylized-Nature-Pack-zyIyYd9yGr — CC0. Incorporado Flower Bushes.
- City Props, J-Toastie: https://poly.pizza/bundle/City-Props-oiCnu8AuUP — CC-BY 3.0. Incorporado Street Light.
- City Pack: https://poly.pizza/bundle/City-Pack-kJqRAIGsw0 — incorporado únicamente Big Building de Quaternius, CC0 según la página de créditos del bundle: https://poly.pizza/l/kJqRAIGsw0/credits.

## Kenney — Animated Characters Survivors 1.0

- Fuente: https://kenney.nl/assets/animated-characters-survivors
- Licencia CC0 verificada en `sources/kenney-survivors/License.txt`.
- Apariencias incorporadas: `survivorMaleB.png` y `survivorFemaleA.png`.
- Reutiliza el mismo modelo y clips Kenney ya incluidos, verificados como idénticos por SHA-256.

## Accesorios propios de UPI Party

- `Visor de chispas` y `Corona orbital`: geometría procedural original creada dentro del proyecto; no incorporan modelos, mapas ni texturas de terceros.

## Versión actual: Kenney — Animated Characters Protagonists 1.1

- Fuente: https://kenney.nl/assets/animated-characters-protagonists
- Descarga oficial: https://kenney.nl/media/pages/assets/animated-characters-protagonists/608191acc4-1774773108/kenney_animated-characters-protagonists.zip
- Licencia CC0 verificada en `sources/protagonists/License.txt`.
- Modelo: `Model/characterMedium.fbx`.
- Apariencias: `skaterMaleA.png`, `skaterFemaleA.png`, `criminalMaleA.png`, `cyborgFemaleA.png`.
- Animaciones: `idle.fbx`, `run.fbx`, `jump.fbx`, omitiendo los clips de pose objetivo.
- Adaptaciones: escala, material, selección de clips, movimientos de raqueta/baile y anclajes de accesorios. FBX y clips comprimidos con gzip, texturas incorporadas al HTML. No se compraron recursos.

Los Mini Characters descritos abajo corresponden a la versión anterior y se conservan como fuentes históricas. Los personajes Quaternius sólo están en el HTML de prueba del estilo 3, rechazado por el usuario. Los sombreros de hat_my_guy y las piezas faciales propias siguen vigentes.

Descargados y verificados el 5 de septiembre de 2026.

Actualización de pulido: las gafas, lentes de sol y máscaras visibles ahora se construyen con geometría propia en `avatar.js` para ajustarse a los personajes. Los archivos aid-glasses, aid-sunglasses y aid-mask se conservan como fuentes anteriores pero ya no se muestran. Lobby, portales, pista de baile, plataformas y fondos usan geometría procedural más la selección externa acreditada arriba. La galería de selección enlaza imágenes oficiales de Kenney y Quaternius; son referencias visuales, no nuevos personajes incorporados.

## Kenney — Mini Characters 1.0

- Autor: Kenney, https://kenney.nl
- Fuente y licencia: https://kenney.nl/assets/mini-characters
- Descarga: https://kenney.nl/media/pages/assets/mini-characters/bfc7e272b4-1774770718/kenney_mini-characters.zip
- Licencia: Creative Commons Zero (CC0 1.0), https://creativecommons.org/publicdomain/zero/1.0/
- Texto del autor: `sources/mini-characters/License.txt`.
- Usados: character-male-f (Nico, identificador interno male-a), character-female-b (Luna, identificador interno female-a), character-male-e, character-female-e, aid-glasses, aid-sunglasses, aid-mask; animaciones incluidas y Textures/colormap.png.
- Adaptaciones: tamaño, colocación, materiales de variantes cosméticas y texturas incorporadas en los GLB para distribución en un HTML sin conexión.

## hat_my_guy — Sombrero y Hat Stylised

- Autor: hat_my_guy (perfil enlazado en las fuentes).
- Sombrero: https://poly.pizza/m/CxDnECpFJH
- Archivo: https://static.poly.pizza/2706d0c1-9d5f-4d77-b6b1-eb58dcb71f1e.glb
- Hat Stylised: https://poly.pizza/m/lNN3PlrjSa
- Archivo: https://static.poly.pizza/5f6f5355-664d-4763-b1f6-71474caf2d52.glb
- Ambas fichas indican Public Domain (CC0), publicado el 17 de diciembre de 2021.
- Licencia: https://creativecommons.org/publicdomain/zero/1.0/
- Adaptaciones: centrado, escala para la cabeza de los personajes, variantes de materiales y efecto iridiscente. Los nombres y rarezas de las variantes son del juego, no de sus autores.

Los modelos CC0 permiten modificación y uso comercial. Se conservan los originales descargados en `sources` y se muestran créditos dentro del HTML. El paquete Blocky Characters se descargó para evaluar compatibilidad pero no se incorpora al juego. Los modelos CC-BY utilizados se atribuyen individualmente arriba.

## Fuentes históricas retiradas del catálogo — Animated Characters Retro 1.1

- Fuente oficial: https://kenney.nl/assets/animated-characters-retro
- Licencia: Creative Commons Zero (CC0 1.0), texto conservado en `sources/kenney-retro/License.txt`.
- Las texturas `humanMaleA.png` y `humanFemaleA.png` se conservan como fuente histórica, pero Max Retro y Mia Retro fueron retirados del catálogo y ya no se embeben.
- Adaptación/optimización: el modelo `characterMedium.fbx` y los clips `idle`, `run` y `jump` son byte por byte los mismos que en Animated Characters Protagonists (SHA-256 comprobado). Se reutiliza el rig ya embebido y solo se agregan las dos texturas. Las variantes zombie no se incorporaron.

Motor: Three.js 0.180.0 (MIT), texto en `../THREE-LICENSE.txt`.
