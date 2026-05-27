export const categories = [
  { slug: "carnicos", nombre: "Cárnicos", imagen: "/categorias/carnicos.jpg" },
  { slug: "lacteos", nombre: "Lácteos", imagen: "/categorias/lacteos.jpg" },
  { slug: "reposteria", nombre: "Repostería", imagen: "/categorias/reposteria.jpg" },
  { slug: "galleteria", nombre: "Galletería", imagen: "/categorias/galleteria.jpg" },
  {
    slug: "venezolanos",
    nombre: "Importados Venezolanos",
    imagen: "/categorias/venezolanos.jpg",
  },
  { slug: "licores", nombre: "Licores", imagen: "/categorias/licores.jpg" },
  {
    slug: "frutossecos",
    nombre: "Frutos Secos",
    imagen: "/categorias/frutos-secos.jpg",
  },
  { slug: "confiteria", nombre: "Confitería", imagen: "/categorias/confiteria.jpg" },
  { slug: "cereales", nombre: "Cereales", imagen: "/categorias/cereales.jpg" },
  { slug: "electronicos", nombre: "Electrónicos", imagen: "/categorias/electronicos.jpg" },
  { slug: "jugueteria", nombre: "Juguetería", imagen: "/categorias/jugueteria.jpg" },
  { slug: "usados", nombre: "Usados / Segunda", imagen: "/categorias/usados.jpg" },
  { slug: "servicios", nombre: "Servicios", imagen: "/categorias/servicios.jpg" },
];

export function getCategoryBySlug(slug) {
  return categories.find((category) => category.slug === slug);
}
