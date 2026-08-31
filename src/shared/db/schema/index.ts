// Schémas partagés (authentification, limites, etc.)
export * from "./auth";
export * from "./limits";
export * from "./organization-quota";

// Schémas des modules
export * from "../../../modules/campaign/campaign.schema";
export * from "../../../modules/folder/folder.schema";
export * from "../../../modules/calendar-event/calendar-event.schema";
export * from "../../../modules/conversation/conversation.schema";
export * from "../../../modules/lead/lead.schema";
export * from "../../../modules/notifications/notifications.schema";
export * from "../../../modules/organization-custom-field/organization-custom-field.schema";
export * from "../../../modules/reporting/reporting.schema";
export * from "../../../modules/template/template.schema";
export * from "../../../modules/mailbox/mailbox.schema";
export * from "../../../modules/email-history/email-history.schema";
export * from "../../../modules/scheduled-email/scheduled-email.schema";
export * from "../../../modules/subscriptions/subscription.schema";