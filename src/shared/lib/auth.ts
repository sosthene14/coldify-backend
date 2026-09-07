// src/shared/lib/auth.ts
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { organization, twoFactor } from "better-auth/plugins"
import { db } from "../db"
import { sendEmail } from "./email"
import { renderEmailTemplate } from "./email/template"
import { ac, admin, member as memberRole, superadmin, viewer } from "./permissions"
import { redisConnection } from "./redis"

const frontendUrl =
  process.env.FRONTEND_URL ||
  process.env.BETTER_AUTH_URL?.replace(/:\d+$/, ":3000") ||
  "http://localhost:3000"

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  trustedOrigins: ["http://localhost:3000"],
  onAPIError: {
    errorURL: `${frontendUrl}/auth/error`,
  },

  user: {
    additionalFields: {
      firstName: { type: "string", required: false },
      lastName: { type: "string", required: false },
      phoneNumber: { type: "string", required: false },
      timezone: { type: "string", required: false },
      language: { type: "string", required: false },
    },
  },

  session: {
    cookieCache: {
      enabled: false,
    },
    additionalFields: {
      activeOrganizationId: { type: "string", required: false },
    },
  },

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    onExistingUserSignUp: async ({ user }, _request) => {
      await sendEmail({
        to: user.email,
        subject: "Tentative de connexion à votre compte So-mails",
        html: renderEmailTemplate({
          subject: "Tentative d'inscription détectée",
          preheader: "Quelqu'un a essayé de créer un compte avec ton adresse email.",
          title: "Tu as déjà un compte",
          bodyText:
            "Quelqu'un (peut-être toi) a essayé de s'inscrire sur So-mails avec cette adresse email, mais un compte existe déjà. Si c'était toi, connecte-toi simplement. Si ce n'était pas toi, ignore cet email.",
          ctaUrl: "http://localhost:3000/login",
          ctaLabel: "Se connecter",
          recipientEmail: user.email,
        }),
      })
    },
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Réinitialise ton mot de passe So-mails",
        html: renderEmailTemplate({
          subject: "Réinitialise ton mot de passe So-mails",
          preheader: "Clique sur le lien pour réinitialiser ton mot de passe.",
          title: "Réinitialise ton mot de passe",
          bodyText:
            "Tu as demandé la réinitialisation de ton mot de passe. Clique sur le bouton ci-dessous pour en choisir un nouveau. Ce lien expire dans 1 heure.",
          ctaUrl: url,
          ctaLabel: "Réinitialiser mon mot de passe",
          recipientEmail: user.email,
        }),
      })
    },
    resetPasswordTokenExpiresIn: 3600,
  },

  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Vérifie ton adresse email",
        html: renderEmailTemplate({
          subject: "Vérifie ton adresse email",
          preheader: "Confirme ton adresse email pour activer ton compte So-mails.",
          title: "Vérifie ton adresse email",
          bodyText:
            "Bienvenue sur So-mails ! Clique sur le bouton ci-dessous pour vérifier ton adresse email et activer ton compte.",
          ctaUrl: url,
          ctaLabel: "Vérifier mon email",
          recipientEmail: user.email,
        }),
      })
    },
    callbackURL: "/dashboard",
  },

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },

  rateLimit: {
    enabled: true,
    storage: "secondary-storage",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/request-password-reset": { window: 300, max: 3 },
      "/send-verification-email": { window: 300, max: 3 },
    },
  },

  secondaryStorage: {
    get: async (key) => await redisConnection.get(key),
    set: async (key, value, ttl) => {
      if (ttl) await redisConnection.set(key, value, "EX", ttl)
      else await redisConnection.set(key, value)
    },
    delete: async (key) => {
      await redisConnection.del(key)
    },
    increment: async (key, ttl) => {
      const script = `
        local current = redis.call("INCR", KEYS[1])
        if current == 1 and tonumber(ARGV[1]) then
          redis.call("EXPIRE", KEYS[1], ARGV[1])
        end
        return current
      `
      const result = await redisConnection.eval(script, 1, key, ttl ?? "")
      return Number(result)
    },
  },

  plugins: [
    twoFactor({
      otpOptions: {
        async sendOTP({ user, otp }) {
          await sendEmail({
            to: user.email,
            subject: "Code de vérification 2FA — So-mails",
            html: renderEmailTemplate({
              subject: "Code de vérification 2FA",
              preheader: `Ton code 2FA est : ${otp}`,
              title: "Authentification à deux facteurs",
              bodyText: `Voici ton code de vérification à 6 chiffres : <strong style="font-size: 20px; letter-spacing: 2px;">${otp}</strong>. Ce code expire dans 5 minutes.`,
              recipientEmail: user.email,
            }),
          })
        },
      },
    }),
    organization({
      ac,
      roles: { superadmin, admin, member: memberRole, viewer },
    }),
  ],

  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          try {
            const { createPersonalOrganization } = await import("./auto-organization-creation.js")
            await createPersonalOrganization(user)
          } catch (error) {
            console.error("[Auth Hooks] Failed to create personal organization:", error)
          }
        },
      },
    },
  },
})
