const MAPA_CURSOS = {
  '1ESO':         '1 Educacion Secundaria Obligatoria',
  '2ESO':         '2 Educacion Secundaria Obligatoria',
  '3ESO':         '3 Educacion Secundaria Obligatoria',
  '3ESODIV':      '3 ESO - Diversificacion',
  '4ESO':         '4 Educacion Secundaria Obligatoria',
  '4ESODIV':      '4 ESO - Diversificacion',
  '1BACH_CIEN':   '1 Bachillerato Ciencias y Tecnologia',
  '2BACH_CIEN':   '2 Bachillerato Ciencias y Tecnologia',
  '1BACH_HCS':    '1 Bachillerato Humanidades y C. Sociales',
  '2BACH_HCS':    '2 Bachillerato Humanidades y C. Sociales',
  '1CFGB_AGR':    '1 CFGB Aprovechamientos Forestales',
  '2CFGB_AGR':    '2 CFGB Agrojardineria y Comp. Florales',
  '1CFGM_SMR':    '1 CFGM Sistemas Microinformaticos y Redes',
  '2CFGM_SMR':    '2 CFGM Sistemas Microinformaticos y Redes',
  '1CFGM_ACMN':   '1 CFGM Aprovechamiento y Cons. Medio Natural',
  '2CFGM_ACMN':   '2 CFGM Aprovechamiento y Cons. Medio Natural',
  '1DAM':         '1 CFGS Desarrollo de Aplicaciones Multiplataforma',
  '2DAM':         '2 CFGS Desarrollo de Aplicaciones Multiplataforma',
  '1CFGS_GFMN':   '1 CFGS Gestion Forestal y del Medio Natural',
  '2CFGS_GFMN':   '2 CFGS Gestion Forestal y del Medio Natural',
};


const LISTA_CURSOS = Object.entries(MAPA_CURSOS).map(([codigo, etiqueta]) => ({
  codigo,
  etiqueta,
}));


const FILTRO_TODOS = '__TODOS__';

function getNombreCurso(codigo) {
  if (!codigo || codigo === false) return 'Sin curso';
  return MAPA_CURSOS[codigo] || codigo;
}

module.exports = {
  MAPA_CURSOS,
  LISTA_CURSOS,
  FILTRO_TODOS,
  getNombreCurso,
};