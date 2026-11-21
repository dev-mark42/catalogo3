// Conexión a Supabase (se descarga solo si hay credenciales). Sin credenciales => modo local.
import { credencialesBD } from './config.js';

let cliente = null, intento = false;
export const bdConfigurada = () => !!credencialesBD();

export async function sb() {
    if (cliente || intento) return cliente;
    const c = credencialesBD();
    if (!c) {
        console.info('[Supabase] Sin credenciales válidas → modo LOCAL');
        return null;
    }
    console.info('[Supabase] Conectando a', c.url);
    intento = true;
    try {
        const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm');
        cliente = createClient(c.url, c.key, { auth: { persistSession: true, autoRefreshToken: true } });
        console.info('[Supabase] Cliente creado OK');
    } catch (e) {
        cliente = null;
        console.warn('[Supabase] No disponible:', e);
        document.dispatchEvent(new CustomEvent('bd:error', { detail: 'No se pudo inicializar Supabase. Revisa conexión, Project URL y clave.' }));
    }
    return cliente;
}
export const bdActiva = () => !!cliente;
export const avisarError = msg => document.dispatchEvent(new CustomEvent('bd:error', { detail: msg }));

/** Prueba rápida de conexión (para el panel Configuración). */
export async function probarBD() {
    const c = await sb();
    if (!c) return { ok: false, msg: 'Faltan credenciales o no se pudo cargar Supabase.' };
    const { error } = await c.from('ligas').select('clave', { head: true, count: 'exact' });
    return error ? { ok: false, msg: error.message } : { ok: true, msg: 'Conexión correcta con Supabase' };
}
