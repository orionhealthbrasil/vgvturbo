import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

// Cache configuration
const CACHE_KEY_PREFIX = 'profile_pic_cache_';
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CachedProfilePicture {
  url: string | null;
  fetchedAt: number;
}

// Get cached profile picture from localStorage
function getCachedProfilePicture(contactId: string): string | null {
  try {
    const cached = localStorage.getItem(`${CACHE_KEY_PREFIX}${contactId}`);
    if (!cached) return null;
    
    const data: CachedProfilePicture = JSON.parse(cached);
    const now = Date.now();
    
    // Check if cache is still valid
    if (now - data.fetchedAt < CACHE_DURATION_MS) {
      return data.url;
    }
    
    // Cache expired, remove it
    localStorage.removeItem(`${CACHE_KEY_PREFIX}${contactId}`);
    return null;
  } catch {
    return null;
  }
}

// Set cached profile picture in localStorage
function setCachedProfilePicture(contactId: string, url: string | null): void {
  try {
    const data: CachedProfilePicture = {
      url,
      fetchedAt: Date.now(),
    };
    localStorage.setItem(`${CACHE_KEY_PREFIX}${contactId}`, JSON.stringify(data));
  } catch (e) {
    // localStorage might be full or disabled, ignore
    console.warn('Failed to cache profile picture:', e);
  }
}

// Clear expired cache entries (call periodically)
export function clearExpiredProfilePictureCache(): void {
  try {
    const now = Date.now();
    const keysToRemove: string[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(CACHE_KEY_PREFIX)) {
        try {
          const cached = localStorage.getItem(key);
          if (cached) {
            const data: CachedProfilePicture = JSON.parse(cached);
            if (now - data.fetchedAt >= CACHE_DURATION_MS) {
              keysToRemove.push(key);
            }
          }
        } catch {
          keysToRemove.push(key);
        }
      }
    }
    
    keysToRemove.forEach(key => localStorage.removeItem(key));
  } catch {
    // Ignore errors
  }
}

interface UseProfilePictureOptions {
  contactId: string;
  phone: string;
  organizationId: string;
  currentUrl: string | null;
}

export function useProfilePicture({ contactId, phone, organizationId, currentUrl }: UseProfilePictureOptions) {
  const [isLoading, setIsLoading] = useState(false);
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(currentUrl);
  const queryClient = useQueryClient();

  // Reset state when contact changes, then check cache
  useEffect(() => {
    if (currentUrl) {
      setProfilePictureUrl(currentUrl);
      setCachedProfilePicture(contactId, currentUrl);
    } else {
      // Check local cache, but default to null if no cache exists
      const cached = getCachedProfilePicture(contactId);
      setProfilePictureUrl(cached ?? null);
    }
  }, [contactId, currentUrl]);

  const refreshProfilePicture = useCallback(async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-profile-picture', {
        body: {
          phone,
          organization_id: organizationId,
          contact_id: contactId,
        },
      });

      if (error) {
        console.error('Error fetching profile picture:', error);
        toast.error('Erro ao buscar foto de perfil');
        return;
      }

      const newUrl = data?.profilePictureUrl || null;
      
      // Update local state
      setProfilePictureUrl(newUrl);
      
      // Update cache
      setCachedProfilePicture(contactId, newUrl);
      
      // Invalidate contacts query to refresh UI
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      
      if (newUrl) {
        toast.success('Foto de perfil atualizada!');
      } else {
        toast.info('Este contato não possui foto de perfil pública');
      }
    } catch (error) {
      console.error('Failed to refresh profile picture:', error);
      toast.error('Erro ao buscar foto de perfil');
    } finally {
      setIsLoading(false);
    }
  }, [contactId, phone, organizationId, isLoading, queryClient]);

  return {
    profilePictureUrl,
    isLoading,
    refreshProfilePicture,
  };
}

// Batch refresh for multiple contacts
export async function refreshMultipleProfilePictures(
  contacts: Array<{ id: string; phone: string; organizationId: string }>,
  onProgress?: (current: number, total: number) => void
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;
  
  for (let i = 0; i < contacts.length; i++) {
    const contact = contacts[i];
    onProgress?.(i + 1, contacts.length);
    
    try {
      const { data, error } = await supabase.functions.invoke('fetch-profile-picture', {
        body: {
          phone: contact.phone,
          organization_id: contact.organizationId,
          contact_id: contact.id,
        },
      });

      if (!error && data) {
        setCachedProfilePicture(contact.id, data.profilePictureUrl || null);
        success++;
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  return { success, failed };
}
