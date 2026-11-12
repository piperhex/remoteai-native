import { useState } from 'react';
import { Image, StyleSheet } from 'react-native';

/** Use the captured viewport's ratio, which can differ when the keyboard has resized the page. */
export function BrowserTabPreview({ uri }: { uri: string }) {
  const [aspectRatio, setAspectRatio] = useState(1);
  return <Image source={{ uri }} resizeMode="contain" style={[styles.image, { aspectRatio }]}
    onLoad={event => {
      const { width, height } = event.nativeEvent.source;
      if (width > 0 && height > 0) setAspectRatio(width / height);
    }} />;
}

const styles = StyleSheet.create({ image: { position: 'absolute', top: 0, width: '100%' } });
