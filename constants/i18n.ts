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
  Help: { es: 'Ayuda', fr: 'Aide', it: 'Aiuto' },
  'Contact Support': { es: 'Contactar Soporte', fr: 'Contacter le Support', it: 'Contatta Supporto' },
  'Delete Account': { es: 'Eliminar Cuenta', fr: 'Supprimer le Compte', it: 'Elimina Account' },
  Premium: { es: 'Premium', fr: 'Premium', it: 'Premium' },
  'Admin Requests': { es: 'Solicitudes Admin', fr: 'Demandes Admin', it: 'Richieste Admin' },
  Trial: { es: 'Prueba', fr: 'Essai', it: 'Prova' },
  User: { es: 'Usuario', fr: 'Utilisateur', it: 'Utente' },
  Admin: { es: 'Admin', fr: 'Admin', it: 'Admin' },
  'Manage Premium': { es: 'Gestionar Premium', fr: 'Gerer Premium', it: 'Gestisci Premium' },
  'Manage Trial': { es: 'Gestionar Prueba', fr: "Gerer l'essai", it: 'Gestisci Prova' },
  'Start Premium': { es: 'Activar Premium', fr: 'Activer Premium', it: 'Attiva Premium' },
  'Annual membership active': { es: 'Membresia anual activa', fr: 'Abonnement annuel actif', it: 'Abbonamento annuale attivo' },
  '21-day free trial active': { es: 'Prueba gratis de 21 dias activa', fr: 'Essai gratuit de 21 jours actif', it: 'Prova gratuita di 21 giorni attiva' },
  'Your 21-day free trial has ended': { es: 'Tu prueba gratis de 21 dias termino', fr: 'Votre essai gratuit de 21 jours est termine', it: 'La tua prova gratuita di 21 giorni e terminata' },
  'Included during trial': { es: 'Incluido durante la prueba', fr: "Inclus pendant l'essai", it: 'Incluso durante la prova' },
  'Manage users and platform data': { es: 'Gestiona usuarios y datos de la plataforma', fr: 'Gerez les utilisateurs et les donnees de la plateforme', it: 'Gestisci utenti e dati della piattaforma' },
  'See Premium options': { es: 'Ver opciones Premium', fr: 'Voir les options Premium', it: 'Vedi opzioni Premium' },
  'Delete account': { es: 'Eliminar cuenta', fr: 'Supprimer le compte', it: "Elimina l'account" },
  'Account Center': { es: 'Centro de Cuenta', fr: 'Centre du Compte', it: 'Centro Account' },
  'Manage the same Buddy Balance account you use in the app.': { es: 'Gestiona la misma cuenta de Buddy Balance que usas en la app.', fr: "Gerez le meme compte Buddy Balance que vous utilisez dans l'app.", it: "Gestisci lo stesso account Buddy Balance che usi nell'app." },
  'This web area gives you a cleaner desktop surface for profile management, membership status, security controls, notifications, exports, and support.': { es: 'Esta area web te da una vista de escritorio mas clara para gestionar perfil, membresia, seguridad, notificaciones, exportaciones y soporte.', fr: 'Cette zone web offre une vue bureau plus claire pour gerer le profil, le statut du plan, la securite, les notifications, les exports et le support.', it: 'Questa area web offre una vista desktop piu chiara per gestire profilo, piano, sicurezza, notifiche, esportazioni e supporto.' },
  'Buddy Balance account': { es: 'Cuenta de Buddy Balance', fr: 'Compte Buddy Balance', it: 'Account Buddy Balance' },
  plan: { es: 'plan', fr: 'forfait', it: 'piano' },
  'Admin access': { es: 'Acceso admin', fr: 'Acces admin', it: 'Accesso admin' },
  'Use Profile to edit identity details, Membership to review Premium access, Notifications to tune alerts, and Security to control biometrics and password changes.': { es: 'Usa Perfil para editar tus datos, Membresia para revisar Premium, Notificaciones para ajustar alertas y Seguridad para controlar biometria y cambios de contrasena.', fr: "Utilisez Profil pour modifier vos informations, Abonnement pour verifier Premium, Notifications pour regler les alertes et Securite pour la biometrie et le mot de passe.", it: 'Usa Profilo per modificare i dati, Abbonamento per verificare Premium, Notifiche per regolare gli avvisi e Sicurezza per biometria e password.' },
  'Account management': { es: 'Gestion de cuenta', fr: 'Gestion du compte', it: "Gestione dell'account" },
  'Dashboard overview': { es: 'Resumen del panel', fr: 'Vue du tableau de bord', it: 'Panoramica dashboard' },
  'Edit profile': { es: 'Editar perfil', fr: 'Modifier le profil', it: 'Modifica profilo' },
  'View membership': { es: 'Ver membresia', fr: "Voir l'abonnement", it: 'Vedi abbonamento' },
  'Notification settings': { es: 'Configuracion de notificaciones', fr: 'Parametres des notifications', it: 'Impostazioni notifiche' },
  'Security settings': { es: 'Configuracion de seguridad', fr: 'Parametres de securite', it: 'Impostazioni sicurezza' },
  'Support and policies': { es: 'Soporte y politicas', fr: 'Support et politiques', it: 'Supporto e politiche' },
  'Current status': { es: 'Estado actual', fr: 'Etat actuel', it: 'Stato attuale' },
  'Push alerts': { es: 'Alertas push', fr: 'Alertes push', it: 'Avvisi push' },
  'Biometric lock': { es: 'Bloqueo biometrico', fr: 'Verrou biometrique', it: 'Blocco biometrico' },
  'Marketing updates': { es: 'Actualizaciones de marketing', fr: 'Mises a jour marketing', it: 'Aggiornamenti marketing' },
  'Quick actions': { es: 'Acciones rapidas', fr: 'Actions rapides', it: 'Azioni rapide' },
  'Export CSV (trial)': { es: 'Exportar CSV (prueba)', fr: 'Exporter CSV (essai)', it: 'Esporta CSV (prova)' },
  'Export CSV': { es: 'Exportar CSV', fr: 'Exporter CSV', it: 'Esporta CSV' },
  'Membership required': { es: 'Se requiere membresia', fr: 'Abonnement requis', it: 'Abbonamento richiesto' },
  'CSV export is available during the 21-day free trial or with Premium.': { es: 'La exportacion CSV esta disponible durante la prueba gratis de 21 dias o con Premium.', fr: "L'export CSV est disponible pendant l'essai gratuit de 21 jours ou avec Premium.", it: "L'esportazione CSV e disponibile durante la prova gratuita di 21 giorni o con Premium." },
  'Could not sign out right now.': { es: 'No se pudo cerrar sesion ahora mismo.', fr: 'Impossible de se deconnecter pour le moment.', it: 'Impossibile disconnettersi ora.' },
  Appearance: { es: 'Apariencia', fr: 'Apparence', it: 'Aspetto' },
  'Choose whether Buddy Balance stays light, dark, or follows the system on this device for this account.': { es: 'Elige si Buddy Balance se mantiene claro, oscuro o sigue el sistema en este dispositivo para esta cuenta.', fr: "Choisissez si Buddy Balance reste clair, sombre ou suit le systeme sur cet appareil pour ce compte.", it: 'Scegli se Buddy Balance resta chiaro, scuro o segue il sistema su questo dispositivo per questo account.' },
  System: { es: 'Sistema', fr: 'Systeme', it: 'Sistema' },
  Light: { es: 'Claro', fr: 'Clair', it: 'Chiaro' },
  Dark: { es: 'Oscuro', fr: 'Sombre', it: 'Scuro' },
  'Color Palette': { es: 'Paleta de color', fr: 'Palette de couleurs', it: 'Palette colori' },
  'Choose the accent palette. Dark mode keeps the same neutral gray base and only changes accent color.': { es: 'Elige la paleta de acento. El modo oscuro mantiene la misma base gris neutra y solo cambia el color de acento.', fr: "Choisissez la palette d'accent. Le mode sombre conserve la meme base grise neutre et change seulement la couleur d'accent.", it: "Scegli la palette di accento. La modalita scura mantiene la stessa base grigia neutra e cambia solo il colore d'accento." },
  'Update available': { es: 'Actualizacion disponible', fr: 'Mise a jour disponible', it: 'Aggiornamento disponibile' },
  'A newer version of Buddy Balance is available in Google Play. Update now to keep using the latest fixes and features.': { es: 'Hay una version mas reciente de Buddy Balance disponible en Google Play. Actualiza ahora para seguir usando las ultimas correcciones y funciones.', fr: 'Une version plus recente de Buddy Balance est disponible sur Google Play. Mettez a jour maintenant pour garder les dernieres corrections et fonctionnalites.', it: 'E disponibile una versione piu recente di Buddy Balance su Google Play. Aggiorna ora per continuare a usare le ultime correzioni e funzioni.' },
  Later: { es: 'Mas tarde', fr: 'Plus tard', it: 'Piu tardi' },
  Update: { es: 'Actualizar', fr: 'Mettre a jour', it: 'Aggiorna' },
  'Biometric verification failed.': { es: 'La verificacion biometrica fallo.', fr: 'La verification biometrique a echoue.', it: 'La verifica biometrica non e riuscita.' },
  'Verification was canceled.': { es: 'La verificacion fue cancelada.', fr: 'La verification a ete annulee.', it: 'La verifica e stata annullata.' },
  'No biometrics is enrolled on this device.': { es: 'No hay biometria registrada en este dispositivo.', fr: "Aucune biometrie n'est enregistree sur cet appareil.", it: 'Nessuna biometria registrata su questo dispositivo.' },
  'Biometrics are temporarily locked. Use your device passcode and try again.': { es: 'La biometria esta bloqueada temporalmente. Usa el codigo del dispositivo e intenta de nuevo.', fr: 'La biometrie est temporairement verrouillee. Utilisez le code de votre appareil et reessayez.', it: 'La biometria e temporaneamente bloccata. Usa il codice del dispositivo e riprova.' },
  'Biometric authentication is not available on this device.': { es: 'La autenticacion biometrica no esta disponible en este dispositivo.', fr: "L'authentification biometrique n'est pas disponible sur cet appareil.", it: "L'autenticazione biometrica non e disponibile su questo dispositivo." },
  'Set a device passcode before using biometric lock.': { es: 'Configura un codigo del dispositivo antes de usar el bloqueo biometrico.', fr: "Definissez un code appareil avant d'utiliser le verrou biometrique.", it: 'Configura un codice del dispositivo prima di usare il blocco biometrico.' },
  'Biometric verification failed. Please try again.': { es: 'La verificacion biometrica fallo. Intenta de nuevo.', fr: 'La verification biometrique a echoue. Reessayez.', it: 'La verifica biometrica non e riuscita. Riprova.' },
  'Could not verify your identity right now.': { es: 'No se pudo verificar tu identidad ahora mismo.', fr: 'Impossible de verifier votre identite pour le moment.', it: 'Impossibile verificare la tua identita in questo momento.' },
  'Checking security': { es: 'Revisando seguridad', fr: 'Verification de securite', it: 'Controllo sicurezza' },
  'Unlock Buddy Balance': { es: 'Desbloquear Buddy Balance', fr: 'Debloquer Buddy Balance', it: 'Sblocca Buddy Balance' },
  'Loading your security settings...': { es: 'Cargando tu configuracion de seguridad...', fr: 'Chargement de vos parametres de securite...', it: 'Caricamento impostazioni di sicurezza...' },
  'Checking...': { es: 'Revisando...', fr: 'Verification...', it: 'Controllo...' },
  'Sign out': { es: 'Cerrar sesion', fr: 'Se deconnecter', it: 'Disconnetti' },
  'Premium unlocked for this account': { es: 'Premium desbloqueado para esta cuenta', fr: 'Premium debloque pour ce compte', it: 'Premium sbloccato per questo account' },
  'Referral reward': { es: 'Recompensa por referido', fr: 'Recompense de parrainage', it: 'Ricompensa referral' },
  'Premium granted': { es: 'Premium otorgado', fr: 'Premium accorde', it: 'Premium attivato' },
  'Open My Premium': { es: 'Abrir mi Premium', fr: 'Ouvrir mon Premium', it: 'Apri il mio Premium' },
  'Purchase confirmed. Premium is live.': { es: 'Compra confirmada. Premium ya esta activo.', fr: 'Achat confirme. Premium est actif.', it: 'Acquisto confermato. Premium e attivo.' },
  'Purchase complete': { es: 'Compra completada', fr: 'Achat termine', it: 'Acquisto completato' },
  'Premium active': { es: 'Premium activo', fr: 'Premium actif', it: 'Premium attivo' },
  'Enter Premium': { es: 'Entrar a Premium', fr: 'Entrer dans Premium', it: 'Entra in Premium' },
  'Premium was granted to your account': { es: 'Premium fue otorgado a tu cuenta', fr: 'Premium a ete accorde a votre compte', it: 'Premium e stato assegnato al tuo account' },
  'Admin granted': { es: 'Otorgado por admin', fr: 'Accorde par admin', it: 'Assegnato da admin' },
  'Use Premium': { es: 'Usar Premium', fr: 'Utiliser Premium', it: 'Usa Premium' },
  uses: { es: 'usos', fr: 'usages', it: 'usi' },
  month: { es: 'mes', fr: 'mois', it: 'mese' },
  status: { es: 'estado', fr: 'statut', it: 'stato' },
  source: { es: 'origen', fr: 'source', it: 'origine' },
  'Premium is active on your account now.': { es: 'Premium esta activo en tu cuenta ahora.', fr: 'Premium est actif sur votre compte maintenant.', it: 'Premium e attivo sul tuo account ora.' },
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
