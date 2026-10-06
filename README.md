# Hacedor

El sitio de Hacedor, LLC — `hacedor.org`.

HTML, CSS y JavaScript. Sin framework, sin Node, sin paso de compilación: lo
que hay en esta carpeta es exactamente lo que se sirve.

## Cómo verlo

Doble clic en `index.html`. No hace falta servidor ni instalar nada.

## Qué hay adentro

```
index.html        la página principal
faq.html          las trece preguntas
404.html          página no encontrada
css/site.css      todos los estilos
css/fonts.css     las tres familias, autoalojadas
js/               un archivo por pieza que se mueve
fonts/ brand/ icons/ team/ video/
Dockerfile        \ cómo se sirve: no son parte de la página
Caddyfile         /  y no se entregan al visitante
```

Cada archivo de `js/` hace una sola cosa: `voice-note.js` dibuja la onda del
hero en WebGL, `video-player.js` es el reproductor, `how-it-works.js` mueve la
sección fijada, `footer-wave.js` el divisor del pie. `site.js` tiene lo
compartido: scroll suave, apariciones al desplazar y pausado de animaciones
fuera de pantalla.

## Dónde se cambia cada cosa

| Qué | Dónde |
|---|---|
| Colores y tipografía | las variables al inicio de `css/site.css` |
| Textos | directamente en `index.html` y `faq.html` |
| Fotos del equipo | `team/`, reemplazando los `.webp` |
| Video | `video/recite-trailer.mp4` y su póster |
| La onda del hero | `js/voice-note.js`, el shader está adentro |

Las cinco preguntas de la home son una copia de cinco de las trece de
`faq.html`. Si editás una respuesta, va en los dos archivos.

Los cuatro diagramas de "How it works" están incrustados dos veces, una por
maqueta, y **cada copia lleva sus identificadores numerados**. No es
decorativo: dos copias con los mismos `id` hacen que `url(#id)` resuelva
contra la maqueta que el CSS tiene oculta, y un patrón en un árbol que no se
renderiza no pinta nada.

## Cómo se publica

`Dockerfile` y `Caddyfile` sirven la carpeta con Caddy. Sin Node y sin
compilación; la imagen no tiene gestor de paquetes.

Son unas 80 líneas. Cinco bastarían para entregar los archivos: el resto son
las cabeceras de seguridad (CSP, HSTS, anti-clickjacking, cámara y micrófono
desactivados), las reglas de caché, y el 404 con su código correcto. Caddy
responde *Range* por sí solo, que es lo que el video necesita para poder
adelantarse.

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
