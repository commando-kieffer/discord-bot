import { assertSnowflake } from '../security/validation.js'

// Les appels à l'API Discord utilisés par le bot. Chaque identifiant est vérifié avant d'être mis dans l'URL.
export function createDiscordService({ client, appId, guildId }) {
	const member = (userId) => `guilds/${assertSnowflake(guildId, 'serveur')}/members/${assertSnowflake(userId, 'membre')}`

	// API endpoint to get and post guild commands
	// const endpoint = `applications/${appId}/guilds/${guildId}/commands`;
	const commands = () => `applications/${assertSnowflake(appId, 'application')}/commands`

	return {
		getMember: (userId) => client.requestJson(member(userId)),

		updateMember: (userId, body) => client.requestJson(member(userId), { method: 'PATCH', body }),

		listMembers: (limit = 1000) =>
			client.requestJson(`guilds/${assertSnowflake(guildId, 'serveur')}/members?limit=${Number(limit)}`),

		sendMessage: (channelId, body) =>
			client.requestJson(`channels/${assertSnowflake(channelId, 'salon')}/messages`, { method: 'POST', body }),

		openDirectMessage: (userId) =>
			client.requestJson('users/@me/channels', {
				method: 'POST',
				body: { recipient_id: assertSnowflake(userId, 'membre') },
			}),

		listCommands: () => client.requestJson(commands()),

		// Installs a command
		createCommand: (command) => client.requestJson(commands(), { method: 'POST', body: command }),

		editCommand: (commandId, command) =>
			client.requestJson(`${commands()}/${assertSnowflake(commandId, 'commande')}`, { method: 'PATCH', body: command }),

		deleteCommand: (commandId) =>
			client.request(`${commands()}/${assertSnowflake(commandId, 'commande')}`, { method: 'DELETE' }),
	}
}
