# Hacedor

El sitio de Hacedor, LLC: `hacedor.org`.

La misma página de `hacedor.org`, reescrita con HTML, CSS y JavaScript puros.
Sin React, sin Node, sin paso de compilación: lo que hay en esta carpeta es
exactamente lo que se sube al servidor.

Es un **port, no un rediseño**. El objetivo es que se vea idéntica a la versión
actual, verificado píxel a píxel sección por sección.

## Estado

| Parte | Qué incluye | Estado |
|---|---|---|
| 0 | Base: tokens, reset, fuentes, Lenis, sistema de reveals | hecha |
| 1 | Hero: onda WebGL, brillo del titular, botón magnético | hecha |
| 2 | Header y footer | hecha |
| 3 | RE-CITE y reproductor de video | hecha |
| 4 | Stats, Vision, Team, Contact | hecha |
| 5 | How it works (diagramas SVG) | hecha |
| 6 | Cierre: sitemap, robots, manifest, cabeceras, QA | hecha |

La **FAQ** está hecha: cinco preguntas en la home (después del equipo, antes de
contacto) y las trece en `faq.html`, agrupadas en cuatro bloques.

Queda pendiente la parte **legal**, que hoy no existe en ninguna versión del
sitio y hay que redactar con alguien que sepa de protección de datos de
menores.

### Contenido traído del sitio viejo

Del detalle de producto (`items.html#detail`) se recuperaron tres cosas que
no estaban en la página nueva:

- **Lo que está en juego** — un bloque entre el hero y RE-CITE. La página iba
  del gancho a la solución sin pasar por el problema. **Se quitó la afirmación
  sobre cobertura de seguros y escuelas**, porque nadie pudo confirmarla.
- **Direct Magnitude Estimation**, nombrado en el paso 3. Antes aparecía solo
  en las palabras clave de la cabecera, que nadie lee.
- **Qué recibe la fonoaudióloga** — el score card con puntajes y percentiles,
  en el paso 4.

El sitio viejo dice **"eight dimensions"**; son **diez**, confirmado. Nuestra
banda de datos ya decía 10.

**Los nombres de las diez dimensiones no se publican** (decisión de Hacedor).
Lo más específico que se puede decir sin nombrarlas es "consonants and vowels
at the word level, scored across 10 phonological dimensions".

### Sobre la FAQ

Las cinco de la home son una copia textual de cinco de las trece. Si editás una
respuesta, hay que editarla en los dos archivos.

Al pasar el contenido se corrigieron tres errores del sitio actual:

- **"Is RE-CITE for diagnosis or treatment?" tenía la respuesta escrita dos
  veces**, y la primera copia todavía arrastraba `[1] [2]` — marcas de
  comentarios de Word. Se conservó la segunda, que es la más completa.
- **"Adventages"** y **"Educacional"**, en dos títulos.
- **Las dos citas académicas tenían el DOI roto**: una con un `[1]` pegado,
  la otra cortada. Verificadas contra el registro de DOIs y reparadas; ahora
  cada una lleva además el título del artículo.

Los títulos pasaron a minúscula de oración, que es la voz del resto del sitio.

También se corrigió **"It will soon be developed for Spanish"**: el español
está a años de distancia y el inglés todavía no está publicado, así que
"soon" prometía algo que la empresa no puede cumplir. Ahora dice "Spanish is
on the roadmap".

**Sin tocar, a la espera del documento del grant:** los requisitos técnicos
("Windows 11 Professional, 8 GB de RAM, 200 GB de disco"). Describen un
programa de escritorio, pero RE-CITE hoy corre en el navegador contra la API
de Railway, así que casi seguro están viejos.

## Enlaces externos

Ninguno abre una pestaña nueva. Una pestaña nueva nace sin historial, así que
su botón de atrás queda muerto y el visitante no tiene cómo volver salvo
cerrando una pestaña que no pidió abrir. Quien quiera una pestaña nueva la
abre con ctrl+clic o manteniendo pulsado.

Con eso se fueron también `rel="noopener noreferrer"` (existía solo para que
`target="_blank"` fuera seguro) y los avisos "(opens in a new tab)", que ya
serían falsos. El de "Almeida" decía además que el enlace iba a LinkedIn, y
esa parte se conservó.

## Para publicarlo

`Dockerfile` y `Caddyfile` sirven la carpeta con Caddy, que es lo que pide
Railway: sin Node, sin compilación, y con soporte de Range para que el video
se pueda adelantar.

