export default {
  id: 'news',
  name: 'Módulo NEWS',
  description: 'Proyectos NEWS: filtrado por período, timeline y selección automática del período activo.',
  icon: '📰',
  estimatedMin: 5,
  steps: [
    {
      id: 'nw-01',
      title: 'Navegar a NEWS',
      description: 'Haz click en "NEWS" en el sidebar. La página debe cargar mostrando los proyectos del período activo.',
      route: '/news',
      hint: 'El sistema debe seleccionar automáticamente P2 (Mayo–Agosto), no siempre P1.',
    },
    {
      id: 'nw-02',
      title: 'Período activo por defecto',
      description: 'Al cargar NEWS, el tab de período resaltado debe ser el período actual (P2), no necesariamente P1. Si hoy está en P2, P2 debe estar activo.',
    },
    {
      id: 'nw-03',
      title: 'Exactamente 3 tabs de período',
      description: 'Los tabs de período deben ser: 1.er Período, 2.° Período, 3.er Período. No debe aparecer un 4.to Período.',
    },
    {
      id: 'nw-04',
      title: 'Cambio de período — filtrado correcto',
      description: 'Cambia al 1.er Período. Los proyectos mostrados deben ser SOLO del P1. Si no hay proyectos en P1, debe mostrarse el estado vacío (no datos del P2 mezclados).',
    },
    {
      id: 'nw-05',
      title: 'Navegar al Timeline',
      description: 'Abre la vista Timeline de NEWS (botón en la página). Debe navegar a /news/timeline.',
      route: '/news/timeline',
    },
    {
      id: 'nw-06',
      title: 'Timeline: período activo por defecto',
      description: 'El Timeline también debe arrancar en el período activo (P2), no forzar P1.',
    },
    {
      id: 'nw-07',
      title: 'Timeline: exactamente 3 períodos',
      description: 'Confirma que el Timeline también muestra solo P1, P2, P3 — sin P4.',
    },
    {
      id: 'nw-08',
      title: 'Timeline: botón Volver a NEWS',
      description: 'El botón "← Volver a NEWS" debe estar visible en la parte superior y funcionar correctamente.',
      spotlight: '.nt-back',
    },
  ],
}
