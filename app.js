import { signatureConfig as config } from "./signature-config.js";

import {
  parseGIF,
  decompressFrames
} from "https://cdn.jsdelivr.net/npm/gifuct-js@2.1.2/+esm";

import {
  GIFEncoder,
  quantize,
  applyPalette
} from "https://cdn.jsdelivr.net/npm/gifenc@1.0.3/+esm";

/* =========================================================
   ELEMENTOS
========================================================= */

const form = document.querySelector("#signature-form");
const shell = document.querySelector("#preview-shell");
const stage = document.querySelector("#signature-stage");
const baseImage = document.querySelector("#signature-base");
const status = document.querySelector("#action-status");
const emailError = document.querySelector("#email-error");

const generateButton = document.querySelector("#copy-button");
const downloadButton = document.querySelector("#download-button");
const resetButton = document.querySelector("#reset-button");

const inputs = Object.fromEntries(
  ["name", "role", "phone", "email", "city", "state", "country"].map(
    (id) => [id, document.querySelector(`#${id}`)]
  )
);

const outputs = Object.fromEntries(
  ["name", "role", "phone", "email", "location"].map(
    (id) => [id, document.querySelector(`#preview-${id}`)]
  )
);

let generatedGifBlob = null;
let generatedGifUrl = null;

/* =========================================================
   BASE
========================================================= */

baseImage.src = config.assets.previewGifUrl;

/* =========================================================
   DADOS
========================================================= */

function setDefaults() {
  Object.entries(config.defaults).forEach(([key, value]) => {
    if (inputs[key]) {
      inputs[key].value = value;
    }
  });

  updatePreview();

  generatedGifBlob = null;

  if (generatedGifUrl) {
    URL.revokeObjectURL(generatedGifUrl);
    generatedGifUrl = null;
  }

  downloadButton.disabled = true;
  status.textContent = "";
}

function getData() {
  const city = inputs.city.value.trim();
  const state = inputs.state.value.trim().toUpperCase();
  const country = inputs.country.value.trim();

  return {
    name: inputs.name.value.trim(),
    role: inputs.role.value.trim(),
    phone: inputs.phone.value.trim(),
    email: inputs.email.value.trim(),
    city,
    state,
    country,
    location: `${city} – ${state} | ${country}`
  };
}

/* =========================================================
   VALIDAÇÃO
========================================================= */

function validateEmail() {
  const value = inputs.email.value.trim();

  const valid =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  inputs.email.setAttribute(
    "aria-invalid",
    valid ? "false" : "true"
  );

  emailError.textContent =
    valid || !value ? "" : "Informe um e-mail válido.";

  return valid;
}

function validateForExport() {
  const required = [
    inputs.name,
    inputs.role,
    inputs.phone,
    inputs.email,
    inputs.city,
    inputs.state,
    inputs.country
  ];

  const complete = required.every(
    (input) => input.value.trim()
  );

  if (!complete) {
    status.textContent =
      "Preencha todos os campos antes de gerar a assinatura.";

    form.reportValidity();
    return false;
  }

  if (!validateEmail()) {
    status.textContent =
      "Corrija o e-mail antes de gerar a assinatura.";

    inputs.email.focus();
    return false;
  }

  return true;
}

/* =========================================================
   PRÉVIA ATUAL
========================================================= */

function applyOverlay(element, fieldName) {
  const field = config.fields[fieldName];

  element.style.left = `${field.x}px`;
  element.style.top = `${field.y}px`;
  element.style.maxWidth = `${field.maxWidth}px`;
  element.style.fontSize = `${field.fontSize}px`;
  element.style.fontWeight = field.fontWeight;
}

Object.keys(config.fields).forEach((field) => {
  if (outputs[field]) {
    applyOverlay(outputs[field], field);
  }
});

