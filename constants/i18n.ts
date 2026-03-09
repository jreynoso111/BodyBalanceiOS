export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'it', label: 'Italiano' },
] as const;

export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number]['code'];

type TranslationEntry = {
  es: string;
  fr: string;
  it: string;
};

const TRANSLATIONS: Record<string, TranslationEntry> = {
  Home: { es: 'Inicio', fr: 'Accueil', it: 'Home' },
  Contacts: { es: 'Contactos', fr: 'Contacts', it: 'Contatti' },
  Settings: { es: 'Configuracion', fr: 'Parametres', it: 'Impostazioni' },
  Profile: { es: 'Perfil', fr: 'Profil', it: 'Profilo' },
  Notifications: { es: 'Notificaciones', fr: 'Notifications', it: 'Notifiche' },
  Security: { es: 'Seguridad', fr: 'Securite', it: 'Sicurezza' },
  'Help & Support': { es: 'Ayuda y Soporte', fr: 'Aide et Support', it: 'Aiuto e Supporto' },
  'Terms of Service': { es: 'Terminos del Servicio', fr: "Conditions d'utilisation", it: 'Termini di Servizio' },
  'Privacy Policy': { es: 'Politica de Privacidad', fr: 'Politique de Confidentialite', it: 'Informativa sulla Privacy' },
  FAQ: { es: 'Preguntas Frecuentes', fr: 'FAQ', it: 'FAQ' },
  'Recover Password': { es: 'Recuperar Contrasena', fr: 'Recuperer le Mot de Passe', it: 'Recupera Password' },
  'Reset Password': { es: 'Restablecer Contrasena', fr: 'Reinitialiser le Mot de Passe', it: 'Reimposta Password' },
  'New Contact': { es: 'Nuevo Contacto', fr: 'Nouveau Contact', it: 'Nuovo Contatto' },
  'New Lend/Borrow': { es: 'Nuevo Prestar/Pedir', fr: 'Nouveau Pret/Emprunt', it: 'Nuovo Prestare/Prendere' },
  'Lend/Borrow Details': { es: 'Detalle de Prestar/Pedir', fr: 'Details Pret/Emprunt', it: 'Dettagli Prestare/Prendere' },
  'Pending Requests': { es: 'Solicitudes Pendientes', fr: 'Demandes en Attente', it: 'Richieste in Sospeso' },
  'Pending Confirmations': { es: 'Confirmaciones Pendientes', fr: 'Confirmations en Attente', it: 'Conferme in Sospeso' },
  'Admin Dashboard': { es: 'Panel Admin', fr: 'Dashboard Admin', it: 'Dashboard Admin' },
  'Platform Users': { es: 'Usuarios de la Plataforma', fr: 'Utilisateurs de la Plateforme', it: 'Utenti della Piattaforma' },
  'Platform Lend/Borrow': { es: 'Prestar/Pedir de la Plataforma', fr: 'Pret/Emprunt de la Plateforme', it: 'Prestare/Prendere della Piattaforma' },
  Confirmations: { es: 'Confirmaciones', fr: 'Confirmations', it: 'Conferme' },
  'Shared record confirmation': { es: 'Confirmacion del registro compartido', fr: 'Confirmation du suivi partage', it: 'Conferma del registro condiviso' },
  'Payment confirmation': { es: 'Confirmacion del pago', fr: 'Confirmation du paiement', it: 'Conferma del pagamento' },
  'Adjustment request': { es: 'Solicitud de ajuste', fr: "Demande d'ajustement", it: 'Richiesta di modifica' },

  'Full Name': { es: 'Nombre Completo', fr: 'Nom Complet', it: 'Nome Completo' },
  Email: { es: 'Correo', fr: 'Email', it: 'Email' },
  Phone: { es: 'Telefono', fr: 'Telephone', it: 'Telefono' },
  'Default Currency': { es: 'Moneda por Defecto', fr: 'Devise par Defaut', it: 'Valuta Predefinita' },
  'Default Language': { es: 'Idioma por Defecto', fr: 'Langue par Defaut', it: 'Lingua Predefinita' },
  'Save Profile': { es: 'Guardar Perfil', fr: 'Enregistrer le Profil', it: 'Salva Profilo' },
  'Saving...': { es: 'Guardando...', fr: 'Enregistrement...', it: 'Salvataggio...' },
  'Your full name': { es: 'Tu nombre completo', fr: 'Votre nom complet', it: 'Il tuo nome completo' },
  'User not found': { es: 'Usuario no encontrado', fr: 'Utilisateur introuvable', it: 'Utente non trovato' },
  'Profile updated': { es: 'Perfil actualizado', fr: 'Profil mis a jour', it: 'Profilo aggiornato' },
  'Profile updated. Run the latest Supabase migration to persist Default Language.': {
    es: 'Perfil actualizado. Ejecuta la ultima migracion de Supabase para guardar el Idioma por Defecto.',
    fr: 'Profil mis a jour. Executez la derniere migration Supabase pour conserver la langue par defaut.',
    it: "Profilo aggiornato. Esegui l'ultima migrazione Supabase per salvare la lingua predefinita.",
  },
  'Export Data (CSV)': { es: 'Exportar Datos (CSV)', fr: 'Exporter les Donnees (CSV)', it: 'Esporta Dati (CSV)' },
  'Share report': { es: 'Compartir reporte', fr: 'Partager le rapport', it: 'Condividi report' },
  'FAQ & guidance': { es: 'FAQ y guia', fr: 'FAQ et guide', it: 'FAQ e guida' },
  'Open balance': { es: 'Balance abierto', fr: 'Solde ouvert', it: 'Saldo aperto' },
  'Coming up': { es: 'Lo proximo', fr: 'A venir', it: 'In arrivo' },
  'Recent records': { es: 'Registros recientes', fr: 'Activite recente', it: 'Registri recenti' },
  'Add a record': { es: 'Agregar registro', fr: 'Ajouter un suivi', it: 'Aggiungi registro' },
  'New record': { es: 'Nuevo registro', fr: 'Nouveau suivi', it: 'Nuovo registro' },
  'Log repayment': { es: 'Registrar pago', fr: 'Enregistrer le remboursement', it: 'Registra rimborso' },
  'Suggest new total': { es: 'Sugerir nuevo total', fr: 'Proposer un nouveau total', it: 'Suggerisci un nuovo totale' },
  'Suggest a new total': { es: 'Sugerir un nuevo total', fr: 'Proposer un nouveau total', it: 'Suggerisci un nuovo totale' },
  Enabled: { es: 'Activado', fr: 'Active', it: 'Attivato' },
  Disabled: { es: 'Desactivado', fr: 'Desactive', it: 'Disattivato' },
  'Biometric On': { es: 'Biometria Activa', fr: 'Biometrie Active', it: 'Biometria Attiva' },
  'Biometric Off': { es: 'Biometria Inactiva', fr: 'Biometrie Desactivee', it: 'Biometria Disattiva' },
  'Sign Out': { es: 'Cerrar Sesion', fr: 'Se Deconnecter', it: 'Disconnetti' },
  'Standard Plan • User': { es: 'Plan Estandar • Usuario', fr: 'Plan Standard • Utilisateur', it: 'Piano Standard • Utente' },

  Error: { es: 'Error', fr: 'Erreur', it: 'Errore' },
  Success: { es: 'Exito', fr: 'Succes', it: 'Successo' },
  Info: { es: 'Info', fr: 'Info', it: 'Info' },
  Done: { es: 'Listo', fr: 'Termine', it: 'Fatto' },
  Cancel: { es: 'Cancelar', fr: 'Annuler', it: 'Annulla' },
  Confirm: { es: 'Confirmar', fr: 'Confirmer', it: 'Conferma' },
  Delete: { es: 'Eliminar', fr: 'Supprimer', it: 'Elimina' },
  Retry: { es: 'Reintentar', fr: 'Reessayer', it: 'Riprova' },
  Close: { es: 'Cerrar', fr: 'Fermer', it: 'Chiudi' },
  Approve: { es: 'Aprobar', fr: 'Approuver', it: 'Approva' },
  Reject: { es: 'Rechazar', fr: 'Refuser', it: 'Rifiuta' },
  Decline: { es: 'Declinar', fr: 'Refuser', it: 'Rifiuta' },
};

export const getDeviceLanguage = (): AppLanguage => {
  try {
    const locale =
      Intl.DateTimeFormat().resolvedOptions().locale ||
      (typeof navigator !== 'undefined' ? navigator.language : '') ||
      'en';

    return normalizeLanguage(locale, 'en');
  } catch {
    return 'en';
  }
};

export const normalizeLanguage = (value?: string | null, fallback: AppLanguage = 'en'): AppLanguage => {
  const normalized = String(value || '').trim().toLowerCase();
  const baseLanguage = normalized.split('-')[0].split('_')[0];
  return SUPPORTED_LANGUAGES.some((lang) => lang.code === baseLanguage)
    ? (baseLanguage as AppLanguage)
    : fallback;
};

export const translateText = (input: string, language: AppLanguage): string => {
  if (!input || language === 'en') return input;
  const entry = TRANSLATIONS[input];
  if (!entry) return input;
  return entry[language] || input;
};
