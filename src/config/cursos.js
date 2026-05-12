//Lista unica de cursos del centro. Es la unica fuente de verdad para todos los
//modulos que necesiten mostrar el nombre legible de un curso o validar codigos.
//
//Modulos que la consumen actualmente:
//- src/views/directive/ListScreen.js (filtro de cursos en panel directiva)
//- src/views/teacher/StudentsListScreen.js (filtro de cursos en busqueda manual)
//- server.js (backend, para /api/verificar-tarjeta)
//
//Si anades un curso nuevo, anadelo aqui y se reflejara en toda la aplicacion.
//Si el curso aparece en Odoo pero no esta aqui, los filtros lo mostraran con
//su codigo corto en lugar del nombre largo (comportamiento fallback seguro).
//
//Compatibilidad: este archivo usa module.exports (CommonJS) para que pueda ser
//consumido tanto por el server.js (Node) como por React Native (Metro/Babel
//traduce los import a require internamente, asi que funciona en ambos lados).

//Mapeo codigo corto -> nombre completo del curso
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

//Lista ordenada de cursos para iterar en el orden definido aqui (no por orden
//alfabetico de claves, que dejaria 1BACH_CIEN antes de 1CFGB_AGR de forma rara).
//Object.entries respeta el orden de insercion en JS moderno, asi que esto coincide
//con el orden visual deseado: ESO, Bachillerato, CFGB, CFGM, CFGS.
const LISTA_CURSOS = Object.entries(MAPA_CURSOS).map(([codigo, etiqueta]) => ({
  codigo,
  etiqueta,
}));

//Valor especial para el filtro cuando no hay filtro aplicado.
//Lo centralizamos aqui para que ListScreen y StudentsListScreen usen el mismo
//valor sin riesgo de typos.
const FILTRO_TODOS = '__TODOS__';

//Helper: devuelve el nombre largo de un curso a partir de su codigo.
//Fallback seguro: si el codigo no existe en el mapa, devuelve el propio codigo
//(para que la UI muestre algo aunque sea raro, en lugar de undefined o vacio).
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