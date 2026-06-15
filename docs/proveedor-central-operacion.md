# Proveedor Central - Sistema operativo de bodega y rutas

## Objetivo

Convertir Proveedor Central en una aplicacion de trabajo para administrador,
bodega, carteristas y ayudantes desde computador, tablet o celular.

El negocio no funciona como una tienda normal: funciona con bodega, despacho de
surtido, rutas semanales, cartera, cobros, fiados, devoluciones, descuadres y
liquidacion diaria.

## Roles

- Administrador: acceso total, edita productos, clientes, rutas, deudas,
  inventario, empleados, liquidaciones y autorizaciones.
- Bodega: despacha mercancia, recibe devoluciones, registra compras y movimientos
  de stock.
- Carterista: ve solo la ruta autorizada del dia, cobra, abona, fia, factura y
  registra productos dejados.
- Ayudante: puede apoyar la ruta, registrar clientes abiertos y entregar
  productos, segun permisos.

## Multiempresa y aislamiento de datos

Proveedor Central queda preparado como sistema multiempresa:

- Cada usuario debe tener `empresaId` en `usuarios/{uid}`.
- Cada documento operativo debe guardar `empresaId`.
- Si un documento antiguo no tiene `empresaId`, el sistema lo trata como
  `proveedor-central` para permitir migracion ordenada.
- Ninguna empresa debe leer, editar o borrar documentos de otra empresa.
- El correo principal del propietario conserva acceso administrador a la empresa
  base `proveedor-central`.

Arquitectura tecnica:

- `lib/tenant.js`: normaliza la empresa actual y mantiene compatibilidad con
  documentos antiguos.
- `lib/firestoreTenant.js`: filtra, valida y prepara datos asociados a empresa.
- `lib/permissions.js`: centraliza roles y permisos del sistema.
- `lib/audit.js`: registra eventos criticos en la coleccion `auditoria`.
- `firestore.rules`: bloquea lectura/escritura entre empresas desde Firebase.
- `app/api/admin/auditoria`: API protegida por token para consultar auditoria
  sin exponer datos de otra empresa.
- `app/api/admin/empleados`: API protegida para crear, editar y eliminar
  empleados/usuarios, validando empresa y registrando auditoria.
- `app/api/admin/cartera`: API protegida para abonos, ajustes de deuda, notas,
  riesgo de perdida, clientes perdidos y recuperados, con auditoria.
- `app/api/admin/clientes`: API protegida para crear, editar, eliminar,
  reordenar, aprobar orden, quitar solicitudes de borrado y cambiar estados de
  clientes con auditoria.
- `app/admin/auditoria`: pantalla administrativa para revisar historial de
  cambios por usuario, modulo, accion y documento.

Colecciones que deben quedar aisladas por empresa:

- `productos`
- `clientes`
- `empleados`
- `proveedores`
- `compras`
- `cuentasPagar`
- `despachos`
- `recepciones`
- `liquidaciones`
- `facturas`
- `facturasRuta`
- `gastosRuta`
- `gestionesRuta`
- `movimientosCartera`
- `ubicacionesRuta`
- `kardex`
- `autorizacionesRuta`

Roles y permisos:

- `superadmin`: administra la plataforma y puede crear o suspender empresas.
- `admin`: administra toda la empresa actual.
- `bodega`: despachos, compras, inventario y recepciones de su empresa.
- `carterista`: solo ruta, clientes, facturas, gastos y ubicacion de su empresa.
- `ayudante`: apoyo operativo de ruta de su empresa.

Validaciones de seguridad:

- Las reglas de Firestore viven en `firestore.rules`.
- Toda lectura exige que `empresaId` del documento coincida con `empresaId` del
  usuario autenticado.
- Toda creacion exige que el documento nuevo tenga el mismo `empresaId` del
  usuario.
- Toda actualizacion conserva el `empresaId`; no se permite cambiar un documento
  de empresa.
- Solo admin puede borrar documentos de su empresa.

Para activar seguridad multiempresa en produccion:

1. Crear coleccion `empresas`.
2. Agregar `empresaId` a cada documento de `usuarios`.
3. Ejecutar `npm run tenant:check` para revisar cuantos documentos antiguos no
   tienen empresa.
4. Ejecutar `npm run tenant:migrate` para agregar `empresaId:
   "proveedor-central"` a documentos antiguos.
5. Publicar `firestore.rules` en Firebase.
6. A partir de ahi, crear nuevas empresas con su propio `empresaId`.

## Operacion segura: backups, errores y pruebas

Copias de seguridad:

- El comando `npm run backup` genera una copia JSON de las colecciones
  principales en la carpeta local `backups`.
- El comando `npm run backup:proveedor-central` respalda solo la empresa base
  `proveedor-central`.
- El comando `npm run backup:install-task` instala una tarea diaria de Windows
  llamada `ProveedorCentralBackup` para ejecutar el backup automaticamente.
- La carpeta `backups` no se sube a Git porque puede contener datos sensibles.
- En Windows se puede programar una tarea diaria para ejecutar `npm run backup`
  desde la carpeta del proyecto.
- Antes de cambios grandes, deploy o migraciones de datos, se debe crear backup.

Registro de errores:

- Los errores del navegador se registran en `erroresSistema`.
- Los errores graves de pantalla quedan guardados desde `app/error.jsx`.
- Cada error incluye ruta, usuario, rol, empresa, navegador y mensaje.
- Esta informacion permite revisar fallos sin depender de pantallazos.
- El administrador tiene el panel `Errores` para ver errores por empresa,
  filtrar por estado, area o texto y marcar cada caso como revisado o resuelto.
