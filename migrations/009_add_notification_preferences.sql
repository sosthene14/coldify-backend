-- Migration pour ajouter les préférences de notification à la table user

ALTER TABLE "user" 
ADD COLUMN "notification_preferences" text;

-- Initialiser les préférences par défaut pour les utilisateurs existants
UPDATE "user" 
SET "notification_preferences" = '{"emailOpened": false}' 
WHERE "notification_preferences" IS NULL;