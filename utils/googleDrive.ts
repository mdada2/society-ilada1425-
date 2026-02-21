import { useState, useEffect, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { SocialLogin } from '@capgo/capacitor-social-login';
import type { GoogleLoginResponseOnline } from '@capgo/capacitor-social-login';

declare global {
    interface Window {
        google: any;
    }
}

// Types for Google API
interface GoogleToken {
    access_token: string;
    expires_in: number;
    scope: string;
    token_type: string;
}

interface UserProfile {
    name: string;
    email: string;
    picture: string;
}

// Google Cloud Client ID for Society Ilada Manager
const CLIENT_ID = '17723786712-nt8kpbjv0rbi2u9v75r9ouq7eqconhd2.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email';

export const useGoogleDrive = () => {
    const [tokenClient, setTokenClient] = useState<any>(null);
    const [accessToken, setAccessToken] = useState<string | null>(() => {
        // Load saved token from localStorage
        return localStorage.getItem('google_drive_token');
    });
    const [user, setUser] = useState<UserProfile | null>(() => {
        // Load saved user from localStorage
        const savedUser = localStorage.getItem('google_drive_user');
        return savedUser ? JSON.parse(savedUser) : null;
    });
    const [isInitialized, setIsInitialized] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Check if running on native mobile platform
    const isNative = Capacitor.isNativePlatform();
    const initAttempted = useRef(false);

    // Initialize Google Auth based on platform
    useEffect(() => {
        if (initAttempted.current) return;
        initAttempted.current = true;

        if (isNative) {
            // Native mobile initialization using @capgo/capacitor-social-login
            console.log('[GoogleDrive] Initializing for native platform...');
            SocialLogin.initialize({
                google: {
                    webClientId: CLIENT_ID,
                    mode: 'online', // We need access token for Drive API
                }
            })
                .then(() => {
                    console.log('[GoogleDrive] Native SocialLogin initialized successfully');
                    setIsInitialized(true);
                })
                .catch((err: any) => {
                    console.error('[GoogleDrive] Native SocialLogin init failed:', err);
                    // Still set initialized to true so web fallback can work
                    setIsInitialized(true);
                    setError('Google Auth initialization failed on native');
                });
        } else {
            // Web initialization - load Google Identity Services script
            console.log('[GoogleDrive] Initializing for web platform...');
            const existingScript = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
            if (existingScript) {
                setIsInitialized(true);
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://accounts.google.com/gsi/client';
            script.async = true;
            script.defer = true;
            script.onload = () => {
                console.log('[GoogleDrive] Web GIS script loaded');
                setIsInitialized(true);
            };
            script.onerror = () => {
                console.error('[GoogleDrive] Failed to load GIS script');
                setError('Failed to load Google Sign-In');
            };
            document.body.appendChild(script);
        }
    }, [isNative]);

    // Initialize Token Client for web
    useEffect(() => {
        if (!isNative && isInitialized && window.google && !tokenClient) {
            try {
                const client = window.google.accounts.oauth2.initTokenClient({
                    client_id: CLIENT_ID,
                    scope: SCOPES,
                    callback: (response: GoogleToken) => {
                        if (response.access_token) {
                            setAccessToken(response.access_token);
                            fetchUserProfile(response.access_token);
                        }
                    },
                });
                setTokenClient(client);
            } catch (err) {
                console.error('[GoogleDrive] Failed to init token client:', err);
            }
        }
    }, [isNative, isInitialized, tokenClient]);

    // Save access token to localStorage whenever it changes
    useEffect(() => {
        if (accessToken) {
            localStorage.setItem('google_drive_token', accessToken);
        } else {
            localStorage.removeItem('google_drive_token');
        }
    }, [accessToken]);

    // Save user profile to localStorage whenever it changes
    useEffect(() => {
        if (user) {
            localStorage.setItem('google_drive_user', JSON.stringify(user));
        } else {
            localStorage.removeItem('google_drive_user');
        }
    }, [user]);

    const fetchUserProfile = async (token: string) => {
        try {
            const res = await fetch('https://www.googleapis.com/oauth2/v1/userinfo?alt=json', {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            setUser({
                name: data.name,
                email: data.email,
                picture: data.picture,
            });
        } catch (err) {
            console.error("[GoogleDrive] Failed to fetch user profile", err);
        }
    };

    const login = useCallback(async () => {
        console.log('[GoogleDrive] Login called, isNative:', isNative);

        if (isNative) {
            // Native Google Sign-In using @capgo/capacitor-social-login
            try {
                const result = await SocialLogin.login({
                    provider: 'google',
                    options: {
                        scopes: SCOPES.split(' '),
                    }
                });
                console.log('[GoogleDrive] Native login result:', result);

                // Type guard for online response
                if (result.result && 'accessToken' in result.result) {
                    const onlineResult = result.result as GoogleLoginResponseOnline;

                    if (onlineResult.accessToken?.token) {
                        setAccessToken(onlineResult.accessToken.token);
                    }

                    if (onlineResult.profile) {
                        setUser({
                            name: onlineResult.profile.name || 'Google User',
                            email: onlineResult.profile.email || '',
                            picture: onlineResult.profile.imageUrl || ''
                        });
                    }
                } else {
                    console.error('[GoogleDrive] No access token in result or offline mode');
                    setError('Login failed: No access token received');
                }
            } catch (err: any) {
                console.error('[GoogleDrive] Native login failed:', err);
                setError(err.message || 'Login failed');
            }
        } else {
            // Web login using popup
            if (tokenClient) {
                try {
                    tokenClient.requestAccessToken();
                } catch (err) {
                    console.error('[GoogleDrive] Web login failed:', err);
                    setError('Login failed');
                }
            } else {
                setError("Google API not initialized yet. Please wait and try again.");
            }
        }
    }, [isNative, tokenClient]);

    const logout = useCallback(async () => {
        console.log('[GoogleDrive] Logout called, isNative:', isNative);

        if (isNative) {
            try {
                await SocialLogin.logout({ provider: 'google' });
                console.log('[GoogleDrive] Native logout successful');
            } catch (err) {
                console.error('[GoogleDrive] Native logout failed:', err);
            }
        } else {
            // Web logout - revoke token
            const token = accessToken;
            if (token && window.google) {
                try {
                    window.google.accounts.oauth2.revoke(token, () => {
                        console.log('[GoogleDrive] Token revoked');
                    });
                } catch (err) {
                    console.error('[GoogleDrive] Token revoke failed:', err);
                }
            }
        }

        // Clear local state
        setAccessToken(null);
        setUser(null);
        localStorage.removeItem('google_drive_token');
        localStorage.removeItem('google_drive_user');
    }, [isNative, accessToken]);

    /**
     * Search for a file by name in Google Drive
     */
    const findFile = async (filename: string): Promise<string | null> => {
        if (!accessToken) return null;
        try {
            const q = encodeURIComponent(`name = '${filename}' and trashed = false`);
            const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id, name, modifiedTime)`, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            const data = await res.json();
            if (data.files && data.files.length > 0) {
                return data.files[0].id;
            }
            return null;
        } catch (err) {
            console.error("[GoogleDrive] Error searching file", err);
            return null;
        }
    };

    /**
     * Upload (Create or Update) a file to Google Drive
     */
    const uploadFile = async (content: object, filename: string): Promise<boolean> => {
        if (!accessToken) return false;

        const fileContent = JSON.stringify(content, null, 2);
        const fileMetadata = {
            name: filename,
            mimeType: 'application/json',
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(fileMetadata)], { type: 'application/json' }));
        form.append('file', new Blob([fileContent], { type: 'application/json' }));

        try {
            const existingFileId = await findFile(filename);
            let url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
            let method = 'POST';

            if (existingFileId) {
                url = `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart`;
                method = 'PATCH';
            }

            const res = await fetch(url, {
                method: method,
                headers: { Authorization: `Bearer ${accessToken}` },
                body: form,
            });

            if (res.status === 200) {
                console.log('[GoogleDrive] File uploaded successfully');
                return true;
            } else {
                console.error('[GoogleDrive] Upload failed with status:', res.status);
                const errorText = await res.text();
                console.error('[GoogleDrive] Error response:', errorText);
                return false;
            }
        } catch (err) {
            console.error("[GoogleDrive] Upload failed", err);
            return false;
        }
    };

    /**
     * Download a file from Google Drive
     */
    const downloadFile = async (fileId: string): Promise<any> => {
        if (!accessToken) return null;
        try {
            const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            const data = await res.json();
            return data;
        } catch (err) {
            console.error("[GoogleDrive] Download failed", err);
            return null;
        }
    };

    return {
        isInitialized,
        accessToken,
        user,
        login,
        logout,
        uploadFile,
        findFile,
        downloadFile,
        error,
        isNative // Expose for debugging
    };
};
