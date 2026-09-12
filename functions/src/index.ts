// Force redeploy
import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as nodemailer from "nodemailer";

admin.initializeApp();

// --- Helper Functions ---
const timeToMinutes = (time: string): number => {
    if (!time || !time.includes(':')) return 0;
    const [hours, minutes] = time.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) return 0;
    return hours * 60 + minutes;
};

const formatMinutes = (totalMinutes: number): string => {
    const sign = totalMinutes < 0 ? "-" : "+";
    const absMinutes = Math.abs(totalMinutes);
    const hours = Math.floor(absMinutes / 60);
    const minutes = absMinutes % 60;
    return `${sign}${hours}h${minutes.toString().padStart(2, '0')}`;
};
// -----------------------


export const sendRequestStatusEmail = onCall(
    { secrets: ["GMAIL_EMAIL", "GMAIL_APP_PASSWORD"] },
    async (request) => {
        console.log("--- Début de la fonction sendRequestStatusEmail ---");
        console.log("Données reçues:", JSON.stringify(request.data, null, 2));

        const { requestType, status, userId, requestDetails, reason, requestReason } = request.data;

        if (!requestType || !status || !userId || !requestDetails) {
            console.error("ERREUR: Données d'entrée manquantes.");
            throw new HttpsError('invalid-argument', "Les données requises sont manquantes.");
        }

        const gmailEmail = process.env.GMAIL_EMAIL;
        const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;

        if (!gmailEmail || !gmailAppPassword) {
            console.error("ERREUR: Secrets GMAIL non configurés.");
            throw new HttpsError('internal', "Erreur de configuration du serveur de messagerie.");
        }
        
        let recipientEmail, recipientName;
        try {
            const userDoc = await admin.firestore().collection('brigadeMembers').doc(userId).get();
            if (!userDoc.exists) {
                console.error(`ERREUR: Utilisateur non trouvé avec l'ID: ${userId}`);
                throw new HttpsError('not-found', `Utilisateur non trouvé.`);
            }
            const userData = userDoc.data();
            if (!userData || !userData.email || !userData.name) {
                console.error(`ERREUR: Données utilisateur incomplètes pour l'ID: ${userId}.`);
                throw new HttpsError('internal', "Données utilisateur incomplètes.");
            }
            recipientEmail = userData.email;
            recipientName = userData.name;
            console.log(`Utilisateur trouvé: ${recipientName} (${recipientEmail})`);
        } catch (error) {
            console.error("ERREUR lors de la récupération de l'utilisateur:", error);
            throw new HttpsError('internal', "Impossible de récupérer les données de l'utilisateur.");
        }

        const isAccepted = status === 'accepted';
        const statusText = isAccepted ? 'acceptée' : 'refusée';

        let formattedRequestType = "demande";
        if (requestType === 'absence') formattedRequestType = "demande d'absence";
        else if (requestType === 'overtime') formattedRequestType = "demande de dépassement d'horaire";
        else if (requestType === 'scheduleChange') formattedRequestType = "demande de changement d'horaire";
        
        const subject = isAccepted 
            ? `Votre ${formattedRequestType} a été acceptée`
            : `Mise à jour de votre ${formattedRequestType}`;

        let text = `Bonjour ${recipientName},\n\nVoici la décision concernant votre ${formattedRequestType}.\n\n`;

        let detailsBody: string;
        if (requestType === 'scheduleChange' && Array.isArray(requestDetails)) {
            detailsBody = "Voici les détails de votre demande :\n";
            
            if (requestReason) {
                detailsBody += `\nMotif : ${requestReason}\n`;
            }

            let totalDifference = 0;

            requestDetails.forEach((detail: any) => {
                const dateObj = new Date(detail.date);
                const formattedDate = !isNaN(dateObj.getTime())
                    ? dateObj.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Paris' })
                    : "Date non spécifiée";
        
                detailsBody += `\n- Pour le ${formattedDate}:\n`;
        
                let originalDuration = 0;
                if (detail.originalStartTime && detail.originalEndTime) {
                    detailsBody += `  - Heures d'absence: de ${detail.originalStartTime} à ${detail.originalEndTime}\n`;
                    originalDuration = timeToMinutes(detail.originalEndTime) - timeToMinutes(detail.originalStartTime);
                }
        
                let newDuration = 0;
                if (detail.newStartTime && detail.newEndTime) {
                    detailsBody += `  - Heures de récupération: de ${detail.newStartTime} à ${detail.newEndTime}\n`;
                    newDuration = timeToMinutes(detail.newEndTime) - timeToMinutes(detail.newStartTime);
                }

                totalDifference += (newDuration - originalDuration);
            });

            if (totalDifference !== 0) {
                detailsBody += `\nDifférence totale : ${formatMinutes(totalDifference)}\n`;
            }

        } else {
            detailsBody = `Rappel de votre demande :\n${requestDetails}`;
        }

        text += detailsBody + '\n\n';

        if (!isAccepted) {
            console.log(`Traitement d'un REFUS. Statut reçu: '${status}'. Motif:`, reason);
            text += `Décision : ${statusText}\n`;
            text += `Motif : ${reason || "Non spécifié"}\n\n`;
        } else {
            console.log("Traitement d'une ACCEPTATION.");
            text += `Décision : ${statusText}\n\n`;
            text += `Cette décision a été enregistrée dans le système.\n\n`;
        }
        
        text += "La version PDF de ce document est disponible au téléchargement sur votre espace personnel dans l'application.\n\n";
        text += "Bonne journée et bon courage\n\n";
        text += "Julien";

        const mailOptions = {
            from: `Chef Julien <${gmailEmail}>`,
            to: recipientEmail,
            subject: subject,
            text: text,
        };

        console.log("Préparation de l'envoi de l'e-mail...");
        try {
            const transporter = nodemailer.createTransport({
                service: "gmail",
                auth: { user: gmailEmail, pass: gmailAppPassword },
            });
            await transporter.sendMail(mailOptions);
            console.log(`--- SUCCÈS: E-mail envoyé à ${recipientEmail} pour un statut '${status}'. ---`);
            return { success: true, message: "E-mail envoyé avec succès." };
        } catch (error) {
            console.error("--- ERREUR CRITIQUE lors de l'envoi de l'e-mail:", error);
            throw new HttpsError('internal', "L'envoi de l'e-mail a échoué.");
        }
    }
);

