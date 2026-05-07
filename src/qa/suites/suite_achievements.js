export default {
  id: 'achievements',
  name: 'Logros por Período',
  description: 'Filtrado de logros por período, selección automática del activo y creación de nuevos logros.',
  icon: '🏆',
  estimatedMin: 4,
  steps: [
    {
      id: 'ach-01',
      title: 'Navegar a Logros',
      description: 'Haz click en la sección de Logros desde el sidebar.',
      route: '/achievements',
    },
    {
      id: 'ach-02',
      title: 'Período activo seleccionado por defecto',
      description: 'Al entrar a Logros, el filtro de período debe estar en el período actual (P2), no en "Todos" ni forzado a P1.',
    },
    {
      id: 'ach-03',
      title: 'Exactamente 3 tabs de período',
      description: 'Los tabs de período deben ser P1, P2 y P3 únicamente. Sin P4.',
    },
    {
      id: 'ach-04',
      title: 'Cambiar a P1 — lista se actualiza',
      description: 'Cambia el filtro a P1. La lista de logros debe actualizarse y mostrar solo los del primer período.',
    },
    {
      id: 'ach-05',
      title: 'Nuevo logro — período pre-seleccionado',
      description: 'Abre el formulario de nuevo logro. El campo "Período" debe venir pre-cargado con el período activo (P2), no con P1 siempre.',
    },
    {
      id: 'ach-06',
      title: 'Regresar a P2 — datos correctos',
      description: 'Vuelve a seleccionar P2 en el filtro. Los logros del P2 deben aparecer nuevamente sin mezcla con P1.',
    },
  ],
}
