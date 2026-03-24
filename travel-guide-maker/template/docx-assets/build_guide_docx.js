#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  ImageRun, TableOfContents, PageBreak, ExternalHyperlink,
  Header, Footer, PageNumber, BorderStyle, TabStopType, TabStopPosition,
  LevelFormat
} = require('docx');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function resolveFromRoot(rootDir, maybeRelativePath) {
  return path.isAbsolute(maybeRelativePath)
    ? maybeRelativePath
    : path.join(rootDir, maybeRelativePath);
}

function loadGuideConfig(configPath) {
  const absoluteConfigPath = path.resolve(configPath);
  const rootDir = path.dirname(absoluteConfigPath);
  const config = readJson(absoluteConfigPath);

  return {
    rootDir,
    configPath: absoluteConfigPath,
    slug: config.slug,
    destinationName: config.destinationName,
    title: config.title,
    subtitle: config.subtitle,
    coverDescription: config.coverDescription || '',
    coverTagline: config.coverTagline || '',
    date: config.date,
    markdownPath: resolveFromRoot(rootDir, config.markdownPath),
    routeMapPath: resolveFromRoot(rootDir, config.routeMapPath),
    noteSummaryPath: resolveFromRoot(rootDir, config.noteSummaryPath),
    imageManifestPath: resolveFromRoot(rootDir, config.imageManifestPath),
    outputDocxPath: resolveFromRoot(rootDir, config.outputDocxPath),
    galleryImagePaths: (config.galleryImagePaths || []).map((item) => resolveFromRoot(rootDir, item)),
    docx: config.docx || {},
  };
}

