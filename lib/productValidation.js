export const productUnits = ["unidad", "docena", "pacas", "cantidad"];

export function normalizeProductUnit(value) {
  const unit = String(value || "").trim().toLowerCase();
  return productUnits.includes(unit) ? unit : "unidad";
}

export function toProductNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function getProductPriceRange(product = {}) {
  const precioMayor = toProductNumber(product.precioMayor);
  const precioDetal = toProductNumber(product.precioDetal);
  const precioPacaMayor = toProductNumber(product.precioPacaMayor);
  const precioPacaDetal = toProductNumber(product.precioPacaDetal);
  const precioMinimo = toProductNumber(product.precioMinimo || precioMayor);
  const precioSugerido = precioDetal;
  const precioMaximo = toProductNumber(
    product.precioMaximo || precioPacaDetal || precioPacaMayor || precioDetal
  );

  return {
    precioMayor,
    precioDetal,
    precioPacaMayor,
    precioPacaDetal,
    precioMinimo,
    precioSugerido,
    precioMaximo,
  };
}

export function getProductValidationErrors(product = {}) {
  const errors = [];
  const nombre = String(product.nombre || "").trim();
  const costo = toProductNumber(product.costo);
  const stock = toProductNumber(product.stock);
  const stockMinimo = toProductNumber(product.stockMinimo);
  const unidadesPorPaca = toProductNumber(product.unidadesPorPaca);
  const iva = toProductNumber(product.iva);
  const unit = normalizeProductUnit(product.unidad);
  const {
    precioMayor,
    precioDetal,
    precioPacaMayor,
    precioPacaDetal,
    precioMinimo,
    precioSugerido,
    precioMaximo,
  } = getProductPriceRange(product);

  if (!nombre) errors.push("El nombre del producto es obligatorio.");
  if (!productUnits.includes(unit)) errors.push("La unidad del producto no es valida.");
  if (costo < 0) errors.push("El costo no puede ser negativo.");
  if (stock < 0) errors.push("El stock no puede ser negativo.");
  if (stockMinimo < 0) errors.push("El stock minimo no puede ser negativo.");
  if (unidadesPorPaca < 0) errors.push("Las unidades por paca no pueden ser negativas.");
  if (iva < 0) errors.push("El IVA no puede ser negativo.");
  if (precioMayor <= 0) errors.push("El precio mayor debe ser mayor a cero.");
  if (precioDetal <= 0) errors.push("El precio detal debe ser mayor a cero.");
  if (precioPacaMayor < 0 || precioPacaDetal < 0) {
    errors.push("Los precios por paca no pueden ser negativos.");
  }
  if (precioMinimo <= 0) errors.push("El precio minimo debe ser mayor a cero.");
  if (precioSugerido <= 0) errors.push("El precio sugerido debe ser mayor a cero.");
  if (precioMaximo <= 0) errors.push("El precio maximo debe ser mayor a cero.");
  if (precioMinimo > precioSugerido) {
    errors.push("El precio minimo no puede ser mayor que el precio sugerido.");
  }
  if (precioSugerido > precioMaximo) {
    errors.push("El precio sugerido no puede ser mayor que el precio maximo.");
  }
  if (costo > 0 && precioMaximo > 0 && costo > precioMaximo) {
    errors.push("El costo no puede ser mayor que el precio maximo de venta.");
  }

  return errors;
}
