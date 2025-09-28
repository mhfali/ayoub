// Preprocess LaTeX equations to be rendered by KaTeX
export const preprocessLaTeX = (content: string) => {
  const blockProcessedContent = content.replace(
    /\\\[([\s\S]*?)\\\]/g,
    (_, equation) => `$$${equation}$$`,
  );
  const inlineProcessedContent = blockProcessedContent.replace(
    /\\\(([\s\S]*?)\\\)/g,
    (_, equation) => `$${equation}$`,
  );
  return inlineProcessedContent;
};

export const replaceThinkToSection = (text: string = '') => {
  const pattern = /<think>([\s\S]*?)<\/think>/g;
  const result = text.replace(pattern, '<section class="think">$1</section>');
  return result;
};

export const removeThinkContent = (text: string = '') => {
  const pattern = /<think>[\s\S]*?<\/think>/g;
  const result = text.replace(pattern, '');
  return result;
};

export const showImage = (docType?: string) => {
  return docType === 'image' || docType === 'table' || docType === 'diagram';
};