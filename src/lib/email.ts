
'use server';

import nodemailer from 'nodemailer';
import { UserProfile, Lead } from './types';

// Check if SMTP is configured
const smtpConfigured =
  !!process.env.SMTP_HOST &&
  !!process.env.SMTP_PORT &&
  !!process.env.SMTP_USER &&
  !!process.env.SMTP_PASS &&
  !!process.env.SMTP_FROM_EMAIL;

const transporter = smtpConfigured
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: (process.env.SMTP_PORT || '587') === '465', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
  : null;


interface SendGiftEmailParams {
    recipientName: string;
    recipientEmail: string;
    sender: UserProfile;
    brandCode: string;
    amountInCents: number;
    message?: string;
    claimUrl: string;
    openHouseAddress?: string;
}

interface NewLeadEmailParams {
    user: UserProfile;
    lead: Lead;
    openHouseAddress: string;
}

interface LowBalanceEmailParams {
    user: UserProfile;
    currentBalanceInCents: number;
}


function generateSignatureHtml(user: UserProfile): string {
    const hasPersonalLogo = !!user.personalLogoUrl;
    const hasBrokerageLogo = !!user.brokerageLogoUrl;

    return `
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse;">
      <tr>
        <td style="padding: 20px 0 0 0;">
          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse;">
            <tr>
              ${user.photoURL ? `
              <td width="80" valign="top">
                <img src="${user.photoURL}" alt="${user.name}" width="80" height="80" style="display: block; border-radius: 50%;" />
              </td>` : ''}
              <td style="font-size: 0; line-height: 0;" width="25">&nbsp;</td>
              <td width="100%" valign="middle" style="font-family: Arial, sans-serif; font-size: 14px; line-height: 20px;">
                <p style="margin: 0; color: #333333;"><strong>${user.name}</strong></p>
                ${user.title ? `<p style="margin: 0; color: #555555;">${user.title}</p>` : ''}
                ${user.brokerageName ? `<p style="margin: 0; color: #555555;">${user.brokerageName}</p>` : ''}
                ${user.phone ? `<p style="margin: 0; color: #555555;">${user.phone}</p>` : ''}
                ${user.email ? `<p style="margin: 0;"><a href="mailto:${user.email}" style="color: #3b82f6; text-decoration: none;">${user.email}</a></p>` : ''}
              </td>
            </tr>
          </table>
        </td>
      </tr>
      ${(hasPersonalLogo || hasBrokerageLogo) ? `
      <tr>
        <td style="padding: 20px 0 0 0;">
          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse;">
            <tr>
              ${hasPersonalLogo ? `<td align="center" style="padding: 0 10px 0 0;"><img src="${user.personalLogoUrl}" alt="Personal Logo" style="display: block; max-width: 120px; max-height: 60px; height: auto;"/></td>` : ''}
              ${hasBrokerageLogo ? `<td align="center" style="padding: 0 0 0 10px;"><img src="${user.brokerageLogoUrl}" alt="Brokerage Logo" style="display: block; max-width: 120px; max-height: 60px; height: auto;"/></td>` : ''}
            </tr>
          </table>
        </td>
      </tr>` : ''}
    </table>
  `;
}

function generateGiftEmailHtml({ recipientName, sender, message, brandCode, amountInCents, claimUrl, openHouseAddress }: SendGiftEmailParams): string {
  const amountDollars = (amountInCents / 100).toFixed(2);
  const brandName = brandCode.charAt(0).toUpperCase() + brandCode.slice(1).replace(/([A-Z])/g, ' $1').trim();
  const greetingMessage = openHouseAddress 
    ? `Thank you for visiting the open house at <strong>${openHouseAddress}</strong>! As a token of our appreciation, ${sender.name} has sent you a <strong>$${amountDollars} ${brandName} gift card</strong>.`
    : `${sender.name} has sent you a <strong>$${amountDollars} ${brandName} gift card</strong>.`;

  const signatureHtml = generateSignatureHtml(sender);

  return `
    <!DOCTYPE html>
    <html>
    <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>A gift for you!</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td style="padding: 20px 0;">
            <table align="center" border="0" cellpadding="0" cellspacing="0" width="600" style="border-collapse: collapse; background-color: #ffffff; border: 1px solid #cccccc; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
              <tr>
                <td align="center" style="padding: 40px 20px; border-bottom: 1px solid #eeeeee;">
                  <h1 style="color: #333333; margin: 0;">You've Received a Gift!</h1>
                </td>
              </tr>
              <tr>
                <td style="padding: 30px;">
                  <p style="color: #555555; font-size: 16px; line-height: 1.5;">Hi ${recipientName},</p>
                  <p style="color: #555555; font-size: 16px; line-height: 1.5;">${greetingMessage}</p>
                  ${message ? `
                  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; margin: 20px 0;">
                    <tr>
                      <td style="background-color: #f9f9f9; border-left: 4px solid #3b82f6; padding: 15px;">
                        <p style="margin: 0; font-style: italic; color: #555555;">"${message}"</p>
                      </td>
                    </tr>
                  </table>
                  ` : ''}
                  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; text-align: center; margin-top: 30px;">
                    <tr>
                      <td>
                        <a href="${claimUrl}" style="background-color: #3b82f6; color: #ffffff; padding: 15px 25px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">Claim My Gift</a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding: 0 30px 30px 30px;">
                  <table border="0" cellpadding="0" cellspacing="0" width="80%" style="border-collapse: collapse;">
                    <tr>
                      <td>
                        ${signatureHtml}
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
  `;
}


