-- =====================================================================
-- Sistema VB · Medicinal Terps · migración 04 (2026-11-02) — ADITIVA E IDEMPOTENTE
-- El sistema de la organización está en uso: «Empezar de cero» deja de existir en la app.
-- La función vaciar_datos queda sólo para soporte desde el SQL Editor (nadie la puede llamar
-- desde un navegador, ni siquiera un administrador). No borra ni modifica datos.
-- =====================================================================
revoke execute on function public.vaciar_datos() from public, anon, authenticated;