function updatePreview() {
  const data = getData();

  outputs.name.textContent = data.name;
  outputs.role.textContent = data.role;
  outputs.phone.textContent = data.phone;
  outputs.email.textContent = data.email;
  outputs.location.textContent = data.location;

  if (outputs.phone) {
    outputs.phone.href =
      `tel:${data.phone.replace(/[^\d+]/g, "")}`;
  }

  if (outputs.email) {
    outputs.email.href = `mailto:${data.email}`;
  }

  resizePreview();
}

function resizePreview() {
  if (!shell || !stage) return;

  const availableWidth = shell.clientWidth;

  if (!availableWidth) return;

  const scale = Math.min(
    1,
    availableWidth / config.originalWidth
  );

  stage.style.transform = `scale(${scale})`;

  shell.style.height =
    `${Math.ceil(config.originalHeight * scale)}px`;
}

/* =========================================================
   CANVAS / TEXTO
========================================================= */

function createCanvas(width, height) {
  const canvas = document.createElement("canvas");

  canvas.width = width;
  canvas.height = height;

  return canvas;
}

function getFontString(field) {
  return `${field.fontWeight} ${field.fontSize}px Montserrat, Arial, Helvetica, sans-serif`;
}

function fitText(ctx, text, field) {
  let size = field.fontSize;

  const minimum =
    field.minFontSize || Math.max(12, field.fontSize * 0.7);

  while (size > minimum) {
    ctx.font =
      `${field.fontWeight} ${size}px Montserrat, Arial, Helvetica, sans-serif`;

    if (ctx.measureText(text).width <= field.maxWidth) {
      break;
    }

    size -= 1;
  }

  return size;
}

function drawField(ctx, text, fieldName) {
  const field = config.fields[fieldName];

  if (!field || !text) return;

  const fontSize = fitText(ctx, text, field);

  ctx.save();

  ctx.font =
    `${field.fontWeight} ${fontSize}px Montserrat, Arial, Helvetica, sans-serif`;

  ctx.fillStyle =
    config.colors?.navy || "#003064";

  ctx.textBaseline = "top";

  /*
    Ajuste fino:
    As coordenadas do config foram criadas para o overlay HTML.
    Mantemos os mesmos pontos para que o GIF final corresponda
    à prévia atual.
  */

  ctx.fillText(
    text,
    field.x,
    field.y,
    field.maxWidth
  );

  ctx.restore();
}

function drawEmployeeData(ctx, data) {
  drawField(ctx, data.name, "name");
  drawField(ctx, data.role, "role");
  drawField(ctx, data.phone, "phone");
  drawField(ctx, data.email, "email");
  drawField(ctx, data.location, "location");
}

/* =========================================================
   CARREGAR FONTE
========================================================= */

async function ensureFonts() {
  try {
    if (document.fonts?.load) {
      await Promise.all([
        document.fonts.load("700 40px Montserrat"),
        document.fonts.load("400 28px Montserrat"),
        document.fonts.load("500 23px Montserrat"),
        document.fonts.load("500 22px Montserrat")
      ]);

      await document.fonts.ready;
    }
  } catch (error) {
    console.warn(
      "Montserrat não pôde ser confirmada. Usando fallback.",
      error
    );
  }
}

/* =========================================================
   SLUG
========================================================= */

