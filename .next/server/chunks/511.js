"use strict";exports.id=511,exports.ids=[511],exports.modules={11516:(e,t,o)=>{o.d(t,{A:()=>r});let r=(0,o(82614).A)("LoaderCircle",[["path",{d:"M21 12a9 9 0 1 1-6.219-8.56",key:"13zald"}]])},17616:(e,t,o)=>{o.d(t,{L0:()=>c,Nd:()=>s,ZX:()=>d});var r=o(91199);o(42087);var a=o(41635),l=o(33331);let i=process.env.SMTP_HOST&&process.env.SMTP_PORT&&process.env.SMTP_USER&&process.env.SMTP_PASS&&process.env.SMTP_FROM_EMAIL?a.createTransport({host:process.env.SMTP_HOST,port:parseInt(process.env.SMTP_PORT||"587",10),secure:"465"===(process.env.SMTP_PORT||"587"),auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS}}):null;function n(){return`
        <tr>
            <td style="padding: 30px 30px 20px 30px;" align="center">
                <a href="https://ratemyopenhouse.com/" target="_blank">
                    <img src="https://firebasestorage.googleapis.com/v0/b/openhouse-dashboard.firebasestorage.app/o/RMOHbug.png?alt=media" alt="RateMyOpenHouse.com" width="40" style="display: block; opacity: 0.5;" />
                </a>
            </td>
        </tr>
    `}async function s(e){if(!i)throw console.error("SMTP not configured. Cannot send email."),Error("SMTP not configured on the server.");let t=e.openHouseAddress?`Thank you for visiting ${e.openHouseAddress}`:`A gift from ${e.sender.name}`,o=function({recipientName:e,sender:t,message:o,brandCode:r,amountInCents:a,claimUrl:l,openHouseAddress:i}){let s=(a/100).toFixed(2),d=r.charAt(0).toUpperCase()+r.slice(1).replace(/([A-Z])/g," $1").trim(),c=i?`Thank you for visiting the open house at <strong>${i}</strong>! As a token of our appreciation, ${t.name} has sent you a <strong>$${s} ${d} gift card</strong>.`:`${t.name} has sent you a <strong>$${s} ${d} gift card</strong>.`,p=function(e){let t=!!e.personalLogoUrl,o=!!e.brokerageLogoUrl;return`
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse;">
      <tr>
        <td style="padding: 20px 0 0 0;">
          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse;">
            <tr>
              ${e.photoURL?`
              <td width="80" valign="top">
                <img src="${e.photoURL}" alt="${e.name}" width="80" height="80" style="display: block; border-radius: 50%;" />
              </td>`:""}
              <td style="font-size: 0; line-height: 0;" width="25">&nbsp;</td>
              <td width="100%" valign="middle" style="font-family: Arial, sans-serif; font-size: 14px; line-height: 20px;">
                <p style="margin: 0; color: #333333;"><strong>${e.name}</strong></p>
                ${e.title?`<p style="margin: 0; color: #555555;">${e.title}</p>`:""}
                ${e.brokerageName?`<p style="margin: 0; color: #555555;">${e.brokerageName}</p>`:""}
                ${e.phone?`<p style="margin: 0; color: #555555;">${e.phone}</p>`:""}
                ${e.email?`<p style="margin: 0;"><a href="mailto:${e.email}" style="color: #3b82f6; text-decoration: none;">${e.email}</a></p>`:""}
              </td>
            </tr>
          </table>
        </td>
      </tr>
      ${t||o?`
      <tr>
        <td style="padding: 20px 0 0 0;">
          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse;">
            <tr>
              ${t?`<td align="center" style="padding: 0 10px 0 0;"><img src="${e.personalLogoUrl}" alt="Personal Logo" style="display: block; max-width: 120px; max-height: 60px; height: auto;"/></td>`:""}
              ${o?`<td align="center" style="padding: 0 0 0 10px;"><img src="${e.brokerageLogoUrl}" alt="Brokerage Logo" style="display: block; max-width: 120px; max-height: 60px; height: auto;"/></td>`:""}
            </tr>
          </table>
        </td>
      </tr>`:""}
    </table>
  `}(t),g=n();return`
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
                  <p style="color: #555555; font-size: 16px; line-height: 1.5;">Hi ${e},</p>
                  <p style="color: #555555; font-size: 16px; line-height: 1.5;">${c}</p>
                  ${o?`
                  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; margin: 20px 0;">
                    <tr>
                      <td style="background-color: #f9f9f9; border-left: 4px solid #3b82f6; padding: 15px;">
                        <p style="margin: 0; font-style: italic; color: #555555;">"${o}"</p>
                      </td>
                    </tr>
                  </table>
                  `:""}
                  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; text-align: center; margin-top: 30px;">
                    <tr>
                      <td>
                        <a href="${l}" style="background-color: #3b82f6; color: #ffffff; padding: 15px 25px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">Claim My Gift</a>
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
                        ${p}
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              ${g}
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `}(e);try{let r=await i.sendMail({from:`"${e.sender.name}" <${process.env.SMTP_FROM_EMAIL}>`,replyTo:e.sender.email,to:e.recipientEmail,subject:t,html:o});return console.log("Message sent: %s",r.messageId),r}catch(e){throw console.error("Error sending gift email: ",e),Error("Failed to send the gift email.")}}async function d(e){if(!i)return void console.warn("SMTP not configured. Skipping new lead email.");try{await i.sendMail({from:`"RateMyOpenHouse Notifications" <${process.env.SMTP_FROM_EMAIL}>`,to:e.user.email,subject:`New Lead from ${e.openHouseAddress}`,html:function({user:e,lead:t,openHouseAddress:o}){let r=process.env.NEXT_PUBLIC_SITE_URL||"https://ratemyopenhouse.com",a=n();return`
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
                  <p style="color: #555555; font-size: 16px; line-height: 1.5;">Hi ${e.name},</p>
                  <p style="color: #555555; font-size: 16px; line-height: 1.5;">
                    A new lead was just captured from your open house at <strong>${o}</strong>.
                  </p>
                  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; margin: 20px 0; background-color: #f9f9f9; border: 1px solid #eeeeee; border-radius: 4px;">
                     <tr><td style="padding: 10px 15px;"><strong>Name:</strong> ${t.name}</td></tr>
                     ${t.email?`<tr><td style="padding: 10px 15px; border-top: 1px solid #eeeeee;"><strong>Email:</strong> ${t.email}</td></tr>`:""}
                     ${t.phone?`<tr><td style="padding: 10px 15px; border-top: 1px solid #eeeeee;"><strong>Phone:</strong> ${t.phone}</td></tr>`:""}
                  </table>
                  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; text-align: center; margin-top: 30px;">
                    <tr>
                      <td>
                        <a href="${r}/user/my-leads" style="background-color: #3b82f6; color: #ffffff; padding: 15px 25px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">View All Leads</a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              ${a}
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
    `}(e)})}catch(e){console.error("Error sending new lead email:",e)}}async function c(e){if(!i)return void console.warn("SMTP not configured. Skipping low balance email.");try{await i.sendMail({from:`"RateMyOpenHouse Notifications" <${process.env.SMTP_FROM_EMAIL}>`,to:e.user.email,subject:"Your RateMyOpenHouse Balance is Low",html:function({user:e,currentBalanceInCents:t}){let o=process.env.NEXT_PUBLIC_SITE_URL||"https://ratemyopenhouse.com",r=(t/100).toFixed(2),a=n();return`
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
                  <p style="color: #555555; font-size: 16px; line-height: 1.5;">Hi ${e.name},</p>
                  <p style="color: #555555; font-size: 16px; line-height: 1.5;">
                    This is an alert to let you know that your available balance is running low. Your current balance is <strong>$${r}</strong>.
                  </p>
                  <p style="color: #555555; font-size: 16px; line-height: 1.5;">
                    Please add more funds to your account to ensure your gift automations continue to run without interruption.
                  </p>
                  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; text-align: center; margin-top: 30px;">
                    <tr>
                      <td>
                        <a href="${o}/user/billing" style="background-color: #3b82f6; color: #ffffff; padding: 15px 25px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">Add Funds</a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              ${a}
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
    `}(e)})}catch(e){console.error("Error sending low balance email:",e)}}(0,l.D)([s,d,c]),(0,r.A)(s,"403732b4bcba6814236cbac0afc3cae4061289e231",null),(0,r.A)(d,"404edea5deb8add4e76902d923e4f5272f44f3c779",null),(0,r.A)(c,"40ba9832def9f155118ad6775009bef44e72d34956",null)},27073:(e,t,o)=>{o.a(e,async(e,r)=>{try{o.d(t,{q:()=>g,r:()=>c});var a=o(91199);o(42087);var l=o(31371),i=o(17616),n=o(7879),s=o(33331),d=e([l,n]);[l,n]=d.then?(await d)():d;let f=process.env.GIFTBIT_API_KEY,b="https://api-testbed.giftbit.com/papi/v1";async function c(e){if(!f)throw Error("GIFTBIT_API_KEY is not configured on the server.");try{let t=(await l.G7.collection("settings").doc("appDefaults").get()).data(),o=t?.giftbit?.enabledBrandCodes,r=await fetch(`${b}/brands?limit=500&region_code=${e}`,{headers:{Authorization:`Bearer ${f}`},next:{revalidate:3600}});if(!r.ok)throw console.error(`Giftbit Brands API Error (${r.status}):`,await r.text()),Error("Failed to fetch brands from Giftbit.");let a=(await r.json()).brands||[];if(!o||0===o.length)return{brands:a};return{brands:a.filter(e=>o.includes(e.brand_code))}}catch(e){throw console.error("Error fetching gift configuration for user:",e.message),Error("Could not load gift card information.")}}async function p(e){if(!f)throw Error("GIFTBIT_API_KEY is not configured on the server.");let t=await fetch(`${b}/direct_links`,{method:"POST",headers:{Authorization:`Bearer ${f}`,"Content-Type":"application/json"},body:JSON.stringify({id:e.id,price_in_cents:e.amountInCents,brand_codes:[e.brandCode],link_count:1})});if(!t.ok){let e=await t.text();throw console.error(`Giftbit API Error (${t.status}):`,e),Error(`Giftbit API request failed with status ${t.status}`)}return await t.json()}async function g(e){let t=l.G7.collection("gifts").doc(e);try{let e=await t.get();if(!e.exists)throw Error("Gift not found");let o={id:e.id,...e.data()},r=l.G7.collection("users").doc(o.userId),a=await r.get();if(!a.exists)throw Error("User not found");let s=a.data();if((s.availableBalance||0)<o.amountInCents)throw Error("Insufficient funds.");let d=await p(o),c=d?.direct_links?.[0];if(!c)throw console.error("No claim URL found in Giftbit response for gift:",o.id,"Response:",d),Error(`Link generation failed for gift ${o.id}. No URL in response.`);await l.G7.runTransaction(async e=>{e.update(r,{availableBalance:n.FieldValue.increment(-o.amountInCents)}),e.update(t,{status:"Sent",claimUrl:c})}),await (0,i.Nd)({...o,claimUrl:c,sender:s});let g=(s.availableBalance||0)-o.amountInCents;g<2500&&await (0,i.L0)({user:s,currentBalanceInCents:g})}catch(o){console.error(`Failed to process gift ${e}:`,o),await t.update({status:"Failed"})}}(0,s.D)([c,g]),(0,a.A)(c,"40ab49258c2a399c06a63e480547aed85cab1b3af1",null),(0,a.A)(g,"4033136359b3185ffbaa946a6b3d14526ddf058fa0",null),r()}catch(e){r(e)}})},31371:(e,t,o)=>{o.a(e,async(e,r)=>{try{o.d(t,{G7:()=>c});var a=o(9801),l=o(7879),i=o(14276),n=o(24803),s=e([a,l,i,n]);[a,l,i,n]=s.then?(await s)():s;let d=(0,a.getApps)().length?(0,a.getApp)():(0,a.initializeApp)(),c=(0,l.getFirestore)(d);(0,i.getAuth)(d),(0,n.getStorage)(d),r()}catch(e){r(e)}})},65502:(e,t,o)=>{o.a(e,async(e,r)=>{try{o.r(t),o.d(t,{"4033136359b3185ffbaa946a6b3d14526ddf058fa0":()=>a.q,"40ab49258c2a399c06a63e480547aed85cab1b3af1":()=>a.r});var a=o(27073),l=e([a]);a=(l.then?(await l)():l)[0],r()}catch(e){r(e)}})}};