- El panel muestra alertas de errores abiertos, revisados, resueltos y errores
  recientes para priorizar lo urgente.

Ambiente de pruebas:

- Existe `.env.test.example` como plantilla.
- El ambiente de pruebas debe usar Firebase y Mercado Pago de prueba, nunca datos
  reales de produccion.
- El comando `npm run project:check` revisa archivos criticos y variables antes
  de subir cambios importantes.
- El comando `npm run test:build` compila usando `NEXT_PUBLIC_APP_ENV=test`.
- Las pruebas de rutas, despachos, recepciones, liquidaciones y multiempresa se
  deben hacer primero en este ambiente.

## Acceso y permisos

Los usuarios se controlan desde Firebase Authentication y la coleccion
`usuarios`.

Cada documento de `usuarios` debe usar como id el UID del usuario y debe tener el
campo:

- `rol`: `admin`, `bodega`, `carterista` o `ayudante`.

Reglas de entrada:

- `admin`: entra al panel completo `/admin`.
- `bodega`: entra a despacho, recepcion e inventario.
- `carterista`: entra a `/carterista`.
- `ayudante`: entra a `/carterista` para apoyar la ruta.

Autorizaciones de ruta:

- Una autorizacion solo habilita la ruta en la fecha exacta autorizada.
- Las autorizaciones activas de fechas anteriores se muestran como vencidas y
  no habilitan al carterista.
- Si hoy no coincide el dia normal del empleado y tampoco existe autorizacion
  de hoy, Carterista debe mostrar `Sin ruta activa` y no una ruta vieja.

El correo principal `alriver1995zit@gmail.com` siempre se reconoce como
administrador.

Flujo recomendado para crear personal:

1. Crear el usuario en Firebase Authentication con correo y contrasena.
2. Copiar el UID que genera Firebase.
3. Entrar al panel `Empleados`.
4. Crear o editar el empleado.
5. Pegar el UID.
6. Seleccionar rol, dia de ruta, ruta asignada y estado.
7. Guardar.

Al guardar, el sistema crea o actualiza automaticamente el documento en
`usuarios` para que el login sepa a que pantalla debe entrar esa persona.

Reglas de seguridad:

- Si un empleado esta inactivo o bloqueado, no puede entrar aunque tenga correo
  y contrasena correctos.
- Si se cambia el UID de un empleado, el acceso anterior se elimina de
  `usuarios` para que no quede un usuario viejo entrando al sistema.
- El panel de Empleados muestra quienes estan activos, inactivos, sin UID y por
  rol para detectar accesos incompletos.
- Admin ve todo; bodega entra a despacho, compras, recepcion e inventario;
  carteristas y ayudantes entran al panel de ruta.
- Empleados tambien muestra un resumen operativo por persona: rutas liquidadas,
  neto acumulado, descuentos, prestamos, consumos, faltantes de producto,
  plata faltante, plata sobrante y descuadres.
- Este resumen cruza liquidaciones guardadas y gastos registrados en ruta para
  saber que se le debe o descuenta a cada carterista y ayudante.

## Reglas clave de carteristas

- Solo puede entrar a la ruta del dia asignado.
- Si necesita trabajar otro dia o ruta, requiere autorizacion del administrador.
- El sistema toma `diaRuta` y `ruta` desde el usuario/empleado asignado.
- Un carterista o ayudante no puede cambiar de ruta desde su pantalla.
- El administrador si puede cambiar de ruta en modo revision.
- En `Autorizaciones`, el administrador puede aprobar una fecha especifica,
  un dia de ruta y una ruta diferente para un carterista o ayudante.
- La autorizacion solo aplica si esta activa y si la fecha coincide con el dia
  actual de trabajo.
- Si se crea una nueva autorizacion activa para el mismo empleado y la misma
  fecha, la autorizacion activa anterior queda como reemplazada para evitar dos
  rutas abiertas el mismo dia.
- Si se reactiva una autorizacion anterior, tambien reemplaza cualquier otra
  autorizacion activa del mismo empleado y fecha.
- Cada autorizacion exige motivo y muestra la ruta normal del empleado para que
  el administrador apruebe la excepcion con contexto.
- El panel de Rutas muestra alertas por planilla: clientes en riesgo, perdidos,
  solicitudes de borrado y ordenes pendientes de revision.
- Rutas permite filtrar por dia, ruta y planillas con o sin alertas.
- Cada planilla muestra clientes totales, clientes con deuda, deuda promedio,
  clientes creados en ruta y alertas separadas por borrado, orden, riesgo y
  perdidos.
- Puede agregar clientes nuevos durante el dia de trabajo.
- Al agregar un cliente nuevo puede registrar deuda inicial, dias de deuda y
  orden de visita.
- Puede agregarlo al final de la ruta o debajo de otro cliente para conservar el
  recorrido real.
- Si el carterista inserta el cliente en medio de la ruta o asigna un numero,
  queda marcado como pendiente de revision de orden para el administrador.
- No puede borrar clientes.
- Puede marcar un cliente como "solicitud de borrar" para que el administrador
  lo revise y decida.
- En la ruta diaria, cada cliente tiene estado operativo del dia: pendiente,
  visitado, no disponible o riesgo de perdida.
- Los estados visitado y no disponible solo aplican para la fecha actual; al
  siguiente dia vuelven a verse como pendientes en la ruta correspondiente.
- El estado riesgo de perdida si queda permanente hasta que el cliente sea
  recuperado o atendido.
- La pantalla del carterista muestra resumen y filtros por estado para trabajar
  primero clientes pendientes o en riesgo, dejando atendidos y no disponibles
  separados visualmente.
- En Clientes, el administrador puede filtrar clientes creados en ruta,
  solicitudes de borrado y ordenes pendientes de revision.
- El administrador puede aprobar el orden sugerido o quitar la solicitud de
  borrado sin eliminar al cliente.
- En Clientes, el administrador ve un archivo de cartera por recuperar agrupado
  por dia/ruta, con cantidad de clientes en riesgo, perdidos y valor pendiente.
- Las acciones de revision usan iconos pequenos para editar, aprobar orden,
  recuperar, marcar riesgo, pasar a perdido o eliminar definitivamente.
- Los clientes que se pierden o dejan de pagar no se borran: se marcan como
  perdidos y quedan en un archivo por dia/ruta para intentar recuperarlos
  despues.
- Si el cliente aparece con el tiempo, el administrador puede marcarlo como
  recuperado/activo sin perder su historial.
- Cada cambio de estado importante queda guardado en movimientos de cartera:
  riesgo de perdida, cliente perdido o cliente recuperado.
- En Cartera se pueden filtrar clientes normales por semaforo, clientes en
  riesgo de perdida y clientes perdidos que aun tienen deuda.
- No puede modificar deudas cerradas de dias anteriores.
- Si puede editar informacion operativa del dia: telefono, direccion, productos
  dejados, abono, pago y observaciones.

## Clientes y cartera

Cada cliente debe tener:

- Nombre.
- Telefono.
- Direccion.
- Dia de ruta.
- Ruta asignada.
- Numero/orden de visita dentro de la ruta.
- Carterista asignado.
- Estado de deuda.
- Fecha de ultima deuda.
- Historial de visitas.
- Facturas.
- Abonos.
- Observaciones.
- Solicitud de borrado pendiente o no.

## Orden de visita por ruta

Cada ruta debe manejar clientes en un orden numerado y consecutivo.

Ejemplo:

- Cliente 1.
- Cliente 2.
- Cliente 3.
- Cliente 4.

Reglas:

- Cada cliente tiene un numero de visita dentro de su ruta y dia.
- El orden se puede cambiar desde el administrador.
- El carterista debe ver los clientes ordenados por ese numero.
- Si se agrega un cliente al final, recibe automaticamente el siguiente numero.
- Si se agrega un cliente en medio de la ruta, el sistema debe reordenar todos
  los clientes siguientes.

Ejemplo real:

- Santiago esta en el numero 6.
- Se agrega Camila justo debajo de Santiago porque trabaja en el mismo local.
- Camila queda como numero 7.
- El cliente que antes era numero 7 pasa automaticamente a numero 8.
- El que era 8 pasa a 9, y asi sucesivamente.
- Si la ruta tenia 200 clientes, despues de agregar a Camila queda con 201
  clientes numerados correctamente.

El sistema debe permitir:

- Insertar cliente antes de otro cliente.
- Insertar cliente despues de otro cliente.
- Mover cliente hacia arriba o hacia abajo.
- Cambiar numero manualmente desde administrador.
- Recalcular la numeracion completa de la ruta.
- Mantener la deuda e historial del cliente aunque cambie su numero de visita.

Importante:

- El numero de visita pertenece a la ruta, no a la deuda.
- Cambiar el orden no debe alterar facturas, abonos ni historial.
- El carterista no puede reorganizar toda la ruta sin autorizacion.
- El carterista si puede agregar un cliente nuevo del dia, pero si lo inserta en
  medio de la ruta debe quedar marcado para revision del administrador.

Semaforo de deuda:

- 8 dias: verde.
- 15 dias: amarillo.
- 1 mes: rojo.
- 2 meses o mas: negro con alerta.

Modulo Cartera:

- Muestra solo clientes con deuda pendiente.
- Resume cartera total, clientes en riesgo, alertas amarillas y clientes al dia.
- Permite filtrar por color de deuda: verde, amarillo, rojo o negro.
- Permite buscar por nombre, telefono, direccion, dia o ruta.
- Cada cliente muestra ruta, orden de visita, deuda, dias vencidos y estado.
- Incluye boton de WhatsApp para enviar recordatorio de pago con saldo pendiente.
- Permite seleccionar un cliente y registrar abonos recibidos.
- Permite ajustar la deuda final cuando el administrador corrige una cuenta.
- Si se registra solo un abono, el sistema descuenta ese valor de la deuda
  actual; el campo de ajuste queda vacio para no neutralizar el abono por error.
- Si el abono supera la deuda actual, se bloquea salvo que el administrador use
  ajuste manual de deuda final.
- Permite actualizar dias de deuda para recalcular el semaforo.
- Permite guardar notas de cobro, promesas de pago o detalles del abono.
- Permite marcar un cliente en riesgo de perdida, perdido o recuperado desde la
  tabla de cartera, dejando movimiento historico.
- Cada abono, ajuste o nota queda guardado como movimiento de cartera.
- Cuando el carterista guarda una factura de ruta, el sistema tambien crea un
  movimiento de cartera con abono, pago de productos, fiado del dia, deuda
  anterior y deuda final.
- Asi el historial del cliente mezcla lo registrado por administrador y lo
  registrado en ruta sin hacer doble trabajo.
- El historial reciente permite revisar que paso con ese cliente sin depender de
  memoria o papeles.
- Sirve para que el administrador revise cobros antes de salir a ruta y despues
  de liquidar.

## Productos

Cada producto debe tener:

