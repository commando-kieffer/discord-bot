// Une commande est identifiée par son type et son nom : une commande slash et une action peuvent porter le même nom
const commandKey = (command) => `${command.type ?? 1}:${command.name}`

// Ne compare que ce que le bot définit : Discord renvoie aussi des champs à lui (id, version, permissions...)
const normalizeOption = (option) => ({
	type: option.type,
	name: option.name,
	description: option.description ?? '',
	required: Boolean(option.required),
	choices: (option.choices ?? []).map(({ name, value }) => ({ name, value })),
})

const normalize = (command) =>
	JSON.stringify({
		type: command.type ?? 1,
		description: command.description ?? '',
		options: (command.options ?? []).map(normalizeOption),
	})

export const needsUpdate = (installed, wanted) => normalize(installed) !== normalize(wanted)

export function createCommandRegistry({ discord, logger }) {
	// Installe les commandes manquantes, met à jour celles qui ont changé et supprime les anciennes.
	// Les appels sont faits un par un pour ne pas déclencher la limite de requêtes de Discord.
	async function HasGuildCommands(appId, guildId, commands, removed = []) {
		if (!guildId || !appId) return

		let installed
		try {
			installed = await discord.listCommands()
		} catch (err) {
			logger.error('Impossible de récupérer les commandes installées', { error: err })
			return
		}

		// This is just matching on the name (and the type), the definitions are compared below for updates
		const installedByKey = new Map(installed.map((command) => [commandKey(command), command]))

		for (const command of commands) {
			// Checks for a command
			const existing = installedByKey.get(commandKey(command))
			try {
				if (!existing) {
					logger.info(`Installing "${command.name}"`)
					// install command
					await discord.createCommand(command)
				} else if (needsUpdate(existing, command)) {
					logger.info(`Updating "${command.name}"`)
					await discord.editCommand(existing.id, command)
				} else {
					logger.debug(`"${command.name}" command already installed`)
				}
			} catch (err) {
				logger.error(`Commande "${command.name}" non installée`, { error: err })
			}
		}

		for (const command of removed) {
			const existing = installedByKey.get(commandKey(command))
			if (!existing) continue
			try {
				logger.info(`Removing "${command.name}"`)
				await discord.deleteCommand(existing.id)
			} catch (err) {
				logger.error(`Commande "${command.name}" non supprimée`, { error: err })
			}
		}
	}

	return { HasGuildCommands }
}
