import type { BoneNote } from '../types';
import { plainTextFromRich } from './richText';

export async function drawNoteShareImage(note: BoneNote): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas unavailable');

  const contentMargin = 50;
  const cardX = contentMargin;
  const cardY = contentMargin;
  const cardWidth = canvas.width - contentMargin * 2;
  const titleLineHeight = 60;
  const lineHeight = 52;
  const bottomAreaHeight = 160;
  const footerHeight = 180;
  const titleTopPadding = 100;
  const titleBottomPadding = 30;
  const maxTitleWidth = cardWidth - 80;
  const maxContentWidth = cardWidth - 100;

  const titleLines = wrapCanvasText(ctx, note.title || '未命名笔记', maxTitleWidth, 'bold 48px sans-serif');
  const contentLines = wrapCanvasText(ctx, plainTextFromRich(note.content || ''), maxContentWidth, 'bold 32px sans-serif');
  const loadedImages = await Promise.all(note.images.map((image) => loadCanvasImage(image.dataUrl).catch(() => null)));
  const imageWidth = cardWidth - 60;
  const imageGap = 30;
  const imageHeights = loadedImages.map((image) => {
    if (!image || image.width === 0) return 0;
    return image.height * (imageWidth / image.width);
  });
  const imagesHeight =
    imageHeights.reduce((total, height) => total + height, 0) +
    Math.max(0, imageHeights.filter((height) => height > 0).length - 1) * imageGap;

  const headerHeight = Math.max(titleLines.length * titleLineHeight + titleTopPadding + titleBottomPadding, 240);
  const contentAreaHeight = contentLines.length * lineHeight + 80;
  const imagesAreaHeight = imagesHeight > 0 ? imagesHeight + 120 : 0;
  const cardHeight = headerHeight + contentAreaHeight + imagesAreaHeight + bottomAreaHeight;
  canvas.height = Math.ceil(cardHeight + contentMargin * 2 + footerHeight);

  ctx.fillStyle = '#f5f5f5';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.fillStyle = '#e0e0e0';
  ctx.shadowColor = '#ffffff';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetX = -15;
  ctx.shadowOffsetY = -15;
  fillRoundRect(ctx, cardX, cardY, cardWidth, cardHeight, 30);
  ctx.shadowColor = '#bebebe';
  ctx.shadowOffsetX = 15;
  ctx.shadowOffsetY = 15;
  fillRoundRect(ctx, cardX, cardY, cardWidth, cardHeight, 30);
  ctx.restore();

  ctx.save();
  roundRectPath(ctx, cardX, cardY, cardWidth, headerHeight, 30);
  ctx.clip();
  const headerGradient = ctx.createLinearGradient(cardX, cardY, cardX, cardY + headerHeight);
  headerGradient.addColorStop(0, 'rgba(224, 224, 224, 0.9)');
  headerGradient.addColorStop(1, 'rgba(224, 224, 224, 0)');
  ctx.fillStyle = headerGradient;
  ctx.fillRect(cardX, cardY, cardWidth, headerHeight);
  ctx.restore();

  ctx.save();
  ctx.font = 'bold 48px sans-serif';
  ctx.fillStyle = '#333333';
  titleLines.forEach((line, index) => {
    ctx.fillText(line, cardX + 40, cardY + titleTopPadding + index * titleLineHeight);
  });
  ctx.restore();

  ctx.save();
  ctx.font = 'bold 32px sans-serif';
  ctx.fillStyle = 'rgba(51, 51, 51, 0.95)';
  let currentY = cardY + headerHeight + 10;
  contentLines.forEach((line) => {
    currentY += lineHeight;
    if (line) ctx.fillText(line, cardX + 40, currentY);
  });
  ctx.restore();

  if (imagesHeight > 0) {
    let imageY = currentY + 60;
    loadedImages.forEach((image, index) => {
      const height = imageHeights[index];
      if (!image || height <= 0) return;
      const centerX = (canvas.width - imageWidth) / 2;
      ctx.save();
      roundRectPath(ctx, centerX, imageY, imageWidth, height, 10);
      ctx.clip();
      ctx.drawImage(image, centerX, imageY, imageWidth, height);
      ctx.restore();
      imageY += height + imageGap;
    });
  }

  const bottomAreaY = cardY + cardHeight - bottomAreaHeight;
  const buttonY = bottomAreaY + 60;
  const buttonSize = 48;
  const buttonGap = 30;
  const buttonStartX = canvas.width - contentMargin - buttonSize * 3 - buttonGap * 2 - 30;
  ['rgba(209, 35, 42, 0.95)', 'rgba(30, 136, 229, 0.95)', 'rgba(255, 215, 0, 0.95)'].forEach(
    (color, index) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(buttonStartX + index * (buttonSize + buttonGap), buttonY, buttonSize / 2, 0, Math.PI * 2);
      ctx.fill();
    },
  );

  ctx.font = '24px sans-serif';
  ctx.fillStyle = '#999999';
  const tags = ['#B·one', '#笔记分享', ...note.tags.map((tag) => `#${tag}`)];
  let tagX = cardX + 40;
  const tagY = bottomAreaY + 110;
  tags.forEach((tag) => {
    if (tagX + ctx.measureText(tag).width > cardX + cardWidth - 40) return;
    ctx.fillText(tag, tagX, tagY);
    tagX += ctx.measureText(tag).width + 30;
  });

  drawBoneBrand(ctx, canvas.width, cardY + cardHeight + contentMargin, footerHeight);
  return canvas.toDataURL('image/png');
}