- Nombre.
- Categoria.
- Codigo de barras.
- Costo.
- Precio minimo.
- Precio sugerido.
- Precio maximo.
- Unidad de manejo: unidad, docena, pacas, cantidad.
- Stock.
- Stock minimo.
- Proveedor.
- Estado activo/inactivo.
- Imagen principal y hasta 3 imagenes adicionales.
- Al crear o editar productos, el sistema bloquea precios negativos, stock
  negativo, costo mayor que el precio maximo y rangos mal armados.
- La regla de venta queda siempre asi: precio minimo <= precio sugerido <=
  precio maximo.
- Las unidades permitidas quedan normalizadas a: unidad, docena, pacas y
  cantidad. Si un Excel trae otra unidad, se ajusta a unidad para no romper la
  operacion.

## Proveedores

La base de proveedores permite controlar a quien se compra y bajo que
condiciones.

Cada proveedor debe tener:

- Nombre.
- Contacto.
- Telefono.
- Correo.
- Direccion.
- Ciudad.
- Metodo de pago: contado, credito, transferencia u otro.
- Cupo de credito.
- Dias de credito.
- Categorias o productos que vende.
- Estado: activo, pausado o inactivo.
- Observaciones.

Reglas:

- Solo proveedores activos o pausados aparecen disponibles en compras.
- Al seleccionar un proveedor en compras, el sistema completa nombre y metodo de
  pago.
- Al seleccionar un proveedor en compras, se muestra primero el catalogo de
  productos que ese proveedor vende.
- Desde compras se puede alternar entre ver solo productos del proveedor o ver
  todos los productos.
- Si el proveedor aun no esta creado, se puede escribir manualmente en compras.
- Las compras guardan `proveedorId` cuando se selecciona un proveedor registrado.
- Esto permite consultar compras, costos y movimientos por proveedor.
- En la pantalla de proveedores se puede ver cuantos productos tiene asociado
  cada proveedor y abrir el listado de productos que vende.
- Proveedores tambien muestra control financiero por proveedor: comprado
  historico, saldo por pagar, ultima compra, facturas con alerta y cuentas
  vencidas.
- Cuando se crea un producto nuevo desde compras, queda enlazado al proveedor
  seleccionado.

En venta:

- Punto verde: precio minimo permitido.
- Punto amarillo: precio dentro del rango.
- Punto rojo: precio maximo permitido.
- Si el carterista edita precio, debe quedar dentro del rango permitido.

## Bodega

La bodega controla:

- Compra de mercancia a proveedores.
- Entradas de inventario.
- Salidas por despacho.
- Devoluciones al recibir ruta.
- Kardex por producto.
- Productos vencidos, danados o devueltos por mal estado.

Compras / entradas:

- Se registra fecha de compra.
- Se registra proveedor.
- Se registra factura o remision del proveedor.
- Se registra el total que aparece en la factura del proveedor.
- Se define si fue contado, credito, transferencia u otro metodo.
- Se agregan productos por lector de codigo, SKU o busqueda manual.
- En tablet o celular compatible se puede usar la camara para leer el codigo de
  barras y agregar el producto.
- Cada producto lleva cantidad y costo unitario.
- Cada linea muestra subtotal calculado: cantidad por costo unitario.
- La compra bloquea el guardado si una linea tiene cantidad en cero, costo en
  cero, precios vacios, precio minimo mayor que precio detal, precio detal mayor
  que precio maximo o costo mayor que precio maximo.
- La pantalla compara total calculado contra total de la factura del proveedor.
- Si hay diferencia, se muestra para corregir antes de guardar y evitar perder
  plata por facturas mal sumadas o mal multiplicadas.
- La compra clasifica la factura como cuadrada, diferencia menor o diferencia
  fuerte.
- Si la diferencia es fuerte, el sistema avisa antes de guardar para decidir si
  se corrige o se guarda con alerta.
- Desde la compra se puede crear un producto nuevo rapido si no existe.
- Desde la compra se pueden actualizar costo, precio minimo, precio detal y
  precio maximo antes de guardar.
- Al guardar la compra, el stock del producto aumenta automaticamente.
- El costo del producto queda actualizado con el ultimo costo de compra.
- Los precios editados en la compra actualizan el producto para futuras ventas.
- Cada entrada genera movimiento de kardex con tipo `entrada_compra`.
- El kardex conserva proveedor, factura y estado de revision de la compra.
- La compra queda guardada como soporte historico para contabilidad e inventario.
- Si la compra se marca como credito, se crea automaticamente una cuenta por
  pagar al proveedor con fecha de vencimiento, total, abonado, saldo y estado.
- La cuenta por pagar conserva total calculado, total de factura y diferencia
  para revisar antes de pagar.

Cuentas por pagar:

- Nacen de compras a credito.
- Guardan proveedor, factura, fecha de compra y fecha de vencimiento.
- Permiten registrar abonos parciales.
- Cada abono guarda fecha, metodo de pago, referencia y nota.
- El panel resume abonos por metodo de pago para saber por donde se pago:
  efectivo, Nequi, Daviplata, Bancolombia u otro.
- Muestra alertas prioritarias de cuentas vencidas o facturas con diferencia
  antes de pagar.
- Cada cuenta muestra el ultimo abono registrado con valor y metodo.
- Cuando el saldo llega a cero quedan como pagadas.
- Si pasan la fecha de vencimiento y tienen saldo pendiente se muestran como
  vencidas.
- Sirven para saber cuanto se debe a proveedores y evitar olvidar pagos.
- Conservan la diferencia entre factura del proveedor y total calculado para no
  pagar cuentas con alerta sin revisarlas.

