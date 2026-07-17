# favicons — iconos web del proyecto

> **Los iconos pequeños que aparecen en la pestaña del navegador y cuando alguien añade Tikora a la pantalla de inicio del móvil.**

---

## ¿Qué es un "favicon"?

Cuando abres una página web, en la pestaña del navegador aparece un pequeño icono junto al título. Eso es el "favicon" (favorite icon). También es la imagen que se usa cuando alguien añade una web a sus favoritos o a la pantalla de inicio del móvil.

Esta carpeta contiene **el set completo de iconos de Tikora** en todos los tamaños y formatos que distintos dispositivos esperan: iPhone, Android, Chrome, Firefox, Safari, etc.

---

## ¿Qué hay aquí?

- Varios archivos `.png` en distintos tamaños (16x16, 32x32, 192x192, 512x512, etc.)
- `apple-touch-icon.png` — el icono que usa iPhone cuando alguien añade Tikora a la pantalla de inicio
- `favicon.ico` — el formato clásico de Windows
- `site.webmanifest` — archivo de configuración que le dice al navegador cómo se llama la app y qué iconos usar
- `HTML-PARA-PEGAR-EN-WEB.txt` — el código HTML que hay que copiar en la web para que los iconos se carguen correctamente

---

## ¿Dónde se usan estos iconos?

Estos archivos están subidos a `tikora-v0.netlify.app` (la app online). Cuando alguien abre la página, el navegador descarga el favicon correcto según su dispositivo.

Si alguien hace "añadir a pantalla de inicio" en su iPhone con Tikora, va a aparecer el icono cuadrado de Tikora con el fondo oscuro y la T amarilla.

---

## Diferencia con `_assets-de-marca-y-disenio/`

- **`favicons/`** = iconos técnicos pequeños, optimizados para navegadores y sistemas operativos. Solo se usan dentro de la app web.
- **`_assets-de-marca-y-disenio/`** = imágenes grandes de marca (banner LinkedIn, logo en alta resolución, poster). Se usan en redes sociales, presentaciones e impresión.

---

## Reglas

1. **No borrar nada de aquí.** Si falta un archivo, la web puede romperse en algún navegador o dispositivo concreto.
2. **Si hay que regenerar los favicons** (cambio de logo), usar una herramienta como [realfavicongenerator.net](https://realfavicongenerator.net) y reemplazar todos los archivos a la vez.
3. **El código HTML** (`HTML-PARA-PEGAR-EN-WEB.txt`) ya está incrustado en la app `index.html` de la raíz. No hace falta volverlo a pegar a menos que se reescriba la app desde cero.
