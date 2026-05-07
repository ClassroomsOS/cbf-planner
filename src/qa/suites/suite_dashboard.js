export default {
  id: 'dashboard',
  name: 'Dashboard & Perfil',
  description: 'Navegación principal, widget de período y modal de perfil.',
  icon: '🏠',
  estimatedMin: 3,
  steps: [
    {
      id: 'db-01',
      title: 'Sidebar — logo y nombre del colegio',
      description: 'El sidebar debe mostrar el logo / nombre del colegio en la parte superior, con fondo azul oscuro.',
      hint: 'Busca "BOSTON FLEX" o el nombre del colegio en la cabecera del menú lateral.',
      spotlight: '.sb-logo',
    },
    {
      id: 'db-02',
      title: 'Widget de período activo',
      description: 'Debajo del logo, el widget de período debe indicar cuál período está activo (P2 · Mayo–Agosto 2026) y mostrar una barra de progreso.',
      hint: 'El widget muestra el código del período (P1/P2/P3) y las semanas restantes.',
      spotlight: '.sb-period-widget',
    },
    {
      id: 'db-03',
      title: 'Abrir modal de perfil',
      description: 'Haz click en tu nombre en la barra inferior del sidebar. El modal "Mi Perfil" debe abrirse centrado, sin salirse por la derecha de la pantalla.',
      hint: 'El campo "Iniciales" debe verse completo — en versiones anteriores se cortaba.',
      spotlight: '.sb-profile-bar',
    },
    {
      id: 'db-04',
      title: 'Modal: campo Iniciales visible',
      description: 'Dentro del modal, la fila "Nombre completo | Iniciales" debe mostrar ambos campos completos. El campo Iniciales (ED / 2 letras) no debe estar cortado.',
      spotlight: '.prof-modal',
    },
    {
      id: 'db-05',
      title: 'Modal: selector de período — solo 3 opciones',
      description: 'El selector "Período actual" en Preferencias debe tener exactamente 3 opciones: 1.er, 2.° y 3.er Período 2026. NO debe aparecer el 4.to Período.',
    },
    {
      id: 'db-06',
      title: 'Cerrar modal con ✕',
      description: 'Cierra el modal con la X. El modal debe cerrar sin errores. La app debe seguir funcionando normalmente.',
    },
  ],
}