function slugify(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/* =========================================================
   COMPOSIÇÃO DOS FRAMES
========================================================= */

function drawPatchOnCanvas(
  targetCtx,
  patch,
  dims
) {
  const patchCanvas = createCanvas(
    dims.width,
    dims.height
  );

  const patchCtx =
    patchCanvas.getContext("2d");

  const imageData =
    patchCtx.createImageData(
      dims.width,
      dims.height
    );

  imageData.data.set(patch);

  patchCtx.putImageData(
    imageData,
    0,
    0
  );

  targetCtx.drawImage(
    patchCanvas,
    dims.left,
    dims.top
  );
}

/* =========================================================
   GERAR GIF
========================================================= */

async function generatePersonalizedGif() {
  if (!validateForExport()) return;

  const data = getData();

  generateButton.disabled = true;
  downloadButton.disabled = true;

  status.textContent =
    "Gerando assinatura animada...";

  try {
    await ensureFonts();

    /*
      Carregamos diretamente o BASE local.
      Isso evita depender do Outlook ou de HTML para a composição.
    */

    const response =
      await fetch(
        config.assets.previewGifUrl,
        { cache: "no-store" }
      );

    if (!response.ok) {
      throw new Error(
        `Não foi possível carregar o GIF base (${response.status}).`
      );
    }

    const buffer =
      await response.arrayBuffer();

    const parsed =
      parseGIF(buffer);

    const frames =
      decompressFrames(parsed, true);

    if (!frames.length) {
      throw new Error(
        "Nenhum frame foi encontrado no GIF base."
      );
    }

    const width =
      config.originalWidth;

    const height =
      config.originalHeight;

    /*
      Canvas que mantém o estado acumulado da animação.
    */

    const animationCanvas =
      createCanvas(width, height);

    const animationCtx =
      animationCanvas.getContext("2d", {
        willReadFrequently: true
      });

    /*
      Canvas usado para produzir cada frame final.
    */

    const outputCanvas =
      createCanvas(width, height);

    const outputCtx =
      outputCanvas.getContext("2d", {
        willReadFrequently: true
      });

    const encoder =
      GIFEncoder();

    let previousFrame = null;
    let restoreImageData = null;

    /*
      Processamos cada frame individualmente.
    */

    for (
      let index = 0;
      index < frames.length;
      index += 1
    ) {
      const frame =
        frames[index];

      status.textContent =
        `Gerando assinatura animada... ${index + 1}/${frames.length}`;

      /*
        Disposal do frame anterior.
      */

      if (previousFrame) {
        const previousDisposal =
          previousFrame.disposalType;

        if (previousDisposal === 2) {
          animationCtx.clearRect(
            previousFrame.dims.left,
            previousFrame.dims.top,
            previousFrame.dims.width,
            previousFrame.dims.height
          );
        }

        if (
          previousDisposal === 3 &&
          restoreImageData
        ) {
          animationCtx.putImageData(
            restoreImageData,
            0,
            0
          );

          restoreImageData = null;
        }
      }

      /*
        Disposal 3:
        precisamos salvar o estado ANTES de desenhar
        o frame atual.
      */

      if (frame.disposalType === 3) {
        restoreImageData =
          animationCtx.getImageData(
            0,
            0,
            width,
            height
          );
      }

      /*
        Aplica o patch do frame.
      */

      drawPatchOnCanvas(
        animationCtx,
        frame.patch,
        frame.dims
      );

      /*
        Copia a arte animada para o canvas final.
      */

      outputCtx.clearRect(
        0,
        0,
        width,
        height
      );

      outputCtx.drawImage(
        animationCanvas,
        0,
        0
      );

      /*
        Aqui acontece a mudança fundamental:

        os dados deixam de ser HTML e passam
        a fazer parte dos pixels do frame.
      */

      drawEmployeeData(
        outputCtx,
        data
      );

      const rgba =
        outputCtx.getImageData(
          0,
          0,
          width,
          height
        ).data;

      /*
        GIF trabalha com paleta indexada.
      */

      const palette =
        quantize(rgba, 256);

      const indexed =
        applyPalette(
          rgba,
          palette
        );

      /*
        gifuct-js fornece o delay em ms.
        Caso não exista, usamos 100ms.
      */

      const delay =
        Number.isFinite(frame.delay) &&
        frame.delay > 0
          ? frame.delay
          : 100;

      encoder.writeFrame(
        indexed,
        width,
        height,
        {
          palette,
          delay,
          repeat:
            index === 0 ? 0 : undefined
        }
      );

      previousFrame = frame;

      /*
        Libera o thread da interface periodicamente
        para a página não parecer travada.
      */

      if (index % 2 === 0) {
        await new Promise(
          (resolve) =>
            requestAnimationFrame(resolve)
        );
      }
    }

    encoder.finish();

    const bytes =
      encoder.bytes();

    generatedGifBlob =
      new Blob(
        [bytes],
        { type: "image/gif" }
      );

    if (generatedGifUrl) {
      URL.revokeObjectURL(
        generatedGifUrl
      );
    }

    generatedGifUrl =
      URL.createObjectURL(
        generatedGifBlob
      );

    /*
      Mostra o resultado FINAL no lugar da base.
      Agora não há overlay sobre essa imagem.
    */

    baseImage.src =
      generatedGifUrl;

    Object.values(outputs).forEach(
      (element) => {
        element.style.visibility =
          "hidden";
      }
    );

    downloadButton.disabled = false;

    status.textContent =
      "Assinatura gerada. O GIF final já contém todos os dados. Clique em Baixar GIF.";

  } catch (error) {
    console.error(error);

    status.textContent =
      `Erro ao gerar assinatura: ${error.message}`;

    generatedGifBlob = null;
    downloadButton.disabled = true;

  } finally {
    generateButton.disabled = false;
  }
}

/* =========================================================
   DOWNLOAD
========================================================= */

function downloadGeneratedGif() {
  if (!generatedGifBlob) {
    status.textContent =
      "Primeiro clique em Gerar assinatura.";
    return;
  }

  const data = getData();

  const filename =
    `assinatura-${slugify(data.name)}.gif`;

  const url =
    URL.createObjectURL(
      generatedGifBlob
    );

  const link =
    document.createElement("a");

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);

  link.click();
  link.remove();

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);

  status.textContent =
    `GIF baixado: ${filename}`;
}

