import { signatureConfig as config } from "./signature-config.js";

const form = document.querySelector("#signature-form");
const shell = document.querySelector("#preview-shell");
const stage = document.querySelector("#signature-stage");
const baseImage = document.querySelector("#signature-base");
const status = document.querySelector("#action-status");
const emailError = document.querySelector("#email-error");

const inputs = Object.fromEntries(
  ["name", "role", "phone", "email", "city", "state", "country"].map((id) => [id, document.querySelector(`#${id}`)])
);

const outputs = Object.fromEntries(
  ["name", "role", "phone", "email", "location"].map((id) => [id, document.querySelector(`#preview-${id}`)])
);

baseImage.src = config.assets.previewGifUrl;

function setDefaults() {
  Object.entries(config.defaults).forEach(([key, value]) => {
    inputs[key].value = value;
  });
  updatePreview();
}

function locationText() {
  const city = inputs.city.value.trim();
  const state = inputs.state.value.trim().toUpperCase();
  const country = inputs.country.value.trim();
  return [city, state].filter(Boolean).join(" – ") + (country ? `${city || state ? " | " : ""}${country}` : "");
}

function setFieldGeometry(key) {
  const field = config.fields[key];
  const element = outputs[key];
  element.style.left = `${field.x}px`;
  element.style.top = `${field.y}px`;
  element.style.maxWidth = `${field.maxWidth}px`;
  element.style.fontSize = `${field.fontSize}px`;
  element.style.fontWeight = String(field.fontWeight);
}

function fitText(key) {
  const field = config.fields[key];
  const element = outputs[key];
  let size = field.fontSize;
  element.style.fontSize = `${size}px`;
  while (element.scrollWidth > field.maxWidth && size > field.minFontSize) {
    size -= 1;
    element.style.fontSize = `${size}px`;
  }
}

function validateEmail() {
  const value = inputs.email.value.trim();
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  inputs.email.setAttribute("aria-invalid", String(!valid));
  emailError.textContent = valid || !value ? "" : "Informe um e-mail válido.";
  return valid;
}

function updatePreview() {
  outputs.name.textContent = inputs.name.value.trim();
  outputs.role.textContent = inputs.role.value.trim();
  outputs.phone.textContent = inputs.phone.value.trim();
  outputs.phone.href = `tel:${inputs.phone.value.replace(/[^+\d]/g, "")}`;
  outputs.email.textContent = inputs.email.value.trim();
  outputs.email.href = `mailto:${inputs.email.value.trim()}`;
  outputs.location.textContent = locationText();

  Object.keys(outputs).forEach(setFieldGeometry);
  requestAnimationFrame(() => Object.keys(outputs).forEach(fitText));
  validateEmail();
  status.textContent = "";
}

function scalePreview() {
  const scale = shell.clientWidth / config.originalWidth;
  shell.style.height = `${config.originalHeight * scale}px`;
  stage.style.transform = `scale(${scale})`;
}

function escapeHtml(value) {
  return value.replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[character]));
}

function slugify(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "colaborador";
}

function getData() {
  return {
    name: inputs.name.value.trim(),
    role: inputs.role.value.trim(),
    phone: inputs.phone.value.trim(),
    phoneHref: inputs.phone.value.replace(/[^+\d]/g, ""),
    email: inputs.email.value.trim(),
    location: locationText()
  };
}

function overlayStyle(key, scale) {
  const field = config.fields[key];
  const fittedFontSize = Number.parseFloat(getComputedStyle(outputs[key]).fontSize) || field.fontSize;
  return [
    "position:absolute",
    `left:${(field.x * scale).toFixed(2)}px`,
    `top:${(field.y * scale).toFixed(2)}px`,
    `max-width:${(field.maxWidth * scale).toFixed(2)}px`,
    "display:block",
    "overflow:hidden",
    "white-space:nowrap",
    `font-family:${config.fontFamily}`,
    `font-size:${(fittedFontSize * scale).toFixed(2)}px`,
    `line-height:${(fittedFontSize * 1.08 * scale).toFixed(2)}px`,
    `font-weight:${field.fontWeight}`,
    `color:${config.colors.navy}`,
    "text-decoration:none"
  ].join(";");
}

