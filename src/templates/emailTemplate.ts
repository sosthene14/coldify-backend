const template = () => {
    return `
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>{{subject}}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    body { margin: 0; padding: 0; width: 100% !important; height: 100% !important; background-color: #f4f4f5; }

    @media screen and (max-width: 600px) {
      .email-container { width: 100% !important; }
      .email-padding { padding-left: 24px !important; padding-right: 24px !important; }
    }
  </style>
</head>
<body style="margin:0; padding:0; background-color:#f4f4f5;">
  <!-- Preheader (texte invisible affiché dans l'aperçu de la boîte de réception) -->
  <div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">
    {{preheader}}
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;">
    <tr>
      <td align="center" style="padding: 40px 16px;">

        <table role="presentation" class="email-container" width="600" cellpadding="0" cellspacing="0" style="width:600px; max-width:600px; background-color:#ffffff; border:1px solid #e5e7eb; border-radius:8px; overflow:hidden;">

          <!-- Header / Logo -->
          <tr>
            <td class="email-padding" style="padding: 32px 40px 24px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 18px; font-weight: 600; color: #1c1c1e; letter-spacing: -0.2px;">
                      Coldy
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td>
              <div style="height:1px; background-color:#e5e7eb; margin: 0 40px;"></div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td class="email-padding" style="padding: 32px 40px 8px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">

                    <h1 style="margin: 0 0 12px 0; font-size: 20px; line-height: 28px; font-weight: 600; color: #1c1c1e;">
                      {{title}}
                    </h1>

                    <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 22px; color: #52525b;">
                      {{body_text}}
                    </p>

                    <!-- CTA Button -->
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="border-radius: 6px; background-color: #1c7ed6;">
                          <a href="{{cta_url}}" target="_blank"
                            style="display: inline-block; padding: 11px 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; font-weight: 500; color: #ffffff; text-decoration: none; border-radius: 6px;">
                            {{cta_label}}
                          </a>
                        </td>
                      </tr>
                    </table>

                    <p style="margin: 24px 0 0 0; font-size: 12px; line-height: 18px; color: #a1a1aa;">
                      Or copy and paste this link into your browser:<br />
                      <a href="{{cta_url}}" style="color: #1c7ed6; text-decoration: none; word-break: break-all;">{{cta_url}}</a>
                    </p>

                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px 32px 40px;">
              <div style="height:1px; background-color:#e5e7eb; margin: 0 0 24px 0;"></div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                    <p style="margin: 0; font-size: 12px; line-height: 18px; color: #a1a1aa;">
                      This email was sent to {{recipient_email}}. If you didn't request this, you can safely ignore it.
                    </p>
                    <p style="margin: 8px 0 0 0; font-size: 12px; line-height: 18px; color: #a1a1aa;">
                      © {{year}} Coldy. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>
</body>
</html>
`
}