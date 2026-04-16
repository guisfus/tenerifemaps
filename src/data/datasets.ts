import type { DatasetDefinition, LocaleCode } from '../types'

const CKAN_URL_PATTERN = /\/dataset\/([^/]+)\/resource\/([^/]+)\//i

function inferCkanIds(url: string) {
  const match = url.match(CKAN_URL_PATTERN)

  if (!match) {
    return {}
  }

  return {
    packageId: match[1],
    resourceId: match[2],
  }
}

function createDataset(dataset: Omit<DatasetDefinition, 'packageId' | 'resourceId'> & Pick<Partial<DatasetDefinition>, 'packageId' | 'resourceId'>): DatasetDefinition {
  return {
    ...inferCkanIds(dataset.url),
    ...dataset,
  }
}

const CATEGORY_LABELS: Record<string, Record<LocaleCode, string>> = {
  mobility: { es: 'Movilidad', en: 'Mobility' },
  retail: { es: 'Comercio', en: 'Retail' },
  education: { es: 'Educacion y cultura', en: 'Education and culture' },
  industry: { es: 'Industria', en: 'Industry' },
  civic: { es: 'Tejido social', en: 'Civic life' },
  hospitality: { es: 'Hosteleria', en: 'Hospitality' },
  public: { es: 'Sector publico', en: 'Public sector' },
  tourism: { es: 'Turismo', en: 'Tourism' },
  agriculture: { es: 'Agricultura', en: 'Agriculture' },
  realestate: { es: 'Espacios disponibles', en: 'Available spaces' },
  health: { es: 'Salud', en: 'Healthcare' },
  leisure: { es: 'Ocio y deporte', en: 'Leisure and sport' },
  services: { es: 'Servicios', en: 'Services' },
}

