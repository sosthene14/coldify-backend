-- Migration pour ajouter les champs timezone et language à la table user

ALTER TABLE "user" 
ADD COLUMN "timezone" text,
ADD COLUMN "language" text DEFAULT 'English';