# Panel Pandito

Herramienta interna (dos usuarios). **Borrador provisional**, pendiente de aprobación del equipo. App separada de la web pública: comparten solo la base de datos (`../supabase`).

## Estado

| Módulo | Estado |
|---|---|
| Ingreso con correo y contraseña; solo entra quien está en la tabla `staff` | Hecho (sin probar contra Supabase real) |
| Precios: tamaños, materiales, acabados y tabla de precios | Hecho (sin probar) |
| Catálogo: diseños, colecciones, variantes (condición, precio propio, publicación con validación mínima) | Hecho |
| Imágenes: portada, carrusel, orden, texto alternativo, ocultar y quitar; miniaturas en catálogo, stock y grilla | Hecho (requiere 0005; sin probar contra Supabase real) |
| Doble factor de autenticación (TOTP): vincular app, pedir código en cada sesión. Para que la base también lo exija, aplicar `../supabase/migrations/0006_require_mfa.sql` **después** de que las dos personas hayan vinculado su app. Supabase no da códigos de recuperación: si alguien pierde el celular, se borra su factor desde Authentication en el dashboard | Hecho (sin probar contra Supabase real; 0006 validada en local) |
| Grilla rápida de ventas (venta/regalo, medio de pago, descuento manual), tickets y anulación con motivo | Hecho (sin probar contra Supabase real; muestra la portada si existe) |
| Eventos: alta, activar, HOY, stock llevado y cierre con conteo | Hecho (sin probar contra Supabase real) |
| Stock: vista por variante, alerta de reposición, movimientos manuales (ingreso, ajuste, exhibición, dañado, faltante) e historial filtrable. Las reservas no se habilitan en el MVP (INVENTORY-009) | Hecho (sin probar contra Supabase real) |
| Promociones y franjas de entrega: alta y edición, packs activables, vigencia opcional, cupo y nota | Hecho (sin probar contra Supabase real). Las promos no se aplican solas en la grilla: reglas de combinación sin definir (PROMO-006) |
| Solicitudes (web, WhatsApp, manual): listado con filtro, detalle con productos y precio congelado, franja, referencia de WhatsApp, estados con motivo de cancelación. Cambiar el estado nunca mueve stock (ORDER-008) | Hecho (sin probar contra Supabase real). Transiciones provisionales (ORDER-004); la web aún no registra solicitudes (ORDER-001); reservas no habilitadas |
| Descargas gratuitas (archivo y vista previa, publicación con condiciones de uso), temas (alta, familia, popular, asignación a diseños y descargas) y orden de destacados en el Home | Hecho (sin probar contra Supabase real). Las descargas no se pueden publicar sin condiciones de uso; falta confirmar licencias de cada contenido |
| Tiradas (`print_runs`, costo por unidad) y gastos (por categoría, vinculados a tirada, total mensual). El ingreso de unidades de una tirada se registra en Stock | Hecho (sin probar contra Supabase real) |
| Exportación a Excel (CSV): movimientos de stock con las columnas de CLOSE-007 (global con rango de fechas, o por evento) y cierre del evento. Solo lectura | Hecho (sin probar contra Supabase real). Es CSV y no .xlsx para no sumar dependencias; falta validarlo contra el Excel histórico (CLOSE-008) |

## Puesta en marcha

1. Crear un proyecto Supabase **de desarrollo** y aplicar `../supabase/migrations/*.sql` y `../supabase/seed.sql`.
2. Crear los dos usuarios en Authentication y darlos de alta en la tabla `staff` (`user_id`, `display_name`) desde el dashboard.
3. Copiar `.env.example` a `.env` y completar URL y clave **anon** (nunca la service role).
4. `npm install` y `npm run dev`.

## Notas

- `index.html` lleva `noindex`. Al publicarlo, agregar también `X-Robots-Tag` en el hosting (BASE-008).
- Los tipos de `src/data/types.ts` son manuales: si cambia el esquema, actualizarlos.
