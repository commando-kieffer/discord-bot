import { InteractionResponseType, InteractionResponseFlags } from 'discord-interactions'

// Seules les mentions de membres peuvent notifier : un texte saisi par un membre (pseudo, plainte...) ne pourra
// jamais déclencher un @everyone, un @here ou la mention d'un rôle
export const ALLOWED_MENTIONS = { parse: ['users'] }

export const pong = () => ({ type: InteractionResponseType.PONG })

export const reply = (content, data = {}) => ({
	type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
	data: { content, allowed_mentions: ALLOWED_MENTIONS, ...data },
})

// Visible uniquement par la personne qui a lancé la commande
export const privateReply = (content) => reply(content, { flags: InteractionResponseFlags.EPHEMERAL })

export const modal = (data) => ({ type: InteractionResponseType.MODAL, data })