export const sendGeneralEmailToTeam = onCall(
    { secrets: ["GMAIL_EMAIL", "GMAIL_APP_PASSWORD"] },
    async (request) => {
        console.log("--- Début de la fonction sendGeneralEmailToTeam ---");
        const { subject, body, recipientIds } = request.data;

        if (!subject || !body) {
            console.error("ERREUR: Sujet ou corps du message manquant.");
            throw new HttpsError('invalid-argument', "Le sujet et le corps du message sont requis.");
        }

        const gmailEmail = process.env.GMAIL_EMAIL;
        const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;

        if (!gmailEmail || !gmailAppPassword) {
            console.error("ERREUR: Secrets GMAIL non configurés.");
            throw new HttpsError('internal', "Erreur de configuration du serveur de messagerie.");
        }

        let recipients: string[] = [];
        try {
            const brigadeMembersCollection = admin.firestore().collection('brigadeMembers');

            if (recipientIds && Array.isArray(recipientIds) && recipientIds.length > 0) {
                console.log(`Envoi à des destinataires spécifiques: ${recipientIds.join(', ')}`);
                const snapshot = await brigadeMembersCollection.where(admin.firestore.FieldPath.documentId(), 'in', recipientIds).get();
                snapshot.forEach(doc => {
                    const memberData = doc.data();
                    if (memberData.email) {
                        recipients.push(memberData.email);
                    }
                });
                console.log(`E-mails collectés pour les IDs spécifiques: ${recipients.join(", ")}`);
            } else {
                console.log("Envoi à toute l'équipe (sauf le chef).");
                const snapshot = await brigadeMembersCollection.where('name', '!=', 'Chef').get();
                if (snapshot.empty) {
                    console.log("Aucun membre d'équipe trouvé (à part potentiellement le chef).");
                    return { success: true, message: "Aucun membre d'équipe trouvé, aucun e-mail envoyé." };
                }
                snapshot.forEach(doc => {
                    const memberData = doc.data();
                    if (memberData.email) {
                        recipients.push(memberData.email);
                    }
                });
                console.log(`E-mails collectés (sans le chef): ${recipients.join(", ")}`);
            }

        } catch (error) {
            console.error("ERREUR lors de la récupération des membres:", error);
            throw new HttpsError('internal', "Impossible de récupérer la liste des membres.");
        }

        if (recipients.length === 0) {
            console.log("Aucune adresse e-mail valide trouvée pour les destinataires sélectionnés.");
            return { success: true, message: "Aucun membre avec une adresse e-mail valide." };
        }

        const mailOptions = {
            from: `Chef Julien <${gmailEmail}>`,
            to: gmailEmail, // Send to yourself
            bcc: recipients, // All team members in Bcc
            subject: subject,
            text: body,
        };

        console.log("Préparation de l'envoi de l'e-mail général...");
        try {
            const transporter = nodemailer.createTransport({
                service: "gmail",
                auth: { user: gmailEmail, pass: gmailAppPassword },
            });
            await transporter.sendMail(mailOptions);
            console.log(`--- SUCCÈS: E-mail général envoyé à ${recipients.length} membre(s). ---`);
            return { success: true, message: "E-mail général envoyé avec succès." };
        } catch (error) {
            console.error("--- ERREUR CRITIQUE lors de l'envoi de l'e-mail général:", error);
            throw new HttpsError('internal', "L'envoi de l'e-mail général a échoué.");
        }
    }
);

export const deleteAllDeclarationsOfType = onCall(async (request) => {
    // NOTE : La vérification de sécurité est retirée pour le test.

    // 1. On ne récupère QUE le type.
    const { type } = request.data;
    const validTypes = ['overtime', 'absence', 'scheduleChange'];

    if (!type || !validTypes.includes(type)) {
        // On renvoie une erreur si le type est invalide pour savoir ce qui se passe.
        throw new HttpsError('invalid-argument', 'Le type de déclaration fourni est invalide. Type reçu : ' + type);
    }

    // 2. On détermine la collection à vider
    const collectionMap = {
        overtime: 'overtimeRequests',
        absence: 'absenceRequests',
        scheduleChange: 'scheduleChangeRequests'
    };
    const collectionName = collectionMap[type as keyof typeof collectionMap];

    // 3. On supprime tous les documents
    try {
        const collectionRef = admin.firestore().collection(collectionName);
        const snapshot = await collectionRef.get();

        const batch = admin.firestore().batch();
        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });

        await batch.commit();

        console.log(`SUCCÈS : Suppression de type '${type}' terminée.`);
        return { success: true, message: `Toutes les déclarations de type '${type}' ont été supprimées.` };

    } catch (error) {
        console.error(`Erreur lors de la suppression pour le type '${type}':`, error);
        throw new HttpsError('internal', 'Une erreur est survenue lors de la suppression.');
    }
});
