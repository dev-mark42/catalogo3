// Roles y sesión: "cliente" y "admin".
// Con Supabase: Supabase Auth (correo + contraseña) y rol en la tabla `perfiles`.
// Sin Supabase (modo local): clientes en localStorage con hash SHA-256 y admin demo.
import { ADMIN_USER, ADMIN_PASS, ADMIN_EMAIL_DOMINIO } from './config.js';
import { sb } from './bd.js';
import { limpiarFavsLocales } from './almacen.js';

const KR = 'eliteRol', KU = 'eliteUsuario', KL = 'eliteUsuarios';
const leer = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const avisar = () => document.dispatchEvent(new CustomEvent('auth:cambio'));

export const getRol = () => localStorage.getItem(KR);
export const getUsuario = () => leer(KU, { nombre: 'Invitado', email: '' });
export const esInvitado = () => !!getUsuario().invitado;

async function hash(s) {
    try {
        const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('elite|' + s));
        return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
    } catch { return btoa(unescape(encodeURIComponent('elite|' + s))); }
}
function iniciar(rol, usuario) {
    localStorage.setItem(KR, rol); localStorage.setItem(KU, JSON.stringify(usuario));
    return { ok: true, rol };   // la pantalla cambia cuando login.js dispara 'auth:cambio' (tras la animación)
}
const TRAD = [['Invalid login credentials', 'Correo o contraseña incorrectos'], ['already registered', 'Ese correo ya está registrado'],
    ['Email not confirmed', 'Confirma tu correo antes de entrar'], ['at least 6', 'La contraseña debe tener mínimo 6 caracteres'],
    ['rate limit', 'Demasiados intentos. Espera un momento'], ['Failed to fetch', 'Sin conexión con el servidor']];
const traducir = m => (TRAD.find(([a]) => (m || '').includes(a)) || [0, m || 'Error inesperado'])[1];

async function perfilDe(c, user) {
    const { data } = await c.from('perfiles').select('nombre,rol').eq('id', user.id).maybeSingle();
    return { nombre: data?.nombre || user.user_metadata?.nombre || user.email, rol: data?.rol || 'cliente' };
}

export async function registrar({ nombre, email, tel, pass }) {
    email = email.trim().toLowerCase(); nombre = nombre.trim();
    const c = await sb();
    if (c) {
        const { data, error } = await c.auth.signUp({ email, password: pass, options: { data: { nombre, telefono: tel } } });
        if (error) return { ok: false, msg: traducir(error.message) };
        if (!data.session) return { ok: true, pendiente: true, msg: 'Cuenta creada. Revisa tu correo para confirmarla y luego ingresa.' };
        return iniciar('cliente', { nombre, email });
    }
    const us = leer(KL, []);
    if (us.some(u => u.email === email)) return { ok: false, msg: 'Ese correo ya está registrado' };
    us.push({ nombre, email, tel, hash: await hash(pass) });
    localStorage.setItem(KL, JSON.stringify(us));
    return iniciar('cliente', { nombre, email });
}

export async function loginCliente(email, pass) {
    email = email.trim().toLowerCase();
    const c = await sb();
    if (c) {
        const { data, error } = await c.auth.signInWithPassword({ email, password: pass });
        if (error) return { ok: false, msg: traducir(error.message) };
        const p = await perfilDe(c, data.user);
        return iniciar(p.rol, { nombre: p.nombre, email });
    }
    const u = leer(KL, []).find(x => x.email === email);
    if (!u || u.hash !== await hash(pass)) return { ok: false, msg: 'Correo o contraseña incorrectos' };
    return iniciar('cliente', { nombre: u.nombre, email: u.email });
}

export async function loginAdmin(user, pass) {
    const u = user.trim().toLowerCase(), c = await sb();
    if (c) {
        const email = u.includes('@') ? u : u + ADMIN_EMAIL_DOMINIO;
        const { data, error } = await c.auth.signInWithPassword({ email, password: pass });
        if (error) return { ok: false, msg: traducir(error.message) };
        const p = await perfilDe(c, data.user);
        if (p.rol !== 'admin') { await c.auth.signOut(); return { ok: false, msg: 'Esta cuenta no tiene permisos de administrador' }; }
        return iniciar('admin', { nombre: p.nombre, email });
    }
    if (![ADMIN_USER, ADMIN_USER + ADMIN_EMAIL_DOMINIO].includes(u) || pass !== ADMIN_PASS) return { ok: false, msg: 'Credenciales de administrador incorrectas' };
    return iniciar('admin', { nombre: 'Administrador', email: ADMIN_USER + ADMIN_EMAIL_DOMINIO });
}

export const entrarInvitado = () => iniciar('cliente', { nombre: 'Invitado', email: '', invitado: true });

/** Al abrir la app: comprueba que la sesión guardada siga vigente en Supabase (y que el rol no haya cambiado). */
export async function validarSesion() {
    if (!getRol() || esInvitado()) return !!getRol();
    const c = await sb(); if (!c) return true;
    const { data: { session } } = await c.auth.getSession();
    if (!session) { localStorage.removeItem(KR); localStorage.removeItem(KU); return false; }
    const p = await perfilDe(c, session.user);
    if (p.rol !== getRol()) localStorage.setItem(KR, p.rol);
    return true;
}

export async function logout() {
    const c = await sb();
    if (c) { try { await c.auth.signOut(); } catch { /* sin red */ } limpiarFavsLocales(); }
    localStorage.removeItem(KR); localStorage.removeItem(KU);
    avisar();
}
