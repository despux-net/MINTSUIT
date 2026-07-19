# MINT SUIT — sitio web

Sitio de una sola página, minimalista y elegante, para promocionar la música de MINT SUIT.

## Estructura

```
index.html          → estructura de la página
style.css            → todos los estilos (paleta, tipografía, animaciones)
script.js            → carga el contenido dinámico desde /data
data/tracks.json      → lista de canciones (título, año, link de streaming)
data/shows.json       → fechas de shows (vacío por ahora → muestra "sin shows aún")
data/links.json       → links de streaming, redes sociales y email de contacto
assets/               → imágenes (por ahora solo un placeholder de portada)
CNAME                 → necesario para que GitHub Pages reconozca mintsuit.com
```

## 1. Copiar a tu computadora

Copia toda esta carpeta a:
`C:\Users\DESPUJOS\Music\album\MINT SUIT`

## 2. Contenido que falta reemplazar

- `data/tracks.json` — reemplaza los títulos, años y el campo `"link"` con la URL real de cada canción en Spotify/Apple Music/etc. También puedes reemplazar `"cover"` con tus propias imágenes (súbelas a `assets/`).
- `data/links.json` — reemplaza los `"url": "#"` con tus links reales de streaming y redes, y el email de contacto.
- `data/shows.json` — cuando tengas fechas, agrega objetos así: `{"date":"2026-09-12","venue":"Nombre del venue","city":"Ciudad","link":"https://..."}`
- `index.html` — el párrafo de bio en la sección "About" (busca `<strong>MINT SUIT</strong> is a project...`) está en inglés como placeholder; reemplázalo con tu biografía real, en el idioma que prefieras.
- `assets/cover-placeholder.svg` — reemplázalo con tus portadas reales cuando las tengas.

## 3. Subir a GitHub

Desde la carpeta del proyecto (con Git instalado):

```bash
cd "C:\Users\DESPUJOS\Music\album\MINT SUIT"
git init
git remote add origin https://github.com/despux-net/MINTSUIT.git
git add .
git commit -m "Sitio inicial MINT SUIT"
git branch -M main
git push -u origin main
```

Si el repositorio ya tiene contenido (README inicial, licencia, etc.), primero haz `git pull origin main --allow-unrelated-histories` antes del push, o clona el repo vacío y copia los archivos dentro en vez de hacer `git init`.

## 4. Activar GitHub Pages

1. En GitHub, entra al repo `despux-net/MINTSUIT`.
2. Ve a **Settings → Pages**.
3. En "Build and deployment", elige **Deploy from a branch**.
4. Selecciona la rama `main` y la carpeta `/ (root)`.
5. Guarda. GitHub te dará una URL tipo `https://despux-net.github.io/MINTSUIT/`.
6. En la misma pantalla de Pages, en "Custom domain", escribe `mintsuit.com` y guarda (esto ya está preparado por el archivo `CNAME` que subiste, pero confirmarlo en la interfaz activa el certificado HTTPS).

## 5. Configurar el DNS en Namecheap

Como compraste el dominio en Namecheap y aún no configuraste el DNS (según la captura), sigue esto:

1. Entra a Namecheap → **Domain List** → click en **Manage** junto a `mintsuit.com`.
2. Ve a la pestaña **Advanced DNS**.
3. Agrega estos registros (bórralos si ya existe algún "Parking Page" por defecto):

**Para el dominio raíz `mintsuit.com` (4 registros A, apuntando a GitHub Pages):**

| Type | Host | Value | TTL |
|---|---|---|---|
| A Record | @ | 185.199.108.153 | Automatic |
| A Record | @ | 185.199.109.153 | Automatic |
| A Record | @ | 185.199.110.153 | Automatic |
| A Record | @ | 185.199.111.153 | Automatic |

**Para `www.mintsuit.com` (opcional pero recomendado):**

| Type | Host | Value | TTL |
|---|---|---|---|
| CNAME Record | www | despux-net.github.io. | Automatic |

4. Guarda los cambios. La propagación del DNS puede tardar entre 15 minutos y 24 horas.
5. Vuelve a GitHub → Settings → Pages y verifica que aparezca "DNS check successful" y que puedas activar **Enforce HTTPS**.

## Notas de diseño

- Paleta: negro verdoso profundo de fondo, acento menta apagado (no neón) y un dorado tipo "brass" como acento secundario elegante.
- Tipografía: `Fraunces` (serif con carácter, para títulos) + `Space Grotesk` (sans moderna, para texto y detalles).
- El motivo de líneas diagonales (pinstripe) hace referencia al nombre "Suit" — como la tela de un traje — y se repite como textura de fondo y en los separadores.
- Todo respeta `prefers-reduced-motion` y es responsive desde mobile.
