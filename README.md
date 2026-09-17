# MINT SUIT — sitio web

Sitio de una sola página, estilo internet de principios de los 2000 pero elegante:
mármol de Carrara, Times New Roman y bordes biselados. Sin JavaScript, sin fuentes
externas, sin animaciones. Solo la portada de *Sublime* y su descripción.

## Estructura

```
index.html               → plantilla de la página (Jekyll); el contenido está en _data/
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

## Editar el contenido — Pages CMS

Todo lo que se ve en la página —textos, portadas, fondo, logo, enlaces, footer, la
página 404 y lo que aparece al compartir el link— se edita desde
**https://app.pagescms.org**: entrá con la cuenta de GitHub que tiene acceso a
`despux-net/MINTSUIT` y elegí ese repo.

| En el panel | Archivo | Qué cambia |
|---|---|---|
| Top of the page | `_data/top.yml` | el nombre MINT SUIT y la línea de dedicatoria |
| Background | `_data/background.yml` | la foto de fondo |
| Records | `_data/records.yml` | los álbumes: portada, título, tipo, año, link, descripción; se pueden agregar, quitar y reordenar |
| Presentation | `_data/presentation.yml` | el título y los párrafos del texto largo |
| Logo, links and footer | `_data/bottom.yml` | el logo, los enlaces y el pie |
| Search and sharing | `_data/sharing.yml` | título de la pestaña, descripción para Google, imagen y texto al compartir |
| Page not found (404) | `_data/not_found.yml` | los textos de la página de error |

Las imágenes se suben desde el mismo panel a `assets/` y pueden tener cualquier
nombre. Cada vez que guardás se crea un commit y GitHub Pages recompila el sitio con
Jekyll en 1-2 minutos. La configuración del panel está en `.pages.yml`.

`index.html` y `404.html` son plantillas: el contenido no se edita ahí sino en
`_data/`. Los datos estructurados para Google (álbumes, links, imágenes) se arman solos
a partir de lo mismo.

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
