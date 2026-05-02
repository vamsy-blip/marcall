// Barrel re-exports — actual pages live in their own files now.
// Kept for backwards compatibility with any older imports.
export { default as AdminDashboard } from './Panorama';
export { default as AdminPanorama } from './Panorama';
export { default as AdminTenants } from './Tenants';
export { default as AdminResellers } from './Resellers';
export { default as AdminSuscripciones } from './Suscripciones';
export { default as AdminLlamadas } from './Llamadas';
export { default as AdminKyc } from './KYC';
export { default as AdminARCO } from './ARCO';
export { default as AdminAuditoria } from './Auditoria';
export { default as AdminSistema } from './Sistema';
// Plans page was a stub — alias to Resellers placeholder for now.
export { default as AdminPlans } from './Resellers';
