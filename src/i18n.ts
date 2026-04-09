import { createI18n } from 'vue-i18n'

// All product copy lives here so the UI stays bilingual without scattering
// literal strings across components.
export const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: 'es',
  fallbackLocale: 'en',
  messages: {
    es: {
      hero: {
        title: 'Mapa operativo y visor de negocio para datos abiertos de Tenerife',
        description:
          'Una version mas limpia, rapida y profesional para explorar recursos georreferenciados, detectar concentraciones y exportar resultados con un flujo bilingue.',
      },
      controls: {
        dataset: 'Dataset activo',
        language: 'Idioma',
        search: 'Busqueda',
        searchPlaceholder: 'Buscar por nombre, municipio, direccion o actividad',
        refresh: 'Actualizar datos',
      },
      filters: {
        municipality: 'Municipio',
        activity: 'Actividad',
        contact: 'Contacto',
        allMunicipalities: 'Todos los municipios',
        allActivities: 'Todas las actividades',
        allRecords: 'Todos los registros',
        withContact: 'Con contacto',
        withoutContact: 'Sin contacto',
        reset: 'Limpiar filtros',
        active: 'Filtros activos',
      },
      metrics: {
        activeCategory: 'Categoria',
        totalLocations: 'Ubicaciones visibles',
        municipalities: 'Municipios cubiertos',
        activityTypes: 'Tipos de actividad',
      },
      map: {
        sectionEyebrow: 'Vista geoespacial',
        lastSync: 'Ultima sincronizacion',
        filteredResults: 'Resultados filtrados',
      },
      insights: {
        title: 'Resumen de cartera',
        subtitle: 'Peso relativo por dataset',
        ready: 'Listo',
      },
      details: {
        title: 'Ficha seleccionada',
        municipality: 'Municipio',
        address: 'Direccion',
        reference: 'Referencia',
        website: 'Sitio web',
        openWebsite: 'Abrir sitio web',
        sendEmail: 'Enviar email',
        empty: 'Selecciona una ubicacion en el mapa o en la tabla para inspeccionar su ficha.',
      },
      table: {
        title: 'Inventario',
        subtitle: 'Tabla filtrable y exportable',
        description: 'La seleccion en tabla y mapa esta sincronizada. Puedes ordenar, filtrar y exportar el resultado visible.',
        visibleResults: '{count} resultados visibles',
        exportCsv: 'Exportar CSV',
        columns: {
          name: 'Nombre',
          municipality: 'Municipio',
          address: 'Direccion',
          reference: 'Referencia',
          contact: 'Contacto',
        },
      },
      states: {
        loading: 'Cargando datos',
        noResults: 'No hay resultados para los filtros actuales.',
        noChartData: 'No hay datos disponibles para generar la grafica.',
      },
    },
    en: {
      hero: {
        title: 'Operational map and business viewer for Tenerife open data',
        description:
          'A cleaner, faster and more professional version to explore geospatial resources, identify clusters and export results through a bilingual workflow.',
      },
      controls: {
        dataset: 'Active dataset',
        language: 'Language',
        search: 'Search',
        searchPlaceholder: 'Search by name, municipality, address or activity',
        refresh: 'Refresh data',
      },
      filters: {
        municipality: 'Municipality',
        activity: 'Activity',
        contact: 'Contact',
        allMunicipalities: 'All municipalities',
        allActivities: 'All activities',
        allRecords: 'All records',
        withContact: 'With contact',
        withoutContact: 'Without contact',
        reset: 'Reset filters',
        active: 'Active filters',
      },
      metrics: {
        activeCategory: 'Category',
        totalLocations: 'Visible locations',
        municipalities: 'Covered municipalities',
        activityTypes: 'Activity types',
      },
      map: {
        sectionEyebrow: 'Geospatial view',
        lastSync: 'Last sync',
        filteredResults: 'Filtered results',
      },
      insights: {
        title: 'Portfolio summary',
        subtitle: 'Relative weight by dataset',
        ready: 'Ready',
      },
      details: {
        title: 'Selected record',
        municipality: 'Municipality',
        address: 'Address',
        reference: 'Reference',
        website: 'Website',
        openWebsite: 'Open website',
        sendEmail: 'Send email',
        empty: 'Select a location from the map or table to inspect its record.',
      },
      table: {
        title: 'Inventory',
        subtitle: 'Filterable and exportable table',
        description: 'Map and table selection stay synchronized. You can sort, filter and export the visible result set.',
        visibleResults: '{count} visible results',
        exportCsv: 'Export CSV',
        columns: {
          name: 'Name',
          municipality: 'Municipality',
          address: 'Address',
          reference: 'Reference',
          contact: 'Contact',
        },
      },
      states: {
        loading: 'Loading data',
        noResults: 'There are no results for the current filters.',
        noChartData: 'There is no data available to render the chart.',
      },
    },
  },
})
