# Validación de UMBRA

Fecha: 27/10/2026. Regla vigente confirmada por el usuario: UMBRA tiene disponibilidad ilimitada; el stock es el cupo semanal de cada banda.

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

- Activar la cuenta administradora autorizada y confirmar el correo. El ingreso con la cuenta temporal está probado; la entrega del mensaje de confirmación al correo del titular requiere su participación.
- Para habilitar operadores por correo fuera del equipo de Supabase, configurar un servicio SMTP propio en Supabase Auth. El proveedor de correo incorporado de Supabase restringe los destinatarios y la frecuencia; no se configuró un servicio externo sin credenciales del titular. Referencia: https://supabase.com/docs/guides/auth/auth-smtp.
- Crear organizaciones y revisar precios/cupos; no se necesita stock inicial de UMBRA.
- La importación histórica es opcional y no se ejecuta sobre los datos operativos durante las pruebas.
- El asesor de seguridad de Supabase señala que la protección adicional contra contraseñas filtradas está desactivada. Supabase la ofrece desde el plan Pro: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection. Se exige contraseña de al menos 12 caracteres y correo confirmado. No se contrató un plan pago.
- Las tablas antiguas de existencias físicas se conservan por compatibilidad y auditoría, pero no limitan nuevas ventas ni se ofrecen en la operación actual.