Contabilidad:

- Trabaja sin IVA.
- Cruza ingresos de tienda, cobros de ruta, ventas brutas, cartera, compras,
  cuentas por pagar y resultado de liquidaciones.
- Muestra cartera de clientes, cartera vencida, riesgo y cartera perdida.
- Muestra compras registradas, facturas con alerta y saldos a proveedores.
- Muestra pagos a proveedores por metodo y cuentas por pagar con diferencia de
  factura antes de pagar.
- Muestra utilidad bruta de rutas, neto administrador, neto carteristas y neto
  ayudantes.
- Separa plata faltante y plata sobrante para no castigar sobrantes como
  perdida.
- Calcula caja confirmada, cuentas por cobrar, cuentas por pagar, posicion neta
  y caja despues de proveedores.
- Muestra ventas, cobros, pendientes y utilidad del dia.
- Calcula efectividad de cobro y margen de rutas.
- Presenta alertas financieras por cartera perdida, cartera en riesgo, cuentas
  vencidas, compras con alerta y liquidaciones descuadradas.
- Lista cartera critica y pagos a proveedores proximos para priorizar acciones.

Despacho:

- Puede hacerse con pistola/lector de codigo de barras.
- Tambien puede hacerse desde tablet o celular buscando productos.
- En celulares/tablets compatibles, se puede usar la camara para leer codigos de
  barras desde Compras y Despachos.
- Si el navegador no soporta lectura nativa de codigos, se mantiene el campo
  manual y el lector fisico como respaldo.
- Cada despacho queda asociado a fecha, ruta, carterista y ayudante.
- El despacho descuenta inventario cuando se guarda.
- Cada salida genera movimiento de kardex.
- El despacho conserva costo/base del producto y valor estimado de venta.
- El despacho calcula ganancia potencial y margen estimado antes de salir de
  bodega.
- El despacho alerta si falta carterista, ayudante, costo, precio o si una
  cantidad supera el stock disponible.
- Si una cantidad supera el stock disponible, el sistema bloquea el guardado
  para no dejar inventario negativo por error.
- Debe servir como punto de comparacion para la recepcion nocturna.

Recibo al final del dia:

- Se cuentan productos devueltos.
- El sistema compara:
  - Lo que salio de bodega.
  - Lo que se devolvio a bodega.
  - Lo dejado fisicamente: salio menos devuelto.
  - Lo facturado a clientes por el carterista.
  - Lo que se vendio de contado.
  - Lo que falta o sobra.
- La recepcion nocturna devuelve inventario automaticamente a bodega.
- Los productos dejados ya no se escriben a mano: se calculan automaticamente
  como `salio - devuelto`.
- El sistema compara lo dejado fisicamente contra lo facturado en clientes.
- Si lo dejado fisicamente es mayor que lo facturado, queda como producto
  faltante o producto dejado sin registrar.
- Si lo facturado es mayor que lo dejado fisicamente, queda como alerta para
  revisar factura, conteo o despacho.
- El valor de productos dejados para liquidacion sale de las facturas de ruta.
- El costo de productos facturados se toma separado del costo de faltantes para
  no castigar dos veces al carterista.
- La recepcion muestra cantidad de facturas, valor facturado, pagos de productos
  del dia y fiado de la ruta.
- La recepcion cruza las gestiones del dia: clientes gestionados, visitados,
  no disponibles, riesgos de perdida y carteristas que reportaron.
- Si una ruta recibida no tiene gestiones registradas, queda como alerta para
  revisar si el carterista no marco los clientes o si la fecha/ruta no coincide.
- Si hubo clientes en riesgo de perdida durante la ruta, la recepcion guarda ese
  conteo para que la liquidacion no cierre a ciegas.
- Se registra dinero entregado, gastos de ruta y prestamos.
- El dinero recibido se separa por metodo: efectivo, Nequi, Daviplata,
  Bancolombia y otros pagos.
- Se puede guardar referencia o comprobante de consignaciones.
- La recepcion puede cargar automaticamente los gastos y prestamos que el
  carterista registro durante la ruta.
- Los gastos de caja incluyen almuerzo, gasolina y otros gastos pagados desde la
  plata recogida.
- Los prestamos quedan separados para no mezclarlos con consignaciones ni
  efectivo entregado.
- Los consumos registrados quedan visibles para liquidacion, pero no se mezclan
  como efectivo entregado.
- Se calcula descuadre de dinero comparando plata entregada + gastos/prestamos
  contra lo realmente cobrado: abonos de deuda anterior + pagos de productos del
  dia.
- Los faltantes de producto quedan separados de los descuadres de plata.
- La liquidacion muestra el detalle de productos faltantes: salio, dejado,
  devuelto, faltante y costo faltante.
- La recepcion guarda un estado de auditoria: cuadrado, con alertas o bloqueado.
- Las alertas de auditoria quedan guardadas para que la liquidacion y los
  reportes sepan si hubo descuadre de surtido, descuadre de dinero o conteo
  invalido.
- La liquidacion hereda esas alertas antes de cerrar el dia, evitando liquidar a
  ciegas.
- La liquidacion muestra la auditoria completa de surtido: salio, devuelto,
  dejado fisico, facturado, diferencia y tipo de alerta por producto.
- La liquidacion tambien hereda el resumen de gestiones de ruta: total
  gestionados, visitados, no disponibles, riesgos y deuda gestionada.

Kardex:

- Cada compra genera entrada positiva.
- Cada despacho genera salida negativa.
- Cada recepcion genera entrada por devolucion.
- Los faltantes detectados en recepcion generan movimiento de auditoria
  `alerta_faltante_ruta`; no descuentan stock otra vez porque el producto ya
  salio en el despacho.