Son 80 líneas. Cinco bastarían para entregar los archivos; el resto son las
cabeceras de seguridad que el sitio ya tenía en Cloudflare (CSP, HSTS,
anti-clickjacking, cámara y micrófono bloqueados), las reglas de caché y el
404 con su código correcto.

**Sin probar todavía**: Docker Desktop no estaba corriendo. Si el `Caddyfile`
tuviera un error, el primer despliegue de Railway falla y lo dice en sus
registros.

## Cómo verla

Doble clic en `index.html`. No hace falta servidor.

## Dónde se cambia cada cosa

- **Colores y tipografía** → las variables al inicio de `css/site.css`
- **Textos** → directamente en `index.html`
- **Fotos del equipo** → `team/`, reemplazando los `.webp` por otros del mismo tamaño
- **Video** → `video/recite-trailer.mp4` y su póster
- **La onda del hero** → `js/voice-note.js` (el shader está dentro)

## Una diferencia deliberada

En el sitio actual, las dos maquetas de "How it works" incrustan el mismo SVG y
reutilizan los mismos identificadores. `url(#id)` toma el primero, que en
pantallas angostas vive dentro de la maqueta que el CSS oculta — y un patrón en
un árbol no renderizado no pinta nada. Resultado: **en celulares y tablets los
cuatro diagramas pierden su grilla de fondo.**

Acá cada copia lleva su propio identificador, así que la grilla se ve siempre.
Es la única cosa que no reproduce el sitio actual tal cual, y es a propósito:
reproducir el defecto exigía ensuciar el código para empeorar el resultado.
Si preferís que se vea igual que hoy, se revierte en un minuto.

## Verificación

Cada parte se compara contra la versión en `../Hacedor/web/out` con movimiento
reducido activado, que congela las animaciones en un fotograma fijo y hace la
comparación determinista. Resultados:

- **Parte 1 (hero):** diferencia máxima 0,015% de los píxeles, toda suavizado de bordes.
- **Parte 2 (header):** 0,000% en los seis tamaños.
- **Página completa**, comparada contra el sitio actual en seis tamaños:
  **0,002% de diferencia como máximo**, una vez reparada en el original la
  grilla descrita arriba. Sin reparar da hasta 0,963% en pantallas angostas,
  y esa diferencia es exactamente ese defecto.
- **Parte 6 (metadatos):** sitemap, robots y manifest idénticos a los que
  genera el original.
- **Parte 6 (auditoría en 12 tamaños):** cero desbordes, cero títulos
  cortados, cero errores, en las dos versiones. Lo que aparece (textos chicos,
  objetivos táctiles de 36px) está igual en el sitio actual.
- **Parte 5 (escenario fijado):** 0,000%-0,013% en los cuatro pasos, en
  escritorio y laptop.
- **Parte 5 (maqueta apilada):** 0,005% en tablet y 0,008% en móvil, comparado
  contra el original con su grilla reparada. Contra el original tal cual da
  0,97% y 1,48%: esa diferencia **es** el defecto de la grilla, descrito abajo.
- **Parte 5 (barrido de análisis):** corre solo donde debe, igual que el original.
- **Parte 4 (Vision y Contact):** 0,000% en los seis tamaños.
- **Parte 4 (Stats):** idéntica en 5 de 6; en móvil-390 difieren 3 filas de 1377,
  el borde inferior de la banda.
- **Parte 4 (Team):** entre 0,000% y 0,007%. Antes de corregirlo, las tarjetas
  salían 86,5px más altas: `.team-roster h3` también alcanzaba al <h3> del
  nombre de cada integrante. Ahora se llama `.roster-title`.
- **Parte 4 (interacciones):** brillo que sigue al cursor, escala del retrato y
  botón de copiar — todas las medidas coinciden con el original.
- **Parte 3 (RE-CITE):** idéntica en escritorio, laptop, tablet y apaisado. En los
  dos móviles queda un 0,05-0,11% de píxeles rozando el umbral: ninguno difiere
  en más de 20 sobre 255, es el borde desenfocado del botón de play.
- **Parte 3 (reproductor):** 13 conductas comparadas contra el original en dos
  tamaños — reproducir, pausar, buscar, silenciar, duración, visibilidad de la
  barra, botón grande, sin controles nativos, menú contextual bloqueado. Todas
  coinciden.
- **Parte 2 (footer):** 0,000% en escritorio y móvil, comparado con el footer
  colocado a la misma altura absoluta que en el original. Mientras falten
  secciones el footer arranca en otra fracción de píxel y eso solo cambia el
  rasterizado de las letras, no la maquetación; las 13 medidas del DOM
  coinciden en 0,0px.
