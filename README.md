# MINT SUIT — sitio web

Sitio de una sola página, estilo editorial de lujo (inspirado en casas de moda como Chanel), para promocionar la música de MINT SUIT.

## Estructura

```
index.html          → estructura de la página
style.css            → todos los estilos (paleta, tipografía, animaciones)
script.js            → carga el contenido dinámico desde /data
data/site.json       → todo el texto e imágenes de la página (hero, about, música, video)
data/links.json      → links de streaming y redes sociales
assets/              → imágenes del sitio
admin/               → panel de administración (Decap CMS) — ver abajo
CNAME                → necesario para que GitHub Pages reconozca mintsuit.com
```

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

- Estilo editorial de lujo/minimalismo: paneles full-bleed apilados, mucho whitespace, imágenes grandes.
- Paleta casi monocromática: marfil/blanco roto de fondo, negro carbón para texto — el color lo aportan solo las imágenes.
- Tipografía: `Bodoni Moda` (serif recto, de carácter, para títulos) + `Jost` (sans fina en mayúsculas, para nav/labels/CTAs).
- Microinteracciones sutiles: subrayado progresivo en hover, zoom leve en imágenes, fade suave al aparecer en scroll.
- Todo respeta `prefers-reduced-motion` y es responsive desde mobile.
