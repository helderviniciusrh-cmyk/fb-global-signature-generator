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
   OVERLAYS DA PRÉVIA
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


/* =========================================================
   PRÉVIA
========================================================= */

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


  baseImage.src =
    config.assets.previewGifUrl;


  showOverlays();

  updatePreviewText();

  downloadButton.disabled = true;


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

  canvas.width = width;
  canvas.height = height;

  return canvas;
}


/* =========================================================
   FONTE
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
      "Não foi possível confirmar Montserrat. Será utilizado o fallback.",
      error
    );

  }

}


/* =========================================================
   TEXTO NO GIF
========================================================= */

function calculateFontSize(
  ctx,
  text,
  field
) {

  let size =
    field.fontSize;


  const min =
    field.minFontSize ||
    Math.round(
      field.fontSize * 0.7
    );


  while (size > min) {

    ctx.font =
      `${field.fontWeight} ${size}px ${config.fontFamily}`;


    if (
      ctx.measureText(text).width <=
      field.maxWidth
    ) {
      break;
    }


    size -= 1;
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
    config.fields[fieldName];


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
    canvas.getContext("2d");


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
   GERAR GIF PERSONALIZADO
========================================================= */

async function generateSignature() {

  if (generating) {
    return;
  }


  if (!validateForExport()) {
    return;
  }


  generating = true;

  generateButton.disabled = true;
  downloadButton.disabled = true;


  status.textContent =
    "Carregando GIF oficial...";


  try {

    await ensureFonts();


    /*
     * Primeiro tentamos o arquivo local.
     */

    let response =
      await fetch(
        config.assets.previewGifUrl,
        {
          cache: "no-store"
        }
      );


    /*
     * Caso o servidor local não entregue
     * corretamente, usamos a URL pública.
     */

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
      "Lendo animação...";


    const gif =
      parseGIF(arrayBuffer);


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
        "O arquivo não contém frames válidos."
      );

    }


    console.log(
      `Frames encontrados: ${frames.length}`
    );


    const width =
      config.originalWidth;

    const height =
      config.originalHeight;


    /*
     * Canvas acumulativo da animação.
     */

    const animationCanvas =
      createCanvas(
        width,
        height
      );


    const animationCtx =
      animationCanvas.getContext(
        "2d",
        {
          willReadFrequently: true
        }
      );


    /*
     * Canvas final:
     * arte + dados do funcionário.
     */

    const finalCanvas =
      createCanvas(
        width,
        height
      );


    const finalCtx =
      finalCanvas.getContext(
        "2d",
        {
          willReadFrequently: true
        }
      );


    /*
     * Encoder do novo GIF.
     */

    const encoder =
      GIFEncoder();


    let previousFrame = null;
    let restoreState = null;


    for (
      let index = 0;
      index < frames.length;
      index += 1
    ) {

      const frame =
        frames[index];


      status.textContent =
        `Gerando GIF: ${index + 1} de ${frames.length} frames...`;


      /*
       * Trata o disposal do frame anterior.
       */

      if (previousFrame) {

        if (
          previousFrame.disposalType === 2
        ) {

          animationCtx.clearRect(
            previousFrame.dims.left,
            previousFrame.dims.top,
            previousFrame.dims.width,
            previousFrame.dims.height
          );

        }


        if (
          previousFrame.disposalType === 3 &&
          restoreState
        ) {

          animationCtx.putImageData(
            restoreState,
            0,
            0
          );

          restoreState = null;

        }

      }


      /*
       * Disposal 3 exige guardar
       * o estado anterior.
       */

      if (
        frame.disposalType === 3
      ) {

        restoreState =
          animationCtx.getImageData(
            0,
            0,
            width,
            height
          );

      }


      /*
       * Desenha o patch atual.
       */

      const patchCanvas =
        createPatchCanvas(frame);


      animationCtx.drawImage(
        patchCanvas,
        frame.dims.left,
        frame.dims.top
      );


      /*
       * Copia o frame completo.
       */

      finalCtx.clearRect(
        0,
        0,
        width,
        height
      );


      finalCtx.drawImage(
        animationCanvas,
        0,
        0
      );


      /*
       * Incorpora os dados.
       */

      drawEmployeeData(
        finalCtx,
        getData()
      );


      /*
       * Captura os pixels.
       */

      const imageData =
        finalCtx.getImageData(
          0,
          0,
          width,
          height
        );


      /*
       * GIF precisa de paleta.
       */

      const palette =
        quantize(
          imageData.data,
          256
        );


      const indexedPixels =
        applyPalette(
          imageData.data,
          palette
        );


      /*
       * gifuct-js trabalha com delay
       * em milissegundos.
       */

      let delay =
        Number(frame.delay);


      if (
        !Number.isFinite(delay) ||
        delay <= 0
      ) {

        delay = 100;

      }


      /*
       * Adiciona o frame ao novo GIF.
       */

      encoder.writeFrame(
        indexedPixels,
        width,
        height,
        {
          palette,
          delay,
          repeat: 0
        }
      );


      previousFrame =
        frame;


      /*
       * Evita congelar completamente
       * a interface.
       */

      if (
        index % 2 === 0
      ) {

        await new Promise(
          resolve =>
            requestAnimationFrame(
              resolve
            )
        );

      }

    }


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
     * Exibe exatamente o arquivo
     * que foi gerado.
     */

    hideOverlays();


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


    if (previewDescription) {

      previewDescription.textContent =
        "Prévia do GIF final com os dados incorporados.";

    }


    status.textContent =
      `Assinatura gerada com sucesso. ${frames.length} frame(s) processado(s).`;

  } catch (error) {

    console.error(
      "Erro ao gerar assinatura:",
      error
    );


    status.textContent =
      `Erro ao gerar assinatura: ${error.message}`;


    showEditablePreview();

  } finally {

    generating = false;

    generateButton.disabled =
      false;

  }

}