function wrapCanvasText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, font: string) {
  ctx.font = font;
  const lines: string[] = [];
  text.split('\n').forEach((paragraph) => {
    if (!paragraph) {
      lines.push('');
      return;
    }

    let line = '';
    paragraph.split('').forEach((char) => {
      const testLine = line + char;
      if (ctx.measureText(testLine).width > maxWidth && line) {
        lines.push(line);
        line = char;
      } else {
        line = testLine;
      }
    });
    lines.push(line);
  });
  return lines.length > 0 ? lines : [''];
}

function loadCanvasImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('image load failed'));
    image.src = src;
  });
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + safeRadius, y);
  ctx.lineTo(x + width - safeRadius, y);
  ctx.arcTo(x + width, y, x + width, y + safeRadius, safeRadius);
  ctx.lineTo(x + width, y + height - safeRadius);
  ctx.arcTo(x + width, y + height, x + width - safeRadius, y + height, safeRadius);
  ctx.lineTo(x + safeRadius, y + height);
  ctx.arcTo(x, y + height, x, y + height - safeRadius, safeRadius);
  ctx.lineTo(x, y + safeRadius);
  ctx.arcTo(x, y, x + safeRadius, y, safeRadius);
  ctx.closePath();
}

function fillRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  roundRectPath(ctx, x, y, width, height, radius);
  ctx.fill();
}

function drawBoneBrand(ctx: CanvasRenderingContext2D, canvasWidth: number, y: number, height: number) {
  ctx.save();
  ctx.fillStyle = '#f5f5f5';
  ctx.fillRect(0, y, canvasWidth, height);
  ctx.font = 'bold 56px sans-serif';

  const parts = [
    { text: 'B', color: '#000000' },
    { text: '·', color: '#e0e0e0' },
    { text: 'o', color: 'rgba(255, 215, 0, 0.75)' },
    { text: 'n', color: 'rgba(209, 35, 42, 0.75)' },
    { text: 'e', color: 'rgba(30, 136, 229, 0.75)' },
  ];
  const totalWidth = parts.reduce((width, part) => width + ctx.measureText(part.text).width, 0);
  let x = (canvasWidth - totalWidth) / 2;
  const textY = y + height / 2 + 10;

  parts.forEach((part, index) => {
    ctx.fillStyle = part.color;
    if (index === 0) {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
    } else if (index === 1) {
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    } else {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
      ctx.shadowBlur = 3;
      ctx.shadowOffsetX = -2;
      ctx.shadowOffsetY = -2;
    }
    ctx.fillText(part.text, x, textY);
    x += ctx.measureText(part.text).width;
  });
  ctx.restore();
}
