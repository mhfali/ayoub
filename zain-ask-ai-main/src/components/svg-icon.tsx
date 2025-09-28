import { memo } from 'react';

interface SvgIconProps {
  name: string;
  width?: number;
  height?: number;
  className?: string;
}

// File extension to icon mapping
const fileIconMap: Record<string, string> = {
  'pdf': '📄',
  'doc': '📝',
  'docx': '📝',
  'txt': '📄',
  'md': '📄',
  'html': '🌐',
  'htm': '🌐',
  'xlsx': '📊',
  'xls': '📊',
  'csv': '📊',
  'ppt': '📊',
  'pptx': '📊',
  'jpg': '🖼️',
  'jpeg': '🖼️',
  'png': '🖼️',
  'gif': '🖼️',
  'svg': '🖼️',
  'mp4': '🎥',
  'avi': '🎥',
  'mp3': '🎵',
  'wav': '🎵',
  'zip': '📦',
  'rar': '📦',
  'default': '📄'
};

const SvgIcon = memo(({ name, width = 24, height = 24, className }: SvgIconProps) => {
  // Extract file extension from name like "file-icon/pdf"
  const iconName = name.split('/').pop() || 'default';
  const icon = fileIconMap[iconName] || fileIconMap['default'];

  return (
    <span
      className={className}
      style={{
        width,
        height,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: Math.min(width, height) * 0.8,
        lineHeight: 1
      }}
    >
      {icon}
    </span>
  );
});

SvgIcon.displayName = 'SvgIcon';

export default SvgIcon;