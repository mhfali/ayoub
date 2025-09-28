import Image from '@/components/image';
import { cn } from '@/lib/utils';
import classNames from 'classnames';
import DOMPurify from 'dompurify';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '../ui/hover-card';
import { ImageDisplayConfig, contentTypeConfigs, defaultImageConfig } from './config';
import styles from './index.less';

interface ConfigurableImageDisplayProps {
  imageId: string;
  chunkItem?: {
    content?: string;
    doc_type?: string;
    document_name?: string;
  };
  config?: Partial<ImageDisplayConfig>;
  size?: 'small' | 'medium' | 'large' | 'fullscreen';
}

export const ConfigurableImageDisplay = ({
  imageId,
  chunkItem,
  config,
  size = 'medium'
}: ConfigurableImageDisplayProps) => {
  // Merge configurations
  const contentType = chunkItem?.doc_type || 'image';
  const baseConfig = contentTypeConfigs[contentType] || defaultImageConfig;
  const finalConfig = { ...baseConfig, ...config };

  // Apply size preset if specified
  if (size && !config?.thumbnail && !config?.preview) {
    const sizePreset = imageSizePresets[size];
    finalConfig.thumbnail = { ...finalConfig.thumbnail, ...sizePreset.thumbnail };
    finalConfig.preview = { ...finalConfig.preview, ...sizePreset.preview };
  }

  const thumbnailStyle = {
    width: finalConfig.thumbnail.width,
    height: finalConfig.thumbnail.height,
    objectFit: 'contain' as const
  };

  const previewStyle = {
    maxWidth: finalConfig.preview.maxWidth,
    maxHeight: finalConfig.preview.maxHeight,
    objectFit: 'contain' as const
  };

  return (
    <HoverCard 
      openDelay={finalConfig.tooltip.openDelay}
      closeDelay={finalConfig.tooltip.closeDelay}
    >
      <HoverCardTrigger>
        <Image
          id={imageId}
          className={classNames(
            'border rounded transition-all hover:shadow-md',
            finalConfig.thumbnail.className
          )}
          style={thumbnailStyle}
        />
      </HoverCardTrigger>
      <HoverCardContent
        className={cn("max-w-fit p-3", finalConfig.preview.className)}
        align={finalConfig.tooltip.align}
        side={finalConfig.tooltip.side}
        sideOffset={finalConfig.tooltip.sideOffset}
      >
        <div className="space-y-3">
          {/* Enhanced preview image */}
          <Image
            id={imageId}
            className="rounded shadow-sm"
            style={previewStyle}
          />
          
          {/* Optional content preview */}
          {finalConfig.tooltip.showContent && chunkItem?.content && (
            <div className="border-t pt-3">
              <div className="text-sm text-gray-600 max-h-24 overflow-y-auto leading-relaxed">
                <div 
                  dangerouslySetInnerHTML={{
                    __html: DOMPurify.sanitize(
                      chunkItem.content.length > finalConfig.tooltip.contentMaxLength
                        ? chunkItem.content.substring(0, finalConfig.tooltip.contentMaxLength) + '...'
                        : chunkItem.content
                    )
                  }}
                />
              </div>
              
              {/* Document info */}
              {chunkItem.document_name && (
                <div className="text-xs text-gray-400 mt-2 font-medium">
                  📄 {chunkItem.document_name}
                </div>
              )}
            </div>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
};