export function createComplaintsFeature({ discord, forum, logger }) {
	// La plainte est enregistrée en base, puis une copie est envoyée en message privé à son auteur.
	// Rien n'est publié dans le salon : la réponse à la commande n'est visible que par l'auteur.
	const sendComplaint = async (requesterId, message) => {
		let saved = true
		let content = `Votre plainte a bien été reçue.\n\n==== Votre message ====\n\n> ${message}`

		try {
			await forum.complaints.send(requesterId, message)
		} catch {
			saved = false
			content = `Une erreur est survenue et votre plainte n'a pas pu être reçue. Veuillez réessayer plus tard et prévenir un membre de l'EM si le problème persiste.`
		}

		let copySent = true
		try {
			const channel = await discord.openDirectMessage(requesterId)
			await discord.sendMessage(channel.id, { content, allowed_mentions: { parse: [] } })
		} catch (err) {
			copySent = false
			logger.error('Message privé de confirmation non envoyé', { requesterId, error: err })
		}

		if (!saved) return { status: 200, message: content }

		return {
			status: 200,
			message: copySent
				? 'Votre plainte a bien été reçue. Une copie vous a été envoyée en message privé.'
				: 'Votre plainte a bien été reçue.',
		}
	}

	return { sendComplaint }
}
