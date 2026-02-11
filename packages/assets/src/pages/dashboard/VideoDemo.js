import React from 'react';
import {Box} from '@shopify/polaris';

export default function VideoDemo({src}) {
  return (
    <Box borderRadius="200" overflow="hidden">
      <video
        src={src}
        controls
        preload="metadata"
        style={{
          width: '100%',
          maxHeight: 400,
          borderRadius: 8,
          background: '#000'
        }}
      />
    </Box>
  );
}
