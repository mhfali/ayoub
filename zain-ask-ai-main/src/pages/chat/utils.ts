const oldReg = /(#{2}\d+\${2})/g;
export const currentReg = /\[ID:(\d+)\]/g;

// To be compatible with the old index matching mode
export const replaceTextByOldReg = (text: string) => {
  return text?.replace(oldReg, (substring: string) => {
    return `[ID:${substring.slice(2, -2)}]`;
  });
};