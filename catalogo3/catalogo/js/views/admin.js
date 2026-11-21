import { cargarTodo, getProductos, setProductos, guardarProductosEnNube, getCarrusel, setCarrusel, getLigas, setLigas, restablecerDemo, sincronizarTodo } from '../core/almacen.js';
import { LIGAS, iconoLiga } from '../core/config.js';
import { fmtBs, imgFallback, descargar } from '../core/utils.js';
import { sb, bdActiva, bdConfigurada, probarBD } from '../core/bd.js';
import { getUsuario } from '../core/auth.js';
import { normalizarImagen } from '../../semana2/03-fetch-lazyloading-dropbox/dropbox.js';
import { inicializarLazyLoading } from '../../semana2/03-fetch-lazyloading-dropbox/lazy-loading.js';
import { limpiarTexto as L } from '../../semana2/05-seguridad-xss-subida-imagen/seguridad-xss.js';
import { leerImagen, activarDropzone } from '../../semana2/05-seguridad-xss-subida-imagen/subida-imagen.js';
import { configurarDelegacionEventos as deleg } from '../../semana2/01-delegacion-eventos-hidratacion/delegacion-eventos.js';
import { toast, confirmar } from '../../semana1/05-alertas-toast/alertas.js';
import { validarFormulario, validacionEnVivo, limpiarValidacion } from '../../semana1/04-validacion-formulario/validaciones.js';
import { montarMenu } from '../../semana1/03-menu-hamburguesa/menu-hamburguesa.js';
import { observarReveal, animarContador } from '../../semana2/02-carrusel-zoom-animaciones/animaciones.js';
import { soloTexto } from '../../semana3/03-cwv-bem-dompurify-sw/sanitizar.js';
import '../../semana3/01-componentes-encapsulamiento/elite-tarjeta.js';

const $ = id => document.getElementById(id);
const src = p => normalizarImagen(p.imagen) || imgFallback(p.titulo);
let editId = null, editLiga = null, imgProd = null, imgLiga = null, imgSlide = null;
const reglas = { prodTitulo: { req: 1, min: 3, max: 60 }, prodPrecio: { req: 1, numMin: 1, numMax: 9999 }, prodStock: { req: 1, numMin: 0, numMax: 9999 } };
const reglasL = { lNombre: { req: 1, min: 2, max: 30 } };
const reglasC = { cTitulo: { req: 1, min: 3, max: 40 } };
const slug = t => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '') || 'liga' + Date.now();
const prev = (el, u, vacio = 'Vista previa') => { el.innerHTML = u ? `<img src="${L(u)}" alt="Vista previa de la imagen" onerror="this.parentElement.textContent='No se pudo cargar la imagen'">` : vacio; };

function selects() {
    const o = Object.entries(LIGAS).map(([k, v]) => `<option value="${L(k)}">${L(v.n)}</option>`).join('');
    const a = $('prodLiga').value, b = $('adminLiga').value;
    $('prodLiga').innerHTML = o; $('adminLiga').innerHTML = '<option value="todas">Todas las ligas</option>' + o;
    if (LIGAS[a]) $('prodLiga').value = a; if (b === 'todas' || LIGAS[b]) $('adminLiga').value = b;
}

