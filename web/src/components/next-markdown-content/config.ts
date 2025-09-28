// Image display configuration
export interface ImageDisplayConfig {
  thumbnail: {
    width: string;
    height: string;
    className?: string;
  };
  preview: {
    maxWidth: string;
    maxHeight: string;
    className?: string;
  };
  tooltip: {
    openDelay: number;
    closeDelay: number;
    align: 'start' | 'center' | 'end';
    side: 'top' | 'bottom' | 'left' | 'right';
    sideOffset: number;
    showContent: boolean;
    contentMaxLength: number;
  };
}

// Default configuration
export const defaultImageConfig: ImageDisplayConfig = {
  thumbnail: {
    width: '15vw',  // Increased from 10vw
    height: '8vh',  // Added height
    className: 'rounded border'
  },
  preview: {
    maxWidth: '60vw',  // Increased from 45vw
    maxHeight: '60vh', // Increased from 45vh
    className: 'rounded-lg shadow-lg'
  },
  tooltip: {
    openDelay: 200,
    closeDelay: 100,
    align: 'start',
    side: 'right',
    sideOffset: 10,
    showContent: true,
    contentMaxLength: 200
  }
};

// Size presets for different use cases
export const imageSizePresets = {
  small: {
    thumbnail: { width: '8vw', height: '6vh' },
    preview: { maxWidth: '30vw', maxHeight: '30vh' }
  },
  medium: {
    thumbnail: { width: '12vw', height: '9vh' },
    preview: { maxWidth: '45vw', maxHeight: '45vh' }
  },
  large: {
    thumbnail: { width: '18vw', height: '12vh' },
    preview: { maxWidth: '70vw', maxHeight: '70vh' }
  },
  fullscreen: {
    thumbnail: { width: '20vw', height: '15vh' },
    preview: { maxWidth: '90vw', maxHeight: '90vh' }
  }
};

// Content type specific configurations
export const contentTypeConfigs = {
  image: {
    ...defaultImageConfig,
    thumbnail: { ...defaultImageConfig.thumbnail, width: '15vw' }
  },
  table: {
    ...defaultImageConfig,
    thumbnail: { ...defaultImageConfig.thumbnail, width: '20vw', height: '10vh' },
    preview: { ...defaultImageConfig.preview, maxWidth: '80vw' }
  },
  diagram: {
    ...defaultImageConfig,
    thumbnail: { ...defaultImageConfig.thumbnail, width: '18vw' },
    preview: { ...defaultImageConfig.preview, maxWidth: '75vw' }
  }
};