function generateNewLeadEmailHtml({ user, lead, openHouseAddress }: NewLeadEmailParams): string {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://ratemyopenhouse.com';
    return `
    <!DOCTYPE html>
    <html>
    <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>New Lead Notification</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td style="padding: 20px 0;">
            <table align="center" border="0" cellpadding="0" cellspacing="0" width="600" style="border-collapse: collapse; background-color: #ffffff; border: 1px solid #cccccc; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
              <tr>
                <td align="center" style="padding: 20px; border-bottom: 1px solid #eeeeee;">
                  <img src="https://firebasestorage.googleapis.com/v0/b/openhouse-dashboard.firebasestorage.app/o/RMOH%20Logo.png?alt=media" alt="RateMyOpenHouse.com Logo" width="150" style="display: block;" />
                </td>
              </tr>
              <tr>
                <td style="padding: 30px;">
                  <h1 style="color: #333333; margin: 0 0 20px 0;">You Have a New Lead!</h1>
                  <p style="color: #555555; font-size: 16px; line-height: 1.5;">Hi ${user.name},</p>
                  <p style="color: #555555; font-size: 16px; line-height: 1.5;">
                    A new lead was just captured from your open house at <strong>${openHouseAddress}</strong>.
                  </p>
                  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; margin: 20px 0; background-color: #f9f9f9; border: 1px solid #eeeeee; border-radius: 4px;">
                     <tr><td style="padding: 10px 15px;"><strong>Name:</strong> ${lead.name}</td></tr>
                     ${lead.email ? `<tr><td style="padding: 10px 15px; border-top: 1px solid #eeeeee;"><strong>Email:</strong> ${lead.email}</td></tr>` : ''}
                     ${lead.phone ? `<tr><td style="padding: 10px 15px; border-top: 1px solid #eeeeee;"><strong>Phone:</strong> ${lead.phone}</td></tr>` : ''}
                  </table>
                  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; text-align: center; margin-top: 30px;">
                    <tr>
                      <td>
                        <a href="${siteUrl}/user/my-leads" style="background-color: #3b82f6; color: #ffffff; padding: 15px 25px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">View All Leads</a>
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
    `;
}

function generateLowBalanceEmailHtml({ user, currentBalanceInCents }: LowBalanceEmailParams): string {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://ratemyopenhouse.com';
    const balance = (currentBalanceInCents / 100).toFixed(2);
     return `
    <!DOCTYPE html>
    <html>
    <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Low Balance Alert</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td style="padding: 20px 0;">
            <table align="center" border="0" cellpadding="0" cellspacing="0" width="600" style="border-collapse: collapse; background-color: #ffffff; border: 1px solid #cccccc; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
               <tr>
                <td align="center" style="padding: 20px; border-bottom: 1px solid #eeeeee;">
                  <img src="https://firebasestorage.googleapis.com/v0/b/openhouse-dashboard.firebasestorage.app/o/RMOH%20Logo.png?alt=media" alt="RateMyOpenHouse.com Logo" width="150" style="display: block;" />
                </td>
              </tr>
              <tr>
                <td style="padding: 30px;">
                  <h1 style="color: #333333; margin: 0 0 20px 0;">Low Balance Alert</h1>
                  <p style="color: #555555; font-size: 16px; line-height: 1.5;">Hi ${user.name},</p>
                  <p style="color: #555555; font-size: 16px; line-height: 1.5;">
                    This is an alert to let you know that your available balance is running low. Your current balance is <strong>$${balance}</strong>.
                  </p>
                  <p style="color: #555555; font-size: 16px; line-height: 1.5;">
                    Please add more funds to your account to ensure your gift automations continue to run without interruption.
                  </p>
                  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; text-align: center; margin-top: 30px;">
                    <tr>
                      <td>
                        <a href="${siteUrl}/user/billing" style="background-color: #3b82f6; color: #ffffff; padding: 15px 25px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">Add Funds</a>
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
    `;
}


export async function sendGiftEmail(params: SendGiftEmailParams) {
    if (!transporter) {
        console.error("SMTP not configured. Cannot send email.");
        throw new Error("SMTP not configured on the server.");
    }
    
    const subject = params.openHouseAddress ? `Thank you for visiting ${params.openHouseAddress}` : `A gift from ${params.sender.name}`;
    const html = generateGiftEmailHtml(params);

    try {
        const info = await transporter.sendMail({
            from: `"${params.sender.name}" <${process.env.SMTP_FROM_EMAIL}>`,
            replyTo: params.sender.email,
            to: params.recipientEmail,
            subject: subject,
            html: html,
        });
        console.log("Message sent: %s", info.messageId);
        return info;
    } catch (error) {
        console.error("Error sending gift email: ", error);
        throw new Error("Failed to send the gift email.");
    }
}

export async function sendNewLeadEmail(params: NewLeadEmailParams) {
    if (!transporter) {
        console.warn("SMTP not configured. Skipping new lead email.");
        return;
    }

    try {
        await transporter.sendMail({
            from: `"RateMyOpenHouse Notifications" <${process.env.SMTP_FROM_EMAIL}>`,
            to: params.user.email,
            subject: `New Lead from ${params.openHouseAddress}`,
            html: generateNewLeadEmailHtml(params),
        });
    } catch (error) {
        console.error("Error sending new lead email:", error);
        // Don't throw, as this is a non-critical notification
    }
}


export async function sendLowBalanceEmail(params: LowBalanceEmailParams) {
    if (!transporter) {
        console.warn("SMTP not configured. Skipping low balance email.");
        return;
    }
    
    try {
        await transporter.sendMail({
            from: `"RateMyOpenHouse Notifications" <${process.env.SMTP_FROM_EMAIL}>`,
            to: params.user.email,
            subject: 'Your RateMyOpenHouse Balance is Low',
            html: generateLowBalanceEmailHtml(params),
        });
    } catch (error) {
        console.error("Error sending low balance email:", error);
    }
}
