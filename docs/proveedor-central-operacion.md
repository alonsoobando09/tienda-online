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

## Reglas clave de carteristas

- Solo puede entrar a la ruta del dia asignado.
- Si necesita trabajar otro dia o ruta, requiere autorizacion del administrador.
- Puede agregar clientes nuevos durante el dia de trabajo.
- No puede borrar clientes.
- Puede marcar un cliente como "solicitud de borrar" para que el administrador
  lo revise y decida.
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

Despacho:

- Puede hacerse con pistola/lector de codigo de barras.
- Tambien puede hacerse desde tablet o celular buscando productos.
- Cada despacho queda asociado a fecha, ruta, carterista y ayudante.
- El despacho descuenta inventario cuando se guarda.
- Cada salida genera movimiento de kardex.
- El despacho conserva costo/base del producto y valor estimado de venta.
- Debe servir como punto de comparacion para la recepcion nocturna.

Recibo al final del dia:

- Se cuentan productos devueltos.
- El sistema compara:
  - Lo que salio de bodega.
  - Lo que se dejo en clientes.
  - Lo que se vendio de contado.
  - Lo que se devolvio a bodega.
  - Lo que falta o sobra.
- La recepcion nocturna devuelve inventario automaticamente a bodega.
- Los productos dejados quedan como valor base/facturado del dia.
- Los productos dejados pueden cargarse automaticamente desde las facturas de
  ruta guardadas por el carterista.
- La recepcion muestra cantidad de facturas, valor facturado, pagos de productos
  del dia y fiado de la ruta.
- Se registra dinero entregado, gastos de ruta y prestamos.
- Se calcula descuadre de dinero comparando plata entregada + gastos/prestamos
  contra valor de productos dejados.
- Los faltantes de producto quedan separados de los descuadres de plata.

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

## Factura de cliente

Al confirmar una venta o fiado:

- Se genera factura.
- Se guarda en base de datos.
- Se puede enviar por WhatsApp.
- Debe incluir nombre, telefono, fecha, ruta, productos, cantidades, precios,
  abono, deuda anterior, total nuevo y mensaje final:
  "Muchas gracias por su compra".
- En modo carterista, la factura se guarda como factura de ruta.
- El carterista puede seleccionar productos con precio minimo, sugerido o maximo.
- El sistema calcula total de productos dejados, pago del dia, fiado del dia y
  deuda final.
- Al guardar la factura, se actualiza la deuda del cliente.
- Desde la factura guardada se abre WhatsApp con el resumen para el cliente.

## Liquidacion diaria

La liquidacion diaria debe mostrar:

- Productos dejados ese dia.
- Valor total de productos dejados ese dia.
- Total de facturas del dia.
- Total cobrado.
- Total fiado.
- Total abonado.
- Total deudas de la planilla del dia.
- Gastos de ruta: almuerzo, gasolina, prestamos, surtido consumido.
- Mercancia devuelta.
- Descuadre de plata.
- Descuadre de productos.
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
- Pago neto de carteristas.
- Pago neto de ayudantes.
- Neto del administrador.
- Facturas de ruta.
- Descuadres de dinero.
- Faltantes de productos.

Resumen por carterista:

- Dias trabajados.
- Rutas trabajadas.
- Productos dejados.
- Utilidad bruta.
- Neto a pagar.
- Descuentos acumulados.
- Alertas por descuadres o faltantes.

Detalle diario:

- Fecha.
- Dia de ruta.
- Ruta.
- Carterista.
- Ayudante.
- Productos dejados.
- Utilidad.
- Descuadre.
- Neto del carterista.

## Dashboard administrador

Debe mostrar:

- Ventas del dia.
- Cobros del dia.
- Fiados del dia.
- Deuda total.
- Deuda vencida.
- Ganancia del dia.
- Carteristas activos.
- Ayudantes activos.
- Rutas abiertas.
- Rutas liquidadas.
- Descuadres por plata.
- Descuadres por producto.
- Inventario bajo.
- Clientes nuevos.
- Clientes para borrar pendientes de revision.

## Mapa y ubicacion

Solo administrador:

- Mapa en tiempo real.
- Punto rojo por cada carterista.
- Nombre del carterista.
- Ultima hora reportada.
- Datos actualizados si el carterista tiene ubicacion activa.

## Importacion masiva

Desde administrador:

- Subir productos por Excel.
- Subir clientes por Excel.
- Subir proveedores por Excel.
- Actualizar datos masivos sin borrar historial.

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
