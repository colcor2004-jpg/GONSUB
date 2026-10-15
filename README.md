# 🛵 GONSUB — Plataforma de Transporte, Encomiendas y Delivery

Aplicación web responsiva (móvil + escritorio) construida con **HTML + CSS + JavaScript puro**, con
persistencia en **localStorage** (sin backend). Simula registro, pedidos, carreras y administración.

## 📁 Estructura

```
gonsub/
├── index.html        → Estructura principal (SPA)
├── css/styles.css    → Tema oscuro, amarillo/verde neón, diseño responsive
└── js/app.js         → Toda la lógica (auth, roles, tarifas, pedidos, admin)
```

## ▶️ Cómo probarlo en local

Opción 1 (la más simple): doble clic en `index.html` (funciona en Chrome, Edge, Firefox).

Opción 2 (recomendada, servidor local):

```bash
cd gonsub
python -m http.server 8080
# abre http://localhost:8080
```

> Nota: las fuentes de Google requieren internet; sin conexión la app usa fuentes del sistema igualmente.

## 👥 Cuentas demo precargadas

| Rol          | Correo              | Contraseña | Notas                        |
|--------------|---------------------|------------|------------------------------|
| 👑 Admin      | admin@gonsub.com    | admin123   | Estadísticas, usuarios, tarifas |
| 🏍️ Motorizado | carlos@gonsub.com   | demo123    | Aprobado y disponible        |
| 🏍️ Motorizado | luis@gonsub.com     | demo123    | **Pendiente de aprobación**  |
| 🛍️ Cliente    | maria@gonsub.com    | demo123    | Con historial de pedidos     |

## 🔄 Flujo para probar el sistema completo

1. **Cliente** (maria@gonsub.com) → solicita un Delivery / Carrera / Encomienda → se crea en estado *Pendiente*.
2. **Motorizado** (carlos@gonsub.com) → activa "Disponible", acepta la carrera (pasa a *Ocupado*) →
   la avanza: *Aceptada → En camino → Entregada* (al entregar vuelve a *Disponible*).
3. **Admin** (admin@gonsub.com) → ve estadísticas del día, carreras en tiempo real, aprueba a *luis*,
   gestiona usuarios y edita tarifas base / por km / comisión.
4. Para reiniciar la demo, en la consola del navegador ejecuta: `G.resetDemo()`

## ✨ Funcionalidades

- Cotizador de tarifa en tiempo real (base + $/km) según el servicio.
- 3 roles con paneles independientes y navegación inferior estilo app móvil.
- Panel admin: KPIs del día, solicitudes "en vivo" (auto-refresh cada 10 s),
  aprobación/suspensión de motorizados, control de tarifas y comisiones.
- Estados de pedido: `pendiente → aceptada → en_camino → entregada`, con historial.
- Toasts de notificación, modales y diseño mobile-first.
