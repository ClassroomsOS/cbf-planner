export default {
  id: 'calendar',
  name: 'Calendario Académico',
  description: 'Configuración de períodos, cronograma de eventos y comunicado imprimible.',
  icon: '📅',
  estimatedMin: 7,
  steps: [
    {
      id: 'cal-01',
      title: 'Navegar al Calendario Académico',
      description: 'Haz click en "Calendario Académico" en el sidebar (sección de coordinación). Solo visible para admin/rector.',
      route: '/academic-calendar',
      hint: 'Si no ves el enlace en el sidebar, verifica que tu rol sea admin o rector.',
    },
    {
      id: 'cal-02',
      title: 'Tabs principales visibles',
      description: 'Deben verse 3 tabs: "📅 Períodos", "📋 Cronograma" y "🖨 Comunicado". La tab activa tiene fondo blanco con sombra.',
      spotlight: '.acp-tabs',
    },
    {
      id: 'cal-03',
      title: 'Hint informativo — tipo bloque',
      description: 'El texto debajo de las tabs debe aparecer como un bloque azul claro con borde izquierdo azul oscuro, NO como una pastilla/badge pequeño.',
      spotlight: '.acp-hint',
    },
    {
      id: 'cal-04',
      title: '3 cards de período — colapsadas',
      description: 'Deben verse exactamente 3 cards (P1 rojo, P2 azul, P3 verde). Cada una debe mostrar SOLO el header con el badge y el botón "+ Configurar" o "✎ Editar". El formulario NO debe estar abierto por defecto.',
      spotlight: '.acp-periods-grid',
    },
    {
      id: 'cal-05',
      title: 'Expandir card — botón desaparece',
      description: 'Haz click en el botón "+ Configurar" de cualquier card. El formulario debe expandirse Y el botón editar debe DESAPARECER (en la versión anterior aparecía dos veces).',
    },
    {
      id: 'cal-06',
      title: 'Labels de firma en una sola línea',
      description: 'En el formulario expandido, las etiquetas "Director de sede" y "Coordinación académica" deben verse en una sola línea sin romperse ni apilarse en dos líneas.',
    },
    {
      id: 'cal-07',
      title: 'Inputs del formulario con fondo gris claro',
      description: 'Los campos del formulario deben tener fondo #f8fafc (gris muy claro), no blanco puro. Al hacer focus deben cambiar a blanco con borde azul.',
    },
    {
      id: 'cal-08',
      title: 'Cancelar — form colapsa',
      description: 'Haz click en "Cancelar". El formulario debe cerrarse y el botón "+ Configurar" / "✎ Editar" debe volver a aparecer en el header.',
    },
    {
      id: 'cal-09',
      title: 'Tab Cronograma — agregar evento',
      description: 'Cambia a la tab "Cronograma". Haz click en "+ Agregar evento". El modal debe abrirse con fondo oscuro difuminado (backdrop-filter: blur).',
      spotlight: '.acp-tabs',
    },
    {
      id: 'cal-10',
      title: 'Modal de evento — cerrar con overlay',
      description: 'Haz click fuera del modal (en el overlay oscuro). El modal debe cerrarse sin guardar nada.',
    },
    {
      id: 'cal-11',
      title: 'Tab Comunicado — vista previa',
      description: 'Cambia a la tab "Comunicado". Si el período tiene fechas guardadas, debe verse un documento preview tipo carta con encabezado del colegio, lista de semanas y cronograma. Si no hay fechas, muestra mensaje de instrucción.',
    },
  ],
}
