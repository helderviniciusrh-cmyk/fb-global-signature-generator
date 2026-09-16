export const signatureConfig = Object.freeze({
  originalWidth: 1629,
  originalHeight: 543,

  assets: {
    previewGifUrl: "./email-signature/fb-global-signature-base.gif",
    publicGifUrl: "https://fbgloballogistics.com/assets/email/fb-global-signature-base.gif"
  },

  colors: {
    navy: "#003064",
    cyan: "#00AEEF",
    white: "#FFFFFF"
  },

  fontFamily: "Montserrat, Avenir, Arial, Helvetica, sans-serif",

  fields: {
    name: { x: 508, y: 72, maxWidth: 476, fontSize: 40, minFontSize: 25, fontWeight: 700 },
    role: { x: 520, y: 127, maxWidth: 142, fontSize: 28, minFontSize: 18, fontWeight: 400 },
    phone: { x: 578, y: 187, maxWidth: 410, fontSize: 23, minFontSize: 18, fontWeight: 500 },
    email: { x: 578, y: 237, maxWidth: 410, fontSize: 22, minFontSize: 17, fontWeight: 500 },
    location: { x: 578, y: 337, maxWidth: 410, fontSize: 22, minFontSize: 17, fontWeight: 500 }
  },

  defaults: {
    name: "Bruno Sampaio",
    role: "Comercial",
    phone: "+55 (41) 99999-9999",
    email: "comercial@fbgloballogistics.com",
    city: "Curitiba",
    state: "PR",
    country: "Brasil"
  }
});
