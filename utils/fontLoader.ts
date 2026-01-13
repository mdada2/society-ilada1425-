// Font loader utility for embedding DVOT SurekhMR in jsPDF
import { jsPDF } from 'jspdf';

/**
 * Loads DVOT SurekhMR font and adds it to jsPDF document
 * @param doc - jsPDF document instance
 * @returns Promise that resolves when font is loaded
 */
export async function loadDVOTFont(doc: jsPDF): Promise<void> {
    try {
        // Fetch the font file
        const response = await fetch('/fonts/DVOTSurekhMR_N_Ship.ttf');
        const fontBlob = await response.blob();

        // Convert to base64
        const reader = new FileReader();

        return new Promise((resolve, reject) => {
            reader.onloadend = () => {
                try {
                    const base64 = (reader.result as string).split(',')[1];

                    // Add font to jsPDF
                    doc.addFileToVFS('DVOTSurekhMR-normal.ttf', base64);
                    doc.addFont('DVOTSurekhMR-normal.ttf', 'DVOT SurekhMR', 'normal');

                    // Also load bold variant
                    loadBoldFont(doc).then(() => resolve()).catch(() => resolve());
                } catch (error) {
                    console.error('Error adding font to PDF:', error);
                    reject(error);
                }
            };

            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(fontBlob);
        });
    } catch (error) {
        console.error('Error loading font:', error);
        throw error;
    }
}

/**
 * Loads DVOT SurekhMR Bold font
 */
async function loadBoldFont(doc: jsPDF): Promise<void> {
    try {
        const response = await fetch('/fonts/DVOTSurekhMR_B_Ship.ttf');
        const fontBlob = await response.blob();

        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                try {
                    const base64 = (reader.result as string).split(',')[1];
                    doc.addFileToVFS('DVOTSurekhMR-bold.ttf', base64);
                    doc.addFont('DVOTSurekhMR-bold.ttf', 'DVOT SurekhMR', 'bold');
                    resolve();
                } catch (error) {
                    console.error('Error adding bold font:', error);
                    reject(error);
                }
            };
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(fontBlob);
        });
    } catch (error) {
        console.error('Error loading bold font:', error);
        throw error;
    }
}
