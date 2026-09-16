# MINT SUIT — sitio web

Sitio de una sola página, estilo internet de principios de los 2000 pero elegante:
mármol de Carrara, Times New Roman y bordes biselados. Sin JavaScript, sin fuentes
externas, sin animaciones. Solo la portada de *Sublime* y su descripción.

## Estructura

```
index.html               → la página entera (HTML estático, sin JS)
style.css                → todos los estilos
assets/sublime.jpg       → portada del álbum (1000×1000)
assets/sublime-og.jpg    → portada para redes sociales (600×600)
assets/marble.jpg        → textura de mármol blanco, generada y tileable
assets/marble-dark.jpg   → textura de mármol verde para las placas
assets/favicon.ico       → ícono de la pestaña
CNAME                    → necesario para que GitHub Pages reconozca mintsuit.com
```

La portada original `mintsuit unique.png` (3000×3000) vive solo en local: está en
`.gitignore`, igual que el resto de los archivos fuente pesados.

Las texturas de mármol se generaron por código: el ruido se construye en el dominio
de Fourier —que es periódico por definición, así que el mosaico cierra exacto— y las
vetas son las crestas donde una fase con deriva cruza un entero. El término lineal
tiene que pesar más que la deriva; si no, las vetas se cierran en bucles y el
resultado parece un mapa de curvas de nivel en vez de piedra. No son fotos con
licencia de terceros.

> **Nota:** `admin/` (Decap CMS) y `data/*.json` quedaron del sitio anterior y ya no
> alimentan la página. El contenido ahora se edita directamente en `index.html`.
> Se pueden borrar cuando quieras.

## Editar el contenido — panel de administración

El sitio tiene un panel visual para cambiar textos, imágenes y links sin tocar código, en:

**https://mintsuit.netlify.app/admin**

(No uses `mintsuit.com/admin` para esto — el login de GitHub solo funciona desde el dominio `.netlify.app`, porque el sitio real vive en GitHub Pages y Netlify solo se usa como sistema de login del panel, no como hosting.)

Entra a esa URL, haz clic en "Login with GitHub", inicia sesión con la cuenta que tiene acceso al repo `despux-net/MINTSUIT`, y edita.

Cada cambio que guardes en el panel crea un commit directo en el repo de GitHub, y GitHub Pages vuelve a publicar el sitio (mintsuit.com) solo, en 1-2 minutos.

Los visitantes del sitio no ven ni pueden acceder a este panel — solo funciona si iniciás sesión con una cuenta de GitHub que tenga acceso al repo.

## Configurar el DNS en Namecheap

Registros ya configurados para apuntar `mintsuit.com` a GitHub Pages:

| Type | Host | Value |
|---|---|---|
| A Record | @ | 185.199.108.153 |
| A Record | @ | 185.199.109.153 |
| A Record | @ | 185.199.110.153 |
| A Record | @ | 185.199.111.153 |
| CNAME Record | www | despux-net.github.io. |

## Notas de diseño

- Y2K elegante: columna centrada de ancho fijo, placas de mármol verde arriba y abajo,
  losa de mármol blanco en el medio, bordes `ridge` / `outset` / `groove`.
- Tipografía del sistema, como en 2001: Times New Roman para títulos (versalitas muy
  espaciadas) y Georgia para el texto. Cero fuentes web.
- Paleta: blanco marfil y gris de las vetas, verde profundo de las placas, oro apagado
  (`#a08f5f`) para los adornos y los marcos.
- Cero JavaScript y cero dependencias externas: la página es dos archivos y cuatro imágenes.
- Responsive con un solo `@media` a 620px, para que se vea bien en el teléfono.
