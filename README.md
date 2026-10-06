# Hacedor

El sitio de Hacedor, LLC — `hacedor.org`.

HTML, CSS y JavaScript. Sin framework, sin Node, sin paso de compilación: lo
que hay en `site/` es exactamente lo que se sirve.

## Cómo verlo

Doble clic en `site/index.html`. No hace falta servidor ni instalar nada.

## Qué hay adentro

```
site/                   el sitio, y nada más que el sitio
  index.html            la página principal
  faq.html              las trece preguntas
  404.html              página no encontrada
  css/site.css          todos los estilos
  css/fonts.css         las tres familias, autoalojadas
  js/                   un archivo por pieza que se mueve
  _headers              las cabeceras HTTP, para Cloudflare
  fonts/ brand/ icons/ team/ video/

wrangler.jsonc          cómo se publica en Cloudflare
worker/index.js         y el Range del video, que Cloudflare no da solo
Dockerfile              cómo se publica en cualquier otro lado
Caddyfile               y las cabeceras de ese otro lado
.github/                la revisión automática
```

Esa división es lo único estructural que hay que respetar: **si un archivo
no está dentro de `site/`, no llega al visitante**. No hay listas de
exclusión que mantener ni archivos que acordarse de borrar.

Cada archivo de `js/` hace una sola cosa: `voice-note.js` dibuja la onda del
hero en WebGL, `video-player.js` es el reproductor, `how-it-works.js` mueve la
sección fijada, `footer-wave.js` el divisor del pie. `site.js` tiene lo
compartido: scroll suave, apariciones al desplazar y pausado de animaciones
fuera de pantalla.

## Dónde se cambia cada cosa

| Qué | Dónde |
|---|---|
| Colores y tipografía | las variables al inicio de `site/css/site.css` |
| Textos | directamente en `site/index.html` y `site/faq.html` |
| Fotos del equipo | `site/team/`, reemplazando los `.webp` |
| Video | `site/video/recite-trailer.mp4` y su póster |
| La onda del hero | `site/js/voice-note.js`, el shader está adentro |

Las cinco preguntas de la home son una copia de cinco de las trece de
`site/faq.html`. Si editás una respuesta, va en los dos archivos.

Los cuatro diagramas de "How it works" están incrustados dos veces, una por
maqueta, y **cada copia lleva sus identificadores numerados**. No es
decorativo: dos copias con los mismos `id` hacen que `url(#id)` resuelva
contra la maqueta que el CSS tiene oculta, y un patrón en un árbol que no se
renderiza no pinta nada.

## Cómo se publica

**En Cloudflare.** `wrangler.jsonc` apunta a `site/` y eso es todo lo que
sube; no hay compilación, los archivos viajan como están. Las cabeceras no
las pone un servidor: las lee Cloudflare de `site/_headers`.

`worker/index.js` son cincuenta líneas que solo tocan el video. El
almacenamiento estático de Cloudflare contesta cualquier pedido con el
archivo entero, y un navegador necesita pedidos por rango para poder
adelantar; Safari y iOS directamente no reproducen un MP4 servido sin eso.
Todo lo que no es video sale derecho, sin ejecutar nada.

**En cualquier otro lado**, `Dockerfile` y `Caddyfile` sirven la misma
carpeta con Caddy, que responde rangos por sí solo. Sin Node y sin
compilación; la imagen no tiene gestor de paquetes.

El `Caddyfile` son unas 80 líneas. Cinco bastarían para entregar los
archivos: el resto son las cabeceras de seguridad (CSP, HSTS,
anti-clickjacking, cámara y micrófono desactivados), las reglas de caché, y
el 404 con su código correcto.

Las mismas cabeceras, entonces, están escritas dos veces: en `site/_headers`
para Cloudflare y en el `Caddyfile` para Caddy. Una política escrita dos
veces se separa sola, y la mitad que se separa es la que nadie mira, así que
la revisión automática compara las dos y falla si dejan de coincidir.

## Decisiones que conviene conocer

**Ningún enlace externo abre una pestaña nueva.** Una pestaña nueva nace sin
historial, así que su botón de atrás queda muerto y el visitante no tiene cómo
volver salvo cerrando algo que no pidió abrir. Quien quiera una pestaña nueva
la abre con ctrl+clic.

**El acordeón de las preguntas es `<details>` nativo.** Sin JavaScript: abre,
cierra, funciona con teclado y con lector de pantalla, y sigue funcionando si
el script nunca llega.

**Las animaciones de hover usan `scale` y `translate`, no `transform`.** Eso
deja `transform` libre para lo que mueve el JavaScript, y los dos no pueden
pelearse por la misma propiedad.

**El hover del menú solo existe con puntero real** (`hover: hover`). En una
pantalla táctil un toque dejaría el estado pegado, y eso se lee como un error.

## Verificación

En cada cambio corre `.github/scripts/check.mjs`, que no deja pasar una
referencia a un archivo que no está (ni escrito con otras mayúsculas: corre
en Linux), un enlace interno que no aterriza en ningún lado, un
identificador repetido dentro del mismo documento, un enlace que abra
pestaña nueva, una pregunta de la home que ya no coincide con `faq.html`, un
archivo que el sitio necesite y la imagen no copie, ni una diferencia entre
las cabeceras de Cloudflare y las de Caddy.

El sitio se comparó contra la versión anterior píxel a píxel, sección por
sección, en seis tamaños de pantalla, con movimiento reducido activado para
que las animaciones queden congeladas y la comparación sea determinista.

**Diferencia máxima en la página completa: 0,002%.**

También se auditaron doce tamaños de dispositivo buscando desbordes
horizontales, títulos cortados, texto por debajo de 11,5px, objetivos táctiles
chicos y errores de consola. Sin hallazgos nuevos respecto de la versión
anterior.

El peso del código pasó de 240 KB de JavaScript a 44 KB en total, contando
marcado, estilos y comportamiento.