- Los ajustes manuales de inventario generan entrada o salida con motivo,
  fecha, producto, costo y subtotal para que ningun cambio de stock quede sin
  rastro.
- Inventario muestra existencias, valor de bodega, bajo stock, ultimos
  movimientos por producto y resumen de entradas, salidas, devoluciones y
  faltantes.
- Inventario permite filtrar por categoria, estado de stock y tipo de movimiento
  de kardex para auditar cambios de stock.

## Ruta diaria

Una ruta contiene:

- Fecha.
- Dia de semana.
- Carterista.
- Ayudante.
- Clientes del dia.
- Despacho inicial.
- Ventas de contado.
- Fiados.
- Abonos.
- Gastos.
- Devoluciones.
- Descuadres.
- Liquidacion.
- Estado visual de cada cliente del dia: pendiente, visitado o no encontrado.

En modo carterista:

- El carterista puede chulear un cliente como visitado.
- El chulo significa que el cliente fue encontrado y atendido.
- El icono de usuario con X significa que no esta disponible temporalmente:
  se fue para la casa, descanso, vacaciones o no abrio ese dia.
- El icono de X de riesgo marca clientes donde esta en peligro perderse la
  plata; pasan a revision administrativa como riesgo de perdida.
- El color del cliente cambia para ordenar visualmente la ruta trabajada.
- Esto no borra deudas ni cambia historial; solo registra la gestion del dia.
- Si un cliente en riesgo aparece y se chulea como atendido, vuelve a estado
  activo para no quedarse marcado injustamente.
- Cada marca del carterista queda guardada en `gestionesRuta` con fecha, ruta,
  cliente, estado anterior, estado nuevo y carterista.
- Si el carterista marca riesgo de perdida o recupera un cliente en riesgo, se
  crea tambien movimiento de cartera para que el administrador lo vea en
  Cartera, Clientes, Rutas y Reportes.
- Si se guarda una factura a un cliente que estaba en riesgo o perdido, queda
  automaticamente como atendido/activo y se registra la recuperacion.
- El administrador tiene una pantalla de Gestiones de ruta para filtrar por
  fecha, estado, ruta, carterista y cliente. Desde ahi revisa visitados, no
  disponibles, riesgos y recuperaciones sin abrir cada cliente uno por uno.

## Gastos, prestamos y consumos de ruta

Durante el dia el carterista puede registrar movimientos de la ruta:

- Almuerzo del carterista.
- Prestamo del carterista.
- Producto consumido por el carterista.
- Almuerzo del ayudante.
- Prestamo del ayudante.
- Producto consumido por el ayudante.
- Gasolina u otros gastos operativos.

Cada registro queda guardado con fecha, ruta, dia de ruta, usuario que lo
registro, persona afectada, tipo, valor y detalle.

En `Liquidacion diaria`, el administrador puede seleccionar la recepcion de la
noche, ver los gastos registrados por esa ruta y cargar esos valores
automaticamente a los descuentos antes de guardar la liquidacion.

Esto evita depender de memoria o papeles sueltos: lo que se gasto durante la
ruta llega a la liquidacion del mismo dia.

## Factura de cliente

Al confirmar una venta o fiado:

- Se genera factura.
- Se guarda en base de datos.
- Se puede enviar por WhatsApp.
- Debe incluir nombre, telefono, fecha, ruta, productos, cantidades, precios,
  abono, deuda anterior, total nuevo y mensaje final:
  "Muchas gracias por su compra".
- El panel de Facturas permite filtrar por origen, estado, fecha inicial, fecha
  final, cliente, telefono, ruta, carterista o numero.
- El panel muestra total facturado, cobrado registrado, fiado en ruta, deuda
  final de facturas de ruta y facturas sin telefono para WhatsApp.
- En modo carterista, la factura se guarda como factura de ruta.
- El carterista puede seleccionar productos con precio minimo, sugerido o maximo.
- El carterista no puede agregar productos sin seleccionar primero el cliente
  de la ruta.
- Si el carterista escribe un precio fuera del rango permitido, una cantidad
  en cero, un abono mayor que la deuda anterior o un pago mayor que el total de
  productos del dia, el sistema bloquea el guardado y muestra la alerta.
- El sistema calcula total de productos dejados, pago del dia, fiado del dia y
  deuda final.
- Al guardar la factura, se actualiza la deuda del cliente.
- Desde la factura guardada se abre WhatsApp con el resumen para el cliente.

Panel de facturas:

- El administrador ve facturas de tienda y facturas de ruta en una sola lista.
- Cada factura indica su origen: Tienda o Ruta.
- El panel resume facturas visibles, total facturado, cobrado registrado y fiado
  en ruta.
- Se puede filtrar por origen, estado y buscar por cliente, telefono, ruta,
  carterista o numero.
- Las facturas de ruta muestran carterista, ruta, deuda anterior, abono, pago de
  productos, fiado del dia y deuda final.
- El detalle funciona como recibo operativo: permite copiar el texto, imprimir y
  abrir WhatsApp con el mensaje completo del cliente.
- Esto permite auditar la visita del cliente sin entrar primero a liquidacion.

Panel de ventas:

- Mezcla ventas de tienda y facturas de ruta para ver el comportamiento comercial
  completo.
- Resume total bruto, cobrado confirmado, pendiente/fiado, ventas de tienda,
  ventas de ruta y efectividad de cobro.