function inventario() {
    const q = $('adminBuscar').value.toLowerCase().trim(), lg = $('adminLiga').value;
    const l = getProductos().filter(p => p.titulo.toLowerCase().includes(q) && (lg === 'todas' || p.liga === lg));
    $('totalInv').textContent = `(${l.length})`;
    $('contenedorAdmin').innerHTML = l.length ? l.map(p => `<div class="col-md-6 col-xxl-4 mb-4 reveal"><div class="glass-card p-3 h-100" data-id="${p.id}">
      <div class="d-flex justify-content-between mb-2"><span class="small fw-bold text-uppercase d-flex gap-2 align-items-center">${iconoLiga(p.liga, 22)} ${L(LIGAS[p.liga]?.n || p.liga)}</span><small class="t-m">${L(p.fechaCreacion || '')}</small></div>
      <div class="p-img js-ver rounded-3 mb-3" role="button" tabindex="0" aria-label="Ver detalle de ${L(p.titulo)}" style="aspect-ratio:4/3"><img loading="lazy" decoding="async" data-src="${L(src(p))}" data-fallback="${L(imgFallback(p.titulo))}" alt="${L(p.titulo)}"><div class="p-lupa">Ver detalle</div></div>
      <h6 class="fw-bold text-truncate mb-1">${L(p.titulo)}</h6><p class="t-m small text-truncate mb-2">${L(p.descripcion || 'Sin descripción')}</p>
      <div class="mb-2">${p.tallas.map(t => `<span class="badge-talla">${L(t)}</span>`).join('')}</div>
      <div class="d-flex justify-content-between align-items-center border-top pt-2 mb-3" style="border-color:var(--border)!important"><span class="p-precio">${fmtBs(p.precio)}</span>
        <span class="stock-ctl d-flex align-items-center gap-2"><button type="button" class="js-menos" aria-label="Menos stock">−</button><b class="${p.stock > 5 ? 't-g' : 'text-danger'}">${p.stock}</b><button type="button" class="js-mas" aria-label="Más stock">+</button></span></div>
      <div class="d-flex gap-2"><button type="button" class="btn btn-ghost btn-sm w-100 js-edit"><i class="fa-solid fa-pen"></i> Editar</button><button type="button" class="btn btn-outline-danger btn-sm w-100 js-del"><i class="fa-solid fa-trash"></i> Eliminar</button></div></div></div>`).join('')
      : '<div class="col-12 text-center t-m py-5"><i class="fa-solid fa-box-open fa-3x t-g mb-3"></i><h5>No hay productos. Crea el primero.</h5></div>';
    inicializarLazyLoading($('contenedorAdmin')); observarReveal($('contenedorAdmin'));
}

function ligasAdmin() {
    const prods = getProductos();
    $('listaLigas').innerHTML = Object.entries(LIGAS).map(([k, v]) => `<div class="liga-item" data-k="${L(k)}"><div class="liga-logo">${iconoLiga(k, 40)}</div>
      <div class="flex-grow-1"><b>${L(v.n)}</b><div class="small t-m">${prods.filter(p => p.liga === k).length} productos</div></div>
      <button type="button" class="btn btn-ghost btn-sm js-ledit" aria-label="Editar liga"><i class="fa-solid fa-pen"></i></button><button type="button" class="btn btn-outline-danger btn-sm js-ldel" aria-label="Eliminar liga"><i class="fa-solid fa-trash"></i></button></div>`).join('')
      || '<p class="t-m mb-0">No hay ligas registradas.</p>';
}
function resetLiga() {
    editLiga = null; imgLiga = null; $('formLiga').reset(); limpiarValidacion($('formLiga')); prev($('lPreview'), '');
    $('tituloLiga').textContent = 'Nueva liga'; $('btnLiga').textContent = 'Guardar liga'; $('btnLigaCancel').classList.add('d-none');
}

function estadisticas() {
    const l = getProductos(), uni = l.reduce((a, p) => a + p.stock, 0), val = l.reduce((a, p) => a + p.stock * p.precio, 0);
    animarContador($('sProd'), l.length); animarContador($('sUni'), uni); animarContador($('sVal'), val); animarContador($('sBajo'), l.filter(p => p.stock <= 5).length);
    const max = Math.max(1, ...Object.keys(LIGAS).map(k => l.filter(p => p.liga === k).length));
    $('barrasLigas').innerHTML = Object.entries(LIGAS).map(([k, v]) => { const n = l.filter(p => p.liga === k).length;
      return `<div class="mb-3"><div class="d-flex justify-content-between small mb-1"><span>${iconoLiga(k, 18)} ${L(v.n)}</span><b>${n}</b></div><div class="barra"><i data-w="${n / max * 100}"></i></div></div>`; }).join('');
    setTimeout(() => document.querySelectorAll('#barrasLigas i').forEach(i => i.style.width = i.dataset.w + '%'), 80);
    const bajos = l.filter(p => p.stock <= 5);
    $('listaBajo').innerHTML = bajos.length ? bajos.map(p => `<li class="d-flex justify-content-between py-2 border-bottom" style="border-color:var(--border)!important"><span>${L(p.titulo)}</span><b class="text-danger">${p.stock}</b></li>`).join('') : '<li class="t-m">Todo el stock está saludable.</li>';
}

