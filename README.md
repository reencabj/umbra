# UMBRA — Ventas y stock semanal RP

Aplicación privada de operaciones para un servidor de GTA V Roleplay. React, Vite, TypeScript, Tailwind CSS, Lucide, Recharts y Supabase. Interfaz en español y escala de grises, responsive y navegación mediante hash compatible con GitHub Pages. Una sola sección **Stock semanal** reúne los consumos, límites y excepciones de cada banda.

**Aplicación:** https://reencabj.github.io/umbra/ · **Repositorio:** https://github.com/reencabj/umbra

Primero elegí **Primera vez · Activar cuenta autorizada**, usá el correo administrador autorizado durante la instalación y una contraseña propia de al menos 12 caracteres. Confirmá el correo antes de ingresar. El stock es el cupo semanal de cada banda; UMBRA tiene disponibilidad ilimitada.

## Ejecutar y verificar

Requiere Node.js 24 y npm. Las versiones exactas y el árbol de dependencias están fijados en `package-lock.json`.

```sh
npm ci
cp .env.example .env
# Completar URL y clave publicable de Supabase.
npm run dev
npm run check
npm run test:e2e
```

`npm run check` ejecuta 18 pruebas unitarias, las invariantes PostgreSQL en PGlite y la compilación TypeScript/Vite. `npm run test:e2e` comprueba el acceso privado, la navegación responsive y el catálogo compacto con bloqueo preventivo de cupos. El caso E2E completo se habilita solo con `E2E_LIVE=1` y una cuenta temporal expresamente autorizada, suministrada localmente en `work/qa-account.json`. No se guardan credenciales de prueba en GitHub.

## Base de datos y seguridad

Las migraciones versionadas están en `supabase/migrations/`, en orden de aplicación. La base contiene organizaciones, contactos, categorías, productos, precios, excepciones, combos, pedidos, detalles, movimientos, configuración, usuarios autorizados y auditoría. No se exponen claves secretas ni de servicio al navegador.

El primer correo administrador se autoriza de forma privada durante la instalación, sin incluir direcciones personales en el repositorio. Para una instalación independiente, un administrador de la base ejecuta:

```sql
insert into public.authorized_users(email,role)
values (lower('TU_CORREO'), 'admin');
```

Después, la persona utiliza **Activar cuenta autorizada** en el acceso, confirma su correo y entra con su contraseña. En Supabase Auth, configurar `Site URL` y las URLs de redirección permitidas con la URL de Pages y la URL local de desarrollo. Activar confirmación de correo. El resto de usuarios se autoriza desde Configuración. Un usuario no autorizado no puede crear perfil ni leer ventas.

Para enviar confirmaciones a operadores ajenos al equipo de Supabase hace falta un proveedor SMTP propio: el correo incorporado de Supabase restringe destinatarios y frecuencia. Configurarlo en Supabase Auth siguiendo https://supabase.com/docs/guides/auth/auth-smtp. No incluir claves SMTP en el frontend ni en GitHub.

En UMBRA ya está configurado Gmail mediante `smtp.gmail.com:465`, con nombre remitente UMBRA y contraseña de aplicación. Se comprobó la llegada de un correo real de recuperación. Los operadores pueden activar sus cuentas después de que un administrador autorice su dirección. Para una futura aplicación de `supabase/config.toml`, proporcionar `UMBRA_SMTP_USER` y `UMBRA_SMTP_PASSWORD` en el entorno privado del administrador. No confundir estas variables del servidor con las variables públicas `VITE_*`.

- Administradores: configuración, productos/precios, categorías/cupos, organizaciones/contactos y usuarios.
- Operadores: registrar/editar/anular pedidos, consultar catálogo, organizaciones, límites, historial y reportes.
- RLS protege todas las tablas. El bucket privado `product-photos` solo permite lectura a miembros autorizados y escritura a administradores.
- Los roles se consultan en tablas protegidas, nunca en metadatos editables del usuario. Deshabilitar un correo bloquea inmediatamente las consultas y operaciones aunque su token todavía sea válido.
- Las funciones públicas llaman funciones privadas con comprobaciones explícitas. Se revoca su ejecución anónima. Las ventas y los movimientos no admiten escrituras directas desde el cliente.

## Reglas operativas

| Estado | Consume stock/cupo semanal de la banda | Suma facturación |
|---|---|---|
| Pendiente | Sí | No |
| Confirmada | Sí | Sí |
| Entregada | Sí, sin volver a descontar | Sí |
| Anulada | No; libera el consumo previo | No |

Los cupos suman todos los productos de una categoría, todos los pedidos válidos y ambos métodos de pago. Los productos archivados conservan sus ventas. **UMBRA tiene disponibilidad ilimitada. El stock significa exclusivamente cuánto puede comprar cada banda por semana. No hay carga inicial de depósito, bloqueos por existencias ni descuento físico al entregar.** Las columnas y movimientos del esquema inicial se conservan por compatibilidad y auditoría, pero no se utilizan en la operación actual.