// Single source of truth for every dataset exposed by the application.
// CKAN ids are inferred from the download URLs so the backend can use CKAN as a
// metadata resolution layer while keeping `url` as an unconditional fallback.
export const DATASETS: DatasetDefinition[] = [
  createDataset({
    key: 'transporte',
    category: 'mobility',
    title: { es: 'Transporte', en: 'Transport' },
    description: {
      es: 'Infraestructuras y recursos relacionados con el transporte en Tenerife.',
      en: 'Transport infrastructure and related resources across Tenerife.',
    },
    url: 'https://datos.tenerife.es/ckan/dataset/3d068b49-dd7d-4e7f-bf0a-9e4a9e57b6aa/resource/84b63bea-06b7-4535-97dd-e8e338443eff/download/empresas-e-infraestructuras-relacionadas-con-el-transporte-en-tenerife.geojson',
  }),
  createDataset({
    key: 'alimentacion',
    category: 'retail',
    title: { es: 'Alimentacion', en: 'Food retail' },
    description: {
      es: 'Comercios de alimentacion y recursos asociados de la isla.',
      en: 'Food-related businesses and supporting resources on the island.',
    },
    url: 'https://datos.tenerife.es/ckan/dataset/8da30f5b-8233-4da5-b756-482cf310d0c8/resource/7f981496-d478-4552-9662-416932e2dc60/download/comercios-de-alimentacion-en-tenerife.geojson',
  }),
  createDataset({
    key: 'educacion_y_cultura',
    category: 'education',
    title: { es: 'Educacion y cultura', en: 'Education and culture' },
    description: {
      es: 'Centros educativos, recursos culturales y equipamientos relacionados.',
      en: 'Educational centres, cultural resources and related facilities.',
    },
    url: 'https://datos.tenerife.es/ckan/dataset/573a49e8-e2fb-4fe4-b47b-ac5dec1bf580/resource/e7be676d-af81-48ef-985a-c62268559c27/download/centros-educativos-y-culturales-en-tenerife.geojson',
  }),
  createDataset({
    key: 'comercio',
    category: 'retail',
    title: { es: 'Comercio', en: 'Commerce' },
    description: {
      es: 'Locales comerciales y tejido economico de proximidad.',
      en: 'Commercial premises and local economic activity.',
    },
    url: 'https://datos.tenerife.es/ckan/dataset/2fedd81a-bad0-4ca7-a79d-f9dad6556214/resource/28ec8345-c612-4c00-8aff-eff4d359e28c/download/locales-comerciales-en-tenerife.geojson',
  }),
  createDataset({
    key: 'industria',
    category: 'industry',
    title: { es: 'Industria', en: 'Industry' },
    description: {
      es: 'Actividad industrial y empresas calificadas del sector.',
      en: 'Industrial activity and registered companies in the sector.',
    },
    url: 'https://datos.tenerife.es/ckan/dataset/a4aa81b3-b1ad-4b34-b7a5-cee273ab346f/resource/8dc55169-1562-43af-8a7c-18b69d159950/download/empresas-industriales-en-tenerife.geojson',
  }),
  createDataset({
    key: 'asociaciones',
    category: 'civic',
    title: { es: 'Asociaciones', en: 'Associations' },
    description: {
      es: 'Asociaciones ciudadanas y entidades del tejido social insular.',
      en: 'Citizen associations and community organisations across the island.',
    },
    url: 'https://datos.tenerife.es/ckan/dataset/07d27432-754c-4d49-8fa2-5ab97a734f3b/resource/30dec753-e4c1-4d28-a55c-15c478aefeb5/download/asociaciones-ciudadanas-en-tenerife.geojson',
  }),
  createDataset({
    key: 'hosteleria_y_restauracion',
    category: 'hospitality',
    title: { es: 'Hosteleria y restauracion', en: 'Hospitality and dining' },
    description: {
      es: 'Locales de hosteleria, restauracion y actividad vinculada al ocio gastronomico.',
      en: 'Hospitality venues, restaurants and food-related leisure activity.',
    },
    url: 'https://datos.tenerife.es/ckan/dataset/3cf96f37-47b7-4485-931c-c32a2b13e5c0/resource/1d87c570-2888-484d-ba5a-83498cf7985b/download/locales-de-hosteleria-y-restauracion-en-tenerife.geojson',
  }),
  createDataset({
    key: 'servicios_publicos',
    category: 'public',
    title: { es: 'Servicios publicos', en: 'Public services' },
    description: {
      es: 'Administracion, servicios publicos y equipamientos institucionales.',
      en: 'Government, public services and institutional facilities.',
    },
    url: 'https://datos.tenerife.es/ckan/dataset/5277a556-81f2-46e5-8a22-8024bfddd387/resource/6724ef3f-f61b-4acd-889a-2696b34615d8/download/administraciones-y-servicios-publicos-en-tenerife.geojson',
  }),
  createDataset({
    key: 'turismo',
    category: 'tourism',
    title: { es: 'Turismo', en: 'Tourism' },
    description: {
      es: 'Alojamientos, agencias y activos del ecosistema turistico insular.',
      en: 'Accommodation, agencies and assets across the island tourism ecosystem.',
    },
    url: 'https://datos.tenerife.es/ckan/dataset/d9cffe8d-3ff5-43b4-864a-b246c8b98cb7/resource/c90123d2-51b6-403a-8318-1b54c64b6e44/download/alojamientos-turisticos-y-agencias-de-viajes-en-tenerife.geojson',
  }),
  createDataset({
    key: 'agricultura',
    category: 'agriculture',
    title: { es: 'Agricultura', en: 'Agriculture' },
    description: {
      es: 'Recursos georreferenciados relacionados con actividad agricola y comercial asociada.',
      en: 'Geospatial resources related to agriculture and associated commercial activity.',
    },
    url: 'https://datos.tenerife.es/ckan/dataset/8c5fae80-fc10-4421-a525-9a15ee0fb56b/resource/38566b6c-1141-482b-bf1b-c88a7cb6cea6/download/comercios-en-el-ambito-de-la-agricultura-en-tenerife.geojson',
  }),
  createDataset({
    key: 'locales_disponibles',
    category: 'realestate',
    title: { es: 'Locales disponibles', en: 'Available premises' },
    description: {
      es: 'Locales, naves y espacios disponibles o en desarrollo.',
      en: 'Premises, warehouses and spaces available or under development.',
    },
    url: 'https://datos.tenerife.es/ckan/dataset/c9ca7c2b-cfb2-4620-b27b-8eafc4828cbb/resource/229b2155-3133-4b36-a44c-6a51246f5259/download/locales-y-naves-disponibles-o-en-construccion-en-tenerife.geojson',
  }),
  createDataset({
    key: 'medicina_y_salud',
    category: 'health',
    title: { es: 'Medicina y salud', en: 'Healthcare' },
    description: {
      es: 'Centros sanitarios, farmacias y servicios de salud asociados.',
      en: 'Healthcare centres, pharmacies and related medical services.',
    },
    url: 'https://datos.tenerife.es/ckan/dataset/7d98949a-1e2f-4bdc-9280-83b81da0be35/resource/cc411345-4269-4e73-84d6-edb8a9598886/download/centros-medicos-farmacias-y-servicios-sanitarios-en-tenerife.geojson',
  }),
  createDataset({
    key: 'deporte_y_ocio',
    category: 'leisure',
    title: { es: 'Deporte y ocio', en: 'Sport and leisure' },
    description: {
      es: 'Recursos georreferenciados de actividad deportiva y ocio.',
      en: 'Geospatial resources linked to sport and leisure activity.',
    },
    url: 'https://datos.tenerife.es/ckan/dataset/9778eb26-533c-438a-8528-c6302c359d42/resource/2e185e22-18d9-4ad3-998f-bb6ca00bf0e4/download/centros-deportivos-y-de-ocio-en-tenerife.geojson',
  }),
  createDataset({
    key: 'servicios',
    category: 'services',
    title: { es: 'Servicios', en: 'Services' },
    description: {
      es: 'Empresas y recursos vinculados al sector servicios.',
      en: 'Companies and resources connected to the services sector.',
    },
    url: 'https://datos.tenerife.es/ckan/dataset/e781a8b2-6d9d-4ae2-9b10-d030a780e442/resource/f005d3e6-c95d-41cf-9749-10aa6838d5e2/download/empresas-dedicadas-a-actividad-de-servicios-en-tenerife.geojson',
  }),
]

export function getDatasetPresentation(dataset: DatasetDefinition, locale: string) {
  const safeLocale = (locale === 'en' ? 'en' : 'es') as LocaleCode

  return {
    title: dataset.title[safeLocale],
    description: dataset.description[safeLocale],
  }
}

export function getDatasetCategoryLabel(category: string, locale: string) {
  const safeLocale = (locale === 'en' ? 'en' : 'es') as LocaleCode
  return CATEGORY_LABELS[category]?.[safeLocale] ?? category
}
