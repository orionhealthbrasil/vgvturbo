import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// jSquash codecs (WASM) for normalization.
// We intentionally decode + re-encode even when input is already WebP to avoid provider-specific
// decode issues (e.g. animated WebP / uncommon features).
import decodeJpeg from "https://esm.sh/@jsquash/jpeg@1.4.0/decode?target=deno";
import decodeWebp from "https://esm.sh/@jsquash/webp@1.4.0/decode?target=deno";
import encodeWebp from "https://esm.sh/@jsquash/webp@1.4.0/encode?target=deno";
import decodePng from "https://esm.sh/@jsquash/png@3.0.1/decode?target=deno";

// Check if WebP is animated (has ANIM or ANMF chunks)
function isAnimatedWebp(buffer: ArrayBuffer): boolean {
  const bytes = new Uint8Array(buffer);
  
  // Check RIFF header
  if (bytes.length < 12) return false;
  const riff = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  const webp = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
  if (riff !== 'RIFF' || webp !== 'WEBP') return false;
  
  // Search for ANIM or ANMF chunks
  let pos = 12;
  while (pos + 8 < bytes.length) {
    const chunkType = String.fromCharCode(bytes[pos], bytes[pos + 1], bytes[pos + 2], bytes[pos + 3]);
    if (chunkType === 'ANIM' || chunkType === 'ANMF') {
      return true;
    }
    // Get chunk size (little-endian)
    const chunkSize = bytes[pos + 4] | (bytes[pos + 5] << 8) | (bytes[pos + 6] << 16) | (bytes[pos + 7] << 24);
    pos += 8 + chunkSize + (chunkSize & 1); // chunks are padded to even size
  }
  return false;
}