Cada operación de pedido toma un bloqueo transaccional breve sobre la fila de configuración. Esto serializa las validaciones finales y evita que dos ventas simultáneas sobrepasen el cupo de una banda. Es adecuado para la carga operativa de este sistema. Todos los cambios se revierten si una validación falla.

La clave de solicitud evita duplicados al reintentar una creación. El número de versión rechaza ediciones desactualizadas. Editar reemplaza los detalles dentro de la misma transacción y ajusta las cantidades previas; no genera otra venta ni duplica facturación. Anular es idempotente.

Los precios se expresan en pesos enteros. El lavado se almacena en puntos básicos (50% = 5000). Se redondea **una sola vez por pedido**, con mitades hacia arriba: `floor((subtotal × bps + 5000) / 10000)`. Los pedidos guardan sus precios, nombres y porcentaje. Las ediciones conservan los precios de líneas existentes si mantienen el método de pago; los productos nuevos o un cambio de método toman los precios vigentes. Importe máximo por pedido: 9 billones de pesos, dentro del rango entero exacto del cliente.

Zona horaria operativa: `America/Argentina/Buenos_Aires`. Reinicio predeterminado: lunes 00:00. No se borran consumos: se calcula el período. Cambiar el reinicio redefine la ventana actual utilizando las fechas originales. Los pedidos conservan además su período original para auditoría. Las fechas históricas sin hora se asignan internamente al inicio de esa fecha para calcular el período, pero nunca se muestran como una hora conocida.

## Funciones

- Dashboard calculado con ventas reales, distribución Blanco/Negro, ranking, unidades y pedidos recientes.
- Nueva venta con imágenes privadas, búsqueda, categorías, combos, cantidades rápidas, cupos y total en vivo.
- Productos dinámicos con precios independientes, activación/archivo y fotos optimizadas a WebP hasta 1000 px / 2 MB.
- Organizaciones con identificador único, estado de contacto, notas, historial, gasto, última compra y cupos.
- Stock semanal por organización y categoría: consumo, disponibilidad, porcentaje y reinicio.
- Categorías y límites configurables, sin límite/bloqueo, excepciones por organización y reinicio editable.
- Tickets compactos/detallados, copia para Discord, exportación PNG y reapertura desde el historial.
- Pedidos con fechas, filtros, orden por total, edición, duplicación y anulación.
- Reportes diarios con ventas por organización, contactos sin respuesta, resumen de productos, filtros Blanco/Negro, lavado separado, CSV y Excel.
- Configuración de identidad, recargo, tickets/reportes, combos y acceso por roles.

## Importación histórica opcional

Desde **Configuración → Importar ventas históricas** se importan los diez pedidos blancos del 27/10/2026 por **$1.134.000**, más Reds Rows, Rust y Legacy como contactos sin respuesta. El procedimiento valida los importes y usa claves únicas para no duplicar registros. No inventa horas ni modifica el stock físico actual. Solo consume cupos en el período original.

Los pedidos importados se pueden consultar, duplicar, anular y corregir como administrador. La corrección conserva su fecha sin inventar hora, mantiene los precios de líneas existentes y queda auditada; reimportar no duplica ni sobrescribe una corrección.

## GitHub Pages

El flujo `.github/workflows/pages.yml` instala dependencias, ejecuta pruebas, compila y publica `dist`. Usa las variables públicas de Actions `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`; jamás agregar una clave `service_role` o secreta. Configurar Pages con origen **GitHub Actions**. Base del despliegue: `/umbra/`.

Las rutas utilizan `/#/sales`, `/#/orders`, etc., de modo que actualizar una ruta interna conserva el punto de entrada de Pages. Supabase mantiene los datos privados aunque el sitio y el código estático sean públicos.

## Comprobaciones y operación

`tests/invariants.sql` prueba autorización, reinicio argentino, importación exacta/idempotente, ausencia de horas inventadas, conservación de precios, creación dinámica, cupos compartidos/acumulados, reservas, entrega, edición, versión desactualizada, anulación, disponibilidad ilimitada de UMBRA, redondeo y acceso anónimo/revocado. Su transacción termina en `ROLLBACK`; también se ha diseñado para ejecutarse sobre UMBRA sin dejar ventas de prueba.

Las pruebas E2E completas cubren fotografías reales en Storage, venta negra, ticket/copiar/PNG, edición conservando precios, entrega/anulación y liberación de cupos, límites compartidos, CSV/Excel, navegación móvil y actualización de rutas. `docs/VALIDACION.md` registra los resultados efectivamente verificados y las limitaciones pendientes.

Antes de operar: activar el administrador, crear organizaciones y revisar categorías/precios. No es necesario cargar stock físico. El historial de prueba y sus credenciales se retiran al cerrar la verificación.

Para recuperación y continuidad, usar las copias de seguridad de Supabase y exportaciones periódicas de reportes. Las migraciones son aditivas; no restaurar una base de producción vacía para corregir errores. El sitio puede volver a un commit anterior conservando la base, siempre que sea compatible con el esquema aplicado.