- Permite filtrar por tienda, ruta, solo ventas del dia o rango de fechas.
- Muestra alertas por facturas pendientes y facturas sin telefono.
- En ruta, el valor cobrado sale de abonos mas pagos de productos; el pendiente
  sale del fiado del dia.

Panel de pedidos:

- Solo muestra pedidos de tienda/checkout.
- No mezcla facturas de carteristas, porque esas se controlan desde Facturas,
  Recepcion y Liquidacion.
- Permite filtrar pedidos activos, pendientes, pagados, enviados, entregados o
  cancelados.
- Permite filtrar pedidos por rango de fechas.
- Muestra pedidos por entregar y pedidos sin telefono para seguimiento.
- Desde Pedidos se puede cambiar el estado operativo y abrir el recibo completo.

## Liquidacion diaria

La liquidacion diaria debe mostrar:

- Productos dejados ese dia.
- Valor total de productos dejados ese dia.
- Total de facturas del dia.
- Total cobrado.
- Total por metodo de pago: efectivo, Nequi, Daviplata, Bancolombia y otros.
- Referencia de consignaciones o comprobantes.
- Plata faltante separada de plata sobrante.
- Total fiado.
- Total abonado.
- Total deudas de la planilla del dia.
- Gastos de ruta: almuerzo, gasolina, prestamos, surtido consumido.
- Mercancia devuelta.
- Descuadre de plata.
- Descuadre de productos.
- Productos faltantes detallados por nombre y cantidad.
- Ganancia diaria.

Reglas de pago:

- El ayudante recibe 55.000 COP diarios.
- El ayudante recibe 3.000 COP por cliente abierto.
- El pago del ayudante se descuenta de la ganancia antes de dividir.
- La ganancia restante se divide 50% administrador / 50% carterista.
- Al carterista se le descuentan aparte prestamos, almuerzos, consumos o faltantes.
- Al ayudante se le descuentan aparte prestamos, almuerzos o productos consumidos.
- Todo debe quedar separado por dia, sin mezclar liquidaciones.
- La liquidacion parte de una recepcion nocturna ya guardada.
- La utilidad bruta se calcula con valor de productos dejados menos costo de
  productos dejados.
- El costo de faltantes y descuadres negativos se descuentan al carterista.
- Si sobra plata, queda como sobrante reportado y no se descuenta como falta.
- La liquidacion conserva el resumen de gestiones de la recepcion para que el
  cierre diario y semanal sepan cuantos clientes se trabajaron realmente.
- Al guardar liquidacion, la recepcion queda marcada como liquidada para evitar
  mezclar dias.

## Reportes semanales

El reporte semanal consolida las liquidaciones ya guardadas.

Debe permitir filtrar por:

- Fecha inicial.
- Fecha final.
- Carterista.

Debe mostrar:

- Dias trabajados.
- Rutas liquidadas.
- Valor total de productos dejados.
- Utilidad bruta.
- Diferencia de surtido acumulada.
- Auditorias con alerta.
- Total a pagar al equipo.
- Pago neto de carteristas.
- Pago neto de ayudantes.
- Neto del administrador.
- Utilidad despues de pagar equipo.
- Descuentos acumulados.
- Gastos registrados durante ruta.
- Facturas de ruta.
- Gestiones de ruta.
- Clientes visitados.
- Clientes no disponibles.
- Clientes en riesgo de perdida.
- Deuda gestionada durante las rutas.
- Descuadres de dinero.
- Plata faltante separada de plata sobrante.
- Faltantes de productos.
- Alertas de auditoria heredadas desde recepcion y liquidacion.
- Rentabilidad de rutas.
- Participacion del administrador sobre la utilidad bruta.
- Alertas priorizadas por impacto para revisar primero las rutas mas delicadas.
- Ranking de carteristas con mayor impacto por descuadre, faltantes o surtido.
- Exportacion CSV del detalle diario para revisar o guardar cierre externo.

Resumen por carterista:

- Dias trabajados.
- Rutas trabajadas.
- Productos dejados.
- Utilidad bruta.
- Neto a pagar.
- Descuentos acumulados.
- Clientes visitados sobre clientes gestionados.
- Clientes en riesgo de perdida.
- Deuda gestionada.
- Plata faltante y plata sobrante por carterista.
- Alertas por descuadres o faltantes.
- Diferencia de surtido acumulada para saber si tiene productos no anotados o
  conteos inconsistentes.

Resumen por ayudante:

- Dias trabajados.
- Rutas trabajadas.
- Pago base semanal.
- Bonos por clientes abiertos.
- Pago bruto.
- Descuentos.
- Neto a pagar.

Detalle diario:

- Fecha.
- Dia de ruta.
- Ruta.
- Carterista.
- Ayudante.
- Productos dejados.
- Utilidad.
- Descuadre.
- Plata faltante.
- Plata sobrante.
- Faltante.
- Gastos registrados.
- Gestiones de ruta.
- Clientes en riesgo.
- Neto del carterista.
- El reporte semanal tambien muestra cartera actual, cartera vencida, clientes
  en riesgo de perdida y clientes perdidos con deuda.
- Asi el cierre semanal mezcla ganancias, pagos del equipo y plata dificil de
  recuperar en un solo lugar.

## Cartera y recuperacion

La cartera debe mostrar:

- Total de clientes con deuda.
- Deuda por edad: verde, amarillo, rojo y negro.
- Clientes marcados en riesgo de perdida.
- Clientes perdidos con deuda.
- Prioridad por dia y ruta, ordenada por plata perdida, plata en riesgo y deuda
  roja/negra.
