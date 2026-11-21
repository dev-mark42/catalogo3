# Elite Sport · Catálogo PWA

Un solo proyecto, un solo `index.html`. Se adapta a celular, tablet y laptop (se detecta el dispositivo y la orientación) y se instala como PWA.

## Estructura
```
index.html            ← única página: acceso (login/registro), tienda y panel admin
manifest.json · sw.js ← PWA (raíz del repositorio)
css/   main · tema · fondo · login · spa
js/
  main.js             ← arranque + enrutador por hash (#/tienda/..., #/admin/...)
  core/               ← config · bd (Supabase) · almacen (datos) · auth · utils
  views/              ← login · catalogo (tienda) · admin
pwa/pwa.js            ← registro del Service Worker, botón instalar, online/offline
assets/               ← img (logo, ligas, iconos) · data (semillas JSON)
supabase/schema.sql   ← tablas, seguridad (RLS) y datos iniciales
semana1/ semana2/ semana3/   ← avances: cada carpeta tiene su módulo + un index.html que funciona SOLO
```
Cada avance funciona de forma independiente (abre su `index.html`) y a la vez lo usa el proyecto central.

| Semana | Carpeta | Se usa en el proyecto |
|---|---|---|
| 1 | 01-modo-oscuro | tema claro/oscuro con fondo de estadio |
| 1 | 02-filtro-catalogo | búsqueda, liga, disponibles y orden |
| 1 | 03-menu-hamburguesa | menú del panel admin |
| 1 | 04-validacion-formulario | login, registro, productos, contacto |
| 1 | 05-alertas-toast | avisos y confirmaciones |
| 2 | 01-delegacion-eventos-hidratacion | un listener por contenedor, splash |
| 2 | 02-carrusel-zoom-animaciones | portada, zoom tipo Mercado Libre, efectos |
| 2 | 03-fetch-lazyloading-dropbox | semillas JSON, imágenes diferidas, enlaces Dropbox |
| 2 | 04-arquitectura-pwa-offline | estado de conexión / cachés |
| 2 | 05-seguridad-xss-subida-imagen | escape XSS y subida de imágenes |
| 3 | 01-componentes-encapsulamiento | `<elite-tarjeta>` (Shadow DOM) en el formulario de productos |
| 3 | 02-mobile-first-grid-flexbox | detección de dispositivo, dock lateral en horizontal, paginación en laptop |
| 3 | 03-cwv-bem-dompurify-sw | Core Web Vitals, BEM, DOMPurify en descripciones |
| 3 | 04-accesibilidad-contraste | foco visible, alto contraste, enlace de salto |
| 3 | 05-smoke-test-dom | botón "Ejecutar Smoke Test DOM" |
| 3 | 06-semantica-a11y-hmr | botón "Verificar semántica HTML5 (sin recarga)" |

El botón flotante de accesibilidad (abajo a la izquierda) agrupa alto contraste, auditoría semántica, smoke test y métricas CWV.

## Cómo probar
Necesita un servidor (los módulos ES no abren con doble clic): `npx serve .`, Live Server de VS Code o GitHub Pages.

Modo local (sin configurar nada): admin `admin` / `admin123`; los clientes se registran y quedan en el navegador.

## Conectar Supabase
1. Crea un proyecto en supabase.com → **SQL Editor** → pega y ejecuta `supabase/schema.sql`.
2. **Authentication → Users → Add user**: `admin@elitesport.com` + contraseña (Auto confirm). Luego en el SQL Editor:
   `update public.perfiles set rol = 'admin' where email = 'admin@elitesport.com';`
3. (Recomendado para pruebas) Authentication → Providers → Email → desactiva "Confirm email".
4. Copia **Project URL** y **anon/publishable key** (Project Settings → API). La URL debe terminar en `.supabase.co`, sin `/rest/v1`. En esta versión se normaliza automáticamente si pegas esa ruta por error.
5. Registro y login usan Supabase Auth; productos, ligas, carrusel y favoritos se guardan en la nube. El admin entra con `admin` (se completa a `admin@elitesport.com`) o con su correo.
El alta, edición, eliminación y cambio de stock de productos espera la confirmación de Supabase antes de mostrar éxito. Si Supabase no responde o las políticas RLS bloquean la escritura, verás el error y el producto no se marcará como sincronizado. La PWA y el sitio usan el mismo `index.html` y consultan el mismo proyecto Supabase; no hay una base de datos separada por dispositivo.
