"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Locale = "ar" | "fr" | "en";

export const localeOptions: ReadonlyArray<{ value: Locale; label: string; nativeLabel: string; dir: "rtl" | "ltr" }> = [
  { value: "ar", label: "Arabic", nativeLabel: "العربية", dir: "rtl" },
  { value: "fr", label: "French", nativeLabel: "Français", dir: "ltr" },
  { value: "en", label: "English", nativeLabel: "English", dir: "ltr" },
];

const STORAGE_KEY = "openteams.locale.v1";

const messages = {
  en: {
    account: "Account", profilePreferences: "Profile & preferences", closeProfile: "Close profile", sessionSecurity: "Session security", sessionDescription: "Your session is protected by RS256 access tokens. Use secure sign-out to clear local session state.", preferences: "Preferences", compactLayout: "Compact conversation layout", soundNotifications: "Sound notifications", savedLocally: "Saved locally", deviceLocal: "Preferences are device-local", secureSignOut: "Secure sign out", language: "Language", chooseLanguage: "Choose interface language", protectedSession: "Protected session",
    personalSpace: "Personal space", agendaNotes: "Agenda & Notes", agenda: "Agenda", notes: "Notes", refresh: "Refresh", appointmentTitle: "Appointment title", noteTitle: "Note title", optionalDetails: "Optional details", writePrivateNote: "Write your private note", savePrivate: "Save private", private: "Private", noDataYet: "No data yet", teamWorkspace: "Team workspace", workPlan: "Work plan", backlog: "Backlog", todo: "To do", inProgress: "In progress", blocked: "Blocked", done: "Done", newTask: "New task", addTask: "Add task", sharedTools: "Shared tools", noTasks: "No tasks in this team yet", invitePeople: "Invite people", noMembers: "No members yet — invite your first teammate", pendingInvites: "Pending invites", noPendingInvites: "No pending invites", addMemberInvite: "Add member or invite", emailOrUsername: "Email or username", initialRole: "Initial role", workspaceAdmin: "Workspace Admin", member: "Member", guest: "Guest", channelAssignment: "Channel assignment", noChannelsAvailable: "No channels available yet", directAdd: "Add existing account directly; otherwise generate an invitation link.", generateInvite: "Generate invite", addMember: "Add member", copyLink: "Copy link", invitationGenerated: "Invitation link generated", memberAdded: "Member added directly", selectChannel: "Select a channel", someoneTyping: "Someone is typing…", peopleTyping: "people are typing…", startVoiceCall: "Start voice call", startVideoCall: "Start video call", mediaPermissionDenied: "Microphone/camera permission was denied. Allow access in the browser, then try again.", mediaUnavailable: "Microphone and camera access are unavailable in this browser or context.", summarizeChat: "Summarize chat", translate: "Translate", pin: "Pin message", replyThread: "Reply in thread", edit: "Edit message", delete: "Delete message", customStatus: "Custom status", statusPlaceholder: "What are you working on?", saveStatus: "Save status", clearStatus: "Clear status", online: "Online", offline: "Offline", directMessages: "Direct messages", savedItems: "Saved items", noSavedItems: "No saved messages yet", closeSavedItems: "Close saved items", threadReplies: "Thread replies", noReplies: "No replies yet", dropFiles: "Drop files to upload securely",
  },
  fr: {
    account: "Compte", profilePreferences: "Profil et préférences", closeProfile: "Fermer le profil", sessionSecurity: "Sécurité de la session", sessionDescription: "Votre session est protégée par des jetons RS256. Utilisez la déconnexion sécurisée pour effacer la session locale.", preferences: "Préférences", compactLayout: "Affichage compact des conversations", soundNotifications: "Notifications sonores", savedLocally: "Enregistré localement", deviceLocal: "Préférences locales à cet appareil", secureSignOut: "Déconnexion sécurisée", language: "Langue", chooseLanguage: "Choisir la langue de l’interface", protectedSession: "Session protégée",
    personalSpace: "Espace personnel", agendaNotes: "Agenda et notes", agenda: "Agenda", notes: "Notes", refresh: "Actualiser", appointmentTitle: "Titre du rendez-vous", noteTitle: "Titre de la note", optionalDetails: "Détails facultatifs", writePrivateNote: "Écrivez votre note privée", savePrivate: "Enregistrer en privé", private: "Privé", noDataYet: "Aucune donnée", teamWorkspace: "Espace d’équipe", workPlan: "Plan de travail", backlog: "Arriéré", todo: "À faire", inProgress: "En cours", blocked: "Bloqué", done: "Terminé", newTask: "Nouvelle tâche", addTask: "Ajouter une tâche", sharedTools: "Outils partagés", noTasks: "Aucune tâche dans cette équipe", invitePeople: "Inviter des personnes", noMembers: "Aucun membre — invitez votre premier collègue", pendingInvites: "Invitations en attente", noPendingInvites: "Aucune invitation en attente", addMemberInvite: "Ajouter un membre ou inviter", emailOrUsername: "E-mail ou nom d’utilisateur", initialRole: "Rôle initial", workspaceAdmin: "Administrateur d’espace", member: "Membre", guest: "Invité", channelAssignment: "Attribution des canaux", noChannelsAvailable: "Aucun canal disponible", directAdd: "Ajouter directement un compte existant, sinon générer un lien d’invitation.", generateInvite: "Générer une invitation", addMember: "Ajouter le membre", copyLink: "Copier le lien", invitationGenerated: "Lien d’invitation généré", memberAdded: "Membre ajouté directement", selectChannel: "Sélectionnez un canal", someoneTyping: "Quelqu’un écrit…", peopleTyping: "personnes écrivent…", startVoiceCall: "Démarrer un appel vocal", startVideoCall: "Démarrer un appel vidéo", mediaPermissionDenied: "L’accès au micro ou à la caméra a été refusé. Autorisez-le dans le navigateur puis réessayez.", mediaUnavailable: "Le micro et la caméra sont indisponibles dans ce navigateur ou ce contexte.", summarizeChat: "Résumer la conversation", translate: "Traduire", pin: "Épingler", replyThread: "Répondre dans le fil", edit: "Modifier", delete: "Supprimer", customStatus: "Statut personnalisé", statusPlaceholder: "Sur quoi travaillez-vous ?", saveStatus: "Enregistrer le statut", clearStatus: "Effacer le statut", online: "En ligne", offline: "Hors ligne", directMessages: "Messages directs", savedItems: "Éléments enregistrés", noSavedItems: "Aucun message enregistré", closeSavedItems: "Fermer les éléments enregistrés", threadReplies: "Réponses du fil", noReplies: "Aucune réponse", dropFiles: "Déposez les fichiers pour les téléverser en sécurité",
  },
  ar: {
    account: "الحساب", profilePreferences: "الملف الشخصي والإعدادات", closeProfile: "إغلاق الملف الشخصي", sessionSecurity: "أمان الجلسة", sessionDescription: "جلستك محمية برموز RS256. استعمل تسجيل الخروج الآمن لمسح بيانات الجلسة المحلية.", preferences: "التفضيلات", compactLayout: "تصميم محادثة مضغوط", soundNotifications: "الإشعارات الصوتية", savedLocally: "تم الحفظ محلياً", deviceLocal: "التفضيلات محفوظة على هذا الجهاز", secureSignOut: "تسجيل خروج آمن", language: "اللغة", chooseLanguage: "اختر لغة الواجهة", protectedSession: "جلسة محمية",
    personalSpace: "المساحة الشخصية", agendaNotes: "الأجندة والملاحظات", agenda: "الأجندة", notes: "الملاحظات", refresh: "تحديث", appointmentTitle: "عنوان الموعد", noteTitle: "عنوان الملاحظة", optionalDetails: "تفاصيل اختيارية", writePrivateNote: "اكتب ملاحظتك الخاصة", savePrivate: "حفظ خاص", private: "خاص", noDataYet: "لا توجد بيانات بعد", teamWorkspace: "مساحة الفريق", workPlan: "خطة العمل", backlog: "المهام المؤجلة", todo: "للقيام به", inProgress: "قيد التنفيذ", blocked: "محظور", done: "مكتمل", newTask: "مهمة جديدة", addTask: "إضافة مهمة", sharedTools: "الأدوات المشتركة", noTasks: "لا توجد مهام في هذا الفريق بعد", invitePeople: "دعوة أشخاص", noMembers: "لا يوجد أعضاء بعد — ادعُ أول زميل", pendingInvites: "الدعوات المعلقة", noPendingInvites: "لا توجد دعوات معلقة", addMemberInvite: "إضافة عضو أو إرسال دعوة", emailOrUsername: "البريد الإلكتروني أو اسم المستخدم", initialRole: "الدور الأولي", workspaceAdmin: "مسؤول مساحة العمل", member: "عضو", guest: "ضيف", channelAssignment: "تعيين القنوات", noChannelsAvailable: "لا توجد قنوات متاحة بعد", directAdd: "أضف حساباً موجوداً مباشرة، أو أنشئ رابط دعوة.", generateInvite: "إنشاء الدعوة", addMember: "إضافة العضو", copyLink: "نسخ الرابط", invitationGenerated: "تم إنشاء رابط الدعوة", memberAdded: "تمت إضافة العضو مباشرة", selectChannel: "اختر قناة", someoneTyping: "شخص يكتب الآن…", peopleTyping: "أشخاص يكتبون الآن…", startVoiceCall: "بدء مكالمة صوتية", startVideoCall: "بدء مكالمة فيديو", mediaPermissionDenied: "تم رفض إذن الميكروفون أو الكاميرا. اسمح بالوصول من المتصفح ثم أعد المحاولة.", mediaUnavailable: "الميكروفون والكاميرا غير متاحين في هذا المتصفح أو السياق.", summarizeChat: "تلخيص المحادثة", translate: "ترجمة", pin: "تثبيت الرسالة", replyThread: "الرد في سلسلة", edit: "تعديل الرسالة", delete: "حذف الرسالة", customStatus: "حالة مخصصة", statusPlaceholder: "ماذا تعمل الآن؟", saveStatus: "حفظ الحالة", clearStatus: "مسح الحالة", online: "متصل", offline: "غير متصل", directMessages: "الرسائل المباشرة", savedItems: "العناصر المحفوظة", noSavedItems: "لا توجد رسائل محفوظة بعد", closeSavedItems: "إغلاق العناصر المحفوظة", threadReplies: "ردود السلسلة", noReplies: "لا توجد ردود بعد", dropFiles: "أفلت الملفات لرفعها بأمان",
  },
} as const;

type MessageKey = keyof typeof messages.en;
type LanguageContextValue = { locale: Locale; direction: "rtl" | "ltr"; setLocale: (locale: Locale) => void; t: (key: MessageKey) => string };
const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");
  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY) ?? document.cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith("openteams.locale="))?.split("=")[1];
    if (saved === "ar" || saved === "fr" || saved === "en") setLocaleState(saved);
  }, []);
  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    document.cookie = `openteams.locale=${next}; Max-Age=31536000; Path=/; SameSite=Lax`;
  }, []);
  const value = useMemo<LanguageContextValue>(() => {
    const option = localeOptions.find((item) => item.value === locale) ?? { value: "en" as const, label: "English", nativeLabel: "English", dir: "ltr" as const };
    return { locale, direction: option.dir, setLocale, t: (key) => messages[locale][key] ?? messages.en[key] };
  }, [locale, setLocale]);
  useEffect(() => { document.documentElement.lang = locale; document.documentElement.dir = value.direction; }, [locale, value.direction]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used inside LanguageProvider");
  return context;
}

export const useTranslation = useLanguage;