/* =========================================================
   RESTAURAR
========================================================= */

function resetGenerator() {
  if (generatedGifUrl) {
    URL.revokeObjectURL(
      generatedGifUrl
    );

    generatedGifUrl = null;
  }

  generatedGifBlob = null;

  baseImage.src =
    config.assets.previewGifUrl;

  Object.values(outputs).forEach(
    (element) => {
      element.style.visibility =
        "visible";
    }
  );

  downloadButton.disabled = true;

  setDefaults();

  status.textContent =
    "Dados restaurados.";
}

/* =========================================================
   ALTERAÇÃO DOS CAMPOS
========================================================= */

Object.values(inputs).forEach(
  (input) => {
    input.addEventListener(
      "input",
      () => {
        /*
          Se já existia um GIF gerado e o usuário
          alterou algum dado, voltamos para a prévia.
        */

        if (generatedGifBlob) {
          if (generatedGifUrl) {
            URL.revokeObjectURL(
              generatedGifUrl
            );

            generatedGifUrl = null;
          }

          generatedGifBlob = null;

          baseImage.src =
            config.assets.previewGifUrl;

          Object.values(outputs).forEach(
            (element) => {
              element.style.visibility =
                "visible";
            }
          );

          downloadButton.disabled = true;
        }

        if (input === inputs.state) {
          const cursor =
            input.selectionStart;

          input.value =
            input.value.toUpperCase();

          try {
            input.setSelectionRange(
              cursor,
              cursor
            );
          } catch {
            // sem ação
          }
        }

        if (input === inputs.email) {
          validateEmail();
        }

        updatePreview();
      }
    );
  }
);

/* =========================================================
   EVENTOS
========================================================= */

generateButton.addEventListener(
  "click",
  generatePersonalizedGif
);

downloadButton.addEventListener(
  "click",
  downloadGeneratedGif
);

resetButton.addEventListener(
  "click",
  resetGenerator
);

window.addEventListener(
  "resize",
  resizePreview
);

/* =========================================================
   INICIALIZAÇÃO
========================================================= */

setDefaults();

baseImage.addEventListener(
  "load",
  resizePreview
);
  }, { signal: lifecycle.signal })).catch(() => {});
}

registerWebMcpTools();