/* =========================================================
   DOWNLOAD
========================================================= */

function downloadGif() {

  if (!generatedGifBlob) {

    status.textContent =
      "Primeiro gere a assinatura.";

    return;
  }


  const data =
    getData();


  const filename =
    `assinatura-${slugify(data.name)}.gif`;


  const url =
    URL.createObjectURL(
      generatedGifBlob
    );


  const link =
    document.createElement("a");


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
    `Arquivo baixado: ${filename}`;

}


/* =========================================================
   ALTERAÇÃO DOS CAMPOS
========================================================= */

function handleInputChange(
  event
) {

  const input =
    event.target;


  /*
   * Estado sempre em maiúsculo.
   */

  if (
    input === inputs.state
  ) {

    input.value =
      input.value.toUpperCase();

  }


  if (
    input === inputs.email
  ) {

    validateEmail();

  }


  /*
   * Se já havia um GIF final,
   * qualquer alteração invalida
   * aquele arquivo.
   */

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

  if (generatedGifUrl) {

    URL.revokeObjectURL(
      generatedGifUrl
    );

    generatedGifUrl = null;

  }


  generatedGifBlob = null;


  fillDefaults();


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

  /*
   * Configura primeiro o palco.
   */

  stage.style.width =
    `${config.originalWidth}px`;

  stage.style.height =
    `${config.originalHeight}px`;


  /*
   * Configura posições dos textos.
   */

  configureAllOverlays();


  /*
   * Preenche Bruno como padrão.
   */

  fillDefaults();


  /*
   * Atualiza textos.
   */

  updatePreviewText();


  /*
   * Exibe overlays.
   */

  showOverlays();


  /*
   * Botão de download começa bloqueado.
   */

  downloadButton.disabled =
    true;


  /*
   * Carrega o GIF SOMENTE agora.
   */

  baseImage.onload =
    () => {

      requestAnimationFrame(
        resizePreview
      );

    };


  baseImage.onerror =
    () => {

      /*
       * Fallback para o GitHub.
       */

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


  /*
   * Caso o navegador já tenha
   * a imagem no cache.
   */

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