function ensureFileExists(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} not found: ${filePath}`);
  }
}

function p(text, opts = {}) {
  return new Paragraph({
    ...opts,
    children: [new TextRun(typeof text === 'string' ? { text } : text)],
  });
}

function splitSections(md) {
  const lines = md.split(/\r?\n/);
  const sections = [];
  let current = null;
  for (const line of lines) {
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      current = { level: h[1].length, title: h[2].trim(), lines: [] };
      sections.push(current);
    } else if (current) {
      current.lines.push(line);
    }
  }
  return sections;
}

function createDivider({ color = 'D9E2F3', before = 160, after = 160 } = {}) {
  return new Paragraph({
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 6, color, space: 1 },
    },
    spacing: { before, after },
  });
}

function createMetaLine(runs) {
  return new Paragraph({
    spacing: { after: 60 },
    children: runs,
  });
}

function createCardLabel(text) {
  return new TextRun({ text, bold: true, color: '345B84' });
}

function createAppendixCardTopBorder() {
  return {
    top: { style: BorderStyle.SINGLE, size: 8, color: 'DCE6F2', space: 1 },
  };
}

function createGalleryParagraph(image, width, height) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 160 },
    children: [new ImageRun({
      type: image.type,
      data: image.data,
      transformation: { width, height },
      altText: { title: image.name, description: image.name, name: image.name },
    })],
  });
}

function createGalleryCaption(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 220 },
    children: [new TextRun({ text, size: 18, color: '6B7280', italics: true })],
  });
}

function buildImageGallery(images) {
  if (!images.length) {
    return [];
  }

  const gallery = [
    new Paragraph({ children: [new PageBreak()] }),
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 80, after: 120 },
      children: [new TextRun('代表性画面')],
    }),
    new Paragraph({
      spacing: { after: 180, line: 300 },
      children: [new TextRun({ text: '挑选少量代表图作为正文前的视觉预览页；控制数量以保证文档稳定和体积可控。', color: '5B6B7A' })],
    }),
  ];

  images.slice(0, 4).forEach((image, index) => {
    gallery.push(createGalleryParagraph(image, 420, 315));
    gallery.push(createGalleryCaption(`代表图 ${index + 1}｜${image.name}`));
  });

  return gallery;
}

function buildParagraphsFromLines(lines) {
  const out = [];
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      continue;
    }
    if (line === '---') {
      out.push(createDivider({ color: 'D9D9D9', before: 220, after: 220 }));
      continue;
    }
    if (line.startsWith('> ')) {
      out.push(new Paragraph({
        spacing: { before: 80, after: 120, line: 320 },
        indent: { left: 360, right: 120 },
        border: {
          left: { style: BorderStyle.SINGLE, size: 12, color: '8FAADC', space: 1 }
        },
        shading: { fill: 'F7FAFC' },
        children: [new TextRun({ text: line.slice(2), italics: true, color: '4F4F4F' })],
      }));
      continue;
    }
    const ordered = line.match(/^\d+\.\s+(.*)$/);
    if (ordered) {
      out.push(new Paragraph({
        numbering: { reference: 'numbered-list', level: 0 },
        spacing: { before: 20, after: 90, line: 320 },
        children: [new TextRun(ordered[1])],
      }));
      continue;
    }
    const bullet = line.match(/^-\s+(.*)$/);
    if (bullet) {
      out.push(new Paragraph({
        numbering: { reference: 'bullet-list', level: 0 },
        spacing: { before: 20, after: 90, line: 320 },
        children: [new TextRun(bullet[1])],
      }));
      continue;
    }
    out.push(new Paragraph({
      spacing: { after: 110, line: 320 },
      children: [new TextRun(line)],
    }));
  }
  return out;
}

function loadGalleryImages(galleryImagePaths) {
  return galleryImagePaths
    .filter((filePath) => fs.existsSync(filePath))
    .map((filePath) => ({
      name: path.basename(filePath),
      type: path.extname(filePath).toLowerCase() === '.png' ? 'png' : 'jpg',
      data: fs.readFileSync(filePath),
    }));
}

function buildGuideDoc(configPath) {
  const guide = loadGuideConfig(configPath);
  ensureFileExists(guide.markdownPath, 'Markdown');
  ensureFileExists(guide.routeMapPath, 'Route map');
  ensureFileExists(guide.noteSummaryPath, 'Note summary');
  ensureFileExists(guide.imageManifestPath, 'Image manifest');

  const markdown = fs.readFileSync(guide.markdownPath, 'utf8');
  const notes = readJson(guide.noteSummaryPath);
  const manifest = readJson(guide.imageManifestPath);
  const routeImage = fs.readFileSync(guide.routeMapPath);
  const coverGalleryImages = loadGalleryImages(guide.galleryImagePaths);

  const children = [];
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 980, after: 140 },
    children: [new TextRun({ text: guide.title, bold: true, size: 42, color: '1F3A5F' })],
  }));
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 180 },
    children: [new TextRun({ text: guide.subtitle, size: 26, color: '355C7D', bold: true })],
  }));
  if (guide.coverDescription) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 340 },
      children: [new TextRun({ text: guide.coverDescription, size: 21, color: '6B7280' })],
    }));
  }
  if (guide.coverTagline) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 280 },
      children: [new TextRun({ text: guide.coverTagline, size: 20, italics: true, color: '4F6D8A' })],
    }));
  }
  children.push(createDivider({ color: 'C9D8EA', before: 0, after: 260 }));
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 220 },
    children: [new TextRun({ text: `整理时间：${guide.date}`, size: 20, color: '7A7A7A' })],
  }));
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 220 },
    children: [new TextRun({ text: '示意路线图', size: 20, bold: true, color: '345B84' })],
  }));
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 220 },
    children: [new ImageRun({
      type: 'png',
      data: routeImage,
      transformation: { width: 440, height: 640 },
      altText: { title: '示意路线图', description: '示意路线图', name: '示意路线图' },
    })],
  }));
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 240 },
    children: [new TextRun({ text: '路线图仅用于理解行程节奏与片区关系，具体动线请结合现场交通与天气灵活调整。', italics: true, size: 18, color: '666666' })],
  }));
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 80, after: 160 },
    children: [new TextRun('目录')],
  }));
  children.push(new TableOfContents('目录', { hyperlink: true, headingStyleRange: '1-3' }));
  children.push(...buildImageGallery(coverGalleryImages));
  children.push(new Paragraph({ children: [new PageBreak()] }));

  const sections = splitSections(markdown);
  for (const section of sections) {
    const headingMap = { 1: HeadingLevel.HEADING_1, 2: HeadingLevel.HEADING_2, 3: HeadingLevel.HEADING_3, 4: HeadingLevel.HEADING_4 };
    if (section.level === 1 && children.length > 0) {
      children.push(createDivider({ color: 'DCE6F2', before: 200, after: 140 }));
    }
    children.push(new Paragraph({
      heading: headingMap[section.level] || HeadingLevel.HEADING_3,
      spacing: {
        before: section.level === 1 ? 260 : section.level === 2 ? 180 : 120,
        after: section.level === 1 ? 140 : section.level === 2 ? 110 : 80,
      },
      children: [new TextRun(section.title)],
    }));
    children.push(...buildParagraphsFromLines(section.lines));
  }

  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [new TextRun('附录｜来源摘要')],
  }));
  for (const note of notes) {
    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_2,
      border: createAppendixCardTopBorder(),
      spacing: { before: 180, after: 70 },
      children: [new TextRun(`${note.title || '无标题笔记'}｜${note.author || '未知作者'}`)],
    }));
    children.push(createMetaLine([
      createCardLabel('互动数据｜'),
      new TextRun({ text: `点赞 ${note.likedCount}｜收藏 ${note.collectedCount}｜评论 ${note.commentCount}`, bold: true, color: '44546A' }),
    ]));
    if (note.desc) {
      const normalizedDesc = note.desc.replace(/\s+/g, ' ').trim();
      const excerpt = normalizedDesc.slice(0, 220) + (normalizedDesc.length > 220 ? '…' : '');
      children.push(createMetaLine([
        createCardLabel('摘要｜'),
        new TextRun({ text: excerpt, color: '333333' }),
      ]));
    }
    if (note.top_comments && note.top_comments.length) {
      children.push(createMetaLine([
        createCardLabel('参考评论｜'),
        new TextRun({ text: note.top_comments[0], color: '666666', italics: true }),
      ]));
    }
    if (note.source_link) {
      children.push(new Paragraph({
        spacing: { after: 120 },
        children: [
          createCardLabel('来源｜'),
          new ExternalHyperlink({
            children: [new TextRun({ text: '查看原始来源链接', style: 'Hyperlink' })],
            link: note.source_link,
          }),
        ],
      }));
    }
  }

  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [new TextRun('附录｜图片映射摘要')],
  }));
  for (const item of manifest) {
    const line = `${item.title || '无标题笔记'}（${item.feed_id}）`;
    children.push(new Paragraph({
      border: createAppendixCardTopBorder(),
      spacing: { before: 160, after: 50 },
      children: [new TextRun({ text: line, bold: true, color: '345B84' })],
    }));
    children.push(createMetaLine([
      createCardLabel('图片数量｜'),
      new TextRun({ text: `已下载 ${item.image_count_downloaded} 张`, color: '444444' }),
    ]));
    if (item.local_image_paths && item.local_image_paths.length) {
      const preview = item.local_image_paths.slice(0, 3).map((filePath) => path.basename(filePath)).join('，');
      children.push(createMetaLine([
        createCardLabel('文件示例｜'),
        new TextRun({ text: `${preview}${item.local_image_paths.length > 3 ? ' 等' : ''}`, color: '666666' }),
      ]));
    }
    if (item.source_link) {
      children.push(new Paragraph({
        spacing: { after: 110 },
        children: [
          createCardLabel('来源｜'),
          new ExternalHyperlink({
            children: [new TextRun({ text: '来源链接', style: 'Hyperlink' })],
            link: item.source_link,
          }),
        ],
      }));
    }
  }

  const doc = new Document({
    creator: 'Claude Code',
    title: guide.title,
    description: `${guide.destinationName || guide.title}旅游攻略`,
    styles: {
      default: { document: { run: { font: 'Arial', size: 22 }, paragraph: { spacing: { after: 90, line: 320 } } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
           run: { size: 32, bold: true, font: 'Arial', color: '1F3A5F' },
           paragraph: { spacing: { before: 300, after: 160 }, outlineLevel: 0 } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
           run: { size: 27, bold: true, font: 'Arial', color: '345B84' },
           paragraph: { spacing: { before: 200, after: 110 }, outlineLevel: 1 } },
        { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
           run: { size: 24, bold: true, font: 'Arial', color: '4B6A88' },
           paragraph: { spacing: { before: 130, after: 90 }, outlineLevel: 2 } },
        { id: 'Heading4', name: 'Heading 4', basedOn: 'Normal', next: 'Normal', quickFormat: true,
           run: { size: 22, bold: true, font: 'Arial', color: '5B5B5B' },
           paragraph: { spacing: { before: 100, after: 70 }, outlineLevel: 3 } },
      ],
    },
    numbering: {
      config: [
        { reference: 'bullet-list', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
        { reference: 'numbered-list', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      ]
    },
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            spacing: { after: 40 },
            children: [new TextRun({ text: guide.docx.headerText || `${guide.title}｜整理版`, color: '6B7280', size: 17 })],
            border: { bottom: { style: BorderStyle.SINGLE, size: 3, color: 'D9E2F3', space: 1 } },
          })],
        })
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
            border: { top: { style: BorderStyle.SINGLE, size: 2, color: 'E5E7EB', space: 1 } },
            spacing: { before: 40 },
            children: [
              new TextRun({ text: guide.docx.footerText || '整理自公开高赞笔记', color: '7A7A7A', size: 17 }),
              new TextRun('\t'),
              new TextRun({ text: '第 ', color: '7A7A7A', size: 17 }),
              new TextRun({ children: [PageNumber.CURRENT], color: '7A7A7A', size: 17 }),
              new TextRun({ text: ' 页', color: '7A7A7A', size: 17 }),
            ],
          })],
        })
      },
      children,
    }],
  });

  fs.mkdirSync(path.dirname(guide.outputDocxPath), { recursive: true });
  return Packer.toBuffer(doc).then((buffer) => {
    fs.writeFileSync(guide.outputDocxPath, buffer);
    return guide.outputDocxPath;
  });
}

const configPath = process.argv[2] || path.join(process.cwd(), 'guide.config.json');
buildGuideDoc(configPath)
  .then((outputPath) => {
    console.log(outputPath);
  })
  .catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
