# Reporte C3-A1 · Responsividad UI — Elite Sport (Proyecto Personal, Catálogo PWA)
URL esperada: https://USUARIO.github.io/REPO/proyectopersonal/fase-ui-pwa/

## 1. Arquitectura por subcarpeta de fase (20 pts)
- Todo vive en `proyectopersonal/fase-ui-pwa/` (rutas 100% relativas, sin "/" inicial, para que funcione bajo GitHub Pages).
- `manifest.json` (start_url y scope relativos) + `sw.js` (registrado en `js/core/pwa.js`).
- Estructura: `index.html` (login/registro) · `pages/` (cliente, admin) · `css/` · `js/core` · `js/views` · `js/avances` · `assets/`.

## 2. Responsividad (30 pts)
| Requisito | Dónde |
|---|---|
| 360 / 390 / 768 / landscape | `css/main.css` (breakpoint 992px: móvil+tablet = app con barra inferior; laptop = header web) y bloque `@media (orientation:landscape) and (max-height:520px)` |
| `100dvh` (Brave/Opera) | `main.contenido`, `.lg-wrap`, `.zm-box` usan `dvh`; no hay `100vh` |
| Botones >= 44px | `.btn-icon, .p-fav, .zm-close, .stock-ctl button` = 44px; regla `@media (pointer:coarse)` fuerza `min-height:44px` |
| Texto truncado | `.p-title`, `.liga-item b`, `.text-truncate` (ellipsis) |
| Teclado virtual | `<meta viewport ... interactive-widget=resizes-content>` + `focusin -> scrollIntoView` en `js/avances/animaciones.js` |

## 3. Seguridad XSS, delegación y rendimiento (30 pts)
- Delegación con limpieza (equivalente vanilla de `.off().on()`): `js/avances/delegacion-eventos.js` hace `removeEventListener` antes de `addEventListener` (un listener por contenedor/selector).
- Anti-XSS: `js/avances/seguridad-xss.js` (`limpiarTexto`) se aplica a TODO dato dinámico; el modal usa `textContent`; el buscador solo se compara con `.includes()` y nunca se inserta en el DOM; URLs de imagen validadas (`dropbox.js` bloquea `javascript:`).
- Lazy loading: `loading="lazy" decoding="async"` en imágenes + `IntersectionObserver` (`lazy-loading.js`).
- AJAX: `fetch('assets/data/productos.json')` en `js/core/almacen.js`.
- Tree shaking manual: eliminado carrusel Bootstrap y CSS muerto, exports sin uso (`TEMPORADAS`, alias `lluviaBalones`). Verificado con script: 0 exports sin uso.

## 4. Cross-browser y reporte (20 pts)
- Cero clases tipo `.ad-banner/.banner/.sponsor/.promo` (se renombró `.cta-banner` -> `.cta-box`). Verificado con grep.
- Prueba automática (Chromium headless): 0 errores de consola, 0 overflow horizontal en 360x800, 390x844, 768x1024, 844x390 (landscape) y 1366x768.

## Evidencias que DEBES capturar tú para el PDF
1. DevTools > Toggle device toolbar: 360x800, 390x844, 768x1024 y rotar a landscape (captura de cliente.html y admin.html).
2. Network (Disable cache + recarga): mostrar peso total y que las imágenes cargan al hacer scroll (lazy).
3. Código: `delegacion-eventos.js` y `seguridad-xss.js`.
4. Abrir el mismo link en Brave y Opera y capturar sin cortes.
5. Application > Manifest / Service Workers activos.