// Extract first frame from animated WebP by trying multiple strategies
async function extractFirstFrameFromAnimatedWebp(buffer: ArrayBuffer): Promise<{ data: Uint8ClampedArray; width: number; height: number } | null> {
  const bytes = new Uint8Array(buffer);
  
  // Strategy 1: Try to decode the whole file directly with jSquash
  // Some "animated" WebPs can still be decoded to get the first frame
  try {
    console.log('Trying direct decode of animated WebP...');
    const directDecode = await decodeWebp(buffer);
    if (directDecode && directDecode.width > 0 && directDecode.height > 0) {
      console.log('Direct decode succeeded for animated WebP');
      return {
        data: directDecode.data instanceof Uint8ClampedArray ? directDecode.data : Uint8ClampedArray.from(directDecode.data as unknown as ArrayLike<number>),
        width: directDecode.width,
        height: directDecode.height
      };
    }
  } catch (e) {
    console.log('Direct decode failed, trying frame extraction:', e);
  }
  
  // Strategy 2: Parse and extract first ANMF frame
  let canvasWidth = 0;
  let canvasHeight = 0;
  let pos = 12;
  
  // Find VP8X chunk for canvas dimensions
  while (pos + 8 < bytes.length) {
    const chunkType = String.fromCharCode(bytes[pos], bytes[pos + 1], bytes[pos + 2], bytes[pos + 3]);
    const chunkSize = bytes[pos + 4] | (bytes[pos + 5] << 8) | (bytes[pos + 6] << 16) | (bytes[pos + 7] << 24);
    
    if (chunkType === 'VP8X' && chunkSize >= 10) {
      canvasWidth = ((bytes[pos + 8 + 4] | (bytes[pos + 8 + 5] << 8) | (bytes[pos + 8 + 6] << 16)) & 0xFFFFFF) + 1;
      canvasHeight = ((bytes[pos + 8 + 7] | (bytes[pos + 8 + 8] << 8) | (bytes[pos + 8 + 9] << 16)) & 0xFFFFFF) + 1;
      console.log(`Animated WebP canvas size: ${canvasWidth}x${canvasHeight}`);
    }
    
    if (chunkType === 'ANMF') {
      console.log('Found ANMF chunk, extracting frame...');
      const readU24LE = (o: number) => (bytes[o] | (bytes[o + 1] << 8) | (bytes[o + 2] << 16)) & 0xFFFFFF;
      const anmfHeaderStart = pos + 8;
      const frameW = readU24LE(anmfHeaderStart + 6) + 1;
      const frameH = readU24LE(anmfHeaderStart + 9) + 1;
      const frameDataStart = pos + 8 + 16;
      const frameDataSize = chunkSize - 16;
      
      if (frameDataStart + frameDataSize <= bytes.length) {
        const frameSubtype = String.fromCharCode(bytes[frameDataStart], bytes[frameDataStart + 1], bytes[frameDataStart + 2], bytes[frameDataStart + 3]);
        
        if (frameSubtype === 'VP8 ' || frameSubtype === 'VP8L') {
          console.log(`Frame subtype: ${frameSubtype}, size: ${frameW}x${frameH}`);
          const frameChunkSize = bytes[frameDataStart + 4] | (bytes[frameDataStart + 5] << 8) | (bytes[frameDataStart + 6] << 16) | (bytes[frameDataStart + 7] << 24);
          const totalFrameSize = 8 + frameChunkSize + (frameChunkSize & 1);
          
          // Build a simple non-extended WebP (just RIFF + WEBP + frame chunk)
          const riffSize = 4 + totalFrameSize;
          const simpleWebp = new Uint8Array(8 + riffSize);
          
          // RIFF header
          simpleWebp.set([0x52, 0x49, 0x46, 0x46], 0); // "RIFF"
          simpleWebp[4] = riffSize & 0xFF;
          simpleWebp[5] = (riffSize >> 8) & 0xFF;
          simpleWebp[6] = (riffSize >> 16) & 0xFF;
          simpleWebp[7] = (riffSize >> 24) & 0xFF;
          simpleWebp.set([0x57, 0x45, 0x42, 0x50], 8); // "WEBP"
          
          // Copy frame chunk directly
          simpleWebp.set(bytes.slice(frameDataStart, frameDataStart + totalFrameSize), 12);
          
          try {
            const decoded = await decodeWebp(simpleWebp.buffer);
            if (decoded && decoded.width > 0 && decoded.height > 0) {
              console.log('Successfully extracted first frame from animated WebP');
              return {
                data: decoded.data instanceof Uint8ClampedArray ? decoded.data : Uint8ClampedArray.from(decoded.data as unknown as ArrayLike<number>),
                width: decoded.width,
                height: decoded.height
              };
            }
          } catch (e) {
            console.warn('Failed to decode extracted simple frame:', e);
          }
          
          // Try with VP8X extended format
          try {
            const outW = canvasWidth || frameW;
            const outH = canvasHeight || frameH;
            const vp8xPayloadSize = 10;
            const vp8xChunkSize = 8 + vp8xPayloadSize;
            const extRiffSize = 4 + vp8xChunkSize + totalFrameSize;
            const extWebp = new Uint8Array(8 + extRiffSize);
            
            extWebp.set([0x52, 0x49, 0x46, 0x46], 0);
            extWebp[4] = extRiffSize & 0xFF;
            extWebp[5] = (extRiffSize >> 8) & 0xFF;
            extWebp[6] = (extRiffSize >> 16) & 0xFF;
            extWebp[7] = (extRiffSize >> 24) & 0xFF;
            extWebp.set([0x57, 0x45, 0x42, 0x50], 8);
            extWebp.set([0x56, 0x50, 0x38, 0x58], 12); // VP8X
            extWebp[16] = 10; extWebp[17] = 0; extWebp[18] = 0; extWebp[19] = 0;
            extWebp[20] = 0; extWebp[21] = 0; extWebp[22] = 0; extWebp[23] = 0;
            const wMinus1 = Math.max(1, outW) - 1;
            extWebp[24] = wMinus1 & 0xFF;
            extWebp[25] = (wMinus1 >> 8) & 0xFF;
            extWebp[26] = (wMinus1 >> 16) & 0xFF;
            const hMinus1 = Math.max(1, outH) - 1;
            extWebp[27] = hMinus1 & 0xFF;
            extWebp[28] = (hMinus1 >> 8) & 0xFF;
            extWebp[29] = (hMinus1 >> 16) & 0xFF;
            extWebp.set(bytes.slice(frameDataStart, frameDataStart + totalFrameSize), 30);
            
            const decoded = await decodeWebp(extWebp.buffer);
            if (decoded && decoded.width > 0 && decoded.height > 0) {
              console.log('Successfully extracted first frame using VP8X wrapper');
              return {
                data: decoded.data instanceof Uint8ClampedArray ? decoded.data : Uint8ClampedArray.from(decoded.data as unknown as ArrayLike<number>),
                width: decoded.width,
                height: decoded.height
              };
            }
          } catch (e) {
            console.warn('Failed to decode with VP8X wrapper:', e);
          }
        }
      }
      break;
    }
    
    pos += 8 + chunkSize + (chunkSize & 1);
  }
  
  // Strategy 3: Return null and let caller handle it (send original or skip normalization)
  console.warn('All frame extraction strategies failed for animated WebP');
  return null;
}

