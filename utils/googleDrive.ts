import { useState, useEffect, useCallback } from 'react';

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

    // Load Google Identity Services Script
    useEffect(() => {
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = () => setIsInitialized(true);
        document.body.appendChild(script);

        return () => {
            document.body.removeChild(script);
        };
    }, []);

    // Initialize Token Client
    useEffect(() => {
        if (isInitialized && window.google) {
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
        }
    }, [isInitialized]);

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

    const login = useCallback(() => {
        if (tokenClient) {
            tokenClient.requestAccessToken();
        } else {
            setError("Google API not initialized yet.");
        }
    }, [tokenClient]);

    const logout = useCallback(() => {
        const token = accessToken;
        if (token && window.google) {
            window.google.accounts.oauth2.revoke(token, () => {
                setAccessToken(null);
                setUser(null);
                localStorage.removeItem('google_drive_token');
                localStorage.removeItem('google_drive_user');
            });
        } else {
            setAccessToken(null);
            setUser(null);
            localStorage.removeItem('google_drive_token');
            localStorage.removeItem('google_drive_user');
        }
    }, [accessToken]);

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
            console.error("Failed to fetch user profile", err);
        }
    };

    /**
     * Search for a file by name in the App Folder (or root if app folder not specific)
     * We search for files created by this app (drive.file scope)
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
            console.error("Error searching file", err);
            return null;
        }
    };

    /**
     * Upload (Create or Update) a file
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
            // First check if file exists to update it, or create new
            // For simplicity in this version, we will just create a new one or overwrite if we find ID
            // Note: drive.file scope only lets us see files WE created.

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

            return res.status === 200;
        } catch (err) {
            console.error("Upload failed", err);
            return false;
        }
    };

    const downloadFile = async (fileId: string): Promise<any> => {
        if (!accessToken) return null;
        try {
            const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            const data = await res.json();
            return data;
        } catch (err) {
            console.error("Download failed", err);
            return null;
        }
    };

    return { isInitialized, accessToken, user, login, logout, uploadFile, findFile, downloadFile, error };
};
