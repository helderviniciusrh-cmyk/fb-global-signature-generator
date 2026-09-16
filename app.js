import {
  signatureConfig as config
} from "./signature-config.js";

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
   CONFIGURAÇÃO DE OTIMIZAÇÃO
========================================================= */

const OUTPUT_WIDTH = 815;

const OUTPUT_HEIGHT = Math.round(
  config.originalHeight *
  (OUTPUT_WIDTH / config.originalWidth)
);

const OUTPUT_SCALE =
  OUTPUT_WIDTH / config.originalWidth;

/*
 * 64 cores mantém boa qualidade visual
 * com peso adequado para assinatura de e-mail.
 */
const GIF_COLORS = 64;

/*
 * 40 ms = teto aproximado de 25 FPS.
 *
 * Diferentemente da versão anterior,
 * NÃO eliminamos frames pela diferença visual.
 *
 * Apenas agrupamos frames extremamente rápidos.
 */
const MIN_FRAME_DELAY = 40;


/* =========================================================
   ELEMENTOS
========================================================= */

const form =
  document.querySelector("#signature-form");

const shell =
  document.querySelector("#preview-shell");

const stage =
  document.querySelector("#signature-stage");

const baseImage =
  document.querySelector("#signature-base");

const status =
  document.querySelector("#action-status");

const emailError =
  document.querySelector("#email-error");

const previewDescription =
  document.querySelector("#preview-description");

const generateButton =
  document.querySelector("#generate-button");

const downloadButton =
  document.querySelector("#download-button");

const resetButton =
  document.querySelector("#reset-button");


const inputs = {
  name: document.querySelector("#name"),
  role: document.querySelector("#role"),
  phone: document.querySelector("#phone"),
  email: document.querySelector("#email"),
  city: document.querySelector("#city"),
  state: document.querySelector("#state"),
  country: document.querySelector("#country")
};


const outputs = {
  name: document.querySelector("#preview-name"),
  role: document.querySelector("#preview-role"),
  phone: document.querySelector("#preview-phone"),
  email: document.querySelector("#preview-email"),
  location: document.querySelector("#preview-location")
};


/* =========================================================
   ESTADO
========================================================= */

let generatedGifBlob = null;
let generatedGifUrl = null;
let generating = false;


/* =========================================================
   UTILIDADES
========================================================= */

function getData() {

  const city =
    inputs.city.value.trim();

  const state =
    inputs.state.value.trim().toUpperCase();

  const country =
    inputs.country.value.trim();

  return {
    name: inputs.name.value.trim(),
    role: inputs.role.value.trim(),
    phone: inputs.phone.value.trim(),
    email: inputs.email.value.trim(),
    city,
    state,
    country,

    location:
      `${city} – ${state} | ${country}`
  };
}


function slugify(value) {

  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}


function formatBytes(bytes) {

  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 KB";
  }

  const mb =
    bytes / (1024 * 1024);

  if (mb >= 1) {
    return `${mb.toFixed(2)} MB`;
  }

  return `${Math.round(bytes / 1024)} KB`;
}


/* =========================================================
   VALIDAÇÃO
========================================================= */