// Simple GIF first-frame decoder (extracts first frame as RGBA)
async function decodeGifFirstFrame(buffer: ArrayBuffer): Promise<{ data: Uint8ClampedArray; width: number; height: number } | null> {
  const bytes = new Uint8Array(buffer);
  
  // Validate GIF header
  const header = String.fromCharCode(...bytes.slice(0, 6));
  if (header !== 'GIF87a' && header !== 'GIF89a') {
    return null;
  }
  
  // Read logical screen descriptor
  const width = bytes[6] | (bytes[7] << 8);
  const height = bytes[8] | (bytes[9] << 8);
  const packed = bytes[10];
  const hasGlobalColorTable = (packed & 0x80) !== 0;
  const globalColorTableSize = hasGlobalColorTable ? 3 * Math.pow(2, (packed & 0x07) + 1) : 0;
  
  // Skip to after global color table
  let pos = 13 + globalColorTableSize;
  
  // Parse global color table
  const globalColorTable: number[][] = [];
  if (hasGlobalColorTable) {
    for (let i = 0; i < globalColorTableSize / 3; i++) {
      globalColorTable.push([bytes[13 + i * 3], bytes[13 + i * 3 + 1], bytes[13 + i * 3 + 2]]);
    }
  }
  
  // Skip extension blocks until we find image descriptor
  while (pos < bytes.length) {
    if (bytes[pos] === 0x21) {
      // Extension block
      pos += 2; // Skip extension introducer and label
      while (bytes[pos] !== 0) {
        pos += bytes[pos] + 1; // Skip sub-blocks
      }
      pos++; // Skip block terminator
    } else if (bytes[pos] === 0x2C) {
      // Image descriptor found
      break;
    } else if (bytes[pos] === 0x3B) {
      // Trailer - end of GIF
      return null;
    } else {
      pos++;
    }
  }
  
  if (bytes[pos] !== 0x2C) {
    return null;
  }
  
  // Parse image descriptor
  pos++; // Skip image separator
  const imgLeft = bytes[pos] | (bytes[pos + 1] << 8);
  const imgTop = bytes[pos + 2] | (bytes[pos + 3] << 8);
  const imgWidth = bytes[pos + 4] | (bytes[pos + 5] << 8);
  const imgHeight = bytes[pos + 6] | (bytes[pos + 7] << 8);
  const imgPacked = bytes[pos + 8];
  pos += 9;
  
  const hasLocalColorTable = (imgPacked & 0x80) !== 0;
  const interlaced = (imgPacked & 0x40) !== 0;
  const localColorTableSize = hasLocalColorTable ? 3 * Math.pow(2, (imgPacked & 0x07) + 1) : 0;
  
  // Parse local color table if present
  const colorTable = hasLocalColorTable ? [] : globalColorTable;
  if (hasLocalColorTable) {
    for (let i = 0; i < localColorTableSize / 3; i++) {
      colorTable.push([bytes[pos + i * 3], bytes[pos + i * 3 + 1], bytes[pos + i * 3 + 2]]);
    }
    pos += localColorTableSize;
  }
  
  // LZW decode
  const minCodeSize = bytes[pos++];
  const clearCode = 1 << minCodeSize;
  const endCode = clearCode + 1;
  
  // Collect all sub-blocks
  const lzwData: number[] = [];
  while (bytes[pos] !== 0 && pos < bytes.length) {
    const blockSize = bytes[pos++];
    for (let i = 0; i < blockSize && pos < bytes.length; i++) {
      lzwData.push(bytes[pos++]);
    }
  }
  pos++; // Skip block terminator
  
  // LZW decompression
  const indices: number[] = [];
  let codeSize = minCodeSize + 1;
  let nextCode = endCode + 1;
  const codeTable: number[][] = [];
  
  // Initialize code table
  for (let i = 0; i < clearCode; i++) {
    codeTable[i] = [i];
  }
  
  let bitPos = 0;
  const getBits = (n: number): number => {
    let result = 0;
    for (let i = 0; i < n; i++) {
      const bytePos = Math.floor(bitPos / 8);
      const bitOffset = bitPos % 8;
      if (bytePos < lzwData.length) {
        result |= ((lzwData[bytePos] >> bitOffset) & 1) << i;
      }
      bitPos++;
    }
    return result;
  };
  
  let prevCode = -1;
  while (indices.length < imgWidth * imgHeight) {
    const code = getBits(codeSize);
    
    if (code === clearCode) {
      codeSize = minCodeSize + 1;
      nextCode = endCode + 1;
      codeTable.length = clearCode;
      for (let i = 0; i < clearCode; i++) {
        codeTable[i] = [i];
      }
      prevCode = -1;
      continue;
    }
    
    if (code === endCode) {
      break;
    }
    
    let output: number[];
    if (code < nextCode) {
      output = codeTable[code];
    } else if (code === nextCode && prevCode >= 0) {
      output = [...codeTable[prevCode], codeTable[prevCode][0]];
    } else {
      break; // Invalid code
    }
    
    indices.push(...output);
    
    if (prevCode >= 0 && nextCode < 4096) {
      codeTable[nextCode] = [...codeTable[prevCode], output[0]];
      nextCode++;
      if (nextCode >= (1 << codeSize) && codeSize < 12) {
        codeSize++;
      }
    }
    
    prevCode = code;
  }
  
  // Convert indices to RGBA
  const rgba = new Uint8ClampedArray(width * height * 4);
  rgba.fill(0); // Transparent background
  
  for (let y = 0; y < imgHeight; y++) {
    let srcY = y;
    if (interlaced) {
      // Deinterlace
      const passes = [0, 4, 2, 1];
      const increments = [8, 8, 4, 2];
      let row = 0;
      for (let pass = 0; pass < 4; pass++) {
        for (let i = passes[pass]; i < imgHeight; i += increments[pass]) {
          if (row === y) {
            srcY = i;
            break;
          }
          row++;
        }
      }
    }
    
    for (let x = 0; x < imgWidth; x++) {
      const idx = srcY * imgWidth + x;
      if (idx < indices.length) {
        const colorIdx = indices[idx];
        if (colorIdx < colorTable.length) {
          const color = colorTable[colorIdx];
          const destIdx = ((imgTop + y) * width + (imgLeft + x)) * 4;
          rgba[destIdx] = color[0];
          rgba[destIdx + 1] = color[1];
          rgba[destIdx + 2] = color[2];
          rgba[destIdx + 3] = 255;
        }
      }
    }
  }
  
  return { data: rgba, width, height };
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Service-role client for privileged operations (storage upload) while we still validate tenancy via the user client.
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's organization
    const { data: membership, error: memberError } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();

    if (memberError || !membership) {
      return new Response(
        JSON.stringify({ error: 'User not in organization' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const phone = body.phone;
    const stickerUrl = body.stickerUrl || body.sticker_url;
    const quotedMessageId = body.quotedMessageId || body.quoted_message_id;

    if (!phone || !stickerUrl) {
      console.error('Missing required fields:', { phone: !!phone, stickerUrl: !!stickerUrl });
      return new Response(
        JSON.stringify({ error: 'Missing phone or stickerUrl' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get WhatsApp instance config from database
    const { data: instance, error: instanceError } = await supabase
      .from('whatsapp_instances')
      .select('instance_name, api_key, base_url')
      .eq('organization_id', membership.organization_id)
      .single();

    if (instanceError || !instance) {
      console.error('Instance fetch error:', instanceError);
      return new Response(
        JSON.stringify({ error: 'WhatsApp instance not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build quoted message object if provided
    let quotedPayload = {};
    if (quotedMessageId) {
      const { data: quotedMsg } = await supabase
        .from('messages')
        .select('whatsapp_message_id, content')
        .eq('id', quotedMessageId)
        .single();

      if (quotedMsg?.whatsapp_message_id) {
        quotedPayload = {
          quoted: {
            key: { id: quotedMsg.whatsapp_message_id },
            message: { conversation: quotedMsg.content || '' }
          }
        };
      }
    }

    // Format phone number
    const formattedPhone = phone.replace(/\D/g, '');

    // Normalize sticker before sending.
    // Even if input is already `.webp`, we re-encode to a plain WebP because the provider
    // sometimes fails decoding certain WebP variants coming from other sources.
    let finalStickerUrl = stickerUrl;
    try {
      const lower = String(stickerUrl).toLowerCase();

      const imgResp = await fetch(stickerUrl);
      if (!imgResp.ok) {
        throw new Error(`Failed to download sticker: ${imgResp.status} ${imgResp.statusText}`);
      }

      const contentType = (imgResp.headers.get('content-type') || '').toLowerCase();
      const imgArrayBuffer = await imgResp.arrayBuffer();

      const isWebp = contentType.includes('image/webp') || lower.endsWith('.webp');
      const isJpeg = contentType.includes('image/jpeg') || contentType.includes('image/jpg') || lower.endsWith('.jpg') || lower.endsWith('.jpeg');
      const isPng = contentType.includes('image/png') || lower.endsWith('.png');
      const isGif = contentType.includes('image/gif') || lower.endsWith('.gif');

      let decoded:
        | { data: Uint8ClampedArray | Uint8Array | Uint16Array; width: number; height: number }
        | null = null;

      if (isWebp) {
        // Check if it's an animated WebP
        if (isAnimatedWebp(imgArrayBuffer)) {
          console.log('Sticker is animated WebP; extracting first frame...');
          decoded = await extractFirstFrameFromAnimatedWebp(imgArrayBuffer);
          // If extraction failed, try sending original
          if (!decoded) {
            console.log('Frame extraction failed, will try sending original URL');
          }
        } else {
          console.log('Sticker is static WebP; re-encoding for compatibility...');
          decoded = await decodeWebp(imgArrayBuffer) as any;
        }
      } else if (isJpeg) {
        console.log('Sticker is JPEG; converting to WebP...');
        decoded = await decodeJpeg(imgArrayBuffer) as any;
      } else if (isPng) {
        console.log('Sticker is PNG; converting to WebP...');
        decoded = await decodePng(imgArrayBuffer) as any;
      } else if (isGif) {
        console.log('Sticker is GIF; extracting first frame and converting to WebP...');
        decoded = await decodeGifFirstFrame(imgArrayBuffer);
        if (!decoded) {
          console.warn('GIF first-frame extraction failed, trying as PNG fallback...');
          try {
            decoded = await decodePng(imgArrayBuffer) as any;
          } catch {
            console.warn('PNG fallback also failed for GIF');
          }
        }
      } else {
        console.log('Unsupported sticker format for normalization; sending original URL. content-type:', contentType);
      }

      if (decoded) {
        // Encode to WebP (static). This intentionally drops animation if present.
        const rgba: Uint8ClampedArray =
          decoded.data instanceof Uint8ClampedArray
            ? decoded.data
            : Uint8ClampedArray.from(decoded.data as unknown as ArrayLike<number>);

        // Ensure the backing buffer is a plain ArrayBuffer (not ArrayBufferLike) for Deno's lib.d.ts.
        const safeRgba = new Uint8ClampedArray(rgba.length);
        safeRgba.set(rgba);

        // Edge runtime doesn't provide `ImageData`, but `@jsquash/webp` only types the input as `ImageData`.
        // We pass an ImageData-like object and cast for TS compatibility.
        const imgDataLike = {
          data: safeRgba as unknown as Uint8ClampedArray<ArrayBuffer>,
          width: decoded.width,
          height: decoded.height,
        } as unknown as ImageData;

        const webpArrayBuffer = await encodeWebp(imgDataLike);
        const webpBytes = new Uint8Array(webpArrayBuffer);

        const storagePath = `${membership.organization_id}/${user.id}/${Date.now()}.webp`;
        const { error: uploadError } = await supabaseAdmin.storage
          .from('stickers')
          .upload(storagePath, webpBytes, {
            contentType: 'image/webp',
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) {
          console.error('Normalized WebP upload error:', uploadError);
        } else {
          const { data: urlData } = supabaseAdmin.storage
            .from('stickers')
            .getPublicUrl(storagePath);

          if (urlData?.publicUrl) {
            finalStickerUrl = urlData.publicUrl;
            console.log('Normalized sticker uploaded:', finalStickerUrl);
          }
        }
      }
    } catch (convErr) {
      console.error('Sticker normalization failed, sending original URL:', convErr);
      // keep finalStickerUrl as original stickerUrl
    }

    // Send sticker via Stevo/Evolution API
    // Other send endpoints in this project use: /send/text and /send/media (no instance_name in path)
    // Some provider versions expose stickers as /send/sticker; older ones may still use /message/sendSticker/{instance}
    const requestBody = {
      number: formattedPhone,
      // Most APIs accept `sticker` as an URL.
      sticker: finalStickerUrl,
      ...quotedPayload,
    };

    const candidateUrls = [
      `${instance.base_url}/send/sticker`,
      `${instance.base_url}/message/sendSticker/${instance.instance_name}`,
      `${instance.base_url}/message/sendSticker`,
    ];

    console.log('Sending sticker to:', formattedPhone);
    console.log('Sticker URL:', finalStickerUrl);
    console.log('Candidate endpoints:', candidateUrls);

    let response: Response | null = null;
    let responseText = '';
    let usedUrl: string | null = null;

    for (const url of candidateUrls) {
      usedUrl = url;
      console.log('Trying sticker endpoint:', url);
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: instance.api_key,
        },
        body: JSON.stringify(requestBody),
      });

      responseText = await response.text();
      console.log('Stevo response:', responseText);

      // If it's not a 404, don't keep trying other endpoints.
      if (response.status !== 404) break;
    }

    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      result = { raw: responseText };
    }

    if (!response || !response.ok) {
      console.error('Stevo API error:', { usedUrl, result });
      return new Response(
        JSON.stringify({ error: 'Failed to send sticker', details: result, usedUrl }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract message ID from response
    const messageId = result?.key?.id || result?.messageId || null;

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageId,
        result 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in stevo-send-sticker:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
