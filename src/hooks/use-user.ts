import { useState, useEffect } from 'react';
import { LOGGED_IN_USER_PERMISSIONS_KEY, AppUser, RubricId } from '@/app/dashboard/settings/components/user-management';

// This hook is designed to be a lightweight user object provider for the client-side.
// It only retrieves what is stored in localStorage, which is primarily the permissions object.
// It constructs a partial AppUser object for use in components.

export const useUser = () => {
  // We define the user state as a partial AppUser, specifically with the `permissions` property.
  const [user, setUser] = useState<{ permissions: Partial<Record<RubricId, boolean>> } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const storedPermissionsData = localStorage.getItem(LOGGED_IN_USER_PERMISSIONS_KEY);
      
      if (storedPermissionsData) {
        // The data in localStorage is JUST the permissions object.
        const parsedPermissions = JSON.parse(storedPermissionsData);
        
        // We wrap it in an object that matches the structure components now expect, e.g., { permissions: { ... } }
        setUser({ permissions: parsedPermissions });
      } else {
        // If no permissions are found, there's no user context.
        setUser(null);
      }
    } catch (error) {
      // Catch any JSON parsing errors or other issues.
      console.error("Failed to parse user permissions from localStorage:", error);
      setUser(null);
    } finally {
      // Stop loading once the process is complete, regardless of outcome.
      setIsLoading(false);
    }
  }, []); // Empty dependency array ensures this runs only once on mount.

  return { user, isLoading };
};
