/**
 * Utility to detect animated images (WebP/GIF)
 */

/**
 * Check if a WebP image is animated by looking for ANIM chunk
 */
function isAnimatedWebpFromBytes(bytes: Uint8Array): boolean {
  // WebP format: RIFF....WEBP followed by chunks
  // ANIM chunk indicates animation
  const str = String.fromCharCode(...bytes.slice(0, 4));
  if (str !== 'RIFF') return false;
  
  const webpStr = String.fromCharCode(...bytes.slice(8, 12));
  if (webpStr !== 'WEBP') return false;
  
  // Search for ANIM or ANMF chunk
  for (let i = 12; i < bytes.length - 4; i++) {
    const chunk = String.fromCharCode(...bytes.slice(i, i + 4));
    if (chunk === 'ANIM' || chunk === 'ANMF') {
      return true;
    }
  }
  return false;
}

/**
 * Check if a GIF is animated by checking for multiple frames
 */
function isAnimatedGifFromBytes(bytes: Uint8Array): boolean {
  // GIF89a or GIF87a
  const header = String.fromCharCode(...bytes.slice(0, 6));
  if (!header.startsWith('GIF')) return false;
  
  // Look for multiple image blocks (0x2C is image separator)
  let imageBlockCount = 0;
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === 0x2C) {
      imageBlockCount++;
      if (imageBlockCount > 1) return true;
    }
    // 0x3B is the trailer (end of GIF)
    if (bytes[i] === 0x3B) break;
  }
  
  return false;
}

/**
 * Detect if an image URL points to an animated image
 * @param url The image URL to check
 * @returns Promise<{ isAnimated: boolean; format: 'webp' | 'gif' | 'static' }>
 */
export async function detectAnimatedImage(url: string): Promise<{
  isAnimated: boolean;
  format: 'webp' | 'gif' | 'static';
}> {
  try {
    // Fetch the first few KB of the image (enough to detect animation headers)
    const response = await fetch(url, {
      headers: { Range: 'bytes=0-16384' }
    });
    
    if (!response.ok) {
      // Fallback to full fetch if range not supported
      const fullResponse = await fetch(url);
      const buffer = await fullResponse.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      
      return analyzeBytes(bytes);
    }
    
    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    
    return analyzeBytes(bytes);
  } catch (error) {
    console.error('Error detecting animated image:', error);
    // Default to static if detection fails
    return { isAnimated: false, format: 'static' };
  }
}

function analyzeBytes(bytes: Uint8Array): { isAnimated: boolean; format: 'webp' | 'gif' | 'static' } {
  // Check for WebP
  const riff = String.fromCharCode(...bytes.slice(0, 4));
  const webp = bytes.length > 11 ? String.fromCharCode(...bytes.slice(8, 12)) : '';
  
  if (riff === 'RIFF' && webp === 'WEBP') {
    const isAnimated = isAnimatedWebpFromBytes(bytes);
    return { isAnimated, format: isAnimated ? 'webp' : 'static' };
  }
  
  // Check for GIF
  const gif = String.fromCharCode(...bytes.slice(0, 6));
  if (gif.startsWith('GIF')) {
    const isAnimated = isAnimatedGifFromBytes(bytes);
    return { isAnimated, format: isAnimated ? 'gif' : 'static' };
  }
  
  return { isAnimated: false, format: 'static' };
}

/**
 * Quick check based on file extension/URL
 * Less accurate but faster for initial filtering
 */
export function mightBeAnimated(url: string): boolean {
  const lower = url.toLowerCase();
  return lower.includes('.gif') || lower.includes('.webp');
}
