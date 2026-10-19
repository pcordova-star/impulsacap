import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';

function parseInlineFormatting(text: string): TextRun[] {
  const runs: TextRun[] = [];
  const regex = /(\*\*.*?\*\*)/g;
  const parts = text.split(regex);

  for (const part of parts) {
    if (!part) continue;
    if (part.startsWith('**') && part.endsWith('**')) {
      runs.push(
        new TextRun({
          text: part.slice(2, -2),
          bold: true,
          font: 'Calibri',
          size: 24, // 12pt
          color: '1E293B',
        })
      );
    } else {
      runs.push(
        new TextRun({
          text: part,
          font: 'Calibri',
          size: 24, // 12pt
          color: '334155',
        })
      );
    }
  }

  return runs;
}

export async function exportMarkdownToDocx(markdownText: string, fileName: string): Promise<void> {
  const lines = markdownText.split('\n');
  const paragraphs: Paragraph[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      paragraphs.push(
        new Paragraph({
          children: [new TextRun({ text: '' })],
          spacing: { after: 120 },
        })
      );
      continue;
    }

    // Heading 1
    if (line.startsWith('# ')) {
      paragraphs.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
          spacing: { before: 240, after: 160 },
          children: [
            new TextRun({
              text: line.slice(2).trim(),
              bold: true,
              font: 'Calibri',
              size: 32, // 16pt
              color: '0F172A',
            }),
          ],
        })
      );
      continue;
    }

    // Heading 2
    if (line.startsWith('## ')) {
      paragraphs.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 120 },
          children: [
            new TextRun({
              text: line.slice(3).trim(),
              bold: true,
              font: 'Calibri',
              size: 28, // 14pt
              color: '1E293B',
            }),
          ],
        })
      );
      continue;
    }

    // Heading 3
    if (line.startsWith('### ')) {
      paragraphs.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 160, after: 80 },
          children: [
            new TextRun({
              text: line.slice(4).trim(),
              bold: true,
              font: 'Calibri',
              size: 24, // 12pt
              color: '334155',
            }),
          ],
        })
      );
      continue;
    }

    // Bullet points
    if (line.startsWith('- ') || line.startsWith('* ')) {
      paragraphs.push(
        new Paragraph({
          bullet: { level: 0 },
          spacing: { after: 80, line: 276 },
          children: parseInlineFormatting(line.slice(2).trim()),
        })
      );
      continue;
    }

    // Standard paragraph
    paragraphs.push(
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        spacing: { after: 140, line: 276 },
        children: parseInlineFormatting(line),
      })
    );
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440, // 1 inch
              bottom: 1440,
              left: 1440,
              right: 1440,
            },
          },
        },
        children: paragraphs,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName.endsWith('.docx') ? fileName : `${fileName}.docx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