function carrusel() {
    $('listaCarrusel').innerHTML = getCarrusel().map((c, i) => { const u = normalizarImagen(c.img);
      return `<div class="d-flex gap-3 align-items-center py-2 border-bottom" style="border-color:var(--border)!important">
      <div class="rounded-3 flex-none" style="width:80px;height:50px;background:#04361a ${u ? `center/cover url('${L(u)}')` : ''}"></div>
      <div class="flex-grow-1"><b>${L(c.titulo)}</b><div class="small t-m">${L(c.badge || '')}</div></div><button class="btn btn-outline-danger btn-sm js-delslide" data-i="${i}" aria-label="Eliminar slide"><i class="fa-solid fa-trash"></i></button></div>`; }).join('');
}

function mostrarVista(v) {
    const pant = $('pantalla-admin');
    if (!$('vista-' + v)) v = 'inventario';
    pant.querySelectorAll('.app-view').forEach(x => x.classList.toggle('active', x.id === 'vista-' + v));
    pant.querySelectorAll('[data-vista]').forEach(a => a.classList.toggle('active', a.dataset.vista === v));
    bootstrap.Offcanvas.getInstance($('menuLateral'))?.hide();
    if (v === 'estadisticas') estadisticas(); if (v === 'config') { carrusel(); estadoBD(); } if (v === 'inventario') inventario(); if (v === 'ligas') ligasAdmin(); if (v === 'usuarios') usuarios();
    window.scrollTo({ top: 0 });
}
const cambiarVistaAdmin = v => { if (location.hash === '#/admin/' + v) mostrarVista(v); else location.hash = '#/admin/' + v; };

/* ---------- Base de datos (Supabase) ---------- */
function estadoBD() {
    const ok = bdActiva(), cfg = bdConfigurada();
    $('estadoBD').innerHTML = ok ? '<i class="fa-solid fa-circle-check t-g"></i> Conectado a Supabase: los cambios se guardan en la nube.'
        : cfg ? '<i class="fa-solid fa-triangle-exclamation text-warning"></i> Hay credenciales, pero no se pudo conectar (revisa internet o la clave).'
        : '<i class="fa-solid fa-hard-drive"></i> Modo local: los datos se guardan solo en este navegador.';
    $('infoBD').textContent = ok ? 'Supabase' : 'local';
    try { const o = JSON.parse(localStorage.getItem('eliteSupabase')) || {}; $('sbUrl').value = o.url || ''; $('sbKey').value = o.key || ''; } catch { /* vacío */ }
}

/* ---------- Usuarios ---------- */
async function usuarios() {
    const c = await sb(), tb = $('tablaUsuarios'), fila = (n, e, rol, f, id, editable) => `<tr><td>${L(n)}</td><td class="text-break">${L(e)}</td><td>${editable
        ? `<select class="form-select form-select-sm campo js-rol" data-id="${L(id)}" aria-label="Rol de ${L(n)}"><option value="cliente" ${rol === 'cliente' ? 'selected' : ''}>Cliente</option><option value="admin" ${rol === 'admin' ? 'selected' : ''}>Administrador</option></select>` : `<span class="badge-talla">${L(rol)}</span>`}</td><td class="small t-m">${L(f)}</td></tr>`;
    if (!c) {
        let us = []; try { us = JSON.parse(localStorage.getItem('eliteUsuarios')) || []; } catch { /* vacío */ }
        $('usuariosInfo').textContent = 'Modo local: clientes registrados en este navegador (conecta Supabase para gestionar roles).';
        tb.innerHTML = us.length ? us.map(u => fila(u.nombre, u.email, 'cliente', '—', '', false)).join('') : '<tr><td colspan="4" class="t-m">Aún no hay clientes registrados.</td></tr>';
        return;
    }
    const { data, error } = await c.from('perfiles').select('*').order('creado', { ascending: false });
    if (error) { $('usuariosInfo').textContent = 'No se pudo leer la tabla perfiles: ' + error.message; tb.innerHTML = ''; return; }
    const { data: { session } } = await c.auth.getSession(), yo = session?.user.id;
    $('usuariosInfo').textContent = `${data.length} usuario${data.length === 1 ? '' : 's'} en Supabase.`;
    tb.innerHTML = data.map(u => fila(u.nombre || '—', u.email || '—', u.rol, new Date(u.creado).toLocaleDateString('es-BO'), u.id, u.id !== yo)).join('');
}