- Valor de cartera por ruta para saber que cobros perseguir primero.
- Historial de movimientos por cliente: abonos, ajustes, notas, riesgo,
  perdido y recuperado.
- Boton de WhatsApp para enviar recordatorio de cobro.

Desde Cartera, el administrador puede:

- Registrar abonos.
- Ajustar deuda final cuando haya una correccion real.
- Actualizar dias de deuda.
- Marcar cliente en riesgo de perdida.
- Pasar cliente a perdido.
- Recuperar cliente y devolverlo a activo.

Esta pantalla sirve para perseguir plata delicada sin mezclarla con la venta
normal del dia.

Desde Clientes, el administrador tambien tiene:

- Archivo de cartera por recuperar agrupado por dia y ruta.
- Acciones rapidas sobre clientes en riesgo o perdidos.
- Boton para enviar cobro por WhatsApp.
- Boton para editar datos del cliente.
- Boton para marcar recuperado.
- Boton para pasar de riesgo a perdido.
- Ordenamiento por mayor deuda para perseguir primero lo mas delicado.

## Dashboard administrador

Debe mostrar:

- Ventas del dia.
- Ventas de tienda y facturas de ruta del dia.
- Caja confirmada del dia.
- Pendiente/fiado del dia.
- Cobros del dia.
- Fiados del dia.
- Compras del dia.
- Neto del administrador del dia.
- Valor de productos dejados en ruta.
- Dinero cobrado en ruta: abonos + pagos de productos.
- Valor fiado del dia.
- Gestiones de ruta del dia: visitados, no disponibles, riesgos y carteristas
  que reportaron.
- Deuda total.
- Deuda vencida.
- Valor de cartera marcada en riesgo.
- Valor de cartera perdida.
- Ganancia del dia.
- Carteristas activos.
- Ayudantes activos.
- Rutas abiertas.
- Rutas liquidadas.
- Descuadres por plata.
- Descuadres por producto.
- Recepciones con alerta.
- Liquidaciones con alerta.
- Despachos pendientes de recibir.
- Diferencia de surtido acumulada.
- Cuentas por pagar y cuentas vencidas.
- Cuentas por pagar con diferencia de factura.
- Pagos a proveedores por metodo.
- Compras con alerta por diferencia de factura.
- Prioridades accionables con boton directo al modulo que debe revisarse.
- Alertas de gestiones cuando hay clientes marcados en riesgo o no disponibles.
- Rutas con cartera critica ordenadas por plata perdida, riesgo y deuda vencida.
- Control de cartera con acceso directo a Clientes y Cartera.

El Dashboard funciona como centro de mando diario: al abrir el administrador se
debe ver primero la caja, la cartera, proveedores, rutas y alertas operativas
antes de entrar al detalle de cada modulo.
- Inventario bajo.
- Clientes nuevos.
- Clientes para borrar pendientes de revision.
- Clientes con orden pendiente de revision.
- Clientes perdidos.
- Clientes en riesgo de perdida.

## Mapa y ubicacion

Solo administrador:

- Mapa en tiempo real.
- Punto por cada carterista o ayudante con color operativo:
  - Verde: ubicacion reportada en los ultimos 15 minutos.
  - Amarillo: ubicacion reportada entre 16 y 60 minutos.
  - Gris: ubicacion atrasada o sin hora confiable.
- Nombre del carterista.
- Ultima hora reportada.
- Datos actualizados si el carterista tiene ubicacion activa.
- El carterista o ayudante puede enviar su ubicacion desde el celular con el
  boton `Ubicacion`.
- La ubicacion queda guardada con fecha, hora, ruta, dia, latitud, longitud y
  precision.
- En el panel `Mapa`, el administrador ve la ultima ubicacion por persona y un
  enlace para abrirla en Google Maps.
- El panel permite buscar por nombre o ruta y filtrar por estado para revisar
  rapidamente quien esta activo, reciente o atrasado.

## Importacion masiva

Desde administrador:

- Subir productos por Excel.
- Subir clientes por Excel.
- Subir proveedores por Excel.
- Actualizar datos masivos sin borrar historial.

Formato recomendado para importar clientes:

- `orden de visita`: numero de orden dentro de la ruta.
- `name`: nombre del cliente.
- `phone`: telefono o celular.
- `address`: direccion, local o referencia.
- `assigned_day`: numero del dia de ruta, donde 1 es lunes, 2 martes,
  3 miercoles, 4 jueves, 5 viernes y 6 sabado.
- `credit_limit`: limite de credito del cliente.
- `current_balance`: deuda actual.

La importacion usa el telefono como llave principal para evitar duplicados. Si
no hay telefono, usa nombre + direccion. Si el Excel trae `orden de visita`, se
respeta ese orden y luego se renumera cada ruta en consecutivo. Si no trae orden,
los clientes nuevos se agregan al final de la ruta correspondiente.

## Primeras fases de desarrollo

Fase 1:

- Roles y permisos.
- Clientes por dia/ruta.
- Productos con precios minimo/sugerido/maximo.
- Pantalla del carterista para ruta del dia.

Fase 2:

- Despacho de bodega.
- Recibo de devoluciones.
- Comparacion automatica de mercancia.
- Kardex basico.

Fase 3:

- Facturas, abonos, fiados y WhatsApp.
- Semaforo de deuda.
- Solicitud de borrar cliente.

Fase 4:

- Liquidacion diaria completa.
- Descuadres de plata y surtido.
- Liquidacion semanal.

Fase 5:

- Dashboard avanzado.
- GPS.
- Importacion Excel.
- PWA instalable en tablet/celular.
