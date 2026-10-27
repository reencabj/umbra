# Validación de UMBRA

Fecha: 27/10/2026. Regla vigente confirmada por el usuario: UMBRA tiene disponibilidad ilimitada; el stock es el cupo semanal de cada banda.

## Pseudónimos y acceso

- El primer ingreso requiere elegir un pseudónimo de 3 a 24 caracteres, guardado en el perfil y normalizado a mayúsculas. La base impide nombres duplicados y valida el formato. Cada persona puede modificar únicamente su propio nombre mediante una función protegida; los roles, el correo y la autorización permanecen protegidos.
- El nombre aparece en el menú, las iniciales y la administración de usuarios. Puede editarse desde el perfil del menú lateral. Los miembros existentes eligen su nombre en su próximo acceso a la versión nueva; no se asignaron nombres inventados.
- Acceso, recuperación y elección de nombre comparten una tarjeta alineada. Se verificaron el centrado y los anchos del formulario en 1920×1080, y la visualización en 390×844.
- Pasaron 25 pruebas unitarias, las invariantes PostgreSQL y siete pruebas locales de navegador. La prueba nueva cubre nombre obligatorio, rechazo de duplicados, persistencia al recargar y edición posterior. Las validaciones de pseudónimos también pasaron en Supabase dentro de una transacción finalizada con ROLLBACK, sin cuentas de prueba persistentes.

## Carga de fotografías

- Las siete fotos operativas ya estaban optimizadas a WebP y sumaban unos 18 KB. Cada montaje del componente solicitaba un enlace firmado por foto, cambiando la URL de caché. La prueba local reprodujo 14 peticiones individuales durante el montaje con React StrictMode.
- Se agrupan las firmas en una solicitud, se deduplican pedidos simultáneos y se reutilizan los enlaces durante 55 minutos. La caché de la pestaña sobrevive a recargas, pertenece al usuario actual y se elimina al cerrar sesión. Los enlaces se renuevan antes de vencer; una foto reemplazada tiene una ruta nueva.
- Regresión verificada: siete fotos usan una solicitud inicial y ninguna firma adicional al ir a Productos, volver a Nueva venta y recargar. Las direcciones se mantienen iguales para aprovechar la caché del navegador. No se midió una reducción exacta en segundos sobre la conexión del titular.
- Pasaron 25 pruebas unitarias y seis pruebas locales de navegador. Se cubren expiración, fallos recuperables, almacenamiento bloqueado, aislamiento de usuarios y descarte de respuestas de sesiones anteriores. La prueba que crea datos reales no se ejecutó en esta revisión.

## Revisión visual y de cupos

- Logo original del titular incorporado, conservando transparencia y proporciones, en acceso, recuperación, barra lateral, cabecera móvil, comprobantes y sus PNG, favicon y acceso directo móvil. Cinco pruebas de navegador locales pasaron; incluyen carga real de la imagen, ruta del favicon y exportación PNG con logo.

- Interfaz en escala de grises, marca UMBRA sin subtítulos de RP y una sola sección Stock semanal. El enlace antiguo de inventario redirige a esa sección.
- Ítems compactos con imagen cuadrada de 64 px en escritorio y 52 px en celular, precio unitario y controles de cantidad. Tres columnas en celular de 390 px, sin desbordamiento horizontal.
- Los botones + de todos los productos de una categoría se bloquean al alcanzar el cupo. Las cantidades escritas se ajustan al máximo permitido; quitar unidades libera capacidad inmediatamente. Los combos que no entran completos quedan deshabilitados. Cambiar de organización o duplicar un pedido ajusta el carrito al cupo disponible.
- 18 pruebas unitarias y las invariantes PostgreSQL pasaron. Cuatro pruebas de navegador locales pasaron, incluidas las dos nuevas pruebas de catálogo y navegación responsive con datos aislados. El caso que crea datos reales en Supabase se omite en esta revisión; la prueba completa anterior continúa documentada abajo.

## Verificado

- 12 pruebas unitarias: precios blancos/negros, lavado una sola vez, redondeo entero, ventanas semanales argentinas, tickets y reportes.
- Migraciones completas y pruebas de integración en PostgreSQL mediante PGlite; las mismas invariantes ejecutadas en Supabase con ROLLBACK.
- Importación de diez ventas blancas por $1.134.000, idempotencia, tres contactos sin respuesta, fecha sin hora inventada y asociación al período original.
- Cupos compartidos entre productos, acumulados por organización, excepciones, bloqueo de excesos, edición sin duplicación, precios históricos y anulación.
- Corrección histórica exclusiva de administrador, conservando fecha, precios y auditoría.
- Creación de productos y ventas sin cargar existencias físicas. Entregar no descuenta dos veces el cupo.
- Dos peticiones simultáneas para el último cupo de una categoría: una aceptada y una bloqueada. Dos bandas diferentes pueden comprar simultáneamente con cero existencias físicas.
- RLS: administrador, operador, acceso anónimo y revocación inmediata. Fotografías en bucket privado.
- Navegador Chrome real: acceso, organización/contacto, categoría, productos dinámicos, subida y vista de foto, venta negra, copiar ticket, PNG, edición conservando precio, entrega, límites, CSV, Excel y anulación liberando cupo.
- Escritorio 1440×1000 y celular 390×844; sin desbordamiento horizontal y actualización de rutas internas.
- Compilación TypeScript/Vite. Dependencias fijadas; auditoría npm sin vulnerabilidades conocidas al instalar.

## Publicación

GitHub Actions completó pruebas, compilación y despliegue: https://github.com/reencabj/umbra/actions/runs/40470997437.

URL verificada: https://reencabj.github.io/umbra/. Los tres casos de navegador pasaron contra esa URL, incluido el flujo completo con Supabase real. Se verificaron la firma del PNG, la venta y el importe $52.500 dentro del CSV y del Excel, además de la hoja de detalle de productos.

Limpieza completada y consultada en la base: cero cuentas temporales, cero fotos de prueba, cero pedidos y cero organizaciones de prueba. Permanecen siete productos, cinco categorías y un correo administrador autorizado. La contraseña temporal fue retirada; ninguna credencial de prueba se publicó en el repositorio.

## Alcance y pasos del titular

- El administrador del titular ya está registrado y su correo confirmado. Cada operador debe ser autorizado desde Configuración y activar su propia cuenta.
- Gmail SMTP configurado con puerto 465, nombre remitente UMBRA y contraseña de aplicación generada personalmente por el titular. Se verificó el envío de recuperación de Supabase y su llegada a la bandeja de entrada el 27/10/2026 a las 05:21 de Argentina. La contraseña de aplicación se guardó únicamente en Supabase; no está en GitHub ni en los archivos entregados. La prueba no cambió la contraseña de acceso del usuario.
- Crear organizaciones y revisar precios/cupos; no se necesita stock inicial de UMBRA.
- La importación histórica es opcional y no se ejecuta sobre los datos operativos durante las pruebas.
- El asesor de seguridad de Supabase señala que la protección adicional contra contraseñas filtradas está desactivada. Supabase la ofrece desde el plan Pro: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection. Se exige contraseña de al menos 12 caracteres y correo confirmado. No se contrató un plan pago.
- Las tablas antiguas de existencias físicas se conservan por compatibilidad y auditoría, pero no limitan nuevas ventas ni se ofrecen en la operación actual.