function tarjetaVivo() {
    const t = $('prodTarjeta'); if (!t) return;
    t.setAttribute('titulo', $('prodTitulo').value || 'Nuevo producto'); t.setAttribute('precio', $('prodPrecio').value ? fmtBs($('prodPrecio').value) : '');
    t.setAttribute('stock', $('prodStock').value); t.setAttribute('liga', LIGAS[$('prodLiga').value]?.n || '');
    t.setAttribute('imagen', imgProd || normalizarImagen($('prodImagen').value) || '');
}
function reset() {
    editId = null; imgProd = null; $('formProducto').reset(); limpiarValidacion($('formProducto')); prev($('prodPreview'), '');
    $('tituloForm').innerHTML = '<i class="fa-solid fa-plus-circle"></i> Nuevo producto'; $('btnGuardar').textContent = 'GUARDAR PRODUCTO'; $('btnCancelar').classList.add('d-none'); tarjetaVivo();
}
const subir = async (file, opt, alOk) => { try { alOk(await leerImagen(file, opt)); toast('Imagen cargada'); } catch (e) { toast(e.message, 'error'); } };

export default async function iniciarAdmin() {
    montarMenu('tplMenu', ['sideDesk', 'sideMov']);
    $('pantalla-admin').addEventListener('click', e => { const a = e.target.closest('[data-vista]'); if (a) { e.preventDefault(); cambiarVistaAdmin(a.dataset.vista); } });
    $('formProducto').addEventListener('input', tarjetaVivo);
    $('adminBuscar').oninput = inventario; $('adminLiga').onchange = inventario;

    // ---- Producto ----
    const f = $('formProducto'); validacionEnVivo(f, reglas);
    activarDropzone($('zonaImg'), $('prodArchivo'), file => subir(file, { max: 900 }, d => { imgProd = d; $('prodImagen').value = ''; prev($('prodPreview'), d); tarjetaVivo(); }));
    $('prodImagen').addEventListener('input', e => { imgProd = null; prev($('prodPreview'), normalizarImagen(e.target.value)); });
    $('btnCancelar').onclick = reset;
    f.addEventListener('submit', async e => {
        e.preventDefault(); if (!validarFormulario(f, reglas, toast)) return;
        const tallas = [...document.querySelectorAll('.talla-check:checked')].map(c => c.value);
        if (!tallas.length) return toast('Selecciona al menos una talla', 'warn');
        const raw = $('prodImagen').value.trim(); if (raw && !normalizarImagen(raw)) return toast('El enlace de imagen no es válido (usa https://)', 'error');
        const d = { titulo: $('prodTitulo').value.trim(), precio: +$('prodPrecio').value, stock: +$('prodStock').value, liga: $('prodLiga').value, temporada: $('prodTemporada').value, descripcion: soloTexto($('prodDesc').value), tallas, imagen: imgProd || raw };
        const l = getProductos();
        if (editId) { const i = l.findIndex(p => p.id === editId); l[i] = { ...l[i], ...d }; } else l.unshift({ id: Date.now(), ...d, fechaCreacion: new Date().toLocaleDateString('es-BO') });
        const guardado = await guardarProductosEnNube(l);
        if (!guardado.ok) return toast('No se guardó el producto: ' + guardado.msg, 'error');
        toast(editId ? 'Producto actualizado y sincronizado' : 'Producto registrado y sincronizado'); reset(); inventario();
    });
    deleg('#contenedorAdmin', '.js-del', 'click', async (e, t) => {
        const id = +t.closest('[data-id]').dataset.id;
        if (await confirmar('Esta acción no se puede deshacer.', { titulo: 'Eliminar producto', icono: '', ok: 'Eliminar' })) { const r = await guardarProductosEnNube(getProductos().filter(p => p.id !== id)); if (!r.ok) return toast('No se pudo eliminar: ' + r.msg, 'error'); inventario(); toast('Producto eliminado y sincronizado', 'info'); }
    });
    deleg('#contenedorAdmin', '.js-mas,.js-menos', 'click', async (e, t) => {
        const id = +t.closest('[data-id]').dataset.id, l = getProductos(), p = l.find(x => x.id === id);
        p.stock = Math.max(0, p.stock + (t.classList.contains('js-mas') ? 1 : -1)); const r = await guardarProductosEnNube(l);
        if (!r.ok) return toast('No se pudo actualizar el stock: ' + r.msg, 'error'); inventario();
    });
    deleg('#contenedorAdmin', '.js-edit', 'click', (e, t) => {
        const p = getProductos().find(x => x.id === +t.closest('[data-id]').dataset.id); editId = p.id;
        $('prodTitulo').value = p.titulo; $('prodPrecio').value = p.precio; $('prodStock').value = p.stock; $('prodLiga').value = p.liga; $('prodTemporada').value = p.temporada; $('prodDesc').value = p.descripcion || '';
        const sube = (p.imagen || '').startsWith('data:'); imgProd = sube ? p.imagen : null; $('prodImagen').value = sube ? '' : (p.imagen || ''); prev($('prodPreview'), normalizarImagen(p.imagen));
        document.querySelectorAll('.talla-check').forEach(c => c.checked = p.tallas.includes(c.value));
        $('tituloForm').innerHTML = '<i class="fa-solid fa-pen"></i> Editando producto'; $('btnGuardar').textContent = 'ACTUALIZAR PRODUCTO'; $('btnCancelar').classList.remove('d-none');
        tarjetaVivo(); window.scrollTo({ top: 0 }); toast('Modo edición activado', 'info');
    });
    deleg('#contenedorAdmin', '.js-ver', 'click', (e, t) => {
        const p = getProductos().find(x => x.id === +t.closest('[data-id]').dataset.id);
        $('imgAdminGrande').alt = p.titulo; $('imgAdminGrande').src = src(p); $('modalTitulo').textContent = p.titulo; $('modalPrecio').textContent = fmtBs(p.precio); $('modalDesc').textContent = p.descripcion || 'Sin descripción';
        $('modalLiga').innerHTML = iconoLiga(p.liga, 26) + ' ' + L(LIGAS[p.liga]?.n || p.liga); $('modalTallas').innerHTML = p.tallas.map(x => `<span class="badge-talla fs-6">${L(x)}</span>`).join('');
        new bootstrap.Modal($('modalImagenAdmin')).show();
    });

    // ---- Ligas (subir logo desde el equipo o Dropbox) ----
    const fl = $('formLiga'); validacionEnVivo(fl, reglasL);
    activarDropzone($('zonaLiga'), $('lArchivo'), file => subir(file, { max: 320, tipo: 'image/png' }, d => { imgLiga = d; $('lUrl').value = ''; prev($('lPreview'), d); }));
    $('lUrl').addEventListener('input', e => { imgLiga = null; prev($('lPreview'), normalizarImagen(e.target.value)); });
    $('btnLigaCancel').onclick = resetLiga;
    fl.addEventListener('submit', e => {
        e.preventDefault(); if (!validarFormulario(fl, reglasL, toast)) return;
        const url = $('lUrl').value.trim(), nombre = $('lNombre').value.trim();
        if (url && !normalizarImagen(url)) return toast('El enlace del logo no es válido', 'error');
        const ligas = { ...getLigas() }, key = editLiga || slug(nombre);
        if (!editLiga && ligas[key]) return toast('Esa liga ya existe', 'warn');
        ligas[key] = { n: nombre, logo: imgLiga || url || (editLiga ? ligas[key].logo : '') };
        if (!setLigas(ligas)) return toast('Almacenamiento lleno: usa un logo más pequeño', 'error');
        toast(editLiga ? 'Liga actualizada' : 'Liga agregada'); resetLiga(); selects(); ligasAdmin();
    });
    deleg('#listaLigas', '.js-ledit', 'click', (e, t) => {
        const k = t.closest('[data-k]').dataset.k; editLiga = k; imgLiga = null;
        $('lNombre').value = LIGAS[k].n; $('lUrl').value = ''; prev($('lPreview'), normalizarImagen(LIGAS[k].logo));
        $('tituloLiga').textContent = 'Editando liga'; $('btnLiga').textContent = 'Actualizar liga'; $('btnLigaCancel').classList.remove('d-none');
        window.scrollTo({ top: 0, behavior: 'smooth' }); toast('Sube un logo nuevo o deja el actual', 'info');
    });
    deleg('#listaLigas', '.js-ldel', 'click', async (e, t) => {
        const k = t.closest('[data-k]').dataset.k;
        if (getProductos().some(p => p.liga === k)) return toast('Hay productos en esta liga. Cámbialos o elimínalos primero', 'warn');
        if (Object.keys(LIGAS).length <= 1) return toast('Debe quedar al menos una liga', 'warn');
        if (await confirmar(`Se eliminará la liga "${LIGAS[k].n}".`, { titulo: 'Eliminar liga', icono: '', ok: 'Eliminar' })) {
            const ligas = { ...getLigas() }; delete ligas[k]; setLigas(ligas); selects(); ligasAdmin(); toast('Liga eliminada', 'info');
        }
    });

    // ---- Configuración / carrusel ----
    const fc = $('formCarrusel'); validacionEnVivo(fc, reglasC);
    activarDropzone($('zonaSlide'), $('cArchivo'), file => subir(file, { max: 1600, q: .8 }, d => { imgSlide = d; $('cUrl').value = ''; prev($('cPreview'), d); }));
    $('cUrl').addEventListener('input', e => { imgSlide = null; prev($('cPreview'), normalizarImagen(e.target.value)); });
    fc.addEventListener('submit', e => {
        e.preventDefault(); if (!validarFormulario(fc, reglasC, toast)) return;
        const url = $('cUrl').value.trim(); if (url && !normalizarImagen(url)) return toast('Enlace de imagen no válido', 'error');
        const c = getCarrusel().slice(); c.push({ img: imgSlide || url, titulo: $('cTitulo').value.trim(), badge: $('cBadge').value.trim(), texto: $('cTexto').value.trim() });
        if (!setCarrusel(c)) return toast('Almacenamiento lleno: usa un enlace de Dropbox', 'error');
        imgSlide = null; fc.reset(); limpiarValidacion(fc); prev($('cPreview'), ''); carrusel(); toast('Slide agregado al carrusel');
    });
    deleg('#listaCarrusel', '.js-delslide', 'click', (e, t) => { const c = getCarrusel().slice(); if (c.length <= 1) return toast('Debe quedar al menos un slide', 'warn'); c.splice(+t.dataset.i, 1); setCarrusel(c); carrusel(); toast('Slide eliminado', 'info'); });
    $('btnExportar').onclick = () => { descargar('productos-elite.json', JSON.stringify(getProductos(), null, 2)); toast('Inventario exportado'); };
    $('btnReset').onclick = async () => { if (await confirmar('Se borrarán productos, ligas, favoritos y carrusel personalizados de ESTE navegador.', { titulo: 'Restablecer demo', icono: '', ok: 'Restablecer' })) { restablecerDemo(); location.reload(); } };

    // ---- Base de datos (Supabase) ----
    $('btnGuardarBD').onclick = () => {
        const url = $('sbUrl').value.trim(), key = $('sbKey').value.trim();
        const urlLimpia = url.replace(/\/rest\/v1\/?$/i, '').replace(/\/$/, '');
        if (!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/i.test(urlLimpia)) return toast('La URL debe ser la Project URL, por ejemplo https://xxxx.supabase.co (sin /rest/v1)', 'error');
        if (key.length < 20) return toast('Pega la anon / publishable key completa', 'error');
        localStorage.setItem('eliteSupabase', JSON.stringify({ url: urlLimpia, key })); toast('Credenciales guardadas. Reiniciando…'); setTimeout(() => location.reload(), 900);
    };
    $('btnProbarBD').onclick = async () => { const r = await probarBD(); toast(r.msg, r.ok ? 'ok' : 'error'); estadoBD(); };
    $('btnSincronizar').onclick = async () => {
        if (!bdActiva()) return toast('Primero conecta Supabase', 'warn');
        if (!await confirmar('Se enviarán a Supabase los productos, ligas y slides que hay en este navegador.', { titulo: 'Subir datos', icono: '', ok: 'Subir' })) return;
        const r = await sincronizarTodo(); toast(r.msg, r.ok ? 'ok' : 'error');
    };
    $('btnQuitarBD').onclick = async () => { if (await confirmar('La app volverá a guardar los datos solo en este navegador.', { titulo: 'Volver al modo local', icono: '', ok: 'Volver' })) { localStorage.removeItem('eliteSupabase'); location.reload(); } };
    $('btnRecargarUsuarios').onclick = usuarios;
    deleg('#tablaUsuarios', '.js-rol', 'change', async (e, t) => {
        const c = await sb(); if (!c) return;
        const { error } = await c.from('perfiles').update({ rol: t.value }).eq('id', t.dataset.id);
        toast(error ? 'No se pudo cambiar el rol: ' + error.message : 'Rol actualizado', error ? 'error' : 'ok');
    });

    return {
        mostrarVista,
        async entrar() { await cargarTodo(); selects(); inventario(); tarjetaVivo(); estadoBD(); toast(`Panel listo, ${getUsuario().nombre.split(' ')[0]}`, 'info'); }
    };
}
