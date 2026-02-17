// Datos de empresas y licencias para verificación local de NIT
// Última actualización: 2026-02-08

export interface DirectorEmpresa {
  nombre: string;
  cedula: string;
  correo: string;
}

export interface LicenciaEmpresa {
  id: number;
  codigo: string;
  nombre: string;
  activa: boolean;
}

export interface EmpresaLicencia {
  nit: string;
  razon_social: string;
  directores: DirectorEmpresa[];
  licencias: LicenciaEmpresa[];
}

export const EMPRESAS: EmpresaLicencia[] = [
  {
    nit: "900123456",
    razon_social: "CONSTRUCTORA ANDINA S.A.S",
    directores: [
      { nombre: "Carlos Andrés Méndez", cedula: "1234567890", correo: "carlos.mendez@constructoraandina.com" },
      { nombre: "Luz Marina Hernández", cedula: "1234567891", correo: "lhernandez@constructoraandina.com" },
    ],
    licencias: [
      { id: 1, codigo: "01", nombre: "GENERAL", activa: true },
      { id: 2, codigo: "0", nombre: "General General Null", activa: true },
      { id: 3, codigo: "3", nombre: "HGI Nómina", activa: true },
      { id: 4, codigo: "1", nombre: "HGI Administrativo", activa: true },
      { id: 5, codigo: "2", nombre: "HGI Contable", activa: true },
      { id: 6, codigo: "12", nombre: "HGI CRM", activa: false },
    ],
  },
  {
    nit: "800234567",
    razon_social: "TECNOLOGÍA DIGITAL LTDA",
    directores: [
      { nombre: "María Fernanda Rojas", cedula: "2345678901", correo: "mf.rojas@tecnodigital.com" },
      { nombre: "Pedro Antonio Vega", cedula: "2345678902", correo: "pvega@tecnodigital.com" },
      { nombre: "Ana Lucía Martínez", cedula: "2345678903", correo: "amartinez@tecnodigital.com" },
    ],
    licencias: [
      { id: 1, codigo: "01", nombre: "GENERAL", activa: true },
      { id: 7, codigo: "14", nombre: "HGI Cloud Administrativo", activa: true },
      { id: 8, codigo: "15", nombre: "HGI Cloud Contable", activa: true },
      { id: 9, codigo: "16", nombre: "HGI Cloud Nómina", activa: true },
      { id: 10, codigo: "11", nombre: "HGI Servicios Web", activa: true },
      { id: 11, codigo: "13", nombre: "HGI Docs", activa: true },
    ],
  },
  {
    nit: "700345678",
    razon_social: "COMERCIALIZADORA DEL PACIFICO S.A",
    directores: [
      { nombre: "Jorge Luis Vargas", cedula: "3456789012", correo: "jvargas@comercializadorapacifico.com" },
      { nombre: "Marta Isabel Rincón", cedula: "3456789013", correo: "mrincon@comercializadorapacifico.com" },
    ],
    licencias: [
      { id: 1, codigo: "01", nombre: "GENERAL", activa: true },
      { id: 12, codigo: "4", nombre: "HGI Pos", activa: true },
      { id: 13, codigo: "30", nombre: "HGI STORE", activa: true },
      { id: 14, codigo: "36", nombre: "Hgi Web Pos", activa: true },
      { id: 15, codigo: "21", nombre: "HGInet Factura", activa: true },
      { id: 16, codigo: "2", nombre: "HGI Contable", activa: true },
    ],
  },
  {
    nit: "600456789",
    razon_social: "INVERSIONES Y SERVICIOS LA COSTA S.A.S",
    directores: [
      { nombre: "Ana Patricia Suárez", cedula: "4567890123", correo: "asuarez@inversioneslacosta.com" },
    ],
    licencias: [
      { id: 1, codigo: "01", nombre: "GENERAL", activa: true },
      { id: 3, codigo: "3", nombre: "HGI Nómina", activa: true },
      { id: 17, codigo: "19", nombre: "HGI Mail", activa: true },
      { id: 18, codigo: "20", nombre: "HGInet SMS", activa: true },
      { id: 19, codigo: "10", nombre: "HGI Móvil", activa: true },
      { id: 20, codigo: "12", nombre: "HGI CRM", activa: true },
    ],
  },
  {
    nit: "500567890",
    razon_social: "GRUPO EMPRESARIAL DEL NORTE LTDA",
    directores: [
      { nombre: "Roberto Carlos Jiménez", cedula: "5678901234", correo: "rjimenez@grupodelnorte.com" },
      { nombre: "Gloria Patricia Ospina", cedula: "5678901235", correo: "gospina@grupodelnorte.com" },
      { nombre: "Fernando José Castro", cedula: "5678901236", correo: "fcastro@grupodelnorte.com" },
    ],
    licencias: [
      { id: 1, codigo: "01", nombre: "GENERAL", activa: true },
      { id: 21, codigo: "33", nombre: "Hgi Web Administrativo", activa: true },
      { id: 22, codigo: "34", nombre: "Hgi Web Contable", activa: true },
      { id: 23, codigo: "27", nombre: "Hgi Web CRM", activa: true },
      { id: 24, codigo: "35", nombre: "Hgi Web Nómina", activa: true },
      { id: 25, codigo: "22", nombre: "HGIPAY", activa: true },
    ],
  },
  {
    nit: "400678901",
    razon_social: "SOLUCIONES INTEGRALES DEL SUR S.A",
    directores: [
      { nombre: "Diana Carolina Moreno", cedula: "6789012345", correo: "dmoreno@solucionessur.com" },
      { nombre: "Javier Enrique Parra", cedula: "6789012346", correo: "jparra@solucionessur.com" },
    ],
    licencias: [
      { id: 1, codigo: "01", nombre: "GENERAL", activa: true },
      { id: 4, codigo: "1", nombre: "HGI Administrativo", activa: true },
      { id: 5, codigo: "2", nombre: "HGI Contable", activa: true },
      { id: 6, codigo: "18", nombre: "HGI Backup", activa: true },
      { id: 26, codigo: "23", nombre: "Happgi", activa: true },
      { id: 27, codigo: "13", nombre: "HGI Docs", activa: false },
    ],
  },
  {
    nit: "300789012",
    razon_social: "DISTRIBUCIONES Y LOGISTICA EL VALLE S.A.S",
    directores: [
      { nombre: "Eduardo Alejandro Pérez", cedula: "7890123456", correo: "eperez@distrivalle.com" },
    ],
    licencias: [
      { id: 1, codigo: "01", nombre: "GENERAL", activa: true },
      { id: 12, codigo: "4", nombre: "HGI Pos", activa: true },
      { id: 13, codigo: "30", nombre: "HGI STORE", activa: true },
      { id: 28, codigo: "28", nombre: "Hgi Web WMS", activa: true },
      { id: 15, codigo: "21", nombre: "HGInet Factura", activa: true },
      { id: 29, codigo: "17", nombre: "HGI Cloud Pos", activa: true },
    ],
  },
  {
    nit: "200890123",
    razon_social: "SERVICIOS PROFESIONALES CARIBE LTDA",
    directores: [
      { nombre: "Sandra Milena Torres", cedula: "8901234567", correo: "storres@servicioscaribe.com" },
      { nombre: "Miguel Ángel Rojas", cedula: "8901234568", correo: "mrojas@servicioscaribe.com" },
    ],
    licencias: [
      { id: 1, codigo: "01", nombre: "GENERAL", activa: true },
      { id: 3, codigo: "3", nombre: "HGI Nómina", activa: true },
      { id: 4, codigo: "1", nombre: "HGI Administrativo", activa: true },
      { id: 17, codigo: "19", nombre: "HGI Mail", activa: true },
      { id: 30, codigo: "32", nombre: "HGI Docs Suscripción", activa: true },
      { id: 20, codigo: "12", nombre: "HGI CRM", activa: true },
    ],
  },
  {
    nit: "100901234",
    razon_social: "CORPORACIÓN TECNOLÓGICA DE ORIENTE S.A",
    directores: [
      { nombre: "Luis Fernando Castillo", cedula: "9012345678", correo: "lcastillo@corptecoriente.com" },
      { nombre: "Patricia Andrea Silva", cedula: "9012345679", correo: "psilva@corptecoriente.com" },
    ],
    licencias: [
      { id: 1, codigo: "01", nombre: "GENERAL", activa: true },
      { id: 7, codigo: "14", nombre: "HGI Cloud Administrativo", activa: true },
      { id: 8, codigo: "15", nombre: "HGI Cloud Contable", activa: true },
      { id: 9, codigo: "16", nombre: "HGI Cloud Nómina", activa: true },
      { id: 10, codigo: "11", nombre: "HGI Servicios Web", activa: true },
      { id: 31, codigo: "18", nombre: "HGI Backup", activa: true },
    ],
  },
  {
    nit: "123456789",
    razon_social: "MEGAPROYECTOS Y CONSTRUCCIONES DEL CENTRO S.A.S",
    directores: [
      { nombre: "Claudia Marcela Gómez", cedula: "1122334455", correo: "cgomez@megaproyectoscentro.com" },
      { nombre: "Andrés Felipe Morales", cedula: "1122334456", correo: "amorales@megaproyectoscentro.com" },
      { nombre: "Beatriz Elena Cortés", cedula: "1122334457", correo: "bcortes@megaproyectoscentro.com" },
    ],
    licencias: [
      { id: 1, codigo: "01", nombre: "GENERAL", activa: true },
      { id: 3, codigo: "3", nombre: "HGI Nómina", activa: true },
      { id: 5, codigo: "2", nombre: "HGI Contable", activa: false },
      { id: 12, codigo: "4", nombre: "HGI Pos", activa: false },
      { id: 19, codigo: "10", nombre: "HGI Móvil", activa: false },
      { id: 25, codigo: "22", nombre: "HGIPAY", activa: true },
      { id: 15, codigo: "21", nombre: "HGInet Factura", activa: true },
    ],
  },
];

/**
 * Busca una empresa por NIT en los datos locales.
 * Retorna la empresa si existe, o null si no se encuentra.
 */
export function buscarEmpresaPorNit(nit: string): EmpresaLicencia | null {
  const nitLimpio = nit.trim();
  return EMPRESAS.find((e) => e.nit === nitLimpio) || null;
}

/**
 * Verifica si una empresa tiene al menos una licencia activa (excluyendo GENERAL).
 */
export function tieneAlgunaLicenciaActiva(empresa: EmpresaLicencia): boolean {
  return empresa.licencias.some((lic) => lic.activa && lic.codigo !== '01' && lic.codigo !== '0');
}

/**
 * Obtiene las licencias activas de una empresa (excluyendo GENERAL).
 */
export function licenciasActivas(empresa: EmpresaLicencia): LicenciaEmpresa[] {
  return empresa.licencias.filter((lic) => lic.activa && lic.codigo !== '01' && lic.codigo !== '0');
}