function validateEmail() {

  const value =
    inputs.email.value.trim();

  if (!value) {

    emailError.textContent = "";

    inputs.email.removeAttribute(
      "aria-invalid"
    );

    return false;
  }


  const valid =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      value
    );


  inputs.email.setAttribute(
    "aria-invalid",
    valid ? "false" : "true"
  );


  emailError.textContent =
    valid
      ? ""
      : "Informe um e-mail válido.";


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


  const complete =
    required.every(
      input => input.value.trim()
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
   DADOS PADRÃO
========================================================= */

function fillDefaults() {

  Object.entries(
    config.defaults
  ).forEach(([key, value]) => {

    if (inputs[key]) {
      inputs[key].value = value;
    }

  });
}


/* =========================================================
   OVERLAYS
========================================================= */

function configureOverlay(
  element,
  fieldName
) {

  const field =
    config.fields[fieldName];


  if (!element || !field) {
    return;
  }


  element.style.left =
    `${field.x}px`;

  element.style.top =
    `${field.y}px`;

  element.style.width =
    `${field.maxWidth}px`;

  element.style.maxWidth =
    `${field.maxWidth}px`;

  element.style.fontSize =
    `${field.fontSize}px`;

  element.style.fontWeight =
    String(field.fontWeight);

  element.style.color =
    config.colors.navy;

  element.style.fontFamily =
    config.fontFamily;

  element.style.visibility =
    "visible";
}


function configureAllOverlays() {

  configureOverlay(
    outputs.name,
    "name"
  );

  configureOverlay(
    outputs.role,
    "role"
  );

  configureOverlay(
    outputs.phone,
    "phone"
  );

  configureOverlay(
    outputs.email,
    "email"
  );

  configureOverlay(
    outputs.location,
    "location"
  );
}


function showOverlays() {

  Object.values(outputs).forEach(
    element => {

      if (element) {

        element.style.visibility =
          "visible";

      }

    }
  );
}


function hideOverlays() {

  Object.values(outputs).forEach(
    element => {

      if (element) {

        element.style.visibility =
          "hidden";

      }

    }
  );
}


/* =========================================================
   PRÉVIA
========================================================= */

function updatePreviewText() {

  const data =
    getData();


  outputs.name.textContent =
    data.name;

  outputs.role.textContent =
    data.role;

  outputs.phone.textContent =
    data.phone;

  outputs.email.textContent =
    data.email;

  outputs.location.textContent =
    data.location;
}


function resizePreview() {

  if (!shell || !stage) {
    return;
  }


  const availableWidth =
    shell.clientWidth;


  if (!availableWidth) {
    return;
  }


  const scale =
    Math.min(
      1,
      availableWidth /
      config.originalWidth
    );


  stage.style.width =
    `${config.originalWidth}px`;

  stage.style.height =
    `${config.originalHeight}px`;

  stage.style.transformOrigin =
    "top left";

  stage.style.transform =
    `scale(${scale})`;


  shell.style.height =
    `${Math.ceil(
      config.originalHeight * scale
    )}px`;
}


function showEditablePreview() {

  if (generatedGifUrl) {

    URL.revokeObjectURL(
      generatedGifUrl
    );

    generatedGifUrl = null;
  }


  generatedGifBlob = null;


  baseImage.style.width =
    `${config.originalWidth}px`;

  baseImage.style.height =
    `${config.originalHeight}px`;


  baseImage.src =
    config.assets.previewGifUrl;


  showOverlays();

  updatePreviewText();


  downloadButton.disabled =
    true;


  if (previewDescription) {

    previewDescription.textContent =
      "O GIF permanece intacto e animado.";

  }


  requestAnimationFrame(
    resizePreview
  );
}


/* =========================================================
   CANVAS
========================================================= */

function createCanvas(
  width,
  height
) {

  const canvas =
    document.createElement("canvas");

  canvas.width =
    width;

  canvas.height =
    height;

  return canvas;
}


/* =========================================================
   FONTES
========================================================= */

async function ensureFonts() {

  if (!document.fonts) {
    return;
  }


  try {

    await Promise.all([

      document.fonts.load(
        "700 40px Montserrat"
      ),

      document.fonts.load(
        "400 28px Montserrat"
      ),

      document.fonts.load(
        "500 23px Montserrat"
      ),

      document.fonts.load(
        "500 22px Montserrat"
      )

    ]);


    await document.fonts.ready;

  } catch (error) {

    console.warn(
      "Montserrat não pôde ser confirmada.",
      error
    );

  }
}


/* =========================================================
   CAMPOS ESCALADOS
========================================================= */

function getScaledField(
  fieldName
) {

  const original =
    config.fields[fieldName];


  if (!original) {
    return null;
  }


  return {

    x:
      original.x *
      OUTPUT_SCALE,

    y:
      original.y *
      OUTPUT_SCALE,

    maxWidth:
      original.maxWidth *
      OUTPUT_SCALE,

    fontSize:
      original.fontSize *
      OUTPUT_SCALE,

    minFontSize:
      (
        original.minFontSize ||
        original.fontSize * 0.7
      ) *
      OUTPUT_SCALE,

    fontWeight:
      original.fontWeight

  };
}


function calculateFontSize(
  ctx,
  text,
  field
) {

  let size =
    field.fontSize;


  while (
    size >
    field.minFontSize
  ) {

    ctx.font =
      `${field.fontWeight} ${size}px ${config.fontFamily}`;


    if (
      ctx.measureText(text).width <=
      field.maxWidth
    ) {

      break;

    }


    size -=
      0.5;
  }


  return size;
}


function drawField(
  ctx,
  text,
  fieldName
) {

  if (!text) {
    return;
  }


  const field =
    getScaledField(
      fieldName
    );


  if (!field) {
    return;
  }


  const size =
    calculateFontSize(
      ctx,
      text,
      field
    );


  ctx.save();


  ctx.font =
    `${field.fontWeight} ${size}px ${config.fontFamily}`;


  ctx.fillStyle =
    config.colors.navy;


  ctx.textAlign =
    "left";


  ctx.textBaseline =
    "top";


  ctx.fillText(
    text,
    field.x,
    field.y
  );


  ctx.restore();
}


function drawEmployeeData(
  ctx,
  data
) {

  drawField(
    ctx,
    data.name,
    "name"
  );


  drawField(
    ctx,
    data.role,
    "role"
  );


  drawField(
    ctx,
    data.phone,
    "phone"
  );


  drawField(
    ctx,
    data.email,
    "email"
  );


  drawField(
    ctx,
    data.location,
    "location"
  );
}


/* =========================================================
   PATCH DO GIF
========================================================= */

function createPatchCanvas(
  frame
) {

  const canvas =
    createCanvas(
      frame.dims.width,
      frame.dims.height
    );


  const ctx =
    canvas.getContext(
      "2d"
    );


  const imageData =
    ctx.createImageData(
      frame.dims.width,
      frame.dims.height
    );


  imageData.data.set(
    frame.patch
  );


  ctx.putImageData(
    imageData,
    0,
    0
  );


  return canvas;
}


/* =========================================================
   GERAR GIF
========================================================= */

async function generateSignature() {

  if (generating) {
    return;
  }


  if (!validateForExport()) {
    return;
  }


  generating =
    true;


  generateButton.disabled =
    true;


  downloadButton.disabled =
    true;


  status.textContent =
    "Carregando GIF oficial...";


  try {

    await ensureFonts();


    /* =====================================================
       CARREGA O GIF ORIGINAL
    ===================================================== */

    let response =
      await fetch(
        config.assets.previewGifUrl,
        {
          cache: "no-store"
        }
      );


    if (!response.ok) {

      response =
        await fetch(
          config.assets.publicGifUrl,
          {
            cache: "no-store"
          }
        );

    }


    if (!response.ok) {

      throw new Error(
        "Não foi possível carregar o GIF oficial."
      );

    }


    const arrayBuffer =
      await response.arrayBuffer();


    status.textContent =
      "Analisando animação...";


    const gif =
      parseGIF(
        arrayBuffer
      );


    const frames =
      decompressFrames(
        gif,
        true
      );


    if (
      !frames ||
      frames.length === 0
    ) {

      throw new Error(
        "O GIF não contém frames válidos."
      );

    }


    console.log(
      `Frames originais: ${frames.length}`
    );


    /* =====================================================
       CANVAS ORIGINAL
    ===================================================== */

    const sourceCanvas =
      createCanvas(
        config.originalWidth,
        config.originalHeight
      );


    const sourceCtx =
      sourceCanvas.getContext(
        "2d",
        {
          willReadFrequently: true
        }
      );


    /* =====================================================
       CANVAS FINAL
    ===================================================== */

    const outputCanvas =
      createCanvas(
        OUTPUT_WIDTH,
        OUTPUT_HEIGHT
      );


    const outputCtx =
      outputCanvas.getContext(
        "2d",
        {
          willReadFrequently: true
        }
      );


    outputCtx.imageSmoothingEnabled =
      true;


    outputCtx.imageSmoothingQuality =
      "high";


    /* =====================================================
       ENCODER
    ===================================================== */

    const encoder =
      GIFEncoder();


    const employeeData =
      getData();


    let previousSourceFrame =
      null;


    let restoreState =
      null;


    /*
     * Aqui controlamos apenas o tempo.
     *
     * Não existe mais análise por
     * diferença visual.
     */
    let pendingDelay =
      0;


    let encodedFrames =
      0;


    /* =====================================================
       PROCESSAMENTO DOS FRAMES
    ===================================================== */

    for (
      let index = 0;
      index < frames.length;
      index += 1
    ) {

      const frame =
        frames[index];


      status.textContent =
        `Processando animação: ${index + 1} de ${frames.length} frames...`;


      /* ===================================================
         DISPOSAL DO FRAME ANTERIOR
      =================================================== */

      if (
        previousSourceFrame
      ) {

        if (
          previousSourceFrame.disposalType === 2
        ) {

          sourceCtx.clearRect(
            previousSourceFrame.dims.left,
            previousSourceFrame.dims.top,
            previousSourceFrame.dims.width,
            previousSourceFrame.dims.height
          );

        }


        if (
          previousSourceFrame.disposalType === 3 &&
          restoreState
        ) {

          sourceCtx.putImageData(
            restoreState,
            0,
            0
          );


          restoreState =
            null;

        }

      }


      if (
        frame.disposalType === 3
      ) {

        restoreState =
          sourceCtx.getImageData(
            0,
            0,
            config.originalWidth,
            config.originalHeight
          );

      }


      /* ===================================================
         MONTA FRAME ORIGINAL
      =================================================== */

      const patchCanvas =
        createPatchCanvas(
          frame
        );


      sourceCtx.drawImage(
        patchCanvas,
        frame.dims.left,
        frame.dims.top
      );


      /* ===================================================
         REDUZ PARA 815 × 272
      =================================================== */

      outputCtx.clearRect(
        0,
        0,
        OUTPUT_WIDTH,
        OUTPUT_HEIGHT
      );


      outputCtx.drawImage(

        sourceCanvas,

        0,
        0,
        config.originalWidth,
        config.originalHeight,

        0,
        0,
        OUTPUT_WIDTH,
        OUTPUT_HEIGHT

      );


      /* ===================================================
         DADOS DO COLABORADOR
      =================================================== */

      drawEmployeeData(
        outputCtx,
        employeeData
      );


      /* ===================================================
         DELAY ORIGINAL
      =================================================== */

      let frameDelay =
        Number(
          frame.delay
        );


      if (
        !Number.isFinite(
          frameDelay
        ) ||
        frameDelay <= 0
      ) {

        frameDelay =
          40;

      }


      pendingDelay +=
        frameDelay;


      const isFirstFrame =
        encodedFrames === 0;


      const isLastFrame =
        index ===
        frames.length - 1;


      /*
       * NOVA REGRA:
       *
       * Não verificamos diferença visual.
       *
       * Salvamos o frame sempre que
       * atingirmos 40 ms acumulados.
       *
       * Isso preserva a fluidez.
       */

      const shouldEncode =
        isFirstFrame ||
        isLastFrame ||
        pendingDelay >=
          MIN_FRAME_DELAY;


      /* ===================================================
         CODIFICA
      =================================================== */

      if (shouldEncode) {

        const currentImage =
          outputCtx.getImageData(
            0,
            0,
            OUTPUT_WIDTH,
            OUTPUT_HEIGHT
          );


        const palette =
          quantize(
            currentImage.data,
            GIF_COLORS
          );


        const indexedPixels =
          applyPalette(
            currentImage.data,
            palette
          );


        encoder.writeFrame(

          indexedPixels,

          OUTPUT_WIDTH,

          OUTPUT_HEIGHT,

          {

            palette,

            delay:
              Math.max(
                20,
                pendingDelay
              ),

            repeat: 0

          }

        );


        encodedFrames +=
          1;


        pendingDelay =
          0;

      }


      previousSourceFrame =
        frame;


      /*
       * Mantém a página responsiva.
       */

      if (
        index % 3 === 0
      ) {

        await new Promise(
          resolve =>
            requestAnimationFrame(
              resolve
            )
        );

      }

    }


    /* =====================================================
       FINALIZA GIF
    ===================================================== */

    encoder.finish();


    const bytes =
      encoder.bytes();


    generatedGifBlob =
      new Blob(
        [bytes],
        {
          type: "image/gif"
        }
      );


    if (
      generatedGifUrl
    ) {

      URL.revokeObjectURL(
        generatedGifUrl
      );

    }


    generatedGifUrl =
      URL.createObjectURL(
        generatedGifBlob
      );


    /* =====================================================
       MOSTRA GIF FINAL
    ===================================================== */

    hideOverlays();


    baseImage.style.width =
      `${config.originalWidth}px`;


    baseImage.style.height =
      `${config.originalHeight}px`;


    baseImage.src =
      generatedGifUrl;


    baseImage.onload =
      () => {

        requestAnimationFrame(
          resizePreview
        );

      };


    downloadButton.disabled =
      false;


    if (
      previewDescription
    ) {

      previewDescription.textContent =
        `GIF otimizado · ${OUTPUT_WIDTH} × ${OUTPUT_HEIGHT} · ${formatBytes(generatedGifBlob.size)}`;

    }


    status.textContent =
      `Assinatura pronta · ${encodedFrames} de ${frames.length} frames utilizados · ${formatBytes(generatedGifBlob.size)}.`;

  } catch (error) {

    console.error(
      "Erro ao gerar assinatura:",
      error
    );


    status.textContent =
      `Erro ao gerar assinatura: ${error.message}`;


    showEditablePreview();

  } finally {

    generating =
      false;


    generateButton.disabled =
      false;

  }
}


/* =========================================================
   DOWNLOAD
========================================================= */

function downloadGif() {

  if (
    !generatedGifBlob
  ) {

    status.textContent =
      "Primeiro gere a assinatura.";

    return;
  }


  const data =
    getData();


  const filename =
    `FB-Global-Logistics-${slugify(data.name)}.gif`;


  const url =
    URL.createObjectURL(
      generatedGifBlob
    );


  const link =
    document.createElement(
      "a"
    );


  link.href =
    url;


  link.download =
    filename;


  document.body.appendChild(
    link
  );


  link.click();


  link.remove();


  setTimeout(
    () => {

      URL.revokeObjectURL(
        url
      );

    },
    1500
  );


  status.textContent =
    `Arquivo baixado: ${filename} · ${formatBytes(generatedGifBlob.size)}`;
}


/* =========================================================
   ALTERAÇÃO DOS CAMPOS
========================================================= */

function handleInputChange(
  event
) {

  const input =
    event.target;


  if (
    input ===
    inputs.state
  ) {

    input.value =
      input.value.toUpperCase();

  }


  if (
    input ===
    inputs.email
  ) {

    validateEmail();

  }


  if (
    generatedGifBlob
  ) {

    showEditablePreview();

  }


  updatePreviewText();
}


/* =========================================================
   RESTAURAR
========================================================= */

function resetGenerator() {

  if (
    generatedGifUrl
  ) {

    URL.revokeObjectURL(
      generatedGifUrl
    );


    generatedGifUrl =
      null;

  }


  generatedGifBlob =
    null;


  fillDefaults();


  baseImage.style.width =
    `${config.originalWidth}px`;


  baseImage.style.height =
    `${config.originalHeight}px`;


  baseImage.src =
    config.assets.previewGifUrl;


  showOverlays();


  updatePreviewText();


  downloadButton.disabled =
    true;


  if (
    previewDescription
  ) {

    previewDescription.textContent =
      "O GIF permanece intacto e animado.";

  }


  status.textContent =
    "Dados restaurados.";


  requestAnimationFrame(
    resizePreview
  );
}


/* =========================================================
   EVENTOS
========================================================= */

Object.values(
  inputs
).forEach(input => {

  input.addEventListener(
    "input",
    handleInputChange
  );

});


generateButton.addEventListener(
  "click",
  generateSignature
);


downloadButton.addEventListener(
  "click",
  downloadGif
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

function initialize() {

  stage.style.width =
    `${config.originalWidth}px`;


  stage.style.height =
    `${config.originalHeight}px`;


  configureAllOverlays();


  fillDefaults();


  updatePreviewText();


  showOverlays();


  downloadButton.disabled =
    true;


  baseImage.style.width =
    `${config.originalWidth}px`;


  baseImage.style.height =
    `${config.originalHeight}px`;


  baseImage.onload =
    () => {

      requestAnimationFrame(
        resizePreview
      );

    };


  baseImage.onerror =
    () => {

      if (
        baseImage.src !==
        config.assets.publicGifUrl
      ) {

        baseImage.src =
          config.assets.publicGifUrl;

        return;

      }


      status.textContent =
        "Não foi possível carregar o GIF oficial.";

    };


  baseImage.src =
    config.assets.previewGifUrl;


  if (
    baseImage.complete &&
    baseImage.naturalWidth
  ) {

    requestAnimationFrame(
      resizePreview
    );

  }

}


initialize();