function generateEmailHtml(imageSource = config.assets.publicGifUrl) {
  const data = getData();
  const finalWidth = 815;
  const scale = finalWidth / config.originalWidth;
  const finalHeight = Math.round(config.originalHeight * scale);
  const imageUrl = escapeHtml(imageSource);
  const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>Assinatura — ${escapeHtml(data.name)}</title></head>
<body style="margin:0;padding:0;background:#FFFFFF;">
<!--[if !mso]><!-->
<div style="position:relative;width:${finalWidth}px;height:${finalHeight}px;overflow:hidden;background:#FFFFFF;">
  <img src="${imageUrl}" width="${finalWidth}" height="${finalHeight}" alt="FB Global Logistics" style="display:block;width:${finalWidth}px;height:${finalHeight}px;border:0;outline:none;">
  <span style="${overlayStyle("name", scale)}">${escapeHtml(data.name)}</span>
  <span style="${overlayStyle("role", scale)}">${escapeHtml(data.role)}</span>
  <a href="tel:${escapeHtml(data.phoneHref)}" style="${overlayStyle("phone", scale)}">${escapeHtml(data.phone)}</a>
  <a href="mailto:${escapeHtml(data.email)}" style="${overlayStyle("email", scale)}">${escapeHtml(data.email)}</a>
  <span style="${overlayStyle("location", scale)}">${escapeHtml(data.location)}</span>
</div>
<!--<![endif]-->
<!--[if mso]>
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="815" style="width:815px;border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;color:#003064;">
  <tr><td><img src="${imageUrl}" width="815" height="272" alt="FB Global Logistics" style="display:block;border:0;"></td></tr>
  <tr><td style="padding:10px 0 0;font-size:15px;line-height:22px;"><strong>${escapeHtml(data.name)}</strong> · ${escapeHtml(data.role)}<br><a href="tel:${escapeHtml(data.phoneHref)}" style="color:#003064;text-decoration:none;">${escapeHtml(data.phone)}</a> · <a href="mailto:${escapeHtml(data.email)}" style="color:#003064;text-decoration:none;">${escapeHtml(data.email)}</a> · ${escapeHtml(data.location)}</td></tr>
</table>
<![endif]-->
</body></html>`;
  return html;
}

function validateForExport() {
  const required = [inputs.name, inputs.role, inputs.phone, inputs.email, inputs.city, inputs.state, inputs.country];
  const complete = required.every((input) => input.value.trim());
  if (!complete) {
    status.textContent = "Preencha todos os campos antes de gerar a assinatura.";
    form.reportValidity();
    return false;
  }
  if (!validateEmail()) {
    status.textContent = "Corrija o e-mail antes de gerar a assinatura.";
    inputs.email.focus();
    return false;
  }
  return true;
}

async function copySignature() {
  if (!validateForExport()) return;
  const html = generateEmailHtml();
  const data = getData();
  const plain = `${data.name}\n${data.role} | FB Global Logistics\n${data.phone}\n${data.email}\nfbgloballogistics.com\n${data.location}`;
  try {
    if (navigator.clipboard && window.ClipboardItem) {
      await navigator.clipboard.write([new ClipboardItem({ "text/html": new Blob([html], { type: "text/html" }), "text/plain": new Blob([plain], { type: "text/plain" }) })]);
    } else {
      const holder = document.createElement("div");
      holder.innerHTML = html;
      holder.style.position = "fixed";
      holder.style.left = "-10000px";
      document.body.appendChild(holder);
      const range = document.createRange();
      range.selectNodeContents(holder);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      document.execCommand("copy");
      selection.removeAllRanges();
      holder.remove();
    }
    status.textContent = "Assinatura copiada. Cole no editor de assinaturas do seu e-mail.";
  } catch {
    status.textContent = "O navegador bloqueou a cópia. Use Baixar HTML ou abra o gerador por HTTPS.";
  }
}

let embeddedGifPromise;

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function getEmbeddedGifDataUrl() {
  if (!embeddedGifPromise) {
    embeddedGifPromise = fetch(config.assets.previewGifUrl)
      .then((response) => {
        if (!response.ok) throw new Error(`Não foi possível carregar o GIF (${response.status}).`);
        return response.arrayBuffer();
      })
      .then((buffer) => `data:image/gif;base64,${arrayBufferToBase64(buffer)}`)
      .catch((error) => {
        embeddedGifPromise = undefined;
        throw error;
      });
  }
  return embeddedGifPromise;
}

async function downloadSignature() {
  if (!validateForExport()) return;
  status.textContent = "Preparando o HTML completo com o GIF animado…";
  try {
    const embeddedGif = await getEmbeddedGifDataUrl();
    const html = generateEmailHtml(embeddedGif);
    const filename = `assinatura-${slugify(inputs.name.value)}.html`;
    const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    status.textContent = `Arquivo ${filename} gerado com o GIF incorporado.`;
  } catch {
    status.textContent = "Não foi possível incorporar o GIF. Recarregue a página e tente novamente.";
  }
}

Object.values(inputs).forEach((input) => input.addEventListener("input", updatePreview));
document.querySelector("#copy-button").addEventListener("click", copySignature);
document.querySelector("#download-button").addEventListener("click", downloadSignature);
document.querySelector("#reset-button").addEventListener("click", setDefaults);

new ResizeObserver(scalePreview).observe(shell);
window.addEventListener("load", scalePreview);
setDefaults();

function registerWebMcpTools() {
  const context = document.modelContext;
  if (!context?.registerTool) return;
  const lifecycle = new AbortController();

  Promise.resolve(context.registerTool({
    name: "configure_signature_fields",
    title: "Preencher assinatura",
    description: "Atualiza os campos editáveis da assinatura e a prévia visível.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", minLength: 1, maxLength: 48 },
        role: { type: "string", minLength: 1, maxLength: 28 },
        phone: { type: "string", minLength: 6, maxLength: 28 },
        email: { type: "string", minLength: 5, maxLength: 52 },
        city: { type: "string", minLength: 1, maxLength: 28 },
        state: { type: "string", minLength: 2, maxLength: 3 },
        country: { type: "string", minLength: 1, maxLength: 20 }
      },
      required: ["name", "role", "phone", "email", "city", "state", "country"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute(data) {
      const keys = ["name", "role", "phone", "email", "city", "state", "country"];
      if (!data || keys.some((key) => typeof data[key] !== "string" || !data[key].trim())) throw new Error("Todos os campos são obrigatórios.");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) throw new Error("E-mail inválido.");
      keys.forEach((key) => { inputs[key].value = data[key].trim(); });
      updatePreview();
      return { status: "updated", fields: getData() };
    }
  }, { signal: lifecycle.signal })).catch(() => {});
}

registerWebMcpTools();
