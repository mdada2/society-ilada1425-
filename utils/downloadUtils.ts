import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

/**
 * Downloads a blob as a file with proper Unicode filename support
 * Works on both web and Android native
 */
export const downloadBlob = async (blob: Blob, filename: string) => {
    // Check if running on native platform (Android/iOS)
    if (Capacitor.isNativePlatform()) {
        try {
            // Convert blob to base64
            const reader = new FileReader();
            reader.readAsDataURL(blob);

            await new Promise((resolve, reject) => {
                reader.onloadend = async () => {
                    try {
                        const base64Data = (reader.result as string).split(',')[1];

                        // Write file to Cache directory (no permissions needed)
                        const result = await Filesystem.writeFile({
                            path: filename,
                            data: base64Data,
                            directory: Directory.Cache,
                            recursive: true
                        });

                        console.log('File saved:', result.uri);

                        // Show share dialog so user can save to Downloads or share
                        await Share.share({
                            title: 'Export File',
                            text: `${filename} exported successfully`,
                            url: result.uri,
                            dialogTitle: 'Save or Share File'
                        });

                        resolve(result);
                    } catch (error) {
                        console.error('Error saving file:', error);
                        reject(error);
                    }
                };
                reader.onerror = reject;
            });
        } catch (error) {
            console.error('Native download failed:', error);
            alert('Export failed. Please check app permissions.');
        }
    } else {
        // Web browser - use standard download
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };
